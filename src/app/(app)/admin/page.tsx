import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AdminPanelClient from "@/components/AdminPanelClient";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") redirect("/feed");

  return <AdminPanelClient currentUserId={user.id} currentUserIsOwner={user.isOwner} />;
}
