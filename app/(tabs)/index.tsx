import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';
import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/context/ThemeContext';

const { width } = Dimensions.get('window');

interface Account {
  id: string;
  label: string;
  balance: string;
  icon: string;
  color: string;
  badgeText: string;
}

const SAMPLE_ACCOUNTS: Account[] = [
  {
    id: '1',
    label: 'Savings Account',
    balance: '₦850,000',
    icon: 'wallet-outline',
    color: '#173581',
    badgeText: 'Active',
  },
  {
    id: '2',
    label: 'Shares Account',
    balance: '₦1,200,000',
    icon: 'trending-up-outline',
    color: '#2B6CB0',
    badgeText: 'Dividend Eligible',
  },
  {
    id: '3',
    label: 'Loan Balance Remaining',
    balance: '₦400,000',
    icon: 'cash-outline',
    color: '#4299E1',
    badgeText: 'Due in 15 days',
  },
];

const DashboardScreen = () => {
  const router = useRouter();
  const { colorScheme } = useAppTheme();
  const isDark = colorScheme === 'dark';
  const [userName, setUserName] = useState('Member');
  const [accounts, setAccounts] = useState<Account[]>(SAMPLE_ACCOUNTS);

  // Theming helpers
  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const iconBgLight = isDark ? '#1A2744' : '#EBF8FF';
  const iconBgMid = isDark ? '#1A3050' : '#BEE3F8';
  const activityBorder = isDark ? '#2D3748' : '#F7FAFC';
  const sectionTitleColor = isDark ? '#FFFFFF' : '#1A202C';
  const quickActionLabelColor = isDark ? '#A0AEC0' : '#4A5568';

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const token = await SecureStore.getItemAsync('access_token');
        if (token) {
          const decoded = jwtDecode<any>(token);
          const name = decoded.name || decoded.preferred_username || decoded.given_name || 'Member';
          setUserName(name);
        }
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    };
    fetchUser();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.welcomeText, { color: textPrimary }]}>Welcome back, {userName}</Text>
            <Text style={[styles.subHeaderText, { color: textSecondary }]}>Here's what's happening with your accounts today.</Text>
          </View>
        </View>

        {/* Account Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.cardsScroll}
          contentContainerStyle={styles.cardsContainer}
        >
          {accounts.map((account: Account) => (
            <View key={account.id} style={[styles.accountCard, { backgroundColor: account.color }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconContainer}>
                  <Ionicons name={account.icon as any} size={24} color="#fff" />
                </View>
                {account.badgeText && (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{account.badgeText}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.accountLabel}>{account.label}</Text>
              <Text style={styles.accountBalance}>{account.balance}</Text>
              <TouchableOpacity style={styles.viewDetailsButton}>
                <Text style={styles.viewDetailsText}>View Details →</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        {/* Quick Actions */}
        <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {[
            { name: 'Request Loan', icon: 'document-text-outline', lightBg: iconBgLight },
            { name: 'Make Payment', icon: 'card-outline', lightBg: iconBgMid, route: '/make-payment' },
            { name: 'Withdraw', icon: 'arrow-up-circle-outline', lightBg: iconBgLight },
            { name: 'History', icon: 'time-outline', lightBg: iconBgMid, route: '/(tabs)/history' },
            { name: 'Guarantor Requests', icon: 'people-outline', lightBg: iconBgMid, route: '/(tabs)/guarantor-requests' },
            { name: 'Support', icon: 'headset-outline', lightBg: iconBgLight },
          ].map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.quickActionItem, { backgroundColor: cardBg }]}
              onPress={() => {
                if (action.route) {
                  router.push(action.route as any);
                }
              }}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: action.lightBg }]}>
                <Ionicons name={action.icon as any} size={24} color={isDark ? '#90CDF4' : '#173581'} />
              </View>
              <Text style={[styles.quickActionLabel, { color: quickActionLabelColor }]}>{action.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity */}
        <View style={styles.recentActivityHeader}>
          <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>Recent Activity</Text>
          <TouchableOpacity>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.activityList, { backgroundColor: cardBg }]}>
          <ActivityItem
            title="Monthly Contribution"
            date="Today, 10:23 AM"
            amount="+₦50,000"
            type="increase"
            icon="arrow-down-outline"
            iconColor="#3182CE"
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={activityBorder}
          />
          <ActivityItem
            title="Loan Repayment"
            date="Yesterday, 4:15 PM"
            amount="-₦25,000"
            type="decrease"
            icon="arrow-up-outline"
            iconColor="#C54444"
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={activityBorder}
          />
          <ActivityItem
            title="Share Dividend"
            date="Oct 24, 2023"
            amount="+₦12,500"
            type="increase"
            icon="pie-chart-outline"
            iconColor="#3182CE"
            isDark={isDark}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={activityBorder}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const ActivityItem = ({ title, date, amount, type, icon, iconColor, isDark, textPrimary, textSecondary, borderColor }: any) => (
  <View style={[styles.activityItem, { borderBottomColor: borderColor }]}>
    <View style={[styles.activityIconContainer, { backgroundColor: iconColor + '20' }]}>
      <Ionicons name={icon} size={20} color={iconColor} />
    </View>
    <View style={styles.activityInfo}>
      <Text style={[styles.activityTitle, { color: textPrimary }]}>{title}</Text>
      <Text style={[styles.activityDate, { color: textSecondary }]}>{date}</Text>
    </View>
    <Text style={[styles.activityAmount, { color: type === 'increase' ? '#3182CE' : '#C54444' }]}>
      {amount}
    </Text>
  </View>
);

export default DashboardScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },
  subHeaderText: {
    fontSize: 12,
    marginTop: 4,
    width: width * 0.5,
  },
  cardsScroll: {
    marginHorizontal: -20,
    marginBottom: 30,
  },
  cardsContainer: {
    paddingHorizontal: 20,
    gap: 16,
    flexDirection: 'row',
  },
  accountCard: {
    width: width * 0.75,
    borderRadius: 16,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cardIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accountLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginBottom: 4,
  },
  accountBalance: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  viewDetailsButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  viewDetailsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  quickActionItem: {
    width: (width - 60) / 3,
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  recentActivityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    color: '#173581',
    fontSize: 12,
    fontWeight: '600',
  },
  activityList: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  activityIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityDate: {
    fontSize: 12,
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
