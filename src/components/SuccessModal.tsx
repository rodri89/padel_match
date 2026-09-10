import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

type SuccessModalProps = {
  actionLabel?: string;
  icon?: string;
  message?: string;
  onClose: () => void;
  /** Solo iOS: se dispara cuando el modal terminó de cerrarse. */
  onDismiss?: () => void;
  title: string;
  visible: boolean;
  warning?: string;
};

export default function SuccessModal({
  actionLabel = 'Listo',
  icon = 'checkmark-circle',
  message,
  onClose,
  onDismiss,
  title,
  visible,
  warning,
}: SuccessModalProps) {
  return (
    <Modal
      animationType="fade"
      onDismiss={onDismiss}
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Cerrar"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.panel}>
          <View style={styles.iconContainer}>
            <Icon color="#9fb629" name={icon} size={64} />
          </View>

          <Text style={styles.title}>{title}</Text>

          {message ? <Text style={styles.message}>{message}</Text> : null}

          {warning ? (
            <View style={styles.warningBox}>
              <Icon color="#b45309" name="alert-circle-outline" size={18} />
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityLabel={actionLabel}
            accessibilityRole="button"
            onPress={onClose}
            style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{actionLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: '#252628',
    borderRadius: 50,
    height: 100,
    justifyContent: 'center',
    marginBottom: 16,
    width: 100,
  },
  message: {
    color: '#9ca3af',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
    textAlign: 'center',
  },
  panel: {
    alignItems: 'center',
    backgroundColor: '#1e1f20',
    borderColor: '#374151',
    borderRadius: 24,
    borderWidth: 1,
    elevation: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    width: '100%',
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#9fb629',
    borderRadius: 12,
    marginTop: 20,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  warningBox: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    padding: 12,
  },
  warningText: {
    color: '#b45309',
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
