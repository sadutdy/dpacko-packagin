export interface PublicUser {
  id: string;
  phone: string;
  email?: string;
  name: string;
  nameTa: string;
  role: string;
  status: string;
  locale: string;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface LoginResponse {
  user: PublicUser;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}
