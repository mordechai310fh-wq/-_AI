import { NextRequest, NextResponse } from "next/server";
import { stat } from "fs/promises";
import { createReadStream } from "fs";
import { Readable } from "stream";
import path from "path";
import { getCurrentUser } from "@/lib/auth";

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

// Uploaded filenames are always `${randomUUID()}.${ext}` (see /api/upload) -
// reject anything that doesn't match to rule out path traversal.
const SAFE_FILENAME = /^[a-f0-9-]+\.(jpg|jpeg|png|webp|gif|mp4|webm|mov|mp3|m4a|wav|ogg)$/i;

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "לא מחובר" }, { status: 401 });

  const { filename } = await params;
  if (!SAFE_FILENAME.test(filename)) {
    return NextResponse.json({ error: "קובץ לא תקין" }, { status: 400 });
  }

  const ext = filename.split(".").pop()!.toLowerCase();
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
  const filePath = path.join(/* turbopackIgnore: true */ uploadsDir, filename);

  let fileSize: number;
  try {
    fileSize = (await stat(/* turbopackIgnore: true */ filePath)).size;
  } catch {
    return NextResponse.json({ error: "הקובץ לא נמצא" }, { status: 404 });
  }

  // Video/audio elements rely on Range requests for seeking (and Safari
  // requires it for playback at all).
  const range = req.headers.get("range");
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match?.[1] ? parseInt(match[1], 10) : 0;
    const end = match?.[2] ? parseInt(match[2], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = createReadStream(/* turbopackIgnore: true */ filePath, { start, end });
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const stream = createReadStream(/* turbopackIgnore: true */ filePath);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
