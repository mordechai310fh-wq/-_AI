// RTMP ingest server: accepts a stream from OBS/Streamlabs/any RTMP encoder
// and re-serves it as HTTP-FLV for browsers to watch (via flv.js). Runs as
// its own process, separate from the Next.js app and the Socket.io server.
// node-media-server v4 dropped the built-in ffmpeg/HLS transcoding that
// earlier versions had - it only remuxes to FLV now, so that's what we use.
import NodeMediaServer from "node-media-server";
import { prisma } from "../src/lib/prisma";

const RTMP_PORT = Number(process.env.RTMP_PORT ?? 1935);
const HTTP_PORT = Number(process.env.RTMP_HTTP_PORT ?? 8001);

const config = {
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: HTTP_PORT,
    allow_origin: "*",
  },
};

// node-media-server ships without useful TypeScript types. Event handlers
// receive the session object itself (not positional id/path args).
type NmsSession = { streamPath: string; socket: { end: () => void } };
const nms = new (NodeMediaServer as unknown as new (cfg: unknown) => {
  run: () => void;
  on: (event: string, cb: (session: NmsSession) => void) => void;
})(config);

function streamKeyFromPath(streamPath: string) {
  return streamPath.split("/").pop() ?? "";
}

nms.on("prePublish", (session) => {
  const streamKey = streamKeyFromPath(session.streamPath);

  prisma.liveRoom
    .findUnique({ where: { streamKey } })
    .then((room) => {
      const valid = room && room.status === "LIVE" && room.broadcastMode === "rtmp";
      if (!valid) {
        console.warn("Rejected RTMP publish with invalid/unknown stream key");
        session.socket.end();
      }
    })
    .catch((err) => {
      console.error("prePublish check failed:", err);
      session.socket.end();
    });
});

nms.on("donePublish", (session) => {
  const streamKey = streamKeyFromPath(session.streamPath);

  prisma.liveRoom
    .updateMany({
      where: { streamKey, status: "LIVE" },
      data: { status: "ENDED", endedAt: new Date() },
    })
    .catch((err) => console.error("Failed to mark RTMP room ended:", err));
});

nms.run();
console.log(`RTMP server listening on rtmp://localhost:${RTMP_PORT}/live/<streamKey>`);
console.log(`FLV playback served from http://localhost:${HTTP_PORT}/live/<streamKey>.flv`);
