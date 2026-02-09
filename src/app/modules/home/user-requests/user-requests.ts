import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Importante para *ngFor y *ngIf
import { ContactRequest } from '../../../core/models/requests.model';
import { RequestsService } from '../../../core/services/requests/requests.service';
import { AuthService } from '../../../core/services/auth/auth.service';
 // Verifica que la ruta sea correcta

@Component({
  selector: 'app-user-requests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-requests.html',
  styleUrls: ['./user-requests.css']
})
export class UserRequestsComponent implements OnInit {

  // 1. Inyectamos el servicio (estilo moderno Angular 17+)
  private authService = inject(AuthService);
  private requestsService = inject(RequestsService); // Asumo que lo tienes
  
  // 2. Declaramos las variables, pero NO las inicializamos con datos complejos aún
  currentUser: any = null;
  userId: number | null = null;
  
  // 3. Agregamos la lista para las enviadas
  receivedRequests: ContactRequest[] = [];
  sentRequests: ContactRequest[] = [];
  
 // Aseguramos que no sea undefined

  //constructor(private requestsService: RequestsService) {}

ngOnInit(): void {
    // 4. Obtenemos el usuario AQUÍ, dentro del ciclo de vida
    this.currentUser = this.authService.getUser();

    // 5. Verificamos que realmente exista para evitar errores
    if (this.currentUser && this.currentUser.id) {
      this.userId = this.currentUser.id;
      
      // Solo cargamos las solicitudes si tenemos un ID válido
      this.loadRequests(); 
    } else {
      console.error('No se encontró usuario en sesión o el objeto no tiene ID');
      // Aquí podrías redirigir al login si quieres
    }
  }

  loadRequests(): void {
    if (!this.userId) return; // Doble seguridad
    // A. Cargar Recibidas
    this.requestsService.getReceivedRequests(this.userId).subscribe({
      next: (data) => {
        this.receivedRequests = data;
      },
      error: (err) => console.error('Error al cargar recibidas', err)
    });

    // B. Cargar Enviadas (Nuevo)
    this.requestsService.getSentRequests(this.userId).subscribe({
      next: (data) => {
        this.sentRequests = data;
        console.log('Enviadas cargadas:', data); // Para depurar
      },
      error: (err) => console.error('Error al cargar enviadas', err)
    });
  }

  aceptar(requestId: number): void {
    if (!this.userId) return; // Doble seguridad
    this.requestsService.acceptRequest(requestId, this.userId).subscribe({
      next: () => {
        // Solo quitamos de recibidas, porque no puedes aceptar algo que tú enviaste
        this.receivedRequests = this.receivedRequests.filter(r => r.id !== requestId);
        // Opcional: Podrías mostrar un toast/alerta más bonito aquí
        alert('¡Solicitud aceptada!');
      },
      error: (err) => console.error('Error al aceptar', err)
    });
  }

  // Este método sirve tanto para RECHAZAR (recibida) como para CANCELAR (enviada)
  rechazar(requestId: number): void {
    if (!this.userId) return; // Doble seguridad
    if(!confirm('¿Estás seguro de querer eliminar esta solicitud?')) return;

    this.requestsService.rejectRequest(requestId, this.userId).subscribe({
      next: () => {
        // Intentamos borrar el ID de AMBAS listas.
        // Si el ID estaba en recibidas, se borra de ahí.
        // Si estaba en enviadas, se borra de allá.
        this.receivedRequests = this.receivedRequests.filter(r => r.id !== requestId);
        this.sentRequests = this.sentRequests.filter(r => r.id !== requestId);
      },
      error: (err) => console.error('Error al eliminar solicitud', err)
    });
  }
}