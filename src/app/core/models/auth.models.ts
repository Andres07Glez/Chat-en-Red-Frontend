// Define exactamente lo que el Backend espera en el Login
export interface LoginRequest {
  username: string;
  password: string;
}

// Define lo que el Backend devuelve (JwtResponse)
export interface JwtResponse {
  token: string;
  type: string;
  id: number;
  username: string;
  email: string;
  roles?: string[];
}

// Define lo que enviamos para registrarse
export interface SignupRequest {
  username: string;
  email: string;
  password: string;
}
