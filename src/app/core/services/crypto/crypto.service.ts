import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {

  private myKeyPair: CryptoKeyPair | null = null;

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

    if (privB64 && pubB64) {
        const privKey = await window.crypto.subtle.importKey(
            'pkcs8',
            this.base64ToUint8Array(privB64) as BufferSource,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveKey', 'deriveBits']
        );
        const pubKey = await window.crypto.subtle.importKey(
            'spki',
            this.base64ToUint8Array(pubB64) as BufferSource,
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            []
        );
        this.myKeyPair = { privateKey: privKey, publicKey: pubKey };
    }
  }
  // === 2. LA MAGIA: DERIVAR LLAVE COMPARTIDA ===
  // Esto reemplaza a tu función 'getKey()' antigua.
  // Ahora la llave depende de CON QUIÉN hablas.
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

  // === 3. ENCRIPTAR / DESENCRIPTAR (Actualizados) ===

  // Ahora necesitamos la llave pública del destinatario para cifrar
  async encrypt(plainText: string, remotePublicKeyB64: string): Promise<{ content: string; iv: string }> {
    // Obtenemos la llave única para esta conversación
    const key = await this.deriveSharedKey(remotePublicKeyB64);

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(plainText);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encodedText
    );

    return {
      content: this.bufferToBase64(encryptedBuffer),
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
        return 'Error de llave';
    }
  }

  // --- CORRECCIÓN DE TIPOS AQUÍ ---

  // Aceptamos BufferSource (que incluye ArrayBuffer y Uint8Array)
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
