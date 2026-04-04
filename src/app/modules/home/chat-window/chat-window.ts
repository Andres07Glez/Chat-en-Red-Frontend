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

  ngOnChanges(changes: SimpleChanges) {
    if (!changes['chatData'] || !this.chatData) return;

    const prevChat = changes['chatData'].previousValue;
    if (prevChat) this.chatState.setDraft(prevChat.id, this.newMessageText);

    // Resetear estado para el nuevo chat
    this.groupKey   = null;
    this.messages   = [];
    this.newMessageText = this.chatState.getDraft(this.chatData.id);

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

  private async loadGroupKeyThenMessages(): Promise<void> {
    this.isLoadingGroupKey = true;
    this.isLoading         = true;

    try {
      // 1. Intentar desde caché (evita una petición HTTP en revisitas)
      const cached = this.cryptoService.getGroupKey(this.chatData.id);
      if (cached) {
        this.groupKey = cached;
      } else {
        // 2. Fetch desde backend y descifrar
        const keyData = await firstValueFrom(
          this.chatService.getMyConversationKey(this.chatData.id)
        );
        this.groupKey = await this.cryptoService.decryptGroupKey(
          keyData.encryptedKey,
          keyData.iv,
          keyData.creatorPublicKey
        );
        // 3. Guardar en caché para la lista de chats y futuras visitas
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
  loadMessages() {
    this.isLoading = true;

    if (this.chatData.isGroup && !this.groupKey) {
      // Seguridad: no cargar mensajes sin llave de grupo
      this.isLoading = false;
      return;
    }

    if (!this.chatData.isGroup && !this.chatData.otherUserPublicKey) {
      console.warn('Chat directo sin llave pública — no se pueden descifrar mensajes.');
      this.isLoading = false;
      return;
    }

    this.chatService.getMessages(this.chatData.id).subscribe({
      next: async (data) => {
        this.messages  = await this.decryptMessages(data);
        this.isLoading = false;
        this.scrollToBottom();
      },
      error: (err) => {
        console.error('Error cargando mensajes:', err);
        this.isLoading = false;
      }
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
  private subscribeToRealTimeMessages() {
      // Primero nos desconectamos del chat anterior si existía
      this.unsubscribeChat();
      const currentUser = this.authService.getUser();
      // El topic debe coincidir con el Backend: "/topic/chat/{id}"
      const topic = `/topic/chat/${this.chatData.id}`;
      // Obtenemos mi usuario actual para comparar

      this.chatSubscription = this.wsService.watch(topic).subscribe({
        next: async (message) => {
          // 'message.body' es el JSON String que envía el backend
          const msgReceived = JSON.parse(message.body);

          // Deduplicación: ignorar si ya procesamos este ID
          if (this.messages.some(m => m.id === msgReceived.id)) return;
          // El backend manda 'isMine=false' para broadcast general.
          // Aquí corregimos: Si el nombre del remitente soy YO, entonces es mío.
          if (currentUser && msgReceived.senderName === currentUser.username) {
              msgReceived.isMine = true;
          }
          // Descifrar el contenido entrante
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

          // Marcar como leído si este chat está activo
          if (this.chatData.id === msgReceived.conversationId) {
            this.chatService.markAsRead(this.chatData.id).subscribe();
          }

          setTimeout(() => this.scrollToBottom(), 50);
          this.chatState.triggerRefresh();
        },
        error: (err) => console.error('Error WS chat:', err)
      });
  }
  async sendMessage() {
      if (!this.newMessageText.trim() || !this.chatData || this.isSending) return;

      // Validaciones de cifrado
      if (this.chatData.isGroup && !this.groupKey) {
        alert('La llave del grupo aún no está lista. Espera un momento.');
        return;
      }
      if (!this.chatData.isGroup && !this.chatData.otherUserPublicKey) {
        alert('El destinatario no tiene llaves de seguridad. No se puede enviar.');
        return;
      }

      this.isSending = true;

      try {
        let encryptedData: { content: string; iv: string };

        if (this.chatData.isGroup && this.groupKey) {
          encryptedData = await this.cryptoService.encryptWithGroupKey(
            this.newMessageText, this.groupKey
          );
        } else {
          encryptedData = await this.cryptoService.encrypt(
            this.newMessageText, this.chatData.otherUserPublicKey!
          );
        }

        const request = {
          conversationId:  this.chatData.id,
          content:         encryptedData.content,
          messageTypeCode: 'TEXT',
          iv:              encryptedData.iv
        };

        this.chatService.sendMessage(request).subscribe({
          next: () => {
            this.newMessageText = '';
            this.chatState.setDraft(this.chatData.id, '');
            this.isSending = false;
          },
          error: (err) => {
            console.error('Error enviando mensaje:', err);
            this.isSending = false;
          }
        });

      } catch (error) {
        console.error('Error de encriptación:', error);
        this.isSending = false;
      }
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Evita el salto de línea
      this.sendMessage();
    }
  }
  onInputText() {
    if (this.chatData) this.chatState.setDraft(this.chatData.id, this.newMessageText);
  }

  // ── Refresh de llave pública (chat directo) ───────────────────────────────
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
  private unsubscribeChat() {
    if (this.chatSubscription) {
      this.chatSubscription.unsubscribe();
      this.chatSubscription = null;
    }
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
    if (diffDays < 7) {
        // Devuelve el día de la semana (Lunes, Martes...)
        return date.toLocaleDateString('es-ES', { weekday: 'long' });
    }
    // Si es más viejo, devuelve fecha completa
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

}
