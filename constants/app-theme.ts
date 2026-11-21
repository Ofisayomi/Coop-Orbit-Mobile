import { StyleSheet } from 'react-native';

/**
 * Single source of truth for app styling. Screens must take their colors from
 * `useAppPalette()` (which picks one of the palettes below) instead of
 * hard-coding per-component light/dark hex values.
 *
 * Brand anchors: primary navy `#173581` on light surfaces, sky `#90CDF4`
 * on dark surfaces (navy-on-dark fails contrast).
 */

export interface AppPalette {
  /** Screen background */
  bg: string;
  /** Cards, sheets, raised surfaces */
  card: string;
  /** Primary text */
  text: string;
  /** Secondary / helper text */
  muted: string;
  /** Text input + filled control background */
  input: string;
  /** Borders and dividers */
  border: string;
  /** Brand accent for text, icons, and filled buttons */
  primary: string;
  /** Low-emphasis tint behind primary icons/buttons */
  primarySoft: string;
  /** White text placed on primary fills */
  onPrimary: string;
  danger: string;
  warning: string;
  success: string;
}

const lightPalette: AppPalette = {
  bg: '#F8F9FB',
  card: '#FFFFFF',
  text: '#1A202C',
  muted: '#718096',
  input: '#F7FAFC',
  border: '#E2E8F0',
  primary: '#173581',
  primarySoft: '#EAF1FD',
  onPrimary: '#FFFFFF',
  danger: '#E53E3E',
  warning: '#D69E2E',
  success: '#38A169',
};

const darkPalette: AppPalette = {
  bg: '#121212',
  card: '#1E1E1E',
  text: '#FFFFFF',
  muted: '#A0AEC0',
  input: '#2D3748',
  border: '#2D3748',
  primary: '#90CDF4',
  primarySoft: '#24344D',
  onPrimary: '#0A1C33',
  danger: '#FC8181',
  warning: '#ECC94B',
  success: '#68D391',
};

export function getAppPalette(colorScheme: 'light' | 'dark'): AppPalette {
  return colorScheme === 'dark' ? darkPalette : lightPalette;
}

/**
 * Shared building blocks so repeated controls look identical on every
 * screen: numbered section badges, dashed upload buttons, outline (remind)
 * buttons, and primary filled buttons. Screens keep their own StyleSheet
 * only for layout unique to that screen.
 */
export function makeCommonStyles(p: AppPalette) {
  return StyleSheet.create({
    /** Numbered circle that prefixes form sections. Pair with `sectionBadgeText`. */
    sectionBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: p.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    sectionBadgeText: {
      color: p.onPrimary,
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
    /** Dashed file/receipt/photo picker. Text + icon use `p.primary`. */
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: p.primary,
      backgroundColor: p.primarySoft,
      borderRadius: 8,
      paddingVertical: 14,
      paddingHorizontal: 12,
      gap: 8,
    },
    uploadButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: p.primary,
    },
    /** Low-emphasis outline action (e.g. Remind). Text + icon use `p.primary`. */
    outlineButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: p.primary,
      backgroundColor: p.primarySoft,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      gap: 4,
    },
    outlineButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: p.primary,
    },
    /** Filled primary call-to-action. Text uses `p.onPrimary`. */
    primaryButton: {
      backgroundColor: p.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: p.onPrimary,
      fontSize: 15,
      fontWeight: '700',
    },
  });
}
