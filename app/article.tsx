import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  useColorScheme,
  ActivityIndicator,
  Linking,
  Pressable,
  Image,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { decode } from 'html-entities';
import { Article } from '@/types';
import { Colors } from '@/constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import ArticleHeader from '@/components/ArticleHeader';
import { Clock, ChevronLeft } from 'lucide-react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { BlurView } from 'expo-blur';
import { DESKTOP_CONTENT_MAX_CONTAINER_WIDTH, DESKTOP_TEXT_CONTENT_WIDTH } from '@/constants/Layout';
import WebHtmlRenderer from '@/components/WebHtmlRenderer';
import '../styles/article.css';

// Define a type for the fetched embed data from the API
interface EmbedData {
  embedHtml: string;
  isTwitterEmbed: boolean;
}

export default function ArticleScreen() {
  const { article: articleString } = useLocalSearchParams<{ article: string }>();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const { isDesktopWeb } = useResponsiveLayout();
  const router = useRouter();

  const [processedHtml, setProcessedHtml] = useState('');
  const [firstImageUrl, setFirstImageUrl] = useState<string | null>(null); // New state for the first image
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const hasTwitterScriptLoaded = useRef(false);

  const article: Article = useMemo(() => {
    if (!articleString) return null;
    return JSON.parse(articleString);
  }, [articleString]);

  useEffect(() => {
    if (!article) {
      setIsLoadingContent(false);
      return;
    }

    let originalHtml = article['content:encoded'];
    let currentFirstImageUrl: string | null = null;

    // Extract and remove the first image for web
    if (Platform.OS === 'web') {
      const firstImageMatch = originalHtml.match(/<img[^>]+src="([^">]+)"[^>]*>/);
      if (firstImageMatch) {
        currentFirstImageUrl = firstImageMatch[1];
        setFirstImageUrl(currentFirstImageUrl);
        // Remove the matched image tag from the HTML content
        originalHtml = originalHtml.replace(firstImageMatch[0], '');
      } else {
        setFirstImageUrl(null);
      }
    } else {
      setFirstImageUrl(null); // Ensure it's null for native
    }

    const mediaLinkRegex = /<a[^>]+href="(https:\/\/medium\.com\/media\/[^"]+)"[^>]*>.*?<\/a>/g;
    
    const mediaUrls: { url: string; placeholderId: string }[] = [];
    let embedCounter = 0;
    let tempHtml = originalHtml;

    // First pass: Replace media links with unique placeholders
    let match;
    const matches = [];
    while ((match = mediaLinkRegex.exec(originalHtml)) !== null) {
      matches.push(match);
    }

    // Iterate matches in reverse to avoid issues with string replacement changing indices
    for (let i = matches.length - 1; i >= 0; i--) {
      const currentMatch = matches[i];
      const mediaUrl = currentMatch[1];
      const placeholderId = `EMBED_PLACEHOLDER_${embedCounter++}`;
      // Replace the entire <a> tag with our unique placeholder string
      tempHtml = tempHtml.substring(0, currentMatch.index) +
                 `<!--${placeholderId}-->` +
                 tempHtml.substring(currentMatch.index + currentMatch[0].length);
      mediaUrls.unshift({ url: mediaUrl, placeholderId }); // Add to beginning to maintain order
    }
    
    // Second pass: Fetch embeds and inject them into the HTML
    const fetchAndInjectEmbeds = async () => {
      setIsLoadingContent(true);
      let currentHtml = tempHtml;
      let twitterScriptNeeded = false;

      const embedPromises = mediaUrls.map(async ({ url, placeholderId }) => {
        try {
          const apiUrl = `/api/get-media-embed?mediaUrl=${encodeURIComponent(url)}`;
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch embed for ${url}`);
          }

          const data: EmbedData = await response.json();
          if (data.embedHtml) {
            if (data.isTwitterEmbed) {
              twitterScriptNeeded = true;
            }
            return { placeholderId, embedHtml: data.embedHtml };
          }
        } catch (error) {
          console.error(`Error fetching embed for ${url}:`, error);
          return { placeholderId, embedHtml: `<p style="color: red; text-align: center;">Failed to load embed.</p>` };
        }
        return { placeholderId, embedHtml: '' }; // Return empty if no embedHtml
      });

      const results = await Promise.all(embedPromises);

      // Replace placeholders with fetched HTML
      results.forEach(result => {
        if (result) {
          currentHtml = currentHtml.replace(`<!--${result.placeholderId}-->`, result.embedHtml);
        }
      });

      setProcessedHtml(currentHtml);
      setIsLoadingContent(false);

      if (twitterScriptNeeded && !hasTwitterScriptLoaded.current && Platform.OS === 'web') {
        const scriptId = 'twitter-wjs';
        if (!document.getElementById(scriptId)) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.src = "https://platform.twitter.com/widgets.js";
          script.async = true;
          script.charset = "utf-8";
          document.body.appendChild(script);
          hasTwitterScriptLoaded.current = true;
        }
      }
    };

    if (mediaUrls.length > 0) {
      fetchAndInjectEmbeds();
    } else {
      setProcessedHtml(tempHtml); // No embeds to fetch, use original processed HTML
      setIsLoadingContent(false);
    }
  }, [article]); // Re-run when article changes

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.body.classList.toggle('dark-mode', colorScheme === 'dark');
    }
  }, [colorScheme]);

  if (!article) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
        <ArticleHeader />
        <View style={[styles.container, styles.centered]}>
          <Text style={{ color: Colors[colorScheme].text }}>Article not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formattedDate = new Date(article.isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const displayCategory = article.categories.find(cat => cat === 'новини' || cat === 'подкаст');
  const categoryInitial = displayCategory ? displayCategory.charAt(0).toUpperCase() : '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors[colorScheme].background }} edges={['bottom']}>
      {!isDesktopWeb && <ArticleHeader />}
      <ScrollView contentContainerStyle={[styles.scrollContainer, isDesktopWeb && styles.desktopScrollContainer]}>
        <View style={[styles.contentContainer, isDesktopWeb && styles.desktopContentContainer]}>
          <View style={[styles.titleAndMetaWrapper, isDesktopWeb && styles.desktopTitleAndMetaWrapper]}>
            <Text style={[styles.title, isDesktopWeb && styles.desktopTitle, { color: Colors[colorScheme].text }]}>{decode(article.title)}</Text>
            <View style={[styles.metaSeparator, { backgroundColor: Colors[colorScheme].cardBorder }]} />
            {isDesktopWeb ? (
              <View style={styles.desktopMetaDataContainer}>
                <View style={styles.desktopCategorySection}>
                  {categoryInitial && (
                    <View style={[styles.categoryInitialCircle, { backgroundColor: colorScheme === 'light' ? '#000' : '#fff' }]}>
                      <Text style={[styles.categoryInitialText, { color: colorScheme === 'light' ? '#fff' : '#000' }]}>{categoryInitial}</Text>
                    </View>
                  )}
                  <Text style={[styles.cardCategory, { color: Colors[colorScheme].text, opacity: 0.7 }]}>{displayCategory ? displayCategory.charAt(0).toUpperCase() + displayCategory.slice(1) : ''}</Text>
                </View>
                <View style={styles.desktopDateAuthorCenteredWrapper}>
                  <View style={styles.desktopDateAuthorInner}>
                    <Text style={[styles.cardCreator, { color: Colors[colorScheme].text, opacity: 0.7, marginRight: 20 }]}>{article.creator}</Text>
                    <View style={styles.dateSection}>
                      <Clock size={16} color={Colors[colorScheme].text} style={styles.clockIcon} />
                      <Text style={[styles.dateText, { color: Colors[colorScheme].text, opacity: 0.7 }]}>{formattedDate}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.articleMetaSection}>
                <View style={styles.articleFooter}>
                  <View style={styles.categoryAuthorSection}>
                    {categoryInitial && (
                      <View style={[styles.categoryInitialCircle, { backgroundColor: colorScheme === 'light' ? '#000' : '#fff' }]}>
                        <Text style={[styles.categoryInitialText, { color: colorScheme === 'light' ? '#fff' : '#000' }]}>{categoryInitial}</Text>
                      </View>
                    )}
                    <View style={styles.categoryAuthorTextContainer}>
                      <Text style={[styles.cardCategory, { color: Colors[colorScheme].text, opacity: 0.7 }]}>{displayCategory ? displayCategory.charAt(0).toUpperCase() + displayCategory.slice(1) : ''}</Text>
                      <Text style={[styles.cardCreator, { color: Colors[colorScheme].text, opacity: 0.7 }]}>{article.creator}</Text>
                    </View>
                  </View>
                  <View style={styles.dateSection}>
                    <Clock size={16} color={Colors[colorScheme].text} style={styles.clockIcon} />
                    <Text style={[styles.dateText, { color: Colors[colorScheme].text, opacity: 0.7 }]}>{formattedDate}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Render the first image separately for web */}
        {Platform.OS === 'web' && firstImageUrl && (
          <View style={[styles.firstImageWrapper, isDesktopWeb && styles.desktopFirstImageWrapper]}>
            <Image source={{ uri: firstImageUrl }} style={styles.firstImage} resizeMode="cover" />
          </View>
        )}

        <View style={[styles.contentContainer, isDesktopWeb && styles.desktopContentContainer]}>
          <View style={[styles.articleBodyWrapper, isDesktopWeb && styles.desktopArticleBodyWrapper]}>
            {isLoadingContent ? (
              <View style={[styles.embedPlaceholder, { backgroundColor: Colors[colorScheme].cardBorder }]}>
                <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
                <Text style={{ color: Colors[colorScheme].text, opacity: 0.7, marginTop: 8 }}>Loading article content...</Text>
              </View>
            ) : (
              <WebHtmlRenderer
                htmlContent={processedHtml}
                className="article-content"
                // Removed style prop for paddingLeft, now handled by desktopArticleBodyWrapper
              />
            )}
          </View>

          {Platform.OS === 'web' && (
            <View style={[styles.commentsButtonWrapper, isDesktopWeb && styles.desktopCommentsButtonWrapper]}>
              <Pressable
                style={({ pressed }) => [styles.commentsButton, { backgroundColor: pressed ? Colors[colorScheme].commentsButtonBackgroundPressed : Colors[colorScheme].commentsButtonBackground }]}
                onPress={() => article.link && Linking.openURL(`${article.link}#comments`)}
              >
                <Text style={[styles.commentsButtonText, { color: Colors[colorScheme].commentsButtonText }]}>Коментирай публикацията в Medium</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {isDesktopWeb && (
        <View style={[styles.bottomButtonContainer, styles.desktopBottomButtonContainer]}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <BlurView intensity={80} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={styles.bottomButtonBlurView}>
              <ChevronLeft size={24} color={Colors[colorScheme].text} />
            </BlurView>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { paddingTop: 80, paddingBottom: 40 },
  desktopScrollContainer: { alignSelf: 'center', width: '100%', maxWidth: DESKTOP_CONTENT_MAX_CONTAINER_WIDTH, paddingTop: 0 },
  contentContainer: { paddingHorizontal: 20 },
  desktopContentContainer: { paddingHorizontal: 16 },
  titleAndMetaWrapper: {},
  desktopTitleAndMetaWrapper: { alignSelf: 'flex-end', width: '100%' }, // Changed to flex-end
  title: { fontSize: 20, fontWeight: '500', marginBottom: 12, lineHeight: 28 },
  desktopTitle: { fontSize: 40, fontWeight: 'bold', lineHeight: 48, marginBottom: 16 },
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingOverlay: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
  articleMetaSection: { marginBottom: 24 },
  articleFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  categoryAuthorSection: { flexDirection: 'row', alignItems: 'center' },
  categoryInitialCircle: { width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  categoryInitialText: { fontSize: 12, fontWeight: '900' },
  categoryAuthorTextContainer: { flexDirection: 'column' },
  cardCategory: { fontSize: 13, fontWeight: '400' },
  cardCreator: { fontSize: 13, fontWeight: '400' },
  dateSection: { flexDirection: 'row', alignItems: 'center' },
  clockIcon: { marginRight: 4 },
  dateText: { fontSize: 13, fontWeight: '400' },
  metaSeparator: { height: 2, width: '100%', marginBottom: 24 },
  articleBodyWrapper: {},
  desktopArticleBodyWrapper: {
    width: DESKTOP_TEXT_CONTENT_WIDTH, // Fixed width for text column
    alignSelf: 'flex-end', // Changed to flex-end
  },
  commentsButtonWrapper: { marginTop: 24, marginBottom: 40, alignItems: 'center' },
  desktopCommentsButtonWrapper: {
    width: DESKTOP_TEXT_CONTENT_WIDTH, // Fixed width for button
    alignSelf: 'flex-end', // Changed to flex-end
  },
  bottomButtonContainer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  desktopBottomButtonContainer: { maxWidth: DESKTOP_CONTENT_MAX_CONTAINER_WIDTH, alignSelf: 'center', left: 'auto', right: 'auto', paddingHorizontal: 16 },
  bottomButtonBlurView: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.18)' },
  desktopMetaDataContainer: { width: '100%', flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  desktopCategorySection: { flexDirection: 'row', alignItems: 'center' },
  desktopDateAuthorCenteredWrapper: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  desktopDateAuthorInner: { flexDirection: 'row', alignItems: 'center' },
  embedPlaceholder: {
    width: '100%',
    height: 200, // Placeholder height
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderRadius: 8,
  },
  // New styles for the first image
  firstImageWrapper: {
    width: '100%',
    marginBottom: 24, // Space after the image
  },
  desktopFirstImageWrapper: {
    maxWidth: DESKTOP_CONTENT_MAX_CONTAINER_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 16, // Match content container padding
  },
  firstImage: {
    width: '100%',
    height: 250, // Example height, adjust as needed
    resizeMode: 'cover',
    borderRadius: 0, // Ensure no rounded corners
  },
});