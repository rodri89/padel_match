import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

export type SnackbarVariant = 'error' | 'info' | 'success';

export type SnackbarMessage = {
  id: number;
  text: string;
  variant: SnackbarVariant;
};

const VARIANT_STYLES: Record<
  SnackbarVariant,
  { background: string; foreground: string; icon: string }
> = {
  error: {
    background: '#fee2e2',
    foreground: '#991b1b',
    icon: 'alert-circle',
  },
  info: {
    background: '#e0e7ff',
    foreground: '#3730a3',
    icon: 'information-circle',
  },
  success: {
    background: '#dcfce7',
    foreground: '#166534',
    icon: 'checkmark-circle',
  },
};

type SnackbarProps = {
  message: SnackbarMessage | null;
  onDismiss: () => void;
};

export default function Snackbar({ message, onDismiss }: SnackbarProps) {
  const insets = useSafeAreaInsets();

  if (!message) {
    return null;
  }

  const variant = VARIANT_STYLES[message.variant];

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingBottom: Math.max(insets.bottom, 12) + 68 }]}>
      <View style={[styles.snackbar, { backgroundColor: variant.background }]}>
        <Icon color={variant.foreground} name={variant.icon} size={20} />
        <Text style={[styles.text, { color: variant.foreground }]}>
          {message.text}
        </Text>
        <Pressable
          accessibilityLabel="Cerrar mensaje"
          accessibilityRole="button"
          hitSlop={10}
          onPress={onDismiss}>
          <Icon color={variant.foreground} name="close" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    bottom: 0,
    justifyContent: 'flex-end',
    left: 0,
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
    zIndex: 9999,
  },
  snackbar: {
    alignItems: 'center',
    borderRadius: 12,
    elevation: 24,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000000',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
});
