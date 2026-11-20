
export type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string | null;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  refreshToken?: string | null;
}

export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterResponse {
  message?: string;
  success?: boolean;
  data?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface ApiErrorResponse {
  message?: string;
  errors?: Record<string, string[]>;
  error?: string;
}
