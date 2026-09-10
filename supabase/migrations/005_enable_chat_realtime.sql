do $$
begin
  alter publication supabase_realtime add table public.chat_threads;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.chat_thread_participants;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.chat_message_reads;
exception
  when duplicate_object then null;
end;
$$;
