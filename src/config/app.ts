// Mantener igualada a versionName de android/app/build.gradle y a
// MARKETING_VERSION de ios/PadelMatch.xcodeproj/project.pbxproj en cada release.
export const APP_VERSION = '5.2';

export const APP_STORE_URL =
  'https://apps.apple.com/us/app/padelmatch/id6785593314';

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.padelmatch.tbgroup';

export const APP_SHARE_MESSAGE = [
  '¡Sumate a PadelMatch! Encontrá partidos, jugadores y complejos de pádel cerca tuyo.',
  '',
  `iPhone: ${APP_STORE_URL}`,
  `Android: ${PLAY_STORE_URL}`,
].join('\n');
