"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PostItem } from "@/lib/types";
import PostCard from "@/components/PostCard";
import CreatePostModal from "@/components/CreatePostModal";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function FeedClient() {
  const { user } = useCurrentUser();
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedOnce = useRef(false);
  // Synchronous in-flight guard: `loading` state updates asynchronously, so two
  // calls fired in the same tick (initial-mount effect + IntersectionObserver's
  // immediate first callback) could both read stale `loading=false` and both
  // fetch the same page, producing duplicate posts/keys.
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const url = cursor ? `/api/posts?cursor=${cursor}` : "/api/posts";
      const res = await fetch(url);
      const data = await res.json();
      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = (data.items as PostItem[]).filter((item) => !existingIds.has(item.id));
        return [...prev, ...newItems];
      });
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [cursor, hasMore]);

  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  function handleCreated(post: PostItem) {
    setPosts((prev) => [post, ...prev]);
    // New post is prepended to the top - scroll there so it doesn't look
    // like it vanished if the user was further down the feed.
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div ref={containerRef} className="snap-y-feed h-[calc(100dvh-64px)] w-full">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {posts.length === 0 && !loading && (
        <div className="flex h-[calc(100dvh-64px)] flex-col items-center justify-center gap-2 text-center">
          <p className="text-2xl">👋</p>
          <p className="text-muted">עדיין אין פוסטים. תהיה הראשון לפרסם!</p>
        </div>
      )}

      <div ref={sentinelRef} className="h-1 w-full" />
      {loading && <p className="py-4 text-center text-sm text-muted">טוען...</p>}

      {user && <CreatePostModal onCreated={handleCreated} />}
    </div>
  );
}
