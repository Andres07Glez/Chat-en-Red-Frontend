// src/app/components/chat/models/message.model.ts
export interface Attachment {
  id?: number;
  filename?: string;
  url?: string;
  mimeType?: string;
  size?: number;
}

export interface Message {
  id?: number;
  conversationId: number;
  senderId?: number;
  senderName?: string;
  messageType?: 'TEXT' | 'FILE' | 'SYSTEM' | string;
  content?: string; // ciphertext o texto
  iv?: string | null;
  attachments?: Attachment[];
  createdAt?: string;
  editedAt?: string | null;
  pendingId?: string; // para optimistic UI
  delivered?: boolean;
  read?: boolean;
}
