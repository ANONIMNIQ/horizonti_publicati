import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { useRssFeed } from '@/hooks/useRssFeed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import ResponsiveArticleList from '@/components/ResponsiveArticleList';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { DESKTOP_CONTENT_MAX_CONTAINER_WIDTH } from '@/constants/Layout';
import { BlurView } from 'expo-blur';

function FeedHeaderContent() {
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
        <View style={styles.titleAndLogoContainer}>
          <Text
            style={[styles.headerTitle, { color: Colors[colorScheme].text }]}
          >
            Публикации
          </Text>
        </View>
        <Text
          style={[
            styles.headerSubtitle,
            { color: Colors[colorScheme].text, opacity: 0.7 },
          ]}
        >
          Последни публикации в Хоризонти
        </Text>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { articles, loading, error } = useRssFeed();
  const { isDesktopWeb } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const headerHeight = isDesktopWeb ? 90 : 80;
  const totalHeaderHeight =
    Platform.OS === 'web' ? headerHeight : headerHeight + insets.top;

  // Calculate dynamic position for the floating text
  const floatingTextPosition = useMemo(() => {
    if (isDesktopWeb) {
      const containerWidth = Math.min(
        windowWidth,
        DESKTOP_CONTENT_MAX_CONTAINER_WIDTH
      );
      const leftOffset = (windowWidth - containerWidth) / 2;

      // The text is rotated -90deg with transform-origin: bottom left.
      // The rightmost x-coordinate of the rotated element will be at the `left` position.
      // To make it flush with the container, we set `left` to be the container's left offset.
      const finalLeft = leftOffset;

      // Position it at the very bottom of the screen.
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
      {/* Fixed Header */}
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
            <FeedHeaderContent />
          </View>
        </View>
      </View>

      {/* Scrollable Content */}
      <View
        style={[
          styles.contentWrapper,
          isDesktopWeb && styles.desktopContentWrapper,
          isDesktopWeb && {
            borderLeftWidth: 1,
            borderLeftColor: Colors[colorScheme].cardBorder,
          },
        ]}
      >
        <ResponsiveArticleList
          articles={articles}
          loading={loading}
          error={error}
          contentTopPadding={totalHeaderHeight}
          contentContainerStyle={
            isDesktopWeb ? { paddingHorizontal: 2 } : undefined
          }
        />
      </View>

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

      {Platform.OS === 'web' && (
        <View style={isDesktopWeb && styles.desktopPWAInstallPromptWrapper}>
          <PWAInstallPrompt />
        </View>
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
  contentWrapper: {
    flex: 1,
  },
  desktopContentWrapper: {
    maxWidth: DESKTOP_CONTENT_MAX_CONTAINER_WIDTH,
    alignSelf: 'center',
    width: '100%',
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
  titleAndLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 16,
  },
  desktopPWAInstallPromptWrapper: {
    maxWidth: DESKTOP_CONTENT_MAX_CONTAINER_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 16,
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
