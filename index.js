/**
 * @format
 */

import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundMessageHandler } from './src/services/firebaseMessaging';

registerBackgroundMessageHandler();
AppRegistry.registerComponent(appName, () => App);
