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
import { DESKTOP_CONTENT_MAX_CONTAINER_WIDTH, DESKTOP_TEXT_CONTENT_WIDTH } from '@/constants/Layout'; // Import DESKTOP_TEXT_CONTENT_WIDTH
import { getYouTubeVideoId } from '@/hooks/useRssFeed'; // Import getYouTubeVideoId
import WebHtmlRenderer from '@/components/WebHtmlRenderer'; // Import the new component
import '../styles/article.css'; // Import the new CSS file for web

// Corrected offset: (DESKTOP_CONTENT_MAX_CONTAINER_WIDTH - (16 * 2) - DESKTOP_TEXT_CONTENT_WIDTH)
// (1024 - 32 - 584) = 408
const DESKTOP_TEXT_COLUMN_LEFT_OFFSET = 408; 

// Utility function to return canonical YouTube embed URL
function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  if (videoId) {
    // Add parameters for better embedding experience (no autoplay, modest branding, no related videos)
    return `https://www.youtube.com/embed/${videoId}?autoplay=0&modestbranding=1&rel=0`;
  }
  return null;
}

// Renderer for <iframe> tags (used only for native)
function IframeRenderer({ tnode }: { tnode: TNode }) {
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const [isLoading, setIsLoading] = useState(true);
  const { isDesktopWeb } = useResponsiveLayout();

  const { src, height, width: initialWidth } = tnode.attributes;

  // Use the same content width as RenderHTML
  const renderHtmlContentWidth = isDesktopWeb ? DESKTOP_TEXT_CONTENT_WIDTH : screenWidth - 40;

  // Calculate aspect ratio based on initial width/height or default to 16:9
  const aspectRatio = initialWidth && height ? parseInt(height, 10) / parseInt(initialWidth, 10) : 9 / 16;
  const webViewHeight = renderHtmlContentWidth * aspectRatio;

  if (!src) {
    return null;
  }

  return (
    <View style={[{ width: '100%', height: webViewHeight, marginBottom: 16, overflow: 'hidden', alignSelf: 'flex-start' }]}>
      {isLoading && (
        <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
          <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>Loading media...</Text>
        </View>
      )}
      <WebView
        source={{ uri: src }} // src is already processed to be a canonical YouTube embed URL if applicable
        style={{ flex: 1, opacity: isLoading ? 0 : 0.99 }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsFullscreenVideo={true}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error for media link: ', nativeEvent.description);
          setIsLoading(false);
        }}
      />
    </View>
  );
}

// Custom renderer for <a> tags (used only for native)
function LinkRenderer({ tnode, children, style }: { tnode: TNode, children: React.ReactNode, style: any }) {
  const { href, class: className } = tnode.attributes; // Get the class attribute
  const colorScheme = useColorScheme() ?? 'light';
  const { isDesktopWeb } = useResponsiveLayout();

  const youtubeEmbedSrc = getYouTubeEmbedUrl(href);
  const isExternalLinkButton = className && className.includes('external-link-button');

  if (youtubeEmbedSrc) {
    // If it's a YouTube link, try to render it as an iframe
    const iframeTnode = {
      attributes: {
        src: youtubeEmbedSrc,
        width: '560',
        height: '315',
      },
    };
    return <IframeRenderer tnode={iframeTnode as any} />;
  } else if (isExternalLinkButton) {
    // If it's an external link button, render a Pressable using comments button styles
    return (
      <Pressable
        style={({ pressed }) => [
          styles.commentsButton, // Use comments button style
          {
            backgroundColor: pressed
              ? Colors[colorScheme].commentsButtonBackgroundPressed
              : Colors[colorScheme].commentsButtonBackground,
          },
        ]}
        onPress={() => href && Linking.openURL(href)}
      >
        <Text style={[styles.commentsButtonText, { color: Colors[colorScheme].commentsButtonText }]}> {/* Use comments button text style */}
          ВИЖ
        </Text>
      </Pressable>
    );
  }

  // For all other links, render as plain text
  return (
    <Text style={[style, { color: Colors[colorScheme].text }]}>
      {children}
    </Text>
  );
}

// Custom renderer for <img> tags (used only for native)
function ImageRenderer({ tnode }: { tnode: TNode }) {
  const { src, alt } = tnode.attributes;
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [hasError, setHasError] = useState(false);
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const { isDesktopWeb } = useResponsiveLayout();

  const renderHtmlContentWidth = isDesktopWeb ? DESKTOP_TEXT_CONTENT_WIDTH : screenWidth - 40;
  const fallbackHeight = 200; // Default height for placeholders/errors

  useEffect(() => {
    if (src) {
      setIsLoadingImage(true);
      setHasError(false); // Reset error on new src
      Image.getSize(
        src,
        (width, height) => {
          const aspectRatio = width / height;
          const calculatedHeight = renderHtmlContentWidth / aspectRatio;
          setImageDimensions({ width: renderHtmlContentWidth, height: calculatedHeight });
          setIsLoadingImage(false);
        },
        (error) => {
          console.warn(`Failed to get image size for ${src}:`, error);
          setHasError(true);
          setIsLoadingImage(false);
        }
      );
    } else {
      setHasError(true);
      setIsLoadingImage(false);
    }
  }, [src, renderHtmlContentWidth]);

  // Render fallback if src is missing or a permanent error occurred
  if (!src || hasError) {
    return (
      <View style={[
        styles.imageContainer,
        styles.imagePlaceholder, // Centering for fallback content
        { width: '100%', height: fallbackHeight, alignSelf: 'flex-start' },
      ]}>
        <Text style={[styles.imageErrorText, { color: Colors[colorScheme].text }]}>
          Image failed to load or is missing.
        </Text>
      </View>
    );
  }

  // Render loading indicator while fetching dimensions
  if (isLoadingImage || imageDimensions.height === 0) {
    return (
      <View style={[
        styles.imageContainer,
        styles.imagePlaceholder, // Centering for loading indicator
        { width: '100%', height: fallbackHeight, alignSelf: 'flex-start' },
      ]}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>Loading image...</Text>
      </View>
    );
  }

  // Render actual image once dimensions are available
  return (
    <View style={[
      styles.imageContainer,
      { width: '100%', height: imageDimensions.height, alignSelf: 'flex-start' },
    ]}>
      <Image
        source={{ uri: src }}
        style={[styles.image, { width: '100%', height: '100%' }]} // Image fills its container
        accessibilityLabel={alt || 'Article image'}
        resizeMode={'cover'}
        onError={() => setHasError(true)}
      />
    </View>
  );
}

// New component for the first image/iframe
function FirstMediaComponent({ mediaData }: { mediaData: { type: 'img' | 'iframe' | null; src: string; alt?: string; width?: string; height?: string } | null }) {
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const [isLoading, setIsLoading] = useState(true);
  const { isDesktopWeb } = useResponsiveLayout();

  if (!mediaData) {
    return null;
  }

  const mediaWidth = isDesktopWeb ? DESKTOP_CONTENT_MAX_CONTAINER_WIDTH : screenWidth;
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (mediaData.type === 'img' && mediaData.src) {
      Image.getSize(
        mediaData.src,
        (width, height) => {
          const aspectRatio = width / height;
          const calculatedHeight = mediaWidth / aspectRatio;
          setImageDimensions({ width: mediaWidth, height: calculatedHeight });
          setHasError(false);
        },
        (error) => {
          console.warn(`Failed to get image size for ${mediaData.src}:`, error);
          setHasError(true);
        }
      );
    } else if (mediaData.type === 'iframe') {
      // For iframes, dimensions are often fixed or calculated based on aspect ratio
      const aspectRatio = mediaData.height && mediaData.width ? parseInt(mediaData.height, 10) / parseInt(mediaData.width, 10) : 9 / 16;
      const webViewHeight = mediaWidth * aspectRatio;
      setImageDimensions({ width: mediaWidth, height: webViewHeight });
      setIsLoading(false); // Iframes don't need Image.getSize, so set loading to false
    } else {
      setHasError(true);
    }
  }, [mediaData.src, mediaData.type, mediaData.width, mediaData.height, mediaWidth]);

  if (hasError) {
    return null;
  }

  if (mediaData.type === 'img') {
    if (imageDimensions.height === 0) {
      return (
        <View style={[styles.imageContainer, styles.centeredImageContainer, { width: mediaWidth, height: 200 }]}>
          <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
          <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>Loading image...</Text>
        </View>
      );
    }
    return (
      <View style={[styles.imageContainer, styles.centeredImageContainer, { width: imageDimensions.width, height: imageDimensions.height }]}>
        <Image
          source={{ uri: mediaData.src }}
          style={[styles.image, { width: imageDimensions.width, height: imageDimensions.height }]}
          accessibilityLabel={mediaData.alt || 'Article image'}
          resizeMode="cover"
          onError={() => setHasError(true)}
        />
      </View>
    );
  } else if (mediaData.type === 'iframe') {
    if (Platform.OS === 'web') {
      return (
        <View style={[{ width: mediaWidth, height: imageDimensions.height, marginBottom: 16, overflow: 'hidden' }]}>
          <iframe
            src={mediaData.src} // src is already processed to be a canonical YouTube embed URL if applicable
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            allowFullScreen
            title="Embedded Content"
          />
        </View>
      );
    } else {
      return (
        <View style={[{ width: mediaWidth, height: imageDimensions.height, marginBottom: 16, overflow: 'hidden' }]}>
          {isLoading && (
            <View style={[StyleSheet.absoluteFill, styles.loadingOverlay]}>
              <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
              <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>Loading media...</Text>
            </View>
          )}
          <WebView
            source={{ uri: mediaData.src }} // src is already processed to be a canonical YouTube embed URL if applicable
            style={{ flex: 1, opacity: isLoading ? 0 : 0.99 }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsFullscreenVideo={true}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn('WebView error for media link: ', nativeEvent.description);
              setIsLoading(false);
            }}
          />
        </View>
      );
    }
  }
  return null;
}


const renderers = {
  iframe: IframeRenderer,
  a: LinkRenderer,
  img: ImageRenderer,
};

export default function ArticleScreen() {
  const { article: articleString } = useLocalSearchParams<{ article: string }>();
  const { width } = useWindowDimensions();
  const colorScheme = useColorScheme() ?? 'light';
  const [isLoadingContent, setIsLoadingContent] = useState(true);
  const { isDesktopWeb } = useResponsiveLayout();
  const router = useRouter();

  const [firstMediaData, setFirstMediaData] = useState<{ type: 'img' | 'iframe' | null; src: string; alt?: string; width?: string; height?: string } | null>(null);
  const [contentHtml, setContentHtml] = useState('');
  const [embeds, setEmbeds] = useState<string[]>([]);
  const [isLoadingEmbeds, setIsLoadingEmbeds] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoadingContent(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!articleString) return;

    const article: Article = JSON.parse(articleString);
    let rawContent = article.fullContent || article['content:encoded'];

    // Remove Medium footer
    const mediumFooterRegex = /<p><a href=".*?">.*?<\/a> was originally published in <a href=".*?">.*?<\/a> on Medium, where people are continuing the conversation by highlighting and responding to this story\.<\/p>/s;
    rawContent = rawContent.replace(mediumFooterRegex, '');

    let tempContent = rawContent;
    let extractedMedia: { type: 'img' | 'iframe' | null; src: string; alt?: string; width?: string; height?: string } | null = null;

    // First, try to find the first image
    const imgRegex = /<img\s+[^>]*src="([^"]+)"(?:[^>]*alt="([^"]*)")?[^>]*>/i;
    let match = tempContent.match(imgRegex);
    if (match) {
      extractedMedia = { type: 'img', src: match[1], alt: match[2] || '' };
      tempContent = tempContent.replace(match[0], ''); // Remove the matched img tag
    } else {
      // If no image, try to find the first iframe
      const iframeRegex = /<iframe\s+[^>]*src="([^"]+)"(?:[^>]*width="([^"]*)")?(?:[^>]*height="([^"]*)")?[^>]*>/i;
      match = tempContent.match(iframeRegex);
      if (match) {
        const originalSrc = match[1];
        const youtubeEmbedSrc = getYouTubeEmbedUrl(originalSrc);
        
        // If it's a YouTube video, use the canonical embed URL
        if (youtubeEmbedSrc) {
          extractedMedia = { type: 'iframe', src: youtubeEmbedSrc, width: match[2] || '', height: match[3] || '' };
        } else {
          // If not YouTube, use original src (might be Medium media or other iframe)
          extractedMedia = { type: 'iframe', src: originalSrc, width: match[2] || '', height: match[3] || '' };
        }
        tempContent = tempContent.replace(match[0], ''); // Remove the matched iframe tag
      }
    }

    setFirstMediaData(extractedMedia);

    // Process the remaining contentHtml for all other links and iframes
    let processedContentHtml = tempContent;

    // Get colors for the button based on current color scheme
    const buttonBackgroundColor = Colors[colorScheme].commentsButtonBackground;
    const buttonTextColor = Colors[colorScheme].commentsButtonText;

    // 1. Process <a> tags: Convert YouTube links to iframes, medium.com/media links to buttons, other links to plain text
    processedContentHtml = processedContentHtml.replace(
      /<a\s+([^>]*?)href="([^"]+)"([^>]*?)>(.*?)<\/a>/gi,
      (fullMatch, beforeHref, href, afterHref, linkText) => {
        const youtubeEmbedSrc = getYouTubeVideoId(href); // Use getYouTubeVideoId directly
        const isMediumMediaLink = href.includes('medium.com/media');

        if (youtubeEmbedSrc) {
          // If it's a YouTube link, convert to iframe
          const widthAttr = (afterHref.match(/width="([^"]*)"/i) || [])[1] || '560';
          const heightAttr = (afterHref.match(/height="([^"]*)"/i) || [])[1] || '315';
          return `<iframe src="${getYouTubeEmbedUrl(href)}" width="${widthAttr}" height="${heightAttr}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        } else if (isMediumMediaLink) {
          // If it's a medium.com/media link, convert to a styled <a> tag (button)
          // Inject inline styles for background and text color
          return `<a href="${href}" class="external-link-button" target="_blank" rel="noopener noreferrer" style="background-color: ${buttonBackgroundColor};"><span class="external-link-button-text" style="color: ${buttonTextColor};">ВИЖ</span></a>`;
        } else {
          // If not a YouTube or medium.com/media link, remove the <a> tag and keep only the text content
          return linkText;
        }
      }
    );

    // 2. Process <iframe> tags: Ensure YouTube iframes use canonical embed URLs
    processedContentHtml = processedContentHtml.replace(
      /<iframe\s+([^>]*?)src="([^"]+)"([^>]*?)>/gi,
      (fullMatch, beforeSrc, src, afterSrc) => {
        const youtubeEmbedSrc = getYouTubeEmbedUrl(src);
        if (youtubeEmbedSrc) {
          return `<iframe ${beforeSrc}src="${youtubeEmbedSrc}"${afterSrc}>`;
        }
        return fullMatch; // Keep original if not a YouTube video
      }
    );

    setContentHtml(processedContentHtml);
  }, [articleString, colorScheme]); // Add colorScheme to dependencies

  // Effect to fetch embeds from our Cloudflare function
  useEffect(() => {
    if (Platform.OS !== 'web' || !articleString) {
      setIsLoadingEmbeds(false);
      return;
    }

    const article: Article = JSON.parse(articleString);
    if (!article.link) {
      setIsLoadingEmbeds(false);
      return;
    }

    const fetchEmbeds = async () => {
      setIsLoadingEmbeds(true);
      try {
        // Clean the URL by removing query parameters
        const canonicalUrl = article.link.split('?')[0];
        const apiUrl = `/api/get-embeds?articleUrl=${encodeURIComponent(canonicalUrl)}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error('Failed to fetch embeds');
        }

        const data = await response.json();
        if (data.embeds) {
          setEmbeds(data.embeds);
        }

        // If there are Twitter embeds, we need to load their script
        if (data.hasTwitterEmbed) {
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
      } catch (error) {
        console.error("Error fetching embeds:", error);
        setEmbeds([]); // Clear embeds on error
      } finally {
        setIsLoadingEmbeds(false);
      }
    };

    fetchEmbeds();
  }, [articleString]);

  // Effect to apply dark mode class to body for web
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (colorScheme === 'dark') {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
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

  const displayCategory = article.categories.find(
    (cat) => cat === 'новини' || cat === 'подкаст',
  );
  const categoryInitial = displayCategory ? displayCategory.charAt(0).toUpperCase() : '';

  // Determine the content width for RenderHTML based on desktop/mobile
  // On desktop, RenderHTML will now be DESKTOP_TEXT_CONTENT_WIDTH (584px)
  const renderHtmlContentWidth = isDesktopWeb ? DESKTOP_TEXT_CONTENT_WIDTH : width - 40;

  const tagsStyles = {
    body: {
      color: Colors[colorScheme].text,
      fontSize: 17,
      lineHeight: 28,
      fontWeight: '300' as const,
      margin: 0, // Ensure no default margin
      padding: 0, // Ensure no default padding
      alignItems: 'flex-start', // Crucial for left alignment of content
      width: '100%', // Explicitly set body width to 100%
      display: 'flex', // For web, helps with flex context
      flexDirection: 'column', // For web, stacks children vertically
    },
    p: {
      marginBottom: 16,
      color: Colors[colorScheme].text,
      fontWeight: '300' as const,
      alignItems: 'flex-start', // Ensure paragraphs also align left
      margin: 0, // Explicitly set margin
      padding: 0, // Explicitly set padding
    },
    h1: { fontSize: 32, fontWeight: 'bold' as const, marginBottom: 16, lineHeight: 40, color: Colors[colorScheme].text },
    h2: { fontSize: 28, fontWeight: 'bold' as const, marginBottom: 16, lineHeight: 36, color: Colors[colorScheme].text },
    h3: { fontSize: 24, fontWeight: 'bold' as const, marginBottom: 16, lineHeight: 32, color: Colors[colorScheme].text },
    pre: { backgroundColor: Colors[colorScheme].cardBorder, padding: 16, borderRadius: 8, color: Colors[colorScheme].text },
    code: { fontFamily: 'monospace', color: Colors[colorScheme].text },
    li: { color: Colors[colorScheme].text, fontSize: 17, lineHeight: 28, marginBottom: 8, fontWeight: '300' as const },
    img: {
      marginBottom: 16,
      overflow: 'hidden',
      width: '100%', // Ensure it takes full width of its container
      maxWidth: '100%', // Ensure it doesn't exceed its container
      height: 'auto', // Maintain aspect ratio
      display: 'block', // Ensure it behaves as a block element
      margin: 0, // Explicitly set margin
      padding: 0, // Explicitly set padding
      flexShrink: 0, // Prevent shrinking
    },
    iframe: {
      display: 'block',
      width: '100%', // Ensure it takes full width of its container
      maxWidth: '100%', // Ensure it doesn't exceed its container
      border: 'none',
      marginBottom: 16,
      overflow: 'hidden',
      margin: 0, // Explicitly set margin
      padding: 0, // Explicitly set padding
      flexShrink: 0, // Prevent shrinking
    },
    a: { // Add styles for anchor tags to ensure they don't look like default links when rendered as buttons
      textDecorationLine: 'none',
      color: 'inherit',
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors[colorScheme].background }} edges={['bottom']}>
      {!isDesktopWeb && <ArticleHeader />}
      <ScrollView contentContainerStyle={[
        styles.scrollContainer,
        isDesktopWeb && styles.desktopScrollContainer,
      ]}>
        <View style={[
          styles.contentContainer,
          isDesktopWeb && styles.desktopContentContainer,
        ]}>
          {isLoadingContent ? (
            <View>
              <View style={[styles.skeletonTitle, { backgroundColor: Colors[colorScheme].skeletonBackground }]} />
              <View style={[styles.skeletonMeta, { backgroundColor: Colors[colorScheme].skeletonBackground }]} />
              <View style={[styles.skeletonTextLine, { width: '95%', backgroundColor: Colors[colorScheme].skeletonBackground }]} />
              <View style={[styles.skeletonTextLine, { width: '80%', backgroundColor: Colors[colorScheme].skeletonBackground }]} />
              <View style={[styles.skeletonTextLine, { width: '90%', backgroundColor: Colors[colorScheme].skeletonBackground }]} />
              <View style={[styles.skeletonTextLine, { width: '70%', backgroundColor: Colors[colorScheme].skeletonBackground }]} />
              <View style={[styles.skeletonTextLine, { width: '85%', backgroundColor: Colors[colorScheme].skeletonBackground }]} />
              <View style={[styles.skeletonImagePlaceholder, { backgroundColor: Colors[colorScheme].skeletonBackground }]} />
              <View style={[styles.skeletonTextLine, { width: '90%', backgroundColor: Colors[colorScheme].skeletonBackground }]} />
              <View style={[styles.skeletonTextLine, { width: '75%', backgroundColor: Colors[colorScheme].skeletonBackground }]} />
            </View>
          ) : (
            <View style={[styles.titleAndMetaWrapper, isDesktopWeb && styles.desktopTitleAndMetaWrapper]}>
              <Text style={[styles.title, isDesktopWeb && styles.desktopTitle, { color: Colors[colorScheme].text }]}>{decode(article.title)}</Text>
              <View style={[styles.metaSeparator, { backgroundColor: Colors[colorScheme].cardBorder }]} />
              
              {/* Conditional Meta-data Layout */}
              {isDesktopWeb ? (
                <View style={styles.desktopMetaDataContainer}>
                  {/* Category Section */}
                  <View style={styles.desktopCategorySection}>
                    {categoryInitial ? (
                      <View
                        style={[
                          styles.categoryInitialCircle,
                          { backgroundColor: Colors[colorScheme].text === Colors.light.text ? '#000' : '#fff' },
                        ]}
                      >
                        <Text style={[styles.categoryInitialText, { color: Colors[colorScheme].text === Colors.light.text ? '#fff' : '#000' }]}>
                          {categoryInitial}
                        </Text>
                      </View>
                    ) : null}
                    <Text
                      style={[
                        styles.cardCategory,
                        { color: Colors[colorScheme].text, opacity: 0.7 },
                      ]}
                    >
                      {displayCategory ? displayCategory.charAt(0).toUpperCase() + displayCategory.slice(1) : ''}
                    </Text>
                  </View>

                  {/* Date and Author Section - Centered horizontally */}
                  <View style={styles.desktopDateAuthorCenteredWrapper}>
                    <View style={styles.desktopDateAuthorInner}>
                      <Text
                        style={[
                          styles.cardCreator,
                          { color: Colors[colorScheme].text, opacity: 0.7, marginRight: 20 },
                        ]}
                      >
                        {article.creator}
                      </Text>
                      <View style={styles.dateSection}>
                        <Clock size={16} color={Colors[colorScheme].text} style={styles.clockIcon} />
                        <Text style={[styles.dateText, { color: Colors[colorScheme].text, opacity: 0.7 }]}>
                          {formattedDate}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ) : (
                /* Mobile Meta-data Layout */
                <View style={[styles.articleMetaSection]}>
                  <View style={styles.articleFooter}>
                    <View style={styles.categoryAuthorSection}>
                      {categoryInitial ? (
                        <View
                          style={[
                            styles.categoryInitialCircle,
                            { backgroundColor: Colors[colorScheme].text === Colors.light.text ? '#000' : '#fff' },
                          ]}
                        >
                          <Text style={[styles.categoryInitialText, { color: Colors[colorScheme].text === Colors.light.text ? '#fff' : '#000' }]}>
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

                    <View style={styles.dateSection}>
                      <Clock size={16} color={Colors[colorScheme].text} style={styles.clockIcon} />
                      <Text style={[styles.dateText, { color: Colors[colorScheme].text, opacity: 0.7 }]}>
                        {formattedDate}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {!isLoadingContent && firstMediaData && (
          <View style={styles.firstMediaWrapper}>
            <FirstMediaComponent mediaData={firstMediaData} />
          </View>
        )}

        {!isLoadingContent && (
          <View style={[
            styles.contentContainer,
            isDesktopWeb && styles.desktopContentContainer,
          ]}>
            <View style={[styles.articleBodyWrapper, isDesktopWeb && styles.desktopArticleBodyWrapper]}>
              {Platform.OS === 'web' ? (
                <WebHtmlRenderer
                  htmlContent={contentHtml}
                  className="article-content"
                  style={{
                    width: renderHtmlContentWidth,
                    paddingHorizontal: 0,
                    marginHorizontal: 0,
                    alignItems: 'flex-start',
                    paddingLeft: isDesktopWeb ? DESKTOP_TEXT_COLUMN_LEFT_OFFSET : 0,
                  }}
                />
              ) : (
                <RenderHTML
                  contentWidth={renderHtmlContentWidth}
                  source={{ html: contentHtml }}
                  tagsStyles={tagsStyles as any}
                  renderers={renderers as any}
                  enableExperimentalMarginCollapsing={true}
                  baseStyle={{
                    width: renderHtmlContentWidth,
                    paddingHorizontal: 0,
                    marginHorizontal: 0,
                    alignItems: 'flex-start', // Ensure the container itself aligns children left
                  }}
                />
              )}
            </View>

            {Platform.OS === 'web' && (
              <View style={[styles.commentsButtonWrapper, isDesktopWeb && styles.desktopCommentsButtonWrapper]}>
                <View style={[styles.commentsButtonInnerWrapper]}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.commentsButton,
                      {
                        backgroundColor: pressed
                          ? Colors[colorScheme].commentsButtonBackgroundPressed
                          : Colors[colorScheme].commentsButtonBackground,
                      },
                    ]}
                    onPress={() => {
                      if (article.link) {
                        Linking.openURL(`${article.link}#comments`);
                      }
                    }}
                  >
                    <Text style={[styles.commentsButtonText, { color: Colors[colorScheme].commentsButtonText }]}>Коментирай публикацията в Medium</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}

        {Platform.OS === 'web' && (embeds.length > 0 || isLoadingEmbeds) && (
          <View style={[styles.embedsSection, isDesktopWeb && styles.desktopEmbedsSection]}>
            <View style={[styles.metaSeparator, { backgroundColor: Colors[colorScheme].cardBorder, marginBottom: 32 }]} />
            {isLoadingEmbeds ? (
              <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            ) : (
              embeds.map((embedHtml, index) => (
                <WebHtmlRenderer
                  key={index}
                  htmlContent={embedHtml}
                  className="article-embed"
                  style={isDesktopWeb && { paddingLeft: DESKTOP_TEXT_COLUMN_LEFT_OFFSET }}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>

      {isDesktopWeb && (
        <View
          style={[
            styles.bottomButtonContainer,
            styles.desktopBottomButtonContainer,
          ]}
        >
          <View
            style={[
              styles.shadowWrapper,
              colorScheme === 'dark' ? styles.darkShadowWrapper : styles.lightShadowWrapper,
            ]}
          >
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.bottomButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <BlurView
                intensity={80}
                tint={colorScheme === 'dark' ? 'dark' : 'light'}
                style={styles.bottomButtonBlurView}
              >
                <ChevronLeft size={24} color={Colors[colorScheme].text} />
              </BlurView>
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    paddingTop: 80,
    paddingBottom: 40,
  },
  desktopScrollContainer: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: DESKTOP_CONTENT_MAX_CONTAINER_WIDTH,
    paddingTop: 0,
  },
  contentContainer: {
    paddingHorizontal: 20,
  },
  desktopContentContainer: {
    paddingHorizontal: 16,
  },
  titleAndMetaWrapper: {
  },
  desktopTitleAndMetaWrapper: {
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    marginBottom: 12,
    lineHeight: 28,
  },
  desktopTitle: {
    fontSize: 40,
    fontWeight: 'bold',
    lineHeight: 48,
    marginBottom: 16,
  },
  meta: {
    fontSize: 14,
    marginBottom: 24,
  },
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  skeletonTitle: {
    height: 28,
    width: '90%',
    borderRadius: 4,
    marginBottom: 12,
  },
  skeletonMeta: {
    height: 14,
    width: '50%',
    borderRadius: 4,
    marginBottom: 24,
  },
  skeletonTextLine: {
    height: 18,
    borderRadius: 4,
    marginBottom: 10,
  },
  skeletonImagePlaceholder: {
    width: '100%',
    height: 200,
    marginBottom: 16,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
    overflow: 'hidden',
    // Removed justifyContent: 'center', alignItems: 'center' from here
  },
  centeredImageContainer: { // New style for centered images
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    resizeMode: 'cover',
  },
  imageErrorOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  imageErrorText: {
    // color: '#fff', // Removed hardcoded color, will be set dynamically
    fontSize: 14,
    textAlign: 'center',
  },
  articleMetaSection: {
    marginBottom: 24,
  },
  desktopArticleMetaSection: {
  },
  articleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryAuthorSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryInitialCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8, // Added margin for spacing
  },
  categoryInitialText: {
    fontSize: 12,
    fontWeight: '900',
  },
  categoryAuthorTextContainer: {
    flexDirection: 'column',
  },
  cardCategory: {
    fontSize: 13,
    fontWeight: '400',
  },
  cardCreator: {
    fontSize: 13,
    fontWeight: '400',
  },
  desktopCardCreator: {
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clockIcon: {
    marginRight: 4,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '400',
  },
  metaSeparator: {
    height: 2,
    width: '100%',
    marginBottom: 24,
  },
  articleBodyWrapper: {
  },
  desktopArticleBodyWrapper: {
    width: '100%',
    // paddingLeft: DESKTOP_TEXT_COLUMN_LEFT_OFFSET, // This will be handled by the inner View for web
    alignItems: 'flex-start',
  },
  commentsButtonWrapper: {
    marginTop: 24,
    marginBottom: 40,
  },
  desktopCommentsButtonWrapper: {
    width: '100%',
    paddingLeft: DESKTOP_TEXT_COLUMN_LEFT_OFFSET,
  },
  commentsButtonInnerWrapper: {
    alignItems: 'center',
  },
  commentsButton: {
    paddingVertical: 8, // Smaller padding
    paddingHorizontal: 16, // Smaller padding
    borderRadius: 20, // Adjusted border radius for smaller size
    alignItems: 'center',
    justifyContent: 'center',
    width: 'auto', // Allow width to adjust to content
    // minWidth: 300, // Removed minWidth
  },
  commentsButtonText: {
    color: '#fff',
    fontSize: 14, // Smaller font size
    fontWeight: '600',
    lineHeight: 14, // Explicitly set line height to match font size
  },
  firstMediaWrapper: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: DESKTOP_CONTENT_MAX_CONTAINER_WIDTH,
    marginBottom: 16,
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  desktopBottomButtonContainer: {
    maxWidth: DESKTOP_CONTENT_MAX_CONTAINER_WIDTH,
    alignSelf: 'center',
    left: 'auto',
    right: 'auto',
    paddingHorizontal: 16,
  },
  shadowWrapper: {
    borderRadius: 22,
    width: 44,
    height: 44,
  },
  lightShadowWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  darkShadowWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  bottomButton: {
    borderRadius: 22,
  },
  bottomButtonBlurView: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  desktopMetaDataContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  desktopCategorySection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  desktopDateAuthorCenteredWrapper: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  desktopDateAuthorInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  desktopDateSection: {
    marginRight: 20,
  },
  embedsSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  desktopEmbedsSection: {
    paddingHorizontal: 16,
  },
});