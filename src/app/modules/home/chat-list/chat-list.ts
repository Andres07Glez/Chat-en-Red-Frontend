import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ChatListItem } from '../../../core/models/chatsList.model';
import { ChatsService } from '../../../core/services/chats/chats.service';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { ChatStateService } from '../../../core/services/chats/chat-state.service';
import { Subscription } from 'rxjs';
import { CryptoService } from '../../../core/services/crypto/crypto.service';
import { WebsocketService } from '../../../core/services/webSocket/websocket.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { StartChat } from '../contacts/start-chat/start-chat';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule,StartChat],
  templateUrl: './chat-list.html',
  styleUrl: './chat-list.css',
})
export class ChatList implements OnInit,OnDestroy{
  // Servicios
  private cryptoService = inject(CryptoService);
  private chatService = inject(ChatsService);
  public themeService = inject(ThemeService);
  private chatState = inject(ChatStateService);
  private wsService = inject(WebsocketService);
  private authService = inject(AuthService);

  // Referencia al modal de nueva conversación
  @ViewChild(StartChat) startChatChild!: StartChat;

  // Suscripciones
  private refreshSub!: Subscription;
  private userTopicSub: Subscription | null = null;

  chats: ChatListItem[] = [];
  isLoading = true;
  selectedChatId: number | null = null;
  /** Controla la visibilidad del mini-menú "+" */
  showNewChatMenu = false;

  ngOnInit() {
    this.loadChats();

    this.refreshSub = this.chatState.refreshList$.subscribe(() => {
      this.refreshChatsSilent();
    });

    this.subscribeToMyUpdates();
  }

  ngOnDestroy() {
    if (this.refreshSub) {
      this.refreshSub.unsubscribe();
    }
    if (this.userTopicSub) {
      this.userTopicSub.unsubscribe();
    }
  }
  // ─── Menú nueva conversación ─────────────────────────────────────────────────

  toggleNewChatMenu(): void {
    this.showNewChatMenu = !this.showNewChatMenu;
  }

  /** Cierra el menú si el usuario hace clic fuera de él */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.new-chat-menu-wrapper')) {
      this.showNewChatMenu = false;
    }
  }

  openStartIndividualChat(): void {
    this.showNewChatMenu = false;
    // Pequeño delay para que el menú cierre antes de que el modal se abra
    setTimeout(() => this.startChatChild.show(), 50);
  }

  private subscribeToMyUpdates() {
    const currentUser = this.authService.getUser();
    if (!currentUser) return;

    const myTopic = `/topic/user/${currentUser.id}`;

    this.userTopicSub = this.wsService.watch(myTopic).subscribe({
      next: async (msg) => {
        const incomingMsg = JSON.parse(msg.body);
        const chatIndex = this.chats.findIndex(c => c.id === incomingMsg.conversationId);

        if (chatIndex !== -1) {
          // === CASO A: EL CHAT YA ESTÁ EN LA LISTA ===
          const chatToUpdate = this.chats[chatIndex];

          chatToUpdate.lastActivity = incomingMsg.sentAt;
          const isMine = incomingMsg.senderName === currentUser.username;

          // Actualizar contadores
          if (this.selectedChatId !== incomingMsg.conversationId && !isMine) {
            chatToUpdate.unreadCount = (chatToUpdate.unreadCount || 0) + 1;
          } else if (this.selectedChatId === incomingMsg.conversationId){
            chatToUpdate.unreadCount = 0;
          }

          // Actualizar mensaje (Desencriptando)
          if (incomingMsg.messageTypeCode === 'TEXT' && incomingMsg.iv) {
             // CORRECCIÓN: Usamos la llave pública que YA tenemos en chatToUpdate
             if (chatToUpdate.otherUserPublicKey) {
                try {
                    chatToUpdate.lastMessage = await this.cryptoService.decrypt(
                        incomingMsg.content,
                        incomingMsg.iv,
                        chatToUpdate.otherUserPublicKey // <--- FALTABA ESTO
                    );
                    chatToUpdate.lastMessageIV = incomingMsg.iv;
                } catch (e) {
                    chatToUpdate.lastMessage = 'Mensaje cifrado (Click para leer)';
                }
             } else {
                chatToUpdate.lastMessage = '🔒 Llave no disponible';
             }
          } else {
             chatToUpdate.lastMessage = incomingMsg.messageTypeCode === 'IMAGE' ? '📷 Foto' : 'Archivo adjunto';
          }

          // Reordenar
          this.chats.splice(chatIndex, 1);
          this.chats.unshift(chatToUpdate);

        } else {
          // === CASO B: CHAT NUEVO ===
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

          // CORRECCIÓN PRINCIPAL:
          // Si no hay llave, NO hacemos return; (undefined).
          // Retornamos el chat tal cual con un aviso.
          if (!chat.otherUserPublicKey && chat.isGroup === false) {
             // Ojo: si es grupo (isGroup), es normal que venga null por ahora.
             // Si es directo y viene null, es error.
             if (chat.lastMessage) chat.lastMessage = '🔒 Sin Llaves';
             return chat; // <--- IMPRESCINDIBLE RETORNAR EL OBJETO
          }

          if (chat.lastMessage && chat.lastMessageIV && chat.otherUserPublicKey) {
            try {
              chat.lastMessage = await this.cryptoService.decrypt(
                  chat.lastMessage,
                  chat.lastMessageIV,
                  chat.otherUserPublicKey
              );
            } catch (error) {
              chat.lastMessage = 'Mensaje cifrado (Click para leer)';
            }
          }
          return chat; // <--- SIEMPRE RETORNAMOS EL CHAT
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

            // CORRECCIÓN: Aplicamos la misma lógica que en refresh
            if (chat.lastMessage && chat.lastMessageIV && chat.otherUserPublicKey) {
                try {
                    chat.lastMessage= await this.cryptoService.decrypt(
                        chat.lastMessage,
                        chat.lastMessageIV,
                        chat.otherUserPublicKey // <--- FALTABA ESTO EN TU CÓDIGO ANTERIOR
                    );
                } catch (error) {
                    chat.lastMessage = '🔒 Mensaje ilegible';
                }
            } else if (chat.lastMessage && !chat.otherUserPublicKey && !chat.isGroup) {
                 chat.lastMessage = '🔒 Sin Llaves';
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
    chat.unreadCount = 0;
    this.chatState.selectChat(chat);
    this.selectedChatId = chat.id;
  }

  formatTime(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  trackByChatId(_index: number, chat: ChatListItem): number {
    return chat.id;
  }


}
