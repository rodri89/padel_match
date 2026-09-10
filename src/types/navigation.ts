import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Auth: undefined;
  App: NavigatorScreenParams<AppDrawerParamList> | undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppTabParamList = {
  Home: undefined;
  Matches: { focusedMatchId?: string } | undefined;
  Complexes: undefined;
  Chats: NavigatorScreenParams<ChatStackParamList> | undefined;
};

export type AppDrawerParamList = {
  AdminPostHistory: undefined;
  CreateComplexAdmin: undefined;
  MainTabs: NavigatorScreenParams<AppTabParamList> | undefined;
  MatchHistory: undefined;
  MatchPreferences: {
    isOnboarding?: boolean;
  } | undefined;
  Profile: {
    isOnboarding?: boolean;
  } | undefined;
  Settings: undefined;
};

export type ChatStackParamList = {
  ChatList: undefined;
  ChatRoom: {
    threadId: string;
    title?: string;
    subtitle?: string;
  };
};
