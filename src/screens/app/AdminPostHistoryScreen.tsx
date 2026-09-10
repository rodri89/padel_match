import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  deleteComplexPost,
  getAllComplexPosts,
  getCurrentAdminComplexPosts,
  updateComplexPost,
  uploadComplexPostImage,
} from '../../services/complexService';
import { getCurrentProfile } from '../../services/profileService';
import LoadingButton from '../../components/LoadingButton';
import type { ComplexPostWithComplexName } from '../../types/complex';
import type { UserRole } from '../../types/profile';
import {
  getSnackbarErrorText,
  useSnackbar,
} from '../../components/SnackbarProvider';

function formatPostDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function AdminPostHistoryScreen() {
  const { showError, showSuccess } = useSnackbar();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [editingPost, setEditingPost] = useState<ComplexPostWithComplexName | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editImage, setEditImage] = useState<{
    base64?: string;
    type?: string;
    uri: string;
  } | null>(null);
  const [isDeletingPostId, setIsDeletingPostId] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [posts, setPosts] = useState<ComplexPostWithComplexName[]>([]);
  const [role, setRole] = useState<UserRole>('usuario_comun');

  const loadPosts = useCallback(async () => {

    try {
      const profile = await getCurrentProfile();
      setRole(profile.role);

      const fetchedPosts =
        profile.role === 'super_admin'
          ? await getAllComplexPosts()
          : (await getCurrentAdminComplexPosts()).map(post => ({
              ...post,
              complexName: null,
            }));
      setPosts(fetchedPosts);
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudieron cargar las publicaciones.'));
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [loadPosts]),
  );

  function handleEditPost(post: ComplexPostWithComplexName) {
    setEditingPost(post);
    setEditDescription(post.description);
    setEditImage(null);
  }

  function handleCancelEdit() {
    setEditingPost(null);
    setEditDescription('');
    setEditImage(null);
  }

  async function handlePickEditImage() {
    const result = await launchImageLibrary({
      includeBase64: true,
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });

    if (result.didCancel) {
      return;
    }

    if (result.errorMessage) {
      showError(result.errorMessage);
      return;
    }

    const asset = result.assets?.[0];

    if (!asset?.uri) {
      showError('No se pudo obtener la foto seleccionada.');
      return;
    }

    setEditImage({
      base64: asset.base64,
      type: asset.type,
      uri: asset.uri,
    });
  }

  async function handleSaveEdit() {
    if (!editingPost) {
      return;
    }

    if (!editDescription.trim()) {
      showError('Escribí una descripción.');
      return;
    }

    setIsSaving(true);

    try {
      const imageUrl = editImage
        ? await uploadComplexPostImage(editImage.uri, editImage.type, editImage.base64)
        : editingPost.image_url;

      await updateComplexPost(editingPost.id, {
        description: editDescription,
        imageUrl,
      });

      handleCancelEdit();
      await loadPosts();
      showSuccess('Publicación actualizada correctamente.');
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo actualizar la publicación.'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeletePost(post: ComplexPostWithComplexName) {
    Alert.alert(
      'Eliminar publicación',
      'Esta publicación dejará de verse en el inicio.',
      [
        { style: 'cancel', text: 'Cancelar' },
        {
          onPress: async () => {
            setIsDeletingPostId(post.id);

            try {
              await deleteComplexPost(post.id);

              if (editingPost?.id === post.id) {
                handleCancelEdit();
              }

              setPosts(current => current.filter(item => item.id !== post.id));
              showSuccess('Publicación eliminada del inicio.');
            } catch (error) {
              showError(getSnackbarErrorText(error, 'No se pudo eliminar la publicación.'));
            } finally {
              setIsDeletingPostId(undefined);
            }
          },
          style: 'destructive',
          text: 'Eliminar',
        },
      ],
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9fb629" />
      </View>
    );
  }

  return (
    // Mismo criterio que ComplexesScreen: en Android alcanza con el
    // adjustResize del manifest, en iOS el padding lo pone el KAV.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}
        keyboardShouldPersistTaps="handled">

      {editingPost ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Editar publicación</Text>
          <Text style={styles.helperText}>
            Actualizá la foto o descripción de esta publicación.
          </Text>

          <View style={styles.postImagePreview}>
            <Image
              source={{ uri: editImage?.uri ?? editingPost.image_url }}
              style={styles.postImage}
            />
          </View>

          <Pressable
            disabled={isSaving}
            onPress={handlePickEditImage}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Cambiar foto</Text>
          </Pressable>

          <TextInput
            multiline
            onChangeText={setEditDescription}
            placeholder="Descripción"
            style={[styles.input, styles.descriptionInput]}
            textAlignVertical="top"
            value={editDescription}
          />

          <LoadingButton
            disabledStyle={styles.disabledButton}
            label="Guardar cambios"
            loading={isSaving}
            loadingLabel="Guardando..."
            onPress={handleSaveEdit}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />

          <Pressable
            disabled={isSaving}
            onPress={handleCancelEdit}
            style={styles.cancelEditButton}>
            <Text style={styles.cancelEditButtonText}>Cancelar edición</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Historial de publicaciones</Text>
        <Text style={styles.helperText}>
          Editá o eliminá publicaciones para controlar qué se ve en el inicio.
        </Text>

        {posts.length === 0 ? (
          <Text style={styles.emptyText}>Todavía no hay publicaciones.</Text>
        ) : (
          <View style={styles.historyList}>
            {posts.map(post => (
              <View key={post.id} style={styles.historyPostCard}>
                <Image source={{ uri: post.image_url }} style={styles.historyPostImage} />
                <View style={styles.historyPostBody}>
                  {role === 'super_admin' ? (
                    <Text style={styles.historyPostComplex}>
                      {post.complexName ?? 'General (sin complejo)'}
                    </Text>
                  ) : null}
                  <Text numberOfLines={3} style={styles.historyPostDescription}>
                    {post.description}
                  </Text>
                  <Text style={styles.historyPostDate}>
                    Publicado el {formatPostDate(post.created_at)}
                  </Text>
                  <View style={styles.historyActions}>
                    <Pressable
                      disabled={Boolean(isDeletingPostId)}
                      onPress={() => handleEditPost(post)}
                      style={styles.editPostButton}>
                      <Text style={styles.editPostButtonText}>Editar</Text>
                    </Pressable>
                    <Pressable
                      disabled={Boolean(isDeletingPostId)}
                      onPress={() => handleDeletePost(post)}
                      style={[
                        styles.deletePostButton,
                        isDeletingPostId === post.id && styles.disabledButton,
                      ]}>
                      <Text style={styles.deletePostButtonText}>
                        {isDeletingPostId === post.id ? 'Eliminando...' : 'Eliminar'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cancelEditButton: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 10,
  },
  cancelEditButtonText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#1e1f20',
    borderColor: '#374151',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  container: {
    backgroundColor: '#252628',
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  deletePostButton: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deletePostButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  descriptionInput: {
    minHeight: 110,
  },
  disabledButton: {
    opacity: 0.65,
  },
  editPostButton: {
    backgroundColor: '#9fb629',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editPostButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
  },
  helperText: {
    color: '#9ca3af',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  historyActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  historyList: {
    gap: 12,
  },
  historyPostBody: {
    flex: 1,
  },
  historyPostCard: {
    backgroundColor: '#252628',
    borderColor: '#374151',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  historyPostComplex: {
    color: '#9fb629',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  historyPostDate: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  historyPostDescription: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
  },
  historyPostImage: {
    backgroundColor: '#374151',
    borderRadius: 10,
    height: 90,
    width: 90,
  },
  input: {
    backgroundColor: '#1e1f20',
    borderColor: '#4b5563',
    borderRadius: 12,
    borderWidth: 1,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#252628',
    flex: 1,
    justifyContent: 'center',
  },
  postImage: {
    height: '100%',
    width: '100%',
  },
  postImagePreview: {
    alignItems: 'center',
    backgroundColor: '#252628',
    borderColor: '#4b5563',
    borderRadius: 14,
    borderWidth: 1,
    height: 170,
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#9fb629',
    borderRadius: 12,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#9fb629',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: '#9fb629',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
});