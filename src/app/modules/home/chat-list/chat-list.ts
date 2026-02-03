import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ChatListItem } from '../../../core/models/chatsList.model';
import { ChatsService } from '../../../core/services/chats/chats.service';
import { ThemeService } from '../../../core/services/theme/theme.service';

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
    this.selectedChatId = chat.id;
    // AQUÍ despacharemos un evento más tarde para abrir el chat a la derecha
    console.log('Chat seleccionado:', chat.name);
  }

  // Función auxiliar para formatear la fecha (simple)
  formatTime(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

}
