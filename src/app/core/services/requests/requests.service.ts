import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http'; // Para peticiones HTTP
import { Observable } from 'rxjs';
import { ContactRequest } from '../../models/requests.model';
import { environment } from '../../../config/environment';
 // Ajusta la ruta a tu modelo

@Injectable({
  providedIn: 'root'
})
export class RequestsService {
  // La URL de tu backend (ajusta el puerto si es distinto)
  private apiUrl = environment.baseUrl+'/contacts/requests';

  constructor(private http: HttpClient) { }

  // Obtener solicitudes recibidas
  getReceivedRequests(userId: number): Observable<ContactRequest[]> {
    return this.http.get<ContactRequest[]>(`${this.apiUrl}/received/${userId}`);
  }


  /* Obtiene las solicitudes que el usuario actual ha enviado a otros.
   * Se muestran en la columna "Enviadas".
   */
  getSentRequests(userId: number): Observable<ContactRequest[]> {
    return this.http.get<ContactRequest[]>(`${this.apiUrl}/sent/${userId}`);
  }

  // Aceptar solicitud (PATCH)
  acceptRequest(contactId: number, userId: number): Observable<ContactRequest> {
    // El segundo parámetro es el cuerpo (body), lo mandamos vacío {} porque usamos @RequestParam
    return this.http.patch<ContactRequest>(`${this.apiUrl}/${contactId}/accept?userId=${userId}`, {});
  }

  // Rechazar solicitud (DELETE)
  rejectRequest(contactId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${contactId}?userId=${userId}`);
  }
}
