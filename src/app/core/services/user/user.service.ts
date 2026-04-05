import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../config/environment';
import { UserMeData, UpdateProfileRequest } from '../../models/user-me.model';
 
@Injectable({
  providedIn: 'root'
})
export class UserService {
 
  constructor() { }
  private http = inject(HttpClient);
  private baseUrl = environment.baseUrl + '/users';
 
  /** Obtiene la llave pública de otro usuario (para cifrado E2E en chat directo) */
  getPublicKey(userId: number): Observable<{ publicKey: string }> {
    return this.http.get<{ publicKey: string }>(`${this.baseUrl}/${userId}/key`);
  }
 
  /** Obtiene el perfil completo del usuario autenticado (datos reales de BD) */
  getMyProfile(): Observable<UserMeData> {
    return this.http.get<UserMeData>(`${this.baseUrl}/me`);
  }
 
  /**
   * Actualiza el perfil del usuario autenticado.
   * avatarUrl se maneja por separado (subida de archivos — pendiente).
   */
  updateMyProfile(data: UpdateProfileRequest): Observable<UserMeData> {
    return this.http.patch<UserMeData>(`${this.baseUrl}/me/profile`, data);
  }
}
