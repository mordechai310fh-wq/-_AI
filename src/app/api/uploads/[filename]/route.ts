import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// Uploaded filenames are always `${randomUUID()}.${ext}` (see /api/upload) -
// reject anything that doesn't match to rule out path traversal.
const SAFE_FILENAME = /^[a-f0-9-]+\.(jpg|jpeg|png|webp|gif)$/i;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { filename } = await params;
  if (!SAFE_FILENAME.test(filename)) {
    return NextResponse.json({ error: "קובץ לא תקין" }, { status: 400 });
  }

  const ext = filename.split(".").pop()!.toLowerCase();
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");

  try {
    const buffer = await readFile(path.join(/* turbopackIgnore: true */ uploadsDir, filename));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  }
}
