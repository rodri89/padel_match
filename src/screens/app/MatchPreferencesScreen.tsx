import { RouteProp, useRoute } from '@react-navigation/native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import PickerField from '../../components/PickerField';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import { useResponsive } from '../../hooks/useResponsive';
import LoadingButton from '../../components/LoadingButton';
import {
  getCurrentMatchPreferences,
  saveCurrentMatchPreferences,
} from '../../services/matchPreferencesService';
import type { PlayerCategory } from '../../types/profile';
import type { AppDrawerParamList } from '../../types/navigation';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  DAYS_OF_WEEK,
  MATCH_CATEGORY_OPTIONS,
  type AvailabilitySlot,
  type DayOfWeek,
} from '../../types/matchPreferences';
import {
  getSnackbarErrorText,
  useSnackbar,
} from '../../components/SnackbarProvider';

const DEFAULT_DAY: DayOfWeek = 1;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ALL_DAY_START = '00:00';
const ALL_DAY_END = '23:59';

function padNumber(value: number) {
  return String(value).padStart(2, '0');
}

function formatTimeValue(date: Date) {
  return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function getTimePickerValue(value: string) {
  const date = new Date();

  if (TIME_PATTERN.test(value)) {
    const [hours, minutes] = value.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
  }

  return date;
}

function getDayLabel(dayOfWeek: DayOfWeek) {
  return DAYS_OF_WEEK.find(day => day.value === dayOfWeek)?.label ?? 'Día';
}

function formatSlot(slot: AvailabilitySlot) {
  const dayLabel = getDayLabel(slot.day_of_week);

  if (slot.start_time === ALL_DAY_START && slot.end_time === ALL_DAY_END) {
    return `${dayLabel} · Todo el día`;
  }

  return `${dayLabel} de ${slot.start_time} a ${slot.end_time} hs`;
}

function sortSlots(slots: AvailabilitySlot[]) {
  return [...slots].sort((first, second) => {
    if (first.day_of_week !== second.day_of_week) {
      return first.day_of_week - second.day_of_week;
    }

    return first.start_time.localeCompare(second.start_time);
  });
}

type MatchPreferencesNavigationProp = NativeStackNavigationProp<AppDrawerParamList, 'MatchPreferences'>;

export default function MatchPreferencesScreen() {
  const { showError, showSuccess } = useSnackbar();
  const { isTablet, contentMaxWidth, contentPadding } = useResponsive();
  const route = useRoute<RouteProp<AppDrawerParamList, 'MatchPreferences'>>();
  const navigation = useNavigation<MatchPreferencesNavigationProp>();
  const isOnboarding = route.params?.isOnboarding === true;
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(DEFAULT_DAY);
  const [endTime, setEndTime] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [visibleCategories, setVisibleCategories] = useState<PlayerCategory[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadPreferences() {

      try {
        const preferences = await getCurrentMatchPreferences();

        if (!isMounted) {
          return;
        }

        setAvailability(sortSlots(preferences.availability));
        setVisibleCategories(preferences.visibleCategories);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        showError(getSnackbarErrorText(error, 'No se pudieron cargar las preferencias.'));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, [showError]);

  function handleAddSlot() {

    const normalizedStart = startTime.trim();
    const normalizedEnd = endTime.trim();

    if (!TIME_PATTERN.test(normalizedStart) || !TIME_PATTERN.test(normalizedEnd)) {
      showError('Usá horarios válidos con formato HH:mm, por ejemplo 16:00.');
      return;
    }

    if (normalizedStart >= normalizedEnd) {
      showError('El horario desde debe ser menor que el horario hasta.');
      return;
    }

    const alreadyExists = availability.some(
      slot =>
        slot.day_of_week === dayOfWeek &&
        slot.start_time === normalizedStart &&
        slot.end_time === normalizedEnd,
    );

    if (alreadyExists) {
      showError('Ese horario ya está cargado.');
      return;
    }

    setAvailability(current =>
      sortSlots([
        ...current,
        {
          day_of_week: dayOfWeek,
          end_time: normalizedEnd,
          start_time: normalizedStart,
        },
      ]),
    );
    setStartTime('');
    setEndTime('');
  }

  function handleStartTimeChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowStartTimePicker(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    setStartTime(formatTimeValue(selectedDate));
  }

  function handleEndTimeChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowEndTimePicker(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    setEndTime(formatTimeValue(selectedDate));
  }

  function handleAllDay() {
    setStartTime(ALL_DAY_START);
    setEndTime(ALL_DAY_END);
  }

  function handleRemoveSlot(indexToRemove: number) {
    setAvailability(current => current.filter((_slot, index) => index !== indexToRemove));
  }

  function handleToggleCategory(category: PlayerCategory) {

    setVisibleCategories(current => {
      if (current.includes(category)) {
        return current.filter(value => value !== category);
      }

      return [...current, category].sort((first, second) => first - second);
    });
  }

  async function handleSave() {

    if (visibleCategories.length === 0) {
      showError('Seleccioná al menos una categoría de partidos para ver.');
      return;
    }

    setIsSaving(true);

    try {
      const preferences = await saveCurrentMatchPreferences({
        availability,
        visibleCategories,
      });

      setAvailability(sortSlots(preferences.availability));
      setVisibleCategories(preferences.visibleCategories);
      if (isOnboarding) {
        // Onboarding complete — go back to main screen
        navigation.navigate('MainTabs', { screen: 'Matches' });
        return;
      }

      showSuccess('Preferencias guardadas correctamente.');
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudieron guardar las preferencias.'));
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <ScrollView contentContainerStyle={[
        styles.content,
        isTablet && { paddingHorizontal: contentPadding },
      ]}>
        <View
          style={isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : undefined}>
          <Text style={styles.subtitle}>
            {isOnboarding
              ? 'Por último, configurá tu disponibilidad horaria para encontrar partidos.'
              : 'Configurá cuándo podés jugar y qué categorías querés ver.'}
          </Text>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Disponibilidad semanal</Text>
            <Text style={styles.helperText}>
              Ejemplo: lunes de 16:00 a 22:00 hs significa que podés jugar en ese
              rango.
            </Text>

            <Text style={styles.label}>Día</Text>
            <PickerField
              selectedValue={String(dayOfWeek)}
              onValueChange={value => setDayOfWeek(Number(value) as DayOfWeek)}
              placeholder="Seleccioná día"
              items={DAYS_OF_WEEK.map(day => ({ label: day.label, value: String(day.value) }))}
            />

            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.label}>Desde</Text>
                <Pressable
                  onPress={() => setShowStartTimePicker(true)}
                  style={styles.timePickerButton}>
                  <Text
                    style={[
                      styles.timePickerButtonText,
                      !startTime && styles.timePickerButtonPlaceholder,
                    ]}>
                    {startTime || 'Desde'}
                  </Text>
                  <Icon name="time-outline" color="#64748b" size={20} />
                </Pressable>
                {showStartTimePicker ? (
                  <DateTimePicker
                    is24Hour={false}
                    mode="time"
                    onChange={handleStartTimeChange}
                    value={getTimePickerValue(startTime)}
                  />
                ) : null}
              </View>
              <View style={styles.timeField}>
                <Text style={styles.label}>Hasta</Text>
                <Pressable
                  onPress={() => setShowEndTimePicker(true)}
                  style={styles.timePickerButton}>
                  <Text
                    style={[
                      styles.timePickerButtonText,
                      !endTime && styles.timePickerButtonPlaceholder,
                    ]}>
                    {endTime || 'Hasta'}
                  </Text>
                  <Icon name="time-outline" color="#64748b" size={20} />
                </Pressable>
                {showEndTimePicker ? (
                  <DateTimePicker
                    is24Hour={false}
                    mode="time"
                    onChange={handleEndTimeChange}
                    value={getTimePickerValue(endTime)}
                  />
                ) : null}
              </View>
            </View>

            <Pressable style={styles.allDayButton} onPress={handleAllDay}>
              <Icon name="sunny-outline" color="#9fb629" size={20} />
              <Text style={styles.allDayButtonText}>Todo el día</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={handleAddSlot}>
              <Icon name="add-circle-outline" color="#9fb629" size={20} />
              <Text style={styles.secondaryButtonText}>Agregar horario</Text>
            </Pressable>

            <View style={styles.slotsList}>
              {availability.length === 0 ? (
                <Text style={styles.emptyText}>Todavía no cargaste horarios.</Text>
              ) : (
                availability.map((slot, index) => (
                  <View
                    key={`${slot.day_of_week}-${slot.start_time}-${slot.end_time}`}
                    style={styles.slotItem}>
                    <Text style={styles.slotText}>{formatSlot(slot)}</Text>
                    <Pressable
                      accessibilityLabel="Eliminar horario"
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => handleRemoveSlot(index)}>
                      <Icon name="trash-outline" color="#dc2626" size={20} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Categorías que quiero ver</Text>
            <Text style={styles.helperText}>
              Podés elegir varias categorías aunque tu perfil tenga una categoría
              principal distinta.
            </Text>

            <View style={styles.categoryGrid}>
              {MATCH_CATEGORY_OPTIONS.map(category => {
                const isSelected = visibleCategories.includes(category);

                return (
                  <Pressable
                    key={category}
                    onPress={() => handleToggleCategory(category)}
                    style={[
                      styles.categoryChip,
                      isSelected && styles.categoryChipSelected,
                    ]}>
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextSelected,
                      ]}>
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>


          <LoadingButton
            disabledStyle={styles.primaryButtonDisabled}
            label="Guardar preferencias"
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
  allDayButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: '#9fb629',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  allDayButtonText: {
    color: '#9fb629',
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#1e1f20',
    borderColor: '#374151',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 18,
    padding: 16,
  },
  categoryChip: {
    alignItems: 'center',
    borderColor: '#4b5563',
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  categoryChipSelected: {
    backgroundColor: '#9fb629',
    borderColor: '#9fb629',
  },
  categoryChipText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '800',
  },
  categoryChipTextSelected: {
    color: '#ffffff',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  slotItem: {
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
  slotText: {
    color: '#ffffff',
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingRight: 12,
  },
  slotsList: {
    gap: 10,
    marginTop: 16,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  timeField: {
    flex: 1,
  },
  timePickerButton: {
    alignItems: 'center',
    backgroundColor: '#1e1f20',
    borderColor: '#4b5563',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  timePickerButtonPlaceholder: {
    color: '#6b7280',
  },
  timePickerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
});