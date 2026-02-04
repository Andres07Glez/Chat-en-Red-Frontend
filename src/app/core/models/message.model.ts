export interface MessageResponse {
    id: number;
    content: string;
    sentAt: string;   // ISO String date
    senderName: string;
    isMine: boolean;  // true si lo envié yo
}
export interface MessageRequest {
  conversationId: number;
  content: string;
  messageTypeCode: string;
  iv: string;
}
