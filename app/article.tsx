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
import SkeletonText from '@/components/SkeletonText';
import RenderHtml from 'react-native-render-html'; // Import RenderHtml
import { WebView } from 'react-native-webview'; // Import WebView
import '../styles/article.css';

const DESKTOP_TEXT_COLUMN_LEFT_OFFSET = 408;

interface EmbedData {
  embedHtml: string;
  isTwitterEmbed: boolean;
}

// Define nativeHtmlTagsStyles outside the component to avoid re-creation
const nativeHtmlTagsStyles = (colorScheme: 'light' | 'dark', textColors: any) => ({
  p: {
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '300',
    marginBottom: 16,
    color: textColors.text,
  },
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
    marginBottom: 16,
    color: textColors.text,
  },
  h2: {
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 36,
    marginBottom: 16,
    color: textColors.text,
  },
  h3: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
    marginBottom: 16,
    color: textColors.text,
  },
  ul: {
    marginLeft: 20,
    marginBottom: 16,
  },
  ol: {
    marginLeft: 20,
    marginBottom: 16,
  },
  li: {
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '300',
    marginBottom: 8,
    color: textColors.text,
  },
  img: {
    maxWidth: '100%',
    height: 'auto',
    marginBottom: 16,
    borderRadius: 0,
  },
  iframe: {
    width: '100%',
    height: 300, // Default height, will be overridden by custom renderer
    borderWidth: 0,
    marginBottom: 16,
    borderRadius: 0,
  },
  pre: {
    backgroundColor: textColors.skeletonBackground,
    padding: 16,
    borderRadius: 8,
    overflowX: 'scroll',
    marginBottom: 16,
  },
  code: {
    fontFamily: 'monospace',
    color: textColors.text,
  },
});


export default function ArticleScreen() {
  const { article: articleString } = useLocalSearchParams<{ article: string }>();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const { isDesktopWeb } = useResponsiveLayout();
  const router = useRouter();

  const [processedHtml, setProcessedHtml] = useState('');
  const [firstImageSrc, setFirstImageSrc] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const hasTwitterScriptLoaded = useRef(false);

  const article: Article = useMemo(() => {
    if (!articleString) return null;
    return JSON.parse(articleString);
  }, [articleString]);

  const tagsStyles = useMemo(() => nativeHtmlTagsStyles(colorScheme, Colors[colorScheme]), [colorScheme]);

  useEffect(() => {
    if (!article) {
      setIsLoadingContent(false);
      return;
    }

    let initialHtml = article['content:encoded'];
    let extractedFirstImage: string | null = null;

    const firstImageMatch = initialHtml.match(/<img[^>]+src="([^">]+)"[^>]*>/);
    if (firstImageMatch) {
      extractedFirstImage = firstImageMatch[1];
      setFirstImageSrc(extractedFirstImage);
      initialHtml = initialHtml.replace(firstImageMatch[0], '');
    } else {
      setFirstImageSrc(null);
    }

    const mediaLinkRegex = /<a[^>]+href="(https:\/\/medium\.com\/media\/[^"]+)"[^>]*>.*?<\/a>/g;
    const mediaUrls: { url: string; placeholderId: string }[] = [];
    let embedCounter = 0;
    
    let htmlWithPlaceholders = initialHtml;
    let match;
    const matches = [];
    while ((match = mediaLinkRegex.exec(initialHtml)) !== null) {
      matches.push(match);
    }

    for (let i = matches.length - 1; i >= 0; i--) {
      const currentMatch = matches[i];
      const mediaUrl = currentMatch[1];
      const fullLinkTag = currentMatch[0];
      const placeholderId = `EMBED_PLACEHOLDER_${embedCounter++}`;
      
      mediaUrls.unshift({ url: mediaUrl, placeholderId });
      
      htmlWithPlaceholders = htmlWithPlaceholders.substring(0, currentMatch.index) +
                             `<!--${placeholderId}-->` +
                             htmlWithPlaceholders.substring(currentMatch.index + fullLinkTag.length);
    }

    const fetchAndInjectEmbeds = async () => {
      setIsLoadingContent(true);
      let finalHtml = htmlWithPlaceholders;

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
              hasTwitterScriptLoaded.current = true;
            }
            return { placeholderId, embedHtml: data.embedHtml };
          }
        } catch (error) {
          console.error(`Error fetching embed for ${url}:`, error);
          return { placeholderId, embedHtml: `<p style="color: red; text-align: center;">Failed to load embed for ${url}.</p>` };
        }
        return { placeholderId, embedHtml: '' };
      });

      const results = await Promise.all(embedPromises);

      results.forEach(result => {
        if (result) {
          finalHtml = finalHtml.replace(`<!--${result.placeholderId}-->`, result.embedHtml);
        }
      });

      setProcessedHtml(finalHtml);
      setIsLoadingContent(false);

      if (hasTwitterScriptLoaded.current && Platform.OS === 'web') {
        const scriptId = 'twitter-wjs';
        if (!document.getElementById(scriptId)) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.src = "https://platform.twitter.com/widgets.js";
          script.async = true;
          script.charset = "utf-8";
          document.body.appendChild(script);
        }
      }
    };

    if (mediaUrls.length > 0) {
      fetchAndInjectEmbeds();
    } else {
      setProcessedHtml(htmlWithPlaceholders);
      setIsLoadingContent(false);
    }
  }, [article]);

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
          {firstImageSrc && (
            <View style={[styles.firstImageWrapper, isDesktopWeb && styles.desktopFirstImageWrapper]}>
              <Image source={{ uri: firstImageSrc }} style={[styles.firstImage, isDesktopWeb && styles.desktopFirstImage]} resizeMode="cover" />
            </View>
          )}
        </View>

        <View style={[styles.contentContainer, isDesktopWeb && styles.desktopContentContainer]}>
          <View style={[styles.articleBodyWrapper, isDesktopWeb && styles.desktopArticleBodyWrapper]}>
            {isLoadingContent ? (
              <View style={[styles.embedPlaceholder, { backgroundColor: Colors[colorScheme].skeletonBackground }]}>
                <SkeletonText lines={15} />
              </View>
            ) : (
              Platform.OS === 'web' ? (
                <WebHtmlRenderer
                  htmlContent={processedHtml}
                  className="article-content"
                  style={isDesktopWeb && { paddingLeft: DESKTOP_TEXT_COLUMN_LEFT_OFFSET }}
                />
              ) : (
                <RenderHtml
                  contentWidth={width - 40} // Adjust for horizontal padding
                  source={{ html: processedHtml }}
                  tagsStyles={tagsStyles}
                  renderers={{
                    iframe: (props) => {
                      // Extract width/height from iframe attributes if available, otherwise default
                      const iframeWidth = props.tnode.attributes.width ? parseInt(props.tnode.attributes.width as string) : 560;
                      const iframeHeight = props.tnode.attributes.height ? parseInt(props.tnode.attributes.height as string) : 315;
                      const aspectRatio = iframeHeight / iframeWidth;
                      const calculatedHeight = (width - 40) * aspectRatio; // Calculate height based on screen width and aspect ratio

                      return (
                        <View style={{ width: '100%', height: calculatedHeight, marginBottom: 16 }}>
                          <WebView
                            source={{ html: `<body style="margin:0;padding:0;overflow:hidden;background-color:transparent;">${props.tnode.data}</body>` }}
                            style={{ flex: 1, backgroundColor: 'transparent' }}
                            allowsFullscreenVideo={true}
                            javaScriptEnabled={true}
                            domStorageEnabled={true}
                            startInLoadingState={true}
                            renderLoading={() => <ActivityIndicator size="small" color={Colors[colorScheme].tint} />}
                          />
                        </View>
                      );
                    },
                  }}
                />
              )
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
  desktopTitleAndMetaWrapper: { alignSelf: 'center', width: '100%' },
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
  desktopArticleBodyWrapper: { width: '100%', alignItems: 'flex-start' },
  commentsButtonWrapper: { marginTop: 24, marginBottom: 40, alignItems: 'center' },
  desktopCommentsButtonWrapper: { paddingLeft: DESKTOP_TEXT_COLUMN_LEFT_OFFSET },
  commentsButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  commentsButtonText: { fontSize: 14, fontWeight: '600' },
  bottomButtonContainer: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  desktopBottomButtonContainer: { maxWidth: DESKTOP_CONTENT_MAX_CONTAINER_WIDTH, alignSelf: 'center', left: 'auto', right: 'auto', paddingHorizontal: 16 },
  bottomButtonBlurView: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.18)' },
  desktopMetaDataContainer: { width: '100%', flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  desktopCategorySection: { flexDirection: 'row', alignItems: 'center' },
  desktopDateAuthorCenteredWrapper: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  desktopDateAuthorInner: { flexDirection: 'row', alignItems: 'center' },
  embedPlaceholder: {
    width: '100%',
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  firstImageWrapper: {
    width: '100%',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  desktopFirstImageWrapper: {
    maxWidth: DESKTOP_CONTENT_MAX_CONTAINER_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 16,
  },
  firstImage: {
    width: '100%',
    height: 200,
  },
  desktopFirstImage: {
    height: 400,
  },
});