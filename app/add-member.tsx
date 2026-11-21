import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { pickProfilePhoto, type ProfilePhotoFile } from '@/services/profile-photo';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
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

import { useAppPalette } from '@/hooks/use-app-palette';
import { useToast } from '@/context/ToastContext';
import { AccountService } from '@/services/accountService';
import { getCurrentUserRoles } from '@/services/authService';

const GENDERS = ['male', 'female'];
const MEMBERSHIP_TYPES = ['Regular', 'Executive', 'Associate'];
const STATUSES = ['active', 'inactive'];
const ROLES = ['Member', 'Secretary', 'Admin', 'Accountant'];

type ProfilePhoto = ProfilePhotoFile;

// Only these roles may create members (mirrors the backend endpoint).
const ALLOWED_CREATOR_ROLES = ['Admin', 'Secretary'];

interface MemberForm {
  firstName: string;
  lastName: string;
  username: string;
  memberId: string;
  email: string;
  phoneNumber: string;
  address: string;
  gender: string;
  dateOfBirth: string;
  membershipType: string;
  status: string;
  occupation: string;
  nin: string;
  bvn: string;
  accountNumber: string;
  bankName: string;
  role: string;
  password: string;
  nextOfKinName: string;
  nextOfKinPhone: string;
  nextOfKinEmail: string;
  nextOfKinAddress: string;
}

const initialForm = (membershipTypeDefault = 'Regular'): MemberForm => ({
  firstName: '',
  lastName: '',
  username: '',
  memberId: '',
  email: '',
  phoneNumber: '',
  address: '',
  gender: '',
  dateOfBirth: '',
  membershipType: membershipTypeDefault,
  status: 'active',
  occupation: '',
  nin: '',
  bvn: '',
  accountNumber: '',
  bankName: '',
  role: 'Member',
  password: '',
  nextOfKinName: '',
  nextOfKinPhone: '',
  nextOfKinEmail: '',
  nextOfKinAddress: '',
});

const isDigits = (value: string) => /^[0-9]+$/.test(value);
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function validateForm(form: MemberForm): string | null {
  if (!form.firstName.trim()) return 'Member first name is required';
  if (!form.lastName.trim()) return 'Member last name is required';
  if (!form.username.trim()) return 'Member username is required';
  if (!form.email.trim()) return 'Member email address is required';
  if (!isEmail(form.email.trim())) return 'Invalid email address supplied';
  if (!form.phoneNumber.trim()) return 'Member phone number is required';
  if (!isDigits(form.phoneNumber.trim())) return 'Phone number must be only digits';
  if (!form.address.trim()) return 'Member home address is required';
  if (!form.gender) return 'Member gender is required';
  if (!form.dateOfBirth.trim()) return 'Member date of birth is required';
  const dob = new Date(`${form.dateOfBirth.trim()}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return 'Date of birth must be a valid date (YYYY-MM-DD)';
  if (dob.getTime() > Date.now()) return 'Date of birth cannot be in the future';
  if (!form.membershipType) return 'Member membership type is required';
  if (!form.status) return 'Member active status is required';
  if (!form.occupation.trim()) return 'Member occupation is required';
  if (form.nin.trim() && !isDigits(form.nin.trim())) return 'NIN must be only digits';
  if (form.bvn.trim() && !isDigits(form.bvn.trim())) return 'BVN must be only digits';
  if (form.accountNumber.trim() && !isDigits(form.accountNumber.trim())) return 'Account number must be only digits';
  if (!form.role) return 'Member role is required';
  if (!form.password || form.password.length < 8) return 'Password must be at least 8 characters long';
  if (!form.nextOfKinName.trim()) return 'Next of kin name is required';
  if (!form.nextOfKinPhone.trim()) return 'Next of kin phone number is required';
  if (form.nextOfKinEmail.trim() && !isEmail(form.nextOfKinEmail.trim())) return 'Invalid next of kin email';
  return null;
}

const AddMemberScreen = () => {
  const router = useRouter();
  const { colors, common } = useAppPalette();
  const { showToast } = useToast();

  const [form, setForm] = useState<MemberForm>(initialForm());
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<ProfilePhoto | null>(null);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);

  // Keep the focused field visible above the keyboard (Android does not resize
  // the view here, so scroll the field into view manually on focus).
  // Structural types: the native measure/scroll methods exist at runtime.
  interface MeasurableField {
    measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void;
  }
  interface ScrollableView {
    scrollTo(options: { x?: number; y?: number; animated?: boolean }): void;
  }
  const scrollViewRef = useRef<ScrollableView | null>(null);
  const inputRefs = useRef<Record<string, MeasurableField | null>>({});
  const scrollOffsetY = useRef(0);
  const keyboardHeight = useRef(0);
  const lastFocusedField = useRef<string | null>(null);

  const scrollFieldIntoView = useCallback((field: string) => {
    const input = inputRefs.current[field];
    const scrollView = scrollViewRef.current;
    const visibleKeyboardHeight = keyboardHeight.current;
    if (!input || !scrollView || visibleKeyboardHeight <= 0) return;
    input.measureInWindow((x: number, y: number, _w: number, h: number) => {
      void x;
      void _w;
      const visibleBottom = Dimensions.get('window').height - visibleKeyboardHeight;
      const overlap = y + h + 16 - visibleBottom;
      if (overlap > 0) {
        scrollView.scrollTo({ y: scrollOffsetY.current + overlap, animated: true });
      }
    });
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardHeight.current = e.endCoordinates.height;
      if (lastFocusedField.current) {
        const field = lastFocusedField.current;
        setTimeout(() => scrollFieldIntoView(field), 80);
      }
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeight.current = 0;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [scrollFieldIntoView]);

  // Theme colors (centralized in constants/app-theme.ts via useAppPalette)
  const bg = colors.bg;
  const textPrimary = colors.text;
  const textSecondary = colors.muted;
  const cardBg = colors.card;
  const inputBg = colors.input;
  const inputBorder = colors.border;
  const tableBorder = colors.border;
  const primary = colors.primary;

  useEffect(() => {
    void getCurrentUserRoles()
      .then((roles) => setIsAuthorized(roles.some((role) => ALLOWED_CREATOR_ROLES.includes(role))))
      .catch(() => setIsAuthorized(false));
  }, []);

  const setField = (key: keyof MemberForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Mirror web: suggest a default password from the first name until edited.
      if (key === 'firstName') {
        next.password = value ? `${value}@1234` : '';
      }
      return next;
    });
  };

  const handlePickPhoto = async () => {
    try {
      setIsPickingPhoto(true);
      const result = await pickProfilePhoto();
      if (result.error) {
        showToast(result.error, 'warning');
        return;
      }
      if (result.photo) setProfilePhoto(result.photo);
    } catch {
      showToast('Could not read the selected photo.', 'error');
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const handleSubmit = async () => {
    const validationError = validateForm(form);
    if (validationError) {
      showToast(validationError, 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const dob = new Date(`${form.dateOfBirth.trim()}T00:00:00`);
      await AccountService.createMember({
        userName: form.username.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        address: form.address.trim(),
        gender: form.gender,
        dateOfBirth: dob.toISOString(),
        occupation: form.occupation.trim(),
        nationalId: form.nin.trim() || undefined,
        bvn: form.bvn.trim() || undefined,
        accountNumber: form.accountNumber.trim() || undefined,
        bankName: form.bankName.trim() || undefined,
        memberId: form.memberId.trim() || undefined,
        status: form.status,
        membershipType: form.membershipType,
        role: [form.role],
        nextOfKinName: form.nextOfKinName.trim(),
        nextOfKinPhone: form.nextOfKinPhone.trim(),
        nextOfKinEmail: form.nextOfKinEmail.trim() || undefined,
        nextOfKinAddress: form.nextOfKinAddress.trim() || undefined,
        profilePicture: profilePhoto
          ? {
              name: profilePhoto.name,
              contentType: profilePhoto.mimeType,
              fileUrl: profilePhoto.dataUrl,
            }
          : undefined,
      });
      showToast('Member added successfully!', 'success');
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add member. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderInput = (
    label: string,
    field: keyof MemberForm,
    placeholder: string,
    options?: { keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric'; autoCapitalize?: 'none' | 'words' | 'sentences' },
  ) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: textPrimary }]}>{label}</Text>
      <TextInput
        ref={(el) => {
          inputRefs.current[field] = (el ?? null) as unknown as MeasurableField | null;
        }}
        style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
        placeholder={placeholder}
        placeholderTextColor={textSecondary}
        value={form[field]}
        onChangeText={(value) => setField(field, value)}
        keyboardType={options?.keyboardType ?? 'default'}
        autoCapitalize={options?.autoCapitalize ?? 'sentences'}
        editable={!isSubmitting}
        onFocus={() => {
          lastFocusedField.current = field;
          setTimeout(() => scrollFieldIntoView(field), 120);
        }}
        onBlur={() => {
          if (lastFocusedField.current === field) lastFocusedField.current = null;
        }}
      />
    </View>
  );

  const renderOptions = (label: string, field: keyof MemberForm, options: string[]) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: textPrimary }]}>{label}</Text>
      <View style={styles.optionsRow}>
        {options.map((option) => {
          const selected = form[field] === option;
          const display = option.charAt(0).toUpperCase() + option.slice(1);
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionChip,
                { borderColor: selected ? primary : inputBorder, backgroundColor: selected ? primary : 'transparent' },
              ]}
              onPress={() => setField(field, option)}
              disabled={isSubmitting}
            >
              <Text style={[styles.optionText, { color: selected ? '#FFFFFF' : textSecondary }]}>{display}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { borderColor: inputBorder, backgroundColor: cardBg }]}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={20} color={textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: textPrimary }]}>Add New Member</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>
            Fill in the details below to add a new member
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef as unknown as React.Ref<React.ElementRef<typeof ScrollView>>}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={(e) => {
            scrollOffsetY.current = e.nativeEvent.contentOffset.y;
          }}
        >
          {isAuthorized === false ? (
            <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
              <View style={styles.centerState}>
                <Ionicons name="lock-closed-outline" size={44} color="#EF4444" />
                <Text style={[styles.centerStateTitle, { color: textPrimary }]}>Not authorized</Text>
                <Text style={[styles.centerStateText, { color: textSecondary }]}>
                  Only Admin and Secretary roles can add new members.
                </Text>
                <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
                  <Text style={[styles.backLinkText, { color: primary }]}>Back to members</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: tableBorder }]}>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>Profile Photo (optional, max 200KB)</Text>
                <View style={styles.photoRow}>
                  {profilePhoto ? (
                    <Image source={{ uri: profilePhoto.uri }} style={styles.photoPreview} contentFit="cover" />
                  ) : (
                    <View style={[styles.photoPlaceholder, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                      <Ionicons name="person-outline" size={36} color={textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 8 }}>
                    <TouchableOpacity
                      style={common.uploadButton}
                      onPress={() => void handlePickPhoto()}
                      disabled={isPickingPhoto || isSubmitting}
                    >
                      {isPickingPhoto ? (
                        <ActivityIndicator size="small" color={primary} />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={18} color={primary} />
                          <Text style={common.uploadButtonText}>
                            {profilePhoto ? 'Change Photo' : 'Upload Photo'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                    {profilePhoto ? (
                      <TouchableOpacity
                        style={styles.photoRemove}
                        onPress={() => setProfilePhoto(null)}
                        disabled={isSubmitting}
                      >
                        <Text style={styles.photoRemoveText}>Remove</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>

              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: tableBorder }]}>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>Personal Details</Text>
                {renderInput('First Name *', 'firstName', 'Enter first name')}
                {renderInput('Last Name *', 'lastName', 'Enter last name')}
                {renderInput('Username *', 'username', 'Enter username', { autoCapitalize: 'none' })}
                {renderInput('Member ID', 'memberId', 'Enter member ID (optional)', { autoCapitalize: 'none' })}
                {renderInput('Email *', 'email', 'Enter email', { keyboardType: 'email-address', autoCapitalize: 'none' })}
                {renderInput('Phone Number *', 'phoneNumber', 'Enter phone number', { keyboardType: 'phone-pad' })}
                {renderInput('Address *', 'address', 'Enter home address')}
                {renderOptions('Gender *', 'gender', GENDERS)}
                {renderInput('Date of Birth * (YYYY-MM-DD)', 'dateOfBirth', 'e.g. 1990-05-14', { autoCapitalize: 'none' })}
                {renderInput('Occupation *', 'occupation', 'Enter occupation')}
              </View>

              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: tableBorder }]}>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>Membership & Access</Text>
                {renderOptions('Membership Type *', 'membershipType', MEMBERSHIP_TYPES)}
                {renderOptions('Status *', 'status', STATUSES)}
                {renderOptions('Role *', 'role', ROLES)}
                {renderInput('Password * (min 8 characters)', 'password', 'Auto-suggested, editable', { autoCapitalize: 'none' })}
              </View>

              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: tableBorder }]}>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>Bank & Identity (optional)</Text>
                {renderInput('National Identification Number (NIN)', 'nin', 'Digits only', { keyboardType: 'numeric' })}
                {renderInput('Bank Verification Number (BVN)', 'bvn', 'Digits only', { keyboardType: 'numeric' })}
                {renderInput('Account Number', 'accountNumber', 'Digits only', { keyboardType: 'numeric' })}
                {renderInput('Bank Name', 'bankName', 'Enter bank name')}
              </View>

              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: tableBorder }]}>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>Next of Kin</Text>
                {renderInput('Next of Kin Name *', 'nextOfKinName', 'Enter next of kin name')}
                {renderInput('Next of Kin Phone *', 'nextOfKinPhone', 'Enter next of kin phone', { keyboardType: 'phone-pad' })}
                {renderInput('Next of Kin Email', 'nextOfKinEmail', 'Enter next of kin email', { keyboardType: 'email-address', autoCapitalize: 'none' })}
                {renderInput('Next of Kin Address', 'nextOfKinAddress', 'Enter next of kin address')}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: primary }, isSubmitting && styles.submitButtonDisabled]}
                onPress={() => void handleSubmit()}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.submitButtonText}>Add Member</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 12,
  },
  backButton: {
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
    paddingTop: 8,
    paddingBottom: 32,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
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
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionText: {
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
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  photoPreview: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  photoPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemove: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  photoRemoveText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  centerStateTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  centerStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
  backLink: {
    marginTop: 8,
    padding: 8,
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default AddMemberScreen;
