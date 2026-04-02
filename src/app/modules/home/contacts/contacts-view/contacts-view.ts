import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter
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

  /// =====================
  // Estado
  // =====================
  contacts: ContactResponse[] = [];
  isLoading: boolean = true;
  openMenuContactId: number | null = null;

  @Output() closeProfile = new EventEmitter<void>();

  // NOTA: Eliminamos @ViewChild('contactModal') porque ya no es un modal.

  constructor(private contactService: ContactService) {}

  ngOnInit(): void {
    // Ya no hacemos this.contactModal.nativeElement.showModal();
    // Directamente cargamos los datos
    this.loadContacts();
  }

  // Eliminamos openModal() y closeModal() porque el padre (MainLayout) controla la visibilidad con *ngIf

  // =====================
  // Acciones
  // =====================
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
}
