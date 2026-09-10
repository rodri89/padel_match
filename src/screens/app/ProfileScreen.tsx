import { RouteProp, useRoute } from '@react-navigation/native';
import PickerField from '../../components/PickerField';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';

import { useResponsive } from '../../hooks/useResponsive';
import {
  getCurrentProfile,
  getCurrentUserEmail,
  updateCurrentProfile,
  uploadProfilePhoto,
} from '../../services/profileService';
import { ARGENTINA_LOCATIONS, ARGENTINA_PROVINCES } from '../../data/argentinaLocations';
import LoadingButton from '../../components/LoadingButton';
import {
  ROLE_LABELS,
  type PlayerCategory,
  type PlayerPosition,
  type ProfileSex,
  type ProfileUpdatePayload,
  type UserRole,
} from '../../types/profile';
import type { AppDrawerParamList } from '../../types/navigation';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  getSnackbarErrorText,
  useSnackbar,
} from '../../components/SnackbarProvider';

type FormState = {
  displayName: string;
  avatarUrl: string | null;
  province: string;
  city: string;
  sex: '' | ProfileSex;
  playerPosition: '' | PlayerPosition;
  category: string;
  phone: string;
  dni: string;
  birthDate: string;
};

const EMPTY_FORM: FormState = {
  displayName: '',
  avatarUrl: null,
  province: '',
  city: '',
  sex: '',
  playerPosition: '',
  category: '',
  phone: '',
  dni: '',
  birthDate: '',
};

const SEX_OPTIONS: Array<{ label: string; value: ProfileSex }> = [
  { label: 'Masculino', value: 'masculino' },
  { label: 'Femenino', value: 'femenino' },
];

const POSITION_OPTIONS: Array<{ label: string; value: PlayerPosition }> = [
  { label: 'Drive', value: 'drive' },
  { label: 'Revés', value: 'reves' },
  { label: 'Ambos', value: 'ambos' },
];

const CATEGORY_OPTIONS = Array.from({ length: 8 }, (_, index) => String(index + 1));

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isValidBirthDate(value: string) {
  if (!value) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

type ProfileScreenNavigationProp = NativeStackNavigationProp<AppDrawerParamList, 'Profile'>;

export default function ProfileScreen() {
  const { showError, showSuccess } = useSnackbar();
  const { isTablet, contentMaxWidth, contentPadding } = useResponsive();
  const route = useRoute<RouteProp<AppDrawerParamList, 'Profile'>>();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const isOnboarding = route.params?.isOnboarding === true;
  const [email, setEmail] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<{
    base64?: string;
    type?: string;
    uri: string;
  } | null>(null);
  const [role, setRole] = useState<UserRole>('usuario_comun');

  const cities = useMemo(
    () => (form.province ? ARGENTINA_LOCATIONS[form.province] ?? [] : []),
    [form.province],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {

      try {
        const [profile, currentEmail] = await Promise.all([
          getCurrentProfile(),
          getCurrentUserEmail(),
        ]);

        if (!isMounted) {
          return;
        }

        setEmail(currentEmail);
        setRole(profile.role);
        setForm({
          avatarUrl: profile.avatar_url,
          birthDate: profile.birth_date ?? '',
          category: profile.category ? String(profile.category) : '',
          city: profile.city ?? '',
          displayName: profile.display_name,
          dni: profile.dni ?? '',
          phone: profile.phone ?? '',
          playerPosition: profile.player_position ?? '',
          province: profile.province ?? '',
          sex: profile.sex ?? '',
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        showError(getSnackbarErrorText(error, 'No se pudo cargar el perfil.'));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [showError]);

  function updateForm<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function handleProvinceChange(province: string) {
    setForm(current => ({
      ...current,
      city: '',
      province,
    }));
  }

  async function handlePickPhoto() {

    const result = await launchImageLibrary({
      includeBase64: true,
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 1,
    });

    if (result.didCancel) {
      return;
    }

    if (result.errorMessage) {
      showError(result.errorMessage);
      return;
    }

    const asset = result.assets?.[0];

    if (!asset?.uri) {
      showError('No se pudo obtener la foto seleccionada.');
      return;
    }

    setLocalPhoto({
      base64: asset.base64,
      type: asset.type,
      uri: asset.uri,
    });
  }

  async function handleSave() {

    if (!form.displayName.trim()) {
      showError('Completá tu nombre visible.');
      return;
    }

    if (!isValidBirthDate(form.birthDate.trim())) {
      showError('Usá fecha de nacimiento con formato AAAA-MM-DD.');
      return;
    }

    // Onboarding validation: provincia, ciudad, sexo, posición, categoría
    if (isOnboarding) {
      const missing: string[] = [];

      if (!form.province) {
        missing.push('Provincia');
      }

      if (!form.city) {
        missing.push('Ciudad');
      }

      if (!form.sex) {
        missing.push('Sexo');
      }

      if (!form.playerPosition) {
        missing.push('Posición');
      }

      if (!form.category) {
        missing.push('Categoría');
      }

      if (missing.length > 0) {
        showError(
          `Completá los siguientes campos obligatorios: ${missing.join(', ')}.`,
        );
        return;
      }
    }

    setIsSaving(true);

    try {
      const avatarUrl = localPhoto
        ? await uploadProfilePhoto(localPhoto.uri, localPhoto.type, localPhoto.base64)
        : form.avatarUrl;

      const payload: ProfileUpdatePayload = {
        avatar_url: avatarUrl,
        birth_date: emptyToNull(form.birthDate),
        category: form.category
          ? (Number(form.category) as PlayerCategory)
          : null,
        city: emptyToNull(form.city),
        display_name: form.displayName.trim(),
        dni: emptyToNull(form.dni),
        phone: emptyToNull(form.phone),
        player_position: form.playerPosition || null,
        province: emptyToNull(form.province),
        sex: form.sex || null,
      };

      const updatedProfile = await updateCurrentProfile(payload);

      setForm({
        avatarUrl: updatedProfile.avatar_url,
        birthDate: updatedProfile.birth_date ?? '',
        category: updatedProfile.category ? String(updatedProfile.category) : '',
        city: updatedProfile.city ?? '',
        displayName: updatedProfile.display_name,
        dni: updatedProfile.dni ?? '',
        phone: updatedProfile.phone ?? '',
        playerPosition: updatedProfile.player_position ?? '',
        province: updatedProfile.province ?? '',
        sex: updatedProfile.sex ?? '',
      });
      setLocalPhoto(null);

      if (isOnboarding) {
        // Navigate to MatchPreferences to continue onboarding
        navigation.navigate('MatchPreferences', { isOnboarding: true });
        return;
      }

      showSuccess('Perfil actualizado correctamente.');
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo guardar el perfil.'));
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9fb629" />
      </View>
    );
  }

  const photoUri = localPhoto?.uri ?? form.avatarUrl;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <ScrollView contentContainerStyle={[
        styles.content,
        isTablet && { paddingHorizontal: contentPadding },
      ]}>
        <View
          style={isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : undefined}>
          <Text style={styles.title}>Perfil</Text>
          <Text style={styles.subtitle}>
            {isOnboarding
              ? 'Primero completá tus datos obligatorios para seguir.'
              : 'Completá tus datos para jugar partidos.'}
          </Text>

          <View style={styles.photoSection}>
            <View style={styles.avatar}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>
                  {form.displayName.trim().charAt(0).toUpperCase() || 'P'}
                </Text>
              )}
            </View>
            <Pressable style={styles.secondaryButton} onPress={handlePickPhoto}>
              <Text style={styles.secondaryButtonText}>
                {photoUri ? 'Cambiar foto' : 'Agregar foto'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Nombre visible</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={value => updateForm('displayName', value)}
            placeholder="Nombre visible"
            placeholderTextColor="#6b7280"
            style={styles.input}
            value={form.displayName}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput editable={false} style={[styles.input, styles.disabledInput]} value={email ?? ''} />

          <Text style={styles.label}>Tipo de usuario</Text>
          <View style={styles.roleBox}>
            <Text style={styles.roleText}>{ROLE_LABELS[role]}</Text>
          </View>

          <Text style={styles.label}>Provincia</Text>
          <PickerField
            selectedValue={form.province}
            onValueChange={value => handleProvinceChange(value)}
            placeholder="Seleccioná provincia"
            items={ARGENTINA_PROVINCES.map(p => ({ label: p, value: p }))}
          />

          <Text style={styles.label}>Ciudad</Text>
          <PickerField
            selectedValue={form.city}
            onValueChange={value => updateForm('city', value)}
            placeholder="Seleccioná ciudad"
            items={cities.map(c => ({ label: c, value: c }))}
            enabled={Boolean(form.province)}
          />

          <Text style={styles.label}>Sexo</Text>
          <PickerField
            selectedValue={form.sex}
            onValueChange={value => updateForm('sex', value as '' | ProfileSex)}
            placeholder="Seleccioná sexo"
            items={SEX_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
          />

          <Text style={styles.label}>Posición</Text>
          <PickerField
            selectedValue={form.playerPosition}
            onValueChange={value => updateForm('playerPosition', value as '' | PlayerPosition)}
            placeholder="Seleccioná posición"
            items={POSITION_OPTIONS.map(o => ({ label: o.label, value: o.value }))}
          />

          <Text style={styles.label}>Categoría</Text>
          <PickerField
            selectedValue={form.category}
            onValueChange={value => updateForm('category', value)}
            placeholder="Seleccioná categoría"
            items={CATEGORY_OPTIONS.map(c => ({ label: c, value: c }))}
          />

          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            keyboardType="phone-pad"
            onChangeText={value => updateForm('phone', value)}
            placeholder="Teléfono"
            placeholderTextColor="#6b7280"
            style={styles.input}
            value={form.phone}
          />

          {isOnboarding ? (
            <View style={styles.onboardingHint}>
              <Icon name="information-circle-outline" color="#9fb629" size={20} />
              <Text style={styles.onboardingHintText}>
                Después de guardar, vas a configurar tu disponibilidad horaria.
              </Text>
            </View>
          ) : null}


          <LoadingButton
            disabledStyle={styles.primaryButtonDisabled}
            label={isOnboarding ? 'Guardar y continuar' : 'Guardar perfil'}
            loading={isSaving}
            loadingLabel="Guardando..."
            onPress={handleSave}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 54,
    height: 108,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 108,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarInitial: {
    color: '#9fb629',
    fontSize: 42,
    fontWeight: '800',
  },
  container: {
    backgroundColor: '#252628',
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  disabledInput: {
    backgroundColor: '#374151',
    color: '#9ca3af',
  },
  input: {
    backgroundColor: '#1e1f20',
    borderColor: '#4b5563',
    borderRadius: 12,
    borderWidth: 1,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: '#252628',
    flex: 1,
    justifyContent: 'center',
  },
  onboardingHint: {
    alignItems: 'center',
    backgroundColor: '#1e1f20',
    borderColor: '#7a8f20',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  onboardingHintText: {
    color: '#9ca3af',
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  photoSection: {
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  pickerWrapper: {
    backgroundColor: '#1e1f20',
    borderColor: '#4b5563',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    justifyContent: 'center',
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
  secondaryButton: {
    borderColor: '#9fb629',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#9fb629',
    fontSize: 15,
    fontWeight: '700',
  },
  roleBox: {
    backgroundColor: '#1e1f20',
    borderColor: '#7a8f20',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  roleText: {
    color: '#9fb629',
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
});