import { getSupabaseClient } from './supabaseClient';
import type {
  AvailabilitySlot,
  PlayerAvailabilityRow,
  PlayerMatchPreferences,
  PlayerMatchPreferencesRow,
} from '../types/matchPreferences';

async function getCurrentUserId() {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error('No hay un usuario autenticado.');
  }

  return user.id;
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

export async function getCurrentMatchPreferences(): Promise<PlayerMatchPreferences> {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();

  const [availabilityResult, preferencesResult] = await Promise.all([
    supabase
      .from('player_availability')
      .select('id, user_id, day_of_week, start_time, end_time, created_at')
      .eq('user_id', userId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true })
      .returns<PlayerAvailabilityRow[]>(),
    supabase
      .from('player_match_preferences')
      .select('user_id, visible_categories, created_at, updated_at')
      .eq('user_id', userId)
      .maybeSingle<PlayerMatchPreferencesRow>(),
  ]);

  if (availabilityResult.error) {
    throw availabilityResult.error;
  }

  if (preferencesResult.error) {
    throw preferencesResult.error;
  }

  return {
    availability: (availabilityResult.data ?? []).map(slot => ({
      id: slot.id,
      day_of_week: slot.day_of_week,
      end_time: normalizeTime(slot.end_time),
      start_time: normalizeTime(slot.start_time),
    })),
    visibleCategories: preferencesResult.data?.visible_categories ?? [],
  };
}

export async function saveCurrentMatchPreferences({
  availability,
  visibleCategories,
}: PlayerMatchPreferences) {
  const supabase = getSupabaseClient();
  const userId = await getCurrentUserId();

  const { error: preferencesError } = await supabase
    .from('player_match_preferences')
    .upsert(
      {
        user_id: userId,
        visible_categories: visibleCategories,
      },
      { onConflict: 'user_id' },
    );

  if (preferencesError) {
    throw preferencesError;
  }

  const { error: deleteError } = await supabase
    .from('player_availability')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    throw deleteError;
  }

  if (availability.length === 0) {
    return getCurrentMatchPreferences();
  }

  const rows = availability.map(slot => ({
    day_of_week: slot.day_of_week,
    end_time: slot.end_time,
    start_time: slot.start_time,
    user_id: userId,
  }));

  const { error: insertError } = await supabase
    .from('player_availability')
    .insert(rows satisfies Array<Omit<AvailabilitySlot, 'id'> & { user_id: string }>);

  if (insertError) {
    throw insertError;
  }

  return getCurrentMatchPreferences();
}
