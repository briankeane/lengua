import { createContext } from 'react';
import type { LoginParams, SignupParams } from '../Services/authService';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (params: LoginParams) => Promise<void>;
  signup: (params: SignupParams) => Promise<void>;
  loginWithToken: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
