export function isAdminUser(user: { isOwner: boolean; role: string }) {
  return user.isOwner || user.role === "ADMIN";
}
