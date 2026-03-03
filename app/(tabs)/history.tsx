import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';

// Dummy transaction data structure
interface Transaction {
  id: string;
  transactionId: string;
  date: string;
  memberName: string;
  type: 'Deposit' | 'Withdrawal' | 'Loan Repayment' | 'Share Contribution' | 'Dividend Payment';
  amount: number;
  status: 'Completed' | 'Pending' | 'Failed';
}

const DUMMY_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    transactionId: 'TXN-85720',
    date: '2023-10-26',
    memberName: 'Bisi Adekunle',
    type: 'Deposit',
    amount: 50000,
    status: 'Completed',
  },
  {
    id: '2',
    transactionId: 'TXN-85719',
    date: '2023-10-26',
    memberName: 'Chinedu Okoro',
    type: 'Loan Repayment',
    amount: 15000,
    status: 'Completed',
  },
  {
    id: '3',
    transactionId: 'TXN-85718',
    date: '2023-10-25',
    memberName: 'Amina Bello',
    type: 'Withdrawal',
    amount: 25000,
    status: 'Completed',
  },
  {
    id: '4',
    transactionId: 'TXN-85717',
    date: '2023-10-25',
    memberName: 'Tunde Williams',
    type: 'Share Contribution',
    amount: 10000,
    status: 'Pending',
  },
  {
    id: '5',
    transactionId: 'TXN-85716',
    date: '2023-10-24',
    memberName: 'Fatima Garba',
    type: 'Deposit',
    amount: 75000,
    status: 'Completed',
  },
  {
    id: '6',
    transactionId: 'TXN-85714',
    date: '2023-10-23',
    memberName: 'Bisi Adekunle',
    type: 'Withdrawal',
    amount: 5000,
    status: 'Failed',
  },
];

const TransactionHistoryScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [transactions, setTransactions] = useState<Transaction[]>(DUMMY_TRANSACTIONS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    .filter((tx) => ['Deposit', 'Dividend Payment'].includes(tx.type))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalOutflow = transactions
    .filter((tx) => ['Withdrawal', 'Loan Repayment'].includes(tx.type))
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
    return (
      <View
        key={transaction.id}
        style={[
          styles.tableRow,
          {
            borderBottomColor: tableBorder,
            backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
          },
        ]}>
        <View style={[styles.tableCell, { width: 90 }]}>
          <Text style={[styles.tableText, { color: textPrimary }]}>{transaction.date}</Text>
        </View>
        <View style={[styles.tableCell, { width: 120 }]}>
          <Text style={[styles.tableText, { color: textPrimary }]} numberOfLines={1}>
            {transaction.memberName}
          </Text>
        </View>
        <View style={[styles.tableCell, { width: 130 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons
              name={getTransactionIcon(transaction.type)}
              size={12}
              color={getTransactionTypeColor(transaction.type)}
            />
            <Text
              style={[styles.tableText, { color: textPrimary, fontSize: 11 }]}
              numberOfLines={1}>
              {transaction.type}
            </Text>
          </View>
        </View>
        <View style={[styles.tableCell, { width: 100, alignItems: 'flex-end' }]}>
          <Text style={[styles.tableText, { color: textPrimary, fontWeight: '600' }]}>
            ₦{transaction.amount.toLocaleString()}
          </Text>
        </View>
        <View style={[styles.tableCell, { width: 100, alignItems: 'center' }]}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  transaction.status === 'Completed'
                    ? isDark
                      ? '#064E3B'
                      : '#D1FAE5'
                    : transaction.status === 'Pending'
                      ? isDark
                        ? '#78350F'
                        : '#FEF3C7'
                      : isDark
                        ? '#7F1D1D'
                        : '#FEE2E2',
              },
            ]}>
            <Text
              style={[
                styles.statusText,
                {
                  color: getStatusColor(transaction.status),
                  fontWeight: '600',
                  fontSize: 10,
                },
              ]}>
              {transaction.status}
            </Text>
          </View>
        </View>
        <View style={[styles.tableCell, { width: 70, alignItems: 'center' }]}>
          <TouchableOpacity>
            <Text style={[styles.viewLink, { color: '#10B981' }]}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['left', 'right', 'bottom']}>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          title: 'Transaction History',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTintColor: textPrimary,
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false
        }} 
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Topmost description - Replicating Make Payment design */}
        <Text style={[styles.subtitle, { color: textSecondary, marginBottom: 20 }]}>
          View, filter, and manage all financial transactions.
        </Text>

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

        {/* Transactions Table */}
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScrollContainer}>
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
              <View style={[styles.headerCell, { width: 90 }]}>
                <Text style={[styles.headerText, { color: textPrimary }]}>Date</Text>
              </View>
              <View style={[styles.headerCell, { width: 120 }]}>
                <Text style={[styles.headerText, { color: textPrimary }]}>Member Name</Text>
              </View>
              <View style={[styles.headerCell, { width: 130 }]}>
                <Text style={[styles.headerText, { color: textPrimary }]}>Type</Text>
              </View>
              <View style={[styles.headerCell, { width: 100, alignItems: 'flex-end' }]}>
                <Text style={[styles.headerText, { color: textPrimary }]}>Amount</Text>
              </View>
              <View style={[styles.headerCell, { width: 100, alignItems: 'center' }]}>
                <Text style={[styles.headerText, { color: textPrimary }]}>Status</Text>
              </View>
              <View style={[styles.headerCell, { width: 70, alignItems: 'center' }]}>
                <Text style={[styles.headerText, { color: textPrimary }]}>Actions</Text>
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
                <Ionicons name="inbox-outline" size={48} color={textSecondary} />
                <Text style={[styles.emptyText, { color: textSecondary }]}>No transactions found</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Pagination */}
        <View style={styles.paginationContainer}>
          <TouchableOpacity style={styles.paginationButton}>
            <Ionicons name="chevron-back" size={20} color={textSecondary} />
            <Text style={[styles.paginationText, { color: textSecondary }]}>Previous</Text>
          </TouchableOpacity>

          <Text style={[styles.pageIndicator, { color: textSecondary }]}>Page 1 of 10</Text>

          <TouchableOpacity style={styles.paginationButton}>
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
  tableScrollContainer: {
    marginBottom: 24,
  },
  tableContainer: {
    borderRadius: 8,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    minWidth: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerCell: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  tableCell: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tableText: {
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  viewLink: {
    fontSize: 12,
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
