import { useState, useEffect } from 'react';
import { Article } from '@/types';

const MEDIUM_RSS_FEED_URL = 'https://medium.com/feed/horizonti';
const RSS2JSON_API_URL_BASE = 'https://api.rss2json.com/v1/api.json?rss_url=';

export interface Feed {
  url: string;
  title: string;
  link: string;
  author: string;
  description: string;
  image: string;
}

// Utility function to extract YouTube video ID from various YouTube URLs
export function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/i;
  const match = url.match(youtubeRegex);
  console.log('getYouTubeVideoId: Input URL:', url, 'Match:', match ? match[1] : 'No match'); // Debugging log
  return match ? match[1] : null;
}

// Utility to extract the actual YouTube URL from a Medium redirect link
export function extractActualYouTubeUrl(mediumRedirectUrl: string): string | null {
  // This regex aims to capture the *actual* YouTube URL that is embedded within the Medium redirect.
  // It looks for:
  // 1. The Medium media prefix: https://medium.com/media/a_long_hash/
  // 2. Followed by the actual YouTube URL (http or https, www. or not, youtube.com or youtu.be,
  //    and then the path which could be watch?v= or embed/ or v/ followed by the video ID).
  const regex = /https:\/\/medium\.com\/media\/[^/]+\/(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|playlist\?list=)?[\w-]{11}(?:[?&][^\s"]*)?)/i;
  const match = mediumRedirectUrl.match(regex);
  return match ? match[1] : null; // Capture group 1 is the full YouTube URL
}

export function useRssFeed() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        // Append a timestamp to the URL to act as a cache buster for proxies and the server.
        const RSS2JSON_API_URL = `${RSS2JSON_API_URL_BASE}${encodeURIComponent(
          MEDIUM_RSS_FEED_URL
        )}&t=${new Date().getTime()}`;

        console.log('Fetching RSS feed from rss2json:', RSS2JSON_API_URL);
        
        // Set cache policy to 'no-store' to prevent the browser from caching the response.
        const response = await fetch(RSS2JSON_API_URL, {
          cache: 'no-store',
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch RSS feed from rss2json. Status: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'ok') {
          throw new Error(data.message || 'Failed to fetch RSS feed from rss2json (status not ok)');
        }
        
        setFeed(data.feed);

        const fetchedArticles: Article[] = [];

        for (const item of data.items) {
          let processedContent = item.content;

          // 1. Process <a> tags with Medium media redirect links
          const mediumYoutubeLinkRegex = /<a\s+([^>]*?)href="(https:\/\/medium\.com\/media\/[^"]+)"([^>]*?)>(.*?)<\/a>/gi;
          processedContent = processedContent.replace(mediumYoutubeLinkRegex, (fullMatch: string, beforeHref: string, mediumHref: string, afterHref: string, linkContent: string) => {
            const actualYoutubeUrl = extractActualYouTubeUrl(mediumHref);
            if (actualYoutubeUrl) {
              // Replace the Medium redirect link with the actual YouTube URL
              console.log('useRssFeed: Transformed <a> href from Medium redirect to actual YouTube URL:', actualYoutubeUrl); // Debugging log
              return `<a ${beforeHref}href="${actualYoutubeUrl}"${afterHref}>${linkContent}</a>`;
            }
            return fullMatch; // If not a YouTube redirect, keep the original link
          });

          // 2. Process <iframe> tags with Medium media redirect links in their src
          const mediumIframeSrcRegex = /<iframe\s+([^>]*?)src="(https:\/\/medium\.com\/media\/[^"]+)"([^>]*?)>/gi;
          processedContent = processedContent.replace(mediumIframeSrcRegex, (fullMatch: string, beforeSrc: string, mediumSrc: string, afterSrc: string) => {
            const actualYoutubeUrl = extractActualYouTubeUrl(mediumSrc);
            if (actualYoutubeUrl) {
              // Replace the Medium redirect src with the actual YouTube embed URL
              const youtubeEmbedId = getYouTubeVideoId(actualYoutubeUrl);
              if (youtubeEmbedId) {
                console.log('useRssFeed: Transformed <iframe> src from Medium redirect to actual YouTube embed URL:', `https://www.youtube.com/embed/${youtubeEmbedId}?autoplay=0&modestbranding=1&rel=0`); // Debugging log
                return `<iframe ${beforeSrc}src="https://www.youtube.com/embed/${youtubeEmbedId}?autoplay=0&modestbranding=1&rel=0"${afterSrc}>`;
              }
            }
            return fullMatch; // If not a YouTube redirect, keep the original iframe
          });

          fetchedArticles.push({
            guid: item.guid,
            link: item.link,
            title: item.title,
            pubDate: item.pubDate,
            creator: item.author,
            content: item.description,
            isoDate: item.pubDate,
            'content:encoded': processedContent,
            categories: (item.categories || []).map((cat: string) => cat.toLowerCase()),
            fullContent: processedContent,
          });
        }

        setArticles(fetchedArticles);
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