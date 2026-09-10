import type { UserRole } from './profile';

export type AdminUserSearchResult = {
  id: string;
  display_name: string;
  phone: string | null;
  dni: string | null;
  city: string | null;
  province: string | null;
  role: UserRole;
};

export type AdminUserListItem = {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  role: UserRole;
  city: string | null;
  province: string | null;
};
