import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AccountService, type LoanProductDto } from '@/services/accountService';

interface Guarantor {
  id: string;
  name: string;
  joinDate: string;
  avatar: string;
  selected: boolean;
}

interface FloatingDropdownProps {
  options: string[];
  onSelect: (value: string) => void;
  selectedValue: string;
  placeholder: string;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  isDark: boolean;
  cardBg: string;
  inputBg: string;
  inputBorder: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
}

const FloatingDropdown = ({ options, onSelect, selectedValue, placeholder, isOpen, setIsOpen, isDark, cardBg, inputBg, inputBorder, textPrimary, textSecondary, primary }: FloatingDropdownProps) => (
  <View style={[styles.dropdownContainer, isOpen && { zIndex: 1000 }]}>
    <TouchableOpacity
      style={[styles.dropdown, { backgroundColor: inputBg, borderColor: isOpen ? primary : inputBorder }]}
      onPress={() => setIsOpen(!isOpen)}>
      <Text style={[styles.dropdownText, { color: selectedValue ? textPrimary : textSecondary }]}>{selectedValue || placeholder}</Text>
      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={textSecondary} />
    </TouchableOpacity>
    {isOpen && (
      <View style={[styles.floatingMenu, { backgroundColor: cardBg, borderColor: inputBorder }]}>
        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
          {options.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.modalOption, selectedValue === option && { backgroundColor: isDark ? '#2D3748' : '#F7FAFC' }]}
              onPress={() => { onSelect(option); setIsOpen(false); }}>
              <Text style={[styles.modalOptionText, { color: textPrimary }]}>{option}</Text>
              {selectedValue === option && <Ionicons name="checkmark" size={18} color={primary} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    )}
  </View>
);

const RequestLoanScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loanType, setLoanType] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [duration, setDuration] = useState('12');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [repaymentSource, setRepaymentSource] = useState('Bank Transfer');
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [searchGuarantors, setSearchGuarantors] = useState('');
  const [showLoanTypeModal, setShowLoanTypeModal] = useState(false);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [loanProducts, setLoanProducts] = useState<LoanProductDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const primary = '#173581';

  const loanTypes = loanProducts.map((product) => product.loanName);
  const repaymentSources = ['Bank Transfer', 'Mobile Money', 'Cash'];
  const selectedLoanProduct = useMemo(() => loanProducts.find((product) => product.loanId === loanType), [loanProducts, loanType]);

  const selectedGuarantorsCount = guarantors.filter((g) => g.selected).length;

  // Loan calculation logic matching web
  const { monthlyPayment, totalInterest, totalRepayment } = useMemo(() => {
    const principal = Number(amount) || 0;
    const months = Number(duration) || 0;
    const rate = (selectedLoanProduct?.interestRate ?? 0) * 100;

    if (principal <= 0 || months <= 0) {
      return { monthlyPayment: 0, totalInterest: 0, totalRepayment: 0 };
    }

    const totalInterestValue = (principal * rate * months) / (100 * 12);
    const totalRepaymentValue = principal + totalInterestValue;
    const monthlyPaymentValue = totalRepaymentValue / months;

    return {
      monthlyPayment: monthlyPaymentValue,
      totalInterest: totalInterestValue,
      totalRepayment: totalRepaymentValue,
    };
  }, [amount, duration, selectedLoanProduct]);

  useEffect(() => {
    const loadLoanFormData = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [products, availableGuarantors] = await Promise.all([
          AccountService.getLoanProducts(),
          AccountService.getGuarantors(),
        ]);
        setLoanProducts(products);
        setGuarantors(availableGuarantors.map((guarantor) => {
          const name = `${guarantor.firstName ?? ''} ${guarantor.lastName ?? ''}`.trim() || guarantor.membershipId || 'Member';
          return {
            id: guarantor.id,
            name,
            joinDate: guarantor.membershipId ? `MEMBER ID: ${guarantor.membershipId}` : 'COOPERATIVE MEMBER',
            avatar: name.charAt(0).toUpperCase(),
            selected: false,
          };
        }));
      } catch {
        setLoadError('Unable to load loan products and guarantors. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadLoanFormData();
  }, []);

  const selectLoanType = (loanName: string) => {
    const product = loanProducts.find((item) => item.loanName === loanName);
    setLoanType(product?.loanId ?? '');
    setGuarantors((current) => current.map((guarantor) => ({ ...guarantor, selected: false })));
  };

  const toggleGuarantor = (id: string) => {
    const requiredGuarantors = selectedLoanProduct?.guarantorCount ?? 0;
    setGuarantors((current) => {
      const isSelected = current.find((guarantor) => guarantor.id === id)?.selected;
      const selectedCount = current.filter((guarantor) => guarantor.selected).length;
      if (!isSelected && selectedCount >= requiredGuarantors) return current;
      return current.map((guarantor) => guarantor.id === id ? { ...guarantor, selected: !guarantor.selected } : guarantor);
    });
  };

  const filteredGuarantors = guarantors.filter((g) =>
    g.name.toLowerCase().includes(searchGuarantors.toLowerCase())
  );

  const handleSubmit = async () => {
    const requestedAmount = Number(amount);
    const requiredGuarantors = selectedLoanProduct?.guarantorCount ?? 0;
    if (!selectedLoanProduct || !Number.isFinite(requestedAmount) || requestedAmount <= 0 || !purpose.trim()) {
      Alert.alert('Missing information', 'Select a loan product, enter a valid amount, and describe the loan purpose.');
      return;
    }
    if (selectedGuarantorsCount !== requiredGuarantors) {
      Alert.alert('Guarantors required', `Select exactly ${requiredGuarantors} guarantor${requiredGuarantors === 1 ? '' : 's'} for this loan product.`);
      return;
    }
    if (Number.isNaN(Date.parse(startDate))) {
      Alert.alert('Invalid start date', 'Enter the preferred start date as YYYY-MM-DD.');
      return;
    }

    setIsSubmitting(true);
    try {
      const message = await AccountService.requestLoan({
        loanId: selectedLoanProduct.loanId,
        amount: requestedAmount,
        guarantors: guarantors.filter((guarantor) => guarantor.selected).map((guarantor) => guarantor.id),
        preferredStartDate: new Date(startDate).toISOString(),
        comment: purpose.trim(),
        duration: Number(duration),
      });
      Alert.alert('Loan request submitted', message, [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error) {
      Alert.alert('Unable to submit loan request', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Request Loan',
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
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.subtitle, { color: textSecondary, marginBottom: 16 }]}>
            Please Complete The Single Form Below To Submit Your Request.
          </Text>

          {isLoading ? <ActivityIndicator style={styles.loadingIndicator} color={primary} /> : null}
          {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

          {/* Section 1: Loan Details */}
          <View style={[styles.section, { backgroundColor: cardBg, marginBottom: 24, zIndex: 2000 }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionNumberBadge, { backgroundColor: primary }]}>1</Text>
              <Text style={[styles.sectionTitle, { color: primary }]}>Loan Details</Text>
            </View>

            {/* Loan Type */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: textPrimary }]}>
                Loan Product <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <FloatingDropdown 
                options={loanTypes}
                onSelect={selectLoanType}
                selectedValue={selectedLoanProduct?.loanName ?? ''}
                placeholder="Select Loan Type"
                isOpen={showLoanTypeModal}
                setIsOpen={setShowLoanTypeModal}
                isDark={isDark}
                cardBg={cardBg}
                inputBg={inputBg}
                inputBorder={inputBorder}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                primary={primary}
              />
            </View>

            {/* Amount */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: textPrimary }]}>
                Amount Requested (₦) <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                placeholder="Enter amount (e.g., 50000)"
                placeholderTextColor={textSecondary}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
              <Text style={[styles.helperText, { color: textSecondary }]}>
                {selectedLoanProduct ? `Processing fee: ₦${selectedLoanProduct.processingFee.toLocaleString()} · Interest: ${(selectedLoanProduct.interestRate * 100).toFixed(2)}%` : 'Select a loan product to see its terms.'}
              </Text>
            </View>

            {/* Purpose */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: textPrimary }]}>
                Purpose of Loan <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <TextInput
                style={[styles.textAreaInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                placeholder="Please describe briefly what you intend to use this loan for..."
                placeholderTextColor={textSecondary}
                multiline
                numberOfLines={4}
                value={purpose}
                onChangeText={setPurpose}
              />
            </View>
          </View>

          {/* Section 2: Repayment Plan */}
          <View style={[styles.section, { backgroundColor: cardBg, marginBottom: 24, zIndex: 1000 }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionNumberBadge, { backgroundColor: primary }]}>2</Text>
              <Text style={[styles.sectionTitle, { color: primary }]}>Repayment Plan</Text>
            </View>

            {/* Duration */}
            <View style={styles.formGroup}>
              <View style={styles.durationHeader}>
                <Text style={[styles.label, { color: textPrimary }]}>Repayment Duration</Text>
                <Text style={[styles.durationValue, { color: primary }]}>{duration} Months</Text>
              </View>
              <View style={styles.sliderContainer}>
                {[6, 12, 18, 24, 30].map((month) => (
                  <TouchableOpacity
                    key={month}
                    style={[styles.sliderButton, duration === String(month) && { backgroundColor: primary }]}
                    onPress={() => setDuration(String(month))}
                  >
                    <Text
                      style={[
                        styles.sliderButtonText,
                        { color: duration === String(month) ? '#FFFFFF' : textSecondary },
                      ]}
                    >
                      {month}M
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Preferred Start Date */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: textPrimary }]}>Preferred Start Date</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={textSecondary}
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>

            {/* Repayment Source */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: textPrimary }]}>Repayment Source</Text>
              <FloatingDropdown 
                options={repaymentSources}
                onSelect={setRepaymentSource}
                selectedValue={repaymentSource}
                placeholder="Select Repayment Source"
                isOpen={showRepaymentModal}
                setIsOpen={setShowRepaymentModal}
                isDark={isDark}
                cardBg={cardBg}
                inputBg={inputBg}
                inputBorder={inputBorder}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                primary={primary}
              />
            </View>

            {/* Estimated Repayment Summary (Replicating Web Loan Calculator) */}
            <View style={[styles.calcContainer, { backgroundColor: isDark ? '#2D3748' : '#F7FAFC', borderColor: inputBorder }]}>
              <View style={styles.calcHeader}>
                <Ionicons name="calculator-outline" size={16} color={primary} />
                <Text style={[styles.calcTitle, { color: textPrimary }]}>Estimated Repayment Summary</Text>
              </View>
              <View style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: textSecondary }]}>Monthly Payment:</Text>
                <Text style={[styles.calcValueHighlight, { color: primary }]}>
                  {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(monthlyPayment)}
                </Text>
              </View>
              <View style={styles.calcRow}>
                <Text style={[styles.calcLabel, { color: textSecondary }]}>Total Interest:</Text>
                <Text style={[styles.calcValue, { color: textPrimary }]}>
                  {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(totalInterest)}
                </Text>
              </View>
              <View style={[styles.calcRow, styles.calcTotalRow, { borderTopColor: inputBorder }]}>
                <Text style={[styles.calcTotalLabel, { color: textPrimary }]}>Total Repayment:</Text>
                <Text style={[styles.calcTotalValue, { color: textPrimary }]}>
                  {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(totalRepayment)}
                </Text>
              </View>
            </View>
          </View>

          {/* Section 3: Guarantors */}
          <View style={[styles.section, { backgroundColor: cardBg, marginBottom: 24 }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionNumberBadge, { backgroundColor: primary }]}>3</Text>
              <Text style={[styles.sectionTitle, { color: primary }]}>Guarantors</Text>
            </View>

            <Text style={[styles.helperText, { color: textSecondary, marginBottom: 16 }]}>
              {selectedLoanProduct ? `Select exactly ${selectedLoanProduct.guarantorCount} guarantor${selectedLoanProduct.guarantorCount === 1 ? '' : 's'}.` : 'Select a loan product to view its guarantor requirement.'}
            </Text>

            {/* Search Guarantors */}
            <View style={[styles.searchBox, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <Ionicons name="search" size={18} color={textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: textPrimary }]}
                placeholder="Search for members"
                placeholderTextColor={textSecondary}
                value={searchGuarantors}
                onChangeText={setSearchGuarantors}
              />
            </View>

            {/* Guarantors List (Fixed Height and Scrollable) */}
            <View style={[styles.guarantorsContainer, { borderColor: inputBorder, backgroundColor: inputBg }]}>
              <ScrollView
                style={styles.guarantorsScrollView}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
                keyboardShouldPersistTaps="handled"
              >
                {filteredGuarantors.length > 0 ? (
                  filteredGuarantors.map((guarantor) => (
                    <TouchableOpacity
                      key={guarantor.id}
                      activeOpacity={0.7}
                      style={[
                        styles.guarantorItem,
                        { borderBottomColor: inputBorder },
                        guarantor.selected && { backgroundColor: isDark ? '#1E293B' : '#EFF6FF' },
                      ]}
                      onPress={() => toggleGuarantor(guarantor.id)}
                    >
                      <View style={styles.guarantorInfo}>
                        <View style={[styles.avatarCircle, { backgroundColor: primary }]}>
                          <Text style={styles.avatarText}>{guarantor.avatar}</Text>
                        </View>
                        <View style={styles.guarantorDetails}>
                          <Text style={[styles.guarantorName, { color: textPrimary }]}>{guarantor.name}</Text>
                          <Text style={[styles.guarantorDate, { color: textSecondary }]}>
                            {guarantor.joinDate.toLowerCase()}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.checkbox,
                          guarantor.selected && { backgroundColor: primary, borderColor: primary },
                          { borderColor: inputBorder },
                        ]}
                      >
                        {guarantor.selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyGuarantors}>
                    <Text style={[styles.emptyGuarantorsText, { color: textSecondary }]}>
                      No guarantors found matching your search.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>

            <Text style={[styles.helperText, { color: textSecondary, marginTop: 16 }]}>
              Selected: {selectedGuarantorsCount} guarantor{selectedGuarantorsCount !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity disabled={isLoading || isSubmitting} style={[styles.submitButton, { backgroundColor: primary }, (isLoading || isSubmitting) && styles.submitButtonDisabled]} onPress={() => void handleSubmit()}>
            <Text style={styles.submitButtonText}>{isSubmitting ? 'Submitting…' : 'Submit Application'}</Text>
            {!isSubmitting && <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default RequestLoanScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
  },
  loadingIndicator: {
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    marginBottom: 16,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
  },
  dropdownContainer: {
    position: 'relative',
    width: '100%',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '500',
  },
  floatingMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 5000,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalOptionText: {
    fontSize: 14,
  },
  durationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  durationValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  sliderContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  sliderButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    flex: 1,
  },
  sliderButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  guarantorsContainer: {
    height: 240,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 8,
  },
  guarantorsScrollView: {
    flex: 1,
  },
  guarantorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  emptyGuarantors: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGuarantorsText: {
    fontSize: 13,
  },
  guarantorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  guarantorDetails: {
    flex: 1,
  },
  guarantorName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  guarantorDate: {
    fontSize: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  calcContainer: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  calcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  calcTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  calcLabel: {
    fontSize: 12,
  },
  calcValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  calcValueHighlight: {
    fontSize: 13,
    fontWeight: '700',
  },
  calcTotalRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  calcTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  calcTotalValue: {
    fontSize: 15,
    fontWeight: '800',
  },
});
