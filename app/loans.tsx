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
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
    AccountService,
    type LoanRequestDto,
    type PaginatedLoanRequestsResponse
} from '@/services/accountService';

type StatusTab = 'All' | 'Pending' | 'Approved' | 'Rejected' | 'Disbursed' | 'Completed';

const STATUS_TABS: StatusTab[] = ['All', 'Pending', 'Approved', 'Rejected', 'Disbursed', 'Completed'];

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });
}

const LoanManagementScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loans, setLoans] = useState<LoanRequestDto[]>([]);
  const [paginationData, setPaginationData] = useState<PaginatedLoanRequestsResponse | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<StatusTab>('All');

  const fetchLoans = useCallback(async (cursor: string | null = null) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await AccountService.getLoanRequests(cursor);
      setPaginationData(data);
      setLoans(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load loan requests');
      setLoans([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchLoans(cursorHistory[currentIndex] ?? null);
  }, [currentIndex, fetchLoans]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    setCursorHistory([null]);
    setCurrentIndex(0);
    void fetchLoans(null);
  }, [fetchLoans]);

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

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const tableBorder = isDark ? '#2D3748' : '#F7FAFC';
  const primary = '#173581';

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'completed':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'disbursed':
        return '#3B82F6';
      case 'rejected':
      case 'failed':
        return '#EF4444';
      default:
        return textSecondary;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'completed':
        return isDark ? '#064E3B' : '#D1FAE5';
      case 'pending':
        return isDark ? '#78350F' : '#FEF3C7';
      case 'disbursed':
        return isDark ? '#0C2340' : '#DBEAFE';
      case 'rejected':
      case 'failed':
        return isDark ? '#7F1D1D' : '#FEE2E2';
      default:
        return inputBg;
    }
  };

  const getStatusIconName = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'completed':
        return 'checkmark-circle';
      case 'pending':
        return 'time-outline';
      case 'disbursed':
        return 'shield-checkmark';
      case 'rejected':
      case 'failed':
        return 'close-circle';
      default:
        return 'help-circle-outline';
    }
  };

  const filteredLoans = loans.filter((loan) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (loan.applicantName || '').toLowerCase().includes(q) ||
      (loan.loanName || '').toLowerCase().includes(q) ||
      (loan.status || '').toLowerCase().includes(q) ||
      loan.id.toLowerCase().includes(q);
    const matchesStatus =
      activeTab === 'All' || (loan.status || '').toLowerCase() === activeTab.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const handleNewLoan = () => {
    router.push('/request-loan');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { borderColor: inputBorder, backgroundColor: cardBg }]}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textPrimary }]}>Loan Management</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Manage Loans</Text>
        </View>
        <TouchableOpacity style={[styles.newLoanButton, { backgroundColor: primary }]} onPress={handleNewLoan}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.newLoanButtonText}>New Loan</Text>
        </TouchableOpacity>
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
            placeholder="Search by member, ID, or status..."
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

        {/* Status Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
          {STATUS_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && { borderBottomColor: primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? primary : textSecondary },
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Loans Table (Compact, No Horizontal Scrollbar) */}
        <View style={[styles.tableContainer, { backgroundColor: cardBg }]}>
          {/* Table Header */}
          <View
            style={[
              styles.tableHeader,
              {
                backgroundColor: isDark ? '#2A2A2A' : '#F9FAFB',
                borderBottomColor: tableBorder,
              },
            ]}
          >
            <View style={styles.colMemberType}>
              <Text style={[styles.headerText, { color: textPrimary }]}>Member / Type</Text>
            </View>
            <View style={styles.colDateId}>
              <Text style={[styles.headerText, { color: textPrimary }]}>Date / ID</Text>
            </View>
            <View style={styles.colAmountStatus}>
              <Text style={[styles.headerText, { color: textPrimary }]}>Amount / Status</Text>
            </View>
          </View>

          {/* Table Rows */}
          {isLoading && !isRefreshing ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={primary} />
              <Text style={[styles.emptyText, { color: textSecondary }]}>Loading loan requests…</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={[styles.emptyText, { color: textPrimary }]}>Failed to load loans</Text>
              <Text style={[styles.emptySubText, { color: textSecondary }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: primary }]}
                onPress={() => void fetchLoans(cursorHistory[currentIndex] ?? null)}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredLoans.length > 0 ? (
            filteredLoans.map((loan) => {
              const statusColor = getStatusColor(loan.status);
              return (
                <TouchableOpacity
                  key={loan.id}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({
                      pathname: '/loan-details',
                      params: {
                        id: loan.id,
                        applicantName: loan.applicantName,
                        loanName: loan.loanName,
                        amount: String(loan.amount),
                        status: loan.status,
                        created: loan.created,
                      },
                    })
                  }
                  style={[
                    styles.tableRow,
                    {
                      borderBottomColor: tableBorder,
                      backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                    },
                  ]}
                >
                  <View style={styles.colMemberType}>
                    <Text style={[styles.memberNameText, { color: textPrimary }]} numberOfLines={1}>
                      {loan.applicantName}
                    </Text>
                    <Text style={[styles.typeText, { color: textSecondary }]} numberOfLines={1}>
                      {loan.loanName}
                    </Text>
                  </View>

                  <View style={styles.colDateId}>
                    <Text style={[styles.dateText, { color: textPrimary }]}>{formatDate(loan.created)}</Text>
                    <Text style={[styles.refText, { color: textSecondary }]} numberOfLines={1}>
                      #{loan.id.slice(0, 8)}…
                    </Text>
                  </View>

                  <View style={styles.colAmountStatus}>
                    <Text style={[styles.amountText, { color: textPrimary }]}>
                      ₦{(loan.amount ?? 0).toLocaleString()}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: getStatusBgColor(loan.status) },
                      ]}
                    >
                      <Ionicons
                        name={getStatusIconName(loan.status)}
                        size={12}
                        color={statusColor}
                      />
                      <Text style={[styles.compactStatusText, { color: statusColor }]}>
                        {loan.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={48} color={textSecondary} />
              <Text style={[styles.emptyText, { color: textSecondary }]}>
                {loans.length === 0 ? 'No loan requests yet' : 'No loans match your filter'}
              </Text>
              {loans.length === 0 ? (
                <Text style={[styles.emptySubText, { color: textSecondary }]}>
                  Tap “New Loan” to submit your first loan request.
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Pagination */}
        {paginationData && (loans.length > 0 || currentIndex > 0) && (
          <View style={[styles.paginationCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
            <View>
              <Text style={[styles.paginationPageText, { color: textPrimary }]}>Page {currentIndex + 1}</Text>
              <Text style={[styles.paginationTotalText, { color: textSecondary }]}>
                {paginationData.totalItems} total request{paginationData.totalItems === 1 ? '' : 's'}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  newLoanButton: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    gap: 6,
  },
  newLoanButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
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
  tabsContainer: {
    marginBottom: 16,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginRight: 16,
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
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  colMemberType: {
    flex: 1.3,
    justifyContent: 'center',
  },
  colDateId: {
    flex: 1.1,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  colAmountStatus: {
    flex: 1.2,
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
  memberNameText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeText: {
    fontSize: 11,
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  refText: {
    fontSize: 10,
    marginTop: 2,
  },
  amountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  compactStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptySubText: {
    marginTop: 6,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  retryButton: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  paginationCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  paginationBtnDisabled: {
    opacity: 0.55,
  },
  paginationBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default LoanManagementScreen;
