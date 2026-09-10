import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { useInterstitialAd } from 'react-native-google-mobile-ads';
import Icon from 'react-native-vector-icons/Ionicons';

import { useResponsive } from '../../hooks/useResponsive';
import { ADMOB_INTERSTITIAL_ID } from '../../config/admob';
import { getHomeComplexPosts } from '../../services/complexService';
import {
  createUserPost,
  deleteUserPost,
  getHomeUserPosts,
  uploadUserPostImage,
} from '../../services/userPostService';
import { getOrCreateDirectThread } from '../../services/chatService';
import {
  getSelectedCities,
  resolveActiveCities,
} from '../../services/citySettingsService';
import { navigateToChatThread } from '../../navigation/navigationService';
import { getCurrentProfile, getTotalUsersCount } from '../../services/profileService';
import type { HomeFeedItem } from '../../types/home';
import type { UserPostKind } from '../../types/userPost';
import type { UserRole } from '../../types/profile';
import AdBanner from '../../components/AdBanner';
import LoadingButton from '../../components/LoadingButton';
import UsersListModal from '../../components/UsersListModal';
import {
  getSnackbarErrorText,
  SnackbarHost,
  useSnackbar,
} from '../../components/SnackbarProvider';

function normalizeWhatsapp(value: string | null) {
  const digits = value?.replace(/\D/g, '');
  return digits && digits.length >= 8 ? digits : null;
}

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

function formatPrice(value: number) {
  return `$ ${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

// Acepta lo que la gente escribe de verdad: "12500", "12.500" o "12.500,50".
// Devuelve undefined cuando el texto no es un precio válido.
function parsePrice(value: string): number | null | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function getPostTitle(post: HomeFeedItem) {
  return post.source === 'complex' ? post.complexName : post.authorName;
}

export default function HomeScreen() {
  const { showError, showSuccess } = useSnackbar();
  const insets = useSafeAreaInsets();
  const { isTablet, contentMaxWidth, contentPadding } = useResponsive();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [posts, setPosts] = useState<HomeFeedItem[]>([]);
  const [isUsersModalVisible, setIsUsersModalVisible] = useState(false);
  const [role, setRole] = useState<UserRole>('usuario_comun');
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [selectedPost, setSelectedPost] = useState<HomeFeedItem | null>(null);
  const [totalUsers, setTotalUsers] = useState<number | null>(null);
  const [adHeight, setAdHeight] = useState(0);
  const [openingChatPostId, setOpeningChatPostId] = useState<string>();
  const [deletingPostId, setDeletingPostId] = useState<string>();

  const [isComposerMenuVisible, setIsComposerMenuVisible] = useState(false);
  const [composerKind, setComposerKind] = useState<UserPostKind | null>(null);
  const [composerDescription, setComposerDescription] = useState('');
  const [composerItemName, setComposerItemName] = useState('');
  const [composerPrice, setComposerPrice] = useState('');
  const [composerImage, setComposerImage] = useState<{
    base64?: string;
    type?: string;
    uri: string;
  } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // El hook devuelve un objeto nuevo en cada render, así que lo guardo en un ref
  // para poder usarlo desde callbacks sin recrearlos en cada render.
  const interstitial = useInterstitialAd(ADMOB_INTERSTITIAL_ID);
  const interstitialRef = useRef(interstitial);
  interstitialRef.current = interstitial;
  const shouldShowAdRef = useRef(false);

  const showInterstitialIfReady = useCallback(() => {
    if (!shouldShowAdRef.current) {
      return;
    }

    shouldShowAdRef.current = false;

    if (!interstitialRef.current.isLoaded) {
      interstitialRef.current.load();
      return;
    }

    try {
      interstitialRef.current.show();
    } catch (error) {
      console.warn('[AdMob] No se pudo mostrar el interstitial:', error);
    }
  }, []);

  useEffect(() => {
    interstitial.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interstitial.load]);

  useEffect(() => {
    if (interstitial.isClosed) {
      interstitialRef.current.load();
    }
  }, [interstitial.isClosed]);

  const loadPosts = useCallback(async () => {

    try {
      let profileCity: string | undefined;
      let isSuperAdminProfile = false;

      try {
        const profile = await getCurrentProfile();
        profileCity = profile.city ?? undefined;
        isSuperAdminProfile = profile.role === 'super_admin';
        setRole(profile.role);
        setCurrentUserId(profile.id);
      } catch {
        // Si no se puede obtener el perfil, se muestran todos los posts
      }

      // Las ciudades elegidas en Configuración mandan; sin selección se usa la
      // ciudad del perfil, como venía funcionando.
      const activeCities = resolveActiveCities(
        await getSelectedCities(),
        profileCity,
      );
      const options = { includeAllCities: isSuperAdminProfile };
      const [complexPosts, userPosts, count] = await Promise.all([
        getHomeComplexPosts(activeCities, options),
        getHomeUserPosts(activeCities, options),
        getTotalUsersCount(isSuperAdminProfile ? [] : activeCities),
      ]);

      const feed: HomeFeedItem[] = [
        ...complexPosts.map(post => ({ ...post, source: 'complex' as const })),
        ...userPosts.map(post => ({ ...post, source: 'user' as const })),
      ];

      feed.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      setPosts(feed);
      setTotalUsers(count);
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudieron cargar las novedades.'));
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadPosts();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadPosts]);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [loadPosts]),
  );

  const isSuperAdmin = role === 'super_admin';

  async function openWhatsapp(phone: string | null) {
    const whatsapp = normalizeWhatsapp(phone);

    if (!whatsapp) {
      showError('Este complejo no tiene WhatsApp disponible.');
      return;
    }

    await Linking.openURL(`https://wa.me/${whatsapp}`);
  }

  async function handleOpenChat(postId: string, authorId: string) {
    setOpeningChatPostId(postId);

    try {
      const threadId = await getOrCreateDirectThread(authorId);
      setSelectedPost(null);
      navigateToChatThread(threadId);
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo abrir el chat.'));
    } finally {
      setOpeningChatPostId(undefined);
    }
  }

  async function removeUserPost(postId: string) {
    setDeletingPostId(postId);

    try {
      await deleteUserPost(postId);
      setSelectedPost(null);
      showSuccess('Publicación eliminada.');
      await loadPosts();
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo eliminar la publicación.'));
    } finally {
      setDeletingPostId(undefined);
    }
  }

  function handleDeleteUserPost(postId: string) {
    Alert.alert(
      'Eliminar publicación',
      '¿Seguro que querés eliminarla del inicio?',
      [
        { style: 'cancel', text: 'Cancelar' },
        {
          style: 'destructive',
          text: 'Eliminar',
          onPress: () => {
            removeUserPost(postId);
          },
        },
      ],
    );
  }

  function resetComposer() {
    setComposerDescription('');
    setComposerItemName('');
    setComposerPrice('');
    setComposerImage(null);
  }

  function openComposer(kind: UserPostKind) {
    setIsComposerMenuVisible(false);
    resetComposer();
    setComposerKind(kind);
  }

  function closeComposer() {
    setComposerKind(null);
    resetComposer();
  }

  async function handlePickComposerImage() {
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

    setComposerImage({
      base64: asset.base64,
      type: asset.type,
      uri: asset.uri,
    });
  }

  async function handlePublish() {
    if (!composerKind) {
      return;
    }

    if (!composerDescription.trim()) {
      showError('Escribí una descripción.');
      return;
    }

    const isSale = composerKind === 'venta';
    let price: number | null = null;

    if (isSale) {
      if (!composerImage) {
        showError('Seleccioná una foto del artículo.');
        return;
      }

      if (!composerItemName.trim()) {
        showError('Escribí qué artículo vendés.');
        return;
      }

      const parsedPrice = parsePrice(composerPrice);

      if (parsedPrice === undefined) {
        showError('El precio no es válido.');
        return;
      }

      price = parsedPrice;
    }

    setIsPublishing(true);

    try {
      const imageUrl = composerImage
        ? await uploadUserPostImage(
          composerImage.uri,
          composerImage.type,
          composerImage.base64,
        )
        : null;

      await createUserPost({
        description: composerDescription,
        imageUrl,
        itemName: isSale ? composerItemName : null,
        kind: composerKind,
        price,
      });

      // El interstitial solo acompaña a las publicaciones de venta.
      shouldShowAdRef.current = isSale;
      closeComposer();
      showSuccess('Publicación cargada en el inicio.');
      await loadPosts();

      // En iOS hay que esperar a que el modal termine de cerrarse: el SDK busca
      // el view controller más alto pero descarta los que están en pleno cierre,
      // así que presentar durante la animación falla en silencio. Eso lo maneja
      // onDismiss, que es exclusivo de iOS.
      if (Platform.OS !== 'ios') {
        showInterstitialIfReady();
      }
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo cargar la publicación.'));
    } finally {
      setIsPublishing(false);
    }
  }

  function renderComplexCard(post: Extract<HomeFeedItem, { source: 'complex' }>) {
    // Las novedades generales del super admin no tienen complejo asociado, así
    // que no hay teléfono al que escribir.
    const whatsapp = normalizeWhatsapp(post.whatsapp);

    return (
      <Pressable
        key={post.id}
        onPress={() => setSelectedPost(post)}
        style={styles.postCard}>
        <Image
          resizeMode="contain"
          source={{ uri: post.imageUrl }}
          style={styles.postImage}
        />
        <View style={styles.postBody}>
          <Text style={styles.complexName}>{post.complexName}</Text>
          <Text numberOfLines={3} style={styles.description}>
            {post.description}
          </Text>
          {whatsapp ? (
            <Pressable
              onPress={() => openWhatsapp(post.whatsapp)}
              style={styles.whatsappButton}>
              <Icon name="logo-whatsapp" color="#ffffff" size={18} />
              <Text style={styles.whatsappButtonText}>Contactar por WhatsApp</Text>
            </Pressable>
          ) : null}
          <Text style={styles.postDate}>
            Publicado el {formatPostDate(post.createdAt)}
          </Text>
        </View>
      </Pressable>
    );
  }

  function renderUserCard(post: Extract<HomeFeedItem, { source: 'user' }>) {
    const isOwnPost = post.authorId === currentUserId;
    const canDelete = isOwnPost || isSuperAdmin;

    return (
      <Pressable
        key={post.id}
        onPress={() => setSelectedPost(post)}
        style={styles.postCard}>
        {post.imageUrl ? (
          <Image
            resizeMode="contain"
            source={{ uri: post.imageUrl }}
            style={styles.postImage}
          />
        ) : null}
        <View style={styles.postBody}>
          <View style={styles.authorRow}>
            {post.authorAvatarUrl ? (
              <Image
                source={{ uri: post.authorAvatarUrl }}
                style={styles.authorAvatar}
              />
            ) : (
              <View style={[styles.authorAvatar, styles.authorAvatarFallback]}>
                <Icon name="person-outline" color="#9ca3af" size={18} />
              </View>
            )}
            <Text numberOfLines={1} style={styles.authorName}>
              {post.authorName}
            </Text>
            {post.kind === 'venta' ? (
              <View style={styles.saleTag}>
                <Text style={styles.saleTagText}>Vende</Text>
              </View>
            ) : null}
            {canDelete ? (
              <Pressable
                accessibilityLabel="Eliminar publicación"
                accessibilityRole="button"
                disabled={deletingPostId === post.id}
                hitSlop={8}
                onPress={() => handleDeleteUserPost(post.id)}>
                <Icon name="trash-outline" color="#9ca3af" size={20} />
              </Pressable>
            ) : null}
          </View>

          {post.kind === 'venta' && post.itemName ? (
            <Text style={styles.itemName}>{post.itemName}</Text>
          ) : null}

          {post.price !== null ? (
            <Text style={styles.price}>{formatPrice(post.price)}</Text>
          ) : null}

          <Text numberOfLines={3} style={styles.description}>
            {post.description}
          </Text>

          {isOwnPost ? null : (
            <Pressable
              disabled={openingChatPostId === post.id}
              onPress={() => handleOpenChat(post.id, post.authorId)}
              style={styles.chatButton}>
              <Icon name="chatbubble-ellipses-outline" color="#ffffff" size={18} />
              <Text style={styles.whatsappButtonText}>
                {openingChatPostId === post.id ? 'Abriendo...' : 'Chatear'}
              </Text>
            </Pressable>
          )}

          <Text style={styles.postDate}>
            Publicado el {formatPostDate(post.createdAt)}
          </Text>
        </View>
      </Pressable>
    );
  }

  const isSaleComposer = composerKind === 'venta';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isTablet && { paddingHorizontal: contentPadding },
        ]}
        refreshControl={
          <RefreshControl
            colors={['#9fb629']}
            onRefresh={handleRefresh}
            refreshing={isRefreshing}
            tintColor="#9fb629"
          />
        }>
        <View
          style={isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : undefined}>
          <View style={styles.headerRow}>
            <Text style={styles.subtitle}>
              Novedades de complejos y jugadores de pádel.
            </Text>

            {totalUsers !== null && totalUsers > 0 && (
              <Pressable
                accessibilityLabel={
                  isSuperAdmin ? 'Ver todos los jugadores' : undefined
                }
                accessibilityRole={isSuperAdmin ? 'button' : undefined}
                disabled={!isSuperAdmin}
                onPress={() => setIsUsersModalVisible(true)}
                style={({ pressed }) => [
                  styles.userBadge,
                  isSuperAdmin && pressed && styles.userBadgePressed,
                ]}>
                <Icon name="people-outline" color="#ffffff" size={16} />
                <Text style={styles.userBadgeNumber}>{totalUsers.toLocaleString('es-AR')}</Text>
                {isSuperAdmin ? (
                  <Icon name="chevron-forward" color="#ffffff" size={14} />
                ) : null}
              </Pressable>
            )}
          </View>


          {isLoading ? (
            <ActivityIndicator size="large" color="#9fb629" />
          ) : posts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No hay novedades</Text>
              <Text style={styles.emptyText}>
                Publicá algo con el botón + o esperá a que los complejos suban
                sus fotos.
              </Text>
            </View>
          ) : (
            <View style={styles.postsList}>
              {posts.map(post =>
                post.source === 'complex'
                  ? renderComplexCard(post)
                  : renderUserCard(post),
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fuera del ScrollView: si va adentro queda al final del contenido y no
          se ve hasta scrollear hasta abajo del todo. Acá queda fijo justo
          arriba de la barra de tabs. */}
      <View
        onLayout={event => setAdHeight(event.nativeEvent.layout.height)}
        style={styles.adBar}>
        <AdBanner />
      </View>

      <Pressable
        accessibilityLabel="Publicar en el inicio"
        accessibilityRole="button"
        onPress={() => setIsComposerMenuVisible(true)}
        style={[
          styles.fab,
          // El banner se auto-oculta si no carga, así que el FAB sube solo lo
          // que el banner realmente ocupe.
          { bottom: (isTablet ? contentPadding : 24) + adHeight },
          isTablet && { right: contentPadding },
        ]}>
        <Icon name="add" color="#ffffff" size={32} />
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={() => setIsComposerMenuVisible(false)}
        transparent
        visible={isComposerMenuVisible}>
        <Pressable
          onPress={() => setIsComposerMenuVisible(false)}
          style={styles.modalBackdrop}>
          <Pressable
            onPress={() => undefined}
            style={[
              styles.modalPanel,
              { paddingBottom: Math.max(insets.bottom + 16, 28) },
              isTablet && { alignSelf: 'center', maxWidth: 500, width: '90%' },
            ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.sheetTitle}>Publicar en el inicio</Text>
              <Pressable
                accessibilityLabel="Cerrar menú"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setIsComposerMenuVisible(false)}>
                <Icon name="close-outline" color="#e2e8f0" size={30} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => openComposer('texto')}
              style={styles.sheetOption}>
              <Icon name="create-outline" color="#9fb629" size={24} />
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionTitle}>Escribir algo</Text>
                <Text style={styles.sheetOptionHelper}>
                  Buscá compañero, armá un partido o contá una novedad.
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => openComposer('venta')}
              style={styles.sheetOption}>
              <Icon name="pricetag-outline" color="#9fb629" size={24} />
              <View style={styles.sheetOptionText}>
                <Text style={styles.sheetOptionTitle}>Vender un artículo</Text>
                <Text style={styles.sheetOptionHelper}>
                  Subí una foto con la descripción y el precio.
                </Text>
              </View>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="slide"
        onDismiss={showInterstitialIfReady}
        onRequestClose={closeComposer}
        transparent
        visible={composerKind !== null}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalPanel,
              { paddingBottom: Math.max(insets.bottom + 16, 28) },
              isTablet && { alignSelf: 'center', maxWidth: 500, width: '90%' },
            ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.sheetTitle}>
                {isSaleComposer ? 'Vender un artículo' : 'Escribir algo'}
              </Text>
              <Pressable
                accessibilityLabel="Cerrar formulario"
                accessibilityRole="button"
                hitSlop={8}
                onPress={closeComposer}>
                <Icon name="close-outline" color="#e2e8f0" size={30} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.sheetContent}
              keyboardShouldPersistTaps="handled">
              {isSaleComposer ? (
                <>
                  <View style={styles.postImagePreview}>
                    {composerImage ? (
                      <Image
                        source={{ uri: composerImage.uri }}
                        style={styles.postImagePreviewImage}
                      />
                    ) : (
                      <Text style={styles.postImagePlaceholder}>
                        Foto del artículo
                      </Text>
                    )}
                  </View>

                  <Pressable
                    disabled={isPublishing}
                    onPress={handlePickComposerImage}
                    style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>
                      {composerImage ? 'Cambiar foto' : 'Seleccionar foto'}
                    </Text>
                  </Pressable>

                  <Text style={styles.label}>Artículo</Text>
                  <TextInput
                    autoComplete="off"
                    importantForAutofill="no"
                    onChangeText={setComposerItemName}
                    placeholder="Paleta Bullpadel Vertex"
                    placeholderTextColor="#6b7280"
                    style={styles.input}
                    textContentType="none"
                    value={composerItemName}
                  />

                  <Text style={styles.label}>Precio (opcional)</Text>
                  <TextInput
                    autoComplete="off"
                    importantForAutofill="no"
                    keyboardType="numeric"
                    onChangeText={setComposerPrice}
                    placeholder="150000"
                    placeholderTextColor="#6b7280"
                    style={styles.input}
                    textContentType="none"
                    value={composerPrice}
                  />
                </>
              ) : null}

              <Text style={styles.label}>Descripción</Text>
              {/* Sin esto el teclado ofrece autocompletar con el mail de la
                  cuenta y termina publicándose como descripción. */}
              <TextInput
                autoComplete="off"
                importantForAutofill="no"
                multiline
                onChangeText={setComposerDescription}
                textContentType="none"
                placeholder={
                  isSaleComposer
                    ? 'Contá el estado, el uso y cómo coordinar la entrega...'
                    : 'Busco compañero para torneo...'
                }
                placeholderTextColor="#6b7280"
                style={[styles.input, styles.descriptionInput]}
                textAlignVertical="top"
                value={composerDescription}
              />

              <LoadingButton
                disabledStyle={styles.disabledButton}
                icon="cloud-upload-outline"
                label="Publicar"
                loading={isPublishing}
                loadingLabel="Publicando..."
                onPress={handlePublish}
                style={styles.primaryButton}
                textStyle={styles.whatsappButtonText}
              />
            </ScrollView>
          </View>

          <SnackbarHost />
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setSelectedPost(null)}
        visible={Boolean(selectedPost)}>
        <View
          style={[
            styles.modalContainer,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              paddingTop: Math.max(insets.top, 18) + 12,
            },
          ]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedPost ? getPostTitle(selectedPost) : ''}
            </Text>
            <Pressable
              accessibilityLabel="Cerrar publicación"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setSelectedPost(null)}>
              <Icon name="close-outline" color="#e2e8f0" size={30} />
            </Pressable>
          </View>

          {selectedPost ? (
            <ScrollView contentContainerStyle={styles.modalContent}>
              {selectedPost.imageUrl ? (
                <Image
                  source={{ uri: selectedPost.imageUrl }}
                  style={styles.modalImage}
                />
              ) : null}

              {selectedPost.source === 'user' &&
                selectedPost.kind === 'venta' &&
                selectedPost.itemName ? (
                <Text style={styles.itemName}>{selectedPost.itemName}</Text>
              ) : null}

              {selectedPost.source === 'user' && selectedPost.price !== null ? (
                <Text style={styles.price}>{formatPrice(selectedPost.price)}</Text>
              ) : null}

              <Text style={styles.modalDescription}>
                {selectedPost.description}
              </Text>

              {selectedPost.source === 'complex' ? (
                normalizeWhatsapp(selectedPost.whatsapp) ? (
                  <Pressable
                    onPress={() => openWhatsapp(selectedPost.whatsapp)}
                    style={styles.whatsappButton}>
                    <Icon name="logo-whatsapp" color="#ffffff" size={18} />
                    <Text style={styles.whatsappButtonText}>Contactar por WhatsApp</Text>
                  </Pressable>
                ) : null
              ) : selectedPost.authorId === currentUserId ? null : (
                <Pressable
                  disabled={openingChatPostId === selectedPost.id}
                  onPress={() =>
                    handleOpenChat(selectedPost.id, selectedPost.authorId)
                  }
                  style={styles.chatButton}>
                  <Icon name="chatbubble-ellipses-outline" color="#ffffff" size={18} />
                  <Text style={styles.whatsappButtonText}>
                    {openingChatPostId === selectedPost.id
                      ? 'Abriendo...'
                      : 'Chatear'}
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          ) : null}
        </View>
      </Modal>

      <UsersListModal
        onClose={() => setIsUsersModalVisible(false)}
        visible={isUsersModalVisible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  adBar: {
    backgroundColor: '#252628',
    borderTopColor: '#374151',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
  },
  authorAvatar: {
    backgroundColor: '#374151',
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  authorAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: {
    color: '#ffffff',
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  authorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  userBadge: {
    alignItems: 'center',
    backgroundColor: '#9fb629',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  userBadgeNumber: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  userBadgePressed: {
    opacity: 0.7,
  },
  complexName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  container: {
    backgroundColor: '#252628',
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  description: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  descriptionInput: {
    height: 120,
    paddingTop: 14,
  },
  disabledButton: {
    opacity: 0.65,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#1e1f20',
    borderColor: '#374151',
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  fab: {
    alignItems: 'center',
    backgroundColor: '#9fb629',
    borderRadius: 30,
    bottom: 24,
    elevation: 8,
    height: 60,
    justifyContent: 'center',
    position: 'absolute',
    right: 24,
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    width: 60,
  },
  input: {
    backgroundColor: '#1e1f20',
    borderColor: '#4b5563',
    borderRadius: 12,
    borderWidth: 1,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  label: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#252628',
    flex: 1,
    paddingHorizontal: 20,
  },
  modalContent: {
    paddingBottom: 24,
  },
  modalDescription: {
    color: '#e2e8f0',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 18,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalImage: {
    backgroundColor: '#374151',
    borderRadius: 18,
    height: 340,
    marginBottom: 18,
    width: '100%',
  },
  modalPanel: {
    backgroundColor: '#1e1f20',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    padding: 24,
  },
  modalTitle: {
    color: '#ffffff',
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    marginRight: 12,
  },
  postBody: {
    padding: 16,
  },
  postCard: {
    backgroundColor: '#1e1f20',
    borderColor: '#374151',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  postImage: {
    backgroundColor: '#374151',
    height: 190,
    width: '100%',
  },
  postImagePlaceholder: {
    color: '#9ca3af',
    fontSize: 14,
  },
  postImagePreview: {
    alignItems: 'center',
    backgroundColor: '#252628',
    borderColor: '#4b5563',
    borderRadius: 12,
    borderWidth: 1,
    height: 170,
    justifyContent: 'center',
    marginBottom: 14,
    overflow: 'hidden',
  },
  postImagePreviewImage: {
    height: '100%',
    resizeMode: 'contain',
    width: '100%',
  },
  postDate: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  postsList: {
    gap: 16,
  },
  price: {
    color: '#9fb629',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#9fb629',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 15,
  },
  saleTag: {
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  saleTagText: {
    color: '#9fb629',
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#9fb629',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: '#9fb629',
    fontSize: 15,
    fontWeight: '800',
  },
  sheetContent: {
    paddingBottom: 8,
  },
  sheetOption: {
    alignItems: 'center',
    backgroundColor: '#252628',
    borderColor: '#374151',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
    padding: 16,
  },
  sheetOptionHelper: {
    color: '#9ca3af',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  sheetOptionText: {
    flex: 1,
  },
  sheetOptionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  sheetTitle: {
    color: '#ffffff',
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    marginRight: 12,
  },
  subtitle: {
    color: '#9ca3af',
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    marginRight: 12,
  },
  whatsappButton: {
    alignItems: 'center',
    backgroundColor: '#9fb629',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  whatsappButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
