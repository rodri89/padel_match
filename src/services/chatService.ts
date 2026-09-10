import type {
  ChatMessage,
  ChatThread,
  CreateChatThreadInput,
} from '../types/chat';
import type { AuthSession } from '../types/session';
import { getAuthSession } from './authSession';
import { getSupabaseClient } from './supabaseClient';

type Unsubscribe = () => void;

type ChatParticipantRow = {
  display_name: string;
  user_id: string;
};

type ChatThreadRow = {
  chat_thread_participants?: ChatParticipantRow[];
  context_id?: string | null;
  context_type: ChatThread['contextType'];
  id: string;
  last_message_at?: string | null;
  last_message_text?: string | null;
  updated_at?: string | null;
};

type MatchInfoRow = {
  complex_name: string;
  match_date: string;
  start_time: string;
};

type ChatReadRow = {
  user_id: string;
};

type ChatMessageRow = {
  chat_message_reads?: ChatReadRow[];
  created_at?: string | null;
  id: string;
  sender_id: string;
  text: string;
};

function dateFromIso(value?: string | null) {
  return value ? new Date(value) : undefined;
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

function mapThread(
  row: ChatThreadRow,
  avatarUrlMap: Record<string, string | null>,
): ChatThread {
  const participants = row.chat_thread_participants ?? [];

  return {
    avatarUrls: participants.reduce<Record<string, string | null>>(
      (urls, participant) => ({
        ...urls,
        [participant.user_id]: avatarUrlMap[participant.user_id] ?? null,
      }),
      {},
    ),
    contextId: row.context_id ?? undefined,
    contextType: row.context_type,
    id: row.id,
    lastMessageAt: dateFromIso(row.last_message_at),
    lastMessageText: row.last_message_text ?? undefined,
    participantIds: participants.map(participant => participant.user_id),
    participantNames: participants.reduce<Record<string, string>>(
      (names, participant) => ({
        ...names,
        [participant.user_id]: participant.display_name,
      }),
      {},
    ),
    updatedAt: dateFromIso(row.updated_at),
  };
}

function mapMessage(row: ChatMessageRow): ChatMessage {
  return {
    createdAt: dateFromIso(row.created_at),
    id: row.id,
    readBy: row.chat_message_reads?.map(read => read.user_id) ?? [],
    senderId: row.sender_id,
    text: row.text,
  };
}

async function getAvatarUrlMap(userIds: string[]) {
  if (userIds.length === 0) {
    return {};
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, avatar_url')
    .in('id', userIds)
    .returns<{ id: string; avatar_url: string | null }[]>();

  if (error) {
    return {};
  }

  const map: Record<string, string | null> = {};
  for (const profile of data ?? []) {
    map[profile.id] = profile.avatar_url;
  }

  return map;
}

export async function fetchChatThreads() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('chat_threads')
    .select(
      'id, context_type, context_id, last_message_text, last_message_at, updated_at, chat_thread_participants(user_id, display_name)',
    )
    // Tocar "Chatear" crea el hilo aunque nunca se escriba nada, y ese hilo
    // vacío le aparecía a la otra persona como un chat que nunca abrió. Hasta
    // que haya un primer mensaje, la conversación no se lista.
    .not('last_message_at', 'is', null)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ChatThreadRow[];

  // Collect all participant userIds to fetch avatar URLs
  const allUserIds = [
    ...new Set(
      rows.flatMap(row =>
        row.chat_thread_participants?.map(p => p.user_id) ?? [],
      ),
    ),
  ];

  const avatarUrlMap = await getAvatarUrlMap(allUserIds);

  const threads = rows.map(row => mapThread(row, avatarUrlMap));

  // Fetch match info for threads that have a match context
  const matchContextThreads = threads.filter(
    t => t.contextType === 'match' && t.contextId,
  );

  if (matchContextThreads.length > 0) {
    const matchIds = matchContextThreads
      .map(t => t.contextId!)
      .filter((id): id is string => Boolean(id));

    if (matchIds.length > 0) {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('id, complex_name, match_date, start_time')
        .in('id', matchIds);

      if (!matchError && matchData) {
        const matchMap = new Map<string, MatchInfoRow>(
          (matchData as (MatchInfoRow & { id: string })[]).map(row => [
            row.id,
            row,
          ]),
        );

        for (const thread of threads) {
          if (thread.contextType === 'match' && thread.contextId) {
            const matchInfo = matchMap.get(thread.contextId);
            if (matchInfo) {
              thread.matchInfo = {
                complexName: matchInfo.complex_name,
                date: matchInfo.match_date,
                time: normalizeTime(matchInfo.start_time),
              };
            }
          }
        }
      }
    }
  }

  return threads;
}

export async function fetchChatMessages(threadId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender_id, text, created_at, chat_message_reads(user_id)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return (data ?? []).map(row => mapMessage(row as ChatMessageRow));
}

export function subscribeToChatThreads(
  userId: string,
  onNext: (threads: ChatThread[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  async function refetch() {
    try {
      onNext(await fetchChatThreads());
    } catch (error) {
      onError?.(error as Error);
    }
  }

  try {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`chat_threads:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_threads' },
        refetch,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_thread_participants' },
        refetch,
      )
      .subscribe();

    refetch();

    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  } catch (error) {
    onError?.(error as Error);
    return () => undefined;
  }
}

export function subscribeToChatMessages(
  threadId: string,
  onNext: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  async function refetch() {
    try {
      onNext(await fetchChatMessages(threadId));
    } catch (error) {
      onError?.(error as Error);
    }
  }

  try {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`chat_messages:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          filter: `thread_id=eq.${threadId}`,
          schema: 'public',
          table: 'chat_messages',
        },
        refetch,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_message_reads' },
        refetch,
      )
      .subscribe();

    refetch();

    return () => {
      supabase.removeChannel(channel).catch(() => undefined);
    };
  } catch (error) {
    onError?.(error as Error);
    return () => undefined;
  }
}

export async function createChatThread(input: CreateChatThreadInput) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('create_chat_thread', {
    input_context_id: input.contextId ?? null,
    input_context_type: input.contextType,
    input_participants: input.participantNames,
  });

  if (error) {
    throw error;
  }

  return data as string;
}

/**
 * Datos del otro participante de un chat, para el encabezado del ChatRoom.
 * El nombre sale de `profiles` y no del `display_name` desnormalizado en
 * `chat_thread_participants`, que queda viejo si la persona lo cambia.
 */
export async function getThreadCounterpart(threadId: string) {
  const session = await getAuthSession();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('chat_thread_participants')
    .select('user_id, display_name')
    .eq('thread_id', threadId)
    .returns<{ user_id: string; display_name: string }[]>();

  if (error) {
    throw error;
  }

  const participants = data ?? [];
  const other =
    participants.find(participant => participant.user_id !== session?.userId) ??
    participants[0];

  if (!other) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', other.user_id)
    .maybeSingle<{ display_name: string | null; avatar_url: string | null }>();

  return {
    avatarUrl: profile?.avatar_url ?? null,
    displayName: profile?.display_name || other.display_name || 'Usuario',
    userId: other.user_id,
  };
}

export async function getOrCreateDirectThread(otherUserId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_or_create_direct_thread', {
    other_user_id: otherUserId,
  });

  if (error) {
    throw error;
  }

  return data as string;
}

export async function sendChatMessage(
  threadId: string,
  text: string,
  sender: AuthSession,
) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('chat_messages').insert({
    sender_id: sender.userId,
    thread_id: threadId,
    text: trimmedText,
  });

  if (error) {
    throw error;
  }
}

export async function markThreadAsRead(threadId: string, userId: string) {
  const supabase = getSupabaseClient();
  const { data: messages, error: messagesError } = await supabase
    .from('chat_messages')
    .select('id')
    .eq('thread_id', threadId)
    .limit(50);

  if (messagesError) {
    throw messagesError;
  }

  const reads = (messages ?? []).map(message => ({
    message_id: message.id,
    user_id: userId,
  }));

  if (!reads.length) {
    return;
  }

  const { error } = await supabase.from('chat_message_reads').upsert(reads, {
    onConflict: 'message_id,user_id',
  });

  if (error) {
    throw error;
  }
}