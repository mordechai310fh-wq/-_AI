import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { verifySession } from "../src/lib/session";
import { prisma } from "../src/lib/prisma";

// SOCKET_PORT takes priority: local dev and the Electron app set it
// explicitly, and local dev tooling may also export a generic $PORT meant
// for the Next.js process (which runs alongside this one) - don't steal it.
// On Render, only $PORT is set (no SOCKET_PORT), so that's the fallback.
const PORT = Number(process.env.SOCKET_PORT ?? process.env.PORT ?? 4001);

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: true },
});

type SocketUser = { sub: string; username: string; role: string };

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error("no token"));
  const session = await verifySession(token);
  if (!session) return next(new Error("invalid token"));
  socket.data.user = session as SocketUser;
  next();
});

// roomId -> host socket id
const hostSocketByRoom = new Map<string, string>();
// roomId -> set of viewer socket ids
const viewersByRoom = new Map<string, Set<string>>();
// roomId -> pending "end live" timer, so a brief disconnect/refresh doesn't
// instantly kill the stream if the host reconnects quickly.
const pendingEndTimers = new Map<string, ReturnType<typeof setTimeout>>();
const HOST_RECONNECT_GRACE_MS = 10_000;

function cancelPendingEnd(roomId: string) {
  const timer = pendingEndTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    pendingEndTimers.delete(roomId);
  }
}

function scheduleEndLive(roomId: string, disconnectedSocketId: string) {
  cancelPendingEnd(roomId);
  const timer = setTimeout(() => {
    pendingEndTimers.delete(roomId);
    // Only end if no one has (re)joined as host since this disconnect.
    if (hostSocketByRoom.get(roomId) === disconnectedSocketId) {
      endLive(roomId);
    }
  }, HOST_RECONNECT_GRACE_MS);
  pendingEndTimers.set(roomId, timer);
}

function viewerCount(roomId: string) {
  return viewersByRoom.get(roomId)?.size ?? 0;
}

function removeViewer(roomId: string, socketId: string) {
  const set = viewersByRoom.get(roomId);
  if (!set) return;
  set.delete(socketId);
  io.to(roomId).emit("viewer-count", { roomId, count: viewerCount(roomId) });
  const hostId = hostSocketByRoom.get(roomId);
  if (hostId) io.to(hostId).emit("viewer-left", { socketId });
}

async function endLive(roomId: string) {
  cancelPendingEnd(roomId);
  hostSocketByRoom.delete(roomId);
  viewersByRoom.delete(roomId);
  try {
    await prisma.liveRoom.updateMany({
      where: { id: roomId, status: "LIVE" },
      data: { status: "ENDED", endedAt: new Date() },
    });
  } catch (err) {
    console.error("Failed to mark room ended:", err);
  }
  io.to(roomId).emit("live-ended", { roomId });
}

io.on("connection", (socket: Socket) => {
  const user = socket.data.user as SocketUser;

  socket.on("join-room", async ({ roomId, asHost }: { roomId: string; asHost?: boolean }) => {
    if (!roomId) return;

    if (asHost) {
      const room = await prisma.liveRoom.findUnique({
        where: { id: roomId },
        include: { host: { select: { hasAccess: true, isOwner: true } } },
      });
      if (!room || room.hostId !== user.sub || room.status !== "LIVE") return;
      if (!room.host.isOwner && !room.host.hasAccess) return;
      cancelPendingEnd(roomId);
      hostSocketByRoom.set(roomId, socket.id);
      socket.join(roomId);
      socket.data.hostOfRoom = roomId;
      socket.emit("viewer-count", { roomId, count: viewerCount(roomId) });
      return;
    }

    socket.join(roomId);
    socket.data.viewerOfRoom = roomId;
    if (!viewersByRoom.has(roomId)) viewersByRoom.set(roomId, new Set());
    viewersByRoom.get(roomId)!.add(socket.id);

    io.to(roomId).emit("viewer-count", { roomId, count: viewerCount(roomId) });

    const hostId = hostSocketByRoom.get(roomId);
    if (hostId) {
      io.to(hostId).emit("viewer-joined", { socketId: socket.id, username: user.username });
    }
  });

  socket.on("chat-message", async ({ roomId, text }: { roomId: string; text: string }) => {
    const trimmed = (text ?? "").trim().slice(0, 500);
    if (!roomId || !trimmed) return;

    try {
      const message = await prisma.liveChatMessage.create({
        data: { roomId, authorId: user.sub, text: trimmed },
      });
      io.to(roomId).emit("chat-message", {
        id: message.id,
        text: message.text,
        createdAt: message.createdAt,
        author: { id: user.sub, username: user.username },
        likeCount: 0,
      });
    } catch (err) {
      console.error("chat-message error:", err);
    }
  });

  socket.on("like-message", async ({ roomId, messageId }: { roomId: string; messageId: string }) => {
    if (!roomId || !messageId) return;
    try {
      const existing = await prisma.liveChatMessageLike.findUnique({
        where: { messageId_userId: { messageId, userId: user.sub } },
      });
      if (existing) {
        await prisma.liveChatMessageLike.delete({ where: { id: existing.id } });
      } else {
        await prisma.liveChatMessageLike.create({ data: { messageId, userId: user.sub } });
      }
      const likeCount = await prisma.liveChatMessageLike.count({ where: { messageId } });
      io.to(roomId).emit("message-liked", { messageId, likeCount });
    } catch (err) {
      console.error("like-message error:", err);
    }
  });

  socket.on("reaction", ({ roomId }: { roomId: string }) => {
    if (!roomId) return;
    socket.to(roomId).emit("reaction", { username: user.username });
  });

  socket.on("webrtc-offer", ({ to, sdp }: { to: string; sdp: unknown }) => {
    if (!to) return;
    io.to(to).emit("webrtc-offer", { from: socket.id, sdp });
  });

  socket.on("webrtc-answer", ({ to, sdp }: { to: string; sdp: unknown }) => {
    if (!to) return;
    io.to(to).emit("webrtc-answer", { from: socket.id, sdp });
  });

  socket.on("webrtc-ice-candidate", ({ to, candidate }: { to: string; candidate: unknown }) => {
    if (!to) return;
    io.to(to).emit("webrtc-ice-candidate", { from: socket.id, candidate });
  });

  socket.on("end-live", async ({ roomId }: { roomId: string }, ack?: () => void) => {
    if (roomId && hostSocketByRoom.get(roomId) === socket.id) {
      await endLive(roomId);
    }
    // Client waits for this before navigating away/disconnecting, so the
    // DB update + broadcast aren't lost in a disconnect race.
    ack?.();
  });

  socket.on("disconnect", async () => {
    const hostOfRoom = socket.data.hostOfRoom as string | undefined;
    const viewerOfRoom = socket.data.viewerOfRoom as string | undefined;

    if (hostOfRoom && hostSocketByRoom.get(hostOfRoom) === socket.id) {
      scheduleEndLive(hostOfRoom, socket.id);
    }
    if (viewerOfRoom) {
      removeViewer(viewerOfRoom, socket.id);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.io signaling server listening on :${PORT}`);
});
