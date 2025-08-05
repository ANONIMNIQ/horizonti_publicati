import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useColorScheme,
  TextInput,
  Pressable,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Colors } from '@/constants/Colors';
import { Search } from 'lucide-react-native';
import { useRssFeed } from '@/hooks/useRssFeed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ResponsiveArticleList from '@/components/ResponsiveArticleList';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  DESKTOP_CONTENT_MAX_CONTAINER_WIDTH,
  DISCOVER_HEADER_HEIGHT_DESKTOP,
  DISCOVER_HEADER_HEIGHT_MOBILE,
} from '@/constants/Layout';
import { BlurView } from 'expo-blur';

type FilterTag = 'Всички' | 'Новини' | 'Подкаст';

function DiscoverHeaderContent({
  searchQuery,
  setSearchQuery,
  activeFilter,
  setActiveFilter,
}: {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeFilter: FilterTag;
  setActiveFilter: (tag: FilterTag) => void;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const { isDesktopWeb, isMobileWeb, isWeb } = useResponsiveLayout();

  return (
    <View
      style={[
        styles.headerContentInnerWrapper,
        isMobileWeb && styles.mobileWebHeaderContentInnerWrapper, // Apply specific styles for mobile web
        isDesktopWeb && styles.desktopHeaderContentInnerWrapper,
      ]}
    >
      <View
        style={[
          styles.headerContainer,
          isWeb && { marginBottom: 20 }, // Add space between subtitle and search box for web
        ]}
      >
        <View style={styles.titleAndLogoContainer}>
          <Text
            style={[styles.headerTitle, { color: Colors[colorScheme].text }]}
          >
            Търсене
          </Text>
        </View>
        <Text
          style={[
            styles.headerSubtitle,
            { color: Colors[colorScheme].text, opacity: 0.7 },
          ]}
        >
          Намери публикации в Хоризонти
        </Text>
      </View>

      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: Colors[colorScheme].cardBackground,
            borderColor: Colors[colorScheme].cardBorder,
          },
          isDesktopWeb && { height: 55, marginBottom: 16 },
        ]}
      >
        <Search
          size={20}
          color={Colors[colorScheme].tabIconDefault}
          style={styles.searchIcon}
        />
        <TextInput
          style={[
            styles.searchInput,
            {
              color: Colors[colorScheme].text,
            },
            isDesktopWeb && { fontSize: 17 },
          ]}
          placeholder="Търси публикации..."
          placeholderTextColor={Colors[colorScheme].tabIconDefault}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterContainer}>
        {['Всички', 'Новини', 'Подкаст'].map((tag) => (
          <Pressable
            key={tag}
            onPress={() => setActiveFilter(tag as FilterTag)}
            style={[
              styles.filterButton,
              {
                backgroundColor:
                  activeFilter === tag
                    ? Colors[colorScheme].text
                    : Colors[colorScheme].cardBackground,
                borderColor: Colors[colorScheme].cardBorder,
              },
              isDesktopWeb && {
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 20,
              },
            ]}
          >
            <Text
              style={[
                styles.filterButtonText,
                {
                  color:
                    activeFilter === tag
                      ? Colors[colorScheme].background
                      : Colors[colorScheme].text,
                },
              ]}
            >
              {tag}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function DiscoverScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const { articles, loading, error } = useRssFeed();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterTag>('Всички');
  const { isDesktopWeb } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const headerHeight = isDesktopWeb ? DISCOVER_HEADER_HEIGHT_DESKTOP : DISCOVER_HEADER_HEIGHT_MOBILE;
  const totalHeaderHeight = Platform.OS === 'web' ? headerHeight : headerHeight + insets.top;

  const filteredArticles = useMemo(() => {
    if (!articles) return [];

    let filtered = articles;

    if (searchQuery) {
      const lowerCaseQuery = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (article) =>
          (article.title &&
            article.title.toLowerCase().includes(lowerCaseQuery)) ||
          (article.content &&
            article.content.toLowerCase().includes(lowerCaseQuery))
      );
    }

    if (activeFilter !== 'Всички') {
      const lowerCaseFilter = activeFilter.toLowerCase();
      filtered = filtered.filter((article) => {
        return article.categories.includes(lowerCaseFilter);
      });
    }

    return filtered;
  }, [articles, searchQuery, activeFilter]);

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
            Platform.OS === 'web'
              ? { paddingTop: 0 }
              : { paddingTop: insets.top },
            isDesktopWeb && styles.desktopFixedHeaderContentWrapper,
          ]}
        >
          <DiscoverHeaderContent
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
          />
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
          articles={filteredArticles}
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
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 20,
  },
  mobileWebHeaderContentInnerWrapper: {
    paddingTop: 0,
    paddingBottom: 16,
  },
  desktopHeaderContentInnerWrapper: {
    flex: undefined,
    justifyContent: undefined,
    paddingTop: 16,
    paddingBottom: 16,
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
  searchContainer: {
    height: 48,
    marginBottom: 12,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 10,
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 15,
    fontWeight: '600',
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
