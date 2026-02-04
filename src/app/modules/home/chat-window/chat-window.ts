import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, inject, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { ChatListItem } from '../../../core/models/chatsList.model';
import { MessageResponse } from '../../../core/models/message.model';
import { ChatsService } from '../../../core/services/chats/chats.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './chat-window.html',
  styleUrl: './chat-window.css',
})
export class ChatWindow implements OnChanges, AfterViewChecked{
  @Input() chatData!: ChatListItem; // Recibimos el chat seleccionado del padre

  private chatService = inject(ChatsService);
  newMessageText: string = ''; // Variable vinculada al input
  isSending = false;

  messages: MessageResponse[] = [];
  isLoading = false;

  // Referencia al contenedor de mensajes para hacer scroll automático
  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['chatData'] && this.chatData) {
      this.loadMessages();
    }
  }

  loadMessages() {
    this.isLoading = true;
    this.chatService.getMessages(this.chatData.id).subscribe({
      next: (data) => {
        this.messages = data;
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
  sendMessage() {
    if (!this.newMessageText.trim() || !this.chatData) return;

    this.isSending = true;

    // PREPARAR REQUEST
    // NOTA: Aquí iría la lógica de ENCRIPTACIÓN en el futuro.
    // Por ahora enviamos texto plano y un IV falso.
    const request = {
      conversationId: this.chatData.id,
      content: this.newMessageText, // <--- AQUÍ CIFRAREMOS DESPUÉS
      messageTypeCode: 'TEXT',
      iv: 'temp_iv_' + new Date().getTime() // IV temporal
    };

    this.chatService.sendMessage(request).subscribe({
      next: (msgResponse) => {
        // 1. Agregamos el mensaje a la lista visualmente
        this.messages.push(msgResponse);

        // 2. Limpiamos el input
        this.newMessageText = '';
        this.isSending = false;

        // 3. Scroll al final
        setTimeout(() => this.scrollToBottom(), 50);
      },
      error: (err) => {
        console.error('Error enviando mensaje', err);
        this.isSending = false;
      }
    });
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
