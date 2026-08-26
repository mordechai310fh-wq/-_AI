"use client";

import { useEffect, useRef, useState } from "react";
import type { PostItem } from "@/lib/types";
import { useCurrentUser } from "@/lib/useCurrentUser";
import Avatar from "@/components/Avatar";
import PostCard from "@/components/PostCard";

type ProfileUser = { id: string; username: string; avatarUrl: string | null; createdAt: string };

export default function ProfileClient({ username }: { username: string }) {
  const { user: currentUser } = useCurrentUser();
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = currentUser?.username === username;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    fetch(`/api/users/${encodeURIComponent(username)}`)
      .then(async (res) => {
        if (!res.ok) {
          if (active) setNotFound(true);
          return;
        }
        const data = await res.json();
        if (active) {
          setProfile(data.user);
          setPosts(data.posts);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [username]);

  async function handleAvatarChange(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error ?? "שגיאה בהעלאה");

      const patchRes = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: upData.url }),
      });
      const patchData = await patchRes.json();
      if (!patchRes.ok) throw new Error(patchData.error ?? "שגיאה בעדכון");

      setProfile((p) => (p ? { ...p, avatarUrl: patchData.avatarUrl } : p));
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return null;

  if (notFound || !profile) {
    return (
      <div className="flex h-[calc(100dvh-64px)] flex-col items-center justify-center gap-2 text-center">
        <p className="text-2xl">🤷</p>
        <p className="text-muted">המשתמש לא נמצא</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-64px)] w-full overflow-y-auto">
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-6 text-center">
        <div className="relative">
          <Avatar username={profile.username} avatarUrl={profile.avatarUrl} size="lg" />
          {isOwnProfile && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 left-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm text-white disabled:opacity-50"
              title="שנה תמונת פרופיל"
            >
              📷
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAvatarChange(file);
            }}
          />
        </div>
        <p className="text-lg font-semibold">@{profile.username}</p>
        {error && <p className="text-sm text-accent">{error}</p>}
        <p className="text-sm text-muted">{posts.length} פוסטים</p>
      </div>

      {posts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
          <p className="text-2xl">📭</p>
          <p className="text-muted">עדיין אין פוסטים</p>
        </div>
      ) : (
        <div className="snap-y-feed w-full">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
