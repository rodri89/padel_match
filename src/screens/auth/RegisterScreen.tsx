import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useResponsive } from '../../hooks/useResponsive';
import LoadingButton from '../../components/LoadingButton';
import { signUpWithPassword } from '../../services/authSession';
import type { AuthStackParamList } from '../../types/navigation';
import {
  getSnackbarErrorText,
  useSnackbar,
} from '../../components/SnackbarProvider';

type RegisterNavigation = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

type Props = {
  navigation: RegisterNavigation;
};

export default function RegisterScreen({ navigation }: Props) {
  const { showError, showSuccess } = useSnackbar();
  const { isTablet, contentMaxWidth } = useResponsive();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  async function handleRegister() {

    if (!fullName.trim() || !email.trim() || !password) {
      showError('Completá nombre, email y contraseña.');
      return;
    }

    if (password !== confirmPassword) {
      showError('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await signUpWithPassword(fullName, email, password);

      if (!session) {
        showSuccess('Cuenta creada. Revisá tu email para confirmar el registro.');
      }
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo registrar la cuenta en Supabase.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <View
          style={isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : undefined}>
          <Text style={styles.title}>Registrarse</Text>
          <Text style={styles.subtitle}>Crea tu cuenta para empezar a jugar</Text>

          <Text style={styles.label}>Nombre completo</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={setFullName}
            onFocus={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
            placeholder="Nombre completo"
            style={styles.input}
            value={fullName}
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            onFocus={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
            placeholder="Email"
            style={styles.input}
            value={email}
          />
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            onChangeText={setPassword}
            onFocus={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
            placeholder="Contraseña"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <Text style={styles.label}>Confirmar contraseña</Text>
          <TextInput
            onChangeText={setConfirmPassword}
            onFocus={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
            placeholder="Confirmar contraseña"
            secureTextEntry
            style={styles.input}
            value={confirmPassword}
          />

          <LoadingButton
            disabledStyle={styles.primaryButtonDisabled}
            label="Registrarse"
            loading={isSubmitting}
            loadingLabel="Creando..."
            onPress={handleRegister}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />

          <Pressable onPress={() => navigation.navigate('Login')}>
            <Text style={styles.linkText}>¿Ya tienes cuenta? Inicia Sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#252628',
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  input: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkText: {
    color: '#9fb629',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#9fb629',
    borderRadius: 12,
    marginTop: 8,
    paddingVertical: 15,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: '#64748b',
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  label: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginStart: 4,
  },
});
