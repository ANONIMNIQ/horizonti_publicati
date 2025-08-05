import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/Colors';

export default function SkeletonArticleCard() {
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <View style={styles.cardContainer}>
      <BlurView
        intensity={80}
        tint={Colors[colorScheme].blurTint}
        style={styles.card}
      >
        <View
          style={[
            styles.cardImagePlaceholder,
            { backgroundColor: Colors[colorScheme].skeletonBackground },
          ]}
        />
        <View style={styles.cardContent}>
          <View
            style={[
              styles.cardTitlePlaceholder,
              { backgroundColor: Colors[colorScheme].skeletonBackground },
            ]}
          />
          <View
            style={[
              styles.cardTitlePlaceholderShort,
              { backgroundColor: Colors[colorScheme].skeletonBackground },
            ]}
          />
          <View style={styles.cardFooter}>
            <View
              style={[
                styles.cardCreatorPlaceholder,
                { backgroundColor: Colors[colorScheme].skeletonBackground },
              ]}
            />
            <View
              style={[
                styles.cardDatePlaceholder,
                { backgroundColor: Colors[colorScheme].skeletonBackground },
              ]}
            />
          </View>
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  card: {
    flexDirection: 'column',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 8,
  },
  cardContent: {
    padding: 16,
  },
  cardTitlePlaceholder: {
    height: 20,
    width: '90%',
    borderRadius: 4,
    marginBottom: 8,
  },
  cardTitlePlaceholderShort: {
    height: 20,
    width: '60%',
    borderRadius: 4,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  cardCreatorPlaceholder: {
    height: 14,
    width: '30%',
    borderRadius: 4,
  },
  cardDatePlaceholder: {
    height: 14,
    width: '20%',
    borderRadius: 4,
  },
});
