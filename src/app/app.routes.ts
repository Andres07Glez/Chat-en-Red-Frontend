import { Routes } from '@angular/router';
import { LoginPage } from './modules/auth/login-page/login-page';
import { App } from './app';

export const routes: Routes = [
    // Ruta por defecto: Si la URL está vacía, redirigir al login
    { path: '', redirectTo: 'login', pathMatch: 'full' },

    // Ruta pública: Login
    { path: 'login', component: LoginPage },

    // Ruta privada: La aplicación principal (Chat)
    { path: 'app', component: App},

    // (Opcional) Wildcard: Si escriben cualquier cosa rara, mandar a login
    { path: '**', redirectTo: 'login' }
];
