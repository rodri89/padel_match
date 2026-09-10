import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

import LoadingButton from './LoadingButton';
import type { Match, MatchRequest } from '../types/match';
import type { MatchType } from '../types/match';

type Props = {
  hideActions?: boolean;
  isBusy?: boolean;
  isFocused?: boolean;
  match: Match;
  onCancelMatch: (match: Match) => void;
  onCompleteMatch: (match: Match) => void;
  onConfirmRequest: (request: MatchRequest) => void;
  onNavigateToChat: (chatThreadId: string) => void;
  onRejectRequest: (request: MatchRequest) => void;
  onRequestToPlay: (match: Match) => void;
};

function getRequestStatusLabel(status: MatchRequest['status']) {
  switch (status) {
    case 'confirmed':
      return 'Confirmado';
    case 'rejected':
      return 'Rechazado';
    case 'cancelled':
      return 'Cancelado';
    case 'pending':
    default:
      return 'Solicitud pendiente';
  }
}

function formatMatchDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  const formatted = new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getMatchTypeLabel(matchType: MatchType) {
  switch (matchType) {
    case 'damas':
      return 'Damas';
    case 'mixto':
      return 'Mixto';
    case 'libre':
    default:
      return 'Libre';
  }
}

function getMatchTypeBadgeStyle(matchType: MatchType) {
  switch (matchType) {
    case 'damas':
      return styles.matchTypeBadgeWomen;
    case 'mixto':
      return styles.matchTypeBadgeMixed;
    case 'libre':
    default:
      return styles.matchTypeBadgeOpen;
  }
}

function getMatchTypeTextStyle(matchType: MatchType) {
  switch (matchType) {
    case 'damas':
      return styles.matchTypeTextWomen;
    case 'mixto':
      return styles.matchTypeTextMixed;
    case 'libre':
    default:
      return styles.matchTypeTextOpen;
  }
}

function PlayerAvatar({
  avatarUrl,
  size = 32,
}: {
  avatarUrl?: string;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.playerAvatar,
          { borderRadius: size / 2, height: size, width: size },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.playerAvatarPlaceholder,
        { borderRadius: size / 2, height: size, width: size },
      ]}>
      <Icon name="person-outline" color="#9ca3af" size={size * 0.6} />
    </View>
  );
}

type PlayerRowProps = {
  avatarUrl?: string;
  chatThreadId?: string;
  displayName: string;
  onNavigateToChat?: (chatThreadId: string) => void;
  rightAction?: React.ReactNode;
};

function PlayerRow({
  avatarUrl,
  chatThreadId,
  displayName,
  onNavigateToChat,
  rightAction,
}: PlayerRowProps) {
  const content = (
    <View style={styles.playerRow}>
      <PlayerAvatar avatarUrl={avatarUrl} />
      <Text style={styles.playerName} numberOfLines={1}>
        {displayName}
      </Text>
      {rightAction}
    </View>
  );

  if (chatThreadId && onNavigateToChat) {
    return (
      <Pressable
        onPress={() => onNavigateToChat(chatThreadId)}
        style={({ pressed }) => [
          styles.playerRowTouchable,
          pressed && styles.playerRowPressed,
        ]}>
        {content}
        <Icon name="chatbubble-ellipses-outline" color="#9fb629" size={18} />
      </Pressable>
    );
  }

  return content;
}

export default function MatchCard({
  hideActions,
  isBusy,
  isFocused,
  match,
  onCancelMatch,
  onCompleteMatch,
  onConfirmRequest,
  onNavigateToChat,
  onRejectRequest,
  onRequestToPlay,
}: Props) {
  // `isBusy` es de toda la tarjeta, así que sin esto girarían todos los botones
  // a la vez. Guardo cuál se tocó para que el spinner salga sólo en ese.
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    if (!isBusy) {
      setPendingAction(null);
    }
  }, [isBusy]);

  function runAction(action: string, run: () => void) {
    setPendingAction(action);
    run();
  }

  function isActionLoading(action: string) {
    return isBusy && pendingAction === action;
  }

  const canRequestToPlay =
    !hideActions && !match.isCreator && match.status === 'open' && !match.currentUserRequest;
  const canCancelMatch = !hideActions && match.isCreator && match.status === 'open';
  const canCompleteMatch = !hideActions && match.isCreator && match.status === 'open';
  const hasPendingRequests =
    !hideActions && match.isCreator && match.pendingRequests.length > 0;

  return (
    <View style={[styles.card, hasPendingRequests && styles.cardHighlighted, isFocused && styles.cardFocused]}>
      {hasPendingRequests ? (
        <View style={styles.pendingAlertBadge}>
          <Icon name="flash-outline" color="#c2410c" size={16} />
          <Text style={styles.pendingAlertText}>Nueva solicitud</Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.complexName}>{match.complexName}</Text>
          <Text style={styles.locationText}>
            {match.city}
            {match.province ? `, ${match.province}` : ''}
          </Text>
        </View>
        <View style={styles.badgesBlock}>
          <View style={[styles.matchTypeBadge, getMatchTypeBadgeStyle(match.matchType)]}>
            <Text style={[styles.matchTypeText, getMatchTypeTextStyle(match.matchType)]}>
              {getMatchTypeLabel(match.matchType)}
            </Text>
          </View>
          <View style={[styles.statusBadge, match.status !== 'open' && styles.statusBadgeMuted]}>
            <Text style={styles.statusText}>
              {match.status === 'open' ? 'Abierto' : 'Completo'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Icon name="calendar-outline" color="#9ca3af" size={18} />
        <Text style={styles.infoText}>
          {formatMatchDate(match.matchDate)} a las {match.startTime} hs
        </Text>
      </View>
      <View style={styles.infoRow}>
        <Icon name="people-outline" color="#9ca3af" size={18} />
        <Text style={styles.infoText}>
          Faltan {match.missingPlayers} jugador{match.missingPlayers === 1 ? '' : 'es'}
        </Text>
      </View>
      <View style={styles.infoRow}>
        <Icon name="trophy-outline" color="#9ca3af" size={18} />
        <Text style={styles.infoText}>
          Categorías: {match.targetCategories.join(', ')}
        </Text>
      </View>
      <View style={styles.infoRow}>
        <View style={styles.creatorAvatarContainer}>
          {match.creatorAvatarUrl ? (
            <Image
              source={{ uri: match.creatorAvatarUrl }}
              style={styles.creatorAvatar}
            />
          ) : (
            <Icon name="person-circle-outline" color="#6b7280" size={24} />
          )}
        </View>
        <Text style={styles.infoText}>Creador: {match.creatorDisplayName}</Text>
      </View>

      {match.currentUserRequest ? (
        <Pressable
          onPress={() => {
            if (match.currentUserRequest?.chatThreadId) {
              onNavigateToChat(match.currentUserRequest.chatThreadId);
            }
          }}
          style={({ pressed }) => [
            styles.requestStatusContainer,
            pressed && styles.playerRowPressed,
          ]}>
          <PlayerAvatar
            avatarUrl={match.currentUserRequest.requesterAvatarUrl}
          />
          <Text style={styles.requestStatusText}>
            {getRequestStatusLabel(match.currentUserRequest.status)}
          </Text>
          {match.currentUserRequest.chatThreadId ? (
            <Icon name="chatbubble-ellipses-outline" color="#9fb629" size={18} />
          ) : null}
        </Pressable>
      ) : null}

      {match.isCreator && match.confirmedRequests.length > 0 ? (
        <View style={styles.confirmedSection}>
          <Text style={styles.requestsTitle}>Jugadores confirmados</Text>
          {match.confirmedRequests.map(request => (
            <PlayerRow
              key={request.id}
              avatarUrl={request.requesterAvatarUrl}
              chatThreadId={request.chatThreadId}
              displayName={request.requesterDisplayName}
              onNavigateToChat={!hideActions ? onNavigateToChat : undefined}
            />
          ))}
        </View>
      ) : null}

      {canRequestToPlay ? (
        <LoadingButton
          disabled={isBusy}
          disabledStyle={styles.disabledButton}
          label="Quiero jugar"
          loading={isActionLoading('request')}
          loadingLabel="Enviando..."
          onPress={() => runAction('request', () => onRequestToPlay(match))}
          style={styles.primaryButton}
          textStyle={styles.primaryButtonText}
        />
      ) : null}

      {canCancelMatch ? (
        <View style={styles.creatorActions}>
          {canCompleteMatch ? (
            <LoadingButton
              disabled={isBusy}
              disabledStyle={styles.disabledButton}
              icon="checkmark-circle-outline"
              label="Partido completo"
              loading={isActionLoading('complete')}
              loadingLabel="Guardando..."
              onPress={() => runAction('complete', () => onCompleteMatch(match))}
              style={styles.completeButton}
              textStyle={styles.completeButtonText}
            />
          ) : null}
          <LoadingButton
            disabled={isBusy}
            disabledStyle={styles.disabledButton}
            icon="trash-outline"
            iconColor="#dc2626"
            label="Eliminar partido"
            loading={isActionLoading('cancel')}
            loadingLabel="Eliminando..."
            onPress={() => runAction('cancel', () => onCancelMatch(match))}
            spinnerColor="#dc2626"
            style={styles.cancelButton}
            textStyle={styles.cancelButtonText}
          />
        </View>
      ) : null}

      {!hideActions && match.isCreator && match.pendingRequests.length > 0 ? (
        <View style={styles.requestsSection}>
          <Text style={styles.requestsTitle}>Solicitudes pendientes</Text>
          {match.pendingRequests.map(request => (
            <View key={request.id} style={styles.requestItem}>
              <View style={styles.requestItemLeft}>
                <PlayerAvatar avatarUrl={request.requesterAvatarUrl} />
                <Text style={styles.requestName}>{request.requesterDisplayName}</Text>
              </View>
              <View style={styles.requestActions}>
                <LoadingButton
                  disabled={isBusy}
                  disabledStyle={styles.disabledButton}
                  label="Confirmar"
                  loading={isActionLoading(`confirm:${request.id}`)}
                  onPress={() =>
                    runAction(`confirm:${request.id}`, () => onConfirmRequest(request))
                  }
                  style={styles.confirmButton}
                  textStyle={styles.confirmButtonText}
                />
                <LoadingButton
                  disabled={isBusy}
                  disabledStyle={styles.disabledButton}
                  label="Rechazar"
                  loading={isActionLoading(`reject:${request.id}`)}
                  onPress={() =>
                    runAction(`reject:${request.id}`, () => onRejectRequest(request))
                  }
                  spinnerColor="#dc2626"
                  style={styles.rejectButton}
                  textStyle={styles.rejectButtonText}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badgesBlock: {
    alignItems: 'flex-end',
    gap: 6,
  },
  card: {
    backgroundColor: '#1e1f20',
    borderColor: '#374151',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  cardHighlighted: {
    backgroundColor: '#2a1f0e',
    borderColor: '#9fb629',
    borderWidth: 2,
    elevation: 6,
    shadowColor: '#9fb629',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  complexName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: '#dc2626',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '800',
  },
  confirmButton: {
    backgroundColor: '#9fb629',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  completeButton: {
    alignItems: 'center',
    backgroundColor: '#9fb629',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  confirmedSection: {
    backgroundColor: '#1e1f20',
    borderColor: '#7a8f20',
    borderWidth: 1,
    borderRadius: 12,
    gap: 8,
    padding: 12,
  },
  creatorAvatar: {
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  creatorAvatarContainer: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  creatorActions: {
    gap: 10,
    marginTop: 4,
  },
  cardFocused: {
    borderColor: '#9fb629',
    borderWidth: 2,
    elevation: 8,
    shadowColor: '#9fb629',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  disabledButton: {
    opacity: 0.65,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  infoText: {
    color: '#e2e8f0',
    flex: 1,
    fontSize: 15,
  },
  locationText: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 2,
  },
  matchTypeBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  matchTypeBadgeMixed: {
    backgroundColor: '#ffedd5',
  },
  matchTypeBadgeOpen: {
    backgroundColor: '#dbeafe',
  },
  matchTypeBadgeWomen: {
    backgroundColor: '#fce7f3',
  },
  matchTypeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  matchTypeTextMixed: {
    color: '#c2410c',
  },
  matchTypeTextOpen: {
    color: '#1d4ed8',
  },
  matchTypeTextWomen: {
    color: '#be185d',
  },
  playerAvatar: {
    backgroundColor: '#374151',
  },
  playerAvatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: '#252628',
    justifyContent: 'center',
  },
  playerName: {
    color: '#ffffff',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  playerRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  playerRowTouchable: {
    alignItems: 'center',
    backgroundColor: '#252628',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    padding: 10,
  },
  playerRowPressed: {
    opacity: 0.7,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#9fb629',
    borderRadius: 12,
    marginTop: 4,
    paddingVertical: 13,
  },
  pendingAlertBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#ffedd5',
    borderColor: '#fdba74',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pendingAlertText: {
    color: '#c2410c',
    fontSize: 13,
    fontWeight: '900',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  rejectButton: {
    borderColor: '#dc2626',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  rejectButtonText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '800',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  requestItem: {
    alignItems: 'center',
    backgroundColor: '#252628',
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
  },
  requestItemLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    paddingRight: 8,
  },
  requestName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  requestStatusContainer: {
    alignItems: 'center',
    backgroundColor: '#1e1f20',
    borderColor: '#7a8f20',
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  requestStatusText: {
    color: '#9fb629',
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  requestsSection: {
    borderTopColor: '#374151',
    borderTopWidth: 1,
    gap: 10,
    marginTop: 4,
    paddingTop: 12,
  },
  requestsTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  statusBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeMuted: {
    backgroundColor: '#374151',
  },
  statusText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '800',
  },
  titleBlock: {
    flex: 1,
  },
});