import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useToast } from '@/context/ToastContext';
import { getCurrentUserRoles, PRIVILEGED_MEMBER_ROLES } from '@/services/authService';
import {
  SupportService,
  type SupportAttachment,
  type SupportTicketDetailDto,
} from '@/services/support-service';

const QUICK_REPLIES = [
  'Receipt verified, ledger updated',
  'Please upload a clearer receipt',
  'Disbursement is being processed',
  'Your loan request is under review',
  'Payment received and confirmed',
  'We could not find that transaction',
  'Please confirm the exact amount',
  'Your savings balance has been updated',
  'Kindly re-upload the receipt as PDF',
  'Issue escalated to the finance team',
  'Your request has been approved',
  'Please provide your membership ID',
  'The deposit has been credited',
  'We are investigating this issue',
  'Resolution will follow within 24 hours',
  'Your account access has been restored',
  'Please reset your password and retry',
  'Duplicate payment detected and flagged',
  'Refund has been initiated',
  'Kindly confirm the transaction date',
  'Your ticket has been prioritized',
  'Supporting document received, thank you',
  'Please visit the branch with a valid ID',
  'Interest calculation verified correct',
  'Repayment schedule updated accordingly',
  'No anomaly found on your account',
  'We need a bank statement for review',
  'Your complaint has been logged',
  'Expect feedback before close of business',
  'Issue resolved, please confirm',
  'Let us know if this persists',
  'Thank you for your patience',
  'Case closed after verification',
  'We appreciate your feedback',
];

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

function readFileAsDataUrl(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      try {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsDataURL(xhr.response);
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Could not read file'));
      }
    };
    xhr.onerror = () => reject(new Error('Could not read file'));
    xhr.open('GET', uri);
    xhr.responseType = 'blob';
    void xhr.send();
  });
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TicketDetailScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ id?: string }>();
  const ticketId = params.id || '';

  const [ticket, setTicket] = useState<SupportTicketDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [attachment, setAttachment] = useState<SupportAttachment | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const primary = '#173581';

  const fetchTicket = useCallback(async () => {
    if (!ticketId) {
      setError('Missing ticket ID');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [detail, roles] = await Promise.all([
        SupportService.getTicket(ticketId),
        getCurrentUserRoles().catch(() => [] as string[]),
      ]);
      setTicket(detail);
      setIsAdmin(roles.some((role) => PRIVILEGED_MEMBER_ROLES.includes(role)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load support ticket');
      setTicket(null);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [ticketId]);

  // Refetch whenever this screen gains focus. Uses expo-router's pathname
  // state instead of navigation-context focus hooks.
  const pathname = usePathname();
  const wasFocusedRef = useRef(false);
  useEffect(() => {
    const isFocused = pathname === '/ticket-detail';
    if (isFocused && !wasFocusedRef.current) {
      void fetchTicket();
    }
    wasFocusedRef.current = isFocused;
  }, [pathname, fetchTicket]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchTicket();
  }, [fetchTicket]);

  const handlePickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'],
        copyToCacheDirectory: false,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if ((asset.size ?? 0) > MAX_ATTACHMENT_BYTES) {
        showToast('Attachment must not exceed 2MB.', 'warning');
        return;
      }
      setIsAttaching(true);
      try {
        const dataUrl = await readFileAsDataUrl(asset.uri);
        setAttachment({
          name: asset.name || 'attachment',
          contentType: asset.mimeType || 'application/octet-stream',
          dataUrl,
        });
      } catch {
        showToast('Could not read attachment', 'error');
      } finally {
        setIsAttaching(false);
      }
    } catch {
      showToast('Could not pick document', 'error');
    }
  };

  const handleSend = async (markAsResolved: boolean) => {
    if (!ticket || isSending) return;
    if (!replyBody.trim()) {
      showToast('Type a reply before sending.', 'warning');
      return;
    }
    setIsSending(true);
    try {
      await SupportService.addMessage(ticket.id, {
        body: replyBody.trim(),
        attachment,
        markAsResolved,
      });
      showToast(markAsResolved ? 'Reply sent and ticket resolved.' : 'Reply sent.', 'success');
      setReplyBody('');
      setAttachment(null);
      await fetchTicket();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to send reply', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return '#3B82F6';
      case 'AwaitingMember':
        return '#F59E0B';
      case 'Resolved':
        return '#10B981';
      default:
        return textSecondary;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'Open':
        return isDark ? '#1E3A8A' : '#DBEAFE';
      case 'AwaitingMember':
        return isDark ? '#78350F' : '#FEF3C7';
      case 'Resolved':
        return isDark ? '#064E3B' : '#D1FAE5';
      default:
        return isDark ? '#2D3748' : '#F3F4F6';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: ticket ? ticket.ticketNumber : 'Ticket Detail',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTintColor: textPrimary,
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false,
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={primary} />}
        >
          {isLoading && !ticket ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={primary} />
              <Text style={[styles.centerStateText, { color: textSecondary }]}>Loading ticket…</Text>
            </View>
          ) : null}

          {error && !ticket ? (
            <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
              <View style={styles.centerState}>
                <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
                <Text style={[styles.centerStateTitle, { color: textPrimary }]}>Failed to load ticket</Text>
                <Text style={[styles.centerStateText, { color: textSecondary }]}>{error}</Text>
                <TouchableOpacity style={[styles.retryButton, { backgroundColor: primary }]} onPress={() => void fetchTicket()}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
                  <Text style={[styles.backLinkText, { color: primary }]}>Back to tickets</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {ticket ? (
            <>
              {/* Ticket header */}
              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
                <View style={styles.headerTopRow}>
                  <Text style={[styles.ticketNumber, { color: textSecondary }]}>{ticket.ticketNumber}</Text>
                  <View style={[styles.statusPill, { backgroundColor: getStatusBgColor(ticket.status) }]}>
                    <Text style={[styles.statusPillText, { color: getStatusColor(ticket.status) }]}>
                      {ticket.status === 'AwaitingMember' ? 'Awaiting you' : ticket.status}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.subjectText, { color: textPrimary }]}>{ticket.subject}</Text>
                <Text style={[styles.metaText, { color: textSecondary }]}>
                  {ticket.category}{isAdmin ? ` • ${ticket.memberName}` : ''} • Opened {formatDateTime(ticket.createdAt)}
                </Text>
              </View>

              {/* Message thread (chronological) */}
              {ticket.messages.map((message) => {
                const mine = message.isAdminReply === isAdmin;
                return (
                  <View
                    key={message.id}
                    style={[
                      styles.messageRow,
                      mine ? styles.messageRowRight : styles.messageRowLeft,
                    ]}
                  >
                    <View
                      style={[
                        styles.messageBubble,
                        {
                          backgroundColor: message.isAdminReply
                            ? primary
                            : isDark
                              ? '#2D3748'
                              : '#EDF2F7',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.senderName,
                          { color: message.isAdminReply ? 'rgba(255,255,255,0.8)' : textSecondary },
                        ]}
                      >
                        {message.isAdminReply ? `Support • ${message.senderName}` : message.senderName}
                      </Text>
                      <Text
                        style={[
                          styles.messageBody,
                          { color: message.isAdminReply ? '#FFFFFF' : textPrimary },
                        ]}
                      >
                        {message.body}
                      </Text>
                      {message.attachmentUrl ? (
                        <Text
                          style={[
                            styles.attachmentHint,
                            { color: message.isAdminReply ? 'rgba(255,255,255,0.85)' : primary },
                          ]}
                        >
                          📎 Attachment included
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          styles.messageTime,
                          { color: message.isAdminReply ? 'rgba(255,255,255,0.7)' : textSecondary },
                        ]}
                      >
                        {formatDateTime(message.createdAt)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </>
          ) : null}
        </ScrollView>

        {/* Reply bar */}
        {ticket && ticket.status !== 'Resolved' ? (
          <View style={[styles.replyBar, { backgroundColor: cardBg, borderTopColor: inputBorder }]}>
            {isAdmin ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                {QUICK_REPLIES.map((chip) => (
                  <TouchableOpacity
                    key={chip}
                    style={[styles.chip, { backgroundColor: inputBg, borderColor: inputBorder }]}
                    onPress={() => setReplyBody(chip)}
                  >
                    <Text style={[styles.chipText, { color: textPrimary }]} numberOfLines={1}>
                      {chip}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            {attachment ? (
              <View style={[styles.replyAttachment, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                <Ionicons name="attach-outline" size={16} color={primary} />
                <Text style={[styles.replyAttachmentName, { color: textPrimary }]} numberOfLines={1}>
                  {attachment.name}
                </Text>
                <TouchableOpacity onPress={() => setAttachment(null)}>
                  <Ionicons name="close-circle" size={18} color={textSecondary} />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.replyInputRow}>
              <TouchableOpacity
                style={[styles.attachButton, { borderColor: inputBorder }]}
                onPress={() => void handlePickAttachment()}
                disabled={isAttaching || isSending}
              >
                {isAttaching ? (
                  <ActivityIndicator size="small" color={primary} />
                ) : (
                  <Ionicons name="attach-outline" size={20} color={textSecondary} />
                )}
              </TouchableOpacity>
              <TextInput
                style={[styles.replyInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                placeholder="Type a reply..."
                placeholderTextColor={textSecondary}
                value={replyBody}
                onChangeText={setReplyBody}
                multiline
                editable={!isSending}
              />
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: primary }]}
                onPress={() => void handleSend(false)}
                disabled={isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>

            {isAdmin ? (
              <TouchableOpacity
                style={[styles.resolveButton, { borderColor: '#10B981' }]}
                onPress={() => void handleSend(true)}
                disabled={isSending}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                <Text style={styles.resolveButtonText}>Send & Resolve</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 24,
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
  sectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ticketNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subjectText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  senderName: {
    fontSize: 10,
    fontWeight: '700',
  },
  messageBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  attachmentHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  messageTime: {
    fontSize: 10,
  },
  replyBar: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  chipRow: {
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    maxWidth: 260,
  },
  chipText: {
    fontSize: 12,
  },
  replyAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    marginBottom: 8,
  },
  replyAttachmentName: {
    flex: 1,
    fontSize: 12,
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 110,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
    marginTop: 8,
  },
  resolveButtonText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default TicketDetailScreen;
