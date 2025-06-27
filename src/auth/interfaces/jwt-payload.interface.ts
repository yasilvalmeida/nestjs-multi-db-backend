export interface JwtPayload {
  sub: string; // Subject (user ID)
  email: string;
  role: string;
  iat?: number; // Issued at
  exp?: number; // Expiration time
}
