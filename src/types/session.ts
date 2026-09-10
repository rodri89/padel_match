export type AuthSession = {
  token: string;
  userId: string;
  displayName: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  fullName: string;
  email: string;
  password: string;
};
