import { NextRequest, NextResponse } from "next/server";
import connectMongo from "@/lib/mongo";
import { WhatsAppConfig } from "@/models/MongoModels";

const CONFIG_KEY = "WHATSAPP_CONFIG";

/**
 * GET /actions/whatsapp-templates
 * Fetches all message templates from Meta WhatsApp Business API v23.0
 * using the saved WABA ID + Access Token.
 * Supports optional ?status=APPROVED|REJECTED|PENDING filter.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") || "";

    try {
        await connectMongo();
        const config = await WhatsAppConfig.findOne({ key: CONFIG_KEY }).lean() as any;

        if (!config?.accessToken || !config?.wabaId) {
            return NextResponse.json(
                { success: false, error: "WhatsApp not configured — save Access Token and WABA ID first." },
                { status: 400 }
            );
        }

        // Build URL — Meta allows filtering by status and category
        const params = new URLSearchParams({
            fields: "id,name,status,category,language,components,quality_score,rejected_reason",
            limit: "100",
        });
        if (statusFilter) params.set("status", statusFilter);

        const res = await fetch(
            `https://graph.facebook.com/v23.0/${config.wabaId}/message_templates?${params}`,
            {
                headers: { Authorization: `Bearer ${config.accessToken}` },
                // No caching — always fresh from Meta
                cache: "no-store",
            }
        );

        const data = await res.json();

        if (data.error) {
            return NextResponse.json(
                { success: false, error: data.error.message, code: data.error.code },
                { status: 400 }
            );
        }

        const templates = (data.data || []).map((t: any) => ({
            id:             t.id,
            name:           t.name,
            status:         t.status,          // APPROVED | REJECTED | PENDING | PAUSED
            category:       t.category,        // MARKETING | UTILITY | AUTHENTICATION
            language:       t.language,
            qualityScore:   t.quality_score?.score || "UNKNOWN",
            rejectedReason: t.rejected_reason  || null,
            components:     t.components || [],
        }));

        return NextResponse.json({
            success:   true,
            templates,
            total:     templates.length,
            wabaId:    config.wabaId,
            fetchedAt: new Date().toISOString(),
        });
    } catch (err: any) {
        console.error("[WA Templates] GET error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
