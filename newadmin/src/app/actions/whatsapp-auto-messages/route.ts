import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/lib/mongo";
import { WhatsAppConfig } from "@/models/MongoModels";

const CONFIG_KEY = "WHATSAPP_CONFIG";

/**
 * GET /api/actions/whatsapp-auto-messages
 * Returns the current auto-message template settings for
 * Welcome, Deposit Success, and Withdrawal Success.
 */
export async function GET() {
    try {
        await connectMongo();
        const record = await WhatsAppConfig.findOne({ key: CONFIG_KEY }).lean() as any;

        return NextResponse.json({
            success: true,
            welcome: {
                template: record?.welcomeTemplate || "welcome_message",
                enabled: record?.welcomeEnabled || false,
            },
            deposit: {
                template: record?.depositTemplate || "deposit_success",
                enabled: record?.depositEnabled || false,
            },
            withdrawal: {
                template: record?.withdrawalTemplate || "withdrawal_success",
                enabled: record?.withdrawalEnabled || false,
            },
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * PATCH /api/actions/whatsapp-auto-messages
 * Updates auto-message template name & enabled flag for any of
 * the three event types (welcome / deposit / withdrawal).
 * Body: { type: "welcome"|"deposit"|"withdrawal", template?: string, enabled?: boolean }
 */
export async function PATCH(req: NextRequest) {
    try {
        await connectMongo();
        const body = await req.json();
        const { type, template, enabled } = body;

        if (!type || !["welcome", "deposit", "withdrawal"].includes(type)) {
            return NextResponse.json(
                { success: false, error: "Invalid type. Must be welcome | deposit | withdrawal" },
                { status: 400 }
            );
        }

        const fieldMap: Record<string, { templateField: string; enabledField: string }> = {
            welcome:    { templateField: "welcomeTemplate",    enabledField: "welcomeEnabled" },
            deposit:    { templateField: "depositTemplate",    enabledField: "depositEnabled" },
            withdrawal: { templateField: "withdrawalTemplate", enabledField: "withdrawalEnabled" },
        };

        const { templateField, enabledField } = fieldMap[type];
        const update: Record<string, any> = {};
        if (template !== undefined) update[templateField] = template;
        if (enabled !== undefined) update[enabledField] = enabled;

        const result = await WhatsAppConfig.findOneAndUpdate(
            { key: CONFIG_KEY },
            { $set: { key: CONFIG_KEY, ...update } },
            { upsert: true, returnDocument: 'after', lean: true }
        ) as any;

        return NextResponse.json({
            success: true,
            [type]: {
                template: result[templateField],
                enabled: result[enabledField],
            },
        });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * POST /api/actions/whatsapp-auto-messages
 * Send a test auto-message to a specific phone number.
 * Body: { type, phone }
 */
export async function POST(req: NextRequest) {
    try {
        await connectMongo();
        const body = await req.json();
        const { type, phone } = body;

        if (!phone) {
            return NextResponse.json({ success: false, error: "phone is required" }, { status: 400 });
        }

        const config = await WhatsAppConfig.findOne({ key: CONFIG_KEY }).lean() as any;
        if (!config?.accessToken || !config?.phoneNumberId) {
            return NextResponse.json({ success: false, error: "WhatsApp not configured" }, { status: 400 });
        }

        const templateMap: Record<string, string> = {
            welcome:    config.welcomeTemplate || "welcome_message",
            deposit:    config.depositTemplate || "deposit_success",
            withdrawal: config.withdrawalTemplate || "withdrawal_success",
        };

        const templateName = templateMap[type] || "welcome_message";

        const res = await fetch(
            `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.accessToken}`,
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: phone.replace(/\D/g, ""),
                    type: "template",
                    template: { name: templateName, language: { code: "en" } },
                }),
            }
        );

        const data = await res.json();
        if (data.error) {
            return NextResponse.json({ success: false, error: data.error.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, messageId: data.messages?.[0]?.id });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
