import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import type { ChatStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<ChatStackParamList>();

export default function ChatNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="ChatList"
      screenOptions={{
        headerTitleAlign: 'center',
      }}>
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ title: 'Chats' }}
      />
      <Stack.Screen
        name="ChatRoom"
        component={ChatRoomScreen}
        options={({ route }) => ({ title: route.params.title ?? 'Chat' })}
      />
    </Stack.Navigator>
  );
}
