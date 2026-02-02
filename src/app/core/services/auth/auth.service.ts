import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../config/environment';
import { Observable, tap } from 'rxjs';
import { JwtResponse, LoginRequest, SignupRequest } from '../../models/auth.models';

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl=environment.baseUrl+'/auth/'; //  baseUrl: 'http://localhost:8181'

  private http = inject(HttpClient);

  constructor() { }

  // --- 1. LOGIN ---
  login(credentials: LoginRequest): Observable<JwtResponse> {
    return this.http.post<JwtResponse>(this.baseUrl + 'login',
      credentials,
      httpOptions
    ).pipe(
      // Efecto secundario: Si el login es exitoso, guardamos el token
      tap((response) => {
        if (response.token) {
          this.saveToken(response.token);
          this.saveUser(response);
        }
      })
    );
  }

  // --- 2. REGISTRO ---
  register(user: SignupRequest): Observable<any> {
    return this.http.post(this.baseUrl + 'signup',
      user,
      httpOptions
    );
  }

  // --- 3. GESTIÓN DEL TOKEN ---
  saveToken(token: string): void {
    localStorage.setItem('auth-token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('auth-token');
  }

  saveUser(user: any): void {
    // Guardamos datos básicos (menos el token que ya guardamos aparte)
    localStorage.setItem('auth-user', JSON.stringify(user));
  }

  getUser(): any {
    const user = localStorage.getItem('auth-user');
    return user ? JSON.parse(user) : null;
  }

  logout(): void {
    localStorage.clear();
    // Aquí podrías redirigir al login
    window.location.reload();
  }

  isLoggedIn(): boolean {
    const token = localStorage.getItem('auth-token');
    return !!token; // Retorna true si existe, false si no
  }
}
