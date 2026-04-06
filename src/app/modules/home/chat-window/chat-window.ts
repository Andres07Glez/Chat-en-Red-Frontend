import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, inject, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { ChatListItem } from '../../../core/models/chatsList.model';
import { MessageResponse } from '../../../core/models/message.model';
import { ChatsService } from '../../../core/services/chats/chats.service';
import { FormsModule } from '@angular/forms';
import { ChatStateService } from '../../../core/services/chats/chat-state.service';
import { CryptoService } from '../../../core/services/crypto/crypto.service';
import { firstValueFrom, Subscription } from 'rxjs';
import { WebsocketService } from '../../../core/services/webSocket/websocket.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UserService } from '../../../core/services/user/user.service';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.css',
})
export class ChatWindow implements OnChanges, AfterViewChecked,OnDestroy{
  @Input() chatData!: ChatListItem; // Recibimos el chat seleccionado del padre
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  private chatService = inject(ChatsService);
  private chatState = inject(ChatStateService);
  private cryptoService = inject(CryptoService);
  private wsService = inject(WebsocketService);
  private authService=inject(AuthService);
  private userService = inject(UserService);

  private chatSubscription: Subscription | null = null;

  messages: MessageResponse[] = [];
  newMessageText: string = ''; // Variable vinculada al input
  isSending = false;
  isLoading = false;
  private groupKey: CryptoKey | null = null;
  isLoadingGroupKey = false;
  // ── Modo selección de mensajes ────────────────────────────────────────────

  isSelectionMode     = false;
  selectedMessageIds  = new Set<number>();
  isDeletingMessages  = false;

  get selectedMessageCount(): number { return this.selectedMessageIds.size; }

  /** Solo los mensajes propios seleccionados (los únicos que se pueden borrar) */
  get selectedOwnCount(): number {
    return this.messages.filter(
      m => m.isMine && this.selectedMessageIds.has(m.id)
    ).length;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!changes['chatData'] || !this.chatData) return;

    const prevChat = changes['chatData'].previousValue;
    if (prevChat) this.chatState.setDraft(prevChat.id, this.newMessageText);

    // Resetear estado para el nuevo chat
    this.groupKey   = null;
    this.messages   = [];
    this.newMessageText = this.chatState.getDraft(this.chatData.id);

    // Salir del modo selección al cambiar de chat
    this.exitSelectionMode();

    this.subscribeToRealTimeMessages();

    if (this.chatData.isGroup) {
      this.loadGroupKeyThenMessages();
    } else {
      this.refreshPublicKey();
      this.loadMessages();
    }
  }
  // Scroll automático al último mensaje
  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  ngOnDestroy() {
    this.unsubscribeChat(); // Limpieza al destruir componente
    if (this.chatData) this.chatState.setDraft(this.chatData.id, this.newMessageText);
  }
  // ── Modo selección ────────────────────────────────────────────────────────

  enterSelectionMode(): void {
    this.isSelectionMode    = true;
    this.selectedMessageIds = new Set();
  }

  exitSelectionMode(): void {
    this.isSelectionMode    = false;
    this.selectedMessageIds = new Set();
  }

  toggleMessageSelection(msg: MessageResponse, event: Event): void {
    event.stopPropagation();
    if (this.selectedMessageIds.has(msg.id)) {
      this.selectedMessageIds.delete(msg.id);
    } else {
      this.selectedMessageIds.add(msg.id);
    }
    this.selectedMessageIds = new Set(this.selectedMessageIds);
  }

  /**
   * Elimina solo los mensajes propios seleccionados.
   * Los ajenos simplemente se ignoran (no se envían al backend).
   */
  deleteSelectedMessages(): void {
    if (this.isDeletingMessages) return;

    const ownIds = this.messages
      .filter(m => m.isMine && this.selectedMessageIds.has(m.id))
      .map(m => m.id);

    if (ownIds.length === 0) {
      alert('Solo puedes eliminar tus propios mensajes.');
      return;
    }

    const label = ownIds.length === 1 ? 'este mensaje' : `estos ${ownIds.length} mensajes`;
    if (!confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;

    this.isDeletingMessages = true;

    this.chatService.deleteMessages(ownIds).subscribe({
      next: () => {
        // Quitar del array local (UI optimista)
        this.messages = this.messages.filter(m => !ownIds.includes(m.id));
        this.exitSelectionMode();
        this.isDeletingMessages = false;
        this.chatState.triggerRefresh();
      },
      error: (err) => {
        console.error('Error eliminando mensajes:', err);
        this.isDeletingMessages = false;
        alert('No se pudieron eliminar los mensajes. Inténtalo de nuevo.');
      }
    });
  }
  // ── Carga de mensajes ────────────────────────────────────────────────────

  private async loadGroupKeyThenMessages(): Promise<void> {
    this.isLoadingGroupKey = true;
    this.isLoading         = true;

    try {
      const cached = this.cryptoService.getGroupKey(this.chatData.id);
      if (cached) {
        this.groupKey = cached;
      } else {
        const keyData = await firstValueFrom(
          this.chatService.getMyConversationKey(this.chatData.id)
        );
        this.groupKey = await this.cryptoService.decryptGroupKey(
          keyData.encryptedKey,
          keyData.iv,
          keyData.creatorPublicKey
        );
        this.cryptoService.storeGroupKey(this.chatData.id, this.groupKey);
      }

      this.loadMessages();
    } catch (err) {
      console.error('Error cargando llave de grupo:', err);
      this.isLoading = false;
    } finally {
      this.isLoadingGroupKey = false;
    }
  }
  loadMessages(): void {
    this.isLoading = true;
    if (this.chatData.isGroup && !this.groupKey)             { this.isLoading = false; return; }
    if (!this.chatData.isGroup && !this.chatData.otherUserPublicKey) { this.isLoading = false; return; }

    this.chatService.getMessages(this.chatData.id).subscribe({
      next: async (data) => {
        this.messages  = await this.decryptMessages(data);
        this.isLoading = false;
        this.scrollToBottom();
      },
      error: (err) => { console.error(err); this.isLoading = false; }
    });
  }
  private async decryptMessages(messages: MessageResponse[]): Promise<MessageResponse[]> {
    return Promise.all(messages.map(async (msg) => {
      if (msg.messageTypeCode !== 'TEXT' || !msg.iv) return msg;
      try {
        if (this.chatData.isGroup && this.groupKey) {
          msg.content = await this.cryptoService.decryptWithGroupKey(
            msg.content, msg.iv, this.groupKey
          );
        } else if (!this.chatData.isGroup && this.chatData.otherUserPublicKey) {
          msg.content = await this.cryptoService.decrypt(
            msg.content, msg.iv, this.chatData.otherUserPublicKey
          );
        }
      } catch {
        msg.content = '🔒 Mensaje ilegible';
      }
      return msg;
    }));
  }
  // ── WebSocket ─────────────────────────────────────────────────────────────

  private subscribeToRealTimeMessages() {
      this.unsubscribeChat();
      const currentUser = this.authService.getUser();

      const topic = `/topic/chat/${this.chatData.id}`;

      this.chatSubscription = this.wsService.watch(topic).subscribe({
        next: async (message) => {
          const msgReceived = JSON.parse(message.body);
          if (this.messages.some(m => m.id === msgReceived.id)) return;

          if (currentUser && msgReceived.senderName === currentUser.username) {
              msgReceived.isMine = true;
          }

          if (msgReceived.messageTypeCode === 'TEXT' && msgReceived.iv) {
            try {
              if (this.chatData.isGroup && this.groupKey) {
                msgReceived.content = await this.cryptoService.decryptWithGroupKey(
                  msgReceived.content, msgReceived.iv, this.groupKey
                );
              } else if (!this.chatData.isGroup && this.chatData.otherUserPublicKey) {
                msgReceived.content = await this.cryptoService.decrypt(
                  msgReceived.content, msgReceived.iv, this.chatData.otherUserPublicKey
                );
              }
            } catch {
              msgReceived.content = '🔒 Mensaje cifrado';
            }
          }

          this.messages.push(msgReceived);

          if (this.chatData.id === msgReceived.conversationId) {
            this.chatService.markAsRead(this.chatData.id).subscribe();
          }
          setTimeout(() => this.scrollToBottom(), 50);
          this.chatState.triggerRefresh();
        },
        error: (err) => console.error('Error WS chat:', err)
      });
  }
  // ── Envío ─────────────────────────────────────────────────────────────────
  async sendMessage(): Promise<void> {
    if (!this.newMessageText.trim() || !this.chatData || this.isSending) return;
    if (this.chatData.isGroup && !this.groupKey) { alert('Llave de grupo no lista.'); return; }
    if (!this.chatData.isGroup && !this.chatData.otherUserPublicKey) {
      alert('El destinatario no tiene llaves de seguridad.'); return;
    }

    this.isSending = true;
    try {
      let enc: { content: string; iv: string };
      if (this.chatData.isGroup && this.groupKey) {
        enc = await this.cryptoService.encryptWithGroupKey(this.newMessageText, this.groupKey);
      } else {
        enc = await this.cryptoService.encrypt(this.newMessageText, this.chatData.otherUserPublicKey!);
      }

      this.chatService.sendMessage({
        conversationId: this.chatData.id, content: enc.content,
        messageTypeCode: 'TEXT', iv: enc.iv
      }).subscribe({
        next: () => {
          this.newMessageText = '';
          this.chatState.setDraft(this.chatData.id, '');
          this.isSending = false;
        },
        error: (err) => { console.error(err); this.isSending = false; }
      });
    } catch (err) {
      console.error('Error de encriptación:', err);
      this.isSending = false;
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.sendMessage(); }
  }

  onInputText(): void {
    if (this.chatData) this.chatState.setDraft(this.chatData.id, this.newMessageText);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private refreshPublicKey() {
    if (this.chatData.isGroup || !this.chatData.otherUserId) return;
    this.userService.getPublicKey(this.chatData.otherUserId).subscribe({
      next: (res) => {
        if (res.publicKey && res.publicKey !== this.chatData.otherUserPublicKey) {
          this.chatData.otherUserPublicKey = res.publicKey;
          this.loadMessages();
        }
      },
      error: (err) => console.error('Error actualizando llave pública:', err)
    });
  }

  // ── Helpers de UI ────────────────────────────────────────────────────────
  private unsubscribeChat(): void {
    if (this.chatSubscription) { this.chatSubscription.unsubscribe(); this.chatSubscription = null; }
  }

  scrollToBottom(): void {
    try {
      this.scrollContainer.nativeElement.scrollTop =
        this.scrollContainer.nativeElement.scrollHeight;
    } catch { /* Ignorar si el elemento no existe todavía */ }
  }

  // Helper para hora
  formatTime(isoDate: string): string {
    return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }


  // 1. Detecta si debemos mostrar el separador antes del mensaje actual
  shouldShowDateSeparator(prevMsg: MessageResponse | null, currentMsg: MessageResponse): boolean {
    if (!prevMsg) return true; // El primer mensaje siempre lleva fecha
    const prevDate = new Date(prevMsg.sentAt);
    const currDate = new Date(currentMsg.sentAt);

    // Comparamos año, mes y día
    return prevDate.getDate() !== currDate.getDate() ||
           prevDate.getMonth() !== currDate.getMonth() ||
           prevDate.getFullYear() !== currDate.getFullYear();
  }

  // 2. Devuelve el texto amigable (Hoy, Ayer, o fecha completa)
  formatDateSeparator(isoDate: string): string {
    const date = new Date(isoDate);
    const today = new Date();
    // Crear fechas sin hora para comparar
    const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7)   return date.toLocaleDateString('es-ES', { weekday: 'long' });

    // Si es más viejo, devuelve fecha completa
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

}
