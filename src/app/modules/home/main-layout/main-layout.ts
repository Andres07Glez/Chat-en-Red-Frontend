import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { ChatList } from "../chat-list/chat-list";
import { ChatStateService } from '../../../core/services/chats/chat-state.service';
import { CommonModule } from '@angular/common';
import { menubar } from "../menu-bar/menu-bar";
import { ProfileSidebar } from "../profile-sidebar/profile-sidebar";
import { ChatWindow } from "../chat-window/chat-window";
import { WebsocketService } from '../../../core/services/webSocket/websocket.service';
import { UserRequestsComponent } from '../user-requests/user-requests';
import { ContactsViewComponent } from "../contacts/contacts-view/contacts-view";
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, ChatList, menubar, ProfileSidebar, ChatWindow, UserRequestsComponent, ContactsViewComponent],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.css',
})
export class MainLayout implements OnInit, OnDestroy {
  public chatState = inject(ChatStateService);
  private wsService = inject(WebsocketService);

  // En lugar de booleano, usamos el estado de la vista. Default: 'chats'
  activeView: 'chats' | 'profile' | 'requests' |'contacts' = 'chats';
  showChatPanel = false;
  private chatSub: Subscription | null = null;


  // ── Ciclo de vida ──────────────────────────────────────────────────────

  ngOnInit(): void {
    this.wsService.connect();

    // En móvil: al seleccionar un chat, mostrar automáticamente la ventana
    this.chatSub = this.chatState.selectedChat$.subscribe(chat => {
      if (chat) this.showChatPanel = true;
    });
  }

  ngOnDestroy(): void {
    this.wsService.disconnect();
    this.chatSub?.unsubscribe();
  }

  // ── Navegación de vistas ───────────────────────────────────────────────

  handleProfileToggle(isOpen: boolean): void {
    this.activeView = isOpen ? 'profile' : 'chats';
  }

  openChatList(): void {
    this.activeView   = 'chats';
    this.showChatPanel = false;
  }

  openRequests(): void {
    this.activeView   = 'requests';
    this.showChatPanel = false;
  }

  openContacts(): void {
    this.activeView   = 'contacts';
    this.showChatPanel = false;
  }

  goBackToList(): void {
    this.showChatPanel = false;
  }

}
