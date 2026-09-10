import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type LoadingButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  disabledStyle?: StyleProp<ViewStyle>;
  icon?: string;
  iconColor?: string;
  label: string;
  loading?: boolean;
  loadingLabel?: string;
  onPress: () => void;
  spinnerColor?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export default function LoadingButton({
  accessibilityLabel,
  disabled = false,
  disabledStyle,
  icon,
  iconColor = '#ffffff',
  label,
  loading = false,
  loadingLabel,
  onPress,
  spinnerColor = '#ffffff',
  style,
  textStyle,
}: LoadingButtonProps) {
  const isDisabled = loading || disabled;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={[styles.button, style, isDisabled && disabledStyle]}>
      {loading ? (
        <ActivityIndicator color={spinnerColor} size="small" />
      ) : icon ? (
        <Icon color={iconColor} name={icon} size={18} />
      ) : null}
      <Text style={textStyle}>{loading ? loadingLabel ?? label : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
});
