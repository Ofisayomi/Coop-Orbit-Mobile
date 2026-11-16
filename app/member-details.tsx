import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
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

function memberDisplayName(member: MemberDto): string {
  const full = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return full || member.userName || 'Unknown member';
}

export default function MemberDetailsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ id?: string }>();
  const memberId = params.id || '';

  const [member, setMember] = useState<MemberDto | null>(null);
  const [accounts, setAccounts] = useState<MemberAccountBalanceDto[]>([]);
  const [canViewAccounts, setCanViewAccounts] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Theme colors
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
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
      // Admins, accountants and secretaries may view any member's accounts;
      // a member may only view their own.
      const privileged =
        roles.some((role) => PRIVILEGED_MEMBER_ROLES.includes(role)) ||
        (currentUserId != null && currentUserId.toLowerCase() === memberId.toLowerCase());
      setCanViewAccounts(privileged);
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
            {/* Profile card */}
            <View style={[styles.profileCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
              <View style={styles.profileTop}>
                <View style={[styles.avatarCircle, { backgroundColor: primary }]}>
                  <Text style={styles.avatarText}>
                    {memberDisplayName(member).charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
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
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: tableBorder }]} />
              <ProfileRow label="Member ID" value={member.membershipId ?? '—'} textPrimary={textPrimary} textSecondary={textSecondary} />
              <ProfileRow label="Email" value={member.emailAddress ?? '—'} textPrimary={textPrimary} textSecondary={textSecondary} />
              <ProfileRow label="Phone" value={member.phoneNumber ?? '—'} textPrimary={textPrimary} textSecondary={textSecondary} />
              <ProfileRow label="Membership Type" value={member.membershipType ?? '—'} textPrimary={textPrimary} textSecondary={textSecondary} />
              <ProfileRow label="Role" value={member.role ?? '—'} textPrimary={textPrimary} textSecondary={textSecondary} />
              {member.address ? (
                <ProfileRow label="Address" value={member.address} textPrimary={textPrimary} textSecondary={textSecondary} />
              ) : null}
            </View>

            {/* Accounts card: visible to privileged roles and to the member themself */}
            {canViewAccounts ? (
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
            ) : (
              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: inputBorder }]}>
                <Text style={[styles.restrictedText, { color: textSecondary }]}>
                  Account balances are only visible to admins, accountants and secretaries.
                </Text>
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
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
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  statusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
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
});
