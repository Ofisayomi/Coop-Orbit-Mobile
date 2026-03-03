import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme as useNativeColorScheme } from 'react-native';

type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
    themeMode: ThemeMode;
    colorScheme: 'light' | 'dark';
    setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
    const nativeColorScheme = useNativeColorScheme() ?? 'light';
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const storedTheme = await SecureStore.getItemAsync('theme_preference');
            if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
                setThemeModeState(storedTheme as ThemeMode);
            }
        } catch (error) {
            console.error('Failed to load theme preference:', error);
        } finally {
            setIsLoaded(true);
        }
    };

    const setThemeMode = async (mode: ThemeMode) => {
        try {
            setThemeModeState(mode);
            await SecureStore.setItemAsync('theme_preference', mode);
        } catch (error) {
            console.error('Failed to save theme preference:', error);
        }
    };

    // Determine actual color scheme to use
    const colorScheme = themeMode === 'system' ? nativeColorScheme : themeMode;

    if (!isLoaded) {
        return null; // Or a loading spinner, but null is fine for context initialize
    }

    return (
        <ThemeContext.Provider value={{ themeMode, colorScheme, setThemeMode }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useAppTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useAppTheme must be used within an AppThemeProvider');
    }
    return context;
}
