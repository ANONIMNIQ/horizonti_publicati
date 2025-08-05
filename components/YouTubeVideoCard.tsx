import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Linking,
  ActivityIndicator,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { PlayCircle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { DESKTOP_CONTENT_MAX_CONTAINER_WIDTH } from '@/constants/Layout';

interface YouTubeVideoCardProps {
  videoId?: string;
  videoUrl?: string; // Can also accept a full YouTube URL
}

interface YouTubeOEmbedData {
  title: string;
  author_name: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  html: string; // Contains the iframe embed code
}

// Utility to extract video ID from various YouTube URLs
function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/i;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}

const DESKTOP_TEXT_CONTENT_WIDTH = 584;

const YouTubeVideoCard: React.FC<YouTubeVideoCardProps> = ({ videoId, videoUrl }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const { width: screenWidth } = useWindowDimensions();
  const { isDesktopWeb } = useResponsiveLayout();

  const [videoData, setVideoData] = useState<YouTubeOEmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const finalVideoId = videoId || (videoUrl ? getYouTubeVideoId(videoUrl) : null);
  const youtubeWatchUrl = finalVideoId ? `https://www.youtube.com/watch?v=${finalVideoId}` : null;

  let cardWidth;
  let cardStyle = {};

  if (isDesktopWeb) {
    cardWidth = DESKTOP_TEXT_CONTENT_WIDTH;
    cardStyle = {
      marginRight: 0,
    };
  } else {
    cardWidth = screenWidth - 40;
  }

  useEffect(() => {
    if (!youtubeWatchUrl) {
      setError(true);
      setLoading(false);
      return;
    }

    const fetchVideoData = async () => {
      setLoading(true);
      setError(false);
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeWatchUrl)}&format=json`;
        const response = await fetch(oembedUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: YouTubeOEmbedData = await response.json();
        setVideoData(data);
      } catch (e) {
        console.error('Failed to fetch YouTube video data:', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchVideoData();
  }, [youtubeWatchUrl]);

  const handlePress = () => {
    if (youtubeWatchUrl) {
      Linking.openURL(youtubeWatchUrl).catch((err) => console.error('Failed to open URL:', err));
    }
  };

  if (loading) {
    return (
      <View style={[styles.cardContainer, { width: cardWidth, height: cardWidth * (9 / 16), backgroundColor: Colors[colorScheme].cardBorder }, cardStyle]}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
        <Text style={[styles.loadingText, { color: Colors[colorScheme].text }]}>Loading video info...</Text>
      </View>
    );
  }

  if (error || !videoData) {
    return (
      <Pressable onPress={handlePress} style={[styles.cardContainer, { width: cardWidth, height: cardWidth * (9 / 16), backgroundColor: Colors[colorScheme].cardBorder }, cardStyle]}>
        <Text style={[styles.errorText, { color: Colors[colorScheme].text }]}>
          Failed to load video. Tap to open on YouTube.
        </Text>
      </Pressable>
    );
  }

  const aspectRatio = videoData.thumbnail_width && videoData.thumbnail_height
    ? videoData.thumbnail_height / videoData.thumbnail_width
    : 9 / 16;
  const cardHeight = cardWidth * aspectRatio;

  return (
    <Pressable onPress={handlePress} style={[styles.cardContainer, { width: cardWidth, height: cardHeight }, cardStyle]}>
      <Image
        source={{ uri: videoData.thumbnail_url }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.overlay}>
        <PlayCircle size={64} color="white" fill="rgba(0,0,0,0.6)" />
      </View>
      <View style={[styles.titleContainer, { backgroundColor: Colors[colorScheme].cardBackground }]}>
        <Text style={[styles.title, { color: Colors[colorScheme].text }]} numberOfLines={2}>
          {videoData.title}
        </Text>
        <Text style={[styles.author, { color: Colors[colorScheme].text, opacity: 0.7 }]} numberOfLines={1}>
          {videoData.author_name}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  author: {
    fontSize: 13,
    fontWeight: '400',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    padding: 10,
  },
});

export default YouTubeVideoCard;
