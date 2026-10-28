import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
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

interface LoanApplication {
  id: string;
  memberName: string;
  loanType: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Disbursed';
  dueDate: string;
}

const DUMMY_LOANS: LoanApplication[] = [
  { id: '1', memberName: 'Aisha Bello', loanType: 'Personal Loan', amount: 50000, status: 'Approved', dueDate: '2024-08-15' },
  { id: '2', memberName: 'Chukwuma Eze', loanType: 'Business Loan', amount: 100000, status: 'Disbursed', dueDate: '2024-09-20' },
  { id: '3', memberName: 'Fatima Musa', loanType: 'Emergency Loan', amount: 20000, status: 'Pending', dueDate: '2024-07-25' },
  { id: '4', memberName: 'Ibrahim Adebayo', loanType: 'Housing Loan', amount: 200000, status: 'Approved', dueDate: '2024-10-01' },
  { id: '5', memberName: 'Ngozi Okoro', loanType: 'Education Loan', amount: 30000, status: 'Disbursed', dueDate: '2024-08-05' },
  { id: '6', memberName: 'Bola Adeleke', loanType: 'Personal Loan', amount: 75000, status: 'Pending', dueDate: '2024-07-30' },
  { id: '7', memberName: 'Chioma Okafor', loanType: 'Business Loan', amount: 120000, status: 'Approved', dueDate: '2024-09-10' },
  { id: '8', memberName: 'Tunde Williams', loanType: 'Housing Loan', amount: 150000, status: 'Disbursed', dueDate: '2024-11-15' },
];

const LoanManagementScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loans, setLoans] = useState<LoanApplication[]>(DUMMY_LOANS);
  const [selectedLoan, setSelectedLoan] = useState<LoanApplication | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Approved' | 'Disbursed'>('All');

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
    switch (status) {
      case 'Approved':
        return '#10B981';
      case 'Pending':
        return '#F59E0B';
      case 'Disbursed':
        return '#3B82F6';
      default:
        return textSecondary;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return isDark ? '#064E3B' : '#D1FAE5';
      case 'Pending':
        return isDark ? '#78350F' : '#FEF3C7';
      case 'Disbursed':
        return isDark ? '#0C2340' : '#DBEAFE';
      default:
        return inputBg;
    }
  };

  const getStatusIconName = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'Approved':
        return 'checkmark-circle';
      case 'Pending':
        return 'time-outline';
      case 'Disbursed':
        return 'shield-checkmark';
      default:
        return 'help-circle-outline';
    }
  };

  // Filter loans
  const filteredLoans = loans.filter((loan) => {
    const matchesSearch =
      loan.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = activeTab === 'All' || loan.status === activeTab;

    return matchesSearch && matchesStatus;
  });

  const handleNewLoan = () => {
    router.push('/request-loan');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Loan Management',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTintColor: textPrimary,
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false,
        }}
      />

      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: textPrimary }]}>Loan Management</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Manage Loans</Text>
        </View>
        <TouchableOpacity style={[styles.newLoanButton, { backgroundColor: primary }]} onPress={handleNewLoan}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.newLoanButtonText}>New Loan</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
          {['All', 'Pending', 'Approved', 'Disbursed'].map((tab) => (
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
              <Text style={[styles.headerText, { color: textPrimary }]}>Due Date / ID</Text>
            </View>
            <View style={styles.colAmountStatus}>
              <Text style={[styles.headerText, { color: textPrimary }]}>Amount / Status</Text>
            </View>
          </View>

          {/* Table Rows */}
          {filteredLoans.length > 0 ? (
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
                        applicantName: loan.memberName,
                        loanName: loan.loanType,
                        amount: String(loan.amount),
                        status: loan.status,
                        dueDate: loan.dueDate,
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
                      {loan.memberName}
                    </Text>
                    <Text style={[styles.typeText, { color: textSecondary }]} numberOfLines={1}>
                      {loan.loanType}
                    </Text>
                  </View>

                  <View style={styles.colDateId}>
                    <Text style={[styles.dateText, { color: textPrimary }]}>{loan.dueDate}</Text>
                    <Text style={[styles.refText, { color: textSecondary }]} numberOfLines={1}>
                      #LN-{loan.id}
                    </Text>
                  </View>

                  <View style={styles.colAmountStatus}>
                    <Text style={[styles.amountText, { color: textPrimary }]}>
                      ₦{loan.amount.toLocaleString()}
                    </Text>
                    <View style={styles.statusRow}>
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
              <Ionicons name="mail-outline" size={48} color={textSecondary} />
              <Text style={[styles.emptyText, { color: textSecondary }]}>No loans found</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Loan Details Modal */}
      <Modal
        visible={selectedLoan !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedLoan(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentCard, { backgroundColor: cardBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: tableBorder }]}>
              <Text style={[styles.modalHeaderTitle, { color: textPrimary }]}>Loan Details</Text>
              <TouchableOpacity onPress={() => setSelectedLoan(null)} style={styles.modalCloseButton}>
                <Ionicons name="close" size={22} color={textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedLoan && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
                <View style={styles.modalStatusSection}>
                  <View style={[styles.modalStatusIconCircle, { backgroundColor: getStatusBgColor(selectedLoan.status) }]}>
                    <Ionicons
                      name={getStatusIconName(selectedLoan.status)}
                      size={36}
                      color={getStatusColor(selectedLoan.status)}
                    />
                  </View>
                  <Text style={[styles.modalAmount, { color: textPrimary }]}>
                    ₦{selectedLoan.amount.toLocaleString()}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(selectedLoan.status), marginTop: 8 }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(selectedLoan.status), fontSize: 11 }]}>
                      Loan {selectedLoan.status}
                    </Text>
                  </View>
                </View>

                <View style={[styles.modalDetailsList, { borderColor: inputBorder }]}>
                  <View style={[styles.modalDetailRow, { borderBottomColor: tableBorder }]}>
                    <Text style={[styles.modalDetailLabel, { color: textSecondary }]}>Member Name</Text>
                    <Text style={[styles.modalDetailValue, { color: textPrimary }]}>{selectedLoan.memberName}</Text>
                  </View>

                  <View style={[styles.modalDetailRow, { borderBottomColor: tableBorder }]}>
                    <Text style={[styles.modalDetailLabel, { color: textSecondary }]}>Loan Type</Text>
                    <Text style={[styles.modalDetailValue, { color: textPrimary }]}>{selectedLoan.loanType}</Text>
                  </View>

                  <View style={[styles.modalDetailRow, { borderBottomColor: tableBorder }]}>
                    <Text style={[styles.modalDetailLabel, { color: textSecondary }]}>Due Date</Text>
                    <Text style={[styles.modalDetailValue, { color: textPrimary }]}>{selectedLoan.dueDate}</Text>
                  </View>

                  <View style={[styles.modalDetailRow, { borderBottomWidth: 0 }]}>
                    <Text style={[styles.modalDetailLabel, { color: textSecondary }]}>Loan ID</Text>
                    <Text style={[styles.modalDetailValue, { color: textPrimary, fontSize: 12 }]} numberOfLines={1}>
                      #LN-{selectedLoan.id}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.modalDoneButton, { backgroundColor: primary }]}
                  onPress={() => setSelectedLoan(null)}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
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
});

export default LoanManagementScreen;
