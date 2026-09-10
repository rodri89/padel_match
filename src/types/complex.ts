export type Complex = {
  address: string;
  city: string;
  created_at: string;
  email: string | null;
  facebook_url: string | null;
  id: string;
  instagram_url: string | null;
  logo_url: string | null;
  name: string;
  phone: string | null;
  province: string;
  updated_at: string;
};

export type ComplexAdmin = {
  complex_id: string;
  created_at: string;
  user_id: string;
};

export type ComplexPost = {
  admin_id: string;
  complex_id: string | null;
  created_at: string;
  description: string;
  id: string;
  image_url: string;
  is_active: boolean;
  updated_at: string;
};

export type ComplexPostWithComplexName = ComplexPost & {
  complexName: string | null;
};

export type ComplexHomePost = {
  complexId: string | null;
  complexName: string;
  createdAt: string;
  description: string;
  id: string;
  imageUrl: string;
  whatsapp: string | null;
};

export type ComplexPostRow = {
  complex_id: string | null;
  complexes?: {
    name: string;
    phone: string | null;
  } | null;
  created_at: string;
  description: string;
  id: string;
  image_url: string;
};

export type ComplexOption = {
  id: string;
  name: string;
};

export type CreateComplexAdminPayload = {
  address: string;
  city: string;
  email: string;
  facebookUrl: string | null;
  instagramUrl: string | null;
  logoUrl: string | null;
  name: string;
  password: string;
  phone: string | null;
  province: string;
};

export type CreateComplexAdminResult = {
  complexId: string;
  userId: string;
};

export type CreateComplexPostPayload = {
  complexId?: string | null;
  description: string;
  imageUrl: string;
};

export type UpdateComplexPostPayload = {
  description: string;
  imageUrl: string;
};
