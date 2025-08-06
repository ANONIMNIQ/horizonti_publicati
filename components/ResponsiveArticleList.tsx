import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  useColorScheme,
  StyleProp,
  ViewStyle,
  Pressable,
} from 'react-native';
import { Article } from '@/types';
import { Colors } from '@/constants/Colors';
import ArticleCard from '@/components/ArticleCard';
import DesktopArticleCard from '@/components/DesktopArticleCard';
import SkeletonArticleCard from '@/components/SkeletonArticleCard';
import SkeletonDesktopArticleCard from '@/components/SkeletonDesktopArticleCard';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

interface ResponsiveArticleListProps {
  articles: Article[];
  loading: boolean;
  error: Error | null;
  contentTopPadding?: number; // New prop for top padding
  contentContainerStyle?: StyleProp<ViewStyle>;
}

const NUM_COLUMNS_DESKTOP = 4;
const DESKTOP_GUTTER_HALF = 8;
const INITIAL_DISPLAY_COUNT = 8; // Show first 8 articles
const NEXT_LOAD_COUNT = 2; // Load 2 more articles to reach 10

// Define a type for items in the FlatList, including a special button item
type ListItem = Article | { id: string; type: 'allArticlesButton'; span: number; };

export default function ResponsiveArticleList({
  articles,
  loading,
  error,
  contentTopPadding = 0,
  contentContainerStyle,
}: ResponsiveArticleListProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const { isDesktopWeb } = useResponsiveLayout();
  const numColumns = isDesktopWeb ? NUM_COLUMNS_DESKTOP : 1;

  const [visibleArticleCount, setVisibleArticleCount] = useState(INITIAL_DISPLAY_COUNT);

  const loadMoreArticles = useCallback(() => {
    // Load the next batch of articles (up to 10 total for Medium RSS)
    setVisibleArticleCount(INITIAL_DISPLAY_COUNT + NEXT_LOAD_COUNT);
  }, []);

  const listData: ListItem[] = useMemo(() => {
    if (!articles || articles.length === 0) return [];

    const sliced = articles.slice(0, visibleArticleCount);

    // If all articles are loaded (visibleArticleCount equals total articles)
    // and we are on desktop web, and there were more than the initial 8 (i.e., we have 10 articles total)
    if (isDesktopWeb && visibleArticleCount === articles.length && articles.length > INITIAL_DISPLAY_COUNT) {
      // Append the special button item. It will take up 2 columns.
      return [...sliced, { id: 'all-articles-button', type: 'allArticlesButton', span: 2 }];
    }
    return sliced;
  }, [articles, visibleArticleCount, isDesktopWeb]);

  const renderItem = ({ item, index }: { item: ListItem; index: number }) => {
    const isButton = 'type' in item && item.type === 'allArticlesButton';

    if (isDesktopWeb) {
      const itemFlexBasis = isButton ? '50%' : `${(1 / NUM_COLUMNS_DESKTOP) * 100}%`; // Button takes 2 columns, articles take 1
      const needsLeftBorder = (index % NUM_COLUMNS_DESKTOP !== 0);
      const paddingLeft = needsLeftBorder ? DESKTOP_GUTTER_HALF * 2 : DESKTOP_GUTTER_HALF;
      const cardEffectiveHeight = 380; // Height of a DesktopArticleCard is effectively 220 (content) + 160 (image) = 380

      return (
        <View
          style={[
            styles.desktopCardWrapper,
            {
              flexBasis: itemFlexBasis,
              borderLeftWidth: needsLeftBorder ? 1 : 0,
              borderColor: Colors[colorScheme].cardBorder,
              paddingLeft: paddingLeft,
            },
            isButton && { height: cardEffectiveHeight, justifyContent: 'center', alignItems: 'center' }, // Center button vertically and horizontally
          ]}
        >
          {isButton ? (
            <Pressable
              onPress={() => { /* TODO: Implement what this button does */ }}
              style={({ pressed }) => [
                styles.allArticlesButton,
                {
                  backgroundColor: pressed
                    ? Colors[colorScheme].commentsButtonBackgroundPressed
                    : Colors[colorScheme].commentsButtonBackground,
                },
              ]}
            >
              <Text
                style={[
                  styles.allArticlesButtonText,
                  { color: Colors[colorScheme].commentsButtonText },
                ]}
              >
                ВСИЧКИ ПУБЛИКАЦИИ
              </Text>
            </Pressable>
          ) : (
            <DesktopArticleCard article={item as Article} />
          )}
        </View>
      );
    } else { // Mobile/Tablet
      return (
        <View style={styles.mobileCardWrapper}>
          <ArticleCard article={item as Article} />
        </View>
      );
    }
  };

  const renderSkeleton = ({ index }: { index: number }) => {
    if (isDesktopWeb) {
      return (
        <View
          style={[
            styles.desktopCardWrapper,
            {
              flexBasis: `${(1 / NUM_COLUMNS_DESKTOP) * 100}%`, // Skeletons always take 1 column
              borderLeftWidth: index % NUM_COLUMNS_DESKTOP !== 0 ? 1 : 0,
              borderColor: Colors[colorScheme].cardBorder,
              paddingLeft:
                index % NUM_COLUMNS_DESKTOL_GUTTER_HALF * 2
                  : DESKTOP_GUTTER_HALF,
            },
          ]}
        >
          <SkeletonDesktopArticleCard />
        </View>
      );
    }
    return (
      <View style={styles.mobileCardWrapper}>
        <SkeletonArticleCard />
      </View>
    );
  };

  const renderSeparator = () => {
    const separatorStyle = isDesktopWeb
      ? styles.desktopRowSeparator
      : styles.mobileItemSeparator;
    return (
      <View
        style={[
          separatorStyle,
          { backgroundColor: Colors[colorScheme].cardBorder },
        ]}
      />
    );
  };

  const renderFooter = () => {
    if (!isDesktopWeb || loading || error || articles.length === 0) {
      return null;
    }

    const allArticlesLoaded = visibleArticleCount >= articles.length;
    const hasMoreThanInitial = articles.length > INITIAL_DISPLAY_COUNT;

    if (!allArticlesLoaded && hasMoreThanInitial) {
      // Show "ОЩЕ ПУБЛИКАЦИИ" if not all articles are loaded yet, and there are more than the initial 8
      return (
        <View style={styles.loadMoreButtonContainer}>
          <Pressable
            onPress={loadMoreArticles}
            style={({ pressed }) => [
              styles.loadMoreButton,
              {
                backgroundColor: pressed
                  ? Colors[colorScheme].commentsButtonBackgroundPressed
                  : Colors[colorScheme].commentsButtonBackground,
              },
            ]}
          >
            <Text
              style={[
                styles.loadMoreButtonText,
                { color: Colors[colorScheme].commentsButtonText },
              ]}
            >
              ОЩЕ ПУБЛИКАЦИИ
            </Text>
          </Pressable>
        </View>
      );
    }
    return null; // No footer needed if all articles are loaded (button is in grid) or no more articles
  };

  const getListProps = () => {
    if (isDesktopWeb) {
      return {
        numColumns: NUM_COLUMNS_DESKTOP,
        columnWrapperStyle: styles.desktopColumnWrapper,
        ItemSeparatorComponent: renderSeparator,
        contentContainerStyle: [
          styles.desktopArticleList,
          { paddingTop: contentTopPadding },
          contentContainerStyle,
        ],
        ListFooterComponent: renderFooter, // Only for "ОЩЕ ПУБЛИКАЦИИ"
      };
    }
    return {
      numColumns: 1,
      ItemSeparatorComponent: renderSeparator,
      contentContainerStyle: [
        styles.mobileArticleList,
        { paddingTop: contentTopPadding },
        contentContainerStyle,
      ],
    };
  };

  if (loading) {
    return (
      <FlatList
        key={`skeleton-${numColumns}`}
        data={Array.from({ length: isDesktopWeb ? INITIAL_DISPLAY_COUNT : 5 })} // Show enough skeletons for initial load
        renderItem={renderSkeleton}
        keyExtractor={(_, index) => `skeleton-${index}`}
        showsVerticalScrollIndicator={false}
        {...getListProps()}
      />
    );
  }
  if (error) {
    return (
      <View style={[styles.statusContainer]}>
        <Text style={[styles.statusText, { color: Colors[colorScheme].text }]}>
          Error: {error.message}
        </Text>
      </View>
    );
  }
  if (articles.length === 0) {
    return (
      <View style={[styles.statusContainer]}>
        <Text style={[styles.statusText, { color: Colors[colorScheme].text }]}>
          No articles found.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      key={`${numColumns}-${articles.length}-${visibleArticleCount}`}
      extraData={listData} // Use listData which includes the button placeholder
      data={listData}
      renderItem={renderItem}
      keyExtractor={(item) => ('guid' in item ? item.guid : item.id)} // Handle both Article and button item keys
      showsVerticalScrollIndicator={false}
      {...getListProps()}
    />
  );
}

const styles = StyleSheet.create({
  mobileArticleList: {
    paddingBottom: 120,
    paddingHorizontal: 16,
  },
  mobileCardWrapper: {},
  desktopArticleList: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  desktopColumnWrapper: {
    justifyContent: 'flex-start',
    marginHorizontal: -DESKTOP_GUTTER_HALF,
  },
  desktopCardWrapper: {
    // flexBasis is now dynamic in renderItem
    paddingHorizontal: DESKTOP_GUTTER_HALF,
  },
  desktopRowSeparator: {
    height: 1,
    width: '100%',
    marginVertical: 16,
  },
  mobileItemSeparator: {
    height: 2,
    width: '100%',
    marginVertical: 16,
  },
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  statusText: {
    textAlign: 'center',
    fontSize: 16,
  },
  loadMoreButtonContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  loadMoreButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  allArticlesButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allArticlesButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});