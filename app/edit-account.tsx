import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/context/ToastContext';
import { useAppPalette } from '@/hooks/use-app-palette';
import {
  AccountService,
  type AccountDetailDto,
  type AccountDto,
} from '@/services/accountService';

const MEMBER_CATEGORIES = ['Regular', 'Executive', 'Associate'];

export default function EditAccountScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { colors, common } = useAppPalette();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const accountId = id || '';

  const bg = colors.bg;
  const textPrimary = colors.text;
  const textSecondary = colors.muted;
  const cardBg = colors.card;
  const inputBg = colors.input;
  const inputBorder = colors.border;
  const primary = colors.primary;

  const [detail, setDetail] = useState<AccountDetailDto | null>(null);
  const [savingsAccounts, setSavingsAccounts] = useState<AccountDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [interestFrequency, setInterestFrequency] = useState('1');
  const [interestStrategy, setInterestStrategy] = useState<'distributed' | 'upfront' | 'deducted'>('distributed');
  const [maxGuarantors, setMaxGuarantors] = useState('');
  const [processingFee, setProcessingFee] = useState('');
  const [requiredPercentage, setRequiredPercentage] = useState('');
  const [linkedPercentageAccount, setLinkedPercentageAccount] = useState('');
  const [requiredAmount, setRequiredAmount] = useState('');
  const [linkedAmountAccount, setLinkedAmountAccount] = useState('');
  const [singleLoan, setSingleLoan] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<string[]>([]);
  const [guarantorRoles, setGuarantorRoles] = useState<string[]>([]);
  const [guarantorConstraint, setGuarantorConstraint] = useState(false);
  const [repaymentThreshold, setRepaymentThreshold] = useState('');

  useEffect(() => {
    if (!accountId) {
      showToast('Missing account id.', 'error');
      router.back();
      return;
    }
    const load = async () => {
      setIsLoading(true);
      try {
        const [loaded, accounts] = await Promise.all([
          AccountService.getAccountDetail(accountId),
          AccountService.getAccounts(undefined, true),
        ]);
        setDetail(loaded);
        setSavingsAccounts(accounts.filter((a) => a.accountType?.toLowerCase().includes('sav')));
        setName(loaded.accountName);
        setDescription(loaded.accountDescription);
        setInterestRate(String(loaded.interestRate));
        setInterestFrequency(String(loaded.interestFrequency || 1));
        setInterestStrategy(
          loaded.interestStrategy === 1 ? 'upfront' : loaded.interestStrategy === 3 ? 'deducted' : 'distributed'
        );
        setMaxGuarantors(String(loaded.guarantorCount));
        setProcessingFee(String(loaded.processingFee));
        setRequiredPercentage(loaded.requiredPercentage > 0 ? String(loaded.requiredPercentage) : '');
        setLinkedPercentageAccount(loaded.linkedPercentageAccount ?? '');
        setRequiredAmount(loaded.requiredAmount > 0 ? String(loaded.requiredAmount) : '');
        setLinkedAmountAccount(loaded.linkedAmountAccount ?? '');
        setSingleLoan(loaded.singleLoanConstraint);
        setBeneficiaries(loaded.beneficiaries ?? []);
        setGuarantorRoles(loaded.selectedGuarantorRoles ?? []);
        setGuarantorConstraint(loaded.guarantorConstraint);
        setRepaymentThreshold(String(loaded.repaymentThreshold));
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Unable to load account.', 'error');
        router.back();
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [accountId, router, showToast]);

  const isLoan = (detail?.accountCategory ?? '').toLowerCase().includes('loan');
  const interestTypeLabel = detail?.interestType === 2 ? 'Reducing Balance' : 'Fixed';
  const reducing = detail?.interestType === 2;

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) =>
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  const handleSubmit = async () => {
    if (!detail) return;
    const rate = Number(interestRate);
    if (!name.trim() || !description.trim()) {
      showToast('Enter an account name and description.', 'warning');
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      showToast('Enter a valid interest rate.', 'warning');
      return;
    }
    if (beneficiaries.length === 0) {
      showToast('Select at least one beneficiary category.', 'warning');
      return;
    }
    const reqPct = requiredPercentage.trim() === '' ? 0 : Number(requiredPercentage);
    const reqAmt = requiredAmount.trim() === '' ? 0 : Number(requiredAmount);
    const threshold = Number(repaymentThreshold);
    if (isLoan) {
      if (guarantorRoles.length === 0) {
        showToast('Select at least one qualified guarantor category.', 'warning');
        return;
      }
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
        showToast('Repayment threshold must be between 0 and 100.', 'warning');
        return;
      }
      if (reqPct > 0 && !linkedPercentageAccount) {
        showToast('Select the source account for the percentage requirement.', 'warning');
        return;
      }
      if (reqAmt > 0 && !linkedAmountAccount) {
        showToast('Select the source account for the amount requirement.', 'warning');
        return;
      }
      if (reducing && interestStrategy !== 'distributed') {
        showToast('Reducing-balance loans only support the distributed strategy.', 'warning');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const message = await AccountService.updateAccount(detail.id, {
        name: name.trim(),
        description: description.trim(),
        interestRate: rate,
        interestFrequency: Number(interestFrequency) || 1,
        interestStrategy: interestStrategy === 'upfront' ? 1 : interestStrategy === 'deducted' ? 3 : 2,
        processingFee: Number(processingFee) || 0,
        guarantorCount: Math.trunc(Number(maxGuarantors)) || 0,
        maxRepaymentDuration: 12,
        requiredAmount: reqAmt,
        ...(linkedAmountAccount ? { linkedAmountAccount } : {}),
        ...(linkedPercentageAccount ? { linkedPercentageAccount } : {}),
        requiredPercentage: reqPct,
        singleLoanConstraint: singleLoan,
        beneficiaries,
        guarantorConstraint,
        repaymentThreshold: Math.trunc(Number.isFinite(threshold) ? threshold : 0),
        selectedGuarantorRoles: guarantorRoles,
      });
      showToast(message || 'Account updated.', 'success');
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update account.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const linkedOptions = savingsAccounts.map((a) => ({ label: a.accountName, value: a.id }));

  const renderLinkedPicker = (
    label: string,
    value: string,
    onSelect: (v: string) => void,
    placeholder: string
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: textPrimary }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsRow}>
        <TouchableOpacity
          style={[styles.option, { borderColor: inputBorder }, !value && { borderColor: primary, backgroundColor: colors.primarySoft }]}
          onPress={() => onSelect('')}
        >
          <Text style={[styles.optionText, { color: !value ? primary : textSecondary }]}>None</Text>
        </TouchableOpacity>
        {linkedOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.option, { borderColor: inputBorder }, value === option.value && { borderColor: primary, backgroundColor: colors.primarySoft }]}
            onPress={() => onSelect(option.value)}
          >
            <Text style={[styles.optionText, { color: value === option.value ? primary : textSecondary }]} numberOfLines={1}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {!value && <Text style={[styles.hint, { color: textSecondary }]}>{placeholder}</Text>}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerBack, { borderColor: inputBorder, backgroundColor: cardBg }]}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textPrimary }]}>Edit Account</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]} numberOfLines={1}>
            {detail?.accountName ?? 'Loading…'}
          </Text>
        </View>
      </View>

      {isLoading || !detail ? (
        <View style={styles.centered}>
          <ActivityIndicator color={primary} />
        </View>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={[styles.card, { backgroundColor: cardBg }]}>
              <Text style={[styles.cardTitle, { color: textPrimary }]}>Basics</Text>
              <View style={styles.field}>
                <Text style={[styles.label, { color: textPrimary }]}>Account name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                  value={name} onChangeText={setName} placeholder="Account name" placeholderTextColor={textSecondary}
                />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, { color: textPrimary }]}>Description *</Text>
                <TextInput
                  style={[styles.input, styles.multiline, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                  value={description} onChangeText={setDescription} multiline numberOfLines={3}
                  placeholder="Description" placeholderTextColor={textSecondary}
                />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, { color: textPrimary }]}>Interest rate (%) *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                  value={interestRate} onChangeText={setInterestRate} keyboardType="numeric" placeholder="5"
                  placeholderTextColor={textSecondary}
                />
              </View>
              <Text style={[styles.readOnly, { color: textSecondary }]}>
                Type: {detail.accountCategory} · {isLoan ? interestTypeLabel : 'savings'} (fixed at creation)
              </Text>
            </View>

            {isLoan && (
              <View style={[styles.card, { backgroundColor: cardBg }]}>
                <Text style={[styles.cardTitle, { color: textPrimary }]}>Interest & fees</Text>
                <View style={styles.twoCol}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={[styles.label, { color: textPrimary }]}>Frequency</Text>
                    <View style={styles.segmentRow}>
                      {[
                        { label: 'Mth', value: '1' },
                        { label: '6M', value: '6' },
                        { label: 'Yr', value: '12' },
                      ].map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[styles.segment, { borderColor: inputBorder }, interestFrequency === option.value && { backgroundColor: primary, borderColor: primary }]}
                          onPress={() => setInterestFrequency(option.value)}
                        >
                          <Text style={[styles.segmentText, { color: interestFrequency === option.value ? colors.onPrimary : textSecondary }]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={[styles.label, { color: textPrimary }]}>Max guarantors</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                      value={maxGuarantors} onChangeText={setMaxGuarantors} keyboardType="numeric"
                      placeholderTextColor={textSecondary}
                    />
                  </View>
                </View>
                <View style={styles.field}>
                  <Text style={[styles.label, { color: textPrimary }]}>Processing fee (₦)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                    value={processingFee} onChangeText={setProcessingFee} keyboardType="numeric"
                    placeholderTextColor={textSecondary}
                  />
                </View>
                <Text style={[styles.label, { color: textPrimary }]}>Interest payment strategy</Text>
                <View style={styles.strategyRow}>
                  {([
                    { value: 'distributed', title: 'Distributed' },
                    { value: 'upfront', title: 'Upfront' },
                    { value: 'deducted', title: 'Deducted' },
                  ] as const).map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      disabled={reducing && option.value !== 'distributed'}
                      style={[
                        styles.strategy, { borderColor: inputBorder },
                        interestStrategy === option.value && { borderColor: primary, backgroundColor: colors.primarySoft },
                        reducing && option.value !== 'distributed' && styles.disabled,
                      ]}
                      onPress={() => setInterestStrategy(option.value)}
                    >
                      <Text style={[styles.strategyText, { color: textPrimary }]}>{option.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={[styles.card, { backgroundColor: cardBg }]}>
              <Text style={[styles.cardTitle, { color: textPrimary }]}>Eligibility rules</Text>
              {isLoan && (
                <>
                  <View style={styles.twoCol}>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={[styles.label, { color: textPrimary }]}>Requirement %</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                        value={requiredPercentage} onChangeText={setRequiredPercentage} keyboardType="numeric"
                        placeholder="0" placeholderTextColor={textSecondary}
                      />
                    </View>
                    <View style={[styles.field, { flex: 1 }]}>
                      <Text style={[styles.label, { color: textPrimary }]}>Requirement ₦</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                        value={requiredAmount} onChangeText={setRequiredAmount} keyboardType="numeric"
                        placeholder="0" placeholderTextColor={textSecondary}
                      />
                    </View>
                  </View>
                  {renderLinkedPicker('Percentage source account', linkedPercentageAccount, setLinkedPercentageAccount, 'Required when the percentage requirement is set.')}
                  {renderLinkedPicker('Amount source account', linkedAmountAccount, setLinkedAmountAccount, 'Required when the amount requirement is set.')}
                </>
              )}
              <Text style={[styles.label, { color: textPrimary }]}>Beneficiaries *</Text>
              <View style={styles.chipsRow}>
                {MEMBER_CATEGORIES.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, { borderColor: inputBorder }, beneficiaries.includes(option) && { backgroundColor: primary, borderColor: primary }]}
                    onPress={() => toggleIn(setBeneficiaries)(option)}
                  >
                    <Text style={[styles.chipText, { color: beneficiaries.includes(option) ? colors.onPrimary : textSecondary }]}>
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {isLoan && (
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.toggleTitle, { color: textPrimary }]}>Single loan constraint</Text>
                    <Text style={[styles.toggleDescription, { color: textSecondary }]}>Block new applications with an active loan.</Text>
                  </View>
                  <Switch value={singleLoan} onValueChange={() => setSingleLoan((prev) => !prev)}
                    trackColor={{ false: '#CBD5E0', true: '#90CDF4' }}
                    thumbColor={singleLoan ? primary : '#F7FAFC'} ios_backgroundColor="#CBD5E0" />
                </View>
              )}
            </View>

            {isLoan && (
              <View style={[styles.card, { backgroundColor: cardBg }]}>
                <Text style={[styles.cardTitle, { color: textPrimary }]}>Guarantor rules</Text>
                <Text style={[styles.label, { color: textPrimary }]}>Qualified guarantors *</Text>
                <View style={styles.chipsRow}>
                  {MEMBER_CATEGORIES.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.chip, { borderColor: inputBorder }, guarantorRoles.includes(option) && { backgroundColor: primary, borderColor: primary }]}
                      onPress={() => toggleIn(setGuarantorRoles)(option)}
                    >
                      <Text style={[styles.chipText, { color: guarantorRoles.includes(option) ? colors.onPrimary : textSecondary }]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.toggleTitle, { color: textPrimary }]}>Active loan repayment rule</Text>
                    <Text style={[styles.toggleDescription, { color: textSecondary }]}>Require guarantors with active loans to have repaid a minimum.</Text>
                  </View>
                  <Switch value={guarantorConstraint} onValueChange={() => setGuarantorConstraint((prev) => !prev)}
                    trackColor={{ false: '#CBD5E0', true: '#90CDF4' }}
                    thumbColor={guarantorConstraint ? primary : '#F7FAFC'} ios_backgroundColor="#CBD5E0" />
                </View>
                {guarantorConstraint && (
                  <View style={styles.field}>
                    <Text style={[styles.label, { color: textPrimary }]}>Min. repayment threshold (%)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                      value={repaymentThreshold} onChangeText={setRepaymentThreshold} keyboardType="numeric"
                      placeholder="50" placeholderTextColor={textSecondary}
                    />
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity
              style={[common.primaryButton, isSubmitting && styles.disabledButton]}
              disabled={isSubmitting}
              onPress={() => void handleSubmit()}
            >
              {isSubmitting
                ? <ActivityIndicator color={colors.onPrimary} />
                : <Text style={common.primaryButtonText}>Save Changes</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 12,
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  readOnly: {
    fontSize: 12,
    marginTop: 4,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segment: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  strategyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  strategy: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  strategyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.4,
  },
  disabledButton: {
    opacity: 0.6,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  optionsRow: {
    flexDirection: 'row',
  },
  option: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    maxWidth: 200,
  },
  optionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hint: {
    fontSize: 11,
    marginTop: 4,
  },
});
