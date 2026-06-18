import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const CONFIG_KEY = "ONESIGNAL_CONFIG";

/**
 * GET /api/onesignal-config — read current OneSignal config
 */
export async function GET() {
    try {
        const record = await prisma.systemConfig.findUnique({
            where: { key: CONFIG_KEY },
        });

        if (record?.value) {
            const parsed = JSON.parse(record.value);
            return NextResponse.json({
                success: true,
                appId: parsed.appId || "",
                // SECURITY: never expose the REST API key to the client.
                // Show only whether it is configured.
                restApiKeySet: !!parsed.restApiKey,
            });
        }

        return NextResponse.json({ success: true, appId: "", restApiKeySet: false });
    } catch (err: any) {
        console.error("[OneSignal Config] GET error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to read config" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/onesignal-config — save OneSignal App ID + REST API Key
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { appId, restApiKey } = body;

        // Read current config
        let current: any = {};
        try {
            const record = await prisma.systemConfig.findUnique({
                where: { key: CONFIG_KEY },
            });
            if (record?.value) current = JSON.parse(record.value);
        } catch {}

        // Merge
        const merged = {
            appId: appId !== undefined ? appId : current.appId || "",
            restApiKey: restApiKey !== undefined ? restApiKey : current.restApiKey || "",
        };

        // Upsert
        await prisma.systemConfig.upsert({
            where: { key: CONFIG_KEY },
            update: { value: JSON.stringify(merged) },
            create: { key: CONFIG_KEY, value: JSON.stringify(merged) },
        });

        return NextResponse.json({
            success: true,
            appId: merged.appId,
            // SECURITY: never return the REST API key to the client
            restApiKeySet: !!merged.restApiKey,
        });
    } catch (err: any) {
        console.error("[OneSignal Config] PATCH error:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Failed to save config" },
            { status: 500 }
        );
    }
}
