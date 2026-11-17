import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
import {
  AccountService,
  type MemberAccountBalanceDto,
  type MemberDto,
} from '@/services/accountService';
import {
  getCurrentUserId,
  getCurrentUserRoles,
  PRIVILEGED_MEMBER_ROLES,
} from '@/services/authService';
import { getSecureFileUri } from '@/services/secure-file';
import { pickProfilePhoto, type ProfilePhotoFile } from '@/services/profile-photo';

const EDIT_ROLES = ['Admin', 'Secretary'];
const GENDERS = ['male', 'female'];
const MEMBERSHIP_TYPES = ['Regular', 'Executive', 'Associate'];
const STATUSES = ['Active', 'Inactive'];
const ROLES = ['Member', 'Secretary', 'Admin', 'Accountant'];

function memberDisplayName(member: MemberDto): string {
  const full = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return full || member.userName || 'Unknown member';
}

function toDateInput(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export default function MemberDetailsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showToast } = useToast();
  const params = useLocalSearchParams<{ id?: string }>();
  const memberId = params.id || '';

  const [member, setMember] = useState<MemberDto | null>(null);
  const [accounts, setAccounts] = useState<MemberAccountBalanceDto[]>([]);
  const [canViewAccounts, setCanViewAccounts] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    membershipId: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    gender: '',
    membershipType: '',
    status: '',
    role: '',
    occupation: '',
    nextOfKin: '',
  });
  const [editPhoto, setEditPhoto] = useState<ProfilePhotoFile | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [remotePhotoUri, setRemotePhotoUri] = useState<string | null>(null);
  const [isLoadingPhoto, setIsLoadingPhoto] = useState(false);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const inputBg = isDark ? '#2D3748' : '#F7FAFC';
  const inputBorder = isDark ? '#4A5568' : '#E2E8F0';
  const tableBorder = isDark ? '#2D3748' : '#F7FAFC';
  const primary = '#173581';
  const warningBg = isDark ? '#78350F' : '#FEF3C7';
  const warningText = isDark ? '#FDE68A' : '#92400E';

  const fetchDetails = useCallback(async () => {
    if (!memberId) {
      setError('Missing member ID');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [detail, roles, currentUserId] = await Promise.all([
        AccountService.getMember(memberId),
        getCurrentUserRoles().catch(() => [] as string[]),
        getCurrentUserId().catch(() => null),
      ]);
      setMember(detail);
      const privileged =
        roles.some((role) => PRIVILEGED_MEMBER_ROLES.includes(role)) ||
        (currentUserId != null && currentUserId.toLowerCase() === memberId.toLowerCase());
      setCanViewAccounts(privileged);
      setCanEdit(roles.some((role) => EDIT_ROLES.includes(role)));
      if (privileged) {
        setIsLoadingAccounts(true);
        try {
          setAccounts(await AccountService.getMemberAccounts(memberId));
        } finally {
          setIsLoadingAccounts(false);
        }
      } else {
        setAccounts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load member details');
    } finally {
      setIsLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    void fetchDetails();
  }, [fetchDetails]);

  const startEditing = () => {
    if (!member) return;
    setEditForm({
      firstName: member.firstName ?? '',
      lastName: member.lastName ?? '',
      membershipId: member.membershipId ?? '',
      email: member.emailAddress ?? '',
      phone: member.phoneNumber ?? '',
      address: member.address ?? '',
      dateOfBirth: toDateInput(member.dateOfBirth),
      gender: member.gender ?? '',
      membershipType: member.membershipType ?? 'Regular',
      status: member.status ?? 'Active',
      role: (member.role ?? 'Member').split(',')[0].trim() || 'Member',
      occupation: member.occupation ?? '',
      nextOfKin: member.nextOfKin ?? '',
    });
    setEditPhoto(null);
    setPhotoRemoved(false);
    setEditing(true);
  };

  const handlePickEditPhoto = async () => {
    try {
      setIsPickingPhoto(true);
      const result = await pickProfilePhoto();
      if (result.error) {
        showToast(result.error, 'warning');
        return;
      }
      if (result.photo) {
        setEditPhoto(result.photo);
        setPhotoRemoved(false);
      }
    } catch {
      showToast('Could not read the selected photo.', 'error');
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!member) return;
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) {
      showToast('First and last name are required.', 'warning');
      return;
    }
    if (!editForm.email.trim()) {
      showToast('Email address is required.', 'warning');
      return;
    }
    if (!editForm.phone.trim()) {
      showToast('Phone number is required.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      await AccountService.updateMember(member.id, {
        membershipId: editForm.membershipId.trim(),
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        emailAddress: editForm.email.trim(),
        phoneNumber: editForm.phone.trim(),
        address: editForm.address.trim(),
        dateOfBirth: editForm.dateOfBirth
          ? new Date(`${editForm.dateOfBirth}T00:00:00`).toISOString()
          : new Date().toISOString(),
        nextOfKin: editForm.nextOfKin.trim(),
        membershipType: editForm.membershipType,
        gender: editForm.gender,
        role: editForm.role,
        occupation: editForm.occupation.trim(),
        resendEmail: false,
        profilePicture: editPhoto
          ? { name: editPhoto.name, contentType: editPhoto.mimeType, fileUrl: editPhoto.dataUrl }
          : undefined,
      });
      showToast('Member updated successfully!', 'success');
      setEditing(false);
      setEditPhoto(null);
      await fetchDetails();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update member.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Member photos are served by an authorized endpoint, so download them
  // with the bearer token to a cached local file instead of handing the
  // raw backend URL to the image component (which sends no auth headers).
  useEffect(() => {
    let cancelled = false;
    if (photoRemoved || editPhoto) {
      setRemotePhotoUri(null);
      setIsLoadingPhoto(false);
      return;
    }
    const backendPath = member?.profilePictureUrl;
    if (!backendPath) {
      setRemotePhotoUri(null);
      setIsLoadingPhoto(false);
      return;
    }
    setIsLoadingPhoto(true);
    void getSecureFileUri(backendPath)
      .then((uri) => {
        if (!cancelled) setRemotePhotoUri(uri);
      })
      .catch(() => {
        if (!cancelled) setRemotePhotoUri(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPhoto(false);
      });
    return () => {
      cancelled = true;
    };
  }, [member?.profilePictureUrl, editPhoto, photoRemoved]);

  const photoUri = photoRemoved ? null : (editPhoto?.uri ?? remotePhotoUri);

  const renderEditInput = (label: string, field: keyof typeof editForm, placeholder: string, keyboardType: 'default' | 'email-address' | 'phone-pad' = 'default') => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: textPrimary }]}>{label}</Text>
      <TextInput
        style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textPrimary }]}
        placeholder={placeholder}
        placeholderTextColor={textSecondary}
        value={editForm[field]}
        onChangeText={(value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
        keyboardType={keyboardType}
        autoCapitalize={field === 'email' ? 'none' : 'sentences'}
        editable={!isSaving}
      />
    </View>
  );

  const renderEditOptions = (label: string, field: keyof typeof editForm, options: string[]) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: textPrimary }]}>{label}</Text>
      <View style={styles.optionsRow}>
        {options.map((option) => {
          const selected = editForm[field] === option;
          const display = option.charAt(0).toUpperCase() + option.slice(1);
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.optionChip,
                { borderColor: selected ? primary : inputBorder, backgroundColor: selected ? primary : 'transparent' },
              ]}
              onPress={() => setEditForm((prev) => ({ ...prev, [field]: option }))}
              disabled={isSaving}
            >
              <Text style={[styles.optionText, { color: selected ? '#FFFFFF' : textSecondary }]}>{display}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Member Details',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTintColor: textPrimary,
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false,
        }}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {isLoading && !member ? (
            <View style={styles.centerState}>
              <ActivityIndicator size="large" color={primary} />
              <Text style={[styles.centerStateText, { color: textSecondary }]}>Loading member…</Text>
            </View>
          ) : null}

          {error && !member ? (
            <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
              <View style={styles.centerState}>
                <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
                <Text style={[styles.centerStateTitle, { color: textPrimary }]}>Failed to load member</Text>
                <Text style={[styles.centerStateText, { color: textSecondary }]}>{error}</Text>
                <TouchableOpacity style={[styles.retryButton, { backgroundColor: primary }]} onPress={() => void fetchDetails()}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
                  <Text style={[styles.backLinkText, { color: primary }]}>Back to members</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {member ? (
            <>
              {/* Profile card with centered photo */}
              <View style={[styles.profileCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
                <View style={styles.profileCenter}>
                  {isLoadingPhoto ? (
                    <View style={[styles.profilePhotoFallback, { backgroundColor: inputBorder }]}>
                      <ActivityIndicator size="large" color={primary} />
                    </View>
                  ) : photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.profilePhoto} contentFit="cover" />
                  ) : (
                    <View style={[styles.profilePhotoFallback, { backgroundColor: primary }]}>
                      <Text style={styles.profilePhotoFallbackText}>
                        {memberDisplayName(member).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.profileName, { color: textPrimary }]}>
                    {memberDisplayName(member)}
                  </Text>
                  <Text style={[styles.profileUsername, { color: textSecondary }]}>
                    @{member.userName ?? 'unknown'}
                  </Text>
                  {member.status ? (
                    <View style={[styles.statusPill, { backgroundColor: inputBorder }]}>
                      <Text style={[styles.statusPillText, { color: textSecondary }]}>
                        {member.status}
                      </Text>
                    </View>
                  ) : null}
                  {canEdit && !editing ? (
                    <TouchableOpacity
                      style={[styles.editButton, { borderColor: primary }]}
                      onPress={startEditing}
                    >
                      <Ionicons name="create-outline" size={16} color={primary} />
                      <Text style={[styles.editButtonText, { color: primary }]}>Edit Details</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {editing ? (
                  <>
                    <View style={[styles.divider, { backgroundColor: tableBorder }]} />
                    <View style={styles.photoRow}>
                      {editPhoto ? (
                        <Image source={{ uri: editPhoto.uri }} style={styles.photoPreview} contentFit="cover" />
                      ) : photoUri ? (
                        <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
                      ) : (
                        <View style={[styles.photoPlaceholder, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                          <Ionicons name="person-outline" size={28} color={textSecondary} />
                        </View>
                      )}
                      <View style={{ flex: 1, gap: 8 }}>
                        <TouchableOpacity
                          style={[styles.photoButton, { backgroundColor: inputBg, borderColor: inputBorder }]}
                          onPress={() => void handlePickEditPhoto()}
                          disabled={isPickingPhoto || isSaving}
                        >
                          {isPickingPhoto ? (
                            <ActivityIndicator size="small" color={primary} />
                          ) : (
                            <>
                              <Ionicons name="cloud-upload-outline" size={18} color={primary} />
                              <Text style={[styles.photoButtonText, { color: primary }]}>Change Photo</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>

                    {renderEditInput('First Name *', 'firstName', 'Enter first name')}
                    {renderEditInput('Last Name *', 'lastName', 'Enter last name')}
                    {renderEditInput('Member ID', 'membershipId', 'Enter member ID')}
                    {renderEditInput('Email *', 'email', 'Enter email', 'email-address')}
                    {renderEditInput('Phone *', 'phone', 'Enter phone number', 'phone-pad')}
                    {renderEditInput('Address', 'address', 'Enter home address')}
                    {renderEditInput('Date of Birth (YYYY-MM-DD)', 'dateOfBirth', 'e.g. 1990-05-14')}
                    {renderEditOptions('Gender', 'gender', GENDERS)}
                    {renderEditOptions('Membership Type', 'membershipType', MEMBERSHIP_TYPES)}
                    {renderEditOptions('Status', 'status', STATUSES)}
                    {renderEditOptions('Role', 'role', ROLES)}
                    {renderEditInput('Occupation', 'occupation', 'Enter occupation')}
                    {renderEditInput('Next of Kin', 'nextOfKin', 'Enter next of kin')}

                    <View style={styles.editActions}>
                      <TouchableOpacity
                        style={[styles.cancelEditButton, { borderColor: inputBorder }]}
                        onPress={() => {
                          setEditing(false);
                          setEditPhoto(null);
                        }}
                        disabled={isSaving}
                      >
                        <Text style={[styles.cancelEditText, { color: textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: primary }, isSaving && styles.disabledButton]}
                        onPress={() => void handleSaveEdit()}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.saveButtonText}>Save Changes</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={[styles.divider, { backgroundColor: tableBorder }]} />
                    <ProfileRow label="Member ID" value={member.membershipId ?? '—'} textPrimary={textPrimary} textSecondary={textSecondary} />
                    <ProfileRow label="Email" value={member.emailAddress ?? '—'} textPrimary={textPrimary} textSecondary={textSecondary} />
                    <ProfileRow label="Phone" value={member.phoneNumber ?? '—'} textPrimary={textPrimary} textSecondary={textSecondary} />
                    <ProfileRow label="Membership Type" value={member.membershipType ?? '—'} textPrimary={textPrimary} textSecondary={textSecondary} />
                    <ProfileRow label="Role" value={member.role ?? '—'} textPrimary={textPrimary} textSecondary={textSecondary} />
                    {member.address ? (
                      <ProfileRow label="Address" value={member.address} textPrimary={textPrimary} textSecondary={textSecondary} />
                    ) : null}
                  </>
                )}
              </View>

              {/* Accounts card: visible to privileged roles and to the member themself */}
              {canViewAccounts && !editing ? (
                <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
                  <Text style={[styles.sectionTitle, { color: textPrimary }]}>Account Balances</Text>
                  {isLoadingAccounts ? (
                    <View style={styles.centerState}>
                      <ActivityIndicator size="small" color={primary} />
                    </View>
                  ) : accounts.length > 0 ? (
                    accounts.map((account, index) => {
                      const outstanding = Number(account.balance) < 0;
                      return (
                        <View
                          key={account.accountId || index}
                          style={[
                            styles.accountRow,
                            index < accounts.length - 1 && {
                              borderBottomColor: tableBorder,
                              borderBottomWidth: 1,
                            },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.accountName, { color: textPrimary }]}>
                              {account.accountName}
                            </Text>
                            {account.accountType ? (
                              <Text style={[styles.accountType, { color: textSecondary }]}>
                                {account.accountType}
                              </Text>
                            ) : null}
                          </View>
                          <View style={styles.balanceBlock}>
                            <Text
                              style={[
                                styles.accountBalance,
                                { color: outstanding ? warningText : textPrimary },
                              ]}
                            >
                              ₦{Math.abs(Number(account.balance)).toLocaleString()}
                            </Text>
                            {outstanding ? (
                              <View style={[styles.warningPill, { backgroundColor: warningBg }]}>
                                <Ionicons name="warning" size={10} color={warningText} />
                                <Text style={[styles.warningPillText, { color: warningText }]}>
                                  Outstanding
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={[styles.emptyAccounts, { color: textSecondary }]}>
                      No account balances recorded for this member.
                    </Text>
                  )}
                </View>
              ) : !canViewAccounts && !editing ? (
                <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
                  <Text style={[styles.restrictedText, { color: textSecondary }]}>
                    Account balances are only visible to admins, accountants and secretaries.
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProfileRow({
  label,
  value,
  textPrimary,
  textSecondary,
}: {
  label: string;
  value: string;
  textPrimary: string;
  textSecondary: string;
}) {
  return (
    <View style={styles.profileRow}>
      <Text style={[styles.profileLabel, { color: textSecondary }]}>{label}</Text>
      <Text style={[styles.profileValue, { color: textPrimary }]}>{value}</Text>
    </View>
  );
}

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
  sectionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  profileCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  profileCenter: {
    alignItems: 'center',
    gap: 6,
  },
  profilePhoto: {
    width: 140,
    height: 140,
    borderRadius: 70,
    marginBottom: 6,
  },
  profilePhotoFallback: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  profilePhotoFallbackText: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  profileUsername: {
    fontSize: 13,
    textAlign: 'center',
  },
  statusPill: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    marginTop: 10,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  profileLabel: {
    fontSize: 13,
  },
  profileValue: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flexShrink: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  accountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  accountName: {
    fontSize: 13,
    fontWeight: '600',
  },
  accountType: {
    fontSize: 11,
    marginTop: 2,
  },
  balanceBlock: {
    alignItems: 'flex-end',
    gap: 4,
  },
  accountBalance: {
    fontSize: 14,
    fontWeight: '700',
  },
  warningPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  warningPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyAccounts: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  restrictedText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
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
    fontSize: 12,
    fontWeight: '600',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  photoPreview: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  photoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  photoButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelEditButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelEditText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
