import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useColorScheme,
  Image,
} from 'react-native';
import { Link } from 'expo-router';
import { decode } from 'html-entities';
import { Article } from '@/types';
import { Colors } from '@/constants/Colors';

export default function DesktopArticleCard({ article }: { article: Article }) {
  const colorScheme = useColorScheme() ?? 'light';

  const imageMatch = article['content:encoded'].match(
    /<img[^>]+src="([^">]+)"/,
  );
  const imageUrl = imageMatch ? imageMatch[1] : null;

  const displayCategory = article.categories.find(
    (cat) => cat === 'новини' || cat === 'подкаст',
  );
  const categoryInitial = displayCategory
    ? displayCategory.charAt(0).toUpperCase()
    : '';

  const circleBackgroundColor = colorScheme === 'light' ? '#000' : '#fff';
  const circleTextColor = colorScheme === 'light' ? '#fff' : '#000';

  return (
    <Link
      href={{
        pathname: '/article',
        params: { article: JSON.stringify(article) },
      }}
      asChild
    >
      <Pressable>
        <View style={styles.cardContainer}>
          <View style={styles.cardContent}>
            <Text
              style={[styles.cardTitle, { color: Colors[colorScheme].text }]}
              numberOfLines={6} // Adjusted for 6 lines
            >
              {decode(article.title)}
            </Text>
            <View style={styles.cardFooter}>
              {categoryInitial ? (
                <View
                  style={[
                    styles.categoryInitialCircle,
                    { backgroundColor: circleBackgroundColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryInitialText,
                      { color: circleTextColor },
                    ]}
                  >
                    {categoryInitial}
                  </Text>
                </View>
              ) : null}
              <View style={styles.categoryAuthorTextContainer}>
                <Text
                  style={[
                    styles.cardCategory,
                    { color: Colors[colorScheme].text, opacity: 0.7 },
                  ]}
                >
                  {displayCategory
                    ? displayCategory.charAt(0).toUpperCase() +
                      displayCategory.slice(1)
                    : ''}
                </Text>
                <Text
                  style={[
                    styles.cardCreator,
                    { color: Colors[colorScheme].text, opacity: 0.7 },
                  ]}
                >
                  {article.creator}
                </Text>
              </View>
            </View>
          </View>
          {imageUrl && (
            <Image source={{ uri: imageUrl }} style={styles.cardImage} />
          )}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    // The wrapper now controls the width, this container just holds the content
  },
  cardContent: {
    height: 240, // Adjusted height for 4 columns
    justifyContent: 'space-between',
    paddingBottom: 16, // Adjusted space
  },
  cardTitle: {
    fontSize: 18, // Smaller font size
    fontWeight: '400',
    lineHeight: 26, // Adjusted line height
    textAlign: 'left',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryInitialCircle: {
    width: 20, // Smaller circle
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6, // Adjusted margin
  },
  categoryInitialText: {
    fontSize: 11, // Smaller font
    fontWeight: 'bold',
  },
  categoryAuthorTextContainer: {
    flexDirection: 'column',
  },
  cardCategory: {
    fontSize: 11, // Smaller font
    fontWeight: '400',
  },
  cardCreator: {
    fontSize: 11, // Smaller font
    fontWeight: '400',
  },
  cardImage: {
    width: '100%',
    height: 180, // Adjusted height for better proportion
    resizeMode: 'cover',
  },
});