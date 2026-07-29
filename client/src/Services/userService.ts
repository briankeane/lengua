import apiClient from './apiClient';

export interface User {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  role: string;
}

export async function getMe(): Promise<User> {
  const response = await apiClient.get<User>('/v1/users/me');
  return response.data;
}

export async function updateUser(
  userId: string,
  params: Partial<Pick<User, 'displayName' | 'firstName' | 'lastName'>>,
): Promise<User> {
  const response = await apiClient.put<User>(`/v1/users/${userId}`, params);
  return response.data;
}
