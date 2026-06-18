import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import connectMongo from "@/lib/mongo";
import { WhatsAppConfig, WhatsAppCampaignLog } from "@/models/MongoModels";

const CONFIG_KEY = "WHATSAPP_CONFIG";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getWAConfig() {
    await connectMongo();
    return (await WhatsAppConfig.findOne({ key: CONFIG_KEY }).lean()) as any;
}

/**
 * Build Meta v23 template component payload from variables.
 * bodyParams: string[]  → replaces {{1}}, {{2}}, …
 * headerParam: string   → header with format TEXT
 */
function buildComponents(
    bodyParams: string[],
    headerParam?: string
): object[] {
    const components: object[] = [];

    if (headerParam) {
        components.push({
            type: "header",
            parameters: [{ type: "text", text: headerParam }],
        });
    }

    if (bodyParams.length > 0) {
        components.push({
            type: "body",
            parameters: bodyParams.map(p => ({ type: "text", text: p })),
        });
    }

    return components;
}

/**
 * Resolve a parameter that may reference a user field.
 * Accepts either a static value or a {{fieldName}} token.
 */
function resolveParam(param: string, user: Record<string, any>): string {
    return param.replace(/\{\{(\w+)\}\}/g, (_, field) => {
        const v = user[field];
        return v != null ? String(v) : "";
    });
}

/**
 * Send a single WhatsApp template message. Throws on error.
 */
async function sendTemplateMessage(
    accessToken: string,
    phoneNumberId: string,
    to: string,
    templateName: string,
    components: object[]
) {
    const payload: any = {
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ""),
        type: "template",
        template: {
            name: templateName,
            language: { code: "en" },
        },
    };
    if (components.length > 0) payload.template.components = components;

    const res = await fetch(
        `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(payload),
        }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
}

// ─── Build Prisma where clause from segment + advanced filters ────────────────

function buildUserWhere(params: {
    segment: string;
    minBalance?: number;
    maxBalance?: number;
    startDate?: string;
    endDate?: string;
}) {
    const { segment, minBalance, maxBalance, startDate, endDate } = params;
    const now = new Date();
    const sevenDaysAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const where: any = {
        phoneNumber: { not: null },
        AND: [{ phoneNumber: { not: "" } }],
    };

    // Base segment preset
    switch (segment) {
        case "VIP":     where.balance = { gte: 100000 }; break;
        case "NEW":     where.createdAt = { gte: sevenDaysAgo }; break;
        case "ACTIVE":  where.updatedAt = { gte: sevenDaysAgo }; break;
        case "CHURNED": where.updatedAt = { lt: thirtyDaysAgo }; break;
    }

    // Advanced overrides / additions
    if (minBalance != null || maxBalance != null) {
        where.balance = {
            ...(where.balance || {}),
            ...(minBalance != null ? { gte: minBalance } : {}),
            ...(maxBalance != null ? { lte: maxBalance } : {}),
        };
    }
    if (startDate) where.createdAt = { ...(where.createdAt || {}), gte: new Date(startDate) };
    if (endDate)   where.createdAt = { ...(where.createdAt || {}), lte: new Date(endDate) };

    return where;
}

// ─── GET: history + preview + progress ───────────────────────────────────────

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "history";

    // ── Recipient preview ────────────────────────────────────────────────────
    if (action === "preview") {
        try {
            const segment    = searchParams.get("segment")    || "ALL";
            const minBalance = searchParams.get("minBalance") ? Number(searchParams.get("minBalance")) : undefined;
            const maxBalance = searchParams.get("maxBalance") ? Number(searchParams.get("maxBalance")) : undefined;
            const startDate  = searchParams.get("startDate")  || undefined;
            const endDate    = searchParams.get("endDate")    || undefined;

            const where = buildUserWhere({ segment, minBalance, maxBalance, startDate, endDate });

            const [count, sample] = await Promise.all([
                (prisma.user as any).count({ where }),
                (prisma.user as any).findMany({
                    where,
                    take: 5,
                    select: { id: true, name: true, phoneNumber: true, balance: true },
                }),
            ]);

            return NextResponse.json({ success: true, count, sample });
        } catch (err: any) {
            return NextResponse.json({ success: false, error: err.message }, { status: 500 });
        }
    }

    // ── Live campaign progress ───────────────────────────────────────────────
    if (action === "progress") {
        const id = searchParams.get("id");
        if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
        try {
            await connectMongo();
            const record = await WhatsAppCampaignLog.findById(id).lean() as any;
            if (!record) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
            return NextResponse.json({
                success: true,
                status:      record.status,
                sentCount:   record.sentCount,
                failedCount: record.failedCount,
                totalUsers:  record.totalUsers,
                pct: record.totalUsers > 0
                    ? Math.round(((record.sentCount + record.failedCount) / record.totalUsers) * 100)
                    : 0,
            });
        } catch (err: any) {
            return NextResponse.json({ success: false, error: err.message }, { status: 500 });
        }
    }

    // ── History ──────────────────────────────────────────────────────────────
    const page  = Number(searchParams.get("page"))  || 1;
    const limit = Number(searchParams.get("limit")) || 20;
    const type  = searchParams.get("type") || "";
    const skip  = (page - 1) * limit;

    try {
        await connectMongo();
        const filter: any = {};
        if (type) filter.type = type;

        const [records, total] = await Promise.all([
            WhatsAppCampaignLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            WhatsAppCampaignLog.countDocuments(filter),
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

// ─── POST: send bulk campaign ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            campaignName,
            templateName,
            segment    = "ALL",
            speedLimit,
            minBalance,
            maxBalance,
            startDate,
            endDate,
            customPhones = [],        // optional manual phone list (E.164 strings)
            variables    = { bodyParams: [], headerParam: "" },
            retryLogId,               // if set, retry failed phones from that campaign
        } = body;

        // ── Validation ──────────────────────────────────────────────────────
        if (!campaignName || !templateName) {
            return NextResponse.json(
                { success: false, error: "campaignName and templateName are required" },
                { status: 400 }
            );
        }
        const speed = Number(speedLimit);
        if (!speed || speed < 1 || speed > 1000) {
            return NextResponse.json(
                { success: false, error: "speedLimit must be 1–1000 messages/min" },
                { status: 400 }
            );
        }
        const delayMs = Math.ceil(60_000 / speed);

        // ── WhatsApp config ──────────────────────────────────────────────────
        const config = await getWAConfig();
        if (!config?.accessToken || !config?.phoneNumberId) {
            return NextResponse.json(
                { success: false, error: "WhatsApp not configured. Save credentials first." },
                { status: 400 }
            );
        }

        // ── Resolve recipients ───────────────────────────────────────────────
        type Recipient = { id?: number; phone: string; name?: string; balance?: number; phoneNumber?: string };
        let recipients: Recipient[] = [];

        if (retryLogId) {
            // Retry mode: re-use failedPhones from previous campaign
            await connectMongo();
            const prev = await WhatsAppCampaignLog.findById(retryLogId).lean() as any;
            if (!prev) return NextResponse.json({ success: false, error: "Original campaign not found" }, { status: 404 });
            recipients = (prev.failedPhones || []).map((p: string) => ({ phone: p }));
        } else if (customPhones.length > 0) {
            // Manual phone list mode
            recipients = customPhones
                .map((p: string) => p.trim())
                .filter(Boolean)
                .map((p: string) => ({ phone: p }));
        } else {
            // Segment / filter mode — only users who registered with a phone number
            const where = buildUserWhere({ segment, minBalance, maxBalance, startDate, endDate });
            const users = await (prisma.user as any).findMany({
                where,
                select: { id: true, name: true, phoneNumber: true, balance: true },
            });
            recipients = users
                .filter((u: any) => u.phoneNumber)
                .map((u: any) => ({
                    id:          u.id,
                    phone:       u.phoneNumber,
                    name:        u.name || "",
                    balance:     u.balance || 0,
                    phoneNumber: u.phoneNumber,
                }));
        }

        // ── Create RUNNING log ───────────────────────────────────────────────
        await connectMongo();
        const logRecord = await WhatsAppCampaignLog.create({
            campaignName,
            type: "BULK",
            templateName,
            segment,
            minBalance,
            maxBalance,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate:   endDate   ? new Date(endDate)   : undefined,
            customPhones,
            variables,
            totalUsers: recipients.length,
            wabaId:     config.wabaId || "",
            speedLimit: speed,
            status:     "RUNNING",
        });

        // ── Send with strict rate limiting ───────────────────────────────────
        let sentCount  = 0;
        let failedCount = 0;
        const targetUserIds: number[] = [];
        const failedPhones: string[] = [];

        for (const recipient of recipients) {
            if (!recipient.phone) continue;
            if (recipient.id) targetUserIds.push(recipient.id);

            // Resolve template variables for THIS user
            const bodyParams = (variables.bodyParams || []).map((p: string) =>
                resolveParam(p, { name: recipient.name || "", balance: recipient.balance || 0, phone: recipient.phone })
            );
            const headerParam = variables.headerParam
                ? resolveParam(variables.headerParam, { name: recipient.name || "", balance: recipient.balance || 0, phone: recipient.phone })
                : undefined;

            const components = buildComponents(bodyParams, headerParam);

            const msgStart = Date.now();
            try {
                await sendTemplateMessage(
                    config.accessToken,
                    config.phoneNumberId,
                    recipient.phone,
                    templateName,
                    components
                );
                sentCount++;
            } catch {
                failedCount++;
                failedPhones.push(recipient.phone);
            }

            // Persist progress every 10 messages so UI can poll it
            if ((sentCount + failedCount) % 10 === 0) {
                await WhatsAppCampaignLog.findByIdAndUpdate(logRecord._id, {
                    sentCount, failedCount, targetUserIds, failedPhones,
                });
            }

            // Strict rate limit: wait remainder of time slot
            const elapsed = Date.now() - msgStart;
            const waitMs  = Math.max(0, delayMs - elapsed);
            if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
        }

        // ── Finalise log ─────────────────────────────────────────────────────
        const finalStatus = failedCount === 0 ? "COMPLETED"
            : sentCount  === 0 ? "FAILED"
            : "PARTIAL";

        await WhatsAppCampaignLog.findByIdAndUpdate(logRecord._id, {
            targetUserIds,
            failedPhones,
            sentCount,
            failedCount,
            status: finalStatus,
        });

        return NextResponse.json({
            success: true,
            campaignId:    logRecord._id?.toString(),
            sentCount,
            failedCount,
            totalUsers:    recipients.length,
            status:        finalStatus,
            speedLimit:    speed,
            delayPerMsgMs: delayMs,
        });
    } catch (err: any) {
        console.error("[WhatsApp Campaign] POST error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
