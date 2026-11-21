import { useMemo } from 'react';

import { getAppPalette, makeCommonStyles } from '@/constants/app-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Central styling entry point for screens. Returns the active palette
 * plus the shared control styles built from it, so screens never
 * hard-code light/dark hex values themselves.
 */
export function useAppPalette() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return useMemo(() => {
    const colors = getAppPalette(isDark ? 'dark' : 'light');
    return { isDark, colors, common: makeCommonStyles(colors) };
  }, [isDark]);
}
