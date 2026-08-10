export type PostItem = {
  id: string;
  text: string;
  imageUrl: string | null;
  gameCode: string | null;
  gameType: string | null;
  gameControls: string | null;
  createdAt: string;
  author: { id: string; username: string };
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

export type CommentItem = {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; username: string };
};

export type CurrentUser = {
  id: string;
  username: string;
  role: string;
  isOwner: boolean;
  hasAccess: boolean;
  banned: boolean;
  bannedUntil: string | null;
  banReason: string | null;
};
