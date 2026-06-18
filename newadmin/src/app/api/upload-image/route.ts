import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const folderName = formData.get("folder") as string || "uploads"; // e.g. promo-images

        if (!file) {
            return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // clean filename
        const originalExt = path.extname(file.name) || '.png';
        const rawName = path.basename(file.name, originalExt);
        const cleanFileName = `${rawName.replace(/[^a-zA-Z0-9\s-_\.]/g, '').replace(/\s+/g, '_')}_${Date.now()}${originalExt}`;
        const relativePath = `/${folderName}/${cleanFileName}`;

        // Path resolution for newadmin -> newwebsite/public
        const rootDir = process.cwd();
        const newWebsitePublicDir = path.join(rootDir, "..", "newwebsite", "public");

        const folderDir = path.join(newWebsitePublicDir, folderName);
        const destinationFile = path.join(folderDir, cleanFileName);

        // Ensure directory exists
        if (!existsSync(folderDir)) {
            await mkdir(folderDir, { recursive: true });
        }

        // Save binary file
        await writeFile(destinationFile, buffer);

        return NextResponse.json({ success: true, url: relativePath });
    } catch (error: any) {
        console.error("Image upload error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
