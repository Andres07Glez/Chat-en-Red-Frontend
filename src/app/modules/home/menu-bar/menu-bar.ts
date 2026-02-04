import { Component, EventEmitter, HostListener, inject, Output} from '@angular/core';
import { AuthService } from '../../../core/services/auth/auth.service';

@Component({
  selector: 'app-menu-bar',
  //standalone: true,
  imports: [],
  templateUrl: './menu-bar.html',
  styleUrls: ['./menu-bar.css']
})
export class menubar {
  authService = inject(AuthService);
  currentUser = this.authService.getUser();
  perfilAbierto = false;

  // Evento para notificar al componente padre cuando se abre/cierra el perfil
  @Output() perfilToggled = new EventEmitter<boolean>();

  // Evento para notificar cuando se hace clic en Chats
  @Output() onChatsClick = new EventEmitter<void>();

  togglePerfil(): void {
    this.perfilAbierto = !this.perfilAbierto;
    this.perfilToggled.emit(this.perfilAbierto);
  }

  cerrarPerfil(): void {
    this.perfilAbierto = false;
    this.perfilToggled.emit(false);
  }
}
