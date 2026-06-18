"use server";

import path from "path";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import connectMongo from "@/lib/mongo";

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN  = process.env.CF_IMAGES_TOKEN;
const CF_BASE_URL   = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`;
const CF_DELIVERY   = "https://imagedelivery.net/l7vrHxYm1V8kfxard9QBnQ";

/**
 * Upload a File to Cloudflare Images and return its public delivery URL.
 * @param formData  FormData with `file` (File) and optional `folder` (string)
 */
export async function uploadToCloudflare(formData: FormData) {
  try {
    const file   = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string) || "general";

    if (!file) return { success: false, error: "No file provided" };
    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) return { success: false, error: "Cloudflare credentials not configured" };

    const ext           = path.extname(file.name) || ".png";
    const baseName      = path.basename(file.name, ext).replace(/[^a-zA-Z0-9\s\-_.]/g, "").trim();
    const cleanFileName = `${baseName}_${Date.now()}`;
    const cfImageId     = `${folder}/${cleanFileName}`;

    const cf = new FormData();
    cf.append("file", file);
    cf.append("id", cfImageId);

    const res  = await fetch(CF_BASE_URL, {
      method : "POST",
      headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
      body   : cf,
    });
    const json = await res.json() as any;

    // 9409 = image ID already exists — treat as success
    if (!json.success && json.errors?.[0]?.code !== 9409) {
      return { success: false, error: json.errors?.[0]?.message || "Cloudflare upload failed" };
    }

    const url = `${CF_DELIVERY}/${encodeURIComponent(folder)}/${encodeURIComponent(cleanFileName)}/public`;
    return { success: true, url };
  } catch (err: any) {
    return { success: false, error: err.message || "Upload failed" };
  }
}

export async function uploadImageToWebsitePublic(formData: FormData) {
  try {
    const file = formData.get("file") as File | null;
    const folderName = (formData.get("folder") as string) || "uploads";

    if (!file) return { success: false, error: "No file provided" };

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalExt = path.extname(file.name) || ".png";
    const rawName = path.basename(file.name, originalExt);
    const cleanFileName = `${rawName
      .replace(/[^a-zA-Z0-9\s-_\.]/g, "")
      .replace(/\s+/g, "_")}_${Date.now()}${originalExt}`;
    const relativePath = `/${folderName}/${cleanFileName}`;

    const rootDir = process.cwd();
    const newWebsitePublicDir = path.join(rootDir, "..", "newwebsite", "public");
    const folderDir = path.join(newWebsitePublicDir, folderName);
    const destinationFile = path.join(folderDir, cleanFileName);

    if (!existsSync(folderDir)) {
      await mkdir(folderDir, { recursive: true });
    }

    await writeFile(destinationFile, buffer);
    return { success: true, url: relativePath };
  } catch (err: any) {
    return { success: false, error: err.message || "Upload failed" };
  }
}

export async function uploadCasinoGameImage(formData: FormData) {
  try {
    const file = formData.get("file") as File | null;
    const provider = formData.get("provider") as string | null;
    const gameCode = formData.get("gameCode") as string | null;
    const gameName = formData.get("gameName") as string | null;

    if (!file || !provider || !gameCode || !gameName) {
      return { success: false, error: "Missing required fields" };
    }
    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) return { success: false, error: "Cloudflare credentials not configured" };

    const cleanProvider = provider.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim();
    const originalExt = path.extname(file.name) || ".png";
    const cleanGameName =
      path.basename(file.name, originalExt).replace(/[^a-zA-Z0-9\s\-_\.]/g, "").trim() ||
      gameName.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim();

    const cfImageId = `${cleanProvider}/${cleanGameName}`;

    const cf = new FormData();
    cf.append("file", file);
    cf.append("id", cfImageId);

    const res = await fetch(CF_BASE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
      body: cf,
    });
    const json = (await res.json()) as any;

    if (!json.success && json.errors?.[0]?.code !== 9409) {
      return { success: false, error: json.errors?.[0]?.message || "Cloudflare upload failed" };
    }

    await connectMongo();
    const mongoose = await import("mongoose");
    await mongoose.connection.collection("casinogames").findOneAndUpdate(
      { gameCode },
      { $set: { icon: cleanGameName } },
    );

    const cloudflareUrl = `${CF_DELIVERY}/${encodeURIComponent(cleanProvider)}/${encodeURIComponent(cleanGameName)}/public`;
    return { success: true, relativePath: cleanGameName, cloudflareUrl };
  } catch (err: any) {
    return { success: false, error: err.message || "Upload failed" };
  }
}
