import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AccountService, type GuarantorInfo, type LoanDetailDto } from '@/services/accountService';

interface NextStepItem {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export default function LoanDetailsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const params = useLocalSearchParams<{
    id?: string;
    applicantName?: string;
    loanName?: string;
    amount?: string;
    status?: string;
    dueDate?: string;
  }>();

  const loanId = params.id || 'LN-001';
  const initialAmount = parseFloat(params.amount || '50000') || 50000;
  const initialStatus = params.status || 'Pending';
  const initialLoanName = params.loanName || 'Personal Loan';
  const initialApplicantName = params.applicantName || 'Member';
  const initialDueDate = params.dueDate || '2026-11-15';

  const [loanDetail, setLoanDetail] = useState<LoanDetailDto | null>(null);
  const [guarantors, setGuarantors] = useState<GuarantorInfo[]>([
    { guarantorName: 'Chukwudi Okoro', status: 'Approved' },
    { guarantorName: 'Aisha Bello', status: 'Pending' },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const borderColor = isDark ? '#2D3748' : '#E2E8F0';
  const primary = '#173581';

  useEffect(() => {
    const fetchDetails = async () => {
      if (!params.id) return;
      setIsLoading(true);
      try {
        const detail = await AccountService.getLoanDetail(params.id);
        if (detail) {
          setLoanDetail(detail);
          if (Array.isArray(detail.guarantors) && detail.guarantors.length > 0) {
            setGuarantors(detail.guarantors);
          }
        }
      } catch {
        // Fallback to sample guarantors if offline or testing
      } finally {
        setIsLoading(false);
      }
    };

    void fetchDetails();
  }, [params.id]);

  const currentStatus = loanDetail?.status || initialStatus;
  const currentAmount = loanDetail?.amount ?? initialAmount;
  const currentLoanName = loanDetail?.loanName || initialLoanName;
  const currentApplicant = loanDetail?.applicantName || initialApplicantName;
  const currentPurpose =
    loanDetail?.loanPurpose || 'Working capital and operational restocking for trade store.';

  const approvedGuarantorsCount = guarantors.filter(
    (g) => g.status?.toLowerCase() === 'approved'
  ).length;
  const pendingGuarantorsCount = guarantors.filter(
    (g) => g.status?.toLowerCase() === 'pending'
  ).length;
  const hasRejectedGuarantor = guarantors.some(
    (g) => g.status?.toLowerCase() === 'rejected'
  );

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
        return isDark ? '#1E3A8A' : '#DBEAFE';
      case 'rejected':
      case 'failed':
        return isDark ? '#7F1D1D' : '#FEE2E2';
      default:
        return isDark ? '#2D3748' : '#F3F4F6';
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

  // Next steps logic mirroring web
  const nextSteps: NextStepItem[] = [
    {
      title: 'Guarantor Approvals',
      description: hasRejectedGuarantor
        ? 'A guarantor has declined this loan request. You will need to select a new guarantor.'
        : pendingGuarantorsCount > 0
        ? `${pendingGuarantorsCount} guarantor${pendingGuarantorsCount > 1 ? 's are' : ' is'} awaiting your reminder to review and approve.`
        : 'All required guarantors have approved your loan application.',
      icon: hasRejectedGuarantor
        ? 'close-circle-outline'
        : pendingGuarantorsCount > 0
        ? 'time-outline'
        : 'checkmark-circle-outline',
      color: hasRejectedGuarantor ? '#EF4444' : pendingGuarantorsCount > 0 ? '#F59E0B' : '#10B981',
    },
    {
      title: 'Executive Committee Review',
      description:
        approvedGuarantorsCount === guarantors.length
          ? 'Guarantors cleared. Executive committee is reviewing credit terms.'
          : 'Committee review begins immediately after all guarantors approve.',
      icon: 'people-outline',
      color: '#3B82F6',
    },
    {
      title: 'Disbursement',
      description: 'Funds will be disbursed directly into your designated cooperative bank account.',
      icon: 'cash-outline',
      color: '#10B981',
    },
  ];

  const handleRemindGuarantor = (guarantorName: string) => {
    Alert.alert(
      'Guarantor Reminder',
      `A notification reminder has been queued for ${guarantorName} to approve your loan request.`
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Loan Request Details',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTintColor: textPrimary,
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false,
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Top Status Card */}
        <View style={[styles.statusHeroCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.loanTitle, { color: textPrimary }]}>{currentLoanName}</Text>
              <Text style={[styles.loanIdText, { color: textSecondary }]}>Application #{loanId}</Text>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(currentStatus) }]}>
              <Ionicons
                name={getStatusIconName(currentStatus)}
                size={14}
                color={getStatusColor(currentStatus)}
              />
              <Text style={[styles.statusBadgeText, { color: getStatusColor(currentStatus) }]}>
                {currentStatus}
              </Text>
            </View>
          </View>

          <Text style={[styles.amountBig, { color: textPrimary }]}>
            ₦{currentAmount.toLocaleString()}
          </Text>

          <View style={[styles.heroDivider, { backgroundColor: borderColor }]} />

          {/* Quick Metrics */}
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: textSecondary }]}>APPLICANT</Text>
              <Text style={[styles.metricValue, { color: textPrimary }]} numberOfLines={1}>
                {currentApplicant}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: textSecondary }]}>DUE DATE</Text>
              <Text style={[styles.metricValue, { color: textPrimary }]}>{initialDueDate}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: textSecondary }]}>DURATION</Text>
              <Text style={[styles.metricValue, { color: textPrimary }]}>
                {loanDetail?.loanDuration || loanDetail?.repaymentPeriod || 12} Months
              </Text>
            </View>
          </View>
        </View>

        {/* GUARANTOR APPROVALS SECTION - Main Requirement */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Guarantor Approvals</Text>
              <Text style={[styles.sectionSub, { color: textSecondary }]}>
                {approvedGuarantorsCount} of {guarantors.length} guarantors approved
              </Text>
            </View>

            {/* Overall Guarantor Progress Badge */}
            <View
              style={[
                styles.miniProgressBadge,
                {
                  backgroundColor:
                    approvedGuarantorsCount === guarantors.length
                      ? '#D1FAE5'
                      : hasRejectedGuarantor
                      ? '#FEE2E2'
                      : '#FEF3C7',
                },
              ]}
            >
              <Text
                style={[
                  styles.miniProgressText,
                  {
                    color:
                      approvedGuarantorsCount === guarantors.length
                        ? '#064E3B'
                        : hasRejectedGuarantor
                        ? '#991B1B'
                        : '#92400E',
                  },
                ]}
              >
                {approvedGuarantorsCount === guarantors.length
                  ? 'All Approved'
                  : hasRejectedGuarantor
                  ? 'Declined by Guarantor'
                  : 'Awaiting Approvals'}
              </Text>
            </View>
          </View>

          {/* Guarantors List */}
          <View style={styles.guarantorsList}>
            {guarantors.map((guarantor, index) => {
              const gStatus = guarantor.status || 'Pending';
              const isPending = gStatus.toLowerCase() === 'pending';
              const isApproved = gStatus.toLowerCase() === 'approved';
              const isRejected = gStatus.toLowerCase() === 'rejected';

              return (
                <View
                  key={index}
                  style={[
                    styles.guarantorItemCard,
                    {
                      backgroundColor: inputBg,
                      borderColor: isApproved ? '#10B98140' : isRejected ? '#EF444440' : borderColor,
                    },
                  ]}
                >
                  <View style={styles.guarantorLeft}>
                    <View
                      style={[
                        styles.avatarCircle,
                        {
                          backgroundColor: isApproved ? '#10B981' : isRejected ? '#EF4444' : primary,
                        },
                      ]}
                    >
                      <Text style={styles.avatarText}>
                        {(guarantor.guarantorName || 'G').charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.guarantorName, { color: textPrimary }]}>
                        {guarantor.guarantorName}
                      </Text>
                      <Text style={[styles.guarantorRole, { color: textSecondary }]}>
                        Cooperative Member Guarantor
                      </Text>
                    </View>
                  </View>

                  <View style={styles.guarantorRight}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(gStatus) }]}>
                      <Ionicons
                        name={getStatusIconName(gStatus)}
                        size={12}
                        color={getStatusColor(gStatus)}
                      />
                      <Text style={[styles.statusBadgeText, { color: getStatusColor(gStatus) }]}>
                        {gStatus}
                      </Text>
                    </View>

                    {isPending && (
                      <TouchableOpacity
                        style={[styles.remindButton, { borderColor: primary }]}
                        onPress={() => handleRemindGuarantor(guarantor.guarantorName)}
                      >
                        <Ionicons name="notifications-outline" size={12} color={primary} />
                        <Text style={[styles.remindButtonText, { color: primary }]}>Remind</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Loan Purpose & Terms */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.sectionTitle, { color: textPrimary, marginBottom: 12 }]}>
            Loan Purpose & Information
          </Text>

          <View style={[styles.detailBox, { backgroundColor: inputBg, borderColor }]}>
            <Text style={[styles.detailBoxLabel, { color: textSecondary }]}>PURPOSE</Text>
            <Text style={[styles.detailBoxText, { color: textPrimary }]}>"{currentPurpose}"</Text>
          </View>

          <View style={styles.termsGrid}>
            <View style={[styles.termRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.termLabel, { color: textSecondary }]}>Interest Rate</Text>
              <Text style={[styles.termValue, { color: textPrimary }]}>
                {loanDetail?.interestRate ? `${(loanDetail.interestRate * 100).toFixed(1)}%` : '5.0%'}
              </Text>
            </View>

            <View style={[styles.termRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.termLabel, { color: textSecondary }]}>Estimated Monthly Payment</Text>
              <Text style={[styles.termValue, { color: textPrimary }]}>
                ₦
                {loanDetail?.monthlyRepayment
                  ? loanDetail.monthlyRepayment.toLocaleString()
                  : Math.round(currentAmount / 12).toLocaleString()}
              </Text>
            </View>

            <View style={[styles.termRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.termLabel, { color: textSecondary }]}>Processing Fee Status</Text>
              <Text style={[styles.termValue, { color: '#10B981' }]}>
                {loanDetail?.feePaymentStatus || 'Paid / Deductible'}
              </Text>
            </View>
          </View>
        </View>

        {/* Next Steps Guidance (Web flow) */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.sectionTitle, { color: textPrimary, marginBottom: 14 }]}>Next Steps</Text>

          <View style={styles.stepsList}>
            {nextSteps.map((step, idx) => (
              <View key={idx} style={styles.stepItem}>
                <View style={[styles.stepIconContainer, { backgroundColor: step.color + '15' }]}>
                  <Ionicons name={step.icon} size={20} color={step.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stepTitle, { color: textPrimary }]}>{step.title}</Text>
                  <Text style={[styles.stepDesc, { color: textSecondary }]}>{step.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
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
    paddingBottom: 40,
    gap: 16,
  },
  statusHeroCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  loanTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  loanIdText: {
    fontSize: 12,
    marginTop: 2,
  },
  amountBig: {
    fontSize: 32,
    fontWeight: '800',
    marginVertical: 4,
  },
  heroDivider: {
    height: 1,
    marginVertical: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  miniProgressBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  miniProgressText: {
    fontSize: 11,
    fontWeight: '700',
  },
  guarantorsList: {
    gap: 10,
  },
  guarantorItemCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  guarantorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
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
    fontWeight: '700',
    fontSize: 14,
  },
  guarantorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  guarantorRole: {
    fontSize: 11,
    marginTop: 2,
  },
  guarantorRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  remindButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  remindButtonText: {
    fontSize: 10,
    fontWeight: '700',
  },
  detailBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  detailBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailBoxText: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  termsGrid: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
  },
  termRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  termLabel: {
    fontSize: 12,
  },
  termValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepsList: {
    gap: 14,
  },
  stepItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
});

