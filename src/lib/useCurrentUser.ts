"use client";

import { useEffect, useState } from "react";
import type { CurrentUser } from "@/lib/types";

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user))
      .finally(() => setLoading(false));
  }, []);

  const hasFullAccess = !!user && (user.isOwner || user.hasAccess);

  return { user, loading, hasFullAccess };
}
