import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Usamos una señal para saber el estado actual
  currentTheme = signal<string>('dark');

  constructor() {
    // 1. Cargar preferencia guardada o detectar sistema
    const savedTheme = localStorage.getItem('chat-theme');

    if (savedTheme) {
      this.setTheme(savedTheme);
    } else {
      // Detectar preferencia del sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(prefersDark ? 'dark' : 'light');
    }
  }

  toggleTheme() {
    const newTheme = this.currentTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  private setTheme(theme: string) {
    this.currentTheme.set(theme);
    // Cambiamos el atributo data-theme en el HTML raíz
    document.documentElement.setAttribute('data-theme', theme);
    // Guardamos en local storage
    localStorage.setItem('chat-theme', theme);
  }
}
