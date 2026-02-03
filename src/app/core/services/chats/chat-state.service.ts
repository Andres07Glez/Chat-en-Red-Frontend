import { Injectable, signal } from '@angular/core';
import { ChatListItem } from '../../models/chatsList.model';

@Injectable({
  providedIn: 'root'
})
export class ChatStateService {
  // Signal para saber qué chat está seleccionado actualmente
  // Inicialmente es null porque no has seleccionado nada
  selectedChat = signal<ChatListItem | null>(null);

  // Método para seleccionar un chat (Lo llamará tu ChatList)
  selectChat(chat: ChatListItem) {
    this.selectedChat.set(chat);
  }

  // Método para limpiar (ej. al cerrar sesión)
  clear() {
    this.selectedChat.set(null);
  }
}
