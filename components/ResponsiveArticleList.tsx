import React, { useState, useCallback, useMemo, useRef } from 'react';
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
  contentTopPadding?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

const NUM_COLUMNS_DESKTOP = 4;
const DESKTOP_GUTTER_HALF = 8;
const INITIAL_DISPLAY_COUNT = 8;
const NEXT_LOAD_COUNT = 2;

type ListItem = Article | { id: string; type: 'skeleton'; };

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

  // Initialize visibleArticleCount to be no more than the actual number of articles
  const [visibleArticleCount, setVisibleArticleCount] = useState(
    articles.length > 0 ? Math.min(INITIAL_DISPLAY_COUNT, articles.length) : 0
  );
  const [isSimulatingLoadMore, setIsSimulatingLoadMore] = useState(false);
  const flatListRef = useRef<FlatList<ListItem>>(null);

  // Effect to update visibleArticleCount if articles array changes (e.g., initial load)
  // This ensures that if articles are loaded after initial render, visibleArticleCount adjusts
  // to show at least INITIAL_DISPLAY_COUNT or all available articles.
  // This is crucial for the initial state when `articles` might be empty.
  React.useEffect(() => {
    if (!loading && articles.length > 0 && visibleArticleCount === 0) {
      setVisibleArticleCount(Math.min(INITIAL_DISPLAY_COUNT, articles.length));
    }
  }, [loading, articles.length, visibleArticleCount]);


  const loadMoreArticles = useCallback(() => {
    if (isSimulatingLoadMore) return;

    setIsSimulatingLoadMore(true);

    // Calculate the index where new articles will start
    const firstNewArticleIndex = visibleArticleCount;

    setTimeout(() => {
      const newVisibleCount = Math.min(visibleArticleCount + NEXT_LOAD_COUNT, articles.length);
      setVisibleArticleCount(newVisibleCount);
      setIsSimulatingLoadMore(false);

      if (flatListRef.current && newVisibleCount > firstNewArticleIndex) {
        // Calculate the target index for scrolling.
        // We want to scroll to the first *newly visible* article.
        // If on desktop, this means the start of the row containing the first new article.
        const targetIndex = isDesktopWeb
          ? Math.floor(firstNewArticleIndex / NUM_COLUMNS_DESKTOP) * NUM_COLUMNS_DESKTOP
          : firstNewArticleIndex;

        // Ensure the target index is within the bounds of the *currently rendered* list data.
        // The listData will have `newVisibleCount` items after this timeout.
        const safeTargetIndex = Math.min(targetIndex, newVisibleCount - 1);

        if (safeTargetIndex >= 0) { // Only scroll if there's something to scroll to
          flatListRef.current.scrollToIndex({
            index: safeTargetIndex,
            animated: true,
            viewPosition: 0.5, // Center the item in the view
          });
        }
      }
    }, 700);
  }, [visibleArticleCount, articles, isSimulatingLoadMore, isDesktopWeb]);

  const showAllArticles = useCallback(() => {
    if (visibleArticleCount < articles.length) {
      setVisibleArticleCount(articles.length);
      // Optionally scroll to the bottom or to the first newly revealed article
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100); // Small delay to allow FlatList to update
    }
  }, [articles.length, visibleArticleCount]);

  const listData: ListItem[] = useMemo(() => {
    if (!articles || articles.length === 0) return [];

    let currentData = articles.slice(0, visibleArticleCount);

    if (isSimulatingLoadMore) {
      const skeletonsToAdd = Array.from({ length: NEXT_LOAD_COUNT }).map((_, i) => ({
        id: `skeleton-${visibleArticleCount + i}`,
        type: 'skeleton',
      }));
      currentData = [...currentData, ...skeletonsToAdd];
    }
    return currentData;
  }, [articles, visibleArticleCount, isSimulatingLoadMore]);

  const renderItem = ({ item, index }: { item: ListItem; index: number }) => {
    if ('type' in item && item.type === 'skeleton') {
      return renderSkeleton({ index });
    } else {
      if (isDesktopWeb) {
        const needsLeftBorder = (index % NUM_COLUMNS_DESKTOP !== 0);
        const paddingLeft = needsLeftBorder ? DESKTOP_GUTTER_HALF * 2 : DESKTOP_GUTTER_HALF;
        return (
          <View
            style={[
              styles.desktopCardWrapper,
              {
                flexBasis: `${(1 / NUM_COLUMNS_DESKTOP) * 100}%`,
                borderLeftWidth: needsLeftBorder ? 1 : 0,
                borderColor: Colors[colorScheme].cardBorder,
                paddingLeft: paddingLeft,
              },
            ]}
          >
            <DesktopArticleCard article={item as Article} />
          </View>
        );
      } else { // Mobile/Tablet
        return (
          <View style={styles.mobileCardWrapper}>
            <ArticleCard article={item as Article} />
          </View>
        );
      }
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
                index % NUM_COLUMNS_DESKTOP !== 0
                  ? DESKTOP_GUTTER_HALF * 2
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
    if (loading || error || articles.length === 0) {
      return null;
    }

    const allArticlesLoaded = visibleArticleCount >= articles.length;
    const hasMoreThanInitial = articles.length > INITIAL_DISPLAY_COUNT;

    if (!allArticlesLoaded && hasMoreThanInitial) {
      return (
        <View style={styles.footerButtonsContainer}>
          {!isSimulatingLoadMore && ( // Only show "ОЩЕ ПУБЛИКАЦИИ" if not simulating load
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
          )}
          <Pressable
            onPress={showAllArticles}
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
        </View>
      );
    }
    return null;
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
        ListFooterComponent: renderFooter,
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
      ListFooterComponent: renderFooter, // Also show footer on mobile
    };
  };

  if (loading) {
    return (
      <FlatList
        key={`skeleton-${numColumns}`}
        data={Array.from({ length: isDesktopWeb ? INITIAL_DISPLAY_COUNT : 5 })}
        renderItem={renderSkeleton}
        keyExtractor={(_, index) => `skeleton-initial-${index}`}
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
      ref={flatListRef}
      key={`${numColumns}-${articles.length}-${visibleArticleCount}-${isSimulatingLoadMore}`}
      extraData={listData}
      data={listData}
      renderItem={renderItem}
      keyExtractor={(item) => ('guid' in item ? item.guid : item.id)}
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
  footerButtonsContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
    flexDirection: 'row', // Arrange buttons horizontally
    justifyContent: 'center', // Center buttons
    gap: 10, // Space between buttons
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