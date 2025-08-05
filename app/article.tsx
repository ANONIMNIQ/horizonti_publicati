import React, { useState, useEffect, useRef } from 'react';
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
import RenderHTML, { TNode } from 'react-native-render-html';
import { decode } from 'html-entities';
import WebView from 'react-native-webview';
import { Article } from '@/types';
import { Colors } from '@/constants/Colors';
import { SafeAreaView } from 'react-native-safe-area-context';
import ArticleHeader from '@/components/ArticleHeader';
import { Clock, ChevronLeft } from 'lucide-react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { BlurView } from 'expo-blur';
import { DESKTOP_CONTENT_MAX_CONTAINER_WIDTH, DESKTOP_TEXT_CONTENT_WIDTH } from '@/constants/Layout';
import { getYouTubeVideoId } from '@/hooks/useRssFeed';
import WebHtmlRenderer from '@/components/WebHtmlRenderer';
import '../styles/article.css';

const DESKTOP_TEXT_COLUMN_LEFT_OFFSET = 408;

function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=0&modestbranding=1&rel=0`;
  }
  return null;
}

function IframeRenderer({ tnode }: { tnode: TNode }) {
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const [isLoading, setIsLoading] = useState(true);
  const { isDesktopWeb } = useResponsiveLayout();

  const { src, height, width: initialWidth } = tnode.attributes;
  const renderHtmlContentWidth = isDesktopWeb ? DESKTOP_TEXT_CONTENT_WIDTH : screenWidth - 40;
  const aspectRatio = initialWidth && height ? parseInt(height, 10) / parseInt(initialWidth, 10) : 9 / 16;
  const webViewHeight = renderHtmlContentWidth * aspectRatio;

  if (!src) return null;

  return (
    <View style={[{ width: '100%', height: webViewHeight, marginBottom: 16, overflow: 'hidden', alignSelf: 'flex-start' }]}>
      {isLoading && (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        </View>
      )}
      <WebView
        source={{ uri: src }}
        style={{ flex: 1, opacity: isLoading ? 0 : 0.99 }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsFullscreenVideo={true}
        onLoadEnd={() => setIsLoading(false)}
      />
    </View>
  );
}

function ImageRenderer({ tnode }: { tnode: TNode }) {
  const { src, alt } = tnode.attributes;
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [hasError, setHasError] = useState(false);
  const { isDesktopWeb } = useResponsiveLayout();
  const renderHtmlContentWidth = isDesktopWeb ? DESKTOP_TEXT_CONTENT_WIDTH : screenWidth - 40;

  useEffect(() => {
    if (src) {
      Image.getSize(
        src,
        (width, height) => {
          const aspectRatio = width / height;
          setImageDimensions({ width: renderHtmlContentWidth, height: renderHtmlContentWidth / aspectRatio });
        },
        () => setHasError(true)
      );
    } else {
      setHasError(true);
    }
  }, [src, renderHtmlContentWidth]);

  if (!src || hasError) return null;

  if (imageDimensions.height === 0) {
    return (
      <View style={{ width: '100%', height: 200, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: src }}
      style={{ width: imageDimensions.width, height: imageDimensions.height, marginBottom: 16 }}
      accessibilityLabel={alt || 'Article image'}
      resizeMode="cover"
    />
  );
}

const renderers = {
  iframe: IframeRenderer,
  img: ImageRenderer,
};

export default function ArticleScreen() {
  const { article: articleString } = useLocalSearchParams<{ article: string }>();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const { isDesktopWeb } = useResponsiveLayout();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') {
      document.body.classList.toggle('dark-mode', colorScheme === 'dark');
    }
  }, [colorScheme]);

  if (!articleString) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
        <ArticleHeader />
        <View style={[styles.container, styles.centered]}>
          <Text style={{ color: Colors[colorScheme].text }}>Article not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const article: Article = JSON.parse(articleString);
  const formattedDate = new Date(article.isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const displayCategory = article.categories.find(cat => cat === 'новини' || cat === 'подкаст');
  const categoryInitial = displayCategory ? displayCategory.charAt(0).toUpperCase() : '';
  const renderHtmlContentWidth = isDesktopWeb ? DESKTOP_TEXT_CONTENT_WIDTH : width - 40;

  const tagsStyles = {
    body: { color: Colors[colorScheme].text, fontSize: 17, lineHeight: 28, fontWeight: '300' as const },
    p: { marginBottom: 16, color: Colors[colorScheme].text, fontWeight: '300' as const },
    h1: { fontSize: 32, fontWeight: 'bold' as const, marginBottom: 16, color: Colors[colorScheme].text },
    h2: { fontSize: 28, fontWeight: 'bold' as const, marginBottom: 16, color: Colors[colorScheme].text },
    h3: { fontSize: 24, fontWeight: 'bold' as const, marginBottom: 16, color: Colors[colorScheme].text },
    li: { color: Colors[colorScheme].text, fontSize: 17, lineHeight: 28, marginBottom: 8, fontWeight: '300' as const },
  };

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

        <View style={[styles.contentContainer, isDesktopWeb && styles.desktopContentContainer]}>
          <View style={[styles.articleBodyWrapper, isDesktopWeb && styles.desktopArticleBodyWrapper]}>
            <RenderHTML
              contentWidth={renderHtmlContentWidth}
              source={{ html: article['content:encoded'] }}
              tagsStyles={tagsStyles as any}
              renderers={renderers as any}
              baseStyle={{ width: renderHtmlContentWidth }}
            />
          </View>

          {article.embeds && article.embeds.length > 0 && (
            <View style={[styles.embedsSection, isDesktopWeb && styles.desktopEmbedsSection]}>
              <View style={[styles.metaSeparator, { backgroundColor: Colors[colorScheme].cardBorder, marginBottom: 32 }]} />
              {article.embeds.map((embedHtml, index) => (
                <WebHtmlRenderer
                  key={index}
                  htmlContent={embedHtml}
                  className="article-embed"
                  style={isDesktopWeb && { paddingLeft: DESKTOP_TEXT_COLUMN_LEFT_OFFSET }}
                />
              ))}
            </View>
          )}

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
  embedsSection: { paddingBottom: 40 },
  desktopEmbedsSection: {},
});