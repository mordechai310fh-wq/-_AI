import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import LiveRoomClient from "@/components/LiveRoomClient";

export default async function LiveRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const { roomId } = await params;
  const room = await prisma.liveRoom.findUnique({
    where: { id: roomId },
    include: { host: { select: { id: true, username: true } } },
  });

  if (!room) notFound();

  return (
    <LiveRoomClient
      roomId={room.id}
      isHost={room.hostId === user.id}
      title={room.title}
      hostUsername={room.host.username}
      currentUserId={user.id}
      currentUsername={user.username}
      alreadyEnded={room.status !== "LIVE"}
      broadcastMode={room.broadcastMode === "rtmp" ? "rtmp" : "webrtc"}
      streamKey={room.hostId === user.id ? room.streamKey ?? undefined : undefined}
    />
  );
}
