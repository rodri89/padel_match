export type ProfileSex = 'masculino' | 'femenino';

export type PlayerPosition = 'drive' | 'reves' | 'ambos';

export type PlayerCategory = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type UserRole =
  | 'super_admin'
  | 'admin_complejo'
  | 'usuario_admin'
  | 'usuario_comun';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin_complejo: 'Admin complejo',
  super_admin: 'Super admin',
  usuario_admin: 'Usuario admin',
  usuario_comun: 'Usuario común',
};

export type UserProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  province: string | null;
  city: string | null;
  sex: ProfileSex | null;
  player_position: PlayerPosition | null;
  category: PlayerCategory | null;
  phone: string | null;
  dni: string | null;
  birth_date: string | null;
  created_at: string;
  updated_at: string | null;
};

export type ProfileUpdatePayload = {
  display_name: string;
  avatar_url?: string | null;
  province: string | null;
  city: string | null;
  sex: ProfileSex | null;
  player_position: PlayerPosition | null;
  category: PlayerCategory | null;
  phone: string | null;
  dni: string | null;
  birth_date: string | null;
};
