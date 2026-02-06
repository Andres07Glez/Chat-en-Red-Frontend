import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, inject, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { ChatListItem } from '../../../core/models/chatsList.model';
import { MessageResponse } from '../../../core/models/message.model';
import { ChatsService } from '../../../core/services/chats/chats.service';
import { FormsModule } from '@angular/forms';
import { ChatStateService } from '../../../core/services/chats/chat-state.service';
import { CryptoService } from '../../../core/services/crypto/crypto.service';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../../core/services/webSocket/websocket.service';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.css',
})
export class ChatWindow implements OnChanges, AfterViewChecked,OnDestroy{
  @Input() chatData!: ChatListItem; // Recibimos el chat seleccionado del padre

  private chatService = inject(ChatsService);
  private chatState = inject(ChatStateService);
  private cryptoService = inject(CryptoService);
  private wsService = inject(WebsocketService);
  private authService=inject(AuthService);
  private chatSubscription: Subscription | null = null;

  newMessageText: string = ''; // Variable vinculada al input
  isSending = false;

  messages: MessageResponse[] = [];
  isLoading = false;

  // Referencia al contenedor de mensajes para hacer scroll automático
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['chatData']) {
      // 1. Si había un chat previo cargado, guardamos su borrador antes de cambiar
      const prevChat = changes['chatData'].previousValue;
      if (prevChat) {
         this.chatState.setDraft(prevChat.id, this.newMessageText);
      }

      // 2. Cargamos el nuevo chat
      if (this.chatData) {
        // Recuperamos si había algo escrito
        this.newMessageText = this.chatState.getDraft(this.chatData.id);

        this.loadMessages();
        this.subscribeToRealTimeMessages();
      }
    }
  }
  // Método helper para guardar
  private saveDraft() {
    if (this.chatData) {
      this.chatState.setDraft(this.chatData.id, this.newMessageText);
    }
  }
  private subscribeToRealTimeMessages() {
    // Primero nos desconectamos del chat anterior si existía
    this.unsubscribeChat();

    // El topic debe coincidir con el Backend: "/topic/chat/{id}"
    const topic = `/topic/chat/${this.chatData.id}`;
    // Obtenemos mi usuario actual para comparar
    const currentUser = this.authService.getUser();

    this.chatSubscription = this.wsService.watch(topic).subscribe({
      next: async (message) => {
        // 'message.body' es el JSON String que envía el backend
        const msgReceived = JSON.parse(message.body);

        // EVITAR DUPLICADOS:
        // Si el mensaje es "mine=true", significa que YO lo envié.
        // Como ya hice .push() en sendMessage(), no necesito agregarlo otra vez.
        // PERO: Si viene de otro dispositivo mío, sí debería mostrarlo.
        // Por simplicidad ahora: Si ya tengo un mensaje con ese ID o content temporal, lo ignoro.
        // O mejor: Filtramos por ID si ya existe en el array.
        const alreadyExists = this.messages.some(m => m.id === msgReceived.id);
        if (alreadyExists) return;
        // El backend manda 'isMine=false' para broadcast general.
        // Aquí corregimos: Si el nombre del remitente soy YO, entonces es mío.
        if (currentUser && msgReceived.senderName === currentUser.username) {
            msgReceived.isMine = true;
        }

        // DESCIFRADO EN TIEMPO REAL
        if (msgReceived.messageTypeCode === 'TEXT' && msgReceived.iv) {
           try {
             msgReceived.content = await this.cryptoService.decrypt(msgReceived.content, msgReceived.iv);
           } catch (e) {
             console.error('Error descifrando mensaje vivo');
           }
        }

        // Agregar al array visual
        this.messages.push(msgReceived);

        // Scroll y avisar al sidebar
        setTimeout(() => this.scrollToBottom(), 50);
        this.chatState.triggerRefresh();
      },
      error: (err) => console.error('Error WS', err)
    });
  }
  ngOnDestroy() {
    this.unsubscribeChat(); // Limpieza al destruir componente
    this.saveDraft();

  }
  onInputText() {
    if (this.chatData) {
        this.chatState.setDraft(this.chatData.id, this.newMessageText);
    }
  }
  private unsubscribeChat() {
    if (this.chatSubscription) {
      this.chatSubscription.unsubscribe();
      this.chatSubscription = null;
    }
  }

  loadMessages() {
    this.isLoading = true;
    this.chatService.getMessages(this.chatData.id).subscribe({
      next: async (data) => {
        // DESCIFRADO MASIVO
        // Procesamos todos los mensajes cifrados
        const decryptedMessages = await Promise.all(data.map(async (msg) => {
            // Solo intentamos descifrar si es texto y tiene IV
            if (msg.messageTypeCode === 'TEXT' && msg.iv) {
                const plainText = await this.cryptoService.decrypt(msg.content, msg.iv);
                msg.content = plainText;
            }
            return msg;
        }));
        this.messages = decryptedMessages;
        this.isLoading = false;
        this.scrollToBottom();
      },
      error: (err) => console.error(err)
    });
  }

  // Scroll automático al último mensaje
  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    try {
        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  // Helper para hora
  formatTime(isoDate: string): string {
    return new Date(isoDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  async sendMessage() {
    if (!this.newMessageText.trim() || !this.chatData) return;

    this.isSending = true;

    // PREPARAR REQUEST
    // NOTA: Aquí iría la lógica de ENCRIPTACIÓN en el futuro.
    // Por ahora enviamos texto plano y un IV falso.
    try{
      const encryptedData = await this.cryptoService.encrypt(this.newMessageText);
      const request = {
        conversationId: this.chatData.id,
        content: encryptedData.content, // <--- AQUÍ CIFRAREMOS DESPUÉS
        messageTypeCode: 'TEXT',
        iv: encryptedData.iv // IV temporal
      };

      this.chatService.sendMessage(request).subscribe({
        next: (msgResponse) => {
          // 1. Agregamos el mensaje a la lista visualmente
          // Truco visual: El backend devuelve el mensaje cifrado.
                  // Nosotros ya sabemos qué decía, así que para mostrarlo rápido
                  // y evitar descifrar lo que acabamos de cifrar:
          //msgResponse.content = this.newMessageText;
          //this.messages.push(msgResponse);
          // 2. Limpiamos el input
          this.newMessageText = '';
          this.chatState.setDraft(this.chatData.id, ''); // Borrar draft tras enviar
          this.isSending = false;
          // 3. Scroll al final
          //setTimeout(() => this.scrollToBottom(), 50);
          //this.chatState.triggerRefresh();
        },
        error: (err) => {
          console.error('Error enviando mensaje', err);
          this.isSending = false;
        }
      });
    } catch (error) {
        console.error('Error de encriptación', error);
        this.isSending = false;
    }
  }
  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Evita el salto de línea
      this.sendMessage();
    }
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
