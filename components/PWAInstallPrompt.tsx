import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Platform, Image } from 'react-native';
import { Colors } from '@/constants/Colors';
import { X } from 'lucide-react-native';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallPrompt() {
  const colorScheme = useColorScheme() ?? 'light';
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false); // Controls visibility of the *standard* prompt
  const [showIOSInstructions, setShowIOSInstructions] = useState(false); // Controls visibility of iOS instructions
  const hasPromptedStandard = useRef(false); // To prevent showing the standard prompt multiple times

  useEffect(() => {
    if (Platform.OS !== 'web') return; // Only run on web

    const isIOSDeviceOnWeb = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const hasDismissedIOSInstructions = localStorage.getItem('pwa_ios_dismissed') === 'true';

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true); // Show standard prompt
      setShowIOSInstructions(false); // Hide iOS instructions if standard prompt is available
      return false;
    };

    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      setShowIOSInstructions(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Logic for iOS instructions:
    // If it's an iOS device on web, and the standard prompt hasn't fired/isn't supported,
    // and the user hasn't dismissed the iOS instructions before.
    // We use a timeout to give `beforeinstallprompt` a chance to fire first.
    const timeoutId = setTimeout(() => {
      if (!deferredPrompt && isIOSDeviceOnWeb && !hasDismissedIOSInstructions) {
        setShowIOSInstructions(true);
      }
    }, 500); // Small delay to allow beforeinstallprompt to fire

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timeoutId);
    };
  }, []); // Empty dependency array means this runs once on mount

  const handleDismiss = () => {
    if (showPrompt) {
      setShowPrompt(false);
      // For standard prompt, we don't persist dismissal unless user explicitly says no
      // The browser handles re-prompting based on its own heuristics.
    } else if (showIOSInstructions) {
      setShowIOSInstructions(false);
      localStorage.setItem('pwa_ios_dismissed', 'true'); // Persist dismissal for iOS instructions
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt && !hasPromptedStandard.current) {
      deferredPrompt.prompt();
      hasPromptedStandard.current = true; // Mark that prompt has been shown
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the PWA installation prompt');
      } else {
        console.log('User dismissed the PWA installation prompt');
      }
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  if (!showPrompt && !showIOSInstructions) {
    return null;
  }

  // Render different content based on whether it's iOS instructions or standard prompt
  if (showIOSInstructions) {
    return (
      <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
            Install App
          </Text>
          <Text style={[styles.description, { color: Colors[colorScheme].text, opacity: 0.8 }]}>
            To install this app on your iPhone/iPad:
            {'\n'}1. Tap the <Text style={{ fontWeight: 'bold' }}>Share</Text> icon (<Image source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Share_iOS_13.svg/1200px-Share_iOS_13.svg.png' }} style={styles.shareIcon} />) at the bottom of your browser.
            {'\n'}2. Select "<Text style={{ fontWeight: 'bold' }}>Add to Home Screen</Text>".
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
          <X size={20} color={Colors[colorScheme].text} />
        </TouchableOpacity>
      </View>
    );
  }

  // Standard prompt for browsers that support beforeinstallprompt
  return (
    <View style={[styles.container, { backgroundColor: Colors[colorScheme].cardBackground }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: Colors[colorScheme].text }]}>
          Install App
        </Text>
        <Text style={[styles.description, { color: Colors[colorScheme].text, opacity: 0.8 }]}>
          Add this app to your home screen for quick access and an enhanced experience.
        </Text>
        <TouchableOpacity
          style={[styles.installButton, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={handleInstallClick}
        >
          <Text style={styles.installButtonText}>Install</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={handleDismiss}>
        <X size={20} color={Colors[colorScheme].text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  content: {
    flex: 1,
    marginRight: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
  },
  installButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignSelf: 'flex-start',
  },
  installButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeButton: {
    padding: 8,
  },
  shareIcon: {
    width: 16,
    height: 16,
  }
});
