import { inject, Injectable } from '@angular/core';
import { environment } from '../../../config/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChatListItem } from '../../models/chatsList.model';

@Injectable({
  providedIn: 'root'
})
export class ChatsService {

  constructor() { }
  private apiUrl = `${environment.baseUrl}/conversations`;

  private http = inject(HttpClient);

  // Obtener mis chats (El token va automático por el Interceptor)
  getMyChats(): Observable<ChatListItem[]> {
    return this.http.get<ChatListItem[]>(this.apiUrl);
  }

}
