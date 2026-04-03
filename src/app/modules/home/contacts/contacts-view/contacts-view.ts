import {
  Component,
  OnInit,
  ViewChild,
  Output,
  EventEmitter,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { ContactService } from '../../../../core/services/contacts/Contact.service';
import { ContactResponse } from '../../../../core/models/Contact.interface';
import { AddContactComponent } from '../add-contact/add-contact';
import { ChatsService } from '../../../../core/services/chats/chats.service';
import { ChatStateService } from '../../../../core/services/chats/chat-state.service';

@Component({
  selector: 'app-contacts-view',
  standalone: true,
  imports: [CommonModule, AddContactComponent],
  templateUrl: './contacts-view.html',
  styleUrl: './contacts-view.css'
})
export class ContactsViewComponent implements OnInit {

  /// =====================
  // Estado
  // =====================

  // 1. Agregamos la referencia al componente hijo
  @ViewChild(AddContactComponent) addContactChild!: AddContactComponent;
  @Output() closeProfile = new EventEmitter<void>();
  // ── Servicios ──────────────────────────────────────────────────────────────
  private contactService = inject(ContactService);
  private chatsService   = inject(ChatsService);
  private chatState      = inject(ChatStateService);

  contacts: ContactResponse[] = [];
  isLoading: boolean = true;
  openMenuContactId: number | null = null;

  /** ID del contacto cuya conversación se está iniciando (para feedback visual) */
  startingConversationId: number | null = null;

  ngOnInit(): void {
    this.loadContacts();
  }

  // ── Acciones del header ────────────────────────────────────────────────────
  openAddContactModal(): void {
    this.addContactChild.show();
  }

  // ── Menú contextual ────────────────────────────────────────────────────────

  toggleMenu(contactId: number): void {
    // Si tocan el mismo, se cierra (null), si no, se abre ese ID
    this.openMenuContactId = this.openMenuContactId === contactId ? null : contactId;
  }

  loadContacts(): void {
    this.isLoading = true;
    this.contactService.getMyContacts().subscribe({
      next: (data) => {
        this.contacts = data;
        this.isLoading = false;
        console.log('Contactos cargados:', data);
      },
      error: (error) => {
        console.error('Error al cargar contactos:', error);
        this.isLoading = false;
      }
    });
  }
  startConversation(contact: ContactResponse): void {
    // Cierra el dropdown
    this.openMenuContactId = null;

    // Evitar doble clic
    if (this.startingConversationId !== null) return;
    this.startingConversationId = contact.contactUserId;

    this.chatsService.startDirectConversation(contact.contactUserId).subscribe({
      next: (chat) => {
        // 1. Seleccionar el chat → el ChatWindow se muestra automáticamente
        this.chatState.selectChat(chat);
        // 2. Cerrar el panel de contactos y volver a la vista de chats
        this.closeProfile.emit();
        this.startingConversationId = null;
      },
      error: (err) => {
        console.error('Error iniciando conversación:', err);
        this.startingConversationId = null;
      }
    });
  }
}
