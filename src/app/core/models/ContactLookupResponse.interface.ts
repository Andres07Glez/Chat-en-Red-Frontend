export interface ContactLookupResponse {
  userExists: boolean;
  relationStatus: 'NONE' | 'PENDING' | 'ACCEPTED' | 'REMOVED';
  contactId?: number;
}
