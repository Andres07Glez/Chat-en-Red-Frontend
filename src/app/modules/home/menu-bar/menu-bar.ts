import { Component, EventEmitter, HostListener, inject, Output} from '@angular/core';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ThemeService } from '../../../core/services/theme/theme.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu-bar',
  //standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-bar.html',
  styleUrls: ['./menu-bar.css']
})
export class menubar {
  authService = inject(AuthService);
  currentUser = this.authService.getUser();
  themeService = inject(ThemeService);
  perfilAbierto = false;

  // Evento para notificar al componente padre cuando se abre/cierra el perfil
  @Output() perfilToggled = new EventEmitter<boolean>();

  // Evento para notificar cuando se hace clic en Chats
  @Output() onChatsClick = new EventEmitter<void>();

  // Evento para notificar cuando se hace clic en Solicitudes
  @Output() onRequestsClick = new EventEmitter<void>();

  togglePerfil(): void {
    this.perfilAbierto = !this.perfilAbierto;
    this.perfilToggled.emit(this.perfilAbierto);
  }

  cerrarPerfil(): void {
    this.perfilAbierto = false;
    this.perfilToggled.emit(false);
  }

  logout() {
  this.authService.logout();
}
}
