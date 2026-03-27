export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface Message {
  id: string;
  chatId: string;
  parentId: string | null;
  userId: string;
  user: User;
  content: string;
  votesCount: number;
  userVote: 1 | -1 | 0;
  createdAt: Date;
  children: Message[];
  collapsed?: boolean;
}

export interface ChatRoom {
  id: string;
  name: string;
  description: string;
  emoji: string;
  memberCount: number;
  lastActivity: Date;
  unreadCount: number;
}

export type SortMode = "top" | "new" | "relevant";
