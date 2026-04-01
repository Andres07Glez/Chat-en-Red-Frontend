import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../config/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor() { }
  private http = inject(HttpClient);
  private baseUrl = environment.baseUrl + '/users';

  getPublicKey(userId: number) {
    // Endpoint que definimos antes: GET /users/{id}/key
    return this.http.get<{ publicKey: string }>(`${this.baseUrl}/${userId}/key`);
  }

}
