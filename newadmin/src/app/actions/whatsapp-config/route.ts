import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/lib/mongo";
import { WhatsAppConfig } from "@/models/MongoModels";

const CONFIG_KEY = "WHATSAPP_CONFIG";

// ─── GET: read current WhatsApp config ───────────────────────
export async function GET() {
    try {
        await connectMongo();
        const record = await WhatsAppConfig.findOne({ key: CONFIG_KEY }).lean() as any;

        if (record) {
            return NextResponse.json({
                success: true,
                accessToken: record.accessToken || "",
                appId: record.appId || "",
                wabaId: record.wabaId || "",
                phoneNumberId: record.phoneNumberId || "",
                isActive: record.isActive || false,
                welcomeTemplate: record.welcomeTemplate || "welcome_message",
                welcomeEnabled: record.welcomeEnabled || false,
                depositTemplate: record.depositTemplate || "deposit_success",
                depositEnabled: record.depositEnabled || false,
                withdrawalTemplate: record.withdrawalTemplate || "withdrawal_success",
                withdrawalEnabled: record.withdrawalEnabled || false,
            });
        }

        return NextResponse.json({
            success: true,
            accessToken: "", appId: "", wabaId: "", phoneNumberId: "", isActive: false,
            welcomeTemplate: "welcome_message", welcomeEnabled: false,
            depositTemplate: "deposit_success", depositEnabled: false,
            withdrawalTemplate: "withdrawal_success", withdrawalEnabled: false,
        });
    } catch (err: any) {
        console.error("[WhatsApp Config] GET error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// ─── PATCH: save credentials + template settings ─────────────
export async function PATCH(req: NextRequest) {
    try {
        await connectMongo();
        const body = await req.json();

        const update: Record<string, any> = {};
        const fields = [
            "accessToken", "appId", "wabaId", "phoneNumberId", "isActive",
            "welcomeTemplate", "welcomeEnabled",
            "depositTemplate", "depositEnabled",
            "withdrawalTemplate", "withdrawalEnabled",
        ];
        for (const f of fields) {
            if (body[f] !== undefined) update[f] = body[f];
        }

        const result = await WhatsAppConfig.findOneAndUpdate(
            { key: CONFIG_KEY },
            { $set: { key: CONFIG_KEY, ...update } },
            { upsert: true, returnDocument: 'after', lean: true }
        ) as any;

        return NextResponse.json({ success: true, config: result });
    } catch (err: any) {
        console.error("[WhatsApp Config] PATCH error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

// ─── POST: test connection to WhatsApp Cloud API ──────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { accessToken, phoneNumberId } = body;

        if (!accessToken || !phoneNumberId) {
            return NextResponse.json({ success: false, error: "accessToken and phoneNumberId required" }, { status: 400 });
        }

        // Call Meta Graph API to verify phone number
        const res = await fetch(
            `https://graph.facebook.com/v23.0/${phoneNumberId}?fields=display_phone_number,verified_name,status`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const data = await res.json();
        if (data.error) {
            return NextResponse.json({ success: false, error: data.error.message }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            phoneNumber: data.display_phone_number,
            name: data.verified_name,
            status: data.status,
        });
    } catch (err: any) {
        console.error("[WhatsApp Config] POST test error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
