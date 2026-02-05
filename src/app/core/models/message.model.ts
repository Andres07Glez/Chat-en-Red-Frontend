export interface MessageResponse {
    id: number;
    conversationId: number; // Agregado por si acaso
    content: string;
    sentAt: string;         // Recuerda que en Java usaste @JsonProperty("sentAt")
    senderName: string;
    messageTypeCode: string; // <--- AQUÍ ESTÁ EL CAMPO FALTANTE
    isMine: boolean;
    iv?: string;            // Opcional, necesario para descifrar
}
export interface MessageRequest {
  conversationId: number;
  content: string;
  messageTypeCode: string;
  iv: string;
}
