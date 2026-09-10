-- Migration 015: Allow authenticated users to browse all groups
-- Necesario para la funcionalidad de "Unirse a un grupo" donde los usuarios
-- deben poder ver grupos de los que aún no son miembros.

-- Política que permite a cualquier usuario autenticado leer grupos
-- (necesario para la búsqueda y descubrimiento de grupos)
create policy "authenticated users can browse groups"
on public.groups for select
to authenticated
using (true);