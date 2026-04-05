import { inject, Injectable } from '@angular/core';
import { environment } from '../../../config/environment';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { ChatListItem } from '../../models/chatsList.model';
import { MessageResponse } from '../../models/message.model';
import { ConversationKeyResponse, CreateGroupRequest } from '../../models/group.model';

@Injectable({
  providedIn: 'root'
})
export class ChatsService {

  constructor() { }
  private apiUrl = `${environment.baseUrl}/conversations`;

  private http = inject(HttpClient);

  // Obtener mis chats (El token va automático por el Interceptor)
  getMyChats(): Observable<ChatListItem[]> {
    return this.http.get<ChatListItem[]>(this.apiUrl).pipe(
      map(data => data ?? []));
  }
  getMessages(conversationId: number): Observable<MessageResponse[]> {
    return this.http.get<MessageResponse[]>(`${environment.baseUrl}/messages/${conversationId}`);
  }
  sendMessage(request: any): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${environment.baseUrl}/messages`, request);
  }
  markAsRead(conversationId: number): Observable<void> {
    return this.http.post<void>(`${environment.baseUrl}/conversations/${conversationId}/read`, {});
  }
  startDirectConversation(targetUserId: number): Observable<ChatListItem> {
    return this.http.post<ChatListItem>(
      `${this.apiUrl}/direct?targetUserId=${targetUserId}`,
      {}
    );
  }
  createGroup(request: CreateGroupRequest): Observable<ChatListItem> {
    return this.http.post<ChatListItem>(`${this.apiUrl}/group`, request);
  }

  getMyConversationKey(conversationId: number): Observable<ConversationKeyResponse> {
    return this.http.get<ConversationKeyResponse>(`${this.apiUrl}/${conversationId}/my-key`);
  }

}
