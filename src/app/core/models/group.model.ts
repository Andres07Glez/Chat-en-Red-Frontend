/** Llave de grupo cifrada para un miembro específico */
export interface GroupMemberKeyDTO {
  userId: number;
  encryptedKey: string;
  iv: string;
}

/** Request que se envía al backend para crear un grupo */
export interface CreateGroupRequest {
  title: string;
  members: GroupMemberKeyDTO[];
}

/** Respuesta del backend con la llave del grupo para el usuario actual */
export interface ConversationKeyResponse {
  encryptedKey: string;
  iv: string;
  /** Llave pública ECDH (base64 SPKI) del creador del grupo */
  creatorPublicKey: string;
}
