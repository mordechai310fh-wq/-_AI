import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getCurrentUser, isBanned } from "@/lib/auth";

type MediaKind = "image" | "video" | "audio";

const ALLOWED_TYPES: Record<string, { ext: string; kind: MediaKind }> = {
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/png": { ext: "png", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" },
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/webm": { ext: "webm", kind: "video" },
  "video/quicktime": { ext: "mov", kind: "video" },
  "audio/mpeg": { ext: "mp3", kind: "audio" },
  "audio/mp4": { ext: "m4a", kind: "audio" },
  "audio/wav": { ext: "wav", kind: "audio" },
  "audio/ogg": { ext: "ogg", kind: "audio" },
};

const MAX_SIZE: Record<MediaKind, number> = {
  image: 8 * 1024 * 1024, // 8MB
  audio: 15 * 1024 * 1024, // 15MB
  video: 60 * 1024 * 1024, // 60MB
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || isBanned(user)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
  }

  const meta = ALLOWED_TYPES[file.type];
  if (!meta) {
    return NextResponse.json({ error: "סוג קובץ לא נתמך" }, { status: 400 });
  }
  if (file.size > MAX_SIZE[meta.kind]) {
    const maxMb = Math.round(MAX_SIZE[meta.kind] / (1024 * 1024));
    return NextResponse.json({ error: `הקובץ גדול מדי (מקסימום ${maxMb}MB)` }, { status: 400 });
  }

  const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "public", "uploads");
  await mkdir(/* turbopackIgnore: true */ uploadsDir, { recursive: true });

  const filename = `${randomUUID()}.${meta.ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(/* turbopackIgnore: true */ uploadsDir, filename), buffer);

  // Served through our own route (not /uploads/*) so it works the same way
  // whether files live under public/ (dev/self-host) or in the packaged
  // app's userData folder (public/ is read-only once installed).
  return NextResponse.json({ url: `/api/uploads/${filename}`, kind: meta.kind });
}
