import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { APP_SHARE_MESSAGE, APP_VERSION } from '../config/app';
import {
  initializeFirebaseMessaging,
  unregisterFirebaseMessaging,
} from '../services/firebaseMessaging';
import { getCurrentProfile } from '../services/profileService';
import { clearSession } from '../services/sessionStorage';
import AdminPostHistoryScreen from '../screens/app/AdminPostHistoryScreen';
import ComplexesScreen from '../screens/app/ComplexesScreen';
import CreateComplexAdminScreen from '../screens/app/CreateComplexAdminScreen';
import HomeScreen from '../screens/app/HomeScreen';
import MatchHistoryScreen from '../screens/app/MatchHistoryScreen';
import MatchPreferencesScreen from '../screens/app/MatchPreferencesScreen';
import MatchesScreen from '../screens/app/MatchesScreen';
import ProfileScreen from '../screens/app/ProfileScreen';
import SettingsScreen from '../screens/app/SettingsScreen';
import TutorialModal from '../components/TutorialModal';
import type {
  AppDrawerParamList,
  AppTabParamList,
  RootStackParamList,
} from '../types/navigation';
import type { UserRole } from '../types/profile';
import ChatNavigator from './ChatNavigator';

const Tab = createBottomTabNavigator<AppTabParamList>();
const Stack = createNativeStackNavigator<AppDrawerParamList>();

const tabIcons: Record<keyof AppTabParamList, string> = {
  Home: 'home-outline',
  Matches: 'calendar-outline',
  Complexes: 'shield-checkmark-outline',
  Chats: 'chatbubbles-outline',
};

type TabBarIconProps = {
  color: string;
  size: number;
};

function createTabBarIcon(routeName: keyof AppTabParamList) {
  return function TabBarIcon({ color, size }: TabBarIconProps) {
    return <Icon name={tabIcons[routeName]} color={color} size={size} />;
  };
}

const homeTabBarIcon = createTabBarIcon('Home');
const matchesTabBarIcon = createTabBarIcon('Matches');
const complexesTabBarIcon = createTabBarIcon('Complexes');
const chatsTabBarIcon = createTabBarIcon('Chats');

type AppRootNavigation = NativeStackNavigationProp<
  RootStackParamList
>;

function CloseDrawerIcon() {
  return <Icon name="close-outline" color="#e2e8f0" size={30} />;
}

type DrawerMenuButtonProps = {
  onPress: () => void;
  tintColor?: string;
};

function DrawerMenuButton({ onPress, tintColor }: DrawerMenuButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Abrir menú"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={styles.drawerMenuButton}>
      <Icon name="menu-outline" color={tintColor ?? '#e2e8f0'} size={28} />
    </Pressable>
  );
}

type HomeScreenOptionsProps = {
  onOpenDrawer: () => void;
};

function createHomeScreenOptions({ onOpenDrawer }: HomeScreenOptionsProps) {
  return function homeScreenOptions() {
    return {
      headerLeft: ({ tintColor }: { tintColor?: string }) => (
        <DrawerMenuButton tintColor={tintColor} onPress={onOpenDrawer} />
      ),
      tabBarIcon: homeTabBarIcon,
      title: 'Inicio',
    };
  };
}

type CustomSideMenuProps = {
  onClose: () => void;
  onLogout: () => Promise<void>;
  onNavigateToMatchPreferences: () => void;
  onNavigateToProfile: () => void;
  onNavigateToSettings: () => void;
  onNavigateToTutorial: () => void;
  visible: boolean;
};

type SideMenuItemProps = {
  iconName: string;
  label: string;
  onPress: () => void;
};

function SideMenuItem({ iconName, label, onPress }: SideMenuItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.sideMenuItem,
        pressed && styles.sideMenuItemPressed,
      ]}>
      <Icon name={iconName} color="#e2e8f0" size={22} />
      <Text style={styles.sideMenuItemLabel}>{label}</Text>
    </Pressable>
  );
}

function CustomSideMenu({
  onClose,
  onLogout,
  onNavigateToMatchPreferences,
  onNavigateToProfile,
  onNavigateToSettings,
  onNavigateToTutorial,
  visible,
}: CustomSideMenuProps) {
  const insets = useSafeAreaInsets();

  // A diferencia del resto de los items, este no cierra el menú: en iOS el share
  // sheet no se presenta si el Modal que lo contiene está en plena animación de
  // cierre. Dejándolo abierto, el sheet aparece encima y al cerrarlo se vuelve
  // al menú.
  async function handleShareApp() {
    try {
      await Share.share({ message: APP_SHARE_MESSAGE, title: 'PadelMatch' });
    } catch (error) {
      console.warn('[Share] No se pudo compartir la app:', error);
    }
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.sideMenuModal}>
        <Pressable
          accessibilityLabel="Cerrar menú"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.sideMenuBackdrop}
        />
        <View
          style={[
            styles.sideMenuPanel,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              paddingTop: insets.top + 12,
            },
          ]}>
          <View>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>PadelMatch</Text>
              <Pressable
                accessibilityLabel="Cerrar menú"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={styles.drawerCloseButton}>
                <CloseDrawerIcon />
              </Pressable>
            </View>
            <SideMenuItem
              iconName="person-outline"
              label="Perfil del usuario"
              onPress={onNavigateToProfile}
            />
            <SideMenuItem
              iconName="options-outline"
              label="Preferencias de partidos"
              onPress={onNavigateToMatchPreferences}
            />
            <SideMenuItem
              iconName="settings-outline"
              label="Configuración"
              onPress={onNavigateToSettings}
            />
            <SideMenuItem
              iconName="book-outline"
              label="Tutorial"
              onPress={onNavigateToTutorial}
            />
          </View>
          <View style={styles.sideMenuFooter}>
            <SideMenuItem
              iconName="share-social-outline"
              label="Compartir app"
              onPress={handleShareApp}
            />
            <SideMenuItem
              iconName="log-out-outline"
              label="Cerrar sesión"
              onPress={onLogout}
            />
            <View style={styles.sideMenuDivider} />
            <Text style={styles.sideMenuVersion}>Versión {APP_VERSION}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type BottomTabsProps = {
  onOpenAdminPostHistory: () => void;
  onOpenDrawer: () => void;
  onOpenMatchHistory: () => void;
  role: UserRole;
};

function BottomTabs({
  onOpenAdminPostHistory,
  onOpenDrawer,
  onOpenMatchHistory,
  role,
}: BottomTabsProps) {
  const canViewAdmin = role !== 'usuario_comun';

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: '#1e1f20' },
        headerTintColor: '#ffffff',
        headerTitleAlign: 'center',
        tabBarActiveTintColor: '#9fb629',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: { backgroundColor: '#1e1f20', borderTopColor: '#374151' },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={createHomeScreenOptions({ onOpenDrawer })}
      />
      <Tab.Screen
        name="Matches"
        component={MatchesScreen}
        options={{
          // eslint-disable-next-line react/no-unstable-nested-components -- React Navigation expects a render function for header buttons.
          headerRight: () => (
            <Pressable
              accessibilityLabel="Ver historial"
              accessibilityRole="button"
              onPress={onOpenMatchHistory}
              style={styles.headerHistoryButton}>
              <Icon name="time-outline" color="#9fb629" size={20} />
              <Text style={styles.headerHistoryText}>Historial</Text>
            </Pressable>
          ),
          title: 'Partidos',
          tabBarIcon: matchesTabBarIcon,
        }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatNavigator}
        options={{
          headerShown: false,
          // Sin esto la barra de tabs queda entre el input del chat y el
          // teclado, así que el input nunca llega a apoyarse sobre el teclado.
          tabBarHideOnKeyboard: true,
          tabBarIcon: chatsTabBarIcon,
          title: 'Chats',
        }}
      />
      {canViewAdmin ? (
        <Tab.Screen
          name="Complexes"
          component={ComplexesScreen}
          options={{
            // eslint-disable-next-line react/no-unstable-nested-components -- React Navigation expects a render function for header buttons.
            headerRight: () =>
              role === 'admin_complejo' || role === 'super_admin' ? (
                <Pressable
                  accessibilityLabel="Ver historial de publicaciones"
                  accessibilityRole="button"
                  onPress={onOpenAdminPostHistory}
                  style={styles.headerHistoryButton}>
                  <Icon name="time-outline" color="#9fb629" size={20} />
                  <Text style={styles.headerHistoryText}>Historial</Text>
                </Pressable>
              ) : null,
            title: 'Admin',
            tabBarIcon: complexesTabBarIcon,
          }}
        />
      ) : null}
    </Tab.Navigator>
  );
}

type MainTabsScreenProps = NativeStackScreenProps<AppDrawerParamList, 'MainTabs'>;

const TUTORIAL_SEEN_KEY = '@padelmatch_tutorial_seen';

function MainTabsScreen({ navigation }: MainTabsScreenProps) {
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isTutorialVisible, setIsTutorialVisible] = useState(false);
  const [isOnboardingTutorial, setIsOnboardingTutorial] = useState(false);
  const [role, setRole] = useState<UserRole>('usuario_comun');
  const rootNavigation = navigation.getParent<AppRootNavigation>();

  useEffect(() => {
    getCurrentProfile()
      .then(profile => setRole(profile.role))
      .catch(() => setRole('usuario_comun'));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(TUTORIAL_SEEN_KEY).then(value => {
      if (value !== 'true') {
        setIsTutorialVisible(true);
        setIsOnboardingTutorial(true);
      }
    });
  }, []);

  function handleTutorialClose() {
    AsyncStorage.setItem(TUTORIAL_SEEN_KEY, 'true');
    setIsTutorialVisible(false);

    // If this was the first-time tutorial, start onboarding flow
    if (isOnboardingTutorial) {
      setIsOnboardingTutorial(false);
      // Small delay to let modal close animation finish
      setTimeout(() => {
        navigation.navigate('Profile', { isOnboarding: true });
      }, 400);
    }
  }

  function closeMenu() {
    setIsMenuVisible(false);
  }

  function openMenu() {
    setIsMenuVisible(true);
  }

  function handleNavigateToProfile() {
    closeMenu();
    navigation.navigate('Profile');
  }

  function handleNavigateToMatchPreferences() {
    closeMenu();
    navigation.navigate('MatchPreferences');
  }

  function handleNavigateToSettings() {
    closeMenu();
    navigation.navigate('Settings');
  }

  function handleNavigateToTutorial() {
    closeMenu();
    setIsTutorialVisible(true);
  }

  function handleNavigateToMatchHistory() {
    navigation.navigate('MatchHistory');
  }

  function handleNavigateToAdminPostHistory() {
    navigation.navigate('AdminPostHistory');
  }

  async function handleLogout() {
    closeMenu();
    await unregisterFirebaseMessaging();
    await clearSession();
    rootNavigation?.replace('Auth', undefined);
  }

  return (
    <>
      <BottomTabs
        onOpenAdminPostHistory={handleNavigateToAdminPostHistory}
        onOpenDrawer={openMenu}
        onOpenMatchHistory={handleNavigateToMatchHistory}
        role={role}
      />
      <CustomSideMenu
        onClose={closeMenu}
        onLogout={handleLogout}
        onNavigateToMatchPreferences={handleNavigateToMatchPreferences}
        onNavigateToProfile={handleNavigateToProfile}
        onNavigateToSettings={handleNavigateToSettings}
        onNavigateToTutorial={handleNavigateToTutorial}
        visible={isMenuVisible}
      />
      <TutorialModal
        onClose={handleTutorialClose}
        visible={isTutorialVisible}
      />
    </>
  );
}

export default function AppNavigator() {
  useEffect(() => {
    initializeFirebaseMessaging();
  }, []);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="MainTabs" component={MainTabsScreen} />
      <Stack.Screen
        name="AdminPostHistory"
        component={AdminPostHistoryScreen}
        options={{
          headerShown: true,
          title: 'Historial de publicaciones',
        }}
      />
      <Stack.Screen
        name="CreateComplexAdmin"
        component={CreateComplexAdminScreen}
        options={{
          headerShown: true,
          title: 'Crear admin complejo',
        }}
      />
      <Stack.Screen
        name="MatchHistory"
        component={MatchHistoryScreen}
        options={{
          headerShown: true,
          title: 'Historial de partidos',
        }}
      />
      <Stack.Screen
        name="MatchPreferences"
        component={MatchPreferencesScreen}
        options={{
          headerShown: true,
          title: 'Preferencias de partidos',
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: true,
          title: 'Perfil del usuario',
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: true,
          title: 'Configuración',
        }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  drawerMenuButton: {
    marginLeft: 16,
    padding: 4,
  },
  drawerCloseButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  drawerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 18,
  },
  drawerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  headerHistoryButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginRight: 12,
    padding: 6,
  },
  headerHistoryText: {
    color: '#9fb629',
    fontSize: 14,
    fontWeight: '800',
  },
  sideMenuBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  sideMenuDivider: {
    backgroundColor: '#374151',
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 24,
    marginTop: 8,
  },
  sideMenuFooter: {
    paddingBottom: 4,
  },
  sideMenuItem: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  sideMenuItemLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  sideMenuItemPressed: {
    backgroundColor: '#374151',
  },
  sideMenuModal: {
    flex: 1,
  },
  sideMenuPanel: {
    backgroundColor: '#1e1f20',
    borderBottomRightRadius: 16,
    borderRightColor: '#374151',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopRightRadius: 16,
    elevation: 24,
    height: '80%',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { height: 0, width: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    width: 304,
  },
  sideMenuVersion: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
});