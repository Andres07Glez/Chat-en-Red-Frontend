// src/app/components/chat/services/chat.service.ts
import { Injectable, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { BehaviorSubject, Observable, Subscription, timer, of } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { Message } from '../../models/message.model';
import { environment } from '../../../config/environment';

@Injectable({ providedIn: 'root' })
export class ChatService implements OnDestroy {
  // base URL desde environment (http://localhost:8181)
  private apiBase = environment.baseUrl || '';
  private socket?: WebSocketSubject<any>;
  private incoming$ = new BehaviorSubject<Message | null>(null);
  private reconnectSub?: Subscription;
  private isBrowser: boolean;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // --- Backend endpoints (adaptados a MessageController.java) ---

  // Obtener lista (usa /message/app)
  getMessages(conversationId?: number, limit = 200): Observable<Message[]> {
    // Si en el futuro expones por conversación, ajusta aquí para pedir /message/byConversation/{id}
    return this.http.get<Message[]>(`${this.apiBase}/message/app`);
  }

  // Obtener por id
  getMessageById(messageId: number): Observable<Message> {
    return this.http.get<Message>(`${this.apiBase}/message/fnd?id=${messageId}`);
  }

  // Crear mensaje -> POST /message/create
  sendMessageREST(payload: Partial<Message>): Observable<any> {
    return this.http.post<any>(`${this.apiBase}/message/create`, payload);
  }

  // Borrar -> DELETE /message/del/{id}
  deleteMessage(messageId: number): Observable<any> {
    return this.http.delete(`${this.apiBase}/message/del/${messageId}`);
  }

  // Actualizar -> PUT /message/update/{id}
  updateMessage(messageId: number, payload: Partial<Message>) {
    return this.http.put(`${this.apiBase}/message/update/${messageId}`, payload);
  }

  // --- WebSocket (si tienes servidor WS) ---
  connectWebSocket(authToken?: string): Observable<Message | null> {
    if (!this.isBrowser) {
      console.warn('WebSocket no disponible en este entorno (no-browser). Usando solo REST.');
      return this.incoming$.asObservable();
    }

    if (this.socket) return this.incoming$.asObservable();

    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const tokenQuery = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
    const wsUrl = `${protocol}://${location.host}/ws${tokenQuery}`;

    try {
      this.socket = webSocket({ url: wsUrl });

      this.socket.subscribe({
        next: (msg: any) => {
          if (msg && msg.type === 'message:new') {
            this.incoming$.next(msg.payload as Message);
          } else if (msg && msg.type === 'message:update') {
            this.incoming$.next(msg.payload as Message);
          } else if (msg && msg.type === 'message:delete') {
            // podrías usar otro subject para delete events si lo necesitas
            // por ahora no hacemos nada automático aquí
          } else {
            // otros eventos (typing, presence...)
          }
        },
        error: (err) => {
          console.error('WebSocket error', err);
          this.scheduleReconnect(authToken);
        },
        complete: () => {
          console.log('WebSocket closed, scheduling reconnect...');
          this.scheduleReconnect(authToken);
        }
      });
    } catch (err) {
      console.error('No se pudo crear WebSocket', err);
    }

    return this.incoming$.asObservable();
  }

  sendViaWSOrRest(msg: Partial<Message>): Observable<any> {
    if (this.socket) {
      try {
        this.socket.next({ type: 'message:send', payload: msg });
        return of(null);
      } catch (err) {
        console.warn('Error enviando por WS, fallback a REST', err);
        return this.sendMessageREST(msg);
      }
    } else {
      return this.sendMessageREST(msg);
    }
  }

  private scheduleReconnect(authToken?: string) {
    if (this.reconnectSub && !this.reconnectSub.closed) return;
    this.reconnectSub = timer(3000).subscribe(() => {
      if (this.socket) {
        try { this.socket.complete(); } catch {}
        this.socket = undefined;
      }
      this.connectWebSocket(authToken);
    });
  }

  disconnect() {
    if (this.socket) {
      try { this.socket.complete(); } catch {}
      this.socket = undefined;
    }
    if (this.reconnectSub) {
      this.reconnectSub.unsubscribe();
      this.reconnectSub = undefined;
    }
    this.incoming$.next(null);
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
