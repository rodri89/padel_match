import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { isSupabaseConfigured } from '../config/supabase';
import { getSupabaseClient } from '../services/supabaseClient';
import type { RootStackParamList } from '../types/navigation';
import AppNavigator from './AppNavigator';
import AuthNavigator from './AuthNavigator';
import { navigationRef } from './navigationService';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    async function loadSession() {
      try {
        if (!isSupabaseConfigured()) {
          setIsLoggedIn(false);
          return;
        }

        const supabase = getSupabaseClient();
        const { data } = await supabase.auth.getSession();

        setIsLoggedIn(Boolean(data.session));
      } finally {
        setIsLoading(false);
      }
    }

    loadSession();

    if (!isSupabaseConfigured()) {
      return undefined;
    }

    const {
      data: { subscription },
    } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(Boolean(session));
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9fb629" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}>
        {isLoggedIn ? (
          <Stack.Screen name="App" component={AppNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
