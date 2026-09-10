import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useResponsive } from '../../hooks/useResponsive';
import MatchCard from '../../components/MatchCard';
import { navigateToChatThread } from '../../navigation/navigationService';
import { getMatchHistory } from '../../services/matchService';
import type { Match } from '../../types/match';
import {
  getSnackbarErrorText,
  useSnackbar,
} from '../../components/SnackbarProvider';

export default function MatchHistoryScreen() {
  const { showError } = useSnackbar();
  const { isTablet, contentMaxWidth, contentPadding } = useResponsive();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date>();

  const loadMatches = useCallback(async () => {

    try {
      setMatches(await getMatchHistory());
      setUpdatedAt(new Date());
    } catch (error) {
      showError(getSnackbarErrorText(error, 'No se pudo cargar el historial de partidos.'));
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  const refreshMatches = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await loadMatches();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadMatches]);

  useFocusEffect(
    useCallback(() => {
      loadMatches();
    }, [loadMatches]),
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isTablet && { paddingHorizontal: contentPadding },
        ]}
        refreshControl={
          <RefreshControl
            colors={['#9fb629']}
            onRefresh={refreshMatches}
            refreshing={isRefreshing}
            tintColor="#9fb629"
          />
        }>
        <View
          style={isTablet ? { alignSelf: 'center', maxWidth: contentMaxWidth, width: '100%' } : undefined}>
          <Text style={styles.subtitle}>
            Consultá partidos pasados o archivados.
          </Text>

          {updatedAt ? (
            <Text style={styles.updatedAtText}>
              Actualizado {updatedAt.toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          ) : null}

          {isLoading ? (
            <ActivityIndicator size="large" color="#9fb629" />
          ) : matches.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No hay historial</Text>
              <Text style={styles.emptyText}>
                Los partidos pasados o eliminados aparecerán acá.
              </Text>
            </View>
          ) : (
            <View style={[styles.matchesList, isTablet && { flexDirection: 'row', flexWrap: 'wrap' }]}>
              {matches.map(match => (
                <View key={match.id} style={isTablet ? { width: '48%', marginBottom: 14 } : { marginBottom: 14 }}>
                  <MatchCard
                    hideActions
                    match={match}
                    onCancelMatch={() => undefined}
                    onCompleteMatch={() => undefined}
                    onConfirmRequest={() => undefined}
                    onNavigateToChat={navigateToChatThread}
                    onRejectRequest={() => undefined}
                    onRequestToPlay={() => undefined}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#252628',
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: '#1e1f20',
    borderColor: '#374151',
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  matchesList: {
    gap: 14,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
    textAlign: 'center',
  },
  updatedAtText: {
    color: '#9ca3af',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
});