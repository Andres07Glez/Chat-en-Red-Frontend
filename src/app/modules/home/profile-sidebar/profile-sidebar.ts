import { Component, EventEmitter, inject, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth/auth.service';
import { UserService } from '../../../core/services/user/user.service';
import { UserMeData, UpdateProfileRequest } from '../../../core/models/user-me.model';

@Component({
  selector: 'app-profile-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-sidebar.html',
  styleUrl: './profile-sidebar.css',
})
export class ProfileSidebar implements OnInit {
  private authService = inject(AuthService);
  private userService = inject(UserService);

  @Output() closeProfile = new EventEmitter<void>();

  // Datos básicos del token (disponibles inmediatamente)
  currentUser = this.authService.getUser();

  // Datos completos del perfil (cargados desde el backend)
  profileData: UserMeData | null = null;
  isLoadingProfile = true;

  // ── Estado del modo edición ──────────────────────────────────────────────
  isEditing = false;
  isSaving = false;
  saveError: string | null = null;

  // Copia temporal mientras el usuario edita (no mutamos profileData)
  editForm: UpdateProfileRequest = { displayName: '', bio: '' };

  ngOnInit(): void {
    this.loadProfile();
  }

  // ── Carga de datos ───────────────────────────────────────────────────────

  loadProfile(): void {
    this.isLoadingProfile = true;
    this.userService.getMyProfile().subscribe({
      next: (data) => {
        this.profileData = data;
        this.isLoadingProfile = false;
      },
      error: (err) => {
        console.error('Error cargando perfil:', err);
        this.isLoadingProfile = false;
      }
    });
  }

  // ── Modo edición ─────────────────────────────────────────────────────────

  startEditing(): void {
    if (!this.profileData) return;
    // Copiar valores actuales al formulario
    this.editForm = {
      displayName: this.profileData.displayName ?? '',
      bio:         this.profileData.bio         ?? '',
    };
    this.saveError  = null;
    this.isEditing  = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.saveError = null;
  }

  saveProfile(): void {
    if (this.isSaving) return;

    this.isSaving  = true;
    this.saveError = null;

    this.userService.updateMyProfile(this.editForm).subscribe({
      next: (updated) => {
        this.profileData = updated; // Actualizar con la respuesta del servidor
        this.isEditing   = false;
        this.isSaving    = false;
      },
      error: (err) => {
        console.error('Error guardando perfil:', err);
        this.saveError = 'No se pudo guardar. Inténtalo de nuevo.';
        this.isSaving  = false;
      }
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Devuelve "displayName" si existe, si no cae al username del token */
  get displayName(): string {
    return this.profileData?.displayName?.trim() || this.currentUser?.username || '';
  }

  /** Formatea createdAt como "Noviembre 2025" */
  formatMemberSince(isoDate: string | undefined): string {
    if (!isoDate) return '—';
    return new Date(isoDate).toLocaleDateString('es-ES', {
      month: 'long',
      year:  'numeric',
    });
  }

  onClose(): void {
    this.closeProfile.emit();
  }

  logout(): void {
    this.authService.logout();
  }
}
