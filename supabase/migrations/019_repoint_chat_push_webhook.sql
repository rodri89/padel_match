-- El webhook del push de chat apuntaba al slug legacy `super-responder`. Como
-- el CLI de Supabase despliega cada función con el nombre de su carpeta y no
-- permite usar otro slug, esa función quedaba imposible de actualizar desde el
-- repo. Ahora se despliega como `send-chat-push` y hay que repuntar el trigger.
--
-- La URL se reescribe sobre pg_get_triggerdef() en vez de recrear el trigger a
-- mano: así se preservan tal cual los headers (que incluyen la service role key)
-- sin tener que escribirlos en este archivo.
--
-- Es idempotente: si no queda ningún trigger apuntando al slug viejo, no hace
-- nada.
do $$
declare
  webhook record;
  new_definition text;
begin
  for webhook in
    select
      t.tgname,
      c.relname as table_name,
      n.nspname as schema_name,
      pg_get_triggerdef(t.oid) as definition
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and pg_get_triggerdef(t.oid) like '%/functions/v1/super-responder%'
  loop
    new_definition := replace(
      webhook.definition,
      '/functions/v1/super-responder',
      '/functions/v1/send-chat-push'
    );

    execute format(
      'drop trigger %I on %I.%I',
      webhook.tgname,
      webhook.schema_name,
      webhook.table_name
    );
    execute new_definition;

    raise notice 'Webhook % repuntado a send-chat-push', webhook.tgname;
  end loop;
end;
$$;
