import { Injectable, signal } from '@angular/core';
import { ChatListItem } from '../../models/chatsList.model';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatStateService {
  /** Signal reactivo con el chat activo. null = ninguno seleccionado. */
  selectedChat = signal<ChatListItem | null>(null);

  /** Observable que emite cada vez que se selecciona un chat (incluyendo null). */
  private selectedChatSource = new Subject<ChatListItem | null>();
  readonly selectedChat$ = this.selectedChatSource.asObservable();

  private refreshListSource = new Subject<void>();
  readonly refreshList$ = this.refreshListSource.asObservable();

  private drafts = new Map<number, string>();

  // ── Selección ─────────────────────────────────────────────────────────────

  selectChat(chat: ChatListItem): void {
    this.selectedChat.set(chat);
    this.selectedChatSource.next(chat);
  }

  // ── Borrador ──────────────────────────────────────────────────────────────

  setDraft(chatId: number, text: string): void {
    this.drafts.set(chatId, text);
  }

  getDraft(chatId: number): string {
    return this.drafts.get(chatId) ?? '';
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  triggerRefresh(): void {
    this.refreshListSource.next();
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  clear(): void {
    this.selectedChat.set(null);
    this.selectedChatSource.next(null);
  }
}
