import { Routes } from '@angular/router';
import { LoginPage } from './modules/auth/login-page/login-page';
import { App } from './app';
import { MainLayout } from './modules/home/main-layout/main-layout';

export const routes: Routes = [
    // Ruta por defecto: Si la URL está vacía, redirigir al login
    { path: '', redirectTo: 'login', pathMatch: 'full' },

    // Ruta pública: Login
    { path: 'login', component: LoginPage },

    // Ruta privada: La aplicación principal (Chat)
    { path: 'app', component: MainLayout},

    // (Opcional) Wildcard: Si escriben cualquier cosa rara, mandar a login
    { path: '**', redirectTo: 'login' }
];
