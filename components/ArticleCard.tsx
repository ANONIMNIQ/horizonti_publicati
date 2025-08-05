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

export default function ArticleCard({ article }: { article: Article }) {
  const colorScheme = useColorScheme() ?? 'light';

  // Extract image from content
  const imageMatch = article['content:encoded'].match(
    /<img[^>]+src="([^">]+)"/,
  );
  const imageUrl = imageMatch ? imageMatch[1] : null;

  // Determine the category to display
  const displayCategory = article.categories.find(
    (cat) => cat === 'новини' || cat === 'подкаст',
  );
  const categoryInitial = displayCategory ? displayCategory.charAt(0).toUpperCase() : '';

  // Determine circle and text colors based on theme
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
        <View
          style={styles.cardContainer}
        >
          <View style={styles.cardContent}>
            <Text
              style={[styles.cardTitle, { color: Colors[colorScheme].text }]}
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
                  <Text style={[styles.categoryInitialText, { color: circleTextColor }]}>
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
                  {displayCategory ? displayCategory.charAt(0).toUpperCase() + displayCategory.slice(1) : ''}
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
    overflow: 'hidden',
  },
  cardContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '500', // Lighter font
    marginBottom: 12,
    lineHeight: 28,
    textAlign: 'left',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryInitialCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  categoryInitialText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  categoryAuthorTextContainer: {
    flexDirection: 'column',
  },
  cardCategory: {
    fontSize: 15,
    fontWeight: '400', // Lighter font
  },
  cardCreator: {
    fontSize: 15,
    fontWeight: '400', // Lighter font
  },
  cardImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
});
