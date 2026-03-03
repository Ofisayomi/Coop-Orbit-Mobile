import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/context/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { logout } from '@/services/authService';

export default function SettingsScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { themeMode, setThemeMode } = useAppTheme();

    const [isBiometricSupported, setIsBiometricSupported] = useState(false);
    const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
    const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);

    useEffect(() => {
        checkBiometricSupport();
        loadSettings();
    }, []);

    const checkBiometricSupport = async () => {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricSupported(compatible && enrolled);
    };

    const loadSettings = async () => {
        const biometricEnabled = await SecureStore.getItemAsync('biometrics_enabled');
        if (biometricEnabled === 'true') {
            setIsBiometricEnabled(true);
        }

        // In a real app, this would be fetched from the backend user profile
        const twoFactorEnabled = await SecureStore.getItemAsync('two_factor_enabled');
        if (twoFactorEnabled === 'true') {
            setIsTwoFactorEnabled(true);
        }
    };

    const toggleBiometrics = async (value: boolean) => {
        if (value) {
            // Trying to enable
            try {
                const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Authenticate to enable biometrics',
                    fallbackLabel: 'Use Passcode',
                });

                if (result.success) {
                    setIsBiometricEnabled(true);
                    await SecureStore.setItemAsync('biometrics_enabled', 'true');
                    Alert.alert('Success', 'Biometric login has been enabled.');
                } else {
                    setIsBiometricEnabled(false);
                }
            } catch (error) {
                console.error(error);
                Alert.alert('Error', 'Failed to enable biometrics.');
                setIsBiometricEnabled(false);
            }
        } else {
            // Disabling
            setIsBiometricEnabled(false);
            await SecureStore.setItemAsync('biometrics_enabled', 'false');
        }
    };

    const toggleTwoFactor = async (value: boolean) => {
        // In a real app, this would trigger a flow to set up TOTP or SMS 2FA with the backend
        if (value) {
            setIsTwoFactorEnabled(true);
            await SecureStore.setItemAsync('two_factor_enabled', 'true');
            Alert.alert('Two-Factor Authentication', '2FA has been mocked as enabled. In a production app, this would initiate a setup flow.');
        } else {
            setIsTwoFactorEnabled(false);
            await SecureStore.setItemAsync('two_factor_enabled', 'false');
            Alert.alert('Two-Factor Authentication', '2FA has been mocked as disabled.');
        }
    };

    const onChangePassword = () => {
        // Navigate to a change password screen or show a modal
        Alert.alert('Change Password', 'This would open the change password flow.');
    };

    const onLogout = () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await logout();
                            router.replace('/login');
                        } catch (error) {
                            console.error('Logout error:', error);
                            // Still navigate to login even if logout request fails
                            router.replace('/login');
                        }
                    },
                },
            ]
        );
    };

    const getBackgroundColor = () => (isDark ? '#121212' : '#F8F9FB');
    const getCardColor = () => (isDark ? '#1E1E1E' : '#FFFFFF');
    const getTextColor = () => (isDark ? '#FFFFFF' : '#1A202C');
    const getSubTextColor = () => (isDark ? '#A0AEC0' : '#4A5568');
    const getBorderColor = () => (isDark ? '#2D3748' : '#E2E8F0');

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: getBackgroundColor() }]} edges={['top']}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: getTextColor() }]}>Settings</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Security Section */}
                <Text style={[styles.sectionTitle, { color: getSubTextColor() }]}>Security</Text>

                <View style={[styles.card, { backgroundColor: getCardColor() }]}>

                    {/* Biometrics Toggle */}
                    <View style={[styles.settingRow, { borderBottomColor: getBorderColor(), borderBottomWidth: 1 }]}>
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#2D3748' : '#EBF8FF' }]}>
                                <Ionicons name="finger-print-outline" size={22} color={isDark ? '#90CDF4' : '#173581'} />
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={[styles.settingTitle, { color: getTextColor() }]}>Biometric Login</Text>
                                <Text style={[styles.settingDescription, { color: getSubTextColor() }]}>
                                    {isBiometricSupported
                                        ? 'Use Face ID or Touch ID to log in'
                                        : 'Biometrics not supported on this device'}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            trackColor={{ false: '#CBD5E0', true: '#90CDF4' }}
                            thumbColor={isBiometricEnabled ? '#173581' : '#F7FAFC'}
                            ios_backgroundColor="#CBD5E0"
                            onValueChange={toggleBiometrics}
                            value={isBiometricEnabled}
                            disabled={!isBiometricSupported}
                        />
                    </View>

                    {/* Two-Factor Authentication Toggle */}
                    <View style={[styles.settingRow, { borderBottomColor: getBorderColor(), borderBottomWidth: 1 }]}>
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#2D3748' : '#EBF8FF' }]}>
                                <Ionicons name="shield-checkmark-outline" size={22} color={isDark ? '#90CDF4' : '#173581'} />
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={[styles.settingTitle, { color: getTextColor() }]}>Two-Factor Authentication</Text>
                                <Text style={[styles.settingDescription, { color: getSubTextColor() }]}>
                                    Add an extra layer of security
                                </Text>
                            </View>
                        </View>
                        <Switch
                            trackColor={{ false: '#CBD5E0', true: '#90CDF4' }}
                            thumbColor={isTwoFactorEnabled ? '#173581' : '#F7FAFC'}
                            ios_backgroundColor="#CBD5E0"
                            onValueChange={toggleTwoFactor}
                            value={isTwoFactorEnabled}
                        />
                    </View>

                    {/* Change Password Button */}
                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={onChangePassword}
                    >
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#2D3748' : '#EBF8FF' }]}>
                                <Ionicons name="key-outline" size={22} color={isDark ? '#90CDF4' : '#173581'} />
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={[styles.settingTitle, { color: getTextColor() }]}>Change Password</Text>
                                <Text style={[styles.settingDescription, { color: getSubTextColor() }]}>
                                    Update your account password
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={getSubTextColor()} />
                    </TouchableOpacity>

                </View>

                {/* Appearance Section */}
                <Text style={[styles.sectionTitle, { color: getSubTextColor(), marginTop: 32 }]}>Appearance</Text>

                <View style={[styles.card, { backgroundColor: getCardColor() }]}>
                    <View style={styles.themeSelectorContainer}>
                        {(['system', 'light', 'dark'] as const).map((mode) => (
                            <TouchableOpacity
                                key={mode}
                                style={[
                                    styles.themeOption,
                                    themeMode === mode && [styles.themeOptionSelected, { borderColor: isDark ? '#90CDF4' : '#173581', backgroundColor: isDark ? '#2D3748' : '#EBF8FF' }]
                                ]}
                                onPress={() => setThemeMode(mode)}
                            >
                                <Ionicons
                                    name={mode === 'system' ? 'phone-portrait-outline' : mode === 'light' ? 'sunny-outline' : 'moon-outline'}
                                    size={24}
                                    color={themeMode === mode ? (isDark ? '#90CDF4' : '#173581') : getSubTextColor()}
                                />
                                <Text style={[
                                    styles.themeOptionText,
                                    { color: themeMode === mode ? (isDark ? '#90CDF4' : '#173581') : getSubTextColor() },
                                    themeMode === mode && { fontWeight: 'bold' }
                                ]}>
                                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Other Settings (Placeholder for future) */}
                <Text style={[styles.sectionTitle, { color: getSubTextColor(), marginTop: 24 }]}>Preferences</Text>
                <View style={[styles.card, { backgroundColor: getCardColor() }]}>
                    <TouchableOpacity style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#2D3748' : '#EBF8FF' }]}>
                                <Ionicons name="notifications-outline" size={22} color={isDark ? '#90CDF4' : '#173581'} />
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={[styles.settingTitle, { color: getTextColor() }]}>Notifications</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={getSubTextColor()} />
                    </TouchableOpacity>
                </View>

                {/* Account Section */}
                <Text style={[styles.sectionTitle, { color: getSubTextColor(), marginTop: 24 }]}>Account</Text>
                <View style={[styles.card, { backgroundColor: getCardColor() }]}>
                    <TouchableOpacity
                        style={styles.settingRow}
                        onPress={onLogout}
                    >
                        <View style={styles.settingInfo}>
                            <View style={[styles.iconContainer, { backgroundColor: isDark ? '#4A1C1C' : '#FFF5F5' }]}>
                                <Ionicons name="log-out-outline" size={22} color={isDark ? '#FC8181' : '#E53E3E'} />
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={[styles.settingTitle, { color: isDark ? '#FC8181' : '#E53E3E' }]}>Log Out</Text>
                                <Text style={[styles.settingDescription, { color: getSubTextColor() }]}>
                                    Sign out of your account
                                </Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={isDark ? '#FC8181' : '#E53E3E'} />
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 0,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 10,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
        marginLeft: 4,
    },
    card: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
        paddingRight: 16,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 13,
    },
    themeSelectorContainer: {
        flexDirection: 'row',
        padding: 16,
        justifyContent: 'space-between',
    },
    themeOption: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'transparent',
        marginHorizontal: 4,
    },
    themeOptionSelected: {
        borderWidth: 1,
    },
    themeOptionText: {
        marginTop: 8,
        fontSize: 14,
    },
});
