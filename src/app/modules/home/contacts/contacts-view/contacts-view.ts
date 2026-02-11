import {
  Component,
  OnInit,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { ContactService } from '../../../../core/services/contacts/Contact.service';
import { ContactResponse } from '../../../../core/models/Contact.interface';
import { AddContactComponent } from '../add-contact/add-contact';

@Component({
  selector: 'app-contacts-view',
  standalone: true,
  imports: [CommonModule, AddContactComponent],
  templateUrl: './contacts-view.html',
  styleUrl: './contacts-view.css'
})
export class ContactsViewComponent implements OnInit {

  // =====================
  // Estado del componente
  // =====================

  contacts: ContactResponse[] = [];
  isLoading: boolean = true;

  openMenuContactId: number | null = null;

  // =====================
  // Referencia al modal
  // =====================

  @ViewChild('contactModal')
  contactModal!: ElementRef<HTMLDialogElement>;

  // Referencia al componente hijo
  @ViewChild('addContactChild') addContactChild!: AddContactComponent;

  openAddContact(): void {
    this.contactModal.nativeElement.close(); // Cierra el de "Mis Contactos"
    this.addContactChild.show();            // Abre el nuevo
  }

  onAddContactClosed(): void {
    this.openModal(); // Reabre el de "Mis Contactos" cuando el otro se cierra
  }

  // =====================
  // Constructor
  // =====================

  constructor(
    private contactService: ContactService
  ) {}

  // =====================
  // Ciclo de vida
  // =====================

  ngOnInit(): void {
    this.loadContacts();
  }

  // =====================
  // Modal
  // =====================

  openModal(): void {
    this.contactModal.nativeElement.showModal();
  }

  closeModal(): void {
    this.contactModal.nativeElement.close();
  }

  // =====================
  // Menú de acciones
  // =====================

  toggleMenu(contactId: number): void {
    this.openMenuContactId =
      this.openMenuContactId === contactId ? null : contactId;
  }

  // =====================
  // Data
  // =====================

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
}
