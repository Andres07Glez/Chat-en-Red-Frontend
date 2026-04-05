import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  private myKeyPair: CryptoKeyPair | null = null;
  private groupKeyCache = new Map<number, CryptoKey>();


  constructor() {
    // Intentar cargar mis llaves guardadas al iniciar
    this.loadMyKeys();
  }

  // Genera mis llaves si no existen
  async generateMyKeys(): Promise<string> {
    // Generamos par ECDH curva P-256
    this.myKeyPair = await window.crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true, // Extraíble (para guardarla)
      ['deriveKey', 'deriveBits']
    );

    // Exportar llave pública para enviarla al servidor
    const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', this.myKeyPair.publicKey);
    const publicKeyBase64 = this.bufferToBase64(publicKeyBuffer);

    // Exportar llave privada para guardarla en LocalStorage (EN PROD: Usar IndexedDB es más seguro)
    const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', this.myKeyPair.privateKey);
    localStorage.setItem('my_private_key', this.bufferToBase64(privateKeyBuffer));
    localStorage.setItem('my_public_key', publicKeyBase64);

    return publicKeyBase64;
  }
  private async loadMyKeys() {
    const privB64 = localStorage.getItem('my_private_key');
    const pubB64 = localStorage.getItem('my_public_key');

    if (!privB64 || !pubB64) return;

    const privKey = await window.crypto.subtle.importKey(
      'pkcs8', this.base64ToUint8Array(privB64) as BufferSource,
      { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
    );
    const pubKey = await window.crypto.subtle.importKey(
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
    if (!this.myKeyPair) {
        throw new Error("No tengo mis propias llaves. Llama a generateMyKeys primero.");
    }

    // 1. Importar la llave pública del OTRO usuario
    const remotePublicKey = await window.crypto.subtle.importKey(
        'spki',
        this.base64ToUint8Array(remotePublicKeyB64) as BufferSource,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
    );

    // 2. ECDH: Mi Privada + Su Pública = Secreto Compartido
    return await window.crypto.subtle.deriveKey(
        { name: 'ECDH', public: remotePublicKey },
        this.myKeyPair.privateKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
  }

  // Ahora necesitamos la llave pública del destinatario para cifrar
  async encrypt(plainText: string, remotePublicKeyB64: string): Promise<{ content: string; iv: string }> {
    // Obtenemos la llave única para esta conversación
    const key = await this.deriveSharedKey(remotePublicKeyB64);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      new TextEncoder().encode(plainText)
    );

    return {
      content: this.bufferToBase64(encrypted),
      iv: this.bufferToBase64(iv)
    };
  }

  async decrypt(cipherTextBase64: string, ivBase64: string, remotePublicKeyB64: string): Promise<string> {
    try {
        const key = await this.deriveSharedKey(remotePublicKeyB64);
        const iv = this.base64ToUint8Array(ivBase64);
        const cipherText = this.base64ToUint8Array(cipherTextBase64);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv as BufferSource },
            key,
            cipherText as BufferSource
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
        console.error('Crypto: Fallo', error);
        return 'Prohibimos Multicuentas';
    }
  }
  // ── Chats grupales (llave AES simétrica compartida) ───────────────────────
  async generateGroupKey(): Promise<{ key: CryptoKey; exportedB64: string }> {
    const key = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
    const exported = await window.crypto.subtle.exportKey('raw', key);
    return { key, exportedB64: this.bufferToBase64(exported) };
  }

  async encryptGroupKey(
    groupKeyB64: string,
    memberPublicKeyB64: string
  ): Promise<{ encryptedKey: string; iv: string }> {
    const { content, iv } = await this.encrypt(groupKeyB64, memberPublicKeyB64);
    return { encryptedKey: content, iv };
  }

  async decryptGroupKey(
    encryptedKey: string,
    iv: string,
    creatorPublicKeyB64: string
  ): Promise<CryptoKey> {
    // 1. Descifrar: obtenemos el base64 de la llave AES raw
    const groupKeyB64 = await this.decrypt(encryptedKey, iv, creatorPublicKeyB64);
    // 2. Importar los bytes raw como CryptoKey AES-GCM
    const rawBytes = this.base64ToUint8Array(groupKeyB64);
    return window.crypto.subtle.importKey(
      'raw', rawBytes as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
  }
  async encryptWithGroupKey(
    plainText: string,
    groupKey: CryptoKey
  ): Promise<{ content: string; iv: string }> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      groupKey,
      new TextEncoder().encode(plainText)
    );
    return { content: this.bufferToBase64(encrypted), iv: this.bufferToBase64(iv) };
  }

  /**
   * Descifra un mensaje de grupo con la llave AES simétrica.
   */
  async decryptWithGroupKey(
    cipherTextB64: string,
    ivB64: string,
    groupKey: CryptoKey
  ): Promise<string> {
    try {
      const decrypted = await window.crypto.subtle.decrypt(
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



  // ── Utilidades base64 ─────────────────────────────────────────────────────
  private bufferToBase64(buffer: BufferSource): string {
    let binary = '';
    // Aseguramos trabajar con una vista de bytes
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayBuffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

}
