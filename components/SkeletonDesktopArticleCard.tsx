import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function SkeletonDesktopArticleCard() {
  const colorScheme = useColorScheme() ?? 'light';
  const skeletonBackgroundColor = Colors[colorScheme].skeletonBackground;

  return (
    <View style={styles.cardContainer}>
      <View style={styles.cardContent}>
        <View>
          <View
            style={[
              styles.cardTitlePlaceholder,
              { backgroundColor: skeletonBackgroundColor },
            ]}
          />
          <View
            style={[
              styles.cardTitlePlaceholder,
              { width: '80%', backgroundColor: skeletonBackgroundColor },
            ]}
          />
          <View
            style={[
              styles.cardTitlePlaceholder,
              { width: '95%', backgroundColor: skeletonBackgroundColor },
            ]}
          />
          <View
            style={[
              styles.cardTitlePlaceholder,
              { width: '60%', backgroundColor: skeletonBackgroundColor },
            ]}
          />
          <View
            style={[
              styles.cardTitlePlaceholder,
              { width: '70%', backgroundColor: skeletonBackgroundColor },
            ]}
          />
        </View>
        <View style={styles.cardFooter}>
          <View
            style={[
              styles.cardCreatorPlaceholder,
              { backgroundColor: skeletonBackgroundColor },
            ]}
          />
        </View>
      </View>
      <View
        style={[
          styles.cardImagePlaceholder,
          { backgroundColor: skeletonBackgroundColor },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    // Matches the real card structure
  },
  cardContent: {
    height: 220, // Match new real card height
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  cardTitlePlaceholder: {
    height: 20,
    borderRadius: 4,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardCreatorPlaceholder: {
    height: 24,
    width: '50%',
    borderRadius: 4,
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 160, // Match new real card height
    borderRadius: 8, // Added border radius for consistency
  },
});