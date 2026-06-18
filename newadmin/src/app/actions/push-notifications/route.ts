import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import connectMongo from "@/lib/mongo";
import { Event, Competition, CasinoGame, Notification, PushNotification } from "@/models/MongoModels";

const ONESIGNAL_CONFIG_KEY = "ONESIGNAL_CONFIG";

// ─── GET: history + search ──────────────────────────────────

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // Search matches
    if (action === "search-matches") {
        const q = searchParams.get("q") || "";
        try {
            await connectMongo();
            const events = await Event.find({
                event_name: { $regex: q, $options: "i" },
                isVisible: true,
            })
                .sort({ open_date: -1 })
                .limit(20)
                .lean();

            const compIds = [...new Set(events.map((e: any) => e.competition_id))];
            const comps = await Competition.find({ competition_id: { $in: compIds } }).lean();
            const compMap: Record<string, string> = {};
            for (const c of comps) {
                compMap[(c as any).competition_id] = (c as any).sport_id;
            }

            const results = events.map((e: any) => ({
                eventId: e.event_id,
                eventName: e.event_name,
                sportId: compMap[e.competition_id] || "4",
                matchStatus: e.match_status || "",
                deepLink: `zeero://match/${e.event_id}/${compMap[e.competition_id] || "4"}`,
            }));

            return NextResponse.json({ success: true, results });
        } catch (err: any) {
            return NextResponse.json({ success: false, error: err.message }, { status: 500 });
        }
    }

    // Search casino games
    if (action === "search-casino") {
        const q = searchParams.get("q") || "";
        try {
            await connectMongo();
            const games = await CasinoGame.find({
                name: { $regex: q, $options: "i" },
                isActive: true,
            })
                .sort({ playCount: -1 })
                .limit(20)
                .lean();

            const results = games.map((g: any) => ({
                gameCode: g.gameCode,
                name: g.name,
                provider: g.provider,
                icon: g.icon || g.image || "",
                deepLink: `zeero://casino/game/${g.gameCode}`,
            }));

            return NextResponse.json({ success: true, results });
        } catch (err: any) {
            return NextResponse.json({ success: false, error: err.message }, { status: 500 });
        }
    }

    // History (from MongoDB)
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;

    try {
        await connectMongo();
        const [records, total] = await Promise.all([
            PushNotification.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            PushNotification.countDocuments(),
        ]);

        return NextResponse.json({
            success: true,
            records: records.map((r: any) => ({ ...r, id: r._id?.toString() })),
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message, records: [] }, { status: 500 });
    }
}

// ─── POST: send push notification ───────────────────────────

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { title, body: msgBody, imageUrl, deepLink, segment } = body;

        if (!title || !msgBody) {
            return NextResponse.json({ success: false, error: "Title and body required" }, { status: 400 });
        }

        // 1. Get OneSignal config from SystemConfig (Prisma/PostgreSQL)
        let appId = "";
        let restApiKey = "";
        try {
            const record = await prisma.systemConfig.findUnique({ where: { key: ONESIGNAL_CONFIG_KEY } });
            if (record?.value) {
                const parsed = JSON.parse(record.value);
                appId = parsed.appId || "";
                restApiKey = parsed.restApiKey || "";
            }
        } catch {}

        // 2. Resolve target users (Prisma — user table stays in PostgreSQL)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        let where: any = {};
        switch (segment) {
            case "VIP": where = { balance: { gte: 100000 } }; break;
            case "NEW": where = { createdAt: { gte: sevenDaysAgo } }; break;
            case "ACTIVE": where = { updatedAt: { gte: sevenDaysAgo } }; break;
            case "CHURNED": where = { updatedAt: { lt: thirtyDaysAgo } }; break;
            default: where = {}; break;
        }

        const users = await (prisma.user as any).findMany({ where });
        const playerIds = users
            .filter((u: any) => (u as any).onesignalPlayerId)
            .map((u: any) => (u as any).onesignalPlayerId);
        const userIds = users.map((u: any) => u.id);

        // 3. Call OneSignal REST API
        let onesignalId: string | undefined;
        if (playerIds.length > 0 && appId && restApiKey) {
            try {
                const payload: any = {
                    app_id: appId,
                    headings: { en: title },
                    contents: { en: msgBody },
                    include_subscription_ids: playerIds,
                };
                if (imageUrl) {
                    payload.big_picture = imageUrl;
                    payload.ios_attachments = { id: imageUrl };
                }
                if (deepLink) {
                    payload.url = deepLink;
                    payload.data = { deepLink };
                }

                const osRes = await fetch("https://api.onesignal.com/notifications", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Key ${restApiKey}`,
                    },
                    body: JSON.stringify(payload),
                });

                if (osRes.ok) {
                    const osData = await osRes.json();
                    onesignalId = osData.id;
                } else {
                    console.error("[Push] OneSignal error:", await osRes.text());
                }
            } catch (err: any) {
                console.error("[Push] OneSignal call failed:", err.message);
            }
        }

        // 4. Create in-app notifications (MongoDB)
        await connectMongo();
        try {
            const notifDocs = userIds.map((uid: number) => ({
                userId: uid,
                title,
                body: msgBody,
                deepLink: deepLink || undefined,
                isRead: false,
            }));
            if (notifDocs.length > 0) {
                await Notification.insertMany(notifDocs);
            }
        } catch (err: any) {
            console.error("[Push] In-app notification error:", err.message);
        }

        // 5. Log audit record (MongoDB)
        const pushRecord = await PushNotification.create({
            title,
            body: msgBody,
            imageUrl: imageUrl || undefined,
            deepLink: deepLink || undefined,
            segment: segment || "ALL",
            targetUserIds: userIds,
            sentBy: 0,
            sentCount: userIds.length,
            onesignalId: onesignalId || undefined,
        });

        return NextResponse.json({
            success: true,
            sentCount: userIds.length,
            deliveredToDevices: playerIds.length,
            id: pushRecord._id?.toString(),
            onesignalId,
        });
    } catch (err: any) {
        console.error("[Push] Send error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
