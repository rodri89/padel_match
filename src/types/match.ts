import type { PlayerCategory } from './profile';

export type MatchStatus = 'open' | 'full' | 'cancelled';

export type MatchRequestStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

export type MatchType = 'damas' | 'libre' | 'mixto';

export type MatchRequest = {
  chatThreadId?: string;
  createdAt?: Date;
  id: string;
  requesterAvatarUrl?: string;
  requesterDisplayName: string;
  requesterId: string;
  status: MatchRequestStatus;
};

export type Match = {
  city: string;
  complexName: string;
  confirmedRequests: MatchRequest[];
  createdAt?: Date;
  creatorAvatarUrl?: string;
  creatorDisplayName: string;
  creatorId: string;
  currentUserRequest?: MatchRequest;
  id: string;
  isCreator: boolean;
  matchDate: string;
  matchType: MatchType;
  missingPlayers: number;
  pendingRequests: MatchRequest[];
  province?: string;
  startTime: string;
  status: MatchStatus;
  targetCategories: PlayerCategory[];
};

export type CreateMatchPayload = {
  complexName: string;
  matchDate: string;
  matchType: MatchType;
  missingPlayers: number;
  startTime: string;
  targetCategories: PlayerCategory[];
};

export type CreateMatchResult = {
  match: Match;
  notificationWarning?: string;
};

export type MatchRow = {
  city: string;
  complex_name: string;
  created_at?: string | null;
  creator_display_name: string;
  creator_id: string;
  id: string;
  match_date: string;
  match_type?: MatchType | null;
  missing_players: number;
  province?: string | null;
  start_time: string;
  status: MatchStatus;
  target_categories: PlayerCategory[];
  match_requests?: MatchRequestRow[];
};

export type MatchRequestRow = {
  chat_thread_id?: string | null;
  created_at?: string | null;
  id: string;
  requester_display_name: string;
  requester_id: string;
  status: MatchRequestStatus;
};

export const MATCH_CATEGORY_OPTIONS: PlayerCategory[] = [1, 2, 3, 4, 5, 6, 7, 8];

export const MATCH_TYPE_OPTIONS: Array<{
  label: string;
  value: MatchType;
}> = [
    { label: 'Damas', value: 'damas' },
    { label: 'Libre', value: 'libre' },
    { label: 'Mixto', value: 'mixto' },
  ];