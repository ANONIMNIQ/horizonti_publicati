import { useState, useEffect } from 'react';
import { Article } from '@/types';
import { load } from 'cheerio';

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

        const processedArticles = await Promise.all(
          data.items.map(async (item: any): Promise<Article> => {
            let contentHtml = item.content;
            const $ = load(contentHtml);
            const mediaLinks: string[] = [];
            
            // Find all medium.com/media links
            $('a[href*="medium.com/media"]').each((i, el) => {
              const href = $(el).attr('href');
              if (href) {
                mediaLinks.push(href);
              }
            });

            // Fetch each media link to get the actual embed code
            const embedPromises = mediaLinks.map(async (link) => {
              try {
                const mediaResponse = await fetch(link);
                if (!mediaResponse.ok) return null;
                const mediaHtml = await mediaResponse.text();
                const $$ = load(mediaHtml);
                // The embed code is usually inside a <script> tag in the response
                const scriptContent = $$('script').html();
                if (scriptContent) {
                  // Extract the content of document.write()
                  const writeMatch = scriptContent.match(/document\.write\("(.*)"\)/);
                  if (writeMatch && writeMatch[1]) {
                    // Decode the escaped HTML string
                    const decodedHtml = writeMatch[1]
                      .replace(/\\"/g, '"')
                      .replace(/\\'/g, "'")
                      .replace(/\\\//g, '/');
                    return decodedHtml;
                  }
                }
                return null;
              } catch (e) {
                console.error(`Failed to fetch embed from ${link}`, e);
                return null;
              }
            });

            const resolvedEmbeds = (await Promise.all(embedPromises)).filter(Boolean) as string[];

            // Remove the figure/links from the main content that we just processed
            $('figure').remove();

            return {
              guid: item.guid,
              link: item.link,
              title: item.title,
              pubDate: item.pubDate,
              creator: item.author,
              content: item.description,
              isoDate: item.pubDate,
              'content:encoded': $.html(), // Use the cleaned HTML
              categories: (item.categories || []).map((cat: string) => cat.toLowerCase()),
              fullContent: $.html(),
              embeds: resolvedEmbeds,
            };
          })
        );

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