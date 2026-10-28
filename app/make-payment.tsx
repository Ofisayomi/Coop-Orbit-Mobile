import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, useRouter } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { AccountService, type AccountDto, type UserSearchDto } from '@/services/accountService';
import { getValidAccessToken } from '@/services/authService';

interface AccessTokenClaims {
  name?: string;
  preferred_username?: string;
  given_name?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
}

const DEFAULT_ACCOUNTS = [
  { id: '1', accountName: 'Cooperative Savings', accountType: 'Savings' },
  { id: '2', accountName: 'Loan Repayment', accountType: 'Loans' },
  { id: '3', accountName: 'Shares / Contributions', accountType: 'Shares' },
];

export default function SplitPaymentScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Role & Token State
  const [canSelectBeneficiary, setCanSelectBeneficiary] = useState(false);
  const [currentUserName, setCurrentUserName] = useState('Myself');

  // Accounts state
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  // Form State
  const [paymentTarget, setPaymentTarget] = useState<'myself' | 'member'>('myself');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchDto[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<UserSearchDto | null>(null);

  const [totalTransferStr, setTotalTransferStr] = useState('');
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [attachedFiles, setAttachedFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Theme Colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#4A5568';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const borderColor = isDark ? '#2D3748' : '#E2E8F0';
  const primary = '#173581';

  // Derived Calculations
  const totalTransfer = parseFloat(totalTransferStr.replace(/,/g, '')) || 0;
  const totalAllocated: number = Object.values<string>(allocations).reduce((acc: number, val: string) => {
    const num = parseFloat(val.replace(/,/g, '')) || 0;
    return acc + num;
  }, 0);

  const remaining = totalTransfer - totalAllocated;
  const isBalanced = totalTransfer > 0 && remaining === 0;
  const isOverAllocated = remaining < 0;
  const allocationPercent = totalTransfer > 0 ? Math.min(100, (totalAllocated / totalTransfer) * 100) : 0;

  // 1. Check User Roles from Token
  useEffect(() => {
    const checkRolesAndUser = async () => {
      try {
        const token = await getValidAccessToken();
        const claims = jwtDecode<AccessTokenClaims>(token);
        const roles = [
          ...(claims.realm_access?.roles ?? []),
          ...Object.values(claims.resource_access ?? {}).flatMap((client) => client.roles ?? []),
        ];
        const hasBeneficiaryRole = roles.some((role) => ['Admin', 'Secretary'].includes(role));
        setCanSelectBeneficiary(hasBeneficiaryRole);

        const name = claims.name || claims.preferred_username || claims.given_name || 'Myself';
        setCurrentUserName(name);
      } catch {
        setCanSelectBeneficiary(false);
      }
    };

    void checkRolesAndUser();
  }, []);

  // 2. Load Payment Accounts
  const loadAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    try {
      const fetchedAccounts = await AccountService.getPaymentAccounts();
      const active = fetchedAccounts.filter((acc) => acc.isActive !== false);
      if (active.length > 0) {
        setAccounts(active);
      } else {
        setAccounts(DEFAULT_ACCOUNTS as any);
      }
    } catch {
      setAccounts(DEFAULT_ACCOUNTS as any);
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  // 3. Search Members (when Admin/Secretary selects 'member')
  const handleSearchMembers = async (query: string) => {
    setMemberSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearchingMembers(true);
    try {
      const results = await AccountService.searchMembers(query);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearchingMembers(false);
    }
  };

  const handleSelectMember = (member: UserSearchDto) => {
    setSelectedMember(member);
    setMemberSearchQuery('');
    setSearchResults([]);
  };

  const handleDocumentPick = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'application/pdf'],
        copyToCacheDirectory: false,
        multiple: true,
      });

      if (!result.canceled && result.assets) {
        setAttachedFiles((prev) => [...prev, ...result.assets]);
      }
    } catch {
      Alert.alert('Error', 'Could not pick document');
    }
  };

  const removeFile = (uri: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.uri !== uri));
  };

  const handleAllocationChange = (id: string, value: string) => {
    const formatted = value.replace(/[^0-9]/g, '');
    setAllocations((prev) => ({
      ...prev,
      [id]: formatted,
    }));
  };

  const autoFillAccount = (id: string) => {
    if (remaining <= 0) return;
    const currentVal = parseFloat(allocations[id] || '0') || 0;
    const proposed = currentVal + remaining;
    handleAllocationChange(id, String(proposed));
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'Savings':
        return 'wallet-outline';
      case 'Loans':
        return 'document-text-outline';
      case 'Shares':
        return 'pie-chart-outline';
      default:
        return 'cash-outline';
    }
  };

  const submitPayment = async () => {
    if (!isBalanced || totalTransfer <= 0) {
      Alert.alert('Validation Error', 'Please ensure total allocated matches the transfer amount exactly.');
      return;
    }

    if (canSelectBeneficiary && paymentTarget === 'member' && !selectedMember) {
      Alert.alert('Beneficiary Required', 'Please select a beneficiary member before completing the allocation.');
      return;
    }

    setIsSubmitting(true);
    try {
      const requestAmounts = accounts
        .map((acc) => ({
          accountId: acc.id,
          amount: parseFloat(allocations[acc.id] || '0') || 0,
        }))
        .filter((acc) => acc.amount > 0);

      const payload = {
        amount: totalTransfer,
        requestAmounts,
        beneficiaryId: paymentTarget === 'member' && selectedMember ? selectedMember.id : undefined,
        transactionDate: new Date().toISOString(),
        receipts: attachedFiles.map((file) => ({
          id: file.uri,
          name: file.name,
          contentType: file.mimeType || 'application/octet-stream',
          size: file.size || 0,
        })),
      };

      await AccountService.createPaymentRequest(payload);
      Alert.alert('Success', 'Split payment request submitted successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit payment request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'New Split Payment',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTintColor: textPrimary,
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false,
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[styles.subtitle, { color: textSecondary, marginBottom: 20 }]}>
            Distribute a single transfer across your savings, loans, and contributions.
          </Text>

          <View style={[styles.card, { backgroundColor: cardBg }]}>
            {/* PAYMENT BENEFICIARY - Visible ONLY for Admin & Secretary */}
            {canSelectBeneficiary && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>PAYMENT BENEFICIARY</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.toggleOption,
                      { borderColor: paymentTarget === 'myself' ? '#10B981' : borderColor },
                      paymentTarget === 'myself' && { backgroundColor: isDark ? '#064E3B20' : '#ECFDF5' },
                    ]}
                    onPress={() => {
                      setPaymentTarget('myself');
                      setSelectedMember(null);
                    }}
                  >
                    <View style={[styles.radio, paymentTarget === 'myself' && styles.radioActive]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.toggleTitle, { color: textPrimary }]}>Pay for Myself</Text>
                      <Text style={[styles.toggleSub, { color: textSecondary }]} numberOfLines={1}>
                        {currentUserName} (Officer)
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.toggleOption,
                      { borderColor: paymentTarget === 'member' ? '#10B981' : borderColor },
                      paymentTarget === 'member' && { backgroundColor: isDark ? '#064E3B20' : '#ECFDF5' },
                    ]}
                    onPress={() => setPaymentTarget('member')}
                  >
                    <View style={[styles.radio, paymentTarget === 'member' && styles.radioActive]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.toggleTitle, { color: textPrimary }]}>Pay for a Member</Text>
                      <Text style={[styles.toggleSub, { color: textSecondary }]}>Search database</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Member Search if 'member' target is active */}
                {paymentTarget === 'member' && (
                  <View style={styles.searchContainer}>
                    <Text style={[styles.inputLabel, { color: textSecondary }]}>Select Member Account</Text>

                    {selectedMember ? (
                      <View style={[styles.selectedMemberBadge, { borderColor, backgroundColor: inputBg }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.selectedMemberName, { color: textPrimary }]}>
                            {selectedMember.firstName} {selectedMember.lastName}
                          </Text>
                          {selectedMember.membershipId ? (
                            <Text style={[styles.selectedMemberId, { color: textSecondary }]}>
                              ID: {selectedMember.membershipId}
                            </Text>
                          ) : null}
                        </View>
                        <TouchableOpacity onPress={() => setSelectedMember(null)} style={{ padding: 4 }}>
                          <Ionicons name="close-circle" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View>
                        <View style={[styles.searchBox, { borderColor, backgroundColor: inputBg }]}>
                          <Ionicons name="search" size={18} color={textSecondary} style={{ marginRight: 8 }} />
                          <TextInput
                            style={[styles.searchInput, { color: textPrimary }]}
                            placeholder="Search by name, email, or ID..."
                            placeholderTextColor={textSecondary}
                            value={memberSearchQuery}
                            onChangeText={handleSearchMembers}
                          />
                          {isSearchingMembers && <ActivityIndicator size="small" color={primary} />}
                        </View>

                        {/* Search results dropdown */}
                        {searchResults.length > 0 && (
                          <View style={[styles.searchResultsList, { borderColor, backgroundColor: cardBg }]}>
                            {searchResults.map((member) => (
                              <TouchableOpacity
                                key={member.id}
                                style={[styles.searchResultItem, { borderBottomColor: borderColor }]}
                                onPress={() => handleSelectMember(member)}
                              >
                                <View style={[styles.memberAvatarCircle, { backgroundColor: primary }]}>
                                  <Text style={styles.memberAvatarText}>
                                    {(member.firstName || 'M').charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.resultMemberName, { color: textPrimary }]}>
                                    {member.firstName} {member.lastName}
                                  </Text>
                                  {member.membershipId ? (
                                    <Text style={[styles.resultMemberSub, { color: textSecondary }]}>
                                      ID: {member.membershipId}
                                    </Text>
                                  ) : null}
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={textSecondary} />
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Total Transfer Amount */}
            <View style={[styles.section, { borderTopWidth: canSelectBeneficiary ? 1 : 0, borderColor, paddingTop: canSelectBeneficiary ? 24 : 0 }]}>
              <Text style={styles.sectionLabelCenter}>TOTAL BANK TRANSFER AMOUNT</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.currencySymbol}>₦</Text>
                <TextInput
                  style={[styles.hugeInput, { color: textPrimary }]}
                  placeholder="0"
                  placeholderTextColor={textSecondary}
                  keyboardType="numeric"
                  value={totalTransferStr}
                  onChangeText={(val) => {
                    const formatted = val.replace(/[^0-9]/g, '');
                    setTotalTransferStr(formatted);
                  }}
                />
              </View>
              {isBalanced ? (
                <View style={styles.balancedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.balancedText}>Amount Validated</Text>
                </View>
              ) : isOverAllocated ? (
                <View style={[styles.balancedBadge, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={[styles.balancedText, { color: '#EF4444' }]}>
                    ₦{Math.abs(remaining).toLocaleString()} Over-allocated
                  </Text>
                </View>
              ) : (
                <View style={styles.amountDivider} />
              )}
            </View>

            {/* Allocation Progress */}
            <View style={[styles.progressSection, { borderTopWidth: 1, borderColor, backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressTitle, { color: textPrimary }]}>Allocation Progress</Text>
                <Text style={[styles.progressAmounts, { color: textSecondary }]}>
                  <Text style={{ fontWeight: 'bold', color: textPrimary }}>₦{totalAllocated.toLocaleString()}</Text> of ₦{totalTransfer.toLocaleString()}
                </Text>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${allocationPercent}%`,
                      backgroundColor: isBalanced ? '#10B981' : isOverAllocated ? '#EF4444' : primary,
                    },
                  ]}
                />
              </View>
              {totalTransfer > 0 && !isBalanced && !isOverAllocated && (
                <Text style={styles.remainingText}>₦{remaining.toLocaleString()} Remaining</Text>
              )}
            </View>

            {/* Account Allocations List */}
            <View style={styles.allocationList}>
              {isLoadingAccounts ? (
                <ActivityIndicator style={{ paddingVertical: 24 }} color={primary} />
              ) : (
                accounts.map((account) => {
                  const allocatedVal = parseFloat(allocations[account.id] || '0') || 0;
                  return (
                    <View key={account.id} style={[styles.accountSplitCard, { borderColor, backgroundColor: inputBg }]}>
                      <View style={styles.splitInfo}>
                        <View style={[styles.splitIcon, { backgroundColor: primary + '15' }]}>
                          <Ionicons name={getAccountIcon(account.accountType) as any} size={20} color={primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.splitLabel, { color: textPrimary }]}>{account.accountName}</Text>
                          <Text style={[styles.splitSub, { color: textSecondary }]}>
                            {account.accountType}
                          </Text>
                        </View>

                        {remaining > 0 && (
                          <TouchableOpacity
                            style={[styles.autoFillButton, { borderColor: primary }]}
                            onPress={() => autoFillAccount(account.id)}
                          >
                            <Text style={[styles.autoFillText, { color: primary }]}>+ Auto-fill</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <View style={[styles.inputContainer, { borderColor, backgroundColor: cardBg }]}>
                        <Text style={styles.inputCurrency}>₦</Text>
                        <TextInput
                          style={[styles.splitInput, { color: textPrimary }]}
                          placeholder="0"
                          placeholderTextColor={textSecondary}
                          keyboardType="numeric"
                          value={allocations[account.id] || ''}
                          onChangeText={(val) => handleAllocationChange(account.id, val)}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Transaction Receipt Upload */}
            <View style={styles.uploadSection}>
              <Text style={[styles.inputLabel, { color: textSecondary }]}>Transaction Receipt (Optional)</Text>

              {attachedFiles.length > 0 && (
                <View style={styles.attachmentsList}>
                  {attachedFiles.map((file, idx) => (
                    <View key={idx} style={[styles.attachmentBadge, { borderColor, backgroundColor: inputBg }]}>
                      <Ionicons name="document-text-outline" size={16} color={textSecondary} />
                      <Text style={[styles.attachmentName, { color: textPrimary }]} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <TouchableOpacity onPress={() => removeFile(file.uri)}>
                        <Ionicons name="close-circle" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity style={[styles.uploadButton, { borderColor }]} onPress={handleDocumentPick}>
                <Ionicons name="cloud-upload-outline" size={22} color={primary} />
                <Text style={[styles.uploadText, { color: primary }]}>Select PDF or Image</Text>
              </TouchableOpacity>
            </View>

            {/* Complete Allocation Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                isBalanced && totalTransfer > 0 && !isSubmitting
                  ? { backgroundColor: primary }
                  : styles.submitDisabled,
              ]}
              disabled={!isBalanced || totalTransfer <= 0 || isSubmitting}
              onPress={() => void submitPayment()}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Complete Allocation</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#718096',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionLabelCenter: {
    fontSize: 11,
    fontWeight: '700',
    color: '#718096',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 8,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#A0AEC0',
  },
  radioActive: {
    borderColor: '#10B981',
    backgroundColor: '#10B981',
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  toggleSub: {
    fontSize: 11,
    marginTop: 2,
  },
  searchContainer: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  selectedMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
  },
  selectedMemberName: {
    fontSize: 13,
    fontWeight: '700',
  },
  selectedMemberId: {
    fontSize: 11,
    marginTop: 2,
  },
  searchResultsList: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 180,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  memberAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  resultMemberName: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultMemberSub: {
    fontSize: 10,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '800',
    color: '#10B981',
    marginRight: 4,
  },
  hugeInput: {
    fontSize: 38,
    fontWeight: '800',
    minWidth: 100,
    textAlign: 'center',
  },
  balancedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    gap: 6,
    marginTop: 4,
  },
  balancedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#064E3B',
  },
  amountDivider: {
    height: 1,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  progressSection: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressAmounts: {
    fontSize: 12,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  remainingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D97706',
    marginTop: 6,
    textAlign: 'right',
  },
  allocationList: {
    gap: 12,
    marginBottom: 20,
  },
  accountSplitCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  splitInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  splitIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  splitSub: {
    fontSize: 11,
    marginTop: 2,
  },
  autoFillButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  autoFillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputCurrency: {
    fontSize: 14,
    fontWeight: '700',
    color: '#718096',
    marginRight: 6,
  },
  splitInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  uploadSection: {
    marginBottom: 24,
  },
  attachmentsList: {
    gap: 6,
    marginBottom: 10,
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    gap: 8,
  },
  attachmentName: {
    flex: 1,
    fontSize: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 14,
    gap: 8,
  },
  uploadText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    backgroundColor: '#CBD5E1',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
