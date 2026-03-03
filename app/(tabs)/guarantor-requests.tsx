import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';

// Loan request data structure
interface GuarantorRequest {
  id: string;
  applicantName: string;
  date: string;
  loanAmount: number;
  loanType: 'Personal Loan' | 'Business Loan' | 'Education Loan' | 'Housing Loan' | 'Emergency Loan';
  status?: 'Pending' | 'Approved' | 'Rejected';
}

const DUMMY_REQUESTS: GuarantorRequest[] = [
  {
    id: '1',
    applicantName: 'Aisha Bello',
    date: '2024-07-26',
    loanAmount: 50000,
    loanType: 'Personal Loan',
  },
  {
    id: '2',
    applicantName: 'Chukwudi Okoro',
    date: '2024-07-25',
    loanAmount: 100000,
    loanType: 'Business Loan',
  },
  {
    id: '3',
    applicantName: 'Fatima Hassan',
    date: '2024-07-24',
    loanAmount: 75000,
    loanType: 'Education Loan',
  },
  {
    id: '4',
    applicantName: 'Emeka Nwosu',
    date: '2024-07-23',
    loanAmount: 200000,
    loanType: 'Housing Loan',
  },
  {
    id: '5',
    applicantName: 'Halima Abubakar',
    date: '2024-07-22',
    loanAmount: 30000,
    loanType: 'Emergency Loan',
  },
  {
    id: '6',
    applicantName: 'Bola Adeleke',
    date: '2024-07-21',
    loanAmount: 120000,
    loanType: 'Personal Loan',
  },
  {
    id: '7',
    applicantName: 'Chioma Okafor',
    date: '2024-07-20',
    loanAmount: 80000,
    loanType: 'Business Loan',
  },
  {
    id: '8',
    applicantName: 'Tunde Williams',
    date: '2024-07-19',
    loanAmount: 150000,
    loanType: 'Housing Loan',
  },
  {
    id: '9',
    applicantName: 'Zainab Ahmed',
    date: '2024-07-18',
    loanAmount: 45000,
    loanType: 'Personal Loan',
  },
  {
    id: '10',
    applicantName: 'David Nkosi',
    date: '2024-07-17',
    loanAmount: 110000,
    loanType: 'Business Loan',
  },
];

const GuarantorRequestsScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [requests, setRequests] = useState<GuarantorRequest[]>(DUMMY_REQUESTS);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const primary = '#173581';

  const itemsPerPage = 6;
  const totalPages = Math.ceil(requests.length / itemsPerPage);

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    if (!filterType) return true;
    return req.loanType === filterType;
  });

  // Sort requests
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } else {
      return b.loanAmount - a.loanAmount;
    }
  });

  // Paginate requests
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedRequests = sortedRequests.slice(startIdx, endIdx);

  const loanTypes = [
    'Personal Loan',
    'Business Loan',
    'Education Loan',
    'Housing Loan',
    'Emergency Loan',
  ];

  const handleApprove = (id: string) => {
    // Handle approve action
    console.log('Approved:', id);
  };

  const handleReject = (id: string) => {
    // Handle reject action
    console.log('Rejected:', id);
  };

  const RequestCard = ({ request }: { request: GuarantorRequest }) => (
    <View style={[styles.requestCard, { backgroundColor: cardBg }]}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={[styles.applicantName, { color: textPrimary }]}>{request.applicantName}</Text>
          <Text style={[styles.date, { color: textSecondary }]}>{request.date}</Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.loanInfoRow}>
          <Text style={[styles.label, { color: textSecondary }]}>Loan Amount:</Text>
          <Text style={[styles.amount, { color: textPrimary }]}>₦{request.loanAmount.toLocaleString()}</Text>
        </View>

        <View style={styles.loanInfoRow}>
          <Text style={[styles.label, { color: textSecondary }]}>Loan Type:</Text>
          <Text style={[styles.loanType, { color: textPrimary }]}>{request.loanType}</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.rejectButton, { borderColor: inputBorder }]}
          onPress={() => handleReject(request.id)}
        >
          <Text style={[styles.rejectButtonText, { color: primary }]}>Reject</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.approveButton, { backgroundColor: primary }]}
          onPress={() => handleApprove(request.id)}
        >
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          title: 'Guarantor Requests',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTintColor: textPrimary,
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false
        }} 
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header with Filter and Sort */}
        <View style={styles.controlsHeader}>
          {/* <Text style={[styles.screenTitle, { color: textPrimary }]}>Guarantor Requests</Text> */}
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[styles.headerButton, { borderColor: inputBorder }]}
              onPress={() => setShowFilterMenu(!showFilterMenu)}
            >
              <Ionicons name="filter" size={18} color={textSecondary} />
              <Text style={[styles.headerButtonText, { color: textSecondary }]}>Filter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerButton, { borderColor: inputBorder }]}
              onPress={() => setShowSortMenu(!showSortMenu)}
            >
              <Ionicons name="arrow-up-down" size={18} color={textSecondary} />
              <Text style={[styles.headerButtonText, { color: textSecondary }]}>Sort</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter Menu */}
        {showFilterMenu && (
          <View style={[styles.menuDropdown, { backgroundColor: cardBg, borderColor: inputBorder }]}>
            <TouchableOpacity
              style={[
                styles.menuItem,
                filterType === null && { backgroundColor: inputBg },
              ]}
              onPress={() => {
                setFilterType(null);
                setShowFilterMenu(false);
              }}
            >
              <Text style={[styles.menuItemText, { color: textPrimary }]}>All Types</Text>
            </TouchableOpacity>

            {loanTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.menuItem,
                  filterType === type && { backgroundColor: inputBg },
                ]}
                onPress={() => {
                  setFilterType(type);
                  setShowFilterMenu(false);
                }}
              >
                <Text style={[styles.menuItemText, { color: textPrimary }]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Sort Menu */}
        {showSortMenu && (
          <View style={[styles.menuDropdown, { backgroundColor: cardBg, borderColor: inputBorder }]}>
            <TouchableOpacity
              style={[
                styles.menuItem,
                sortBy === 'date' && { backgroundColor: inputBg },
              ]}
              onPress={() => {
                setSortBy('date');
                setShowSortMenu(false);
              }}
            >
              <Text style={[styles.menuItemText, { color: textPrimary }]}>Recent First</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.menuItem,
                sortBy === 'amount' && { backgroundColor: inputBg },
              ]}
              onPress={() => {
                setSortBy('amount');
                setShowSortMenu(false);
              }}
            >
              <Text style={[styles.menuItemText, { color: textPrimary }]}>Highest Amount</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Request Cards Grid */}
        <View style={styles.cardsGrid}>
          {paginatedRequests.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </View>

        {/* Empty State */}
        {paginatedRequests.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="inbox-outline" size={48} color={textSecondary} />
            <Text style={[styles.emptyStateText, { color: textSecondary }]}>No requests found</Text>
          </View>
        )}

        {/* Pagination */}
        <View style={styles.paginationContainer}>
          <Text style={[styles.paginationText, { color: textSecondary }]}>
            Showing {startIdx + 1} to {Math.min(endIdx, filteredRequests.length)} of {filteredRequests.length} results
          </Text>

          <View style={styles.paginationButtons}>
            <TouchableOpacity
              style={[
                styles.paginationButton,
                currentPage === 1 && styles.disabledButton,
              ]}
              onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <Text style={[styles.paginationButtonText, { color: currentPage === 1 ? textSecondary : primary }]}>
                Previous
              </Text>
            </TouchableOpacity>

            <Text style={[styles.pageIndicator, { color: textSecondary }]}>
              Page {currentPage} of {totalPages || 1}
            </Text>

            <TouchableOpacity
              style={[
                styles.paginationButton,
                currentPage === totalPages && styles.disabledButton,
              ]}
              onPress={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <Text style={[styles.paginationButtonText, { color: currentPage === totalPages ? textSecondary : primary }]}>
                Next
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
  controlsHeader: {
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  headerButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  menuDropdown: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cardsGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  requestCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 12,
  },
  applicantName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardContent: {
    marginBottom: 16,
    paddingVertical: 8,
  },
  loanInfoRow: {
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
  },
  loanType: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  rejectButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  approveButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  paginationContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  paginationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  paginationButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  paginationButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.5,
  },
  pageIndicator: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default GuarantorRequestsScreen;
