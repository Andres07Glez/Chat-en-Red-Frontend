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
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule,FormsModule,StartChat,CreateGroup],
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

  public allChats: ChatListItem[] = [];
  filteredChats: ChatListItem[] = [];

  isLoading      = true;
  selectedChatId: number | null = null;
  searchQuery    = '';
  // ── Modo selección ────────────────────────────────────────────────────────

  /** true = modo selección activo (checkboxes visibles) */
  isSelectionMode = false;

  /** IDs de chats marcados para eliminar */
  selectedChatIds = new Set<number>();

  isDeleting = false;

  get selectedCount(): number { return this.selectedChatIds.size; }

  get allFilteredSelected(): boolean {
    return this.filteredChats.length > 0 &&
           this.filteredChats.every(c => this.selectedChatIds.has(c.id));
  }
  // ── Ciclo de vida ────────────────────────────────────────────────────────

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
  // ── Acciones de cabecera ──────────────────────────────────────────────────

  openStartIndividualChat(): void {
    this.startChatChild.show();
  }

  openCreateGroup(): void {
    this.createGroupChild.show();
  }
  enterSelectionMode(): void {
    this.isSelectionMode = true;
    this.selectedChatIds = new Set();
  }

  exitSelectionMode(): void {
    this.isSelectionMode = false;
    this.selectedChatIds = new Set();
  }

// ── Selección ─────────────────────────────────────────────────────────────

  toggleChatSelection(chatId: number, event: Event): void {
    event.stopPropagation();
    if (this.selectedChatIds.has(chatId)) {
      this.selectedChatIds.delete(chatId);
    } else {
      this.selectedChatIds.add(chatId);
    }
    this.selectedChatIds = new Set(this.selectedChatIds);
  }

  toggleSelectAll(): void {
    if (this.allFilteredSelected) {
      this.filteredChats.forEach(c => this.selectedChatIds.delete(c.id));
    } else {
      this.filteredChats.forEach(c => this.selectedChatIds.add(c.id));
    }
    this.selectedChatIds = new Set(this.selectedChatIds);
  }

  // ── Eliminación ───────────────────────────────────────────────────────────

  deleteSelected(): void {
    if (this.selectedChatIds.size === 0 || this.isDeleting) return;

    const count = this.selectedChatIds.size;
    const label = count === 1 ? 'esta conversación' : `estas ${count} conversaciones`;
    if (!confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;

    this.isDeleting = true;
    const ids = [...this.selectedChatIds];

    // Eliminar en paralelo y esperar a que todas terminen
    let pending = ids.length;
    let hasErrors = false;

    ids.forEach(id => {
      this.chatService.deleteConversation(id).subscribe({
        next: () => {
          pending--;
          if (pending === 0) this.onDeleteComplete(hasErrors);
        },
        error: () => {
          hasErrors = true;
          pending--;
          if (pending === 0) this.onDeleteComplete(hasErrors);
        }
      });
    });
  }

  private onDeleteComplete(hadErrors: boolean): void {
    this.isDeleting = false;

    // Si el chat activo fue eliminado, limpiar la selección en el ChatWindow
    if (this.selectedChatIds.has(this.selectedChatId!)) {
      this.chatState.clear();
      this.selectedChatId = null;
    }

    this.exitSelectionMode();
    this.refreshChatsSilent();

    if (hadErrors) {
      alert('Algunos chats no pudieron eliminarse. Intenta de nuevo.');
    }
  }

  // ── Búsqueda ──────────────────────────────────────────────────────────────

  onSearch(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredChats = q
      ? this.allChats.filter(c => c.name.toLowerCase().includes(q))
      : [...this.allChats];
  }
  // ── WebSocket — tiempo real ───────────────────────────────────────────────

  private subscribeToMyUpdates() {
    const currentUser = this.authService.getUser();
    if (!currentUser) return;

    const myTopic = `/topic/user/${currentUser.id}`;

    this.userTopicSub = this.wsService.watch(myTopic).subscribe({
      next: async (msg) => {
        const incomingMsg = JSON.parse(msg.body);
        const chatIndex = this.allChats.findIndex(c => c.id === incomingMsg.conversationId);

        if (chatIndex !== -1) {
          // === CASO A: EL CHAT YA ESTÁ EN LA LISTA ===
          const chatToUpdate = this.allChats[chatIndex];
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
          this.allChats.splice(chatIndex, 1);
          this.allChats.unshift(chatToUpdate);

        } else {
          // === CASO B: CHAT NUEVO ===
          this.refreshChatsSilent();
        }
        this.onSearch();
      },
      error: (err) => console.error('Error en updates de lista', err)
    });
  }
  // ── Carga de datos ────────────────────────────────────────────────────────

  refreshChatsSilent() {
    this.chatService.getMyChats().subscribe({
      next: async (data) => {
        this.allChats = await this.decryptLastMessages(data);
        this.onSearch();
      },
      error: (err) => console.error(err)
    });
  }

  loadChats() {
     this.chatService.getMyChats().subscribe({
      next: async (data) => {
        this.allChats     = await this.decryptLastMessages(data);
        this.filteredChats = [...this.allChats];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error cargando chats:', err);
        this.isLoading = false;
      }
    });
  }

  // ── Descifrado de previews ────────────────────────────────────────────────
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
    const key = this.cryptoService.getGroupKey(chat.id);
    if (key && chat.lastMessageIV) {
      try {
        chat.lastMessage = await this.cryptoService.decryptWithGroupKey(
          chat.lastMessage, chat.lastMessageIV, key
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
  // ── Selección de chat activo ──────────────────────────────────────────────
  selectChat(chat: ChatListItem) {
    if (this.isSelectionMode) {
      this.toggleChatSelection(chat.id, new Event('click'));
      return;
    }
    chat.unreadCount = 0;
    this.chatState.selectChat(chat);
    this.selectedChatId = chat.id;
  }

  formatTime(dateString: string): string {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  trackByChatId(_: number, chat: ChatListItem): number {
    return chat.id;
  }


}
