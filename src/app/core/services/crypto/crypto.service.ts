import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CryptoService {
  // EN DESARROLLO: Llave derivada de frase.
  // EN PRODUCCIÓN: Esto se reemplazará por Diffie-Hellman.
  private readonly SECRET_PASSPHRASE = 'mi_secreto_super_seguro_2026';

  constructor() { }

  private async getKey(): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(this.SECRET_PASSPHRASE),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: enc.encode('salt_fijo_para_pruebas'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async encrypt(plainText: string): Promise<{ content: string; iv: string }> {
    const key = await this.getKey();
    // Generamos IV de 12 bytes (Estándar GCM)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(plainText);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encodedText
    );

    return {
      content: this.bufferToBase64(encryptedBuffer),
      iv: this.bufferToBase64(iv) // Aquí estaba el error, ahora la función acepta Uint8Array
    };
  }

  async decrypt(cipherTextBase64: string, ivBase64: string): Promise<string> {
    try {
        const key = await this.getKey();
        const iv = this.base64ToUint8Array(ivBase64);
        const cipherText = this.base64ToUint8Array(cipherTextBase64);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv as BufferSource},
            key,
            // CORRECCIÓN AQUÍ: Forzamos el tipo a BufferSource
            cipherText as BufferSource
        );

        return new TextDecoder().decode(decryptedBuffer);
    } catch (error) {
        console.error('Crypto: Fallo al descifrar', error);
        return ' Mensaje cifrado (Error de llave)';
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
