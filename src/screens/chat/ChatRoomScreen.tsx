import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useKeyboardAvoiding } from '../../hooks/useKeyboardAvoiding';
import { useResponsive } from '../../hooks/useResponsive';
import { getAuthSession } from '../../services/authSession';
import {
  fetchChatMessages,
  getThreadCounterpart,
  markThreadAsRead,
  sendChatMessage,
  subscribeToChatMessages,
} from '../../services/chatService';
import type { ChatMessage } from '../../types/chat';
import type { AuthSession } from '../../types/session';
import type { ChatStackParamList } from '../../types/navigation';
import {
  useSnackbar,
} from '../../components/SnackbarProvider';

type Props = NativeStackScreenProps<ChatStackParamList, 'ChatRoom'>;

export default function ChatRoomScreen({ navigation, route }: Props) {
  const { showError } = useSnackbar();
  const { behavior, handleLayout, keyboardVerticalOffset, wrapperRef } =
    useKeyboardAvoiding();
  const { isTablet, contentMaxWidth } = useResponsive();
  const [counterpart, setCounterpart] = useState<{
    avatarUrl: string | null;
    displayName: string;
  } | null>(null);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let isMounted = true;

    getThreadCounterpart(route.params.threadId)
      .then(result => {
        if (isMounted) {
          setCounterpart(result);
        }
      })
      // El encabezado cae al título que llegó por params si esto falla.
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [route.params.threadId]);

  useLayoutEffect(() => {
    const title = counterpart?.displayName || route.params.title || 'Chat';

    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleRow}>
          {counterpart?.avatarUrl ? (
            <Image
              source={{ uri: counterpart.avatarUrl }}
              style={styles.headerAvatar}
            />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
              <Text style={styles.headerAvatarInitial}>
                {title.trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.headerTitleTexts}>
            <Text style={styles.headerTitleText} numberOfLines={1}>
              {title}
            </Text>
            {route.params.subtitle ? (
              <Text style={styles.headerSubtitleText} numberOfLines={1}>
                {route.params.subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      ),
    });
  }, [counterpart, navigation, route.params.title, route.params.subtitle]);

  const refreshMessages = useCallback(async () => {
    const currentSession = await getAuthSession();
    setSession(currentSession);

    if (!currentSession) {
      setIsLoading(false);
      return;
    }

    try {
      setMessages(await fetchChatMessages(route.params.threadId));
      markThreadAsRead(route.params.threadId, currentSession.userId).catch(
        () => undefined,
      );
    } catch {
      showError('No se pudieron cargar los mensajes. Verificá Supabase.');
    } finally {
      setIsLoading(false);
    }
  }, [route.params.threadId, showError]);

  useEffect(() => {
    let unsubscribe: () => void = () => undefined;

    async function loadMessages() {
      await refreshMessages();

      unsubscribe = subscribeToChatMessages(
        route.params.threadId,
        nextMessages => {
          setMessages(nextMessages);
          setIsLoading(false);
        },
        () => {
          showError(
            'No se pudieron cargar los mensajes. Verificá Supabase.',
          );
          setIsLoading(false);
        },
      );

    }

    loadMessages();

    return () => unsubscribe();
  }, [refreshMessages, route.params.threadId, showError]);

  useFocusEffect(
    useCallback(() => {
      refreshMessages();
    }, [refreshMessages]),
  );

  async function handleSendMessage() {
    if (!session || !draft.trim()) {
      return;
    }

    const nextDraft = draft;
    setDraft('');

    try {
      await sendChatMessage(route.params.threadId, nextDraft, session);
    } catch {
      setDraft(nextDraft);
      showError('No se pudo enviar el mensaje.');
    }
  }

  function renderMessage({ item }: { item: ChatMessage }) {
    const isOwnMessage = item.senderId === session?.userId;

    return (
      <View
        style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}>
        <Text style={isOwnMessage ? styles.ownMessageText : styles.messageText}>
          {item.text}
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#9fb629" />
      </View>
    );
  }

  /*
   * El comportamiento frente al teclado lo decide useKeyboardAvoiding: padding
   * en iOS y en Android 15+ (edge-to-edge), nada en Android 14 o menos, donde
   * adjustResize ya achica la ventana.
   *
   * El composer no suma insets.bottom: está arriba de la barra de tabs, que ya
   * se encarga del área segura. Sumarlo dejaba un hueco muerto permanente.
   */
  return (
    <View onLayout={handleLayout} ref={wrapperRef} style={styles.container}>
      <KeyboardAvoidingView
        behavior={behavior}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={styles.container}>
        <FlatList
          contentContainerStyle={[
            styles.messageList,
            isTablet && {
              alignSelf: 'center',
              maxWidth: contentMaxWidth,
              width: '100%',
            },
          ]}
          data={messages}
          inverted
          keyExtractor={item => item.id}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Sin mensajes</Text>
              <Text style={styles.emptyDescription}>
                Escribí el primer mensaje para iniciar la conversación.
              </Text>
            </View>
          }
          renderItem={renderMessage}
          style={styles.messageFlatList}
        />

        <View style={styles.composer}>
          <TextInput
            multiline
            onChangeText={setDraft}
            placeholderTextColor="#FFF"
            placeholder="Escribí un mensaje..."
            style={styles.input}
            value={draft}
          />
          <Pressable style={styles.sendButton} onPress={handleSendMessage}>
            <Text style={styles.sendButtonText}>Enviar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  headerAvatar: {
    backgroundColor: '#374151',
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  headerAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '800',
  },
  headerSubtitleText: {
    color: '#9fb629',
    fontSize: 12,
    fontWeight: '600',
  },
  headerTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  headerTitleText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  headerTitleTexts: {
    flexShrink: 1,
  },
  composer: {
    alignItems: 'flex-end',
    backgroundColor: '#1e1f20',
    borderTopColor: '#374151',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
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
    marginTop: 80,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#252628',
    borderColor: '#4b5563',
    borderRadius: 20,
    borderWidth: 1,
    color: '#ffffff',
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubble: {
    borderRadius: 16,
    marginBottom: 10,
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageFlatList: {
    flex: 1,
  },
  messageList: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  messageText: {
    color: '#ffffff',
    fontSize: 15,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#1e1f20',
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#9fb629',
  },
  ownMessageText: {
    color: '#ffffff',
    fontSize: 15,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: '#9fb629',
    borderRadius: 20,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});