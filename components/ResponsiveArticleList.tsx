import React, { useState, useCallback } from 'react';
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

  const renderArticle = ({ item, index }: { item: Article; index: number }) => {
    if (isDesktopWeb) {
      return (
        <View
          style={[
            styles.desktopCardWrapper,
            {
              borderLeftWidth: index % NUM_COLUMNS_DESKTOP !== 0 ? 1 : 0,
              borderColor: Colors[colorScheme].cardBorder,
              paddingLeft:
                index % NUM_COLUMNS_DESKTOP !== 0
                  ? DESKTOP_GUTTER_HALF * 2
                  : DESKTOP_GUTTER_HALF,
            },
          ]}
        >
          <DesktopArticleCard article={item} />
        </View>
      );
    }
    return (
      <View style={styles.mobileCardWrapper}>
        <ArticleCard article={item} />
      </View>
    );
  };

  const renderSkeleton = ({ index }: { index: number }) => {
    if (isDesktopWeb) {
      return (
        <View
          style={[
            styles.desktopCardWrapper,
            {
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
    } else if (allArticlesLoaded && hasMoreThanInitial) {
      // Show "ВСИЧКИ ПУБЛИКАЦИИ" if all articles are loaded and there were more than the initial 8
      return (
        <View style={styles.allArticlesButtonWrapper}>
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
      extraData={articles}
      data={articles.slice(0, visibleArticleCount)}
      renderItem={renderArticle}
      keyExtractor={(item) => item.guid}
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
    flexBasis: '25%',
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
  allArticlesButtonWrapper: {
    width: '100%',
    alignItems: 'flex-end', // Align to the right
    marginTop: 24,
    marginBottom: 40,
    paddingRight: 16, // Add padding to match content
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