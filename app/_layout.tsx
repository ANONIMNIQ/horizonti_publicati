import { useEffect, useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useColorScheme, View, Text, Platform } from 'react-native';
import { Colors } from '@/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const [appReady, setAppReady] = useState(false);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  // This hook signals to WebContainer when the framework is ready.
  useFrameworkReady();

  useEffect(() => {
    // Start animation immediately
    opacity.value = withTiming(1, { duration: 1000 });
    scale.value = withTiming(1, { duration: 1000 }, (finished) => {
      if (finished) {
        // After animation completes, set appReady to true
        runOnJS(setAppReady)(true);
      }
    });
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  // This callback is called when the main app content view is laid out.
  // We hide the splash screen here once the app is ready.
  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  // Effect to apply dark mode class to body for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (colorScheme === 'dark') {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
    }
  }, [colorScheme]);

  if (!appReady) {
    // Show splash screen until animation is complete
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#000000', // Always black background as per image
        }}
      >
        <Animated.Text
          style={[
            {
              fontSize: 48,
              fontWeight: '900', // Use font weight instead of custom font family
              color: '#4a4a4a', // Dark gray from image
            },
            animatedStyle,
          ]}
        >
          ХОРИЗОНТИ
        </Animated.Text>
      </View>
    );
  }

  // Once appReady is true, render the main app content
  return (
    <View
      style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}
      onLayout={onLayoutRootView} // Call onLayoutRootView here
    >
      <LinearGradient
        colors={
          colorScheme === 'dark'
            ? ['#1a1a1a', '#000000']
            : ['#ffffff', '#e0e5ec']
        }
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <Stack
        screenOptions={{
          headerTransparent: true,
          headerBlurEffect: colorScheme === 'dark' ? 'dark' : 'light',
          headerTintColor: Colors[colorScheme].text,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerStyle: {
            backgroundColor: 'rgba(255,255,255,0.1)',
          },
          // Fix: Remove default top padding for web
          contentStyle: Platform.OS === 'web' ? { paddingTop: 0 } : {},
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="article"
          options={{
            headerShown: false,
            presentation: 'card',
            headerBackTitleVisible: false,
            headerBackTitle: '',
            headerTitle: '',
            cardStyleInterpolator: ({ current, layouts }) => {
              return {
                cardStyle: {
                  transform: [
                    {
                      translateX: current.progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [layouts.screen.width, 0],
                      }),
                    },
                  ],
                },
              };
            },
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}
