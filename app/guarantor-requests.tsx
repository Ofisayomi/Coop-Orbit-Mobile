import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AccountService, type LoanGuarantorRequestDto } from '@/services/accountService';

const DUMMY_REQUESTS: LoanGuarantorRequestDto[] = [
  {
    id: '1',
    applicantName: 'Aisha Bello',
    createdDate: '2026-10-26T10:00:00Z',
    loanAmount: 50000,
    loanName: 'Personal Loan',
    comment: 'Need financial support to restock retail inventory before month end.',
    status: 'Pending',
    memberId: 'MEM-042',
  },
  {
    id: '2',
    applicantName: 'Chukwudi Okoro',
    createdDate: '2026-10-25T14:30:00Z',
    loanAmount: 100000,
    loanName: 'Business Loan',
    comment: 'Expansion of pharmacy premises and procurement of storage equipment.',
    status: 'Approved',
    memberId: 'MEM-019',
  },
  {
    id: '3',
    applicantName: 'Fatima Hassan',
    createdDate: '2026-10-24T09:15:00Z',
    loanAmount: 75000,
    loanName: 'Education Loan',
    comment: 'Tuition fees for post-graduate studies at University of Ibadan.',
    status: 'Pending',
    memberId: 'MEM-033',
  },
  {
    id: '4',
    applicantName: 'Emeka Nwosu',
    createdDate: '2026-10-23T16:20:00Z',
    loanAmount: 200000,
    loanName: 'Housing Loan',
    comment: 'Roof renovation and structural repairs on family property.',
    status: 'Rejected',
    memberId: 'MEM-008',
  },
];

export default function GuarantorRequestsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [requests, setRequests] = useState<LoanGuarantorRequestDto[]>(DUMMY_REQUESTS);
  const [activeTab, setActiveTab] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);

  // Confirmation Modal state
  const [selectedRequest, setSelectedRequest] = useState<LoanGuarantorRequestDto | null>(null);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const primary = '#173581';

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await AccountService.getGuarantorRequests();
      if (Array.isArray(data) && data.length > 0) {
        setRequests(data);
      }
    } catch {
      // Fallback to dummy requests if offline or endpoint fails
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const onRefresh = () => {
    setIsRefreshing(true);
    void fetchRequests();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'rejected':
        return '#EF4444';
      default:
        return textSecondary;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return isDark ? '#064E3B' : '#D1FAE5';
      case 'pending':
        return isDark ? '#78350F' : '#FEF3C7';
      case 'rejected':
        return isDark ? '#7F1D1D' : '#FEE2E2';
      default:
        return isDark ? '#2D3748' : '#F3F4F6';
    }
  };

  const getStatusIconName = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'checkmark-circle';
      case 'pending':
        return 'time-outline';
      case 'rejected':
        return 'close-circle';
      default:
        return 'help-circle-outline';
    }
  };

  // Filter requests
  const filteredRequests = requests.filter((req) => {
    if (activeTab === 'All') return true;
    return req.status?.toLowerCase() === activeTab.toLowerCase();
  });

  const handleActionClick = (request: LoanGuarantorRequestDto, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setConfirmAction(action);
  };

  const executeAction = async () => {
    if (!selectedRequest || !confirmAction) return;
    setIsUpdating(true);
    try {
      // status 2 = Approved, 3 = Rejected
      const statusValue = confirmAction === 'approve' ? 2 : 3;
      await AccountService.updateGuarantorRequest(selectedRequest.id, statusValue);

      Alert.alert(
        'Request Updated',
        `You have successfully ${confirmAction === 'approve' ? 'approved' : 'rejected'} ${selectedRequest.applicantName}'s guarantor request.`
      );

      // Locally update status for instant UI responsiveness
      setRequests((current) =>
        current.map((item) =>
          item.id === selectedRequest.id
            ? { ...item, status: confirmAction === 'approve' ? 'Approved' : 'Rejected' }
            : item
        )
      );

      setConfirmAction(null);
      setSelectedRequest(null);
      void fetchRequests();
    } catch (error) {
      Alert.alert('Action Failed', error instanceof Error ? error.message : 'Please try again later.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <Stack.Screen options={{
        headerShown: true,
        title: 'Guarantor Requests',
        headerTitleStyle: {
          color: textPrimary,
          fontWeight: 'bold',
          fontSize: 18,
        },
        headerStyle: {
          backgroundColor: bg,
        },
        headerTintColor: textPrimary,
        headerShadowVisible: false,

      }}

      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={primary} />
        }
      >
        {/* Header Description */}
        {/* <View style={styles.topHeader}>
          <Text style={[styles.headerTitle, { color: textPrimary }]}>Guarantor Requests</Text>
          <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
            Review loan applications where members selected you as their guarantor.
          </Text>
        </View> */}

        {/* Filter Tabs */}
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

        {/* Requests List */}
        {isLoading && !isRefreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={[styles.loadingText, { color: textSecondary }]}>Loading guarantor requests…</Text>
          </View>
        ) : filteredRequests.length > 0 ? (
          <View style={styles.cardsList}>
            {filteredRequests.map((request) => {
              const status = request.status || 'Pending';
              const isPending = status.toLowerCase() === 'pending';
              const isNoteExpanded = expandedNoteId === request.id;
              const formattedDate = new Date(request.createdDate).toLocaleDateString('en-NG', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <View key={request.id} style={[styles.requestCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={styles.applicantInfo}>
                      <View style={[styles.avatarCircle, { backgroundColor: primary }]}>
                        <Text style={styles.avatarText}>
                          {(request.applicantName || 'M').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.applicantName, { color: textPrimary }]} numberOfLines={1}>
                          {request.applicantName}
                        </Text>
                        <Text style={[styles.dateText, { color: textSecondary }]}>
                          Requested on {formattedDate}
                        </Text>
                      </View>
                    </View>

                    {/* Status Badge */}
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(status) }]}>
                      <Ionicons name={getStatusIconName(status)} size={12} color={getStatusColor(status)} />
                      <Text style={[styles.statusText, { color: getStatusColor(status) }]}>{status}</Text>
                    </View>
                  </View>

                  {/* Loan Amount & Product Info */}
                  <View style={[styles.infoGrid, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                    <View style={styles.infoCol}>
                      <Text style={[styles.infoLabel, { color: textSecondary }]}>LOAN AMOUNT</Text>
                      <Text style={[styles.amountValue, { color: textPrimary }]}>
                        ₦{request.loanAmount.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.infoCol}>
                      <Text style={[styles.infoLabel, { color: textSecondary }]}>LOAN PRODUCT</Text>
                      <Text style={[styles.productValue, { color: textPrimary }]}>
                        {request.loanName}
                      </Text>
                    </View>
                  </View>

                  {/* Loan Reason / Comment */}
                  {request.comment ? (
                    <View style={styles.commentSection}>
                      <TouchableOpacity
                        style={styles.commentToggle}
                        onPress={() => setExpandedNoteId(isNoteExpanded ? null : request.id)}
                      >
                        <Ionicons name="document-text-outline" size={14} color={primary} />
                        <Text style={[styles.commentToggleText, { color: primary }]}>
                          {isNoteExpanded ? 'Hide Loan Reason' : 'View Loan Reason'}
                        </Text>
                        <Ionicons
                          name={isNoteExpanded ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color={primary}
                        />
                      </TouchableOpacity>

                      {isNoteExpanded && (
                        <View style={[styles.commentBox, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                          <Text style={[styles.commentText, { color: textPrimary }]}>
                            "{request.comment}"
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : null}

                  {/* Action Buttons: Only shown if Pending */}
                  {isPending && (
                    <View style={styles.actionButtonsRow}>
                      <TouchableOpacity
                        style={[styles.rejectButton, { borderColor: '#EF4444' }]}
                        onPress={() => handleActionClick(request, 'reject')}
                      >
                        <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.approveButton, { backgroundColor: '#10B981' }]}
                        onPress={() => handleActionClick(request, 'approve')}
                      >
                        <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-checkmark-outline" size={48} color={textSecondary} />
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>No Guarantor Requests</Text>
            <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
              {activeTab === 'All'
                ? 'When another cooperative member selects you as a loan guarantor, their request will appear here.'
                : `No ${activeTab.toLowerCase()} guarantor requests found.`}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={confirmAction !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !isUpdating && setConfirmAction(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: cardBg }]}>
            <View
              style={[
                styles.modalIconCircle,
                {
                  backgroundColor: confirmAction === 'approve' ? '#D1FAE5' : '#FEE2E2',
                },
              ]}
            >
              <Ionicons
                name={confirmAction === 'approve' ? 'checkmark-circle' : 'alert-circle'}
                size={36}
                color={confirmAction === 'approve' ? '#10B981' : '#EF4444'}
              />
            </View>

            <Text style={[styles.modalTitle, { color: textPrimary }]}>
              {confirmAction === 'approve' ? 'Approve Guarantor Request?' : 'Decline Guarantor Request?'}
            </Text>

            {selectedRequest && (
              <Text style={[styles.modalDescription, { color: textSecondary }]}>
                {confirmAction === 'approve' ? (
                  <>
                    By approving, you are agreeing to act as a guarantor for{' '}
                    <Text style={{ fontWeight: '700', color: textPrimary }}>{selectedRequest.applicantName}</Text> for
                    the loan amount of{' '}
                    <Text style={{ fontWeight: '700', color: textPrimary }}>
                      ₦{selectedRequest.loanAmount.toLocaleString()}
                    </Text>
                    . If the applicant defaults, you may be held liable under cooperative policies.
                  </>
                ) : (
                  <>
                    By rejecting this request, you decline to be a guarantor for{' '}
                    <Text style={{ fontWeight: '700', color: textPrimary }}>{selectedRequest.applicantName}</Text>'s{' '}
                    {selectedRequest.loanName}. The applicant will be notified to pick another guarantor.
                  </>
                )}
              </Text>
            )}

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: inputBorder }]}
                disabled={isUpdating}
                onPress={() => setConfirmAction(null)}
              >
                <Text style={[styles.modalCancelBtnText, { color: textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  {
                    backgroundColor: confirmAction === 'approve' ? '#10B981' : '#EF4444',
                  },
                ]}
                disabled={isUpdating}
                onPress={() => void executeAction()}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmBtnText}>
                    {confirmAction === 'approve' ? 'Confirm Approval' : 'Confirm Decline'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  topHeader: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
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
    fontWeight: '600',
  },
  cardsList: {
    gap: 14,
  },
  requestCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  applicantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  applicantName: {
    fontSize: 14,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoGrid: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  productValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  commentSection: {
    marginBottom: 14,
  },
  commentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  commentBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  commentText: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  rejectButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
