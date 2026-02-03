import { Component, inject } from '@angular/core';
import { ChatList } from "../chat-list/chat-list";
import { ChatStateService } from '../../../core/services/chats/chat-state.service';
import { CommonModule } from '@angular/common';
import { menubar } from "../menu-bar/menu-bar";
import { ProfileSidebar } from "../profile-sidebar/profile-sidebar";

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, ChatList, menubar, ProfileSidebar],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout {
  // Hacemos público el servicio para usarlo en el HTML con signals
  public chatState = inject(ChatStateService);
  showProfilePanel = false;
  handleProfileToggle(isOpen: boolean) {
    this.showProfilePanel = isOpen;
  }

  // Método para cuando le das click al icono de "Chats"
  openChatList() {
    this.showProfilePanel = false;
  }
}
