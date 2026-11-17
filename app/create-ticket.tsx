import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { withExternalActivity } from '@/services/authService';
import {
  SupportService,
  type SupportAttachment,
  type SupportTicketCategory,
} from '@/services/support-service';

const CATEGORIES: { value: SupportTicketCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'LoanIssue', label: 'Loan Issue', icon: 'document-text-outline' },
  { value: 'SavingsOrDeposit', label: 'Savings / Deposit', icon: 'wallet-outline' },
  { value: 'AccountAccess', label: 'Account Access', icon: 'key-outline' },
  { value: 'General', label: 'General', icon: 'chatbubble-ellipses-outline' },
];

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/** Read a picked file as a base64 data-URL via XHR (no extra native deps). */
function readFileAsDataUrl(uri: string, mimeType: string): Promise<string> {
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

const CreateTicketScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ subject?: string; category?: string }>();

  const [category, setCategory] = useState<SupportTicketCategory>(
    (params.category as SupportTicketCategory) || 'General'
  );
  const [subject, setSubject] = useState(params.subject ?? '');
  const [body, setBody] = useState('');
  const [attachment, setAttachment] = useState<SupportAttachment | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const primary = '#173581';

  const handlePickAttachment = async () => {
    try {
      const result = await withExternalActivity(() => DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'],
        copyToCacheDirectory: false,
        multiple: false,
      }));
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if ((asset.size ?? 0) > MAX_ATTACHMENT_BYTES) {
        showToast('Attachment must not exceed 2MB.', 'warning');
        return;
      }
      setIsAttaching(true);
      try {
        const dataUrl = await readFileAsDataUrl(asset.uri, asset.mimeType || 'application/octet-stream');
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

  const handleSubmit = async () => {
    if (!subject.trim()) {
      showToast('Enter a subject for your ticket.', 'warning');
      return;
    }
    if (!body.trim()) {
      showToast('Describe the issue you need help with.', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const created = await SupportService.createTicket({
        category,
        subject: subject.trim(),
        body: body.trim(),
        attachment,
      });
      showToast(`Ticket ${created.ticketNumber} created.`, 'success');
      router.replace({ pathname: '/ticket-detail', params: { id: created.id } });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to create support ticket', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'New Support Ticket',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTintColor: textPrimary,
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false,
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Category */}
          <Text style={[styles.label, { color: textPrimary }]}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((item) => {
              const selected = category === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.categoryCard,
                    { backgroundColor: cardBg, borderColor: selected ? primary : inputBorder },
                    selected && { borderWidth: 2 },
                  ]}
                  onPress={() => setCategory(item.value)}
                >
                  <Ionicons name={item.icon} size={20} color={selected ? primary : textSecondary} />
                  <Text
                    style={[styles.categoryLabel, { color: selected ? primary : textSecondary }]}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Subject */}
          <Text style={[styles.label, { color: textPrimary }]}>Subject</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
            placeholder="e.g. Issue with Loan #LN-204"
            placeholderTextColor={textSecondary}
            value={subject}
            onChangeText={setSubject}
            maxLength={200}
          />

          {/* Message */}
          <Text style={[styles.label, { color: textPrimary }]}>Message</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
            placeholder="Describe the issue in detail..."
            placeholderTextColor={textSecondary}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={6}
            maxLength={4000}
            textAlignVertical="top"
          />

          {/* Attachment */}
          <Text style={[styles.label, { color: textPrimary }]}>Receipt / Screenshot (optional)</Text>
          {attachment ? (
            <View style={[styles.attachmentBadge, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <Ionicons name="attach-outline" size={18} color={primary} />
              <Text style={[styles.attachmentName, { color: textPrimary }]} numberOfLines={1}>
                {attachment.name}
              </Text>
              <TouchableOpacity onPress={() => setAttachment(null)}>
                <Ionicons name="close-circle" size={18} color={textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.uploadButton, { borderColor: inputBorder }]}
              onPress={() => void handlePickAttachment()}
              disabled={isAttaching}
            >
              {isAttaching ? (
                <ActivityIndicator size="small" color={primary} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={22} color={primary} />
                  <Text style={[styles.uploadText, { color: primary }]}>Select PDF or Image (max 2MB)</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.submitButton, { backgroundColor: primary }, isSubmitting && styles.submitButtonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Submit Ticket</Text>
                <Ionicons name="send" size={16} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
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
    paddingBottom: 32,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 140,
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  attachmentName: {
    flex: 1,
    fontSize: 13,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 16,
    gap: 8,
  },
  uploadText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    marginTop: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default CreateTicketScreen;
