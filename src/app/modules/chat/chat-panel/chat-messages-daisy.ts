// src/app/components/chat/chat-messages-daisy/chat-messages-daisy.ts
import {
  Component,
  Input,
  HostListener,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../core/services/chat/chat.service';
import { Subscription } from 'rxjs';

type MsgStatus = 'sent' | 'delivered' | 'seen';

interface MessageDummy {
  id: number;
  senderId: number;
  senderName: string;
  avatar: string;
  content: string;
  createdAt: string; // ISO
  status?: MsgStatus;
  attachments?: { filename: string; url: string }[];
  selected?: boolean;
}

@Component({
  selector: 'app-chat-messages-daisy',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-messages-daisy.html',
  styleUrls: ['./chat-messages-daisy.css']
})
export class ChatMessagesDaisyComponent implements OnInit, OnDestroy {
  @Input() currentUserId = 1;
  @Input() conversationId?: number;

  messages: MessageDummy[] = [];
  allSelected = false;
  private subs: Subscription[] = [];

  constructor(private chatService: ChatService) {}

  ngOnInit(): void {
    if (this.conversationId) {
      const s = this.chatService.getMessages(this.conversationId, 200).subscribe({
        next: (ms: any[]) => {
          this.messages = (ms || []).map((m: any, idx: number) => ({
            id: m.id ?? (1000 + idx),
            senderId: (m.sender && m.sender.id) ?? m.senderId ?? 2,
            senderName: (m.sender && (m.sender.username || m.sender.profile?.display_name)) ?? (m.senderName ?? (m.senderId === this.currentUserId ? 'Tú' : `User ${m.senderId}`)),
            avatar: (m.sender && m.sender.profile?.avatar_url) ?? this._avatarFor((m.sender && m.sender.id) ?? m.senderId),
            content: m.content ?? '',
            createdAt: m.createdAt ?? new Date().toISOString(),
            status: this._mapStatusFrom(m),
            attachments: (m.attachments || []).map((a: any) => ({ filename: a.filename, url: a.storage_url || a.url })),
            selected: false
          }));
        },
        error: (err) => {
          console.warn('No se pudo cargar mensajes desde API, usando datos de ejemplo.', err);
          this._loadDummyData();
        }
      });
      this.subs.push(s);
    } else {
      this._loadDummyData();
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private _avatarFor(userId: number) {
    return userId % 2 === 0
      ? 'https://img.daisyui.com/images/profile/demo/kenobee@192.webp'
      : 'https://img.daisyui.com/images/profile/demo/anakeen@192.webp';
  }

  private _mapStatusFrom(serverMsg: any): MsgStatus {
    if (serverMsg && serverMsg.status) {
      const s = String(serverMsg.status).toLowerCase();
      if (s.includes('seen') || s.includes('read')) return 'seen';
      if (s.includes('deliv')) return 'delivered';
      return 'sent';
    }
    return 'sent';
  }

  private _loadDummyData() {
    this.messages = [
      {
        id: 1,
        senderId: 2,
        senderName: 'Obi-Wan Kenobi',
        avatar: 'https://img.daisyui.com/images/profile/demo/kenobee@192.webp',
        content: 'You were the Chosen One!',
        createdAt: new Date().toISOString(),
        status: 'delivered',
        attachments: [],
        selected: false
      },
      {
        id: 2,
        senderId: 1,
        senderName: 'Tú',
        avatar: 'https://img.daisyui.com/images/profile/demo/anakeen@192.webp',
        content: 'I hate you!',
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        status: 'seen',
        attachments: [],
        selected: false
      },
      {
        id: 3,
        senderId: 2,
        senderName: 'Obi-Wan Kenobi',
        avatar: 'https://img.daisyui.com/images/profile/demo/kenobee@192.webp',
        content: 'Esto es un mensaje más largo de prueba para ver wrapping y el comportamiento de selección.',
        createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        status: 'sent',
        attachments: [{ filename: 'especificacion_v1.pdf', url: '#' }],
        selected: false
      }
    ];
  }

  isMine(m: MessageDummy) { return m.senderId === this.currentUserId; }

  toggleSelect(m: MessageDummy) { m.selected = !m.selected; this.updateAllSelectedFlag(); }

  toggleSelectAll(ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    this.messages.forEach(m => (m.selected = checked));
    this.allSelected = checked;
  }

  updateAllSelectedFlag() { this.allSelected = this.messages.length > 0 && this.messages.every(m => m.selected); }

  selectedCount() { return this.messages.filter(m => m.selected).length; }

  deleteSelected() {
    const count = this.selectedCount();
    if (count === 0) return;
    if (!confirm(`Eliminar ${count} mensaje(s)? Esto no se puede deshacer.`)) return;

    const toDelete = this.messages.filter(m => m.selected).map(m => m.id);
    toDelete.forEach((id) => {
      const sub = this.chatService.deleteMessage(id).subscribe({
        next: () => {
          this.messages = this.messages.filter(m => m.id !== id);
          this.updateAllSelectedFlag();
        },
        error: (err) => {
          console.warn(`No se pudo eliminar el mensaje ${id} en backend. Se removerá localmente.`, err);
          this.messages = this.messages.filter(m => m.id !== id);
          this.updateAllSelectedFlag();
        }
      });
      this.subs.push(sub);
    });
  }

  deleteMessage(id: number) {
    if (!confirm('Eliminar este mensaje?')) return;
    const sub = this.chatService.deleteMessage(id).subscribe({
      next: () => {
        this.messages = this.messages.filter(m => m.id !== id);
        this.updateAllSelectedFlag();
      },
      error: (err) => {
        console.warn('Error eliminando mensaje en backend, removiendo localmente.', err);
        this.messages = this.messages.filter(m => m.id !== id);
        this.updateAllSelectedFlag();
      }
    });
    this.subs.push(sub);
  }

  @HostListener('window:keydown', ['$event'])
  onDeleteKey(e: Event) {
    if (!(e instanceof KeyboardEvent)) return;
    const ke = e as KeyboardEvent;
    if (ke.key === 'Delete' || ke.key === 'Del') {
      if (this.selectedCount() > 0) {
        ke.preventDefault();
        this.deleteSelected();
      }
    }
  }

  formatTime(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
}
