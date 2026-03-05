import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
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

        {/* Loans Table */}
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
              ]}
            >
              <View style={[styles.headerCell, { width: 120 }]}>
                <Text style={[styles.headerText, { color: textPrimary }]}>MEMBER</Text>
              </View>
              <View style={[styles.headerCell, { width: 130 }]}>
                <Text style={[styles.headerText, { color: textPrimary }]}>LOAN TYPE</Text>
              </View>
              <View style={[styles.headerCell, { width: 100, alignItems: 'flex-end' }]}>
                <Text style={[styles.headerText, { color: textPrimary }]}>AMOUNT</Text>
              </View>
              <View style={[styles.headerCell, { width: 100, alignItems: 'center' }]}>
                <Text style={[styles.headerText, { color: textPrimary }]}>STATUS</Text>
              </View>
              <View style={[styles.headerCell, { width: 100 }]}>
                <Text style={[styles.headerText, { color: textPrimary }]}>DUE DATE</Text>
              </View>
              <View style={[styles.headerCell, { width: 70, alignItems: 'center' }]}>
                <Text style={[styles.headerText, { color: textPrimary }]}>ACTION</Text>
              </View>
            </View>

            {/* Table Rows */}
            {filteredLoans.length > 0 ? (
              filteredLoans.map((loan) => (
                <View
                  key={loan.id}
                  style={[
                    styles.tableRow,
                    {
                      borderBottomColor: tableBorder,
                      backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                    },
                  ]}
                >
                  <View style={[styles.tableCell, { width: 120 }]}>
                    <Text style={[styles.tableText, { color: textPrimary, fontWeight: '600' }]} numberOfLines={1}>
                      {loan.memberName}
                    </Text>
                  </View>
                  <View style={[styles.tableCell, { width: 130 }]}>
                    <Text style={[styles.tableText, { color: textSecondary }]} numberOfLines={1}>{loan.loanType}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: 100, alignItems: 'flex-end' }]}>
                    <Text style={[styles.tableText, { color: textPrimary, fontWeight: '600' }]}>
                      ₦{loan.amount.toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.tableCell, { width: 100, alignItems: 'center' }]}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusBgColor(loan.status) },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(loan.status), fontWeight: '600' },
                        ]}
                      >
                        {loan.status}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.tableCell, { width: 100 }]}>
                    <Text style={[styles.tableText, { color: textPrimary }]}>{loan.dueDate}</Text>
                  </View>
                  <View style={[styles.tableCell, { width: 70, alignItems: 'center' }]}>
                    <TouchableOpacity>
                      <Text style={[styles.viewLink, { color: primary }]}>View</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="inbox-outline" size={48} color={textSecondary} />
                <Text style={[styles.emptyText, { color: textSecondary }]}>No loans found</Text>
              </View>
            )}
          </View>
        </ScrollView>
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
    fontSize: 11,
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
    fontSize: 11,
    fontWeight: '600',
  },
  viewLink: {
    fontSize: 12,
    fontWeight: '600',
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
});

export default LoanManagementScreen;
