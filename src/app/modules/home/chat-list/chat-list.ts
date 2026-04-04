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
import { CreateGroup } from '../contacts/create-group/create-group';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule,StartChat,CreateGroup],
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
  @ViewChild(CreateGroup) createGroupChild!: CreateGroup;


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
    if (this.refreshSub)   this.refreshSub.unsubscribe();
    if (this.userTopicSub) this.userTopicSub.unsubscribe();
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
  openCreateGroup(): void {
    this.showNewChatMenu = false;
    setTimeout(() => this.createGroupChild.show(), 50);
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
            chatToUpdate.lastMessage = await this.decryptPreview(
              chatToUpdate,
              incomingMsg.content,
              incomingMsg.iv
            );
            chatToUpdate.lastMessageIV = incomingMsg.iv;
          } else {
            chatToUpdate.lastMessage = incomingMsg.messageTypeCode === 'IMAGE' ? '📷 Foto' : 'Archivo';
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
        this.chats = await this.decryptLastMessages(data);
      },
      error: (err) => console.error(err)
    });
  }

  loadChats() {
     this.chatService.getMyChats().subscribe({
      next: async (data) => {
        this.chats     = await this.decryptLastMessages(data);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando chats:', err);
        this.isLoading = false;
      }
    });
  }
  /**
   * Descifra el lastMessage de cada chat directo.
   * Los grupos muestran un placeholder ya que su llave requiere un fetch adicional.
   */
  private async decryptLastMessages(chats: ChatListItem[]): Promise<ChatListItem[]> {
    return Promise.all(chats.map(async (chat) => {
      if (!chat.lastMessage) return chat;

      if (chat.isGroup) {
        return this.decryptGroupPreview(chat);
      }

      if (!chat.otherUserPublicKey) {
        chat.lastMessage = '🔒 Sin llaves';
        return chat;
      }

      if (chat.lastMessageIV) {
        try {
          chat.lastMessage = await this.cryptoService.decrypt(
            chat.lastMessage, chat.lastMessageIV, chat.otherUserPublicKey
          );
        } catch {
          chat.lastMessage = '🔒 Mensaje ilegible';
        }
      }
      return chat;
    }));
  }
  private async decryptGroupPreview(chat: ChatListItem): Promise<ChatListItem> {
    const cachedKey = this.cryptoService.getGroupKey(chat.id);
    if (cachedKey && chat.lastMessageIV) {
      try {
        chat.lastMessage = await this.cryptoService.decryptWithGroupKey(
          chat.lastMessage, chat.lastMessageIV, cachedKey
        );
      } catch {
        chat.lastMessage = '💬 Último mensaje';
      }
    } else {
      // Llave no cargada aún — placeholder neutral
      chat.lastMessage = '💬 Último mensaje';
    }
    return chat;
  }
  private async decryptPreview(
    chat: ChatListItem,
    encryptedContent: string,
    iv: string
  ): Promise<string> {
    try {
      if (chat.isGroup) {
        const key = this.cryptoService.getGroupKey(chat.id);
        return key
          ? await this.cryptoService.decryptWithGroupKey(encryptedContent, iv, key)
          : '💬 Nuevo mensaje';
      }
      if (chat.otherUserPublicKey) {
        return await this.cryptoService.decrypt(encryptedContent, iv, chat.otherUserPublicKey);
      }
    } catch { /* ignorar */ }
    return '🔒 Mensaje cifrado';
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
