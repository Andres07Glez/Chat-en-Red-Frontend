import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ContactResponse } from '../../models/Contact.interface';

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  // Asegúrate de que este puerto (8080) sea el de tu Spring Boot
  private apiUrl = 'http://localhost:8181/contact'; 

  constructor(private http: HttpClient) {}

  // Obtener la lista para la vista "Mis Contactos"
  /*getMyContacts(): Observable<ContactResponse[]> {
    return this.http.get<ContactResponse[]>(`${this.apiUrl}/app`);
  }*/

  getMyContacts(): Observable<ContactResponse[]> {
    return this.http.get<ContactResponse[]>(`${this.apiUrl}/my`);
  }

}