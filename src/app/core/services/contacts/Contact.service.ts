import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ContactResponse } from '../../models/Contact.interface';
import { ContactLookupResponse } from '../../models/ContactLookupResponse.interface';

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  // Asegúrate de que este puerto (8080) sea el de tu Spring Boot
  private apiUrl = 'http://localhost:8181/contacts';

  constructor(private http: HttpClient) {}

  getMyContacts(): Observable<ContactResponse[]> {
    return this.http.get<ContactResponse[]>(`${this.apiUrl}/my`);
  }

  sendContactRequest(targetUsername: string): Observable<ContactResponse> {
    const params = new HttpParams().set('username', targetUsername);
    return this.http.post<ContactResponse>(
      `${this.apiUrl}/request`,
      {},
      { params }
    );
  }

  lookupContact(username: string): Observable<ContactLookupResponse> {
    const params = new HttpParams().set('username', username);
    return this.http.get<ContactLookupResponse>(
      `${this.apiUrl}/lookup`,
      { params }
    );
  }
}
