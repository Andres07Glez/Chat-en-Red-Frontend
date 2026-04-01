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
    try {
      // A. Verificar si ya existen llaves en el navegador
      const storedPublicKey = localStorage.getItem('my_public_key');
      let keyToUpload = storedPublicKey;

      if (!keyToUpload) {
        // CASO 1: Dispositivo nuevo o limpieza de caché -> GENERAR
        console.log(' E2E: Generando nuevas llaves...');
        keyToUpload = await this.cryptoService.generateMyKeys();
      } else {
        // CASO 2: Ya existen -> SINCRONIZAR
        // (Solo cargamos en memoria del servicio para que estén listas)
        // cryptoService.loadMyKeys() ya se llama en el constructor del servicio,
        // pero aseguramos que el servidor tenga la copia pública.
        console.log('  E2E: Sincronizando llave existente...');
      }

      // B. Subir siempre la llave pública al servidor
      // Esto arregla el problema si se borró la BD pero no el localStorage
      if (keyToUpload) {
        this.uploadPublicKey(keyToUpload).subscribe({
            next: () => console.log(' Llave pública sincronizada con el servidor'),
            error: (err) => console.error('Error subiendo llave pública', err)
        });
      }

    } catch (error) {
      console.error('Error crítico en gestión de llaves E2E', error);
    }
  }

  private uploadPublicKey(key: string): Observable<any> {
    // POST http://localhost:8181/users/keys
    // Asegúrate de que el body coincida con tu DTO Java (UserKeyRequest)
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
    // OJO: Al hacer logout, NO borramos las llaves criptográficas ('my_private_key').
    // Si las borras, el usuario perderá acceso a su historial de chats anterior.
    // Solo borramos token y datos de sesión.
    localStorage.removeItem('auth-token');
    localStorage.removeItem('auth-user');

    // Opcional: localStorage.clear() es muy agresivo, mejor borrar items específicos
    // o asegúrate de que generateMyKeys maneje bien si faltan llaves.

    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    const token = localStorage.getItem('auth-token');
    return !!token;
  }
}
