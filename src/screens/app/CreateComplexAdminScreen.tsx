import { Picker } from '@react-native-picker/picker';
import { useMemo, useState } from 'react';
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
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import LoadingButton from '../../components/LoadingButton';
import { ARGENTINA_LOCATIONS, ARGENTINA_PROVINCES } from '../../data/argentinaLocations';
import {
  createComplexAdmin,
  uploadComplexLogo,
} from '../../services/complexService';
import type { CreateComplexAdminPayload } from '../../types/complex';
import {
  getSnackbarErrorText,
  useSnackbar,
} from '../../components/SnackbarProvider';

type FormState = {
  address: string;
  city: string;
  email: string;
  facebookUrl: string;
  instagramUrl: string;
  name: string;
  password: string;
  phone: string;
  province: string;
};

const EMPTY_FORM: FormState = {
  address: '',
  city: '',
  email: '',
  facebookUrl: '',
  instagramUrl: '',
  name: '',
  password: '',
  phone: '',
  province: '',
};

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function CreateComplexAdminScreen() {
  const { showError, showSuccess } = useSnackbar();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [localLogo, setLocalLogo] = useState<{
    base64?: string;
    type?: string;
    uri: string;
  } | null>(null);

  const cities = useMemo(
    () => (form.province ? ARGENTINA_LOCATIONS[form.province] ?? [] : []),
    [form.province],
  );

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

  async function handlePickLogo() {

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
      showError('No se pudo obtener el logo seleccionado.');
      return;
    }

    setLocalLogo({
      base64: asset.base64,
      type: asset.type,
      uri: asset.uri,
    });
  }

  function validateForm() {
    if (!form.name.trim()) {
      return 'Completá el nombre del complejo.';
    }

    if (!isValidEmail(form.email)) {
      return 'Completá un mail válido.';
    }

    if (form.password.length < 6) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }

    if (!form.address.trim()) {
      return 'Completá la dirección.';
    }

    if (!form.province || !form.city) {
      return 'Seleccioná provincia y ciudad.';
    }

    return undefined;
  }

  async function handleSave() {

    const validationError = validateForm();

    if (validationError) {
      showError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      const logoUrl = localLogo
        ? await uploadComplexLogo(localLogo.uri, localLogo.type, localLogo.base64)
        : null;
      const payload: CreateComplexAdminPayload = {
        address: form.address.trim(),
        city: form.city,
        email: form.email.trim().toLowerCase(),
        facebookUrl: emptyToNull(form.facebookUrl),
        instagramUrl: emptyToNull(form.instagramUrl),
        logoUrl,
        name: form.name.trim(),
        password: form.password,
        phone: emptyToNull(form.phone),
        province: form.province,
      };

      await createComplexAdmin(payload);

      setForm(EMPTY_FORM);
      setLocalLogo(null);
      showSuccess('Admin complejo creado correctamente.');
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo crear el admin complejo.'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 24) + 24 },
        ]}>
        <Text style={styles.title}>Crear Admin Complejo</Text>
        <Text style={styles.subtitle}>
          Creá el usuario administrador y los datos principales del complejo.
        </Text>

        <View style={styles.logoSection}>
          <View style={styles.logoPreview}>
            {localLogo ? (
              <Image source={{ uri: localLogo.uri }} style={styles.logoImage} />
            ) : (
              <Text style={styles.logoPlaceholder}>Logo</Text>
            )}
          </View>
          <Pressable style={styles.secondaryButton} onPress={handlePickLogo}>
            <Text style={styles.secondaryButtonText}>
              {localLogo ? 'Cambiar logo' : 'Agregar logo'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.label}>Nombre</Text>
        <TextInput
          autoCapitalize="words"
          onChangeText={value => updateForm('name', value)}

          placeholder="Nombre del complejo"
          style={styles.input}
          value={form.name}
        />

        <Text style={styles.label}>Mail</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={value => updateForm('email', value)}
          placeholderTextColor="#6b7280"
          placeholder="admin@complejo.com"
          style={styles.input}
          value={form.email}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={value => updateForm('password', value)}
          placeholderTextColor="#6b7280"
          placeholder="Mínimo 6 caracteres"
          secureTextEntry
          style={styles.input}
          value={form.password}
        />

        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          keyboardType="phone-pad"
          onChangeText={value => updateForm('phone', value)}
          placeholderTextColor="#6b7280"
          placeholder="Teléfono"
          style={styles.input}
          value={form.phone}
        />

        <Text style={styles.label}>URL Instagram</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="url"
          onChangeText={value => updateForm('instagramUrl', value)}
          placeholderTextColor="#6b7280"
          placeholder="https://instagram.com/..."
          style={styles.input}
          value={form.instagramUrl}
        />

        <Text style={styles.label}>URL Facebook</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="url"
          onChangeText={value => updateForm('facebookUrl', value)}
          placeholderTextColor="#6b7280"
          placeholder="https://facebook.com/..."
          style={styles.input}
          value={form.facebookUrl}
        />

        <Text style={styles.label}>Dirección</Text>
        <TextInput
          autoCapitalize="words"
          onChangeText={value => updateForm('address', value)}
          placeholderTextColor="#6b7280"
          placeholder="Dirección"
          style={styles.input}
          value={form.address}
        />

        <Text style={styles.label}>Provincia</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            mode="dropdown"
            selectedValue={form.province}
            onValueChange={value => handleProvinceChange(value)}
            dropdownIconColor="#9fb629"
            style={{
              color: '#ffffff',
              backgroundColor: 'transparent',
              height: 50,
            }}
            itemStyle={{
              color: '#ffffff',
              backgroundColor: '#1e1f20',
              fontSize: 16,
            }}>
            <Picker.Item
              label="Seleccioná provincia"
              value=""
              color="#6b7280"
            />
            {ARGENTINA_PROVINCES.map(province => (
              <Picker.Item
                key={province}
                label={province}
                value={province}
                color="#6b7280"
              />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Ciudad</Text>
        <View style={[styles.pickerWrapper, !form.province && styles.disabledInput]}>
          <Picker
            mode="dropdown"
            enabled={Boolean(form.province)}
            selectedValue={form.city}
            onValueChange={value => updateForm('city', value)}
            dropdownIconColor="#9fb629"
            style={{
              color: '#ffffff',
              backgroundColor: 'transparent',
              height: 50,
            }}
            itemStyle={{
              color: '#ffffff',
              backgroundColor: '#1e1f20',
              fontSize: 16,
            }}>
            <Picker.Item
              label="Seleccioná ciudad"
              value=""
              color="#6b7280"
            />
            {cities.map(city => (
              <Picker.Item
                key={city}
                label={city}
                value={city}
                color="#6b7280"
              />
            ))}
          </Picker>
        </View>


        <LoadingButton
          disabledStyle={styles.primaryButtonDisabled}
          label="Crear admin complejo"
          loading={isSaving}
          loadingLabel="Creando..."
          onPress={handleSave}
          style={styles.primaryButton}
          textStyle={styles.primaryButtonText}
        />
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
    padding: 24,
  },
  disabledInput: {
    backgroundColor: '#374151',
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
  logoImage: {
    height: '100%',
    width: '100%',
  },
  logoPlaceholder: {
    color: '#9fb629',
    fontSize: 18,
    fontWeight: '800',
  },
  logoPreview: {
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 20,
    height: 120,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 120,
  },
  logoSection: {
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
  subtitle: {
    color: '#9ca3af',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
});