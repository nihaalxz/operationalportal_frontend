// Auth Types — match backend LoginResponse contract exactly
export interface LoginResponse {
  id: number;
  accessToken: string;
  name: string;
  email: string;
  userType: string;
  permissions: string[];
  avatarUrl?: string | null;
}

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  userType: string;
  permissions: string[];
  avatarUrl?: string | null;
}
