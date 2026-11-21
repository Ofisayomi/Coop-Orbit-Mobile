import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getSecureFileUri } from '@/services/secure-file';

interface MemberAvatarProps {
  profilePictureUrl?: string | null;
  displayName: string;
  size?: number;
  backgroundColor?: string;
}

/**
 * Member list avatar. Members with an uploaded profile photo show the photo;
 * everyone else (and while the photo loads or fails) keeps the initial-letter
 * circle. Photos come from an authorized endpoint, so they are resolved
 * through the cached secure-file download — never handed to <Image> raw.
 */
export default function MemberAvatar({
  profilePictureUrl,
  displayName,
  size = 38,
  backgroundColor = '#173581',
}: MemberAvatarProps) {
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!profilePictureUrl) {
      setPhotoUri(null);
      return;
    }
    void getSecureFileUri(profilePictureUrl)
      .then((uri) => {
        if (!cancelled) setPhotoUri(uri);
      })
      .catch(() => {
        if (!cancelled) setPhotoUri(null);
      });
    return () => {
      cancelled = true;
    };
  }, [profilePictureUrl]);

  const radius = size / 2;

  if (photoUri) {
    return (
      <Image
        source={{ uri: photoUri }}
        style={[styles.photo, { width: size, height: size, borderRadius: radius }]}
        contentFit="cover"
      />
    );
  }

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: radius, backgroundColor }]}>
      <Text style={[styles.fallbackText, { fontSize: size * 0.42 }]}>
        {(displayName.charAt(0) || '?').toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    backgroundColor: '#E2E8F0',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
