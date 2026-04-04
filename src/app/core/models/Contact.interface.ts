export interface ContactResponse {
  id: number;
  // IDs de referencia
  ownerId: number;
  contactUserId: number;
  contactStatusId: number;
  
  // DATOS VISUALES (Deben coincidir letra por letra con Java)
  contactName: string;
  contactStatusName: string; // 'En línea', 'Ocupado', etc.
  contactAvatarUrl?: string; // El signo '?' es porque puede venir null
  
  updatedAt: string;

  contactEmail: string; // <-- Agrega esto
}