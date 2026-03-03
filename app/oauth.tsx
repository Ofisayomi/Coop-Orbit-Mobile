import { useRouter } from 'expo-router';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

/**
 * OAuth Redirect Handler
 * 
 * This page handles the OAuth callback redirect from Keycloak.
 * When the user completes authentication (including 2FA if enabled),
 * Keycloak redirects back to the app using the deep link scheme.
 * 
 * The expo-auth-session library intercepts this redirect and updates
 * the response state in the login screen's useAuthRequest hook.
 * This component simply shows a loading indicator while the redirect
 * is being processed.
 */
export default function OAuthRedirect() {
    const router = useRouter();

    // Automatically redirect back to home after a brief delay
    // to ensure the deep link has been fully processed
    React.useEffect(() => {
        const timer = setTimeout(() => {
            // useAuthRequest in login.tsx will handle the token exchange
            // Just navigate away from this page
            router.replace('/login');
        }, 500);

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#173581" />
        </View>
    );
}
