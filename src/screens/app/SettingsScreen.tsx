import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import LoadingButton from '../../components/LoadingButton';
import PickerField from '../../components/PickerField';
import {
  getSnackbarErrorText,
  useSnackbar,
} from '../../components/SnackbarProvider';
import {
  ARGENTINA_LOCATIONS,
  ARGENTINA_PROVINCES,
} from '../../data/argentinaLocations';
import { useResponsive } from '../../hooks/useResponsive';
import {
  getSelectedCities,
  saveSelectedCities,
} from '../../services/citySettingsService';

export default function SettingsScreen() {
  const { showError, showSuccess } = useSnackbar();
  const { isTablet, contentMaxWidth, contentPadding } = useResponsive();
  const [city, setCity] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [province, setProvince] = useState('');
  const [selectedCities, setSelectedCities] = useState<string[]>([]);

  const cities = useMemo(
    () => (province ? ARGENTINA_LOCATIONS[province] ?? [] : []),
    [province],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadCities() {
      const stored = await getSelectedCities();

      if (!isMounted) {
        return;
      }

      setSelectedCities(stored);
      setIsLoading(false);
    }

    loadCities();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleProvinceChange(value: string) {
    setProvince(value);
    setCity('');
  }

  function handleAddCity() {
    if (!city) {
      showError('Seleccioná una ciudad para agregar.');
      return;
    }

    if (selectedCities.includes(city)) {
      showError('Esa ciudad ya está en la lista.');
      return;
    }

    setSelectedCities(current => [...current, city].sort());
    setCity('');
  }

  function handleRemoveCity(target: string) {
    setSelectedCities(current => current.filter(value => value !== target));
  }

  async function handleSave() {
    setIsSaving(true);

    try {
      await saveSelectedCities(selectedCities);
      showSuccess('Configuración guardada correctamente.');
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo guardar la configuración.'));
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

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        isTablet && { paddingHorizontal: contentPadding },
      ]}
      style={styles.container}>
      <View
        style={isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : undefined}>
        <Text style={styles.subtitle}>
          Elegí en qué ciudades querés ver publicaciones y partidos.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ciudades que quiero ver</Text>
          <Text style={styles.helperText}>
            Podés agregar varias, incluso de distintas provincias. Si no elegís
            ninguna, se usa la ciudad de tu perfil.
          </Text>

          <Text style={styles.label}>Provincia</Text>
          <PickerField
            enabled={!isSaving}
            items={ARGENTINA_PROVINCES.map(item => ({
              label: item,
              value: item,
            }))}
            onValueChange={handleProvinceChange}
            placeholder="Seleccioná provincia"
            selectedValue={province}
          />

          <Text style={styles.label}>Ciudad</Text>
          <PickerField
            enabled={Boolean(province) && !isSaving}
            items={cities.map(item => ({ label: item, value: item }))}
            onValueChange={setCity}
            placeholder="Seleccioná ciudad"
            selectedValue={city}
          />

          <Pressable onPress={handleAddCity} style={styles.secondaryButton}>
            <Icon name="add-circle-outline" color="#9fb629" size={20} />
            <Text style={styles.secondaryButtonText}>Agregar ciudad</Text>
          </Pressable>

          <View style={styles.citiesList}>
            {selectedCities.length === 0 ? (
              <Text style={styles.emptyText}>
                Todavía no agregaste ciudades.
              </Text>
            ) : (
              selectedCities.map(item => (
                <View key={item} style={styles.cityItem}>
                  <Text style={styles.cityText}>{item}</Text>
                  <Pressable
                    accessibilityLabel={`Eliminar ${item}`}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => handleRemoveCity(item)}>
                    <Icon name="trash-outline" color="#dc2626" size={20} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>

        <LoadingButton
          disabledStyle={styles.primaryButtonDisabled}
          label="Guardar configuración"
          loading={isSaving}
          loadingLabel="Guardando..."
          onPress={handleSave}
          style={styles.primaryButton}
          textStyle={styles.primaryButtonText}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e1f20',
    borderColor: '#374151',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
    padding: 16,
  },
  citiesList: {
    gap: 10,
    marginTop: 16,
  },
  cityItem: {
    alignItems: 'center',
    backgroundColor: '#252628',
    borderColor: '#374151',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cityText: {
    color: '#ffffff',
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingRight: 12,
  },
  container: {
    backgroundColor: '#252628',
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
  },
  helperText: {
    color: '#9ca3af',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
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
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#9fb629',
    borderRadius: 12,
    marginTop: 4,
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
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: '#9fb629',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#9fb629',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
});
