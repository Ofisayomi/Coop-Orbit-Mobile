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
 * This component simply shows a loading indicator while the redirect
 * is being processed by the Linking listener in login.tsx.
 */
export default function OAuthRedirect() {
    const router = useRouter();

    React.useEffect(() => {
        const timer = setTimeout(() => {
            // After a brief delay, if we are still on this page, 
            // go back to login which will process the tokens
            router.replace('/login');
        }, 1000);

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
            <ActivityIndicator size="large" color="#173581" />
        </View>
    );
}
