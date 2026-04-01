import { Component, EventEmitter, inject, Output } from '@angular/core';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-profile-sidebar',
  standalone: true,
  imports: [],
  templateUrl: './profile-sidebar.html',
  styleUrl: './profile-sidebar.css',
})
export class ProfileSidebar {
  private authService = inject(AuthService);

  // Obtenemos los datos reales del usuario
  currentUser = this.authService.getUser();

  // Evento para avisar al padre que queremos cerrar el perfil
  @Output() closeProfile = new EventEmitter<void>();

  onClose() {
    this.closeProfile.emit();
  }

  logout() {
    this.authService.logout();
  }

}
