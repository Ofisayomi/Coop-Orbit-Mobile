import { Ionicons } from '@expo/vector-icons';
import { Stack, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCurrentUserRoles, PRIVILEGED_MEMBER_ROLES } from '@/services/authService';
import {
  SupportService,
  type SupportTicketDto,
  type SupportTicketStatus,
} from '@/services/support-service';

type StatusFilter = 'All' | SupportTicketStatus;

const STATUS_FILTERS: StatusFilter[] = ['All', 'Open', 'Resolved'];

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });
}

const SupportTicketsScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('All');
  const [isAdmin, setIsAdmin] = useState(false);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const tableBorder = isDark ? '#2D3748' : '#F7FAFC';
  const primary = '#173581';

  const fetchTickets = useCallback(async (filter: StatusFilter) => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, roles] = await Promise.all([
        SupportService.getTickets(filter),
        getCurrentUserRoles().catch(() => [] as string[]),
      ]);
      setTickets(data);
      setIsAdmin(roles.some((role) => PRIVILEGED_MEMBER_ROLES.includes(role)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load support tickets');
      setTickets([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Refetch every time the screen gains focus (HTTP-based, no sockets).
  // Uses expo-router's pathname state instead of navigation-context focus
  // hooks, so a duplicated @react-navigation install can never break it.
  const pathname = usePathname();
  const wasFocusedRef = useRef(false);
  const lastFilterRef = useRef<StatusFilter | null>(null);
  useEffect(() => {
    const isFocused = pathname === '/support-tickets';
    if (isFocused && (!wasFocusedRef.current || activeFilter !== lastFilterRef.current)) {
      lastFilterRef.current = activeFilter;
      void fetchTickets(activeFilter);
    }
    wasFocusedRef.current = isFocused;
  }, [pathname, activeFilter, fetchTickets]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchTickets(activeFilter);
  }, [activeFilter, fetchTickets]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return '#3B82F6';
      case 'AwaitingMember':
        return '#F59E0B';
      case 'Resolved':
        return '#10B981';
      default:
        return textSecondary;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'Open':
        return isDark ? '#1E3A8A' : '#DBEAFE';
      case 'AwaitingMember':
        return isDark ? '#78350F' : '#FEF3C7';
      case 'Resolved':
        return isDark ? '#064E3B' : '#D1FAE5';
      default:
        return isDark ? '#2D3748' : '#F3F4F6';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: isAdmin ? 'Member Support' : 'Help & Support',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTintColor: textPrimary,
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: textPrimary }]}>
            {isAdmin ? 'Member Support' : 'Help & Support'}
          </Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>
            {isAdmin ? 'Respond to member issues' : 'Get help with your account'}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {/* Status filter tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
          {STATUS_FILTERS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeFilter === tab && { borderBottomColor: primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveFilter(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeFilter === tab ? primary : textSecondary },
                ]}
              >
                {tab === 'All' ? 'All' : tab === 'Open' ? 'Open' : 'Resolved'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Ticket cards */}
        <View style={[styles.tableContainer, { backgroundColor: cardBg }]}>
          {isLoading && !isRefreshing ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={primary} />
              <Text style={[styles.emptyText, { color: textSecondary }]}>Loading tickets…</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={[styles.emptyText, { color: textPrimary }]}>Failed to load tickets</Text>
              <Text style={[styles.emptySubText, { color: textSecondary }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: primary }]}
                onPress={() => void fetchTickets(activeFilter)}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : tickets.length > 0 ? (
            tickets.map((ticket) => (
              <TouchableOpacity
                key={ticket.id}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/ticket-detail', params: { id: ticket.id } })}
                style={[
                  styles.tableRow,
                  {
                    borderBottomColor: tableBorder,
                    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                  },
                ]}
              >
                <View style={styles.ticketMain}>
                  <View style={styles.ticketTopRow}>
                    <View
                      style={[styles.statusPill, { backgroundColor: getStatusBgColor(ticket.status) }]}
                    >
                      <Text style={[styles.statusPillText, { color: getStatusColor(ticket.status) }]}>
                        {ticket.status === 'AwaitingMember' ? 'Awaiting you' : ticket.status}
                      </Text>
                    </View>
                    <Text style={[styles.ticketNumber, { color: textSecondary }]} numberOfLines={1}>
                      {ticket.ticketNumber}
                    </Text>
                  </View>
                  <Text style={[styles.subjectText, { color: textPrimary }]} numberOfLines={2}>
                    {ticket.subject}
                  </Text>
                  <Text style={[styles.metaText, { color: textSecondary }]} numberOfLines={1}>
                    {isAdmin ? `${ticket.memberName} • ` : ''}{ticket.category} • {formatDate(ticket.updatedAt)} • {ticket.messageCount} {ticket.messageCount === 1 ? 'reply' : 'replies'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={textSecondary} />
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubble-ellipses-outline" size={48} color={textSecondary} />
              <Text style={[styles.emptyText, { color: textSecondary }]}>
                {activeFilter === 'All' ? 'No support tickets yet' : `No ${activeFilter.toLowerCase()} tickets`}
              </Text>
              {!isAdmin && activeFilter === 'All' ? (
                <Text style={[styles.emptySubText, { color: textSecondary }]}>
                  Tap “New Ticket” below to get help from support.
                </Text>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Members create tickets; admins reply to existing ones */}
      {!isAdmin && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: primary }]}
          onPress={() => router.push('/create-ticket')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>New Ticket</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  tabsContainer: {
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tableContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    width: '100%',
    marginBottom: 24,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  ticketMain: {
    flex: 1,
    gap: 4,
  },
  ticketTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ticketNumber: {
    fontSize: 11,
    fontWeight: '600',
  },
  subjectText: {
    fontSize: 13,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 11,
  },
  emptyContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  emptySubText: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SupportTicketsScreen;
