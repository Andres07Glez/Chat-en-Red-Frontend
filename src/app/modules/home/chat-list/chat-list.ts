import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ChatListItem } from '../../../core/models/chatsList.model';
import { ChatsService } from '../../../core/services/chats/chats.service';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { ChatStateService } from '../../../core/services/chats/chat-state.service';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-list.html',
  styleUrl: './chat-list.css',
})
export class ChatList implements OnInit{
  private chatService = inject(ChatsService);
  public themeService = inject(ThemeService); // Hazlo público para usar en HTML
  private chatState = inject(ChatStateService);

  chats: ChatListItem[] = [];
  isLoading = true;
  selectedChatId: number | null = null; // Para saber cuál está activo

  ngOnInit() {
    this.loadChats();
  }

  loadChats() {
    this.chatService.getMyChats().subscribe({
      next: (data) => {
        this.chats = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando chats:', err);
        this.isLoading = false;
      }
    });
  }

  selectChat(chat: ChatListItem) {
    // 1. Guardamos en el servicio global (Esto actualiza la vista principal automáticamente)
    this.chatState.selectChat(chat);

    // 2. (Opcional) Guardamos localmente para el estilo "active" visual
    this.selectedChatId = chat.id;
  }

  // Función auxiliar para formatear la fecha (simple)
  formatTime(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

}
