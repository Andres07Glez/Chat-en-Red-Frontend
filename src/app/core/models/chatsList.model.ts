export interface ChatListItem {
  id: number;
  name: string;          // Nombre del grupo o usuario
  lastMessage: string;   // "Hola..."
  lastActivity: string;  // Fecha en formato ISO string
  isGroup: boolean;      // true = Grupo, false = Privado
  unreadCount?: number;  // Opcional
  // avatar?: string;    // (Lo dejaremos pendiente, usaremos uno por defecto)
  lastMessageIV:string;
}
