import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/context/ThemeContext';
import {
  getCurrentReportUser,
  ReportService,
  type ReportSummary,
} from '@/services/report-service';

type ScopeView = 'organization' | 'personal';
type PeriodKey = '30d' | 'month' | '6m' | '12m';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: '30d', label: '30 days' },
  { key: 'month', label: 'This month' },
  { key: '6m', label: '6 months' },
  { key: '12m', label: '12 months' },
];

function periodRange(key: PeriodKey): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  if (key === '30d') {
    from.setDate(from.getDate() - 30);
  } else if (key === 'month') {
    from.setDate(1);
  } else {
    // Clamp the day before shifting months so e.g. Mar 31 - 6 months stays in September.
    const day = from.getDate();
    from.setDate(1);
    from.setMonth(from.getMonth() - (key === '6m' ? 6 : 12));
    const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
    from.setDate(Math.min(day, lastDay));
  }
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: to.toISOString() };
}

const formatNaira = (value: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(value);

export default function ReportsScreen() {
  const { colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';

  const [canViewOrganization, setCanViewOrganization] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
  const [scopeView, setScopeView] = useState<ScopeView>('organization');
  const [period, setPeriod] = useState<PeriodKey>('6m');
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReloading, setIsReloading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveScopeView: ScopeView = canViewOrganization ? scopeView : 'personal';
  const isOrganizationScope = report?.scope === 'Organization';

  const loadReport = useCallback(async () => {
    setError(null);
    setIsReloading(true);
    try {
      const { from, to } = periodRange(period);
      const data = await ReportService.getReportSummary({
        from,
        to,
        // Non-privileged roles never send a member id: the API forces their own id anyway.
        // A member tapped in Top members narrows an organization report to that member.
        memberId: canViewOrganization
          ? (selectedMember?.id ?? (effectiveScopeView === 'personal' && userId ? userId : undefined))
          : undefined,
      });
      setReport(data);
    } catch {
      // Keep any report already on screen; the banner explains the failed refresh.
      setError('Unable to load your report. Pull down to try again.');
    } finally {
      setIsLoading(false);
      setIsReloading(false);
      setIsRefreshing(false);
    }
  }, [canViewOrganization, effectiveScopeView, period, selectedMember, userId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const current = await getCurrentReportUser();
      if (!cancelled) {
        setCanViewOrganization(current.canViewOrganization);
        setUserId(current.userId);
        setUserLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Wait for the role/user lookup so the first request already uses the right scope.
  useEffect(() => {
    if (!userLoaded) return;
    const timer = setTimeout(() => void loadReport(), 0);
    return () => clearTimeout(timer);
  }, [loadReport, userLoaded]);

  const maxMonthly = useMemo(
    () =>
      Math.max(
        1,
        ...(report?.monthlySeries ?? []).flatMap((point) => [point.credits, point.debits]),
      ),
    [report],
  );

  const handleShare = useCallback(async () => {
    if (!report) return;
    const lines = [
      `Cooperative report (${report.scope})`,
      `${new Date(report.from).toLocaleDateString('en-NG')} - ${new Date(report.to).toLocaleDateString('en-NG')}`,
      `Total credits: ${formatNaira(report.totalCredits)}`,
      `Total debits: ${formatNaira(report.totalDebits)}`,
      `Net movement: ${formatNaira(report.netMovement)}`,
      `Savings balance: ${formatNaira(report.totalSavingsBalance)}`,
      `Loans requested: ${formatNaira(report.totalLoansRequested)}`,
      `Loans outstanding: ${formatNaira(report.totalLoansOutstanding)}`,
      `Payment requests: ${formatNaira(report.totalPaymentRequested)}`,
      `Pending payments: ${formatNaira(report.pendingPaymentAmount)}`,
    ];
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      // Sharing is best-effort; a dismissed/failed share sheet needs no error state.
    }
  }, [report]);

  const bg = isDark ? '#121212' : '#F8F9FB';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const border = isDark ? '#2D3748' : '#E2E8F0';
  const primary = '#173581';

  const metricCards = report
    ? [
      { label: 'Total credits', value: formatNaira(report.totalCredits), hint: `${report.transactionCount} transactions` },
      { label: 'Total debits', value: formatNaira(report.totalDebits), hint: 'Outgoing entries' },
      { label: 'Net movement', value: formatNaira(report.netMovement), hint: 'Credits minus debits' },
      {
        label: 'Savings balance',
        value: formatNaira(report.totalSavingsBalance),
        hint: isOrganizationScope ? `${report.memberCount} members` : 'Your accounts',
      },
      {
        label: 'Loans requested',
        value: formatNaira(report.totalLoansRequested),
        hint: `${report.loanCount} loans, ${report.activeLoanCount} active`,
      },
      { label: 'Loans outstanding', value: formatNaira(report.totalLoansOutstanding), hint: 'Approved / disbursed / defaulted' },
      {
        label: 'Payment requests',
        value: formatNaira(report.totalPaymentRequested),
        hint: `${report.paymentRequestCount} requests`,
      },
      { label: 'Pending payments', value: formatNaira(report.pendingPaymentAmount), hint: 'Awaiting approval' },
    ]
    : [];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['left', 'right', 'bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Reports',
          headerTitleStyle: { fontWeight: 'bold' },
          headerTintColor: textPrimary,
          headerStyle: { backgroundColor: bg },
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              void loadReport();
            }}
            tintColor={isDark ? '#7AA2FF' : primary}
            colors={[isDark ? '#7AA2FF' : primary]}
          />
        }>
        <Text style={[styles.subtitle, { color: textSecondary }]}>
          {report
            ? isOrganizationScope
              ? 'Showing data for the whole organization.'
              : 'Showing your personal data only.'
            : "Your cooperative's performance at a glance."}
        </Text>

        <View
          style={[
            styles.scopeBadge,
            { backgroundColor: isOrganizationScope ? (isDark ? '#1E3A5F' : '#DBEAFE') : isDark ? '#451A03' : '#FEF3C7' },
          ]}>
          <Text style={[styles.scopeBadgeText, { color: isOrganizationScope ? (isDark ? '#93C5FD' : '#1E40AF') : isDark ? '#FCD34D' : '#92400E' }]}>
            {report ? `${report.scope} report` : 'Report'}
          </Text>
        </View>

        {!canViewOrganization && (
          <Text style={[styles.roleNote, { color: textSecondary }]}>
            Your role can only see your own report. Admin and Accountant roles see the whole organization.
          </Text>
        )}

        {canViewOrganization && (
          <View style={[styles.segmented, { borderColor: border, backgroundColor: cardBg }]}>
            {(
              [
                { key: 'organization', label: 'Whole organization' },
                { key: 'personal', label: 'My data only' },
              ] as { key: ScopeView; label: string }[]
            ).map((option) => (
              <TouchableOpacity
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected: effectiveScopeView === option.key }}
                onPress={() => {
                  setScopeView(option.key);
                  if (option.key === 'organization') setSelectedMember(null);
                }}
                style={[
                  styles.segment,
                  effectiveScopeView === option.key && { backgroundColor: primary },
                ]}>
                <Text
                  style={[
                    styles.segmentText,
                    { color: effectiveScopeView === option.key ? '#FFFFFF' : textSecondary },
                  ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodRow}>
          {PERIODS.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setPeriod(item.key)}
              style={[
                styles.chip,
                {
                  backgroundColor: period === item.key ? primary : cardBg,
                  borderColor: period === item.key ? primary : border,
                },
              ]}>
              <Text style={[styles.chipText, { color: period === item.key ? '#FFFFFF' : textSecondary }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isReloading && !isLoading ? (
          <View style={styles.reloading}>
            <ActivityIndicator size="small" color={isDark ? '#7AA2FF' : primary} />
            <Text style={[styles.loadingText, { color: textSecondary }]}>Updating report…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorBox, isDark && { backgroundColor: '#451A1A' }]}>
            <Text style={[styles.errorText, isDark && { color: '#FCA5A5' }]}>{error}</Text>
            <TouchableOpacity onPress={() => void loadReport()}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={isDark ? '#7AA2FF' : primary} />
            <Text style={[styles.loadingText, { color: textSecondary }]}>Loading report…</Text>
          </View>
        ) : !report ? (
          error ? null : <Text style={[styles.empty, { color: textSecondary }]}>No report data available for this period.</Text>
        ) : (
          <>
            <View style={styles.metricsGrid}>
              {metricCards.map((metric) => (
                <View key={metric.label} style={[styles.metricCard, { backgroundColor: cardBg, borderColor: border }]}>
                  <Text style={[styles.metricLabel, { color: textSecondary }]}>{metric.label}</Text>
                  <Text style={[styles.metricValue, { color: textPrimary }]}>{metric.value}</Text>
                  <Text style={[styles.metricHint, { color: textSecondary }]}>{metric.hint}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Activity by month</Text>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
              {report.monthlySeries.length === 0 ? (
                <Text style={[styles.empty, { color: textSecondary }]}>No monthly activity in this period.</Text>
              ) : (
                report.monthlySeries.map((point) => (
                  <View key={point.month} style={styles.monthRow}>
                    <Text style={[styles.monthLabel, { color: textSecondary }]}>{point.label}</Text>
                    <View style={styles.bars}>
                      <View style={[styles.barTrack]}>
                        <View style={[styles.bar, { width: `${point.credits === 0 ? 0 : Math.max(2, (point.credits / maxMonthly) * 100)}%`, backgroundColor: '#059669' }]} />
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.bar, { width: `${point.debits === 0 ? 0 : Math.max(2, (point.debits / maxMonthly) * 100)}%`, backgroundColor: '#D97706' }]} />
                      </View>
                    </View>
                    <Text style={[styles.monthNet, { color: textPrimary }]}>{formatNaira(point.net)}</Text>
                  </View>
                ))
              )}
              <View style={styles.legend}>
                <Text style={[styles.legendItem, { color: '#059669' }]}>■ Credits</Text>
                <Text style={[styles.legendItem, { color: '#D97706' }]}>■ Debits</Text>
                <Text style={[styles.legendItem, { color: textSecondary }]}>Right: net</Text>
              </View>
            </View>

            {report.accountBreakdown.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>Balance by account</Text>
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                  {report.accountBreakdown.map((item) => (
                    <View key={item.label} style={[styles.breakdownRow, { borderBottomColor: border }]}>
                      <Text style={[styles.breakdownLabel, { color: textPrimary }]}>{item.label}</Text>
                      <Text style={[styles.breakdownValue, { color: textPrimary }]}>
                        {formatNaira(item.amount)} <Text style={{ color: textSecondary }}>({item.count})</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {report.transactionTypeBreakdown.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>By transaction type</Text>
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                  {report.transactionTypeBreakdown.map((item) => (
                    <View key={item.label} style={[styles.breakdownRow, { borderBottomColor: border }]}>
                      <Text style={[styles.breakdownLabel, { color: textPrimary }]}>{item.label}</Text>
                      <Text style={[styles.breakdownValue, { color: textPrimary }]}>
                        {formatNaira(item.amount)} <Text style={{ color: textSecondary }}>({item.count})</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {selectedMember && (
              <View style={[styles.selectedMemberBar, { backgroundColor: cardBg, borderColor: border }]}>
                <Text style={[styles.breakdownLabel, { color: textPrimary, flex: 1 }]}>
                  Viewing {selectedMember.name}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Clear selected member"
                  onPress={() => setSelectedMember(null)}>
                  <Text style={[styles.retryText, { color: primary }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}

            {isOrganizationScope && report.memberBreakdown.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>Top members by volume</Text>
                <Text style={[styles.metricHint, { color: textSecondary, marginBottom: 8 }]}>
                  Tap a member to view only their report.
                </Text>
                <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                  {report.memberBreakdown.map((member) => (
                    <TouchableOpacity
                      key={member.memberId}
                      accessibilityRole="button"
                      accessibilityLabel={`View report for ${member.memberName}`}
                      onPress={() => setSelectedMember({ id: member.memberId, name: member.memberName })}
                      style={[styles.breakdownRow, { borderBottomColor: border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.breakdownLabel, { color: textPrimary }]}>{member.memberName}</Text>
                        <Text style={[styles.metricHint, { color: textSecondary }]}>
                          {member.transactionCount} transactions
                        </Text>
                      </View>
                      <Text style={[styles.breakdownValue, { color: textPrimary }]}>{formatNaira(member.net)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={[styles.sectionTitle, { color: textPrimary }]}>Recent transactions</Text>
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
              {report.recentTransactions.length === 0 ? (
                <Text style={[styles.empty, { color: textSecondary }]}>No transactions in this period.</Text>
              ) : (
                report.recentTransactions.map((transaction) => (
                  <View key={transaction.id} style={[styles.transactionRow, { borderBottomColor: border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.breakdownLabel, { color: textPrimary }]} numberOfLines={1}>
                        {transaction.description || transaction.transactionType}
                      </Text>
                      <Text style={[styles.metricHint, { color: textSecondary }]}>
                        {new Date(transaction.transactionDate).toLocaleDateString('en-NG')}
                        {isOrganizationScope && transaction.beneficiaryName ? ` · ${transaction.beneficiaryName}` : ''}
                        {` · ${transaction.status}`}
                      </Text>
                    </View>
                    <Text style={[styles.breakdownValue, { color: transaction.isDebit ? '#DC2626' : '#059669' }]}>
                      {transaction.isDebit ? '-' : '+'}
                      {formatNaira(transaction.amount)}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <TouchableOpacity
              style={[styles.shareButton, { backgroundColor: primary }]}
              onPress={() => void handleShare()}>
              <Ionicons name="share-outline" size={18} color="#FFFFFF" />
              <Text style={styles.shareButtonText}>Share report summary</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  subtitle: { fontSize: 13, marginBottom: 12 },
  scopeBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 10 },
  scopeBadgeText: { fontSize: 11, fontWeight: '700' },
  roleNote: { fontSize: 12, marginBottom: 14 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden', marginBottom: 14 },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 13, fontWeight: '600' },
  periodRow: { marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 12, fontWeight: '600' },
  errorBox: { backgroundColor: '#FEF2F2', borderRadius: 10, padding: 14, marginBottom: 16, gap: 6 },
  errorText: { color: '#B91C1C', fontSize: 13 },
  retryText: { color: '#991B1B', fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  reloading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  loading: { paddingVertical: 48, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13 },
  empty: { fontSize: 13, paddingVertical: 12 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 8 },
  metricCard: { width: '48%', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  metricLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  metricValue: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  metricHint: { fontSize: 11 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginTop: 14, marginBottom: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 8 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  monthLabel: { width: 64, fontSize: 11, fontWeight: '600' },
  bars: { flex: 1, gap: 4 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(128,128,128,0.15)', overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  monthNet: { width: 84, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  legend: { flexDirection: 'row', gap: 14, marginTop: 6 },
  legendItem: { fontSize: 11, fontWeight: '600' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  breakdownLabel: { fontSize: 13, fontWeight: '600' },
  breakdownValue: { fontSize: 13, fontWeight: '700' },
  transactionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  selectedMemberBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 14 },
  shareButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 18 },
  shareButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
