import type { PlayerCategory } from './profile';

export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type AvailabilitySlot = {
  id?: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
};

export type PlayerMatchPreferences = {
  availability: AvailabilitySlot[];
  visibleCategories: PlayerCategory[];
};

export type PlayerAvailabilityRow = {
  id: string;
  user_id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  created_at: string;
};

export type PlayerMatchPreferencesRow = {
  user_id: string;
  visible_categories: PlayerCategory[];
  created_at: string;
  updated_at: string;
};

export const DAYS_OF_WEEK: Array<{ label: string; value: DayOfWeek }> = [
  { label: 'Lunes', value: 1 },
  { label: 'Martes', value: 2 },
  { label: 'Miércoles', value: 3 },
  { label: 'Jueves', value: 4 },
  { label: 'Viernes', value: 5 },
  { label: 'Sábado', value: 6 },
  { label: 'Domingo', value: 7 },
];

export const MATCH_CATEGORY_OPTIONS: PlayerCategory[] = [1, 2, 3, 4, 5, 6, 7, 8];
