import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import {
  Image,
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
import { signInWithPassword } from '../../services/authSession';
import type { AuthStackParamList } from '../../types/navigation';
import {
  getSnackbarErrorText,
  useSnackbar,
} from '../../components/SnackbarProvider';

type LoginNavigation = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

type Props = {
  navigation: LoginNavigation;
};

export default function LoginScreen({ navigation }: Props) {
  const { showError } = useSnackbar();
  const { isTablet, contentMaxWidth } = useResponsive();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  async function handleLogin() {

    if (!email.trim() || !password) {
      showError('Ingresá email y contraseña.');
      return;
    }

    setIsSubmitting(true);

    try {
      await signInWithPassword(email, password);
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo iniciar sesión con Supabase.'));
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
          <Image
            source={require('../../assets/padel_match_letter_2.png')}
            style={[styles.logo, isTablet && { marginTop: -40 }]}
            resizeMode="contain"
          />

          <Text style={styles.title}>Iniciar Sesión</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            onFocus={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
            placeholder="Email"
            placeholderTextColor="#9ca3af"
            style={styles.input}
            value={email}
          />
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            onChangeText={setPassword}
            onFocus={() => scrollRef.current?.scrollToEnd?.({ animated: true })}
            placeholder="Contraseña"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            style={styles.input}
            value={password}
          />


          <LoadingButton
            disabledStyle={styles.primaryButtonDisabled}
            label="Iniciar Sesión"
            loading={isSubmitting}
            loadingLabel="Ingresando..."
            onPress={handleLogin}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />

          <Pressable onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>¿No tienes cuenta? Regístrate</Text>
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
  logo: {
    alignSelf: 'center',
    height: 240,
    marginBottom: 16,
    width: '80%',
    marginTop: -90,
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
  label: {
    color: '#9ca3af',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginStart: 4,
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
    color: '#9ca3af',
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 24,
    textAlign: 'center',
  },
});