import AsyncStorage from '@react-native-async-storage/async-storage';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  EventType,
} from '@notifee/react-native';
import { AppState, Platform } from 'react-native';

import {
  navigateToChatThread,
  navigateToMatch,
  navigateToMatches,
  navigationRef,
} from '../navigation/navigationService';
import { getAuthSession } from './authSession';
import { getSupabaseClient } from './supabaseClient';

const FCM_TOKEN_KEY = '@PadelMatch:fcmToken';
const ANDROID_CHAT_CHANNEL_ID = 'chat-messages';
const APNS_TOKEN_RETRY_MS = 500;
const APNS_TOKEN_MAX_ATTEMPTS = 20;
const NAVIGATION_READY_RETRY_MS = 250;
const NAVIGATION_READY_MAX_ATTEMPTS = 40;
const HANDLED_MESSAGE_IDS_LIMIT = 50;

type NotificationData = Record<string, unknown> | undefined;

// El tap de una notificación puede llegar por dos vías según la plataforma (ver
// registerNotificationListeners). Guardamos los messageId ya atendidos para que
// un mensaje que dispare ambas no navegue dos veces.
const handledMessageIds = new Set<string>();

let listenersRegistered = false;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null =
  null;
let setupInFlight: Promise<void> | null = null;

async function createAndroidChatChannel() {
  if (Platform.OS !== 'android') {
    return undefined;
  }

  return notifee.createChannel({
    id: ANDROID_CHAT_CHANNEL_ID,
    importance: AndroidImportance.HIGH,
    name: 'Mensajes de chat',
  });
}

function getStringDataValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function delay(milliseconds: number) {
  return new Promise<void>(resolve => setTimeout(() => resolve(), milliseconds));
}

// En un arranque en frío desde una notificación el destino se resuelve antes de
// que el NavigationContainer esté montado, y navigationService descarta en
// silencio cualquier navigate con el ref sin inicializar. Sin esta espera el
// deep link se pierde justo en el caso más común: abrir la app desde el push.
async function navigateWhenReady(navigate: () => void) {
  for (let attempt = 0; attempt < NAVIGATION_READY_MAX_ATTEMPTS; attempt += 1) {
    if (navigationRef.isReady()) {
      navigate();
      return;
    }

    await delay(NAVIGATION_READY_RETRY_MS);
  }

  console.warn(
    'La navegación no estuvo lista a tiempo: se descarta el destino del push.',
  );
}

function shouldHandleMessage(messageId?: string) {
  if (!messageId) {
    return true;
  }

  if (handledMessageIds.has(messageId)) {
    return false;
  }

  if (handledMessageIds.size >= HANDLED_MESSAGE_IDS_LIMIT) {
    const oldest = handledMessageIds.values().next().value;

    if (oldest !== undefined) {
      handledMessageIds.delete(oldest);
    }
  }

  handledMessageIds.add(messageId);

  return true;
}

function handleNotificationNavigation(data: NotificationData) {
  if (!shouldHandleMessage(getStringDataValue(data?.messageId))) {
    return;
  }

  const notificationType = getStringDataValue(data?.type);
  const threadId = getStringDataValue(data?.threadId);
  const matchId = getStringDataValue(data?.matchId);

  if (notificationType === 'chat_message' && threadId) {
    navigateWhenReady(() => navigateToChatThread(threadId));
    return;
  }

  if (
    (notificationType === 'match_created' ||
      notificationType === 'match_request') &&
    matchId
  ) {
    navigateWhenReady(() => navigateToMatch(matchId));
    return;
  }

  // Fallback: if there's a threadId but no specific type, navigate to chat
  if (threadId) {
    navigateWhenReady(() => navigateToChatThread(threadId));
    return;
  }

  if (
    notificationType === 'match_created' ||
    notificationType === 'match_request'
  ) {
    navigateWhenReady(() => navigateToMatches());
  }
}

async function displayForegroundNotification(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage,
) {
  try {
    const channelId = await createAndroidChatChannel();

    await notifee.displayNotification({
      android: {
        channelId,
        // Android pinta el small icon como silueta de un solo color y descarta
        // el RGB del PNG, así que el tinte hay que pasarlo acá. Sin esto queda
        // con el gris por defecto del sistema en vez del verde de la marca.
        color: '#9fb629',
        smallIcon: 'ic_notification',
        pressAction: {
          id: 'default',
        },
      },
      body:
        remoteMessage.notification?.body ??
        getStringDataValue(remoteMessage.data?.body),
      // El messageId viaja dentro de data porque es lo único que notifee
      // devuelve en el evento de tap, y es la clave con la que shouldHandleMessage
      // evita la doble navegación.
      data: {
        ...remoteMessage.data,
        ...(remoteMessage.messageId
          ? { messageId: remoteMessage.messageId }
          : {}),
      },
      title:
        remoteMessage.notification?.title ??
        getStringDataValue(remoteMessage.data?.title),
    });
  } catch (error) {
    // Sin este catch el fallo queda como unhandled rejection dentro del
    // listener de FCM y la notificación desaparece sin dejar rastro.
    console.error('No se pudo mostrar la notificación push:', error);
  }
}

async function registerDeviceToken(fcmToken: string) {
  const session = await getAuthSession();

  if (!session) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('register_push_token', {
    p_fcm_token: fcmToken,
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });

  if (error) {
    console.error('No se pudo registrar el token de notificaciones push:', error);
    return;
  }

  // El token se persiste sólo después de que el backend lo aceptó: esta key es
  // la señal que usa el reintento por AppState para saber si el dispositivo
  // quedó realmente registrado.
  await AsyncStorage.setItem(FCM_TOKEN_KEY, fcmToken);
}

async function requestMessagingPermission() {
  // En Android 13+ esto pide POST_NOTIFICATIONS. Si el usuario lo rechazó, el
  // sistema descarta silenciosamente todo lo que muestre notifee, así que hay
  // que detectarlo acá en vez de seguir como si todo estuviera bien
  // (messaging().requestPermission() siempre devuelve AUTHORIZED en Android).
  const settings = await notifee.requestPermission();

  if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
    console.warn(
      'Notificaciones deshabilitadas por el usuario: no se mostrarán pushes.',
    );
    return false;
  }

  if (Platform.OS === 'android') {
    return true;
  }

  const authorizationStatus = await messaging().requestPermission();

  return (
    authorizationStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authorizationStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

// En iOS getToken() rechaza con "unregistered" si el registro contra APNs
// todavía no terminó, cosa habitual en el primer arranque. El módulo nativo
// exige además un APNs token para poder resolver. Sin esta espera el token FCM
// nunca se registra y no llega ninguna notificación.
async function waitForApnsToken() {
  if (Platform.OS !== 'ios') {
    return;
  }

  await messaging().registerDeviceForRemoteMessages();

  for (let attempt = 0; attempt < APNS_TOKEN_MAX_ATTEMPTS; attempt += 1) {
    const apnsToken = await messaging().getAPNSToken();

    if (apnsToken) {
      return;
    }

    await delay(APNS_TOKEN_RETRY_MS);
  }

  console.warn(
    'No se obtuvo el token de APNs a tiempo: el token FCM puede no registrarse.',
  );
}

async function registerFcmToken() {
  await waitForApnsToken();

  try {
    await registerDeviceToken(await messaging().getToken());
  } catch (error) {
    // Un fallo acá suele ser una carrera con el registro de APNs, así que
    // conviene un segundo intento antes de rendirse.
    console.warn('Reintentando el registro del token de notificaciones:', error);
    await delay(APNS_TOKEN_RETRY_MS * 4);
    await registerDeviceToken(await messaging().getToken());
  }
}

async function registerNotificationListeners() {
  // runMessagingSetup puede correr más de una vez (reintento por AppState), y
  // los listeners son globales de la app: sin este guard cada reintento sumaría
  // otro onMessage y otro onForegroundEvent, duplicando notificaciones.
  if (listenersRegistered) {
    return;
  }

  listenersRegistered = true;

  messaging().onTokenRefresh(registerDeviceToken);
  messaging().onMessage(displayForegroundNotification);

  // En Android el mensaje es data-only y la notificación la crea notifee, así
  // que el tap llega por acá.
  notifee.onForegroundEvent(({ detail, type }) => {
    if (type !== EventType.PRESS) {
      return;
    }

    handleNotificationNavigation(detail.notification?.data);
  });

  // En iOS la notificación la muestra el sistema desde el bloque apns.alert:
  // notifee nunca la creó, así que su getInitialNotification devuelve null y el
  // tap sólo se puede capturar con los handlers de messaging.
  messaging().onNotificationOpenedApp(remoteMessage => {
    handleNotificationNavigation({
      ...remoteMessage?.data,
      ...(remoteMessage?.messageId
        ? { messageId: remoteMessage.messageId }
        : {}),
    });
  });

  const initialNotification = await notifee.getInitialNotification();

  if (initialNotification) {
    handleNotificationNavigation(initialNotification.notification?.data);
    return;
  }

  const initialRemoteMessage = await messaging().getInitialNotification();

  if (initialRemoteMessage) {
    handleNotificationNavigation({
      ...initialRemoteMessage.data,
      ...(initialRemoteMessage.messageId
        ? { messageId: initialRemoteMessage.messageId }
        : {}),
    });
  }
}

async function runMessagingSetup() {
  try {
    const hasPermission = await requestMessagingPermission();

    if (!hasPermission) {
      return;
    }
  } catch (error) {
    console.error('No se pudieron pedir permisos de notificaciones:', error);
    return;
  }

  // El registro del token va en su propio try: si falla, los listeners de abajo
  // se tienen que registrar igual. Antes todo compartía un solo catch, así que
  // un fallo de token dejaba a la app sin onMessage ni navegación por push
  // durante toda la sesión.
  try {
    await registerFcmToken();
  } catch (error) {
    console.error('No se pudo registrar el token de notificaciones push:', error);
  }

  try {
    await registerNotificationListeners();
  } catch (error) {
    console.error('No se pudieron registrar los listeners de notificaciones:', error);
  }
}

// Si el usuario rechazó el permiso, requestMessagingPermission corta el setup y
// la sesión entera queda sin token: habilitarlo desde Ajustes no tendría efecto
// hasta matar y reabrir la app. Reintentamos al volver del background, que es
// justo cuando vuelve el usuario de cambiar el permiso en Ajustes.
function registerAppStateRetry() {
  if (appStateSubscription) {
    return;
  }

  appStateSubscription = AppState.addEventListener('change', async nextState => {
    if (nextState !== 'active') {
      return;
    }

    const storedToken = await AsyncStorage.getItem(FCM_TOKEN_KEY);

    if (storedToken) {
      return;
    }

    await initializeFirebaseMessaging();
  });
}

export async function initializeFirebaseMessaging() {
  registerAppStateRetry();

  // El listener de AppState puede solaparse con el arranque normal; sin esta
  // guarda las dos corridas pedirían permisos y token en paralelo.
  if (!setupInFlight) {
    setupInFlight = runMessagingSetup().finally(() => {
      setupInFlight = null;
    });
  }

  await setupInFlight;
}

export async function unregisterFirebaseMessaging() {
  // Sin esto el reintento seguiría vivo tras el logout y, al no haber token en
  // storage, dispararía un setup por cada vuelta a foreground.
  appStateSubscription?.remove();
  appStateSubscription = null;

  const fcmToken = await AsyncStorage.getItem(FCM_TOKEN_KEY);
  const session = await getAuthSession();

  if (fcmToken && session) {
    const supabase = getSupabaseClient();

    await supabase
      .from('push_tokens')
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq('fcm_token', fcmToken)
      .eq('user_id', session.userId);
  }

  await AsyncStorage.removeItem(FCM_TOKEN_KEY);
}

export function registerBackgroundMessageHandler() {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    await displayForegroundNotification(remoteMessage);
  });
}
