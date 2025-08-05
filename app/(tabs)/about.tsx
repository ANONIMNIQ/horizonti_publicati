import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useRssFeed } from '@/hooks/useRssFeed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { DESKTOP_CONTENT_MAX_CONTAINER_WIDTH } from '@/constants/Layout';
import { BlurView } from 'expo-blur';
import SkeletonText from '@/components/SkeletonText';

function AboutHeaderContent() {
  const colorScheme = useColorScheme() ?? 'light';
  const { isDesktopWeb } = useResponsiveLayout();

  return (
    <View
      style={[
        styles.headerContentInnerWrapper,
        isDesktopWeb && styles.desktopHeaderContentInnerWrapper,
      ]}
    >
      <View style={styles.headerContainer}>
        <Text style={[styles.headerTitle, { color: Colors[colorScheme].text }]} >
          За нас
        </Text>
        <Text
          style={[
            styles.headerSubtitle,
            { color: Colors[colorScheme].text, opacity: 0.7 },
          ]}
        >
          Хоризонти
        </Text>
      </View>
    </View>
  );
}

export default function AboutScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { feed, loading, error } = useRssFeed();
  const { isDesktopWeb } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const headerHeight = isDesktopWeb ? 90 : 80;
  const totalHeaderHeight = Platform.OS === 'web' ? headerHeight : headerHeight + insets.top;

  const renderContent = () => {
    if (loading) {
      return <SkeletonText lines={15} />;
    }

    if (error || !feed) {
      return (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: Colors[colorScheme].text }]} >
            {error ? 'Error loading content.' : 'No information available.'}
          </Text>
        </View>
      );
    }

    return (
      <Text style={[styles.description, { color: Colors[colorScheme].text }]} >
        {feed.description}
      </Text>
    );
  };

  // Calculate dynamic position for the floating text
  const floatingTextPosition = useMemo(() => {
    if (isDesktopWeb) {
      const containerWidth = Math.min(
        windowWidth,
        DESKTOP_CONTENT_MAX_CONTAINER_WIDTH
      );
      const leftOffset = (windowWidth - containerWidth) / 2;

      const finalLeft = leftOffset;
      const finalBottom = 0;

      return { left: finalLeft, bottom: finalBottom };
    }
    return { left: 0, bottom: 0 }; // Default values
  }, [windowWidth, isDesktopWeb]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme].background },
      ]}
    >
      <View
        style={[
          styles.fixedHeader,
          {
            height: totalHeaderHeight,
            backgroundColor: Colors[colorScheme].cardBackground,
          },
        ]}
      >
        <BlurView
          tint={Colors[colorScheme].blurTint}
          intensity={Platform.OS === 'ios' ? 100 : 200}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.headerContentContainer,
            { paddingTop: Platform.OS === 'web' ? 0 : insets.top },
            isDesktopWeb && styles.desktopFixedHeaderContentWrapper,
          ]}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <AboutHeaderContent />
          </View>
        </View>
      </View>

      <ScrollView
        style={[
          styles.scrollView,
          isDesktopWeb && styles.desktopScrollView,
          isDesktopWeb && {
            borderLeftWidth: 1,
            borderLeftColor: Colors[colorScheme].cardBorder,
          },
        ]}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: totalHeaderHeight,
            paddingBottom: insets.bottom + 90,
          },
          isDesktopWeb && { paddingHorizontal: 2 },
        ]}
      >
        {renderContent()}
      </ScrollView>

      {/* Floating Text */}
      {Platform.OS === 'web' && isDesktopWeb && (
        <Text
          style={[
            styles.floatingText,
            {
              left: floatingTextPosition.left,
              bottom: floatingTextPosition.bottom,
              color: Colors[colorScheme].floatingText,
            },
          ]}
        >
          ХОРИЗОНТИ
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
  },
  headerContentContainer: {
    flex: 1,
  },
  desktopFixedHeaderContentWrapper: {
    maxWidth: DESKTOP_CONTENT_MAX_CONTAINER_WIDTH,
    alignSelf: 'center',
    width: '100%',
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  desktopScrollView: {
    maxWidth: DESKTOP_CONTENT_MAX_CONTAINER_WIDTH,
    width: '100%',
    alignSelf: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  headerContentInnerWrapper: {
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  desktopHeaderContentInnerWrapper: {
    paddingHorizontal: 2,
  },
  headerContainer: {},
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  description: {
    fontSize: 17,
    lineHeight: 25,
  },
  centered: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    textAlign: 'center',
    fontSize: 16,
  },
  floatingText: {
    position: 'absolute',
    fontSize: 48,
    fontWeight: '900',
    pointerEvents: 'none',
    zIndex: 100,
    transform: [{ rotate: '-90deg' }],
    // @ts-ignore - transformOrigin is a web-only style property
    transformOrigin: 'bottom left',
  },
});
