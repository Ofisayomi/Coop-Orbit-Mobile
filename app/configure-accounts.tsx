import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCurrentUserRoles, PRIVILEGED_MEMBER_ROLES } from '@/services/authService';
import {
  AccountService,
  type AccountDto,
  type AccountTypeDto,
} from '@/services/accountService';

type TabId = 'loan' | 'savings' | 'engagement';

const MEMBER_CATEGORIES = ['Regular', 'Executive', 'Associate'];
/** Mirrors the web Configure Account tabs: loan/savings/engagement account creation. */
const CONFIGURE_ROLES = PRIVILEGED_MEMBER_ROLES;

interface DropDownProps {
  label: string;
  value: string;
  placeholder: string;
  options: { label: string; value: string }[];
  onSelect: (value: string) => void;
  textPrimary: string;
  textSecondary: string;
  inputBg: string;
  inputBorder: string;
  cardBg: string;
  isDark: boolean;
  primary: string;
}

const DropDown = ({ label, value, placeholder, options, onSelect, textPrimary, textSecondary, inputBg, inputBorder, cardBg, isDark, primary }: DropDownProps) => {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={[styles.field, open && { zIndex: 1000 }]}>
      <Text style={[styles.label, { color: textPrimary }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.dropdown, { backgroundColor: inputBg, borderColor: open ? primary : inputBorder }]}
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text style={[styles.dropdownText, { color: selected ? textPrimary : textSecondary }]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={[styles.dropdownMenu, { backgroundColor: cardBg, borderColor: inputBorder }]}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.dropdownOption, option.value === value && { backgroundColor: isDark ? '#2D3748' : '#EFF6FF' }]}
                onPress={() => { onSelect(option.value); setOpen(false); }}
              >
                <Text style={[styles.dropdownOptionText, { color: textPrimary }]}>{option.label}</Text>
                {option.value === value && <Ionicons name="checkmark" size={16} color={primary} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

interface ChipsProps {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  textPrimary: string;
  textSecondary: string;
  inputBorder: string;
  primary: string;
}

const Chips = ({ label, options, selected, onToggle, textPrimary, textSecondary, inputBorder, primary }: ChipsProps) => (
  <View style={styles.field}>
    <Text style={[styles.label, { color: textPrimary }]}>{label}</Text>
    <View style={styles.chipsRow}>
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <TouchableOpacity
            key={option}
            style={[
              styles.chip,
              { borderColor: active ? primary : inputBorder, backgroundColor: active ? primary : 'transparent' },
            ]}
            onPress={() => onToggle(option)}
          >
            <Text style={[styles.chipText, { color: active ? '#FFFFFF' : textSecondary }]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

interface ToggleRowProps {
  title: string;
  description: string;
  value: boolean;
  onToggle: () => void;
  textPrimary: string;
  textSecondary: string;
  primary: string;
}

const ToggleRow = ({ title, description, value, onToggle, textPrimary, textSecondary, primary }: ToggleRowProps) => (
  <View style={styles.toggleRow}>
    <View style={{ flex: 1, paddingRight: 12 }}>
      <Text style={[styles.toggleTitle, { color: textPrimary }]}>{title}</Text>
      <Text style={[styles.toggleDescription, { color: textSecondary }]}>{description}</Text>
    </View>
    <Switch
      trackColor={{ false: '#CBD5E0', true: '#90CDF4' }}
      thumbColor={value ? primary : '#F7FAFC'}
      ios_backgroundColor="#CBD5E0"
      value={value}
      onValueChange={onToggle}
    />
  </View>
);

const ConfigureAccountsScreen = () => {
  const router = useRouter();
  const { showToast } = useToast();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const primary = '#173581';

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('loan');
  const [isLoadingMeta, setIsLoadingMeta] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountTypes, setAccountTypes] = useState<AccountTypeDto[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<AccountDto[]>([]);

  // Loan form state (mirrors the web Configure Loan tab)
  const [loanName, setLoanName] = useState('');
  const [loanDescription, setLoanDescription] = useState('');
  const [loanTypeId, setLoanTypeId] = useState('');
  const [interestStructure, setInterestStructure] = useState<'Fixed' | 'Reducing'>('Fixed');
  const [interestRate, setInterestRate] = useState('5');
  const [interestFrequency, setInterestFrequency] = useState('1');
  const [maxGuarantors, setMaxGuarantors] = useState('2');
  const [processingFee, setProcessingFee] = useState('2000');
  const [maxDuration, setMaxDuration] = useState('12');
  const [interestStrategy, setInterestStrategy] = useState<'distributed' | 'upfront' | 'deducted'>('distributed');
  const [requiredPercentage, setRequiredPercentage] = useState('');
  const [linkedPercentageAccount, setLinkedPercentageAccount] = useState('');
  const [requiredAmount, setRequiredAmount] = useState('');
  const [linkedAmountAccount, setLinkedAmountAccount] = useState('');
  const [singleLoanConstraint, setSingleLoanConstraint] = useState(false);
  const [beneficiaries, setBeneficiaries] = useState<string[]>([]);
  const [guarantorRoles, setGuarantorRoles] = useState<string[]>([]);
  const [guarantorConstraint, setGuarantorConstraint] = useState(true);
  const [repaymentThreshold, setRepaymentThreshold] = useState('50');

  // Savings / engagement form state (mirrors the web Savings + Engagement tabs)
  const [savingsName, setSavingsName] = useState('');
  const [savingsDescription, setSavingsDescription] = useState('');
  const [savingsTypeId, setSavingsTypeId] = useState('');
  const [savingsRate, setSavingsRate] = useState('');
  const [savingsBeneficiaries, setSavingsBeneficiaries] = useState<string[]>([]);

  useEffect(() => {
    void getCurrentUserRoles()
      .then((roles) => {
        const allowed = roles.some((role) => CONFIGURE_ROLES.includes(role));
        setAuthorized(allowed);
        if (!allowed) {
          showToast('Only admins, accountants, and secretaries can configure accounts.', 'error');
        }
      })
      .catch(() => setAuthorized(false));
  }, [showToast]);

  useEffect(() => {
    if (authorized !== true) return;
    const loadMeta = async () => {
      setIsLoadingMeta(true);
      try {
        const [types, accounts] = await Promise.all([
          AccountService.getAccountTypes(),
          AccountService.getAccounts(),
        ]);
        setAccountTypes(types);
        setSavingsAccounts(accounts.filter((a) => a.accountType?.toLowerCase().includes('sav')));
      } catch {
        showToast('Unable to load account types. Pull down or reopen to retry.', 'error');
      } finally {
        setIsLoadingMeta(false);
      }
    };
    void loadMeta();
  }, [authorized, showToast]);

  // Reducing-balance loans can only distribute interest (same rule as web).
  useEffect(() => {
    if (interestStructure === 'Reducing' && interestStrategy !== 'distributed') {
      setInterestStrategy('distributed');
    }
  }, [interestStructure, interestStrategy]);

  const loanTypeOptions = useMemo(
    () => accountTypes.filter((t) => t.accountCategory?.toLowerCase() === 'loan').map((t) => ({ label: t.name, value: t.id })),
    [accountTypes]
  );
  const savingsTypeOptions = useMemo(
    () => accountTypes.filter((t) => t.accountCategory?.toLowerCase() === 'savings').map((t) => ({ label: t.name, value: t.id })),
    [accountTypes]
  );
  const savingsAccountOptions = useMemo(
    () => savingsAccounts.map((a) => ({ label: a.accountName, value: a.id })),
    [savingsAccounts]
  );

  const toggleListValue = useCallback((setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    return (value: string) => {
      setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    };
  }, []);
  const toggleBeneficiary = useMemo(() => toggleListValue(setBeneficiaries), [toggleListValue]);
  const toggleGuarantorRole = useMemo(() => toggleListValue(setGuarantorRoles), [toggleListValue]);
  const toggleSavingsBeneficiary = useMemo(() => toggleListValue(setSavingsBeneficiaries), [toggleListValue]);

  const handleCreateLoan = async () => {
    const rate = Number(interestRate);
    const guarantors = Number(maxGuarantors);
    const fee = Number(processingFee);
    const duration = Number(maxDuration);
    const threshold = Number(repaymentThreshold);
    const reqPct = requiredPercentage.trim() === '' ? 0 : Number(requiredPercentage);
    const reqAmt = requiredAmount.trim() === '' ? 0 : Number(requiredAmount);

    if (!loanName.trim() || !loanDescription.trim() || !loanTypeId) {
      showToast('Enter a plan name, description, and loan type.', 'warning');
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      showToast('Enter a valid interest rate.', 'warning');
      return;
    }
    if (!Number.isFinite(guarantors) || guarantors < 0) {
      showToast('Enter a valid number of guarantors.', 'warning');
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) {
      showToast('Enter a valid processing fee.', 'warning');
      return;
    }
    if (beneficiaries.length === 0) {
      showToast('Select at least one beneficiary category.', 'warning');
      return;
    }
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

    setIsSubmitting(true);
    try {
      const message = await AccountService.createLoanAccount({
        name: loanName.trim(),
        description: loanDescription.trim(),
        loanTypeId,
        interestRate: Math.round(rate),
        interestFrequency: Number(interestFrequency),
        maxGuarantors: Math.trunc(guarantors),
        processingFee: fee,
        maxRepaymentDuration: Number.isFinite(duration) && duration > 0 ? Math.trunc(duration) : 12,
        interestType: interestStructure === 'Fixed' ? 1 : 2,
        interestStrategy: interestStrategy === 'upfront' ? 1 : interestStrategy === 'distributed' ? 2 : 3,
        requiredAmount: reqAmt,
        ...(linkedAmountAccount ? { linkedAmountAccount } : {}),
        ...(linkedPercentageAccount ? { linkedPercentageAccount } : {}),
        requiredPercentage: reqPct,
        singleLoanConstraint,
        beneficiaries,
        guarantorConstraint,
        repaymentThreshold: Math.trunc(threshold),
        selectedGuarantorRoles: guarantorRoles,
      });
      showToast(message || 'Loan account created successfully.', 'success');
      router.back();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to create loan account.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSavings = async (kind: 'savings' | 'engagement') => {
    const rate = Number(savingsRate);
    if (!savingsName.trim() || !savingsDescription.trim() || !savingsTypeId) {
      showToast('Enter an account name, description, and account type.', 'warning');
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      showToast('Enter a valid interest rate.', 'warning');
      return;
    }
    if (savingsBeneficiaries.length === 0) {
      showToast('Select at least one beneficiary category.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const message = await AccountService.createSavingsAccount({
        name: savingsName.trim(),
        description: savingsDescription.trim(),
        beneficiaries: savingsBeneficiaries,
        accountTypeId: savingsTypeId,
        interestRate: rate,
      });
      showToast(message || `${kind === 'savings' ? 'Savings' : 'Engagement'} account created successfully.`, 'success');
      router.back();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to create account.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authorized === null) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={primary} />
      </SafeAreaView>
    );
  }

  if (!authorized) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="lock-closed-outline" size={48} color={textSecondary} />
        <Text style={[styles.deniedText, { color: textPrimary }]}>Not authorized</Text>
        <Text style={[styles.deniedSubtext, { color: textSecondary }]}>Account configuration is limited to admins, accountants, and secretaries.</Text>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: primary }]} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const dropdownProps = { textPrimary, textSecondary, inputBg, inputBorder, cardBg, isDark, primary };
  const chipsProps = { textPrimary, textSecondary, inputBorder, primary };

  const renderLoanTab = () => (
    <View style={{ gap: 4 }}>
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.cardTitle, { color: textPrimary }]}>Plan basics</Text>
        <View style={styles.field}>
          <Text style={[styles.label, { color: textPrimary }]}>Plan name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
            placeholder="Regular Standard Loan"
            placeholderTextColor={textSecondary}
            value={loanName}
            onChangeText={setLoanName}
          />
        </View>
        <DropDown label="Loan type *" value={loanTypeId} placeholder="Select loan type"
          options={loanTypeOptions} onSelect={setLoanTypeId} {...dropdownProps} />
        <View style={styles.field}>
          <Text style={[styles.label, { color: textPrimary }]}>Description *</Text>
          <TextInput
            style={[styles.input, styles.multiline, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
            placeholder="Briefly describe who this loan is for..."
            placeholderTextColor={textSecondary}
            multiline
            numberOfLines={3}
            value={loanDescription}
            onChangeText={setLoanDescription}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.cardTitle, { color: textPrimary }]}>Interest & fees</Text>
        <Text style={[styles.label, { color: textPrimary }]}>Interest structure</Text>
        <View style={styles.segmentRow}>
          {(['Fixed', 'Reducing'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.segment, { borderColor: inputBorder }, interestStructure === option && { backgroundColor: primary, borderColor: primary }]}
              onPress={() => setInterestStructure(option)}
            >
              <Text style={[styles.segmentText, { color: interestStructure === option ? '#FFFFFF' : textSecondary }]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.twoCol}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.label, { color: textPrimary }]}>Interest rate (%) *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
              placeholder="5" keyboardType="numeric" value={interestRate} onChangeText={setInterestRate}
            />
          </View>
          <View style={[{ flex: 1 }]}>
            <DropDown label="Frequency" value={interestFrequency} placeholder="Select"
              options={[
                { label: 'Monthly', value: '1' },
                { label: '6 Monthly', value: '6' },
                { label: 'Annually (12 months)', value: '12' },
              ]}
              onSelect={setInterestFrequency} {...dropdownProps} />
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.label, { color: textPrimary }]}>Max guarantors *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
              placeholder="2" keyboardType="numeric" value={maxGuarantors} onChangeText={setMaxGuarantors}
            />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.label, { color: textPrimary }]}>Processing fee (₦) *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
              placeholder="2000" keyboardType="numeric" value={processingFee} onChangeText={setProcessingFee}
            />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: textPrimary }]}>Max repayment duration (months)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
            placeholder="12" keyboardType="numeric" value={maxDuration} onChangeText={setMaxDuration}
          />
        </View>
        <Text style={[styles.label, { color: textPrimary }]}>Interest payment strategy</Text>
        <View style={styles.strategyRow}>
          {([
            { value: 'distributed', title: 'Distributed', hint: 'Paid with repayments' },
            { value: 'upfront', title: 'Upfront', hint: 'Paid before disbursement' },
            { value: 'deducted', title: 'Deducted', hint: 'Deducted from principal' },
          ] as const).map((option) => {
            const disabled = interestStructure === 'Reducing' && option.value !== 'distributed';
            const active = interestStrategy === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                disabled={disabled}
                style={[styles.strategy, { borderColor: inputBorder }, active && { borderColor: primary, backgroundColor: isDark ? '#1E293B' : '#EFF6FF' }, disabled && styles.disabled]}
                onPress={() => setInterestStrategy(option.value)}
              >
                <Text style={[styles.strategyTitle, { color: textPrimary }]}>{option.title}</Text>
                <Text style={[styles.strategyHint, { color: textSecondary }]}>{option.hint}</Text>
                {active && <Ionicons name="checkmark-circle" size={16} color={primary} style={styles.strategyCheck} />}
              </TouchableOpacity>
            );
          })}
        </View>
        {interestStructure === 'Reducing' && (
          <Text style={[styles.note, { color: textSecondary }]}>
            Reducing-balance loans only support the distributed strategy, since the total interest cannot be known upfront.
          </Text>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.cardTitle, { color: textPrimary }]}>Eligibility rules</Text>
        <Text style={[styles.note, { color: textSecondary, marginBottom: 12 }]}>
          Link savings accounts as dependencies: members must hold the required percentage or amount there to qualify.
        </Text>
        <View style={styles.twoCol}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.label, { color: textPrimary }]}>Requirement %</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
              placeholder="50" keyboardType="numeric" value={requiredPercentage} onChangeText={setRequiredPercentage}
            />
          </View>
          <View style={[{ flex: 1 }]}>
            <DropDown label="Source account (%)" value={linkedPercentageAccount} placeholder="Select account"
              options={savingsAccountOptions} onSelect={setLinkedPercentageAccount} {...dropdownProps} />
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.label, { color: textPrimary }]}>Requirement amount (₦)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
              placeholder="50000" keyboardType="numeric" value={requiredAmount} onChangeText={setRequiredAmount}
            />
          </View>
          <View style={[{ flex: 1 }]}>
            <DropDown label="Source account (₦)" value={linkedAmountAccount} placeholder="Select account"
              options={savingsAccountOptions} onSelect={setLinkedAmountAccount} {...dropdownProps} />
          </View>
        </View>
        <Chips label="Loan beneficiaries *" options={MEMBER_CATEGORIES} selected={beneficiaries} onToggle={toggleBeneficiary} {...chipsProps} />
        <ToggleRow
          title="Single loan constraint"
          description="Block new applications while the member has an active loan."
          value={singleLoanConstraint}
          onToggle={() => setSingleLoanConstraint((prev) => !prev)}
          textPrimary={textPrimary} textSecondary={textSecondary} primary={primary}
        />
      </View>

      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.cardTitle, { color: textPrimary }]}>Guarantor rules</Text>
        <Chips label="Qualified guarantors *" options={MEMBER_CATEGORIES} selected={guarantorRoles} onToggle={toggleGuarantorRole} {...chipsProps} />
        <ToggleRow
          title="Active loan repayment rule"
          description="Require guarantors with active loans to have repaid a minimum percentage."
          value={guarantorConstraint}
          onToggle={() => setGuarantorConstraint((prev) => !prev)}
          textPrimary={textPrimary} textSecondary={textSecondary} primary={primary}
        />
        {guarantorConstraint && (
          <View style={styles.field}>
            <Text style={[styles.label, { color: textPrimary }]}>Min. repayment threshold (%)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
              placeholder="50" keyboardType="numeric" value={repaymentThreshold} onChangeText={setRepaymentThreshold}
            />
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: primary }, isSubmitting && styles.submitButtonDisabled]}
        disabled={isSubmitting || isLoadingMeta}
        onPress={() => void handleCreateLoan()}
      >
        {isSubmitting
          ? <ActivityIndicator color="#FFFFFF" />
          : <Text style={styles.submitButtonText}>Publish Loan Plan</Text>}
      </TouchableOpacity>
    </View>
  );

  const renderSavingsTab = (kind: 'savings' | 'engagement') => (
    <View style={{ gap: 4 }}>
      <View style={[styles.card, { backgroundColor: cardBg }]}>
        <Text style={[styles.cardTitle, { color: textPrimary }]}>
          {kind === 'savings' ? 'Savings account settings' : 'Engagement account settings'}
        </Text>
        <Text style={[styles.note, { color: textSecondary, marginBottom: 12 }]}>
          {kind === 'savings'
            ? 'Member deposits are broken down into internal accounts by type.'
            : 'Engagement accounts track member participation dues and levies.'}
        </Text>
        <View style={styles.field}>
          <Text style={[styles.label, { color: textPrimary }]}>Account name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
            placeholder={kind === 'savings' ? 'Regular Savings Account' : 'Welfare Engagement Account'}
            placeholderTextColor={textSecondary}
            value={savingsName}
            onChangeText={setSavingsName}
          />
        </View>
        <DropDown label="Account type *" value={savingsTypeId} placeholder="Select account type"
          options={savingsTypeOptions} onSelect={setSavingsTypeId} {...dropdownProps} />
        <View style={styles.field}>
          <Text style={[styles.label, { color: textPrimary }]}>Description *</Text>
          <TextInput
            style={[styles.input, styles.multiline, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
            placeholder="Briefly describe what this account is for..."
            placeholderTextColor={textSecondary}
            multiline
            numberOfLines={3}
            value={savingsDescription}
            onChangeText={setSavingsDescription}
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: textPrimary }]}>Interest rate (%) *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
            placeholder="5" keyboardType="numeric" value={savingsRate} onChangeText={setSavingsRate}
          />
        </View>
        <Chips label="Account beneficiaries *" options={MEMBER_CATEGORIES} selected={savingsBeneficiaries} onToggle={toggleSavingsBeneficiary} {...chipsProps} />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, { backgroundColor: primary }, isSubmitting && styles.submitButtonDisabled]}
        disabled={isSubmitting || isLoadingMeta}
        onPress={() => void handleCreateSavings(kind)}
      >
        {isSubmitting
          ? <ActivityIndicator color="#FFFFFF" />
          : <Text style={styles.submitButtonText}>{kind === 'savings' ? 'Create Savings Account' : 'Create Engagement Account'}</Text>}
      </TouchableOpacity>
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
          <Text style={[styles.title, { color: textPrimary }]}>Configure Accounts</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Loan, savings, and engagement products</Text>
        </View>
      </View>

      <View style={[styles.tabs, { backgroundColor: cardBg, borderColor: inputBorder }]}>
        {([
          { id: 'loan', label: 'Loan' },
          { id: 'savings', label: 'Savings' },
          { id: 'engagement', label: 'Engagement' },
        ] as { id: TabId; label: string }[]).map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && { backgroundColor: primary }]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab.id ? '#FFFFFF' : textSecondary }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {isLoadingMeta ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={primary} />
          ) : activeTab === 'loan' ? (
            renderLoanTab()
          ) : (
            renderSavingsTab(activeTab)
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ConfigureAccountsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  deniedText: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  deniedSubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
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
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dropdownText: {
    fontSize: 14,
    flex: 1,
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  dropdownOptionText: {
    fontSize: 14,
    flex: 1,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '700',
  },
  strategyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  strategy: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 10,
    position: 'relative',
  },
  strategyTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  strategyHint: {
    fontSize: 10,
    marginTop: 2,
  },
  strategyCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  disabled: {
    opacity: 0.4,
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
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
  submitButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

