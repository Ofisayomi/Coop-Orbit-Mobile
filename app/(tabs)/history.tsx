import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiClient } from '@/services/httpClient';
import { getValidAccessToken } from '@/services/authService';
import { jwtDecode } from 'jwt-decode';

interface Transaction {
  id: string;
  transactionId: string;
  date: string;
  memberName: string;
  type: string;
  amount: number;
  status: string;
}

interface TransactionResponse {
  id: string;
  referenceNo: string;
  transactionType: string;
  status: string;
  amount: number;
  transactionDate: string;
  beneficiaryName?: string | null;
}

interface PaginatedTransactionResponse {
  items: TransactionResponse[];
  nextCursor?: string | null;
}

interface AccessTokenClaims {
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}

const TransactionHistoryScreen = () => {
  const { accountId, accountName } = useLocalSearchParams<{ accountId?: string; accountName?: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [canViewOrganizationTransactions, setCanViewOrganizationTransactions] = useState(false);
  const [showOrganizationTransactions, setShowOrganizationTransactions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async (lastId: string | null = null) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ pageSize: '100' });
      if (lastId) params.set('lastId', lastId);
      if (accountId) params.set('accountId', accountId);
      if (showOrganizationTransactions) params.set('includeOrganizationTransactions', 'true');

      const response = await apiClient.get(`/transactions?${params.toString()}`);
      if (!response.ok) throw new Error('Unable to load transactions');

      const data = await response.json() as PaginatedTransactionResponse;
      setTransactions(data.items.map((transaction) => ({
        id: transaction.id,
        transactionId: transaction.referenceNo || transaction.id,
        date: new Date(transaction.transactionDate).toLocaleDateString('en-NG'),
        memberName: transaction.beneficiaryName || '—',
        type: transaction.transactionType,
        amount: transaction.amount,
        status: transaction.status,
      })));
      setNextCursor(data.nextCursor ?? null);
    } catch {
      setTransactions([]);
      setNextCursor(null);
      setError('Unable to load transactions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [accountId, showOrganizationTransactions]);

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const token = await getValidAccessToken();
        const claims = jwtDecode<AccessTokenClaims>(token);
        const roles = [
          ...(claims.realm_access?.roles ?? []),
          ...Object.values(claims.resource_access ?? {}).flatMap((client) => client.roles ?? []),
        ];
        setCanViewOrganizationTransactions(roles.some((role) => ['Admin', 'Accountant', 'Secretary'].includes(role)));
      } catch {
        setCanViewOrganizationTransactions(false);
      }
    };

    void checkPermissions();
  }, []);

  useEffect(() => {
    const loadTimer = setTimeout(() => void loadTransactions(), 0);
    return () => clearTimeout(loadTimer);
  }, [loadTransactions]);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const tableBorder = isDark ? '#2D3748' : '#F7FAFC';
  const primary = '#173581';

  // Status colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Completed':
        return '#10B981';
      case 'Pending':
        return '#F59E0B';
      case 'Failed':
        return '#EF4444';
      default:
        return textSecondary;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Completed':
        return isDark ? '#064E3B' : '#D1FAE5';
      case 'Pending':
        return isDark ? '#78350F' : '#FEF3C7';
      case 'Failed':
        return isDark ? '#7F1D1D' : '#FEE2E2';
      default:
        return isDark ? '#2D3748' : '#F3F4F6';
    }
  };

  const getStatusIconName = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'Approved':
      case 'Completed':
        return 'checkmark-circle';
      case 'Pending':
        return 'time-outline';
      case 'Failed':
        return 'close-circle';
      default:
        return 'help-circle-outline';
    }
  };

  // Transaction type icon
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'Deposit':
        return 'arrow-down-circle-outline';
      case 'Withdrawal':
        return 'arrow-up-circle-outline';
      case 'Loan Repayment':
        return 'cash-outline';
      case 'Share Contribution':
        return 'trending-up-outline';
      case 'Dividend Payment':
        return 'gift-outline';
      default:
        return 'swap-horizontal-outline';
    }
  };

  // Get transaction color based on type
  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'Deposit':
        return '#10B981';
      case 'Withdrawal':
        return '#EF4444';
      case 'Loan Repayment':
        return '#F59E0B';
      case 'Share Contribution':
        return '#3B82F6';
      case 'Dividend Payment':
        return '#8B5CF6';
      default:
        return primary;
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.transactionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.memberName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = !selectedType || tx.type === selectedType;

    return matchesSearch && matchesType;
  });

  // Calculate totals
  const totalInflow = transactions
    .filter((tx) => tx.type !== 'Withdrawal')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalOutflow = transactions
    .filter((tx) => tx.type === 'Withdrawal')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const netMovement = totalInflow - totalOutflow;

  // Transaction types for filter
  const transactionTypes = [
    'Deposit',
    'Withdrawal',
    'Loan Repayment',
    'Share Contribution',
    'Dividend Payment',
  ];

  const renderTransactionRow = (transaction: Transaction) => {
    const statusColor = getStatusColor(transaction.status);
    return (
      <TouchableOpacity
        key={transaction.id}
        activeOpacity={0.7}
        onPress={() => setSelectedTransaction(transaction)}
        style={[
          styles.tableRow,
          {
            borderBottomColor: tableBorder,
            backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
          },
        ]}>
        <View style={styles.colDateRef}>
          <Text style={[styles.dateText, { color: textPrimary }]}>{transaction.date}</Text>
          <Text style={[styles.refText, { color: textSecondary }]} numberOfLines={1}>
            #{transaction.transactionId}
          </Text>
        </View>

        <View style={styles.colMemberType}>
          <Text style={[styles.memberNameText, { color: textPrimary }]} numberOfLines={1}>
            {transaction.memberName}
          </Text>
          <View style={styles.typeRow}>
            <Ionicons
              name={getTransactionIcon(transaction.type)}
              size={11}
              color={getTransactionTypeColor(transaction.type)}
            />
            <Text style={[styles.typeText, { color: textSecondary }]} numberOfLines={1}>
              {transaction.type}
            </Text>
          </View>
        </View>

        <View style={styles.colAmountStatus}>
          <Text style={[styles.amountText, { color: textPrimary }]}>
            ₦{transaction.amount.toLocaleString()}
          </Text>
          <View style={styles.statusRow}>
            <Ionicons
              name={getStatusIconName(transaction.status)}
              size={12}
              color={statusColor}
            />
            <Text style={[styles.compactStatusText, { color: statusColor }]}>
              {transaction.status}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: accountName ? `${accountName} Transactions` : 'Transaction History',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTintColor: textPrimary,
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Topmost description - Replicating Make Payment design */}
        <Text style={[styles.subtitle, { color: textSecondary, marginBottom: 20 }]}>
          {accountName
            ? `Viewing transactions for ${accountName}.`
            : showOrganizationTransactions ? 'Viewing organization transactions.' : 'Viewing your transactions.'}
        </Text>

        {canViewOrganizationTransactions && (
          <TouchableOpacity
            accessibilityRole="switch"
            accessibilityState={{ checked: showOrganizationTransactions }}
            onPress={() => setShowOrganizationTransactions((current) => !current)}
            style={[styles.organizationToggle, { backgroundColor: cardBg, borderColor: inputBorder }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.organizationToggleTitle, { color: textPrimary }]}>View all organization transactions</Text>
              <Text style={[styles.organizationToggleDescription, { color: textSecondary }]}>Includes transactions for every cooperative member.</Text>
            </View>
            <Ionicons name={showOrganizationTransactions ? 'toggle' : 'toggle-outline'} size={32} color={showOrganizationTransactions ? '#10B981' : textSecondary} />
          </TouchableOpacity>
        )}

        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          {/* Total Inflow */}
          <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.summaryLabel, { color: textSecondary }]}>Total Inflow</Text>
            <Text style={[styles.summaryAmount, { color: textPrimary }]}>
              ₦{totalInflow.toLocaleString()}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <Ionicons name="arrow-up" size={14} color="#10B981" />
              <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>+2.5%</Text>
            </View>
          </View>

          {/* Total Outflow */}
          <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.summaryLabel, { color: textSecondary }]}>Total Outflow</Text>
            <Text style={[styles.summaryAmount, { color: textPrimary }]}>
              ₦{totalOutflow.toLocaleString()}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <Ionicons name="arrow-up" size={14} color="#F59E0B" />
              <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600' }}>+1.8%</Text>
            </View>
          </View>

          {/* Net Movement */}
          <View style={[styles.summaryCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.summaryLabel, { color: textSecondary }]}>Net Movement</Text>
            <Text style={[styles.summaryAmount, { color: textPrimary }]}>
              ₦{netMovement.toLocaleString()}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <Ionicons name="arrow-up" size={14} color="#10B981" />
              <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>+0.7%</Text>
            </View>
          </View>
        </View>

        {/* Search and Filter */}
        <View style={styles.controlsContainer}>
          {/* Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: inputBg, borderColor: inputBorder }]}>
            <Ionicons name="search" size={16} color={textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: textPrimary }]}
              placeholder="Search by Member, ID, or Ref..."
              placeholderTextColor={textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Row */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              onPress={() => setSelectedType(null)}
              style={[
                styles.filterButton,
                {
                  backgroundColor: !selectedType ? primary : inputBg,
                  borderColor: !selectedType ? primary : inputBorder,
                },
              ]}>
              <Text
                style={[
                  styles.filterButtonText,
                  { color: !selectedType ? '#FFFFFF' : textSecondary },
                ]}>
                All Types
              </Text>
            </TouchableOpacity>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              style={{ flex: 1 }}>
              {transactionTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setSelectedType(selectedType === type ? null : type)}
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor: selectedType === type ? primary : inputBg,
                      borderColor: selectedType === type ? primary : inputBorder,
                    },
                  ]}>
                  <Text
                    style={[
                      styles.filterButtonText,
                      { color: selectedType === type ? '#FFFFFF' : textSecondary },
                    ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Transactions Table (Compact, No Horizontal Scrollbar) */}
        <View style={[styles.tableContainer, { backgroundColor: cardBg }]}>
          {/* Table Header */}
          <View
            style={[
              styles.tableHeader,
              {
                backgroundColor: isDark ? '#2A2A2A' : '#F9FAFB',
                borderBottomColor: tableBorder,
              },
            ]}>
            <View style={styles.colDateRef}>
              <Text style={[styles.headerText, { color: textPrimary }]}>Date / Ref</Text>
            </View>
            <View style={styles.colMemberType}>
              <Text style={[styles.headerText, { color: textPrimary }]}>Member / Type</Text>
            </View>
            <View style={styles.colAmountStatus}>
              <Text style={[styles.headerText, { color: textPrimary }]}>Amount / Status</Text>
            </View>
          </View>

          {/* Table Rows */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={primary} />
            </View>
          ) : filteredTransactions.length > 0 ? (
            filteredTransactions.map((transaction) => renderTransactionRow(transaction))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="mail-outline" size={48} color={textSecondary} />
              <Text style={[styles.emptyText, { color: textSecondary }]}>No transactions found</Text>
            </View>
          )}
        </View>

        {/* Pagination */}
        <View style={styles.paginationContainer}>
          <TouchableOpacity style={styles.paginationButton} disabled>
            <Ionicons name="chevron-back" size={20} color={textSecondary} />
            <Text style={[styles.paginationText, { color: textSecondary }]}>Previous</Text>
          </TouchableOpacity>

          <Text style={[styles.pageIndicator, { color: textSecondary }]}>Showing up to 100 transactions</Text>

          <TouchableOpacity style={styles.paginationButton} disabled={!nextCursor || isLoading} onPress={() => void loadTransactions(nextCursor)}>
            <Text style={[styles.paginationText, { color: primary }]}>Next</Text>
            <Ionicons name="chevron-forward" size={20} color={primary} />
          </TouchableOpacity>
        </View>

        {/* Export Button */}
        <TouchableOpacity
          style={[
            styles.exportButton,
            {
              backgroundColor: primary,
            },
          ]}>
          <Ionicons name="download-outline" size={18} color="#FFFFFF" />
          <Text style={styles.exportButtonText}>Export Data</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Transaction Details Modal */}
      <Modal
        visible={selectedTransaction !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTransaction(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: cardBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: tableBorder }]}>
              <Text style={[styles.modalHeaderTitle, { color: textPrimary }]}>Transaction Details</Text>
              <TouchableOpacity onPress={() => setSelectedTransaction(null)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={22} color={textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedTransaction && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
                <View style={styles.modalStatusSection}>
                  <View style={[styles.modalStatusIconCircle, { backgroundColor: getStatusBgColor(selectedTransaction.status) }]}>
                    <Ionicons
                      name={getStatusIconName(selectedTransaction.status)}
                      size={36}
                      color={getStatusColor(selectedTransaction.status)}
                    />
                  </View>
                  <Text style={[styles.modalAmount, { color: textPrimary }]}>
                    ₦{selectedTransaction.amount.toLocaleString()}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(selectedTransaction.status), marginTop: 8 }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(selectedTransaction.status), fontSize: 11 }]}>
                      Transaction {selectedTransaction.status}
                    </Text>
                  </View>
                </View>

                <View style={[styles.modalDetailsList, { borderColor: inputBorder }]}>
                  <View style={[styles.modalDetailRow, { borderBottomColor: tableBorder }]}>
                    <Text style={[styles.modalDetailLabel, { color: textSecondary }]}>Member Name</Text>
                    <Text style={[styles.modalDetailValue, { color: textPrimary }]}>{selectedTransaction.memberName}</Text>
                  </View>

                  <View style={[styles.modalDetailRow, { borderBottomColor: tableBorder }]}>
                    <Text style={[styles.modalDetailLabel, { color: textSecondary }]}>Transaction Type</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons
                        name={getTransactionIcon(selectedTransaction.type)}
                        size={14}
                        color={getTransactionTypeColor(selectedTransaction.type)}
                      />
                      <Text style={[styles.modalDetailValue, { color: textPrimary }]}>{selectedTransaction.type}</Text>
                    </View>
                  </View>

                  <View style={[styles.modalDetailRow, { borderBottomColor: tableBorder }]}>
                    <Text style={[styles.modalDetailLabel, { color: textSecondary }]}>Transaction Date</Text>
                    <Text style={[styles.modalDetailValue, { color: textPrimary }]}>{selectedTransaction.date}</Text>
                  </View>

                  <View style={[styles.modalDetailRow, { borderBottomWidth: 0 }]}>
                    <Text style={[styles.modalDetailLabel, { color: textSecondary }]}>Reference ID</Text>
                    <Text style={[styles.modalDetailValue, { color: textPrimary, fontSize: 12 }]} numberOfLines={1}>
                      {selectedTransaction.transactionId}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.modalDoneButton, { backgroundColor: primary }]}
                  onPress={() => setSelectedTransaction(null)}
                >
                  <Text style={styles.modalDoneButtonText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  organizationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  organizationToggleTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  organizationToggleDescription: {
    fontSize: 12,
    marginTop: 3,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginBottom: 16,
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  controlsContainer: {
    marginBottom: 24,
    gap: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 12,
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
  colDateRef: {
    flex: 1.1,
    justifyContent: 'center',
  },
  colMemberType: {
    flex: 1.5,
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
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  refText: {
    fontSize: 10,
    marginTop: 2,
  },
  memberNameText: {
    fontSize: 12,
    fontWeight: '600',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  typeText: {
    fontSize: 11,
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
    marginBottom: 20,
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
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paginationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  pageIndicator: {
    fontSize: 12,
    fontWeight: '500',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TransactionHistoryScreen;
