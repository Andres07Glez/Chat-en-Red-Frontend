import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ChatList } from "../chat-list/chat-list";
import { ChatStateService } from '../../../core/services/chats/chat-state.service';
import { CommonModule } from '@angular/common';
import { menubar } from "../menu-bar/menu-bar";
import { ProfileSidebar } from "../profile-sidebar/profile-sidebar";
import { ChatWindow } from "../chat-window/chat-window";
import { WebsocketService } from '../../../core/services/webSocket/websocket.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, ChatList, menubar, ProfileSidebar, ChatWindow],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout implements OnInit, OnDestroy {
  // Hacemos público el servicio para usarlo en el HTML con signals
  public chatState = inject(ChatStateService);
  private wsService = inject(WebsocketService);
  showProfilePanel = false;
  handleProfileToggle(isOpen: boolean) {
    this.showProfilePanel = isOpen;
  }

  // Método para cuando le das click al icono de "Chats"
  openChatList() {
    this.showProfilePanel = false;
  }
  ngOnInit() {
    // Iniciamos la conexión al cargar el layout principal
    this.wsService.connect();
  }

  ngOnDestroy() {
    // Cerramos conexión si sale del layout (logout)
    this.wsService.disconnect();
  }
}
