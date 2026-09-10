-- 021 apuntaba author_id a auth.users, que vive fuera del esquema expuesto por
-- PostgREST: por eso el embed `profiles!inner(...)` fallaba con
-- "Could not find a relationship between 'user_posts' and 'profiles'".
-- profiles.id ya referencia auth.users(id) on delete cascade, así que mover la
-- FK a public.profiles mantiene el mismo borrado en cascada y habilita el join.

alter table public.user_posts
  drop constraint if exists user_posts_author_id_fkey;

alter table public.user_posts
  add constraint user_posts_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete cascade;

notify pgrst, 'reload schema';
