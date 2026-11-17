import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/context/ToastContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  AccountService,
  type LoanDetailDto,
  type RepaymentScheduleDto,
} from '@/services/accountService';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMoney(value?: number | null): string {
  if (value === undefined || value === null) return '—';
  return `₦${value.toLocaleString()}`;
}

interface NextStepItem {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export default function LoanDetailsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const params = useLocalSearchParams<{
    id?: string;
    applicantName?: string;
    loanName?: string;
    amount?: string;
    status?: string;
    created?: string;
    dueDate?: string;
  }>();

  const loanId = params.id || '';
  const initialAmount = params.amount ? parseFloat(params.amount) : undefined;
  const initialStatus = params.status || '';
  const initialLoanName = params.loanName || '';
  const initialApplicantName = params.applicantName || '';
  const initialCreated = params.created || params.dueDate || '';

  const [loanDetail, setLoanDetail] = useState<LoanDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [repaymentSchedule, setRepaymentSchedule] = useState<RepaymentScheduleDto[] | null>(null);
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const borderColor = isDark ? '#2D3748' : '#E2E8F0';
  const primary = '#173581';

  const fetchDetails = React.useCallback(async () => {
    if (!loanId) {
      setError('Missing loan ID');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const detail = await AccountService.getLoanDetail(loanId);
      setLoanDetail(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load loan details');
    } finally {
      setIsLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    void fetchDetails();
  }, [fetchDetails]);

  const fetchRepaymentSchedule = React.useCallback(async () => {
    if (!loanId) {
      setScheduleError('Missing loan ID');
      return;
    }
    setIsScheduleLoading(true);
    setScheduleError(null);
    try {
      const schedule = await AccountService.getRepaymentSchedule(loanId);
      setRepaymentSchedule(schedule);
      setShowSchedule(true);
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Unable to load repayment schedule');
    } finally {
      setIsScheduleLoading(false);
    }
  }, [loanId]);

  const handleScheduleButtonPress = () => {
    if (repaymentSchedule !== null) {
      setShowSchedule((prev) => !prev);
      return;
    }
    void fetchRepaymentSchedule();
  };

  const getScheduleStatusLabel = (status: number): string => {
    switch (status) {
      case 0:
        return 'Pending';
      case 1:
        return 'Paid';
      case 2:
        return 'Partial';
      case 3:
        return 'Overdue';
      default:
        return `Status ${status}`;
    }
  };

  const getScheduleStatusColor = (status: number): string => {
    switch (status) {
      case 1:
        return '#10B981';
      case 2:
        return '#F59E0B';
      case 3:
        return '#EF4444';
      default:
        return textSecondary;
    }
  };

  const getScheduleStatusBg = (status: number): string => {
    switch (status) {
      case 1:
        return isDark ? '#064E3B' : '#D1FAE5';
      case 2:
        return isDark ? '#78350F' : '#FEF3C7';
      case 3:
        return isDark ? '#7F1D1D' : '#FEE2E2';
      default:
        return isDark ? '#2D3748' : '#F3F4F6';
    }
  };

  const guarantors = loanDetail?.guarantors ?? [];
  const transactions = loanDetail?.transactions ?? [];

  const currentStatus = loanDetail?.status || initialStatus || '—';
  const currentAmount = loanDetail?.amount ?? initialAmount;
  const currentLoanName = loanDetail?.loanName || initialLoanName || 'Loan';
  const currentApplicant = loanDetail?.applicantName || initialApplicantName || '—';
  const currentPurpose = loanDetail?.loanPurpose?.trim() ? loanDetail.loanPurpose : null;

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
      case 'paid':
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
      case 'paid':
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
      case 'paid':
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

  const allGuarantorsApproved = guarantors.length > 0 && approvedGuarantorsCount === guarantors.length;

  const nextSteps: NextStepItem[] = [
    {
      title: 'Guarantor Approvals',
      description:
        guarantors.length === 0
          ? 'No guarantors listed for this loan.'
          : hasRejectedGuarantor
            ? 'A guarantor has declined this loan request. You will need to select a new guarantor.'
            : pendingGuarantorsCount > 0
              ? `${pendingGuarantorsCount} guarantor${pendingGuarantorsCount > 1 ? 's are' : ' is'} awaiting your reminder to review and approve.`
              : 'All required guarantors have approved your loan application.',
      icon: hasRejectedGuarantor
        ? 'close-circle-outline'
        : pendingGuarantorsCount > 0 || guarantors.length === 0
          ? 'time-outline'
          : 'checkmark-circle-outline',
      color: hasRejectedGuarantor ? '#EF4444' : pendingGuarantorsCount > 0 || guarantors.length === 0 ? '#F59E0B' : '#10B981',
    },
    {
      title: 'Executive Committee Review',
      description: allGuarantorsApproved
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
    showToast(
      `A notification reminder has been queued for ${guarantorName} to approve your loan request.`,
      'info'
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
        {isLoading && !loanDetail ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={[styles.centerStateText, { color: textSecondary }]}>Loading loan details…</Text>
          </View>
        ) : null}

        {error && !loanDetail ? (
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.centerState}>
              <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
              <Text style={[styles.centerStateTitle, { color: textPrimary }]}>Failed to load loan</Text>
              <Text style={[styles.centerStateText, { color: textSecondary }]}>{error}</Text>
              <TouchableOpacity style={[styles.retryButton, { backgroundColor: primary }]} onPress={() => void fetchDetails()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
                <Text style={[styles.backLinkText, { color: primary }]}>Back to loans</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {error && loanDetail ? (
          <View style={[styles.inlineError, { backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2' }]}>
            <Text style={[styles.inlineErrorText, { color: isDark ? '#FECACA' : '#991B1B' }]}>{error}</Text>
          </View>
        ) : null}

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
            {currentAmount !== undefined ? formatMoney(currentAmount) : '—'}
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
              <Text style={[styles.metricLabel, { color: textSecondary }]}>REQUESTED</Text>
              <Text style={[styles.metricValue, { color: textPrimary }]}>{formatDate(initialCreated)}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={[styles.metricLabel, { color: textSecondary }]}>DURATION</Text>
              <Text style={[styles.metricValue, { color: textPrimary }]}>
                {loanDetail?.loanDuration || loanDetail?.repaymentPeriod
                  ? `${loanDetail?.loanDuration || loanDetail?.repaymentPeriod} Months`
                  : '—'}
              </Text>
            </View>
          </View>

          {(loanDetail?.membershipId || loanDetail?.membershipType) && (
            <View style={[styles.membershipRow, { borderTopColor: borderColor }]}>
              <Text style={[styles.membershipText, { color: textSecondary }]}>
                Membership: <Text style={{ color: textPrimary, fontWeight: '700' }}>{loanDetail.membershipId || '—'}</Text>
                {loanDetail.membershipType ? `  •  ${loanDetail.membershipType}` : ''}
              </Text>
              {loanDetail.totalSavings !== undefined ? (
                <Text style={[styles.membershipText, { color: textSecondary }]}>
                  Total savings: <Text style={{ color: textPrimary, fontWeight: '700' }}>{formatMoney(loanDetail.totalSavings)}</Text>
                </Text>
              ) : null}
            </View>
          )}
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

            {guarantors.length > 0 ? (
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
            ) : null}
          </View>

          {/* Guarantors List */}
          <View style={styles.guarantorsList}>
            {guarantors.length === 0 ? (
              <View style={[styles.emptyInline, { backgroundColor: inputBg, borderColor }]}>
                <Ionicons name="people-outline" size={22} color={textSecondary} />
                <Text style={[styles.emptyInlineText, { color: textSecondary }]}>
                  {isLoading ? 'Loading guarantors…' : 'No guarantors listed for this loan.'}
                </Text>
              </View>
            ) : null}
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

          {currentPurpose ? (
            <View style={[styles.detailBox, { backgroundColor: inputBg, borderColor }]}>
              <Text style={[styles.detailBoxLabel, { color: textSecondary }]}>PURPOSE</Text>
              <Text style={[styles.detailBoxText, { color: textPrimary }]}>"{currentPurpose}"</Text>
            </View>
          ) : null}

          <View style={styles.termsGrid}>
            <View style={[styles.termRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.termLabel, { color: textSecondary }]}>Interest Rate</Text>
              <Text style={[styles.termValue, { color: textPrimary }]}>
                {loanDetail?.interestRate !== undefined && loanDetail?.interestRate !== null
                  ? `${(loanDetail.interestRate * 100).toFixed(2).replace(/\.?0+$/, '')}%`
                  : '—'}
              </Text>
            </View>

            <View style={[styles.termRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.termLabel, { color: textSecondary }]}>Interest Type / Strategy</Text>
              <Text style={[styles.termValue, { color: textPrimary }]}>
                {[loanDetail?.interestType, loanDetail?.interestStrategy].filter(Boolean).join(' / ') || '—'}
              </Text>
            </View>

            <View style={[styles.termRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.termLabel, { color: textSecondary }]}>Total Interest</Text>
              <Text style={[styles.termValue, { color: textPrimary }]}>{formatMoney(loanDetail?.totalInterest)}</Text>
            </View>

            <View style={[styles.termRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.termLabel, { color: textSecondary }]}>Monthly Repayment</Text>
              <Text style={[styles.termValue, { color: textPrimary }]}>
                {loanDetail?.monthlyRepayment ? formatMoney(loanDetail.monthlyRepayment) : '—'}
              </Text>
            </View>

            <View style={[styles.termRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.termLabel, { color: textSecondary }]}>Repayment Period</Text>
              <Text style={[styles.termValue, { color: textPrimary }]}>
                {loanDetail?.repaymentPeriod ? `${loanDetail.repaymentPeriod} Months` : '—'}
              </Text>
            </View>

            <View style={[styles.termRow, { borderBottomColor: borderColor }]}>
              <Text style={[styles.termLabel, { color: textSecondary }]}>Processing Fee</Text>
              <Text style={[styles.termValue, { color: textPrimary }]}>{formatMoney(loanDetail?.processingFee)}</Text>
            </View>

            <View style={[styles.termRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.termLabel, { color: textSecondary }]}>Fee Payment Status</Text>
              <Text
                style={[
                  styles.termValue,
                  {
                    color:
                      loanDetail?.feePaymentStatus?.toLowerCase() === 'approved' ||
                      loanDetail?.feePaymentStatus?.toLowerCase() === 'paid'
                        ? '#10B981'
                        : textPrimary,
                  },
                ]}
              >
                {loanDetail?.feePaymentStatus || '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Repayment Schedule */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.sectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Repayment Schedule</Text>
              <Text style={[styles.sectionSub, { color: textSecondary }]}>
                {repaymentSchedule === null
                  ? 'View installment due dates and amounts for this loan'
                  : `${repaymentSchedule.length} installment${repaymentSchedule.length === 1 ? '' : 's'}`}
              </Text>
            </View>
            {repaymentSchedule !== null && repaymentSchedule.length > 0 ? (
              <TouchableOpacity
                style={[styles.refreshScheduleButton, { borderColor: primary }]}
                onPress={() => void fetchRepaymentSchedule()}
                disabled={isScheduleLoading}
              >
                <Ionicons name="refresh-outline" size={12} color={primary} />
                <Text style={[styles.refreshScheduleButtonText, { color: primary }]}>Refresh</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.scheduleButton,
              { backgroundColor: primary },
              (isScheduleLoading || !loanId) && styles.scheduleButtonDisabled,
            ]}
            onPress={handleScheduleButtonPress}
            disabled={isScheduleLoading || !loanId}
            activeOpacity={0.85}
          >
            {isScheduleLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons
                name={repaymentSchedule !== null && showSchedule ? 'chevron-up' : 'calendar-outline'}
                size={16}
                color="#FFFFFF"
              />
            )}
            <Text style={styles.scheduleButtonText}>
              {isScheduleLoading
                ? 'Loading Schedule…'
                : repaymentSchedule === null
                  ? 'View Repayment Schedule'
                  : showSchedule
                    ? 'Hide Repayment Schedule'
                    : 'Show Repayment Schedule'}
            </Text>
          </TouchableOpacity>

          {scheduleError ? (
            <View style={[styles.scheduleErrorBox, { backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2' }]}>
              <Text style={[styles.scheduleErrorText, { color: isDark ? '#FECACA' : '#991B1B' }]}>
                {scheduleError}
              </Text>
              <TouchableOpacity onPress={() => void fetchRepaymentSchedule()}>
                <Text style={[styles.scheduleRetryText, { color: isDark ? '#FECACA' : '#991B1B' }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {showSchedule && repaymentSchedule !== null ? (
            repaymentSchedule.length === 0 ? (
              <View style={[styles.emptyInline, { backgroundColor: inputBg, borderColor }]}>
                <Ionicons name="calendar-outline" size={22} color={textSecondary} />
                <Text style={[styles.emptyInlineText, { color: textSecondary }]}>
                  No repayment schedule available for this loan yet.
                </Text>
              </View>
            ) : (
              <View style={styles.scheduleList}>
                {repaymentSchedule.map((item) => (
                  <View
                    key={item.installmentNo}
                    style={[styles.installmentCard, { backgroundColor: inputBg, borderColor }]}
                  >
                    <View style={styles.installmentHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.installmentTitle, { color: textPrimary }]}>
                          Installment #{item.installmentNo}
                        </Text>
                        <Text style={[styles.installmentDueDate, { color: textSecondary }]}>
                          Due {formatDate(item.dueDate)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getScheduleStatusBg(item.status) },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: getScheduleStatusColor(item.status) },
                          ]}
                        >
                          {getScheduleStatusLabel(item.status)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.installmentGrid}>
                      <View style={styles.installmentMetric}>
                        <Text style={[styles.metricLabel, { color: textSecondary }]}>PRINCIPAL</Text>
                        <Text style={[styles.installmentMetricValue, { color: textPrimary }]}>
                          {formatMoney(item.principalExpected)}
                        </Text>
                      </View>
                      <View style={styles.installmentMetric}>
                        <Text style={[styles.metricLabel, { color: textSecondary }]}>INTEREST</Text>
                        <Text style={[styles.installmentMetricValue, { color: textPrimary }]}>
                          {formatMoney(item.interestExpected)}
                        </Text>
                      </View>
                      <View style={styles.installmentMetric}>
                        <Text style={[styles.metricLabel, { color: textSecondary }]}>TOTAL EXPECTED</Text>
                        <Text style={[styles.installmentMetricValue, { color: textPrimary }]}>
                          {formatMoney(item.totalExpected)}
                        </Text>
                      </View>
                      <View style={styles.installmentMetric}>
                        <Text style={[styles.metricLabel, { color: textSecondary }]}>AMOUNT PAID</Text>
                        <Text style={[styles.installmentMetricValue, { color: '#10B981' }]}>
                          {formatMoney(item.amountPaid)}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.installmentFooter, { borderTopColor: borderColor }]}>
                      <Text style={[styles.installmentFooterLabel, { color: textSecondary }]}>
                        Balance Remaining
                      </Text>
                      <Text style={[styles.installmentFooterValue, { color: textPrimary }]}>
                        {formatMoney(item.balanceRemaining)}
                      </Text>
                    </View>
                  </View>
                ))}

                <View style={[styles.scheduleTotals, { borderTopColor: borderColor }]}>
                  <View style={styles.scheduleTotalRow}>
                    <Text style={[styles.scheduleTotalLabel, { color: textSecondary }]}>Total Expected</Text>
                    <Text style={[styles.scheduleTotalValue, { color: textPrimary }]}>
                      {formatMoney(repaymentSchedule.reduce((sum, i) => sum + (i.totalExpected || 0), 0))}
                    </Text>
                  </View>
                  <View style={styles.scheduleTotalRow}>
                    <Text style={[styles.scheduleTotalLabel, { color: textSecondary }]}>Total Paid</Text>
                    <Text style={[styles.scheduleTotalValue, { color: '#10B981' }]}>
                      {formatMoney(repaymentSchedule.reduce((sum, i) => sum + (i.amountPaid || 0), 0))}
                    </Text>
                  </View>
                </View>
              </View>
            )
          ) : null}
        </View>

        {/* Transactions */}
        <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
          <Text style={[styles.sectionTitle, { color: textPrimary, marginBottom: 12 }]}>Transactions</Text>
          {transactions.length === 0 ? (
            <View style={[styles.emptyInline, { backgroundColor: inputBg, borderColor }]}>
              <Ionicons name="receipt-outline" size={22} color={textSecondary} />
              <Text style={[styles.emptyInlineText, { color: textSecondary }]}>
                {isLoading ? 'Loading transactions…' : 'No transactions for this loan yet.'}
              </Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((tx, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.transactionRow,
                    { borderBottomColor: borderColor, borderBottomWidth: idx === transactions.length - 1 ? 0 : 1 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.transactionName, { color: textPrimary }]}>{tx.transactionName}</Text>
                    <Text style={[styles.transactionDate, { color: textSecondary }]}>{formatDate(tx.date)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.transactionAmount, { color: textPrimary }]}>{formatMoney(tx.amount)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(tx.status) }]}>
                      <Text style={[styles.statusBadgeText, { color: getStatusColor(tx.status) }]}>{tx.status}</Text>
                    </View>
                    <Text style={[styles.transactionBalance, { color: textSecondary }]}>
                      Bal: {formatMoney(tx.balance)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
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

        {/* Contextual support entry */}
        <TouchableOpacity
          style={[styles.reportButton, { backgroundColor: cardBg, borderColor }]}
          onPress={() =>
            router.push({
              pathname: '/create-ticket',
              params: {
                category: 'LoanIssue',
                subject: `Issue with Loan ${currentLoanName} (#${loanId.slice(0, 8)})`,
              },
            })
          }
        >
          <Ionicons name="headset-outline" size={20} color={primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.reportTitle, { color: textPrimary }]}>Report an Issue</Text>
            <Text style={[styles.reportSubtitle, { color: textSecondary }]}>
              Get help with this loan from support
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={textSecondary} />
        </TouchableOpacity>
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
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  centerStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  centerStateText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  backLink: {
    marginTop: 10,
    padding: 6,
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  reportSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  inlineError: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineErrorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  membershipRow: {
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
    gap: 4,
  },
  membershipText: {
    fontSize: 12,
  },
  emptyInline: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  emptyInlineText: {
    fontSize: 12,
    textAlign: 'center',
  },
  transactionsList: {},
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 10,
  },
  transactionName: {
    fontSize: 13,
    fontWeight: '700',
  },
  transactionDate: {
    fontSize: 11,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  transactionBalance: {
    fontSize: 11,
    marginTop: 4,
  },
  scheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  scheduleButtonDisabled: {
    opacity: 0.6,
  },
  scheduleButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  refreshScheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  refreshScheduleButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scheduleErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  scheduleErrorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  scheduleRetryText: {
    fontSize: 12,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  scheduleList: {
    gap: 10,
  },
  installmentCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  installmentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  installmentTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  installmentDueDate: {
    fontSize: 11,
    marginTop: 2,
  },
  installmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
  },
  installmentMetric: {
    width: '50%',
    paddingRight: 8,
  },
  installmentMetricValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  installmentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  installmentFooterLabel: {
    fontSize: 12,
  },
  installmentFooterValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  scheduleTotals: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 6,
  },
  scheduleTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scheduleTotalLabel: {
    fontSize: 12,
  },
  scheduleTotalValue: {
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

