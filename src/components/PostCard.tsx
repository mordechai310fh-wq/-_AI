"use client";

import { useState } from "react";
import type { PostItem } from "@/lib/types";
import CommentDrawer from "@/components/CommentDrawer";
import GamePostFrame from "@/components/GamePostFrame";
import PostMedia from "@/components/PostMedia";

const GRADIENTS = [
  "from-[#fe2c55] to-[#8b1e3f]",
  "from-[#25f4ee] to-[#0b3d3a]",
  "from-[#7c3aed] to-[#1e1b4b]",
  "from-[#f59e0b] to-[#7c2d12]",
];

function gradientFor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash + ch.charCodeAt(0)) % GRADIENTS.length;
  return GRADIENTS[hash];
}

export default function PostCard({ post }: { post: PostItem }) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleLike() {
    if (busy) return;
    setBusy(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      if (!res.ok) {
        setLiked(prevLiked);
        setLikeCount(prevCount);
      } else {
        const data = await res.json();
        setLiked(data.liked);
        setLikeCount(data.likeCount);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="snap-item relative flex h-[calc(100dvh-64px)] w-full items-center justify-center overflow-hidden">
      {post.gameCode ? (
        <GamePostFrame code={post.gameCode} gameType={post.gameType} controls={post.gameControls} />
      ) : post.imageUrl || post.videoUrl || post.audioUrl ? (
        <PostMedia imageUrl={post.imageUrl} videoUrl={post.videoUrl} audioUrl={post.audioUrl} />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientFor(post.id)}`} />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30" />

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 pb-24 md:pb-5">
        <div className="max-w-[75%]">
          <p className="mb-1 font-semibold text-white">@{post.author.username}</p>
          <p className="whitespace-pre-wrap text-white/95">{post.text}</p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button onClick={toggleLike} className="flex flex-col items-center gap-1 text-white">
            <span className={`text-3xl transition ${liked ? "scale-110" : ""}`}>
              {liked ? "❤️" : "🤍"}
            </span>
            <span className="text-xs">{likeCount}</span>
          </button>
          <button
            onClick={() => setCommentsOpen(true)}
            className="flex flex-col items-center gap-1 text-white"
          >
            <span className="text-3xl">💬</span>
            <span className="text-xs">{commentCount}</span>
          </button>
        </div>
      </div>

      <CommentDrawer
        postId={post.id}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommentAdded={() => setCommentCount((c) => c + 1)}
      />
    </section>
  );
}
