import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ChatListItem } from '../../../core/models/chatsList.model';
import { ChatsService } from '../../../core/services/chats/chats.service';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { ChatStateService } from '../../../core/services/chats/chat-state.service';
import { Subscription } from 'rxjs';
import { CryptoService } from '../../../core/services/crypto/crypto.service';
import { WebsocketService } from '../../../core/services/webSocket/websocket.service';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-list.html',
  styleUrl: './chat-list.css',
})
export class ChatList implements OnInit,OnDestroy{
  // Servicios
  private cryptoService = inject(CryptoService);
  private chatService = inject(ChatsService);
  public themeService = inject(ThemeService); // Hazlo público para usar en HTML
  private chatState = inject(ChatStateService);
  private wsService = inject(WebsocketService);
  private authService = inject(AuthService);
  // Suscripciones
  private refreshSub!: Subscription;
  private userTopicSub: Subscription | null = null;

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
    this.subscribeToMyUpdates();
  }
  ngOnDestroy() {
    // Buenas prácticas: Desuscribirse para evitar fugas de memoria
    if (this.refreshSub) {
      this.refreshSub.unsubscribe();
    }
    if (this.userTopicSub) {
      this.userTopicSub.unsubscribe();
    }
  }
  private subscribeToMyUpdates() {
    const currentUser = this.authService.getUser();
    if (!currentUser) return; // Si no hay usuario, no podemos suscribirnos

    // Canal personal: /topic/user/{mi_id}
    const myTopic = `/topic/user/${currentUser.id}`;

    this.userTopicSub = this.wsService.watch(myTopic).subscribe({
      next: async (msg) => {
        // Convertimos el string JSON a objeto
        const incomingMsg = JSON.parse(msg.body);

        // Buscamos si el chat ya existe en nuestra lista visual
        const chatIndex = this.chats.findIndex(c => c.id === incomingMsg.conversationId);

        if (chatIndex !== -1) {
          // === CASO A: EL CHAT YA ESTÁ EN LA LISTA ===
          // Lo sacamos temporalmente del array
          const chatToUpdate = this.chats[chatIndex];

          // Actualizamos la fecha/hora
          chatToUpdate.lastActivity = incomingMsg.sentAt;
          chatToUpdate.unreadCount = (chatToUpdate.unreadCount || 0) + 1; // Opcional: incrementar contador

          // Actualizamos el último mensaje (Desencriptando)
          if (incomingMsg.messageTypeCode === 'TEXT' && incomingMsg.iv) {
             try {
                const plainText = await this.cryptoService.decrypt(incomingMsg.content, incomingMsg.iv);
                chatToUpdate.lastMessage = plainText;
                chatToUpdate.lastMessageIV = incomingMsg.iv; // Guardamos el nuevo IV
             } catch (e) {
                chatToUpdate.lastMessage = ' Mensaje cifrado';
             }
          } else {
             // Manejo de otros tipos (imágenes, archivos)
             chatToUpdate.lastMessage = incomingMsg.messageTypeCode === 'IMAGE' ? '📷 Foto' : 'Archivo adjunto';
          }

          // REORDENAMIENTO VISUAL:
          // Borramos de su posición actual
          this.chats.splice(chatIndex, 1);
          // Insertamos al inicio (índice 0)
          this.chats.unshift(chatToUpdate);

        } else {
          // === CASO B: ES UN CHAT NUEVO ===
          // Si te escriben de un chat que no tenías cargado (ej. grupo nuevo)
          // Forzamos una recarga silenciosa para traerlo del backend
          this.refreshChatsSilent();
        }
      },
      error: (err) => console.error('Error en updates de lista', err)
    });
  }
  refreshChatsSilent() {
    this.chatService.getMyChats().subscribe({
      next: async (data) => {
        const decryptedChats = await Promise.all(data.map(async (chat) => {
            // Solo desciframos si hay mensaje y IV
            if (chat.lastMessage && chat.lastMessageIV) {
                try {
                    const plainText = await this.cryptoService.decrypt(chat.lastMessage, chat.lastMessageIV);
                    chat.lastMessage = plainText; // Reemplazamos el cifrado por texto plano
                } catch (error) {
                    console.error('Error descifrando preview:', error);
                    chat.lastMessage = ' Mensaje ilegible';
                }
            }
            return chat;
        }));
        this.chats = decryptedChats;

      },
      error: (err) => console.error(err)
    });
  }

  loadChats() {
    this.chatService.getMyChats().subscribe({
      next: async (data) => {
        const decryptedChats = await Promise.all(data.map(async (chat) => {
            // Solo desciframos si hay mensaje y IV
            if (chat.lastMessage && chat.lastMessageIV) {
                try {
                    const plainText = await this.cryptoService.decrypt(chat.lastMessage, chat.lastMessageIV);
                    chat.lastMessage = plainText; // Reemplazamos el cifrado por texto plano
                } catch (error) {
                    console.error('Error descifrando preview:', error);
                    chat.lastMessage = ' Mensaje ilegible';
                }
            }
            return chat;
        }));
        this.chats = decryptedChats;
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
  // Función para optimizar el ngFor
  trackByChatId(index: number, chat: ChatListItem): number {
    return chat.id;
  }

}
