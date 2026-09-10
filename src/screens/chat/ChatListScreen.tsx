import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import { useResponsive } from '../../hooks/useResponsive';
import { getAuthSession } from '../../services/authSession';
import {
  fetchChatThreads,
  subscribeToChatThreads,
} from '../../services/chatService';
import type { ChatThread } from '../../types/chat';
import type { AuthSession } from '../../types/session';
import type { ChatStackParamList } from '../../types/navigation';
import {
  useSnackbar,
} from '../../components/SnackbarProvider';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatList'>;

export default function ChatListScreen({ navigation }: Props) {
  const { showError } = useSnackbar();
  const { isTablet, contentMaxWidth, contentPadding } = useResponsive();
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [threads, setThreads] = useState<ChatThread[]>([]);

  const refreshThreads = useCallback(async () => {
    const currentSession = await getAuthSession();
    setSession(currentSession);

    if (!currentSession) {
      setIsLoading(false);
      return;
    }

    try {
      setThreads(await fetchChatThreads());
    } catch {
      showError(
        'No se pudieron cargar los chats. Verificá la configuración de Supabase.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;

    async function loadThreads() {
      await refreshThreads();
      const currentSession = await getAuthSession();

      if (!currentSession) {
        return;
      }

      unsubscribe = subscribeToChatThreads(
        currentSession.userId,
        nextThreads => {
          setThreads(nextThreads);
          setIsLoading(false);
        },
        () => {
          showError(
            'No se pudieron cargar los chats. Verificá la configuración de Supabase.',
          );
          setIsLoading(false);
        },
      );
    }

    loadThreads();

    return () => unsubscribe();
  }, [refreshThreads, showError]);

  useFocusEffect(
    useCallback(() => {
      refreshThreads();
    }, [refreshThreads]),
  );

  function renderThread({ item }: { item: ChatThread }) {
    const otherUserId =
      Object.entries(item.participantNames).find(([id]) => id !== session?.userId)?.[0] ?? '';
    const title =
      Object.entries(item.participantNames).find(([id]) => id !== session?.userId)?.[1] ??
      'Chat';
    const avatarUrl = otherUserId ? item.avatarUrls[otherUserId] : null;

    let subtitle = '';
    if (item.matchInfo) {
      const date = new Date(`${item.matchInfo.date}T00:00:00`);
      const formattedDate = new Intl.DateTimeFormat('es-AR', {
        day: 'numeric',
        month: 'long',
        weekday: 'long',
      }).format(date);
      const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
      subtitle = `${capitalizedDate} - ${item.matchInfo.time}hs - ${item.matchInfo.complexName}`;
    }

    return (
      <Pressable
        style={styles.threadCard}
        onPress={() =>
          navigation.navigate('ChatRoom', {
            threadId: item.id,
            title,
            subtitle,
          })
        }>
        <View style={styles.threadRow}>
          <View style={styles.avatarContainer}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <Icon name="person-circle-outline" color="#6b7280" size={44} />
            )}
          </View>
          <View style={styles.threadContent}>
            <Text style={styles.threadTitle}>{title}</Text>
            {subtitle ? (
              <Text style={styles.threadSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
            <Text style={styles.threadMessage} numberOfLines={1}>
              {item.lastMessageText || 'Sin mensajes todavía'}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#9fb629" />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <FlatList
        contentContainerStyle={[
          styles.listContent,
          isTablet && { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%', paddingHorizontal: contentPadding },
        ]}
        data={threads}
        keyExtractor={item => item.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Todavía no tenés chats</Text>
            <Text style={styles.emptyDescription}>
              Cuando participes en partidos o escribas a otro jugador, las
              conversaciones aparecerán acá.
            </Text>
          </View>
        }
        renderItem={renderThread}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  avatarContainer: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: '#252628',
    flex: 1,
  },
  emptyDescription: {
    color: '#9ca3af',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  listContent: {
    flexGrow: 1,
    padding: 16,
  },
  threadCard: {
    backgroundColor: '#1e1f20',
    borderRadius: 14,
    marginBottom: 12,
    padding: 16,
  },
  threadContent: {
    flex: 1,
  },
  threadMessage: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 3,
  },
  threadRow: {
    flexDirection: 'row',
    gap: 12,
  },
  threadSubtitle: {
    color: '#9fb629',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  threadTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
