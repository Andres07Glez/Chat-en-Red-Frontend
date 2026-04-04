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

  // 1. Agregamos la referencia al componente hijo
  @ViewChild(AddContactComponent) addContactChild!: AddContactComponent;

  contacts: ContactResponse[] = [];
  isLoading: boolean = true;
  openMenuContactId: number | null = null;

  @Output() closeProfile = new EventEmitter<void>();

  constructor(private contactService: ContactService) {}

  ngOnInit(): void {
    this.loadContacts();
  }

  // 2. Creamos el método para abrir el modal del hijo
  openAddContactModal(): void {
    this.addContactChild.show();
  }


  toggleMenu(contactId: number): void {
    // Si tocan el mismo, se cierra (null), si no, se abre ese ID
    this.openMenuContactId = this.openMenuContactId === contactId ? null : contactId;
  }

  /*loadContacts(): void {
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
  }*/

//   loadContacts(): void {
//     this.isLoading = true;
//     this.contactService.getMyContacts().subscribe({
//       next: (data) => {
//         // AQUÍ ESTÁ LA MAGIA: 
//         // Le decimos que de toda la 'data', solo nos guarde los que tienen ID de estado 2
//         this.contacts = data.filter(contacto => contacto.contactStatusId === 2);
        
//         this.isLoading = false;
//         console.log('Contactos cargados de BD:', data);
//         console.log('Contactos filtrados (solo aceptados):', this.contacts);
//       },
//       error: (error) => {
//         console.error('Error al cargar contactos:', error);
//         this.isLoading = false;
//       }
//     });
//   }

  loadContacts(): void {
    this.isLoading = true;
    this.contactService.getMyContacts().subscribe({
      next: (data) => {
        // Asignamos directamente la data porque el backend ya hizo el filtro
        this.contacts = data;
        
        this.isLoading = false;
        console.log('Contactos cargados y filtrados desde el servidor:', this.contacts);
      },
      error: (error) => {
        console.error('Error al cargar contactos:', error);
        this.isLoading = false;
      }
    });
  }

  deleteContact(contactId: number): void {
    console.log('¡El botón sí funciona! Intentando eliminar ID:', contactId);
    const confirmar = confirm('¿Estás seguro de que deseas eliminar a este contacto?');
    
    if (confirmar) {
      this.contactService.deleteContact(contactId).subscribe({
        next: () => {
          // Se quita al contacto del arreglo para que desaparezca visualmente
          this.contacts = this.contacts.filter(contacto => contacto.id !== contactId);
          this.openMenuContactId = null; 
        },
        error: (error) => {
          console.error('Error al eliminar el contacto:', error);
          alert('Hubo un problema al eliminar el contacto. Inténtalo de nuevo.');
        }
      });
    }
  }

}
