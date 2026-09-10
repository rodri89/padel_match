/* global jest */

import 'react-native-gesture-handler/jestSetup';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-firebase/messaging', () => {
  const messaging = () => ({
    getAPNSToken: jest.fn(() => Promise.resolve('mock-apns-token')),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    getToken: jest.fn(() => Promise.resolve('mock-fcm-token')),
    onMessage: jest.fn(),
    onNotificationOpenedApp: jest.fn(),
    onTokenRefresh: jest.fn(),
    registerDeviceForRemoteMessages: jest.fn(() => Promise.resolve()),
    requestPermission: jest.fn(() => Promise.resolve(1)),
    setBackgroundMessageHandler: jest.fn(),
  });

  messaging.AuthorizationStatus = {
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  };

  return messaging;
});

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  AndroidImportance: {
    HIGH: 4,
  },
  AuthorizationStatus: {
    AUTHORIZED: 1,
    DENIED: 0,
    NOT_DETERMINED: -1,
    PROVISIONAL: 2,
  },
  EventType: {
    PRESS: 1,
  },
  default: {
    createChannel: jest.fn(() => Promise.resolve('chat-messages')),
    displayNotification: jest.fn(() => Promise.resolve()),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
    onForegroundEvent: jest.fn(),
    requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
  },
}));

jest.mock('react-native-worklets', () => ({}));

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');

  const animated = {
    ...ReactNative.Animated,
    View: ReactNative.View,
    createAnimatedComponent: component => component,
  };

  return {
    __esModule: true,
    default: animated,
    Extrapolation: {
      CLAMP: 'clamp',
    },
    ReduceMotion: {
      Always: 'always',
      Never: 'never',
      System: 'system',
    },
    interpolate: (_value, _inputRange, outputRange) => outputRange[0],
    runOnJS: fn => fn,
    useAnimatedStyle: updater => updater(),
    useDerivedValue: updater => ({ value: updater() }),
    useSharedValue: value => ({ value }),
    withSpring: value => value,
    withTiming: value => value,
  };
});
