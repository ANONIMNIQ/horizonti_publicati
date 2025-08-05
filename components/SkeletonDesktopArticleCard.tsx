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
    height: 260, // Match real card
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  cardTitlePlaceholder: {
    height: 30, // Match line height
    width: '90%',
    borderRadius: 4,
    marginBottom: 10, // Space between lines
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardCreatorPlaceholder: {
    height: 28, // Match height of the smaller metadata
    width: '40%',
    borderRadius: 4,
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 220, // Match real card
  },
});
