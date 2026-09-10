export type ChatContextType = 'match' | 'complex' | 'direct';

export type ChatParticipant = {
  id: string;
  displayName: string;
};

export type ChatThread = {
  id: string;
  participantIds: string[];
  participantNames: Record<string, string>;
  avatarUrls: Record<string, string | null>;
  contextType: ChatContextType;
  contextId?: string;
  lastMessageText?: string;
  lastMessageAt?: Date;
  updatedAt?: Date;
  matchInfo?: {
    date: string;
    time: string;
    complexName: string;
  };
};

export type ChatMessage = {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
  createdAt?: Date;
  readBy: string[];
};

export type CreateChatThreadInput = {
  participantIds: string[];
  participantNames: Record<string, string>;
  contextType: ChatContextType;
  contextId?: string;
};
