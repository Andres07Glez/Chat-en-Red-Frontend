import { Component, ElementRef, ViewChild, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContactService } from '../../../../core/services/contacts/Contact.service';
import { ContactLookupResponse } from '../../../../core/models/ContactLookupResponse.interface';

@Component({
  selector: 'app-add-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-contact.html'
})
export class AddContactComponent {

  @ViewChild('addContactModal') modal!: ElementRef<HTMLDialogElement>;
  @Output() modalClosed = new EventEmitter<void>();

  searchQuery = '';
  isLoading = false;
  hasSearched = false;
  errorMessage: string | null = null;

  foundUser: any | null = null;
  relationStatus: 'NONE' | 'PENDING' | 'ACCEPTED' | 'REMOVED' | null = null;
  canAdd = false;

  constructor(private contactService: ContactService) {}

  show() {
    this.resetState();
    this.modal.nativeElement.showModal();
  }

  close() {
    this.modal.nativeElement.close();
  }

  onModalClose() {
    this.modalClosed.emit();
  }

  private resetState() {
    this.searchQuery = '';
    this.isLoading = false;
    this.hasSearched = false;
    this.errorMessage = null;
    this.foundUser = null;
    this.relationStatus = null;
    this.canAdd = false;
  }

  performSearch() {
    if (!this.searchQuery.trim()) return;

    this.isLoading = true;
    this.hasSearched = true;
    this.errorMessage = null;
    this.foundUser = null;
    this.relationStatus = null;
    this.canAdd = false;

    this.contactService.lookupContact(this.searchQuery).subscribe({
      next: (res: ContactLookupResponse) => {
        this.isLoading = false;

        if (!res.userExists) {
          this.errorMessage = 'El usuario no existe.';
          return;
        }

        this.foundUser = {
          username: this.searchQuery,
          displayName: this.searchQuery,
          avatarUrl: null
        };

        this.relationStatus = res.relationStatus;
        this.canAdd =
          res.relationStatus === 'NONE' ||
          res.relationStatus === 'REMOVED';
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Error al buscar el usuario.';
      }
    });
  }

  sendRequest() {
    if (!this.foundUser || !this.canAdd) return;

    this.isLoading = true;

    this.contactService.sendContactRequest(this.foundUser.username).subscribe({
      next: () => {
        this.isLoading = false;
        this.close();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage =
          err.error?.message || 'No se pudo enviar la solicitud.';
      }
    });
  }
}
