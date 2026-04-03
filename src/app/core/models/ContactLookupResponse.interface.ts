export interface ContactLookupResponse {
  userExists: boolean;
  isSelf: boolean;
  relationStatus: 'NONE' | 'PENDING' | 'ACCEPTED' | 'REMOVED';
  relationDirection: 'OUTGOING' | 'INCOMING' | 'NONE';
  contactId?: number;
  username?: string;
  displayName?: string;
}
