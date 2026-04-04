import { Component, ElementRef, EventEmitter, inject, Output, ViewChild } from '@angular/core';
import { ContactService } from '../../../../core/services/contacts/Contact.service';
import { ChatsService } from '../../../../core/services/chats/chats.service';
import { ChatStateService } from '../../../../core/services/chats/chat-state.service';
import { CryptoService } from '../../../../core/services/crypto/crypto.service';
import { UserService } from '../../../../core/services/user/user.service';
import { AuthService } from '../../../../core/services/auth/auth.service';
import { ContactResponse } from '../../../../core/models/Contact.interface';
import { forkJoin, lastValueFrom, map } from 'rxjs';
import { GroupMemberKeyDTO } from '../../../../core/models/group.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-create-group',
  standalone: true,
  imports: [CommonModule,FormsModule],
  templateUrl: './create-group.html',
  styleUrl: './create-group.css',
})
export class CreateGroup {
  @ViewChild('createGroupModal') modal!: ElementRef<HTMLDialogElement>;
  @Output() groupCreated = new EventEmitter<void>();

  private contactService = inject(ContactService);
  private chatsService   = inject(ChatsService);
  private chatState      = inject(ChatStateService);
  private cryptoService  = inject(CryptoService);
  private userService    = inject(UserService);
  private authService    = inject(AuthService);

  // ── Estado ──────────────────────────────────────────────────────────────────
  contacts: ContactResponse[]         = [];
  filteredContacts: ContactResponse[] = [];
  selectedIds = new Set<number>();   // Set de contactUserId (IDs de usuario)
  searchQuery  = '';
  groupTitle   = '';

  isLoadingContacts = false;
  isCreating        = false;
  errorMessage: string | null = null;

  // ── Getters de UI ────────────────────────────────────────────────────────────

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get selectedContacts(): ContactResponse[] {
    return this.contacts.filter(c => this.selectedIds.has(c.contactUserId));
  }

  get canCreate(): boolean {
    return this.groupTitle.trim().length > 0
        && this.selectedIds.size >= 1
        && !this.isCreating;
  }

  // ── Interfaz pública ─────────────────────────────────────────────────────────

  show(): void {
    this.reset();
    this.modal.nativeElement.showModal();
    this.loadContacts();
  }

  close(): void {
    this.modal.nativeElement.close();
  }

  // ── Interacción con la lista ─────────────────────────────────────────────────

  toggleContact(contact: ContactResponse): void {
    if (this.selectedIds.has(contact.contactUserId)) {
      this.selectedIds.delete(contact.contactUserId);
    } else {
      this.selectedIds.add(contact.contactUserId);
    }
    // Forzar detección de cambios en el Set (Angular no detecta mutaciones de Set)
    this.selectedIds = new Set(this.selectedIds);
  }

  isSelected(contactUserId: number): boolean {
    return this.selectedIds.has(contactUserId);
  }

  filterContacts(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredContacts = q
      ? this.contacts.filter(c => c.contactName.toLowerCase().includes(q))
      : [...this.contacts];
  }

  removeSelected(contactUserId: number): void {
    this.selectedIds.delete(contactUserId);
    this.selectedIds = new Set(this.selectedIds);
  }

  // ── Creación del grupo ───────────────────────────────────────────────────────

  async createGroup(): Promise<void> {
    if (!this.canCreate) return;

    this.isCreating   = true;
    this.errorMessage = null;

    try {
      const currentUser   = this.authService.getUser();
      const myPublicKeyB64 = localStorage.getItem('my_public_key');

      if (!myPublicKeyB64) {
        throw new Error('No se encontró tu llave pública. Cierra sesión e inicia de nuevo.');
      }

      // 1. Obtener llaves públicas de todos los miembros seleccionados en paralelo
      const memberIds = [...this.selectedIds];

      const keyResults = await lastValueFrom(
        forkJoin(
          memberIds.map(userId =>
            this.userService.getPublicKey(userId).pipe(
              map(res => ({ userId, publicKey: res.publicKey }))
            )
          )
        )
      );

      // Validar que todos tengan llave pública
      const missingKey = keyResults.find(r => !r.publicKey);
      if (missingKey) {
        throw new Error(
          'Uno de los contactos seleccionados aún no tiene llaves de seguridad configuradas.'
        );
      }

      // 2. Generar la llave AES simétrica del grupo
      const { key: groupKey, exportedB64: groupKeyB64 } =
        await this.cryptoService.generateGroupKey();

      // 3. Cifrar la llave del grupo para cada miembro
      const memberDtos: GroupMemberKeyDTO[] = [];

      for (const { userId, publicKey } of keyResults) {
        const { encryptedKey, iv } = await this.cryptoService.encryptGroupKey(
          groupKeyB64,
          publicKey
        );
        memberDtos.push({ userId, encryptedKey, iv });
      }

      // 4. Cifrar la llave del grupo para el propio creador
      //    Usa ECDH(mi_privada, mi_pública) — internamente consistente
      const { encryptedKey: selfEncKey, iv: selfIv } =
        await this.cryptoService.encryptGroupKey(groupKeyB64, myPublicKeyB64);
      memberDtos.push({ userId: currentUser.id, encryptedKey: selfEncKey, iv: selfIv });

      // 5. Crear el grupo en el backend
      const chat = await lastValueFrom(
        this.chatsService.createGroup({
          title: this.groupTitle.trim(),
          members: memberDtos
        })
      );

      // 6. Abrir el chat de grupo inmediatamente
      this.chatState.selectChat(chat);
      this.groupCreated.emit();
      this.close();

    } catch (err: any) {
      console.error('Error creando grupo:', err);
      this.errorMessage = err?.message ?? 'No se pudo crear el grupo. Inténtalo de nuevo.';
    } finally {
      this.isCreating = false;
    }
  }

  // ── Privados ─────────────────────────────────────────────────────────────────

  private reset(): void {
    this.contacts         = [];
    this.filteredContacts = [];
    this.selectedIds      = new Set();
    this.searchQuery      = '';
    this.groupTitle       = '';
    this.isLoadingContacts = false;
    this.isCreating       = false;
    this.errorMessage     = null;
  }

  private loadContacts(): void {
    this.isLoadingContacts = true;
    this.contactService.getMyContacts().subscribe({
      next: (data) => {
        this.contacts         = data;
        this.filteredContacts = [...data];
        this.isLoadingContacts = false;
      },
      error: () => {
        this.errorMessage     = 'No se pudo cargar la lista de contactos.';
        this.isLoadingContacts = false;
      }
    });
  }

}
