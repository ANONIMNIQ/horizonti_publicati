import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  useColorScheme,
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
}

const NUM_COLUMNS_DESKTOP = 3;
const DESKTOP_GUTTER_HALF = 8; // Half of the desired 16px gutter

export default function ResponsiveArticleList({
  articles,
  loading,
  error,
  contentTopPadding = 0, // Default to 0
}: ResponsiveArticleListProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const { isDesktopWeb } = useResponsiveLayout();
  const numColumns = isDesktopWeb ? NUM_COLUMNS_DESKTOP : 1;

  const renderArticle = ({ item, index }: { item: Article; index: number }) => {
    if (isDesktopWeb) {
      return (
        <View
          style={[
            styles.desktopCardWrapper,
            {
              // The border is now inside the padded area, so it won't add to the width
              borderLeftWidth: index % NUM_COLUMNS_DESKTOP !== 0 ? 1 : 0,
              borderColor: Colors[colorScheme].cardBorder,
              // Add left padding for the border width to keep content aligned
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

  const getListProps = () => {
    if (isDesktopWeb) {
      return {
        numColumns: NUM_COLUMNS_DESKTOP,
        columnWrapperStyle: styles.desktopColumnWrapper,
        ItemSeparatorComponent: renderSeparator,
        contentContainerStyle: [
          styles.desktopArticleList,
          { paddingTop: contentTopPadding },
        ],
      };
    }
    return {
      numColumns: 1,
      ItemSeparatorComponent: renderSeparator,
      contentContainerStyle: [
        styles.mobileArticleList,
        { paddingTop: contentTopPadding },
      ],
    };
  };

  if (loading) {
    return (
      <FlatList
        key={`skeleton-${numColumns}`}
        data={Array.from({ length: isDesktopWeb ? 6 : 5 })}
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
      // By changing the key when the number of articles changes, we force a full re-render,
      // which fixes the column width bug on filtering.
      key={`${numColumns}-${articles.length}`}
      extraData={articles}
      data={articles}
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
    paddingHorizontal: 16, // This defines the container's outer padding.
    paddingBottom: 120,
  },
  desktopColumnWrapper: {
    justifyContent: 'flex-start',
    // Use a negative margin to pull the row out, counteracting the card padding.
    // This makes the content align perfectly with the container padding.
    marginHorizontal: -DESKTOP_GUTTER_HALF,
  },
  desktopCardWrapper: {
    flexBasis: '33.333%',
    // Removed paddingVertical, spacing is now handled by the separator
    paddingHorizontal: DESKTOP_GUTTER_HALF,
  },
  desktopRowSeparator: {
    height: 1,
    width: '100%',
    marginVertical: 16, // Add vertical margin to create space between rows
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
});
