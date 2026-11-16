import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  AccountService,
  type MemberDto,
  type PaginatedMembersResponse,
} from '@/services/accountService';

function memberDisplayName(member: MemberDto): string {
  const full = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return full || member.userName || 'Unknown member';
}

const MembersScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [members, setMembers] = useState<MemberDto[]>([]);
  const [paginationData, setPaginationData] = useState<PaginatedMembersResponse | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const tableBorder = isDark ? '#2D3748' : '#F7FAFC';
  const primary = '#173581';

  // Debounce the search input so each keystroke doesn't hit the backend.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchMembers = useCallback(async (cursor: string | null = null, search: string = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await AccountService.getMembers({ lastId: cursor, search });
      setPaginationData(data);
      setMembers(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load members');
      setMembers([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Reset to the first page whenever the search term changes.
  useEffect(() => {
    setCursorHistory([null]);
    setCurrentIndex(0);
    void fetchMembers(null, debouncedSearch);
  }, [debouncedSearch, fetchMembers]);

  useEffect(() => {
    if (currentIndex === 0) return;
    void fetchMembers(cursorHistory[currentIndex] ?? null, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    setCursorHistory([null]);
    setCurrentIndex(0);
    void fetchMembers(null, debouncedSearch);
  }, [debouncedSearch, fetchMembers]);

  const handleNextPage = () => {
    const nextCursor = paginationData?.nextCursor;
    if (paginationData?.hasNextPage && nextCursor) {
      if (currentIndex === cursorHistory.length - 1) {
        setCursorHistory((prev) => [...prev, nextCursor]);
      }
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  const isNextDisabled = !paginationData?.hasNextPage || isLoading;
  const isPrevDisabled = currentIndex === 0 || isLoading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Members',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTintColor: textPrimary,
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: textPrimary }]}>Members</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>
            Organization member directory
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {/* Search Bar */}
        <View style={[styles.searchBox, { backgroundColor: cardBg, borderColor: inputBorder }]}>
          <Ionicons name="search" size={18} color={textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: textPrimary }]}
            placeholder="Search by name, username, or member ID..."
            placeholderTextColor={textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Members Table */}
        <View style={[styles.tableContainer, { backgroundColor: cardBg }]}>
          <View
            style={[
              styles.tableHeader,
              {
                backgroundColor: isDark ? '#2A2A2A' : '#F9FAFB',
                borderBottomColor: tableBorder,
              },
            ]}
          >
            <View style={styles.colMember}>
              <Text style={[styles.headerText, { color: textPrimary }]}>Member</Text>
            </View>
            <View style={styles.colId}>
              <Text style={[styles.headerText, { color: textPrimary }]}>Member ID</Text>
            </View>
          </View>

          {isLoading && !isRefreshing ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={primary} />
              <Text style={[styles.emptyText, { color: textSecondary }]}>Loading members…</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={[styles.emptyText, { color: textPrimary }]}>Failed to load members</Text>
              <Text style={[styles.emptySubText, { color: textSecondary }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: primary }]}
                onPress={() => void fetchMembers(cursorHistory[currentIndex] ?? null, debouncedSearch)}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : members.length > 0 ? (
            members.map((member) => (
              <TouchableOpacity
                key={member.id}
                activeOpacity={0.7}
                onPress={() =>
                  router.push({ pathname: '/member-details', params: { id: member.id } })
                }
                style={[
                  styles.tableRow,
                  {
                    borderBottomColor: tableBorder,
                    backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                  },
                ]}
              >
                <View style={styles.memberLeft}>
                  <View style={[styles.avatarCircle, { backgroundColor: primary }]}>
                    <Text style={styles.avatarText}>
                      {memberDisplayName(member).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberNameText, { color: textPrimary }]} numberOfLines={1}>
                      {memberDisplayName(member)}
                    </Text>
                    <Text style={[styles.usernameText, { color: textSecondary }]} numberOfLines={1}>
                      @{member.userName ?? 'unknown'}
                    </Text>
                  </View>
                </View>
                <View style={styles.colIdValue}>
                  <Text style={[styles.memberIdText, { color: textPrimary }]} numberOfLines={1}>
                    {member.membershipId ?? '—'}
                  </Text>
                  <Text style={[styles.typeText, { color: textSecondary }]} numberOfLines={1}>
                    {member.membershipType ?? member.role ?? ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={textSecondary} />
              <Text style={[styles.emptyText, { color: textSecondary }]}>
                {debouncedSearch ? 'No members match your search' : 'No members found'}
              </Text>
            </View>
          )}
        </View>

        {/* Pagination */}
        {paginationData && (members.length > 0 || currentIndex > 0) && (
          <View style={[styles.paginationCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
            <View>
              <Text style={[styles.paginationPageText, { color: textPrimary }]}>Page {currentIndex + 1}</Text>
              <Text style={[styles.paginationTotalText, { color: textSecondary }]}>
                {paginationData.totalItems} total member{paginationData.totalItems === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.paginationButtonsRow}>
              <TouchableOpacity
                style={[styles.paginationBtn, { borderColor: inputBorder, backgroundColor: inputBg }, isPrevDisabled && styles.paginationBtnDisabled]}
                disabled={isPrevDisabled}
                onPress={handlePrevPage}
              >
                <Ionicons name="chevron-back" size={16} color={isPrevDisabled ? '#9CA3AF' : primary} />
                <Text style={[styles.paginationBtnText, { color: isPrevDisabled ? '#9CA3AF' : primary }]}>Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paginationBtn, { borderColor: inputBorder, backgroundColor: inputBg }, isNextDisabled && styles.paginationBtnDisabled]}
                disabled={isNextDisabled}
                onPress={handleNextPage}
              >
                <Text style={[styles.paginationBtnText, { color: isNextDisabled ? '#9CA3AF' : primary }]}>Next</Text>
                <Ionicons name="chevron-forward" size={16} color={isNextDisabled ? '#9CA3AF' : primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
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
    paddingBottom: 32,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
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
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  colMember: {
    flex: 1.4,
    justifyContent: 'center',
  },
  colId: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  memberLeft: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  memberNameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  usernameText: {
    fontSize: 11,
    marginTop: 2,
  },
  colIdValue: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  memberIdText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeText: {
    fontSize: 11,
    marginTop: 2,
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
  paginationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  paginationPageText: {
    fontSize: 13,
    fontWeight: '700',
  },
  paginationTotalText: {
    fontSize: 11,
    marginTop: 2,
  },
  paginationButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paginationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  paginationBtnDisabled: {
    opacity: 0.6,
  },
  paginationBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default MembersScreen;
