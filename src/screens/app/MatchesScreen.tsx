import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
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
import Icon from 'react-native-vector-icons/Ionicons';
import { useInterstitialAd } from 'react-native-google-mobile-ads';

import { useResponsive } from '../../hooks/useResponsive';
import LoadingButton from '../../components/LoadingButton';
import SuccessModal from '../../components/SuccessModal';
import {
  getSnackbarErrorText,
  SnackbarHost,
  useSnackbar,
} from '../../components/SnackbarProvider';
import MatchCard from '../../components/MatchCard';
import { navigateToChatThread } from '../../navigation/navigationService';
import type { AppTabParamList } from '../../types/navigation';
import { getCurrentAdminComplex } from '../../services/complexService';
import {
  cancelMatch,
  completeMatch,
  confirmMatchRequest,
  createMatch,
  getVisibleMatches,
  rejectMatchRequest,
  requestToPlay,
} from '../../services/matchService';
import { getCurrentProfile } from '../../services/profileService';
import type {
  CreateMatchPayload,
  Match,
  MatchRequest,
} from '../../types/match';
import { MATCH_CATEGORY_OPTIONS, MATCH_TYPE_OPTIONS } from '../../types/match';
import type { MatchType } from '../../types/match';
import type { PlayerCategory, UserRole } from '../../types/profile';
import { ADMOB_INTERSTITIAL_ID } from '../../config/admob';

type FormState = {
  complexName: string;
  matchDate: string;
  matchType: MatchType;
  missingPlayers: string;
  startTime: string;
  targetCategories: PlayerCategory[];
};

type MatchFilter = 'all' | 'preferred' | 'mine' | 'completed' | 'pending';

const EMPTY_FORM: FormState = {
  complexName: '',
  matchDate: '',
  matchType: 'libre',
  missingPlayers: '',
  startTime: '',
  targetCategories: [],
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const CHAT_AD_TIMEOUT_MS = 6000;
const MISSING_PLAYERS_OPTIONS = ['1', '2', '3', '4'];
const MATCH_FILTERS: Array<{ label: string; value: MatchFilter }> = [
  { label: 'Ver todo', value: 'all' },
  { label: 'Mis preferencias', value: 'preferred' },
  { label: 'Mis partidos', value: 'mine' },
  { label: 'Partidos completados', value: 'completed' },
  { label: 'Partidos pendientes', value: 'pending' },
];

function padNumber(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function formatTimeValue(date: Date) {
  return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function getDatePickerValue(value: string) {
  return isValidDate(value) ? new Date(`${value}T00:00:00`) : new Date();
}

function getTimePickerValue(value: string) {
  const date = new Date();

  if (TIME_PATTERN.test(value)) {
    const [hours, minutes] = value.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
  }

  return date;
}

function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<AppTabParamList, 'Matches'>>();
  const focusedMatchId = route.params?.focusedMatchId;
  const scrollRef = useRef<ScrollView>(null);
  const layoutYRef = useRef<Map<string, number>>(new Map());
  const [hasScrolledToFocused, setHasScrolledToFocused] = useState(false);
  const [adminComplexName, setAdminComplexName] = useState<string>();
  const [busyMatchId, setBusyMatchId] = useState<string>();
  const [creatorRole, setCreatorRole] = useState<UserRole>('usuario_comun');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all');
  const [matches, setMatches] = useState<Match[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date>();
  const [createdMatchWarning, setCreatedMatchWarning] = useState<string | null>(null);
  const [isCreatedModalVisible, setIsCreatedModalVisible] = useState(false);

  const { showError, showSuccess } = useSnackbar();
  const interstitial = useInterstitialAd(ADMOB_INTERSTITIAL_ID);

  // El hook devuelve un objeto nuevo en cada render, así que lo guardo en un ref
  // para poder usarlo desde callbacks sin recrearlos en cada render.
  const interstitialRef = useRef(interstitial);
  interstitialRef.current = interstitial;

  const pendingChatThreadRef = useRef<string | null>(null);
  const chatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isTablet, contentMaxWidth, contentPadding } = useResponsive();

  // Auto-scroll to the focused match when data is loaded
  useEffect(() => {
    if (!focusedMatchId || isLoading || hasScrolledToFocused) {
      return;
    }

    const matchIndex = matches.findIndex(match => match.id === focusedMatchId);

    if (matchIndex < 0) {
      return;
    }

    const layoutY = layoutYRef.current.get(focusedMatchId);

    if (layoutY === undefined) {
      return;
    }

    // Small delay to ensure layout is complete
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: layoutY - 120, animated: true });
      setHasScrolledToFocused(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [focusedMatchId, hasScrolledToFocused, isLoading, matches]);

  const loadMatches = useCallback(async () => {
    try {
      setMatches(
        await getVisibleMatches(matchFilter === 'preferred' ? 'preferred' : 'all'),
      );
      setUpdatedAt(new Date());
    } catch (error) {
      showError(
        getSnackbarErrorText(error, 'No se pudieron cargar los partidos.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [matchFilter, showError]);

  const refreshMatches = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadMatches();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadMatches]);

  const loadCreatorDefaults = useCallback(async () => {
    try {
      const profile = await getCurrentProfile();
      setCreatorRole(profile.role);

      if (profile.role === 'admin_complejo') {
        const adminComplex = await getCurrentAdminComplex();
        setAdminComplexName(adminComplex?.name);
      } else {
        setAdminComplexName(undefined);
      }
    } catch {
      setCreatorRole('usuario_comun');
      setAdminComplexName(undefined);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMatches();
      loadCreatorDefaults();
    }, [loadCreatorDefaults, loadMatches]),
  );

  // El anuncio nunca bloquea la acción: se muestra sólo si ya está cargado.
  // Antes la creación del partido esperaba a que el interstitial se cerrara, y
  // como el hook nunca reporta `isLoaded`/`isClosed` cuando el anuncio falla
  // (no-fill, habitual en un dispositivo físico), la acción no se ejecutaba
  // nunca y la pantalla quedaba colgada.
  const showInterstitialIfReady = useCallback(() => {
    if (!interstitialRef.current.isLoaded) {
      console.log('[AdMob] Interstitial todavía no cargado: se saltea y se precarga.');
      interstitialRef.current.load();
      return;
    }

    try {
      console.log('[AdMob] Mostrando interstitial.');
      interstitialRef.current.show();
    } catch (error) {
      // show() lanza de forma síncrona si el anuncio dejó de estar listo. Nunca
      // debe propagarse: la acción del usuario ya se completó.
      console.warn('[AdMob] No se pudo mostrar el interstitial:', error);
    }
  }, []);

  // La instancia del anuncio se crea dentro de un efecto del hook, así que en el
  // primer render todavía es null y `load()` es un no-op. Dependiendo de la
  // propia función `load` (un useCallback sobre esa instancia) el efecto vuelve
  // a correr en cuanto el anuncio existe, y ahí sí precarga de verdad.
  // Depende sólo de `load`, no del objeto `interstitial`: el hook devuelve un
  // objeto nuevo en cada render, así que incluirlo entero relanzaría la carga
  // en bucle.
  useEffect(() => {
    interstitial.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interstitial.load]);

  // Entra al chat pendiente, venga de donde venga (cierre del anuncio o
  // resguardo). Es idempotente: sólo navega la primera vez.
  const consumePendingChatThread = useCallback(() => {
    if (chatTimeoutRef.current) {
      clearTimeout(chatTimeoutRef.current);
      chatTimeoutRef.current = null;
    }

    const threadId = pendingChatThreadRef.current;

    if (!threadId) {
      return;
    }

    pendingChatThreadRef.current = null;
    navigateToChatThread(threadId);
  }, []);

  // El anuncio nunca puede dejar al usuario sin entrar al chat: si no está
  // cargado se navega ya, y si se muestra hay un timeout de resguardo por si el
  // evento de cierre nunca llega (por ejemplo si mandan la app a segundo plano).
  const goToChatAfterAd = useCallback(
    (threadId: string) => {
      if (!interstitialRef.current.isLoaded) {
        interstitialRef.current.load();
        navigateToChatThread(threadId);
        return;
      }

      pendingChatThreadRef.current = threadId;
      chatTimeoutRef.current = setTimeout(consumePendingChatThread, CHAT_AD_TIMEOUT_MS);
      showInterstitialIfReady();
    },
    [consumePendingChatThread, showInterstitialIfReady],
  );

  useEffect(() => {
    if (interstitial.isClosed) {
      consumePendingChatThread();
      interstitialRef.current.load();
    }
  }, [interstitial.isClosed, consumePendingChatThread]);

  useEffect(() => () => consumePendingChatThread(), [consumePendingChatThread]);

  useEffect(() => {
    if (interstitial.isLoaded) {
      console.log('[AdMob] Interstitial cargado y listo para mostrarse.');
    }
  }, [interstitial.isLoaded]);

  useEffect(() => {
    if (interstitial.error) {
      console.warn('[AdMob] Interstitial no disponible:', interstitial.error);
    }
  }, [interstitial.error]);

  const isComplexAdmin = creatorRole === 'admin_complejo';

  const filteredMatches = matches.filter(match => {
    if (matchFilter === 'mine') {
      return Boolean(match.isCreator || match.currentUserRequest);
    }

    if (matchFilter === 'completed') {
      return match.status === 'full';
    }

    if (matchFilter === 'pending') {
      return (
        match.status === 'open' ||
        match.currentUserRequest?.status === 'pending' ||
        match.pendingRequests.length > 0
      );
    }

    return true;
  });

  function updateForm<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function handleToggleCategory(category: PlayerCategory) {
    updateForm(
      'targetCategories',
      form.targetCategories.includes(category)
        ? form.targetCategories.filter(value => value !== category)
        : [...form.targetCategories, category].sort((first, second) => first - second),
    );
  }

  function closeCreateModal() {
    if (!isSaving) {
      setIsCreateModalVisible(false);
      setForm(EMPTY_FORM);
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  }

  function handleDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    updateForm('matchDate', formatDateValue(selectedDate));
  }

  function handleTimeChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    updateForm('startTime', formatTimeValue(selectedDate));
  }

  function validateForm(): CreateMatchPayload | undefined {
    const complexName = form.complexName.trim();
    const matchDate = form.matchDate.trim();
    const startTime = form.startTime.trim();
    const missingPlayers = Number(form.missingPlayers);

    if (isComplexAdmin && !adminComplexName) {
      showError('No tenés un complejo asociado para crear partidos.');
      return undefined;
    }

    if (!isComplexAdmin && !complexName) {
      showError('Completá el complejo.');
      return undefined;
    }

    if (!isValidDate(matchDate)) {
      showError('Usá fecha con formato AAAA-MM-DD.');
      return undefined;
    }

    if (!TIME_PATTERN.test(startTime)) {
      showError('Usá horario con formato HH:mm, por ejemplo 18:30.');
      return undefined;
    }

    if (!Number.isInteger(missingPlayers) || missingPlayers <= 0) {
      showError('La cantidad de jugadores que faltan debe ser mayor a 0.');
      return undefined;
    }

    if (form.targetCategories.length === 0) {
      showError('Seleccioná al menos una categoría buscada.');
      return undefined;
    }

    return {
      complexName: isComplexAdmin ? adminComplexName ?? '' : complexName,
      matchDate,
      matchType: form.matchType,
      missingPlayers,
      startTime,
      targetCategories: form.targetCategories,
    };
  }

  async function handleCreateMatch() {
    const payload = validateForm();

    if (!payload) {
      return;
    }

    setIsSaving(true);

    try {
      const result = await createMatch(payload);

      setMatches(current => [result.match, ...current]);
      setCreatedMatchWarning(result.notificationWarning ?? null);
      setIsCreatedModalVisible(true);
      setIsCreateModalVisible(false);
      setForm(EMPTY_FORM);
      loadMatches();
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo crear el partido.'));
    } finally {
      setIsSaving(false);
    }
  }

  // El anuncio se muestra al cerrar la confirmación: el partido ya está creado,
  // el usuario ya vio que salió bien, y el anuncio tuvo más tiempo para cargar.
  function handleCloseCreatedModal() {
    setIsCreatedModalVisible(false);

    // En iOS hay que esperar a que el modal termine de cerrarse: el SDK busca el
    // view controller más alto pero descarta los que están en pleno cierre
    // (RNGoogleMobileAdsCommon.mm, currentViewController), así que presentar
    // durante la animación falla en silencio. Eso lo maneja onDismiss, que es
    // exclusivo de iOS. En Android no existe esa restricción.
    if (Platform.OS !== 'ios') {
      showInterstitialIfReady();
    }
  }

  async function handleRequestToPlay(match: Match) {
    setBusyMatchId(match.id);

    try {
      const threadId = await requestToPlay(match);

      loadMatches();
      goToChatAfterAd(threadId);
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo solicitar jugar.'));
    } finally {
      setBusyMatchId(undefined);
    }
  }

  async function handleCancelMatch(match: Match) {
    setBusyMatchId(match.id);

    try {
      await cancelMatch(match.id);
      showSuccess('Partido eliminado correctamente.');
      await loadMatches();
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo eliminar el partido.'));
    } finally {
      setBusyMatchId(undefined);
    }
  }

  async function handleCompleteMatch(match: Match) {
    setBusyMatchId(match.id);

    try {
      await completeMatch(match.id);
      showSuccess('Marcaste el partido como completo.');
      await loadMatches();
    } catch (error) {
      showError(
        getSnackbarErrorText(error, 'No se pudo marcar el partido como completo.'),
      );
    } finally {
      setBusyMatchId(undefined);
    }
  }

  async function handleConfirmRequest(request: MatchRequest) {
    setBusyMatchId(request.id);

    try {
      await confirmMatchRequest(request.id);
      showSuccess(`Confirmaste a ${request.requesterDisplayName}.`);
      await loadMatches();
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo confirmar la solicitud.'));
    } finally {
      setBusyMatchId(undefined);
    }
  }

  async function handleRejectRequest(request: MatchRequest) {
    setBusyMatchId(request.id);

    try {
      await rejectMatchRequest(request.id);
      showSuccess(`Rechazaste a ${request.requesterDisplayName}.`);
      await loadMatches();
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo rechazar la solicitud.'));
    } finally {
      setBusyMatchId(undefined);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          isTablet && { paddingHorizontal: contentPadding },
        ]}
        refreshControl={
          <RefreshControl
            colors={['#9fb629']}
            onRefresh={refreshMatches}
            refreshing={isRefreshing}
            tintColor="#9fb629"
          />
        }>
        <View
          style={isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : undefined}>
          <Text style={styles.subtitle}>
            Creá partidos y encontrá jugadores en las ciudades que elegiste.
          </Text>

          {updatedAt ? (
            <Text style={styles.updatedAtText}>
              Actualizado {updatedAt.toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.filtersContent}
            horizontal
            showsHorizontalScrollIndicator={false}>
            {MATCH_FILTERS.map(filter => {
              const isSelected = matchFilter === filter.value;

              return (
                <Pressable
                  key={filter.value}
                  onPress={() => setMatchFilter(filter.value)}
                  style={[
                    styles.filterChip,
                    isSelected && styles.filterChipSelected,
                  ]}>
                  <Text
                    style={[
                      styles.filterChipText,
                      isSelected && styles.filterChipTextSelected,
                    ]}>
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {isLoading ? (
            <ActivityIndicator size="large" color="#9fb629" />
          ) : filteredMatches.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No hay partidos disponibles</Text>
              <Text style={styles.emptyText}>
                Probá cambiar el filtro, crear uno nuevo o ajustar tus preferencias.
              </Text>
            </View>
          ) : (
            <View style={[styles.matchesList, isTablet && { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }]}>
              {filteredMatches.map(match => (
                <View
                  key={match.id}
                  style={isTablet ? { width: '48%' } : undefined}
                  onLayout={(event: LayoutChangeEvent) => {
                    layoutYRef.current.set(match.id, event.nativeEvent.layout.y);
                  }}>
                  <MatchCard
                    isBusy={busyMatchId === match.id}
                    isFocused={focusedMatchId === match.id}
                    match={match}
                    onCancelMatch={handleCancelMatch}
                    onCompleteMatch={handleCompleteMatch}
                    onConfirmRequest={handleConfirmRequest}
                    onNavigateToChat={navigateToChatThread}
                    onRejectRequest={handleRejectRequest}
                    onRequestToPlay={handleRequestToPlay}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Pressable
        accessibilityLabel="Crear partido"
        accessibilityRole="button"
        onPress={() => setIsCreateModalVisible(true)}
        style={[styles.fab, isTablet && { right: contentPadding, bottom: contentPadding }]}>
        <Icon name="add" color="#ffffff" size={32} />
      </Pressable>

      <Modal
        animationType="slide"
        onRequestClose={closeCreateModal}
        transparent
        visible={isCreateModalVisible}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalPanel,
              { paddingBottom: Math.max(insets.bottom + 16, 28) },
              isTablet && { alignSelf: 'center', maxWidth: 500, width: '90%' },
            ]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear partido</Text>
              <Pressable
                accessibilityLabel="Cerrar formulario"
                accessibilityRole="button"
                hitSlop={8}
                onPress={closeCreateModal}>
                <Icon name="close-outline" color="#0f172a" size={30} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.label}>Complejo</Text>
              {isComplexAdmin ? (
                <View style={styles.autoComplexBox}>
                  <Icon name="business-outline" color="#7a8f20" size={20} />
                  <View style={styles.autoComplexTextWrapper}>
                    <Text style={styles.autoComplexLabel}>Se usa automáticamente</Text>
                    <Text style={styles.autoComplexName}>
                      {adminComplexName ?? 'Sin complejo asociado'}
                    </Text>
                  </View>
                </View>
              ) : (
                <TextInput
                  onChangeText={value => updateForm('complexName', value)}
                  placeholderTextColor="#6b7280"
                  placeholder="Nombre del complejo"
                  style={styles.input}
                  value={form.complexName}
                />
              )}

              <Text style={styles.label}>Fecha del partido</Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={styles.pickerButton}>
                <Text
                  style={[
                    styles.pickerButtonText,
                    !form.matchDate && styles.pickerButtonPlaceholder,
                  ]}>
                  {form.matchDate || 'Seleccionar fecha'}
                </Text>
                <Icon name="calendar-outline" color="#64748b" size={20} />
              </Pressable>
              {showDatePicker ? (
                <DateTimePicker
                  mode="date"
                  onChange={handleDateChange}
                  value={getDatePickerValue(form.matchDate)}
                />
              ) : null}

              <Text style={styles.label}>Horario</Text>
              <Pressable
                onPress={() => setShowTimePicker(true)}
                style={styles.pickerButton}>
                <Text
                  style={[
                    styles.pickerButtonText,
                    !form.startTime && styles.pickerButtonPlaceholder,
                  ]}>
                  {form.startTime ? `${form.startTime} hs` : 'Seleccionar horario'}
                </Text>
                <Icon name="time-outline" color="#64748b" size={20} />
              </Pressable>
              {showTimePicker ? (
                <DateTimePicker
                  is24Hour={false}
                  mode="time"
                  onChange={handleTimeChange}
                  value={getTimePickerValue(form.startTime)}
                />
              ) : null}

              <Text style={styles.label}>Tipo de partido</Text>
              <View style={styles.matchTypeRow}>
                {MATCH_TYPE_OPTIONS.map(option => {
                  const isSelected = form.matchType === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => updateForm('matchType', option.value)}
                      style={[
                        styles.matchTypeChip,
                        isSelected && styles.matchTypeChipSelected,
                      ]}>
                      <Text
                        style={[
                          styles.matchTypeChipText,
                          isSelected && styles.matchTypeChipTextSelected,
                        ]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Jugadores que faltan</Text>
              <View style={styles.missingPlayersRow}>
                {MISSING_PLAYERS_OPTIONS.map(option => {
                  const isSelected = form.missingPlayers === option;

                  return (
                    <Pressable
                      key={option}
                      onPress={() => updateForm('missingPlayers', option)}
                      style={[
                        styles.missingPlayersChip,
                        isSelected && styles.missingPlayersChipSelected,
                      ]}>
                      <Text
                        style={[
                          styles.missingPlayersChipText,
                          isSelected && styles.missingPlayersChipTextSelected,
                        ]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Categorías buscadas</Text>
              <View style={styles.categoryGrid}>
                {MATCH_CATEGORY_OPTIONS.map(category => {
                  const isSelected = form.targetCategories.includes(category);

                  return (
                    <Pressable
                      key={category}
                      onPress={() => handleToggleCategory(category)}
                      style={[
                        styles.categoryChip,
                        isSelected && styles.categoryChipSelected,
                      ]}>
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && styles.categoryChipTextSelected,
                        ]}>
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <LoadingButton
                disabledStyle={styles.disabledButton}
                label="Crear partido"
                loading={isSaving}
                loadingLabel="Creando..."
                onPress={handleCreateMatch}
                style={styles.primaryButton}
                textStyle={styles.primaryButtonText}
              />
            </ScrollView>
          </View>

          <SnackbarHost />
        </View>
      </Modal>

      <SuccessModal
        message="Ya está publicado. Te avisamos cuando alguien quiera sumarse."
        onClose={handleCloseCreatedModal}
        onDismiss={showInterstitialIfReady}
        title="¡Partido creado!"
        visible={isCreatedModalVisible}
        warning={createdMatchWarning ?? undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  autoComplexBox: {
    alignItems: 'center',
    backgroundColor: '#1e1f20',
    borderColor: '#7a8f20',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  autoComplexLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  autoComplexName: {
    color: '#9fb629',
    fontSize: 16,
    fontWeight: '800',
  },
  autoComplexTextWrapper: {
    flex: 1,
  },
  categoryChip: {
    alignItems: 'center',
    borderColor: '#4b5563',
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  categoryChipSelected: {
    backgroundColor: '#9fb629',
    borderColor: '#9fb629',
  },
  categoryChipText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '800',
  },
  categoryChipTextSelected: {
    color: '#ffffff',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  container: {
    backgroundColor: '#252628',
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 100,
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
  filterChip: {
    borderColor: '#4b5563',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipSelected: {
    backgroundColor: '#9fb629',
    borderColor: '#9fb629',
  },
  filterChipText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: '#ffffff',
  },
  filtersContent: {
    gap: 8,
    marginBottom: 16,
    paddingRight: 24,
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
  label: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  matchesList: {
    gap: 14,
  },
  matchTypeChip: {
    alignItems: 'center',
    borderColor: '#4b5563',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 11,
  },
  matchTypeChipSelected: {
    backgroundColor: '#9fb629',
    borderColor: '#9fb629',
  },
  matchTypeChipText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '800',
  },
  matchTypeChipTextSelected: {
    color: '#ffffff',
  },
  matchTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  missingPlayersChip: {
    alignItems: 'center',
    borderColor: '#4b5563',
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 64,
  },
  missingPlayersChipSelected: {
    backgroundColor: '#9fb629',
    borderColor: '#9fb629',
  },
  missingPlayersChipText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '800',
  },
  missingPlayersChipTextSelected: {
    color: '#ffffff',
  },
  missingPlayersRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  modalContent: {
    paddingBottom: 8,
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
    fontSize: 24,
    fontWeight: '800',
  },
  pickerButton: {
    alignItems: 'center',
    backgroundColor: '#1e1f20',
    borderColor: '#4b5563',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerButtonPlaceholder: {
    color: '#6b7280',
  },
  pickerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#9fb629',
    borderRadius: 12,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
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
  updatedAtText: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
});