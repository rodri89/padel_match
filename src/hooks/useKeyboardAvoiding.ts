import { useCallback, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import type { KeyboardAvoidingViewProps } from 'react-native';

// Con targetSdk 35+, Android 15 y 16 fuerzan edge-to-edge: la ventana ya no se
// achica con windowSoftInputMode="adjustResize" y el teclado tapa el contenido,
// así que hay que compensar con padding igual que en iOS. En Android 14 o menos
// adjustResize sigue funcionando y sumar padding movería el contenido dos veces.
const isAndroidEdgeToEdge =
  Platform.OS === 'android' && Number(Platform.Version) >= 35;

const behavior: KeyboardAvoidingViewProps['behavior'] =
  Platform.OS === 'ios' || isAndroidEdgeToEdge ? 'padding' : undefined;

/**
 * Props para KeyboardAvoidingView que funcionan en iOS y en todas las versiones
 * de Android. `wrapperRef` y `handleLayout` van en una View que envuelva al
 * KeyboardAvoidingView para medir su distancia real al tope de la pantalla.
 */
export function useKeyboardAvoiding() {
  const wrapperRef = useRef<View>(null);
  const [keyboardVerticalOffset, setKeyboardVerticalOffset] = useState(0);

  // Se mide en vez de usar useHeaderHeight: en Android edge-to-edge el alto del
  // header puede o no incluir la barra de estado según cómo lo reporte
  // react-native-screens, y un offset incorrecto deja el input tapado o flotando.
  const handleLayout = useCallback(() => {
    wrapperRef.current?.measureInWindow((_x, y) => {
      setKeyboardVerticalOffset(y);
    });
  }, []);

  return { behavior, handleLayout, keyboardVerticalOffset, wrapperRef };
}
