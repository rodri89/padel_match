export type UserPostKind = 'texto' | 'venta';

export type UserPost = {
  author_id: string;
  created_at: string;
  description: string;
  id: string;
  image_url: string | null;
  is_active: boolean;
  item_name: string | null;
  kind: UserPostKind;
  price: number | null;
  updated_at: string;
};

export type UserPostRow = {
  author_id: string;
  created_at: string;
  description: string;
  id: string;
  image_url: string | null;
  item_name: string | null;
  kind: UserPostKind;
  price: number | string | null;
  profiles: {
    avatar_url: string | null;
    display_name: string | null;
  } | null;
};

export type UserHomePost = {
  authorAvatarUrl: string | null;
  authorId: string;
  authorName: string;
  createdAt: string;
  description: string;
  id: string;
  imageUrl: string | null;
  itemName: string | null;
  kind: UserPostKind;
  price: number | null;
};

export type CreateUserPostPayload = {
  description: string;
  imageUrl?: string | null;
  itemName?: string | null;
  kind: UserPostKind;
  price?: number | null;
};
