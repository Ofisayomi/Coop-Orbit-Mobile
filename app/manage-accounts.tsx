import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/context/ToastContext';
import { useAppPalette } from '@/hooks/use-app-palette';
import { getCurrentUserRoles, PRIVILEGED_MEMBER_ROLES } from '@/services/authService';
import { AccountService, type AccountDto } from '@/services/accountService';

const ManageAccountsScreen = () => {
  const router = useRouter();
  const { showToast } = useToast();
  const { colors, common } = useAppPalette();

  const bg = colors.bg;
  const textPrimary = colors.text;
  const textSecondary = colors.muted;
  const cardBg = colors.card;
  const inputBorder = colors.border;
  const primary = colors.primary;

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void getCurrentUserRoles()
      .then((roles) => {
        const allowed = roles.some((role) => PRIVILEGED_MEMBER_ROLES.includes(role));
        setAuthorized(allowed);
        if (!allowed) showToast('Only admins, accountants, and secretaries can manage accounts.', 'error');
      })
      .catch(() => setAuthorized(false));
  }, [showToast]);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await AccountService.getAccounts(undefined, true);
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load accounts');
      setAccounts([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authorized === true) void fetchAccounts();
  }, [authorized, fetchAccounts]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchAccounts();
  }, [fetchAccounts]);

  const toggleActive = async (account: AccountDto) => {
    setBusyId(account.id);
    try {
      await AccountService.setAccountStatus(account.id, !account.isActive);
      setAccounts((prev) => prev.map((a) => (a.id === account.id ? { ...a, isActive: !a.isActive } : a)));
      showToast(`Account ${!account.isActive ? 'activated' : 'deactivated'}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update account status.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (account: AccountDto) => {
    Alert.alert(
      'Delete account?',
      `"${account.accountName}" will be permanently removed. Accounts with loans, balances, payments, ledger entries, or dependent eligibility rules cannot be deleted — deactivate them instead.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void deleteAccount(account),
        },
      ]
    );
  };

  const deleteAccount = async (account: AccountDto) => {
    setBusyId(account.id);
    try {
      await AccountService.deleteAccount(account.id);
      setAccounts((prev) => prev.filter((a) => a.id !== account.id));
      showToast('Account deleted.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete account.', 'error');
    } finally {
      setBusyId(null);
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
        <TouchableOpacity style={[common.primaryButton, styles.backButton]} onPress={() => router.back()}>
          <Text style={common.primaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

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
          <Text style={[styles.title, { color: textPrimary }]}>Manage Accounts</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>
            {accounts.length} account{accounts.length === 1 ? '' : 's'} in your organization
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={primary} />}
      >
        {isLoading && !isRefreshing ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator size="large" color={primary} />
            <Text style={[styles.emptyText, { color: textSecondary }]}>Loading accounts…</Text>
          </View>
        ) : error ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
            <Text style={[styles.emptyText, { color: textPrimary }]}>Failed to load accounts</Text>
            <Text style={[styles.emptySubText, { color: textSecondary }]}>{error}</Text>
            <TouchableOpacity style={[common.primaryButton, styles.retryButton]} onPress={() => void fetchAccounts()}>
              <Text style={common.primaryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : accounts.length > 0 ? (
          <View style={[styles.list, { backgroundColor: cardBg }]}>
            {accounts.map((account) => (
              <View key={account.id} style={[styles.row, { borderBottomColor: inputBorder }]}>
                <TouchableOpacity
                  style={styles.rowMain}
                  activeOpacity={0.7}
                  onPress={() => router.push({ pathname: '/edit-account', params: { id: account.id } })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, { color: textPrimary }]} numberOfLines={1}>
                      {account.accountName}
                    </Text>
                    <View style={styles.badgesRow}>
                      <View style={[styles.badge, { backgroundColor: colors.primarySoft }]}>
                        <Text style={[styles.badgeText, { color: primary }]}>{account.accountType}</Text>
                      </View>
                      <View style={[styles.badge, { backgroundColor: account.isActive ? colors.primarySoft : inputBorder }]}>
                        <Text style={[styles.badgeText, { color: account.isActive ? primary : textSecondary }]}>
                          {account.isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={textSecondary} />
                </TouchableOpacity>
                <View style={styles.rowActions}>
                  <Switch
                    value={account.isActive}
                    disabled={busyId === account.id}
                    onValueChange={() => void toggleActive(account)}
                    trackColor={{ false: '#CBD5E0', true: '#90CDF4' }}
                    thumbColor={account.isActive ? primary : '#F7FAFC'}
                    ios_backgroundColor="#CBD5E0"
                  />
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/edit-account', params: { id: account.id } })}
                    disabled={busyId === account.id}
                    accessibilityLabel={`Edit ${account.accountName}`}
                  >
                    <Ionicons name="create-outline" size={20} color={primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => confirmDelete(account)}
                    disabled={busyId === account.id}
                    accessibilityLabel={`Delete ${account.accountName}`}
                  >
                    {busyId === account.id
                      ? <ActivityIndicator size="small" color={primary} />
                      : <Ionicons name="trash-outline" size={20} color={colors.danger} />}
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="wallet-outline" size={48} color={textSecondary} />
            <Text style={[styles.emptyText, { color: textSecondary }]}>No accounts found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default ManageAccountsScreen;

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
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 24,
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
    paddingBottom: 32,
  },
  list: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  rowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowName: {
    fontSize: 14,
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
    marginTop: 8,
  },
  emptyContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  emptySubText: {
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
