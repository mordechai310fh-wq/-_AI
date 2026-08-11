import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Proxies the live HTTP-FLV stream from the RTMP server's internal HTTP
// output. The RTMP stream key stays server-side here - viewers only ever
// see the roomId, never the secret key used to authenticate OBS publishing.
// This is a long-lived stream (not a static file), so the response body is
// piped straight through rather than buffered.
const RTMP_HTTP_INTERNAL_URL = process.env.RTMP_HTTP_INTERNAL_URL ?? "http://localhost:8001";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const room = await prisma.liveRoom.findUnique({ where: { id } });
  if (!room || room.broadcastMode !== "rtmp" || !room.streamKey) {
    return NextResponse.json({ error: "לא נמצא שידור RTMP" }, { status: 404 });
  }

  const upstreamUrl = `${RTMP_HTTP_INTERNAL_URL}/live/${room.streamKey}.flv`;
  const upstream = await fetch(upstreamUrl, { cache: "no-store", signal: req.signal }).catch(() => null);
  if (!upstream || !upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "השידור עוד לא זמין" }, { status: 404 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "video/x-flv",
      "Cache-Control": "no-store",
    },
  });
}
