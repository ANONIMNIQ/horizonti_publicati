import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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

type ListItem = Article | { id: string; type: 'skeleton' | 'button' | 'placeholder' };

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

  const [visibleArticleCount, setVisibleArticleCount] = useState(
    Math.min(INITIAL_DISPLAY_COUNT, articles.length || 0)
  );
  const [isSimulatingLoadMore, setIsSimulatingLoadMore] = useState(false);
  const [hasClickedLoadMore, setHasClickedLoadMore] = useState(false);
  const flatListRef = useRef<FlatList<ListItem>>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const instanceId = useRef(0);

  // Effect to reset state when the articles array changes (e.g., due to filtering)
  useEffect(() => {
    instanceId.current += 1;
    setVisibleArticleCount(Math.min(INITIAL_DISPLAY_COUNT, articles.length));
    setHasClickedLoadMore(false); // Reset button state on filter change
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      setIsSimulatingLoadMore(false);
    }
  }, [articles]);

  const loadMoreArticles = useCallback(() => {
    if (isSimulatingLoadMore) return;

    setIsSimulatingLoadMore(true);
    const currentInstanceId = instanceId.current;

    timeoutRef.current = setTimeout(() => {
      if (instanceId.current !== currentInstanceId) {
        setIsSimulatingLoadMore(false);
        return;
      }

      const newVisibleCount = Math.min(visibleArticleCount + NEXT_LOAD_COUNT, articles.length);
      setVisibleArticleCount(newVisibleCount);
      
      setHasClickedLoadMore(true);
      setIsSimulatingLoadMore(false);
      timeoutRef.current = null;
    }, 700);
  }, [visibleArticleCount, articles, isSimulatingLoadMore]);

  const listData: ListItem[] = useMemo(() => {
    if (!articles || articles.length === 0) return [];

    let currentData: ListItem[] = articles.slice(0, visibleArticleCount);

    if (isSimulatingLoadMore) {
      const skeletonsToAdd = Array.from({ length: NEXT_LOAD_COUNT }).map((_, i) => ({
        id: `skeleton-${visibleArticleCount + i}`,
        type: 'skeleton' as const,
      }));
      return [...currentData, ...skeletonsToAdd];
    }

    const allArticlesLoaded = visibleArticleCount >= articles.length;

    // Desktop-specific logic to inject the button into the grid
    if (isDesktopWeb && hasClickedLoadMore && allArticlesLoaded) {
        const itemsInLastRow = currentData.length % numColumns;
        if (itemsInLastRow !== 0) {
            const placeholdersToFillRow = numColumns - itemsInLastRow;
            for (let i = 0; i < placeholdersToFillRow; i++) {
                // Add the button in the last available slot
                if (i === placeholdersToFillRow - 1) {
                    currentData.push({ id: 'button-placeholder', type: 'button' });
                } else {
                    currentData.push({ id: `empty-placeholder-${i}`, type: 'placeholder' });
                }
            }
        }
    }

    return currentData;
  }, [articles, visibleArticleCount, isSimulatingLoadMore, isDesktopWeb, hasClickedLoadMore]);

  const renderItem = ({ item, index }: { item: ListItem; index: number }) => {
    if ('type' in item && item.type === 'skeleton') {
      return renderSkeleton({ index });
    }

    if (isDesktopWeb) {
        const needsLeftBorder = (index % numColumns !== 0);
        const paddingLeft = needsLeftBorder ? DESKTOP_GUTTER_HALF * 2 : DESKTOP_GUTTER_HALF;
        const wrapperStyle = [
            styles.desktopCardWrapper,
            {
                flexBasis: `${(1 / numColumns) * 100}%`,
                borderLeftWidth: needsLeftBorder ? 1 : 0,
                borderColor: Colors[colorScheme].cardBorder,
                paddingLeft: paddingLeft,
            },
        ];

        if ('type' in item) {
            if (item.type === 'button') {
                return (
                    <View style={[...wrapperStyle, styles.buttonCell]}>
                        <Pressable
                            style={({ pressed }) => [
                                styles.allArticlesButton,
                                {
                                    backgroundColor: pressed
                                        ? Colors[colorScheme].commentsButtonBackgroundPressed
                                        : Colors[colorScheme].commentsButtonBackground,
                                },
                            ]}
                        >
                            <Text style={[styles.allArticlesButtonText, { color: Colors[colorScheme].commentsButtonText }]}>
                                ВСИЧКИ ПУБЛИКАЦИИ
                            </Text>
                        </Pressable>
                    </View>
                );
            }
            if (item.type === 'placeholder') {
                return <View style={wrapperStyle} />;
            }
        }

        return (
            <View style={wrapperStyle}>
                <DesktopArticleCard article={item as Article} />
            </View>
        );
    } else { // Mobile logic
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
              flexBasis: `${(1 / numColumns) * 100}%`,
              borderLeftWidth: index % numColumns !== 0 ? 1 : 0,
              borderColor: Colors[colorScheme].cardBorder,
              paddingLeft:
                index % numColumns !== 0
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
    if (loading || error || articles.length === 0 || isSimulatingLoadMore) {
      return null;
    }

    const allArticlesLoaded = visibleArticleCount >= articles.length;

    // On desktop, the button is rendered in the grid, so the footer is only for the initial "Load More" button.
    if (isDesktopWeb && hasClickedLoadMore) {
      return null;
    }

    if (allArticlesLoaded) {
      return null;
    }

    // This logic now primarily affects mobile, and the initial state of desktop.
    return (
      <View style={styles.footerButtonsContainer}>
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
  };

  const getListProps = () => {
    const baseProps = {
      ItemSeparatorComponent: renderSeparator,
      ListFooterComponent: renderFooter,
      contentContainerStyle: [
        { paddingTop: contentTopPadding },
        contentContainerStyle,
      ],
    };
    if (isDesktopWeb) {
      return {
        ...baseProps,
        numColumns: numColumns,
        columnWrapperStyle: styles.desktopColumnWrapper,
        contentContainerStyle: [styles.desktopArticleList, ...baseProps.contentContainerStyle],
      };
    }
    return {
      ...baseProps,
      numColumns: 1,
      contentContainerStyle: [styles.mobileArticleList, ...baseProps.contentContainerStyle],
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
        ListFooterComponent={null} // No footer during initial load
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
      key={`${numColumns}-${articles.length}`}
      extraData={listData}
      data={listData}
      renderItem={renderItem}
      keyExtractor={(item) => ('guid' in item ? item.guid : item.id)}
      showsVerticalScrollIndicator={false}
      onScrollToIndexFailed={(info) => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }}
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
  buttonCell: {
    justifyContent: 'center',
    alignItems: 'center',
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
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