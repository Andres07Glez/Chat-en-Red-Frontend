import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ChatListItem } from '../../../core/models/chatsList.model';
import { ChatsService } from '../../../core/services/chats/chats.service';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { ChatStateService } from '../../../core/services/chats/chat-state.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-list.html',
  styleUrl: './chat-list.css',
})
export class ChatList implements OnInit,OnDestroy{
  private chatService = inject(ChatsService);
  public themeService = inject(ThemeService); // Hazlo público para usar en HTML
  private chatState = inject(ChatStateService);
  private refreshSub!: Subscription;

  chats: ChatListItem[] = [];
  isLoading = true;
  selectedChatId: number | null = null; // Para saber cuál está activo

  ngOnInit() {
    this.loadChats();
    // SUSCRIPCIÓN AL EVENTO DE RECARGA
    this.refreshSub = this.chatState.refreshList$.subscribe(() => {
    // Recargamos la lista silenciosamente (sin poner isLoading true para que no parpadee feo)
    this.refreshChatsSilent();
    });
  }
  ngOnDestroy() {
    // Buenas prácticas: Desuscribirse para evitar fugas de memoria
    if (this.refreshSub) {
      this.refreshSub.unsubscribe();
    }
  }
  refreshChatsSilent() {
    this.chatService.getMyChats().subscribe({
      next: (data) => {
        this.chats = data;
        // Si hay un chat seleccionado, nos aseguramos que siga marcado visualmente
        // (La lógica de selectedChatId ya lo maneja en el HTML)
      },
      error: (err) => console.error(err)
    });
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
