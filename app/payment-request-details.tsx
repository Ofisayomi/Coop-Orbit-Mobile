import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/context/ToastContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCurrentUserRoles, PRIVILEGED_MEMBER_ROLES } from '@/services/authService';
import {
  PaymentRequestService,
  type RevertPaymentRequestPayload,
} from '@/services/payment-request-service';
import type { PaymentRequestsDto } from './payment-requests';

/** Roles allowed to see and use the revert button. */
const REVERT_ROLES = PRIVILEGED_MEMBER_ROLES;

/** Validity window of the revert OTP, in seconds (matches the backend). */
const OTP_VALIDITY_SECONDS = 60;

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function PaymentRequestDetailsScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ id?: string }>();
  const requestId = params.id || '';

  const [request, setRequest] = useState<PaymentRequestsDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [adminNote, setAdminNote] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Revert + OTP state
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(OTP_VALIDITY_SECONDS);
  const [otpRound, setOtpRound] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const tableBorder = isDark ? '#2D3748' : '#F7FAFC';
  const primary = '#173581';

  const fetchDetails = useCallback(async () => {
    if (!requestId) {
      setError('Missing payment request ID');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const detail = await PaymentRequestService.getPaymentRequest(requestId);
      setRequest(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load payment request');
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void fetchDetails();
  }, [fetchDetails]);

  useEffect(() => {
    void getCurrentUserRoles().then(setUserRoles).catch(() => setUserRoles([]));
  }, []);

  const canRevert = userRoles.some((role) => REVERT_ROLES.includes(role));

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

  const getStatusBgColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return isDark ? '#064E3B' : '#D1FAE5';
      case 'pending':
        return isDark ? '#78350F' : '#FEF3C7';
      case 'rejected':
      case 'cancelled':
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
      case 'cancelled':
        return 'close-circle';
      default:
        return 'help-circle-outline';
    }
  };

  const handleCancelRequest = () => {
    if (!request) return;
    Alert.alert(
      'Cancel Payment Request',
      'Are you sure you want to cancel this payment request?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setIsCancelling(true);
            try {
              await PaymentRequestService.cancelPaymentRequest(request.id, 'Cancelled by user');
              showToast('Payment request cancelled', 'success');
              await fetchDetails();
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Unable to cancel payment request', 'error');
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  };

  /** Start the revert flow: email a 1-minute OTP to the user that raised the request. */
  const handleRevertPress = () => {
    if (!request) return;
    Alert.alert(
      'Revert Payment Request',
      'A verification code will be emailed to the member who raised this request. Enter it within 1 minute to confirm the reversal.',
      [
        { text: 'Back', style: 'cancel' },
        { text: 'Send Code', onPress: () => void sendRevertOtp() },
      ]
    );
  };

  const sendRevertOtp = async () => {
    if (!request) return;
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      await PaymentRequestService.requestRevertOtp(request.id);
      setOtpCode('');
      setOtpRound((round) => round + 1);
      setOtpModalVisible(true);
      showToast('Verification code sent to the request initiator', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to send revert OTP', 'error');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 1-minute countdown while the OTP modal is open. Restarts on every resend.
  useEffect(() => {
    if (!otpModalVisible) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setSecondsLeft(OTP_VALIDITY_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [otpModalVisible, otpRound]);

  const otpExpired = secondsLeft <= 0;

  /** Submit the revert together with the OTP the initiator received. */
  const handleVerifyOtp = async () => {
    if (!request || isReverting) return;
    if (otpCode.trim().length < 6) {
      setOtpError('Enter the 6-digit code sent to the initiator');
      return;
    }
    setIsReverting(true);
    setOtpError(null);
    const payload: RevertPaymentRequestPayload = { note: adminNote, otp: otpCode.trim() };
    try {
      await PaymentRequestService.revertPaymentRequest(request.id, payload);
      setOtpModalVisible(false);
      setOtpCode('');
      showToast('Payment request reverted', 'success');
      await fetchDetails();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OTP validation failed';
      setOtpError(message);
      showToast(message, 'error');
    } finally {
      setIsReverting(false);
    }
  };

  const closeOtpModal = () => {
    if (isReverting) return;
    setOtpModalVisible(false);
    setOtpCode('');
    setOtpError(null);
  };

  const status = request?.status ?? '';
  const statusColor = getStatusColor(status);
  const formattedDate = request
    ? new Date(request.transactionDate).toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';
  const createdDate = request?.createdAt
    ? new Date(request.createdAt).toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';
  const isPending = status.toLowerCase() === 'pending';
  const isApproved = status.toLowerCase() === 'approved';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Payment Request Details',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTintColor: textPrimary,
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false,
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {isLoading && !request ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={[styles.centerStateText, { color: textSecondary }]}>Loading payment request…</Text>
          </View>
        ) : null}

        {error && !request ? (
          <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
            <View style={styles.centerState}>
              <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
              <Text style={[styles.centerStateTitle, { color: textPrimary }]}>Failed to load request</Text>
              <Text style={[styles.centerStateText, { color: textSecondary }]}>{error}</Text>
              <TouchableOpacity style={[styles.retryButton, { backgroundColor: primary }]} onPress={() => void fetchDetails()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
                <Text style={[styles.backLinkText, { color: primary }]}>Back to requests</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {request ? (
          <>
            {/* Status hero: mirrors the web detail header */}
            <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
              <View style={styles.heroTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroLabel, { color: textSecondary }]}>TOTAL REQUESTED</Text>
                  <Text style={[styles.heroAmount, { color: textPrimary }]}>
                    ₦{request.amount.toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(status) }]}>
                  <Ionicons name={getStatusIconName(status)} size={14} color={statusColor} />
                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>{status}</Text>
                </View>
              </View>
              <View style={[styles.heroDivider, { backgroundColor: tableBorder }]} />
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: textSecondary }]}>INITIATOR</Text>
                  <Text style={[styles.metricValue, { color: textPrimary }]} numberOfLines={1}>
                    {request.beneficiaryName}
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: textSecondary }]}>REQUEST ID</Text>
                  <Text style={[styles.metricValue, { color: textPrimary }]} numberOfLines={1}>
                    {request.id}
                  </Text>
                </View>
              </View>
              <View style={styles.metricsRow}>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: textSecondary }]}>DATE REQUESTED</Text>
                  <Text style={[styles.metricValue, { color: textPrimary }]}>{formattedDate}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={[styles.metricLabel, { color: textSecondary }]}>MEMBER ID</Text>
                  <Text style={[styles.metricValue, { color: textPrimary }]}>
                    {request.membershipId || '—'}
                  </Text>
                </View>
              </View>
              {createdDate ? (
                <Text style={[styles.submittedText, { color: textSecondary }]}>
                  Submitted on {createdDate} • Split across {request.accountCount}{' '}
                  {request.accountCount === 1 ? 'account' : 'accounts'}
                </Text>
              ) : null}
            </View>

            {/* Split breakdown: mirrors the web proposed-split table */}
            <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>Proposed Split Breakdown</Text>
                <Text style={[styles.sectionSub, { color: primary }]}>
                  ₦{request.amount.toLocaleString()}
                </Text>
              </View>
              {request.requestAccounts && request.requestAccounts.length > 0 ? (
                <>
                  <View style={[styles.progressBar, { backgroundColor: inputBg }]}>
                    {request.requestAccounts.map((acc, index) => (
                      <View
                        key={acc.accountId || index}
                        style={[
                          styles.progressSegment,
                          {
                            width: `${acc.percentage ?? 0}%`,
                            backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
                          },
                        ]}
                      />
                    ))}
                  </View>
                  {request.requestAccounts.map((acc, index) => (
                    <View
                      key={acc.accountId || index}
                      style={[
                        styles.breakdownRow,
                        index < request.requestAccounts!.length - 1 && {
                          borderBottomColor: tableBorder,
                          borderBottomWidth: 1,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={styles.breakdownNameRow}>
                          <View
                            style={[
                              styles.breakdownDot,
                              { backgroundColor: SEGMENT_COLORS[index % SEGMENT_COLORS.length] },
                            ]}
                          />
                          <Text style={[styles.breakdownAccName, { color: textPrimary }]}>
                            {acc.accountName}
                          </Text>
                        </View>
                        {acc.percentage != null ? (
                          <Text style={[styles.breakdownPercent, { color: textSecondary }]}>
                            {acc.percentage}% of total
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.breakdownAmount, { color: primary }]}>
                        ₦{acc.amount.toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={[styles.emptyBreakdown, { color: textSecondary }]}>
                  No split breakdown available for this request.
                </Text>
              )}
            </View>

            {/* Decision section */}
            <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>Decision</Text>
              <Text style={[styles.sectionSub, { color: textSecondary }]}>
                {isPending
                  ? 'This request is awaiting review.'
                  : isApproved
                    ? 'This request has been approved and can be reverted by privileged roles.'
                    : `This request is ${status.toLowerCase()}.`}
              </Text>

              <Text style={[styles.noteLabel, { color: textSecondary }]}>NOTE (OPTIONAL)</Text>
              <TextInput
                style={[
                  styles.noteInput,
                  { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary },
                ]}
                placeholder="Reason for this action..."
                placeholderTextColor={textSecondary}
                value={adminNote}
                onChangeText={setAdminNote}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {isPending ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: '#EF4444' }]}
                  onPress={handleCancelRequest}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Cancel Payment Request</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}

              {isApproved && canRevert ? (
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: primary }]}
                  onPress={handleRevertPress}
                  disabled={isSendingOtp}
                >
                  {isSendingOtp ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="refresh-circle-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>Revert Payment Request</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* OTP validation modal with 1-minute countdown */}
      <Modal
        visible={otpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeOtpModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: cardBg }]}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="shield-checkmark-outline" size={32} color={primary} />
            </View>
            <Text style={[styles.modalTitle, { color: textPrimary }]}>Confirm Reversal</Text>
            <Text style={[styles.modalSub, { color: textSecondary }]}>
              Enter the 6-digit code emailed to {request?.beneficiaryName ?? 'the initiator'}.
            </Text>

            <View
              style={[
                styles.countdownPill,
                { backgroundColor: otpExpired ? '#FEE2E2' : '#FEF3C7' },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={otpExpired ? '#DC2626' : '#B45309'}
              />
              <Text
                style={[
                  styles.countdownText,
                  { color: otpExpired ? '#DC2626' : '#B45309' },
                ]}
              >
                {otpExpired ? 'Code expired' : `Expires in ${formatCountdown(secondsLeft)}`}
              </Text>
            </View>

            <TextInput
              style={[
                styles.otpInput,
                { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary },
              ]}
              placeholder="6-digit code"
              placeholderTextColor={textSecondary}
              value={otpCode}
              onChangeText={(value) => {
                setOtpCode(value.replace(/[^0-9]/g, '').slice(0, 6));
                if (otpError) setOtpError(null);
              }}
              keyboardType="number-pad"
              maxLength={6}
              editable={!isReverting}
            />

            {otpError ? <Text style={styles.otpErrorText}>{otpError}</Text> : null}

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: otpExpired ? '#9CA3AF' : primary, marginTop: 16 },
              ]}
              onPress={() => void handleVerifyOtp()}
              disabled={isReverting || otpExpired}
            >
              {isReverting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.actionButtonText}>Verify & Revert</Text>
              )}
            </TouchableOpacity>

            <View style={styles.modalRow}>
              <TouchableOpacity onPress={closeOtpModal} disabled={isReverting}>
                <Text style={[styles.modalLink, { color: textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void sendRevertOtp()}
                disabled={isSendingOtp || isReverting}
              >
                <Text style={[styles.modalLink, { color: primary }]}>
                  {isSendingOtp ? 'Sending…' : 'Resend code'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const SEGMENT_COLORS = [
  '#173581',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#06B6D4',
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  centerStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  centerStateTitle: {
    fontSize: 16,
    fontWeight: '700',
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
  backLink: {
    marginTop: 8,
    padding: 8,
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 26,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  heroDivider: {
    height: 1,
    marginVertical: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  submittedText: {
    fontSize: 12,
    marginTop: 4,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  progressBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressSegment: {
    height: '100%',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  breakdownNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownAccName: {
    fontSize: 13,
    fontWeight: '600',
  },
  breakdownPercent: {
    fontSize: 11,
    marginTop: 2,
    marginLeft: 16,
  },
  breakdownAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyBreakdown: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  noteLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    minHeight: 72,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 12,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '700',
  },
  otpInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 4,
  },
  otpErrorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 16,
  },
  modalLink: {
    fontSize: 13,
    fontWeight: '600',
    padding: 4,
  },
});
