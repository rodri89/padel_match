import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import { listAllUsers } from '../services/adminService';
import type { AdminUserListItem } from '../types/admin';
import { ROLE_LABELS } from '../types/profile';
import {
  getSnackbarErrorText,
  SnackbarHost,
  useSnackbar,
} from './SnackbarProvider';

type UsersListModalProps = {
  onClose: () => void;
  visible: boolean;
};

function formatLocation(user: AdminUserListItem) {
  if (user.city && user.province) {
    return `${user.city}, ${user.province}`;
  }

  return user.city ?? user.province ?? 'Sin ubicación';
}

export default function UsersListModal({ onClose, visible }: UsersListModalProps) {
  const { showError } = useSnackbar();
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUserListItem[]>([]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let isActive = true;

    async function loadUsers() {
      setIsLoading(true);

      try {
        const fetchedUsers = await listAllUsers();

        if (isActive) {
          setUsers(fetchedUsers);
        }
      } catch (error) {
        if (isActive) {
          showError(getSnackbarErrorText(error, 'No se pudieron cargar los jugadores.'));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      isActive = false;
    };
  }, [showError, visible]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return users;
    }

    return users.filter(
      user =>
        user.display_name.toLowerCase().includes(normalizedQuery) ||
        (user.email ?? '').toLowerCase().includes(normalizedQuery),
    );
  }, [query, users]);

  function handleClose() {
    setQuery('');
    setUsers([]);
    onClose();
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Cerrar"
          accessibilityRole="button"
          onPress={handleClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Jugadores</Text>
              <Text style={styles.count}>
                {users.length} jugador{users.length === 1 ? '' : 'es'} en total
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Cerrar listado"
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleClose}>
              <Icon color="#e2e8f0" name="close-outline" size={30} />
            </Pressable>
          </View>

          <View style={styles.searchContainer}>
            <Icon color="#6b7280" name="search-outline" size={18} />
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={setQuery}
              placeholder="Buscar por nombre o email"
              placeholderTextColor="#6b7280"
              style={styles.searchInput}
              value={query}
            />
            {query.length > 0 ? (
              <Pressable
                accessibilityLabel="Limpiar búsqueda"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setQuery('')}>
                <Icon color="#6b7280" name="close-circle" size={18} />
              </Pressable>
            ) : null}
          </View>


          {isLoading ? (
            <ActivityIndicator color="#9fb629" size="large" style={styles.loader} />
          ) : (
            <FlatList
              contentContainerStyle={styles.list}
              data={filteredUsers}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.emptyText}>No se encontraron jugadores.</Text>
              }
              renderItem={({ item }) => (
                <View style={styles.userItem}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Icon color="#9fb629" name="person-outline" size={20} />
                    </View>
                  )}
                  <View style={styles.userInfo}>
                    <Text numberOfLines={1} style={styles.userName}>
                      {item.display_name}
                    </Text>
                    <Text numberOfLines={1} style={styles.userEmail}>
                      {item.email ?? 'Sin email'}
                    </Text>
                    <Text numberOfLines={1} style={styles.userMeta}>
                      {formatLocation(item)} · {ROLE_LABELS[item.role]}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        <SnackbarHost />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#252628',
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 60,
  },
  count: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 15,
    paddingVertical: 24,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  list: {
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  loader: {
    paddingVertical: 40,
  },
  panel: {
    backgroundColor: '#1e1f20',
    borderColor: '#374151',
    borderRadius: 24,
    borderWidth: 1,
    elevation: 24,
    maxHeight: '100%',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  searchContainer: {
    alignItems: 'center',
    backgroundColor: '#252628',
    borderColor: '#4b5563',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 12,
  },
  searchInput: {
    color: '#ffffff',
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  userEmail: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 2,
  },
  userInfo: {
    flex: 1,
  },
  userItem: {
    alignItems: 'center',
    borderBottomColor: '#374151',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  userMeta: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  userName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
