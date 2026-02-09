import { Component, inject } from '@angular/core';
import { ChatList } from "../chat-list/chat-list";
import { ChatStateService } from '../../../core/services/chats/chat-state.service';
import { CommonModule } from '@angular/common';
import { menubar } from "../menu-bar/menu-bar";
import { ProfileSidebar } from "../profile-sidebar/profile-sidebar";
import { ChatWindow } from "../chat-window/chat-window";
import { UserRequestsComponent } from '../user-requests/user-requests';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, ChatList, menubar, ProfileSidebar, ChatWindow, UserRequestsComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  public chatState = inject(ChatStateService);

  // En lugar de booleano, usamos el estado de la vista. Default: 'chats'
  activeView: 'chats' | 'profile' | 'requests' = 'chats';

  // Lógica para el perfil (viene del toggle)
  handleProfileToggle(isOpen: boolean) {
    if (isOpen) {
      this.activeView = 'profile';
    } else {
      // Si cierran el perfil, volvemos a chats
      this.activeView = 'chats';
    }
  }

  // Click en icono de Chats
  openChatList() {
    this.activeView = 'chats';
  }

  // Click en icono de Solicitudes (NUEVO)
  openRequests() {
    this.activeView = 'requests';
    console.log("Abriendo vista de solicitudes...");
  }
}
