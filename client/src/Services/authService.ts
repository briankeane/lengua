import apiClient from './apiClient';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    firstName: string;
    lastName: string;
    role: string;
  };
  token: string;
}

export interface SignupParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

export async function signup(params: SignupParams): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/v1/auth/signup', params);
  return response.data;
}

export async function login(params: LoginParams): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/v1/auth/login', params);
  return response.data;
}

export async function googleAuth(credential: string): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/v1/auth/google', {
    credential,
  });
  return response.data;
}
