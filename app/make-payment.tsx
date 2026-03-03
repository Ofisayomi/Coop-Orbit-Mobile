import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
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

interface Account {
    id: string;
    label: string;
    minVal?: string;
    outVal?: string;
    color: string;
    icon: string;
}

const ACCOUNTS: Account[] = [
    { id: '1', label: 'Cooperative Savings', minVal: '₦5,000', color: '#EBF8FF', icon: 'wallet' },
    { id: '2', label: 'Loan Repayment', outVal: '₦120,000', color: '#FED7D7', icon: 'document-text' },
    { id: '3', label: 'Shares / Contributions', color: '#E9D8FD', icon: 'pie-chart' },
];

export default function SplitPaymentScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    // Mocked admin toggle logic
    const [isAdmin, setIsAdmin] = useState(true);

    // Form State
    const [paymentTarget, setPaymentTarget] = useState<'myself' | 'member'>('myself');
    const [memberSearch, setMemberSearch] = useState('');
    const [totalTransferStr, setTotalTransferStr] = useState('');

    // Allocation splits: map account ID -> number value
    const [allocations, setAllocations] = useState<Record<string, string>>({});

    // File attachments
    const [attachedFiles, setAttachedFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);

    // Derived calculations
    const totalTransfer = parseFloat(totalTransferStr.replace(/,/g, '')) || 0;
    const totalAllocated: number = Object.values<string>(allocations).reduce((acc: number, val: string) => {
        const num = parseFloat(val.replace(/,/g, '')) || 0;
        return acc + num;
    }, 0);

    const remaining = Math.max(0, totalTransfer - totalAllocated);
    const isBalanced = totalTransfer > 0 && totalTransfer === totalAllocated;
    const allocationPercent = totalTransfer > 0 ? Math.min(100, (totalAllocated / totalTransfer) * 100) : 0;

    const handleDocumentPick = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/jpeg', 'image/png', 'application/pdf'],
                copyToCacheDirectory: false,
                multiple: true,
            });

            if (!result.canceled && result.assets) {
                setAttachedFiles((prev: DocumentPicker.DocumentPickerAsset[]) => [...prev, ...result.assets]);
            }
        } catch (err) {
            console.warn('Error picking document:', err);
            Alert.alert('Error', 'Could not pick document');
        }
    };

    const removeFile = (uri: string) => {
        setAttachedFiles((prev: DocumentPicker.DocumentPickerAsset[]) => prev.filter((f: DocumentPicker.DocumentPickerAsset) => f.uri !== uri));
    };

    const handleAllocationChange = (id: string, value: string) => {
        // Only allow numbers
        const formatted = value.replace(/[^0-9]/g, '');
        setAllocations((prev: Record<string, string>) => ({
            ...prev,
            [id]: formatted,
        }));
    };

    const submitPayment = () => {
        if (!isBalanced) return;
        Alert.alert('Success', 'Split payment submitted successfully!');
        router.back();
    };

    // Theming Helpers
    const bg = isDark ? '#121212' : '#F8F9FB';
    const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
    const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
    const textSecondary = isDark ? '#A0AEC0' : '#4A5568';
    const borderColor = isDark ? '#2D3748' : '#E2E8F0';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    {/* <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={textSecondary} />
                        <Text style={[styles.backText, { color: textSecondary }]}>Back to Transfers</Text>
                    </TouchableOpacity> */}
                    <Text style={[styles.title, { color: textPrimary }]}>New Split Payment</Text>
                    <Text style={[styles.subtitle, { color: textSecondary }]}>
                        Distribute a single transfer across savings, loans, and contributions.
                    </Text>
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    <View style={[styles.card, { backgroundColor: cardBg }]}>
                        {/* Beneficiary Selection (Admin Only) */}
                        {isAdmin && (
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>PAYMENT BENEFICIARY</Text>
                                <View style={styles.toggleRow}>
                                    <TouchableOpacity
                                        style={[
                                            styles.toggleOption,
                                            { borderColor: paymentTarget === 'myself' ? '#48BB78' : borderColor },
                                            paymentTarget === 'myself' && { backgroundColor: isDark ? '#22543D' : '#F0FFF4' }
                                        ]}
                                        onPress={() => setPaymentTarget('myself')}
                                    >
                                        <View style={[styles.radio, paymentTarget === 'myself' && styles.radioActive]} />
                                        <View>
                                            <Text style={[styles.toggleTitle, { color: textPrimary }]}>Pay for Myself</Text>
                                            <Text style={[styles.toggleSub, { color: textSecondary }]}>Amara Okeke (Admin)</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.toggleOption,
                                            { borderColor: paymentTarget === 'member' ? '#48BB78' : borderColor },
                                            paymentTarget === 'member' && { backgroundColor: isDark ? '#22543D' : '#F0FFF4' }
                                        ]}
                                        onPress={() => setPaymentTarget('member')}
                                    >
                                        <View style={[styles.radio, paymentTarget === 'member' && styles.radioActive]} />
                                        <View>
                                            <Text style={[styles.toggleTitle, { color: textPrimary }]}>Pay for a Member</Text>
                                            <Text style={[styles.toggleSub, { color: textSecondary }]}>Search database</Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                {paymentTarget === 'member' && (
                                    <View style={styles.searchContainer}>
                                        <Text style={[styles.inputLabel, { color: textSecondary }]}>Select Member Account</Text>
                                        <View style={[styles.searchBox, { borderColor }]}>
                                            <Ionicons name="search" size={20} color={textSecondary} style={{ marginRight: 8 }} />
                                            <TextInput
                                                style={[styles.searchInput, { color: textPrimary }]}
                                                placeholder="Search by name, email or ID..."
                                                placeholderTextColor={textSecondary}
                                                value={memberSearch}
                                                onChangeText={setMemberSearch}
                                            />
                                            <Ionicons name="chevron-down" size={20} color={textSecondary} />
                                        </View>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Total Transfer Amount */}
                        <View style={[styles.section, { borderTopWidth: isAdmin ? 1 : 0, borderColor, paddingTop: isAdmin ? 24 : 0 }]}>
                            <Text style={styles.sectionLabelCenter}>TOTAL BANK TRANSFER AMOUNT</Text>
                            <View style={styles.amountInputRow}>
                                <Text style={styles.currencySymbol}>₦</Text>
                                <TextInput
                                    style={[styles.hugeInput, { color: textPrimary }]}
                                    placeholder="0"
                                    placeholderTextColor={textSecondary}
                                    keyboardType="numeric"
                                    value={totalTransferStr}
                                    onChangeText={(val: string) => {
                                        const formatted = val.replace(/[^0-9]/g, '');
                                        setTotalTransferStr(formatted);
                                    }}
                                />
                            </View>
                            {isBalanced ? (
                                <View style={styles.balancedBadge}>
                                    <Ionicons name="checkmark-circle" size={16} color="#48BB78" />
                                    <Text style={styles.balancedText}>Amount Validated</Text>
                                </View>
                            ) : (
                                <View style={styles.amountDivider} />
                            )}
                        </View>

                        {/* Allocation Progress */}
                        <View style={[styles.progressSection, { borderTopWidth: 1, borderColor, backgroundColor: isDark ? '#1A1A2E' : '#F7FAFC' }]}>
                            <View style={styles.progressHeader}>
                                <Text style={[styles.progressTitle, { color: textPrimary }]}>Allocation Progress</Text>
                                <Text style={[styles.progressAmounts, { color: textSecondary }]}>
                                    <Text style={{ fontWeight: 'bold', color: textPrimary }}>₦{totalAllocated.toLocaleString()}</Text> allocated of ₦{totalTransfer.toLocaleString()}
                                </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${allocationPercent}%`, backgroundColor: isBalanced ? '#48BB78' : '#3182CE' }]} />
                            </View>
                            {totalTransfer > 0 && !isBalanced && (
                                <Text style={styles.remainingText}>₦{remaining.toLocaleString()} Remaining</Text>
                            )}
                        </View>

                        {/* Account Allocations */}
                        <View style={styles.allocationList}>
                            {ACCOUNTS.map((account) => (
                                <View key={account.id} style={[styles.accountSplitCard, { borderColor }]}>
                                    <View style={styles.splitInfo}>
                                        <View style={[styles.splitIcon, { backgroundColor: account.color }]}>
                                            <Ionicons name={account.icon as any} size={20} color="#1A202C" />
                                        </View>
                                        <View>
                                            <Text style={[styles.splitLabel, { color: textPrimary }]}>{account.label}</Text>
                                            {account.minVal && <Text style={[styles.splitSub, { color: textSecondary }]}>Min. contribution: {account.minVal}</Text>}
                                            {account.outVal && <Text style={[styles.splitSub, { color: textSecondary }]}>Outstanding: <Text style={{ color: '#E53E3E' }}>{account.outVal}</Text></Text>}
                                        </View>
                                    </View>

                                    <View style={[styles.inputContainer, { borderColor }]}>
                                        <Text style={styles.inputCurrency}>₦</Text>
                                        <TextInput
                                            style={[styles.splitInput, { color: textPrimary }]}
                                            placeholder="0"
                                            placeholderTextColor={textSecondary}
                                            keyboardType="numeric"
                                            value={allocations[account.id] || ''}
                                            onChangeText={(val: string) => handleAllocationChange(account.id, val)}
                                        />
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* File Uploads */}
                        <View style={styles.uploadSection}>
                            <Text style={[styles.inputLabel, { color: textSecondary }]}>Transaction Receipt (Optional)</Text>

                            {attachedFiles.length > 0 && (
                                <View style={styles.attachmentsList}>
                                    {attachedFiles.map((file: DocumentPicker.DocumentPickerAsset, idx: number) => (
                                        <View key={idx} style={[styles.attachmentBadge, { borderColor, backgroundColor: isDark ? '#2D3748' : '#F7FAFC' }]}>
                                            <Ionicons name="document" size={16} color={textSecondary} />
                                            <Text style={[styles.attachmentName, { color: textPrimary }]} numberOfLines={1}>{file.name}</Text>
                                            <TouchableOpacity onPress={() => removeFile(file.uri)}>
                                                <Ionicons name="close-circle" size={20} color="#E53E3E" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <TouchableOpacity style={[styles.uploadButton, { borderColor }]} onPress={handleDocumentPick}>
                                <Ionicons name="cloud-upload-outline" size={24} color="#3182CE" />
                                <Text style={styles.uploadText}>Select PDF or Image</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={[
                                styles.submitButton,
                                isBalanced && totalTransfer > 0 ? styles.submitActive : styles.submitDisabled
                            ]}
                            disabled={!isBalanced || totalTransfer <= 0}
                            onPress={submitPayment}
                        >
                            <Text style={styles.submitButtonText}>Complete Allocation</Text>
                        </TouchableOpacity>

                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 0,
        paddingBottom: 20,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    backText: {
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 4,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    card: {
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    section: {
        padding: 24,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#718096',
        marginBottom: 16,
        letterSpacing: 0.5,
    },
    sectionLabelCenter: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#718096',
        letterSpacing: 0.5,
        textAlign: 'center',
        marginBottom: 16,
    },
    toggleRow: {
        flexDirection: 'row',
        gap: 12,
    },
    toggleOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#CBD5E0',
        marginRight: 10,
        marginTop: 2,
    },
    radioActive: {
        borderColor: '#48BB78',
        backgroundColor: '#48BB78',
        borderWidth: 5,
    },
    toggleTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    toggleSub: {
        fontSize: 12,
    },
    searchContainer: {
        marginTop: 20,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 8,
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 48,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
    },
    amountInputRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    currencySymbol: {
        fontSize: 28,
        color: '#A0AEC0',
        fontWeight: '300',
        marginRight: 8,
    },
    hugeInput: {
        fontSize: 48,
        fontWeight: 'bold',
        minWidth: 100,
        textAlign: 'center',
    },
    amountDivider: {
        height: 2,
        backgroundColor: '#E2E8F0',
        marginTop: 10,
        marginHorizontal: 40,
    },
    balancedBadge: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
    },
    balancedText: {
        color: '#48BB78',
        fontWeight: '600',
        fontSize: 12,
        marginLeft: 6,
    },
    progressSection: {
        padding: 24,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    progressTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    progressAmounts: {
        fontSize: 12,
    },
    progressBarBg: {
        height: 12,
        backgroundColor: '#E2E8F0',
        borderRadius: 6,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 6,
    },
    remainingText: {
        color: '#DD6B20',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'right',
        marginTop: 8,
    },
    allocationList: {
        padding: 24,
        gap: 16,
    },
    accountSplitCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderRadius: 12,
        padding: 16,
    },
    splitInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    splitIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    splitLabel: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    splitSub: {
        fontSize: 11,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        width: 120,
        height: 44,
    },
    inputCurrency: {
        fontSize: 14,
        color: '#A0AEC0',
        marginRight: 4,
    },
    splitInput: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'right',
    },
    uploadSection: {
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    uploadButton: {
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 12,
        padding: 16,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
    },
    uploadText: {
        color: '#3182CE',
        marginLeft: 8,
        fontWeight: '500',
    },
    attachmentsList: {
        gap: 8,
        marginBottom: 12,
    },
    attachmentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        borderWidth: 1,
        borderRadius: 8,
    },
    attachmentName: {
        flex: 1,
        fontSize: 13,
        marginHorizontal: 8,
    },
    submitButton: {
        margin: 24,
        marginTop: 0,
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    submitActive: {
        backgroundColor: '#173581',
    },
    submitDisabled: {
        backgroundColor: '#A0AEC0',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
