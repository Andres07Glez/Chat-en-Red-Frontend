import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../config/environment';
import { Observable, tap } from 'rxjs';
import { JwtResponse, LoginRequest, SignupRequest } from '../../models/auth.models';
import { Router } from '@angular/router';
import { CryptoService } from '../crypto/crypto.service';

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Nota: baseUrl apunta a /auth/, pero para usuarios usaremos una ruta distinta
  private authUrl = environment.baseUrl + '/auth/';
  private usersUrl = environment.baseUrl + '/users/'; // <--- Nueva ruta base

  private http = inject(HttpClient);
  private router = inject(Router);
  private cryptoService = inject(CryptoService); // <--- 2. INYECTAR

  constructor() { }

  // --- 1. LOGIN ---
  login(credentials: LoginRequest): Observable<JwtResponse> {
    return this.http.post<JwtResponse>(this.authUrl + 'login',
      credentials,
      httpOptions
    ).pipe(
      tap(async (response) => { // <--- Convertimos callback a async
        if (response.token) {
          this.saveToken(response.token);
          this.saveUser(response);

          // 3. GESTIÓN DE LLAVES (Disparamos la lógica E2E)
          await this.manageE2EKeys();
        }
      })
    );
  }

  // --- 2. REGISTRO ---
  register(user: SignupRequest): Observable<any> {
    return this.http.post(this.authUrl + 'signup',
      user,
      httpOptions
    );
  }

  // --- 3. LÓGICA E2E (NUEVO) ---
  private async manageE2EKeys() {
    // Verificar Secure Context antes de intentar cualquier operación criptográfica
    if (!this.cryptoService.isAvailable) {
      const msg =
        '⚠️ Advertencia de seguridad\n\n' +
        'El cifrado E2E no está disponible porque la aplicación se está\n' +
        'ejecutando sobre HTTP en una red local.\n\n' +
        'Para habilitarlo, el servidor debe ejecutarse con:\n' +
        '  ng serve --host 0.0.0.0 --ssl\n\n' +
        'Sin cifrado los mensajes no podrán enviarse correctamente.';
      console.error('[AuthService] Secure Context no disponible:', window.location.href);
      alert(msg);
      return;
    }

    try {
      const storedPublicKey = localStorage.getItem('my_public_key');

      let keyToUpload: string;

      if (!storedPublicKey) {
        console.log('[E2E] Generando nuevas llaves...');
        keyToUpload = await this.cryptoService.generateMyKeys();
      } else {
        console.log('[E2E] Sincronizando llave existente...');
        keyToUpload = storedPublicKey;
      }

      this.uploadPublicKey(keyToUpload).subscribe({
        next: () => console.log('[E2E] Llave pública sincronizada con el servidor'),
        error: (err) => console.error('[E2E] Error subiendo llave pública', err)
      });

    } catch (error) {
      console.error('[E2E] Error crítico en gestión de llaves:', error);
      alert(
        'Error al configurar el cifrado. Cierra sesión y vuelve a intentarlo.\n' +
        'Si el problema persiste, borra el caché del navegador.'
      );
    }
  }

  private uploadPublicKey(key: string): Observable<any> {
    // POST http://localhost:8181/users/keys
    return this.http.post(this.usersUrl + 'keys', { publicKey: key });
  }

  // --- 4. GESTIÓN DEL TOKEN (Igual que antes) ---
  saveToken(token: string): void {
    localStorage.setItem('auth-token', token);
  }

  getToken(): string | null {
    return localStorage.getItem('auth-token');
  }

  saveUser(user: any): void {
    localStorage.setItem('auth-user', JSON.stringify(user));
  }

  getUser(): any {
    const user = localStorage.getItem('auth-user');
    return user ? JSON.parse(user) : null;
  }

  logout(): void {
    // Las llaves E2E no se borran: si se borran, el usuario pierde
    // acceso a su historial de mensajes cifrados.
    localStorage.removeItem('auth-token');
    localStorage.removeItem('auth-user');
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('auth-token');
  }
}
