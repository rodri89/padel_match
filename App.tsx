import { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import mobileAds, { AdsConsent } from 'react-native-google-mobile-ads';

import { ADMOB_TEST_DEVICE_IDS } from './src/config/admob';
import SnackbarProvider from './src/components/SnackbarProvider';
import RootNavigator from './src/navigation/RootNavigator';

const CONSENT_TIMEOUT_MS = 5000;

// gatherConsent() hace un round-trip a los servidores de Google. Sin este tope,
// si esa promesa nunca resuelve (sin red, portal cautivo, endpoint bloqueado)
// la app queda trabada para siempre en el splash.
function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
  ]);
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [isAdmobReady, setIsAdmobReady] = useState(false);

  useEffect(() => {
    async function initializeAds() {
      try {
        // Muestra el formulario de consentimiento (GDPR) y el prompt de ATT en iOS si corresponde.
        await withTimeout(AdsConsent.gatherConsent(), CONSENT_TIMEOUT_MS);
      } catch (error) {
        console.warn('[AdMob] Consent gathering failed:', error);
      }

      try {
        if (__DEV__) {
          // Evita servir anuncios reales (y arriesgar la cuenta) mientras se prueba en desarrollo.
          await mobileAds().setRequestConfiguration({
            testDeviceIdentifiers: ADMOB_TEST_DEVICE_IDS,
          });
        }

        // El SDK se inicializa siempre. El consentimiento decide si los anuncios
        // son personalizados, pero si no se inicializa acá no se inicializa
        // nunca más en toda la vida de la app.
        await mobileAds().initialize();
        console.log('[AdMob] Initialized successfully');
      } catch (error) {
        console.warn('[AdMob] Initialization failed:', error);
      } finally {
        setIsAdmobReady(true); // proceed anyway
      }
    }

    initializeAds();
  }, []);

  if (!isAdmobReady) {
    return (
      <View style={styles.splashContainer}>
        <Text style={styles.splashText}>PadelMatch</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <SnackbarProvider>
          <RootNavigator />
        </SnackbarProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splashContainer: {
    alignItems: 'center',
    backgroundColor: '#1e1f20',
    flex: 1,
    justifyContent: 'center',
  },
  splashText: {
    color: '#9fb629',
    fontSize: 32,
    fontWeight: '800',
  },
});
