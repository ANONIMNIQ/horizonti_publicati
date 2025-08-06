import { useState, useEffect } from 'react';
import { Article } from '@/types';

const MEDIUM_RSS_FEED_URL = 'https://medium.com/feed/note-book'; // Temporarily changed for testing
const RSS2JSON_API_URL_BASE = 'https://api.rss2json.com/v1/api.json?rss_url=';

export interface Feed {
  url: string;
  title: string;
  link: string;
  author: string;
  description: string;
  image: string;
}

// Utility to extract video ID from various YouTube URLs
export function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/i;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}

export function useRssFeed() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const RSS2JSON_API_URL = `${RSS2JSON_API_URL_BASE}${encodeURIComponent(
          MEDIUM_RSS_FEED_URL
        )}&t=${new Date().getTime()}`;

        const response = await fetch(RSS2JSON_API_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Failed to fetch RSS feed. Status: ${response.status}`);
        
        const data = await response.json();
        if (data.status !== 'ok') throw new Error(data.message || 'Failed to fetch RSS feed');
        
        setFeed(data.feed);

        const processedArticles = data.items.map((item: any): Article => {
          return {
            guid: item.guid,
            link: item.link,
            title: item.title,
            pubDate: item.pubDate,
            creator: item.author,
            content: item.description,
            isoDate: item.pubDate,
            'content:encoded': item.content, // Keep original content:encoded
            categories: (item.categories || []).map((cat: string) => cat.toLowerCase()),
            fullContent: item.content, // Keep original fullContent
          };
        });

        setArticles(processedArticles);
      } catch (e) {
        console.error('An unexpected error occurred during feed processing:', e);
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, []);

  return { articles, feed, loading, error };
}