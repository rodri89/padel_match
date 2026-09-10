import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
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
import Icon from 'react-native-vector-icons/Ionicons';

import PickerField from '../../components/PickerField';
import { useResponsive } from '../../hooks/useResponsive';
import LoadingButton from '../../components/LoadingButton';
import {
  promoteUserToComplexAdmin,
  searchCommonUsers,
} from '../../services/adminService';
import {
  createComplexPost,
  getCurrentAdminComplex,
  listComplexes,
  uploadComplexPostImage,
} from '../../services/complexService';
import { getCurrentProfile } from '../../services/profileService';
import type { AdminUserSearchResult } from '../../types/admin';
import type { ComplexOption } from '../../types/complex';
import type { AppDrawerParamList } from '../../types/navigation';
import { ROLE_LABELS, type UserRole } from '../../types/profile';
import {
  getSnackbarErrorText,
  useSnackbar,
} from '../../components/SnackbarProvider';

const GENERAL_POST_VALUE = 'general';

type AdminNavigation = NativeStackNavigationProp<AppDrawerParamList>;

export default function ComplexesScreen() {
  const { showError, showSuccess } = useSnackbar();
  const navigation = useNavigation<AdminNavigation>();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { isTablet, contentMaxWidth, contentPadding } = useResponsive();
  const [adminComplexName, setAdminComplexName] = useState<string>();
  const [complexes, setComplexes] = useState<ComplexOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishingPost, setIsPublishingPost] = useState(false);
  const [isPromotingUserId, setIsPromotingUserId] = useState<string>();
  const [isSearching, setIsSearching] = useState(false);
  const [postDescription, setPostDescription] = useState('');
  const [selectedComplexId, setSelectedComplexId] = useState(GENERAL_POST_VALUE);
  const [postImage, setPostImage] = useState<{
    base64?: string;
    type?: string;
    uri: string;
  } | null>(null);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<UserRole>('usuario_comun');
  const [users, setUsers] = useState<AdminUserSearchResult[]>([]);

  useEffect(() => {
    async function loadRole() {
      try {
        const profile = await getCurrentProfile();
        setRole(profile.role);

        if (profile.role === 'admin_complejo') {
          const adminComplex = await getCurrentAdminComplex();
          setAdminComplexName(adminComplex?.name);
        } else if (profile.role === 'super_admin') {
          setComplexes(await listComplexes());
        }
      } catch (error) {
        showError(getSnackbarErrorText(error, 'No se pudo cargar el rol.'));
      } finally {
        setIsLoading(false);
      }
    }

    loadRole();
  }, [showError]);

  async function handleSearch() {
    setIsSearching(true);

    try {
      setUsers(await searchCommonUsers(query));
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudieron buscar usuarios.'));
    } finally {
      setIsSearching(false);
    }
  }

  async function handlePromoteUser(user: AdminUserSearchResult) {
    setIsPromotingUserId(user.id);

    try {
      await promoteUserToComplexAdmin(user.id);
      setUsers(current => current.filter(item => item.id !== user.id));
      showSuccess(`${user.display_name} ahora es admin complejo.`);
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo convertir el usuario.'));
    } finally {
      setIsPromotingUserId(undefined);
    }
  }

  function handleCreateComplexAdmin() {
    navigation.navigate('CreateComplexAdmin');
  }

  async function handlePickPostImage() {

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

    setPostImage({
      base64: asset.base64,
      type: asset.type,
      uri: asset.uri,
    });
  }

  async function handlePublishPost() {

    if (role === 'admin_complejo' && !adminComplexName) {
      showError('No tenés un complejo asociado para publicar.');
      return;
    }

    if (!postImage) {
      showError('Seleccioná una foto.');
      return;
    }

    if (!postDescription.trim()) {
      showError('Escribí una descripción.');
      return;
    }

    setIsPublishingPost(true);

    try {
      const imageUrl = await uploadComplexPostImage(
        postImage.uri,
        postImage.type,
        postImage.base64,
      );
      await createComplexPost({
        complexId:
          role === 'super_admin'
            ? // PickerField usa '' para su opción placeholder: si el super
              // admin la elige, se publica como novedad general en vez de
              // mandar un uuid vacío que rompe el insert.
              selectedComplexId === GENERAL_POST_VALUE || !selectedComplexId
              ? null
              : selectedComplexId
            : undefined,
        description: postDescription,
        imageUrl,
      });

      setPostDescription('');
      setPostImage(null);
      showSuccess('Publicación cargada en el inicio.');
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo cargar la publicación.'));
    } finally {
      setIsPublishingPost(false);
    }
  }

  function renderRoleContent() {
    if (role === 'super_admin') {
      return (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Administrar usuarios</Text>
            <Text style={styles.helperText}>
              Buscá usuarios comunes por nombre, teléfono o DNI y convertilos en
              admin complejo.
            </Text>

            <TextInput
              autoCapitalize="words"
              onChangeText={setQuery}
              placeholderTextColor="#9ca3af"
              placeholder="Buscar usuario común"
              style={styles.input}
              value={query}
            />

            <LoadingButton
              disabledStyle={styles.disabledButton}
              icon="search-outline"
              label="Buscar"
              loading={isSearching}
              loadingLabel="Buscando..."
              onPress={handleSearch}
              style={styles.primaryButton}
              textStyle={styles.primaryButtonText}
            />

            <View style={styles.resultsList}>
              {users.length === 0 ? (
                <Text style={styles.emptyText}>No hay usuarios para mostrar.</Text>
              ) : (
                users.map(user => (
                  <View key={user.id} style={styles.userCard}>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{user.display_name}</Text>
                      <Text style={styles.userMeta}>
                        {user.city ?? 'Sin ciudad'}
                        {user.province ? `, ${user.province}` : ''}
                      </Text>
                      <Text style={styles.userMeta}>
                        DNI: {user.dni ?? '-'} · Tel: {user.phone ?? '-'}
                      </Text>
                    </View>
                    <Pressable
                      disabled={Boolean(isPromotingUserId)}
                      onPress={() => handlePromoteUser(user)}
                      style={[
                        styles.promoteButton,
                        isPromotingUserId === user.id && styles.disabledButton,
                      ]}>
                      <Text style={styles.promoteButtonText}>
                        {isPromotingUserId === user.id
                          ? 'Convirtiendo...'
                          : 'Convertir'}
                      </Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.createAdminCard}>
            <Text style={styles.sectionTitle}>Crear nuevo complejo</Text>
            <Text style={styles.helperText}>
              Creá un usuario admin complejo nuevo y cargá los datos de su complejo.
            </Text>
            <Pressable
              onPress={handleCreateComplexAdmin}
              style={styles.primaryButton}>
              <Icon name="add-circle-outline" color="#ffffff" size={20} />
              <Text style={styles.primaryButtonText}>Crear Admin Complejo</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Publicar en inicio</Text>
            <Text style={styles.helperText}>
              Cargá una foto con descripción para mostrarla en el inicio de
              todos. Podés elegir un complejo existente o publicar una
              novedad general, sin complejo asociado.
            </Text>

            <PickerField
              enabled={!isPublishingPost}
              items={[
                { label: 'General (sin complejo)', value: GENERAL_POST_VALUE },
                ...complexes.map(complex => ({
                  label: complex.name,
                  value: complex.id,
                })),
              ]}
              onValueChange={setSelectedComplexId}
              placeholder="Seleccioná un complejo"
              selectedValue={selectedComplexId}
              style={styles.input}
            />

            <View style={styles.postImagePreview}>
              {postImage ? (
                <Image source={{ uri: postImage.uri }} style={styles.postImage} />
              ) : (
                <Text style={styles.postImagePlaceholder}>Foto de la publicación</Text>
              )}
            </View>

            <Pressable
              disabled={isPublishingPost}
              onPress={handlePickPostImage}
              style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>
                {postImage ? 'Cambiar foto' : 'Seleccionar foto'}
              </Text>
            </Pressable>

            <TextInput
              multiline
              onChangeText={setPostDescription}
              placeholder="Descripción para mostrar en el inicio"
              style={[styles.input, styles.descriptionInput]}
              textAlignVertical="top"
              value={postDescription}
            />

            <LoadingButton
              disabledStyle={styles.disabledButton}
              icon="cloud-upload-outline"
              label="Publicar en inicio"
              loading={isPublishingPost}
              loadingLabel="Publicando..."
              onPress={handlePublishPost}
              style={styles.primaryButton}
              textStyle={styles.primaryButtonText}
            />
          </View>
        </>
      );
    }

    if (role === 'admin_complejo') {
      return (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Panel de admin complejo</Text>
          <Text style={styles.helperText}>
            Cargá una foto con descripción para mostrarla en el inicio de todos.
          </Text>

          <View style={styles.complexInfoBox}>
            <Icon name="business-outline" color="#9fb629" size={20} />
            <Text style={styles.complexInfoText}>
              {adminComplexName ?? 'Sin complejo asociado'}
            </Text>
          </View>

          <View style={styles.postImagePreview}>
            {postImage ? (
              <Image source={{ uri: postImage.uri }} style={styles.postImage} />
            ) : (
              <Text style={styles.postImagePlaceholder}>Foto del complejo</Text>
            )}
          </View>

          <Pressable
            disabled={isPublishingPost}
            onPress={handlePickPostImage}
            style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>
              {postImage ? 'Cambiar foto' : 'Seleccionar foto'}
            </Text>
          </Pressable>

          <TextInput
            multiline
            onChangeText={setPostDescription}
            placeholder="Descripción para mostrar en el inicio"
            style={[styles.input, styles.descriptionInput]}
            textAlignVertical="top"
            value={postDescription}
          />

          <LoadingButton
            disabledStyle={styles.disabledButton}
            icon="cloud-upload-outline"
            label="Publicar en inicio"
            loading={isPublishingPost}
            loadingLabel="Publicando..."
            onPress={handlePublishPost}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />
        </View>
      );
    }

    if (role === 'usuario_admin') {
      return (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Panel de usuario admin</Text>
          <Text style={styles.helperText}>
            Próximamente vas a poder administrar servicios, productos, clases o
            reparaciones.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Acceso no disponible</Text>
        <Text style={styles.helperText}>
          Esta sección está disponible para usuarios administradores.
        </Text>
      </View>
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
    // Android ya achica la ventana con windowSoftInputMode="adjustResize", así
    // que ahí el behavior va en undefined para no desplazar dos veces. En iOS
    // el padding lo pone KeyboardAvoidingView compensando el header real.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 24) + 24 },
          isTablet && { paddingHorizontal: contentPadding },
        ]}
        keyboardShouldPersistTaps="handled">
        <View
          style={isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : undefined}>
          <Text style={styles.subtitle}>Rol actual: {ROLE_LABELS[role]}</Text>


          {renderRoleContent()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e1f20',
    borderColor: '#374151',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  createAdminCard: {
    backgroundColor: '#1e1f20',
    borderColor: '#7a8f20',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
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
  complexInfoBox: {
    alignItems: 'center',
    backgroundColor: '#1e1f20',
    borderColor: '#7a8f20',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  complexInfoText: {
    color: '#9fb629',
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  descriptionInput: {
    minHeight: 110,
  },
  disabledButton: {
    opacity: 0.65,
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#9fb629',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  postImage: {
    height: '100%',
    width: '100%',
  },
  postImagePlaceholder: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '700',
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
  promoteButton: {
    backgroundColor: '#9fb629',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  promoteButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  resultsList: {
    gap: 10,
    marginTop: 16,
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
  subtitle: {
    color: '#9ca3af',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  userCard: {
    alignItems: 'center',
    backgroundColor: '#252628',
    borderColor: '#374151',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  userInfo: {
    flex: 1,
  },
  userMeta: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 3,
  },
  userName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});