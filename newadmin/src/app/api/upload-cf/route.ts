import { NextRequest, NextResponse } from "next/server";

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN  = process.env.CF_IMAGES_TOKEN;
const CF_BASE_URL   = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`;
const CF_DELIVERY   = "https://imagedelivery.net/l7vrHxYm1V8kfxard9QBnQ";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file   = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "general";

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }
    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
      return NextResponse.json({ success: false, error: "Cloudflare credentials not configured" }, { status: 500 });
    }

    // Sanitize filename
    const dotIdx       = file.name.lastIndexOf(".");
    const ext          = dotIdx >= 0 ? file.name.slice(dotIdx) : ".png";
    const baseName     = file.name.slice(0, dotIdx >= 0 ? dotIdx : undefined)
      .replace(/[^a-zA-Z0-9\s\-_.]/g, "").trim() || "image";
    const cleanName    = `${baseName}_${Date.now()}`;
    const cfImageId    = `${folder}/${cleanName}`;

    const cf = new FormData();
    cf.append("file", file);
    cf.append("id", cfImageId);

    const cfRes  = await fetch(CF_BASE_URL, {
      method : "POST",
      headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
      body   : cf,
    });

    // Safely parse response — Cloudflare sometimes returns non-JSON on 5xx
    let cfJson: any = {};
    const text = await cfRes.text();
    try { cfJson = JSON.parse(text); } catch { /* leave as {} */ }

    // 9409 = duplicate image ID → still a success, URL is predictable
    if (!cfJson.success && cfJson.errors?.[0]?.code !== 9409) {
      const errMsg = cfJson.errors?.[0]?.message || text || "Cloudflare upload failed";
      console.error("[CF Upload] error:", errMsg);
      return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
    }

    const url = `${CF_DELIVERY}/${encodeURIComponent(folder)}/${encodeURIComponent(cleanName)}/public`;
    return NextResponse.json({ success: true, url });
  } catch (err: any) {
    console.error("[CF Upload] exception:", err);
    return NextResponse.json({ success: false, error: err.message || "Upload failed" }, { status: 500 });
  }
}
