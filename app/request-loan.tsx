import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
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

interface Guarantor {
  id: string;
  name: string;
  joinDate: string;
  avatar: string;
  selected: boolean;
}

const DUMMY_GUARANTORS: Guarantor[] = [
  { id: '1', name: 'James Owalo', joinDate: 'MEMBER SINCE JAN 2021', avatar: 'J', selected: false },
  { id: '2', name: 'Okaafiyago Owalo', joinDate: 'MEMBER SINCE JUL 2021', avatar: 'O', selected: false },
  { id: '3', name: 'Joshua Gonzalez', joinDate: 'MEMBER SINCE MAY 2015', avatar: 'J', selected: false },
];

const RequestLoanScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loanType, setLoanType] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('');
  const [duration, setDuration] = useState('12');
  const [startDate, setStartDate] = useState('');
  const [repaymentSource, setRepaymentSource] = useState('Bank Transfer');
  const [guarantors, setGuarantors] = useState<Guarantor[]>(DUMMY_GUARANTORS);
  const [searchGuarantors, setSearchGuarantors] = useState('');
  const [showLoanTypeModal, setShowLoanTypeModal] = useState(false);
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const primary = '#173581';

  const loanTypes = ['Personal Loan', 'Business Loan', 'Education Loan', 'Housing Loan', 'Emergency Loan'];
  const repaymentSources = ['Bank Transfer', 'Mobile Money', 'Cash'];

  const selectedGuarantorsCount = guarantors.filter((g) => g.selected).length;

  const toggleGuarantor = (id: string) => {
    setGuarantors(guarantors.map((g) => (g.id === id ? { ...g, selected: !g.selected } : g)));
  };

  const filteredGuarantors = guarantors.filter((g) =>
    g.name.toLowerCase().includes(searchGuarantors.toLowerCase())
  );

  const handleSubmit = () => {
    if (!loanType || !amount || !purpose || selectedGuarantorsCount === 0) {
      alert('Please fill all required fields and select at least one guarantor');
      return;
    }
    alert('Loan application submitted successfully!');
    router.back();
  };

  const FloatingDropdown = ({ 
    options, 
    onSelect, 
    selectedValue,
    placeholder,
    isOpen,
    setIsOpen
  }: { 
    options: string[], 
    onSelect: (val: string) => void,
    selectedValue: string,
    placeholder: string,
    isOpen: boolean,
    setIsOpen: (val: boolean) => void
  }) => (
    <View style={[styles.dropdownContainer, isOpen && { zIndex: 1000 }]}>
      <TouchableOpacity
        style={[styles.dropdown, { backgroundColor: inputBg, borderColor: isOpen ? primary : inputBorder }]}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text style={[styles.dropdownText, { color: selectedValue ? textPrimary : textSecondary }]}>
          {selectedValue || placeholder}
        </Text>
        <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={20} color={textSecondary} />
      </TouchableOpacity>

      {isOpen && (
        <View style={[styles.floatingMenu, { backgroundColor: cardBg, borderColor: inputBorder }]}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled={true}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.modalOption,
                  selectedValue === option && { backgroundColor: isDark ? '#2D3748' : '#F7FAFC' }
                ]}
                onPress={() => {
                  onSelect(option);
                  setIsOpen(false);
                }}
              >
                <Text style={[styles.modalOptionText, { color: textPrimary }]}>{option}</Text>
                {selectedValue === option && (
                  <Ionicons name="checkmark" size={18} color={primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

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
                onSelect={setLoanType}
                selectedValue={loanType}
                placeholder="Select Loan Type"
                isOpen={showLoanTypeModal}
                setIsOpen={setShowLoanTypeModal}
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
                Max eligible amount: ₦280,000 based on your savings
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
                placeholder="mm/dd/yyyy"
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
              />
            </View>
          </View>

          {/* Section 3: Guarantors */}
          <View style={[styles.section, { backgroundColor: cardBg, marginBottom: 24 }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionNumberBadge, { backgroundColor: primary }]}>3</Text>
              <Text style={[styles.sectionTitle, { color: primary }]}>Guarantors</Text>
            </View>

            <Text style={[styles.helperText, { color: textSecondary, marginBottom: 16 }]}>
              You need at least up to 2 guarantors
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

            {/* Guarantors List */}
            <View style={styles.guarantorsList}>
              {filteredGuarantors.map((guarantor) => (
                <View key={guarantor.id} style={[styles.guarantorItem, { borderBottomColor: inputBorder }]}>
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

                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      guarantor.selected && { backgroundColor: primary, borderColor: primary },
                      { borderColor: inputBorder },
                    ]}
                    onPress={() => toggleGuarantor(guarantor.id)}
                  >
                    {guarantor.selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <Text style={[styles.helperText, { color: textSecondary, marginTop: 16 }]}>
              Selected: {selectedGuarantorsCount} guarantor{selectedGuarantorsCount !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={[styles.submitButton, { backgroundColor: primary }]} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit Application</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
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
  guarantorsList: {
    marginTop: 12,
  },
  guarantorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
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
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
