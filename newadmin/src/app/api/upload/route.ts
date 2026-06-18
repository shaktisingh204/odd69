import { NextRequest, NextResponse } from "next/server";
import path from "path";
import connectMongo from "@/lib/mongo";

const CF_ACCOUNT_ID = "ae6aabd73c9a3ddfb2f49419c0fbb69a";
const CF_API_TOKEN = "QOCM2u9NAgrdxVgaeCIQUYDnLKnuQoeKqjh5oMlU";
const CF_BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`;
const CF_DELIVERY_BASE = "https://imagedelivery.net/l7vrHxYm1V8kfxard9QBnQ";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const provider = formData.get("provider") as string | null;
        const gameId = formData.get("gameId") as string | null; // Mongo ID
        const gameCode = formData.get("gameCode") as string | null;
        const gameName = formData.get("gameName") as string | null;

        if (!file || !provider || !gameId || !gameCode || !gameName) {
            return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        // Clean provider + build icon name (no extension — matches Cloudflare ID convention)
        const cleanProvider = provider.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();
        const originalExt = path.extname(file.name) || '.png';
        const cleanGameName = path.basename(file.name, originalExt).replace(/[^a-zA-Z0-9\s\-_\.]/g, '').trim() || gameName.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim();

        // Cloudflare image ID: {provider}/{gameName_without_extension}
        const cfImageId = `${cleanProvider}/${cleanGameName}`;

        // Upload to Cloudflare Images
        const cfFormData = new FormData();
        cfFormData.append("file", file);
        cfFormData.append("id", cfImageId);

        const cfRes = await fetch(CF_BASE_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${CF_API_TOKEN}`,
            },
            body: cfFormData,
        });

        const cfJson = await cfRes.json() as any;

        // If image already exists on Cloudflare (code 9409), that's fine — we still update the DB
        if (!cfJson.success && cfJson.errors?.[0]?.code !== 9409) {
            console.error("[Upload] Cloudflare upload failed:", cfJson.errors);
            return NextResponse.json({ success: false, error: cfJson.errors?.[0]?.message || "Cloudflare upload failed" }, { status: 500 });
        }

        // Store just the filename (no extension) in MongoDB `icon` field
        // URL will be assembled as: CF_DELIVERY_BASE/{provider}/{icon_no_ext}/public
        const iconValue = cleanGameName; // filename without extension

        // Update MongoDB
        await connectMongo();
        const mongoose = require('mongoose');
        console.log(`[Upload] Updating MongoDB for gameCode: ${gameCode} with icon: ${iconValue}`);
        const updateResult = await mongoose.connection.collection('casinogames').findOneAndUpdate(
            { gameCode: gameCode },
            { $set: { icon: iconValue } }
        );
        console.log(`[Upload] MongoDB update result:`, updateResult ? 'Success' : 'Failed');

        const cloudflareUrl = `${CF_DELIVERY_BASE}/${encodeURIComponent(cleanProvider)}/${encodeURIComponent(iconValue)}/public`;

        return NextResponse.json({ success: true, relativePath: iconValue, cloudflareUrl });
    } catch (error: any) {
        console.error("Upload error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
