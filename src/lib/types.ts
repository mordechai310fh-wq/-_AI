export type PostItem = {
  id: string;
  text: string;
  imageUrl: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  gameCode: string | null;
  gameType: string | null;
  gameControls: string | null;
  createdAt: string;
  author: { id: string; username: string; avatarUrl: string | null };
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
};

export type CommentItem = {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; username: string; avatarUrl: string | null };
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
  avatarUrl: string | null;
  coins: number;
  postCredits: number;
  juniorChatCredits: number;
};
