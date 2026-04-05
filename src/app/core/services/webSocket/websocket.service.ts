import { inject, Injectable } from '@angular/core';
import { RxStomp } from '@stomp/rx-stomp';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../config/environment';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService extends RxStomp {
  private authService = inject(AuthService);

  constructor() {super(); }
  // Método para iniciar la conexión
  public connect() {
    const token = this.authService.getToken(); // Obtener JWT actual

    this.configure({
      // URL del Backend. OJO: Cambia http/https por ws/wss
      brokerURL: environment.wsUrl,
      // Headers de conexión (Pasamos el token para seguridad futura)
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      // Tiempos de espera y reconexión (Vital para producción)
      heartbeatIncoming: 0,
      heartbeatOutgoing: 20000,
      reconnectDelay: 200, // Reintentar rápido si se cae
      // Depuración (puedes comentarlo en prod)
      debug: (msg: string) => {
        console.log('STOMP DEBUG:', msg);//new Date()
      }
    });

    this.activate(); // ¡Encender motores!
  }

  // Método para desconectar al cerrar sesión
  public disconnect() {
    this.deactivate();
  }

}
