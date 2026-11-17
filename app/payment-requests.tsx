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
import { apiClient } from '@/services/http-client';

export interface PaymentRequestAccountDto {
  accountId: string;
  accountName: string;
  amount: number;
  percentage?: number;
}

export interface PaymentRequestsDto {
  id: string;
  amount: number;
  beneficiaryName: string;
  beneficiaryId?: string;
  status: string;
  accountCount: number;
  transactionDate: string;
  createdAt?: string;
  membershipId?: string;
  requestAccounts?: PaymentRequestAccountDto[];
}

export interface PaymentRequestStatsDto {
  totalPending: number;
  totalAmountRequested: number;
  totalProcessedToday: number;
}

export interface PaginatedPaymentRequestsResponse {
  items: PaymentRequestsDto[];
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  totalItems: number;
  nextCursor?: string | null;
}

export default function PaymentRequestsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [requests, setRequests] = useState<PaymentRequestsDto[]>([]);
  const [paginationData, setPaginationData] = useState<PaginatedPaymentRequestsResponse | null>(null);
  const [cursorHistory, setCursorHistory] = useState<(string | null)[]>([null]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stats, setStats] = useState<PaymentRequestStatsDto>({
    totalPending: 0,
    totalAmountRequested: 0,
    totalProcessedToday: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const tableBorder = isDark ? '#2D3748' : '#F7FAFC';
  const primary = '#173581';

  const fetchRequests = useCallback(async (cursor: string | null = null) => {
    setIsLoading(true);
    setError(null);
    try {
      const query = cursor ? `?lastId=${encodeURIComponent(cursor)}` : '';
      const [requestsRes, statsRes] = await Promise.all([
        apiClient.get(`/paymentrequests${query}`).catch(() => null),
        cursor ? Promise.resolve(null) : apiClient.get('/paymentrequests/stats').catch(() => null),
      ]);

      if (requestsRes && requestsRes.ok) {
        const data = await requestsRes.json();
        setPaginationData({
          items: data.items || [],
          hasNextPage: Boolean(data.hasNextPage),
          hasPreviousPage: Boolean(data.hasPreviousPage),
          totalItems: data.totalItems ?? (data.items?.length || 0),
          nextCursor: data.nextCursor ?? null,
        });
        setRequests(data.items || []);
      } else if (!requestsRes) {
        throw new Error('Unable to load payment requests');
      }

      if (statsRes && statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData) {
          setStats(statsData);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load payment requests');
      setRequests([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchRequests(cursorHistory[currentIndex] ?? null);
  }, [currentIndex, fetchRequests]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => {
    setIsRefreshing(true);
    setCursorHistory([null]);
    setCurrentIndex(0);
    void fetchRequests(null);
  };

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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'rejected':
      case 'cancelled':
        return '#EF4444';
      default:
        return textSecondary;
    }
  };

  const getStatusIconName = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'checkmark-circle';
      case 'pending':
        return 'time-outline';
      case 'rejected':
      case 'cancelled':
        return 'close-circle';
      default:
        return 'help-circle-outline';
    }
  };

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    const matchesSearch =
      req.beneficiaryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab =
      activeTab === 'All' || req.status.toLowerCase() === activeTab.toLowerCase();
    return matchesSearch && matchesTab;
  });



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
          <Text style={[styles.title, { color: textPrimary }]}>Payment Requests</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>
            Review and manage split payment requests
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.newRequestButton, { backgroundColor: primary }]}
          onPress={() => router.push('/make-payment')}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.newRequestButtonText}>New Request</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={primary} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.statLabel, { color: textSecondary }]}>Total Pending</Text>
            <Text style={[styles.statAmount, { color: '#F59E0B' }]}>
              ₦{stats.totalPending.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.statLabel, { color: textSecondary }]}>Total Requested</Text>
            <Text style={[styles.statAmount, { color: textPrimary }]}>
              ₦{stats.totalAmountRequested.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.statLabel, { color: textSecondary }]}>Processed Today</Text>
            <Text style={[styles.statAmount, { color: '#10B981' }]}>
              ₦{stats.totalProcessedToday.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBox, { backgroundColor: cardBg, borderColor: inputBorder }]}>
          <Ionicons name="search" size={18} color={textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: textPrimary }]}
            placeholder="Search by initiator or ID..."
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
          {['All', 'Pending', 'Approved', 'Rejected'].map((tab) => (
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

        {/* Payment Requests Table (Compact, No Horizontal Scrollbar) */}
        <View style={[styles.tableContainer, { backgroundColor: cardBg }]}>
          {/* Header */}
          <View
            style={[
              styles.tableHeader,
              {
                backgroundColor: isDark ? '#2A2A2A' : '#F9FAFB',
                borderBottomColor: tableBorder,
              },
            ]}
          >
            <View style={styles.colInitiator}>
              <Text style={[styles.headerText, { color: textPrimary }]}>Initiator / ID</Text>
            </View>
            <View style={styles.colDateSplit}>
              <Text style={[styles.headerText, { color: textPrimary }]}>Date / Split</Text>
            </View>
            <View style={styles.colAmountStatus}>
              <Text style={[styles.headerText, { color: textPrimary }]}>Amount / Status</Text>
            </View>
          </View>

          {/* Table Rows */}
          {isLoading && !isRefreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={primary} />
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text style={[styles.emptyText, { color: textPrimary }]}>Failed to load requests</Text>
              <Text style={[styles.emptySubText, { color: textSecondary }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: primary }]}
                onPress={() => void fetchRequests(cursorHistory[currentIndex] ?? null)}
              >
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : filteredRequests.length > 0 ? (
            filteredRequests.map((req) => {
              const statusColor = getStatusColor(req.status);
              const formattedDate = new Date(req.transactionDate).toLocaleDateString('en-NG', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <TouchableOpacity
                  key={req.id}
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push({ pathname: '/payment-request-details', params: { id: req.id } })
                  }
                  style={[
                    styles.tableRow,
                    {
                      borderBottomColor: tableBorder,
                      backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                    },
                  ]}
                >
                  <View style={styles.colInitiator}>
                    <Text style={[styles.initiatorText, { color: textPrimary }]} numberOfLines={1}>
                      {req.beneficiaryName}
                    </Text>
                    <Text style={[styles.refText, { color: textSecondary }]} numberOfLines={1}>
                      #{req.id}
                    </Text>
                  </View>

                  <View style={styles.colDateSplit}>
                    <Text style={[styles.dateText, { color: textPrimary }]}>{formattedDate}</Text>
                    <Text style={[styles.splitText, { color: textSecondary }]} numberOfLines={1}>
                      {req.accountCount} {req.accountCount === 1 ? 'account' : 'accounts'}
                    </Text>
                  </View>

                  <View style={styles.colAmountStatus}>
                    <Text style={[styles.amountText, { color: textPrimary }]}>
                      ₦{req.amount.toLocaleString()}
                    </Text>
                    <View style={styles.statusRow}>
                      <Ionicons
                        name={getStatusIconName(req.status)}
                        size={12}
                        color={statusColor}
                      />
                      <Text style={[styles.compactStatusText, { color: statusColor }]}>
                        {req.status}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="mail-outline" size={48} color={textSecondary} />
              <Text style={[styles.emptyText, { color: textSecondary }]}>No payment requests found</Text>
            </View>
          )}
        </View>

        {/* Pagination */}
        {paginationData && (requests.length > 0 || currentIndex > 0) && (
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
}

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
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  newRequestButton: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    gap: 4,
  },
  newRequestButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statAmount: {
    fontSize: 13,
    fontWeight: '700',
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
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  colInitiator: {
    flex: 1.3,
    justifyContent: 'center',
  },
  colDateSplit: {
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
  initiatorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  refText: {
    fontSize: 10,
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  splitText: {
    fontSize: 11,
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
  loadingContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
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
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContentCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  modalStatusSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalStatusIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalAmount: {
    fontSize: 26,
    fontWeight: '800',
  },
  modalDetailsList: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  modalDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalDetailLabel: {
    fontSize: 13,
  },
  modalDetailValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  breakdownSection: {
    marginBottom: 20,
  },
  breakdownTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  breakdownCard: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  breakdownAccName: {
    fontSize: 13,
    fontWeight: '600',
  },
  breakdownPercent: {
    fontSize: 11,
    marginTop: 2,
  },
  breakdownAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
    marginBottom: 12,
  },
  cancelButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  modalDoneButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

