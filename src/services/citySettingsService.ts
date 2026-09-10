import AsyncStorage from '@react-native-async-storage/async-storage';

const SELECTED_CITIES_KEY = '@padelmatch_selected_cities';

// Es una preferencia local: si el storage falla o el valor quedó corrupto se
// vuelve al comportamiento por defecto en vez de romper el inicio.
export async function getSelectedCities(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SELECTED_CITIES_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (city): city is string => typeof city === 'string' && city.trim().length > 0,
    );
  } catch {
    return [];
  }
}

export async function saveSelectedCities(cities: string[]) {
  await AsyncStorage.setItem(SELECTED_CITIES_KEY, JSON.stringify(cities));
}

/**
 * Ciudades que efectivamente filtran el contenido. Sin selección explícita se
 * cae a la ciudad del perfil, y sin perfil no se filtra nada.
 */
export function resolveActiveCities(
  selectedCities: string[],
  profileCity?: string | null,
): string[] {
  if (selectedCities.length > 0) {
    return selectedCities;
  }

  return profileCity ? [profileCity] : [];
}
