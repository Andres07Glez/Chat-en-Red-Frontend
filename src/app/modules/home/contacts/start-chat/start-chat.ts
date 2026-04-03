import { Component, ElementRef, EventEmitter, inject, Output, ViewChild } from '@angular/core';
import { ContactService } from '../../../../core/services/contacts/Contact.service';
import { ChatsService } from '../../../../core/services/chats/chats.service';
import { ChatStateService } from '../../../../core/services/chats/chat-state.service';
import { ContactResponse } from '../../../../core/models/Contact.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-start-chat',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './start-chat.html',
  styleUrl: './start-chat.css',
})
export class StartChat {
  @ViewChild('startChatModal') modal!: ElementRef<HTMLDialogElement>;

  /**
   * El padre (chat-list) puede suscribirse a este evento si necesita
   * reaccionar cuando se abre un chat nuevo (por ahora no es necesario
   * porque chatState.selectChat() dispara la actualización del ChatWindow).
   */
  @Output() conversationOpened = new EventEmitter<void>();

  private contactService = inject(ContactService);
  private chatsService  = inject(ChatsService);
  private chatState     = inject(ChatStateService);

  contacts: ContactResponse[]         = [];
  filteredContacts: ContactResponse[] = [];
  searchQuery  = '';
  isLoading    = false;
  isStarting   = false;
  startingId: number | null = null;   // ID del contacto que se está procesando
  errorMessage: string | null = null;

  // ─── Interfaz pública ───────────────────────────────────────────────────────

  /** Llamado por el padre vía @ ViewChild para abrir el modal */
  show(): void {
    this.reset();
    this.modal.nativeElement.showModal();
    this.loadContacts();
  }

  close(): void {
    this.modal.nativeElement.close();
  }

  // ─── Filtrado ────────────────────────────────────────────────────────────────

  filterContacts(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredContacts = q
      ? this.contacts.filter(c => c.contactName.toLowerCase().includes(q))
      : [...this.contacts];
  }

  // ─── Acción principal ────────────────────────────────────────────────────────

  startConversation(contact: ContactResponse): void {
    if (this.isStarting) return;

    this.isStarting   = true;
    this.startingId   = contact.contactUserId;
    this.errorMessage = null;

    this.chatsService.startDirectConversation(contact.contactUserId).subscribe({
      next: (chat) => {
        // Seleccionar el chat → ChatWindow se actualiza automáticamente
        this.chatState.selectChat(chat);
        this.conversationOpened.emit();
        this.close();
        this.isStarting = false;
        this.startingId = null;
      },
      error: () => {
        this.errorMessage = 'No se pudo iniciar la conversación. Inténtalo de nuevo.';
        this.isStarting = false;
        this.startingId = null;
      }
    });
  }

  // ─── Privados ────────────────────────────────────────────────────────────────

  private reset(): void {
    this.searchQuery      = '';
    this.contacts         = [];
    this.filteredContacts = [];
    this.isLoading        = false;
    this.isStarting       = false;
    this.startingId       = null;
    this.errorMessage     = null;
  }

  private loadContacts(): void {
    this.isLoading = true;
    this.contactService.getMyContacts().subscribe({
      next: (data) => {
        this.contacts         = data;
        this.filteredContacts = [...data];
        this.isLoading        = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar la lista de contactos.';
        this.isLoading    = false;
      }
    });
  }

}
