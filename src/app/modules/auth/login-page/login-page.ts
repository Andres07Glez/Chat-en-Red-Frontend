import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { AuthService } from '../../../core/services/auth/auth.service';
import { Router } from '@angular/router';
import { LoginRequest, SignupRequest } from '../../../core/models/auth.models';

// Declaramos la variable global de particlesJS para que TypeScript no marque error
declare var particlesJS: any;
@Component({
  selector: 'app-login-page',
  standalone:true,
  imports: [CommonModule,ReactiveFormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage implements AfterViewInit {
  // Inyección moderna (Angular 16+) o por constructor, ambas son válidas.
  // Usaré constructor como lo tenías para no confundirte, pero mantenlo limpio.
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);

  // Formularios
  loginForm: FormGroup;
  registerForm: FormGroup;

  // Estados de la vista
  showRegisterModal: boolean = false;
  isLoading: boolean = false;

  // Mensajes
  errorMessage: string = '';
  registerError: string = '';
  registerSuccess: string = '';
  constructor() {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required]],
      remember: [false]
    });
    // Formulario de Registro
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]], // Validación de email
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngAfterViewInit() {
    // Movemos la configuración a un método privado para limpiar el ciclo de vida
    this.initParticles();
  }
  // --- LÓGICA DEL MODAL ---
  openRegisterModal() {
    this.showRegisterModal = true;
    this.registerForm.reset();
    this.registerError = '';
    this.registerSuccess = '';
  }

  closeRegisterModal() {
    this.showRegisterModal = false;
  }

  // --- LÓGICA DE LOGIN ---
  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const loginData: LoginRequest = {
      username: this.loginForm.value.username,
      password: this.loginForm.value.password
    };

    this.authService.login(loginData).subscribe({
      next: () => {
        this.router.navigate(['/app']); // Redirigir al chat
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Login error', err);
        this.errorMessage = 'Usuario o contraseña incorrectos.';
      }
    });
  }
  // --- LÓGICA DE REGISTRO ---
  onRegister() {
    console.log('1. Botón presionado');
    if (this.registerForm.invalid) {
      console.log('2. El formulario es INVÁLIDO', this.registerForm.errors); // <--- Pega esto
      Object.keys(this.registerForm.controls).forEach(key => {
        const controlErrors = this.registerForm.get(key)?.errors;
        if (controlErrors) {
          console.log('Campo fallando:', key, controlErrors);
        }
      });
      this.registerForm.markAllAsTouched();
      return;
    }
    console.log('3. Formulario válido, enviando datos...', this.registerForm.value); // <--- Pega esto

    this.isLoading = true;
    this.registerError = '';
    this.registerSuccess = '';

    const signupData: SignupRequest = {
      username: this.registerForm.value.username,
      email: this.registerForm.value.email,
      password: this.registerForm.value.password
    };

    this.authService.register(signupData).subscribe({
      next: (res) => {
        console.log('4. ÉXITO:', res); // <--- Pega esto
        this.isLoading = false;
        this.registerSuccess = '¡Cuenta creada! Ahora puedes iniciar sesión.';

        // Opcional: Cerrar modal automáticamente después de 2 segundos
        setTimeout(() => {
          this.closeRegisterModal();
          // Opcional: Autellenar el login con el usuario nuevo
          this.loginForm.patchValue({ username: signupData.username });
        }, 2000);
      },
      error: (err) => {
        console.log('4. erroror:', err); // <--- Pega esto
        this.isLoading = false;
        console.error('Register error', err);
        // El backend devuelve un mensaje de error si el usuario ya existe
        this.registerError = err.error?.error || 'Error al registrar usuario.';
      }
    });
  }

  // Configuración de partículas extraída para limpieza
  private initParticles(): void {
    if (typeof particlesJS !== 'undefined') {
      // Verificamos que el ID exista para evitar errores si cambias el HTML
      const element = document.getElementById('particles-js');
      if (!element) return;

      particlesJS('particles-js', this.getParticlesConfig());
    }
  }

  // Configuración separada (podrías incluso moverla a un archivo constants.ts)
  private getParticlesConfig(): any {
    return {
        "particles": {
            "number": { "value": 80, "density": { "enable": true, "value_area": 800 } },
            "color": { "value": "#00d4ff" },
            "shape": {
                "type": "circle",
                "stroke": { "width": 0, "color": "#000000" },
                "polygon": { "nb_sides": 5 }
            },
            "opacity": {
                "value": 0.5,
                "random": false,
                "anim": { "enable": false, "speed": 1, "opacity_min": 0.1, "sync": false }
            },
            "size": {
                "value": 3,
                "random": true,
                "anim": { "enable": false, "speed": 40, "size_min": 0.1, "sync": false }
            },
            "line_linked": {
                "enable": true,
                "distance": 150,
                "color": "#00d4ff",
                "opacity": 0.4,
                "width": 1
            },
            "move": {
                "enable": true,
                "speed": 4, // Un poco más rápido se ve mejor
                "direction": "none",
                "random": false,
                "straight": false,
                "out_mode": "out",
                "bounce": false,
                "attract": { "enable": false, "rotateX": 600, "rotateY": 1200 }
            }
        },
        "interactivity": {
            "detect_on": "window",
            "events": {
                "onhover": { "enable": true, "mode": "repulse" },
                "onclick": { "enable": true, "mode": "push" },
                "resize": true
            },
            "modes": {
                "grab": { "distance": 400, "line_linked": { "opacity": 1 } },
                "bubble": { "distance": 400, "size": 40, "duration": 2, "opacity": 8, "speed": 3 },
                "repulse": { "distance": 200, "duration": 0.4 },
                "push": { "particles_nb": 4 },
                "remove": { "particles_nb": 2 }
            }
        },
        "retina_detect": true
      };
  }
}

