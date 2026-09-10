import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from '../types/navigation';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToChatThread(threadId: string) {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.navigate('App', {
    screen: 'MainTabs',
    params: {
      screen: 'Chats',
      params: {
        screen: 'ChatRoom',
        params: { threadId },
      },
    },
  });
}

export function navigateToMatch(matchId: string) {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.navigate('App', {
    screen: 'MainTabs',
    params: {
      screen: 'Matches',
      params: { focusedMatchId: matchId },
    },
  });
}

export function navigateToMatches() {
  if (!navigationRef.isReady()) {
    return;
  }

  navigationRef.navigate('App', {
    screen: 'MainTabs',
    params: {
      screen: 'Matches',
    },
  });
}
