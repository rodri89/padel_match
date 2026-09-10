import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

export const ADMOB_APP_ID = Platform.select({
    ios: 'ca-app-pub-3758335156050794~5418346154',
    android: 'ca-app-pub-3758335156050794~5609917848',
    default: 'ca-app-pub-3758335156050794~5609917848',
});

export const ADMOB_BANNER_ID = Platform.select({
    ios: 'ca-app-pub-3758335156050794/5840640686',
    android: 'ca-app-pub-3758335156050794/9668205055',
    default: 'ca-app-pub-3758335156050794/9668205055',
});

const PRODUCTION_INTERSTITIAL_ID = Platform.select({
    ios: 'ca-app-pub-3758335156050794/8079791210',
    android: 'ca-app-pub-3758335156050794/2792182817',
    default: 'ca-app-pub-3758335156050794/2792182817',
});

// En desarrollo se usa el ad unit de prueba de Google, que siempre tiene fill.
// Con la unidad real un emulador o simulador suele devolver no-fill y no se
// puede verificar el flujo. Mismo criterio que el banner en AdBanner.tsx.
export const ADMOB_INTERSTITIAL_ID = __DEV__
    ? TestIds.INTERSTITIAL
    : PRODUCTION_INTERSTITIAL_ID;

// Dispositivos que reciben anuncios de prueba en vez de reales (solo aplica en desarrollo).
// OJO: 'EMULATOR' solo lo traduce Android (a AdRequest.DEVICE_ID_EMULATOR); en iOS se
// manda literal y no matchea nada. Para un dispositivo físico agregá el ID que imprime
// el SDK en consola la primera vez que se pide un anuncio real.
export const ADMOB_TEST_DEVICE_IDS = ['EMULATOR'];