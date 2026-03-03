import { Redirect } from 'expo-router';
import React from 'react';

/**
 * App Entry Point
 * 
 * Always redirects to the Login screen first to ensure secure access.
 * Authentication checks (including biometric login options) are handled
 * within the Login screen.
 */
export default function Index() {
  return <Redirect href="/login" />;
}
