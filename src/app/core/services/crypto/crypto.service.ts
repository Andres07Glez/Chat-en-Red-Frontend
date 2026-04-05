import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  private myKeyPair: CryptoKeyPair | null = null;
  private groupKeyCache = new Map<number, CryptoKey>();


  constructor() {
    this.assertSecureContext();
    // Intentar cargar mis llaves guardadas al iniciar
    this.loadMyKeys();
  }
  private assertSecureContext(): void {
    if (!window.isSecureContext || !window.crypto?.subtle) {
      const msg =
        'ChatEnRed requiere un Secure Context (HTTPS o localhost) para funcionar. ' +
        'Si estás en una red local, el servidor Angular debe ejecutarse con --ssl. ' +
        'Consulta la guía de despliegue LAN.';
      console.error('[CryptoService]', msg);
      // No lanzamos aquí para no romper la inicialización del servicio,
      // pero sí lo haremos en cada operación individual.
    }
  }
  private ensureSubtle(): SubtleCrypto {
    if (!window.isSecureContext || !window.crypto?.subtle) {
      throw new Error(
        'La aplicación necesita HTTPS para cifrar mensajes. ' +
        'En red local, ejecuta: ng serve --host 0.0.0.0 --ssl'
      );
    }
    return window.crypto.subtle;
  }

  // Genera mis llaves si no existen
  async generateMyKeys(): Promise<string> {
    const subtle = this.ensureSubtle();

    this.myKeyPair = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits']
    );

    const publicKeyBuffer  = await subtle.exportKey('spki', this.myKeyPair.publicKey);
    const publicKeyBase64  = this.bufferToBase64(publicKeyBuffer);
    const privateKeyBuffer = await subtle.exportKey('pkcs8', this.myKeyPair.privateKey);

    localStorage.setItem('my_private_key', this.bufferToBase64(privateKeyBuffer));
    localStorage.setItem('my_public_key',  publicKeyBase64);

    return publicKeyBase64;
  }
  private async loadMyKeys() {
    if (!window.isSecureContext || !window.crypto?.subtle) return;

    const privB64 = localStorage.getItem('my_private_key');
    const pubB64  = localStorage.getItem('my_public_key');
    if (!privB64 || !pubB64) return;

    const subtle = window.crypto.subtle;
    const privKey = await subtle.importKey(
      'pkcs8', this.base64ToUint8Array(privB64) as BufferSource,
      { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
    );
    const pubKey = await subtle.importKey(
      'spki', this.base64ToUint8Array(pubB64) as BufferSource,
      { name: 'ECDH', namedCurve: 'P-256' }, true, []
    );
    this.myKeyPair = { privateKey: privKey, publicKey: pubKey };
  }
  // ── Chats directos (ECDH compartido) ─────────────────────────────────────

  /**
   * Deriva una llave AES-256-GCM compartida usando ECDH:
   * ECDH(mi_privada, pública_remota) → misma llave en ambos extremos.
   */
  private async deriveSharedKey(remotePublicKeyB64: string): Promise<CryptoKey> {
    const subtle = this.ensureSubtle();
    if (!this.myKeyPair) throw new Error('No tengo mis propias llaves. Inicia sesión de nuevo.');

    const remotePublicKey = await subtle.importKey(
      'spki', this.base64ToUint8Array(remotePublicKeyB64) as BufferSource,
      { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );
    return subtle.deriveKey(
      { name: 'ECDH', public: remotePublicKey },
      this.myKeyPair.privateKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // Ahora necesitamos la llave pública del destinatario para cifrar
  async encrypt(plainText: string, remotePublicKeyB64: string): Promise<{ content: string; iv: string }> {
    const subtle = this.ensureSubtle();
    const key    = await this.deriveSharedKey(remotePublicKeyB64);
    const iv     = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await subtle.encrypt(
      { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plainText)
    );
    return { content: this.bufferToBase64(encrypted), iv: this.bufferToBase64(iv) };
  }

  async decrypt(cipherTextBase64: string, ivBase64: string, remotePublicKeyB64: string): Promise<string> {
    try {
      const subtle    = this.ensureSubtle();
      const key       = await this.deriveSharedKey(remotePublicKeyB64);
      const decrypted = await subtle.decrypt(
        { name: 'AES-GCM', iv: this.base64ToUint8Array(ivBase64) as BufferSource },
        key,
        this.base64ToUint8Array(cipherTextBase64) as BufferSource
      );
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Crypto: Fallo al descifrar', error);
      return '🔒 Error de llave';
    }
  }
  // ── Chats grupales (llave AES simétrica compartida) ───────────────────────
  async generateGroupKey(): Promise<{ key: CryptoKey; exportedB64: string }> {
    const subtle = this.ensureSubtle();
    const key    = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const exported = await subtle.exportKey('raw', key);
    return { key, exportedB64: this.bufferToBase64(exported) };
  }

  async encryptGroupKey(groupKeyB64: string, memberPublicKeyB64: string): Promise<{ encryptedKey: string; iv: string }> {
    const { content, iv } = await this.encrypt(groupKeyB64, memberPublicKeyB64);
    return { encryptedKey: content, iv };
  }

   async decryptGroupKey(encryptedKey: string, iv: string, creatorPublicKeyB64: string): Promise<CryptoKey> {
    const subtle      = this.ensureSubtle();
    const groupKeyB64 = await this.decrypt(encryptedKey, iv, creatorPublicKeyB64);
    const rawBytes    = this.base64ToUint8Array(groupKeyB64);
    return subtle.importKey('raw', rawBytes as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }
  async encryptWithGroupKey(plainText: string, groupKey: CryptoKey): Promise<{ content: string; iv: string }> {
    const subtle = this.ensureSubtle();
    const iv     = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await subtle.encrypt(
      { name: 'AES-GCM', iv }, groupKey, new TextEncoder().encode(plainText)
    );
    return { content: this.bufferToBase64(encrypted), iv: this.bufferToBase64(iv) };
  }

  /**
   * Descifra un mensaje de grupo con la llave AES simétrica.
   */
  async decryptWithGroupKey(cipherTextB64: string, ivB64: string, groupKey: CryptoKey): Promise<string> {
    try {
      const subtle    = this.ensureSubtle();
      const decrypted = await subtle.decrypt(
        { name: 'AES-GCM', iv: this.base64ToUint8Array(ivB64) as BufferSource },
        groupKey,
        this.base64ToUint8Array(cipherTextB64) as BufferSource
      );
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Crypto grupo: Fallo al descifrar', error);
      return 'Mensaje ilegible';
    }
  }
  storeGroupKey(conversationId: number, key: CryptoKey): void {
    this.groupKeyCache.set(conversationId, key);
  }
  getGroupKey(conversationId: number): CryptoKey | null {
    return this.groupKeyCache.get(conversationId) ?? null;
  }
  // ── Utilidad: indica si el entorno soporta cifrado ────────────────────────

  get isAvailable(): boolean {
    return window.isSecureContext && !!window.crypto?.subtle;
  }

  // ── Utilidades base64 ─────────────────────────────────────────────────────
  private bufferToBase64(buffer: BufferSource): string {
    let binary = '';
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayBuffer);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  }

}
