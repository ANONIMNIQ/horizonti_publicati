import { load } from 'cheerio';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {}

// Utility to extract YouTube video ID
function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/i;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}

// Utility to extract Deezer ID (track, album, playlist)
function getDeezerId(url: string): { type: string; id: string } | null {
  if (!url) return null;
  const trackMatch = url.match(/deezer\.com\/track\/(\d+)/);
  if (trackMatch) return { type: 'track', id: trackMatch[1] };
  const albumMatch = url.match(/deezer\.com\/album\/(\d+)/);
  if (albumMatch) return { type: 'album', id: albumMatch[1] };
  const playlistMatch = url.match(/deezer\.com\/playlist\/(\d+)/);
  if (playlistMatch) return { type: 'playlist', id: playlistMatch[1] };
  return null;
}

// Utility to extract Apple Podcast info
function getApplePodcastInfo(url: string): { podcastId: string; episodeId: string; country: string } | null {
  if (!url) return null;
  const applePodcastRegex = /https:\/\/podcasts\.apple\.com\/([a-z]{2})\/podcast\/[^/]+\/id(\d+)(?:\?i=(\d+))?/i;
  const match = url.match(applePodcastRegex);
  if (match) {
    return {
      country: match[1],
      podcastId: match[2],
      episodeId: match[3] || '', // Episode ID might be optional for podcast links
    };
  }
  return null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  try {
    const url = new URL(request.url);
    let mediaUrl = url.searchParams.get('mediaUrl'); // Expecting a single Medium media URL

    if (!mediaUrl) {
      return new Response(JSON.stringify({ error: 'Missing mediaUrl' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }) as unknown as import("@cloudflare/workers-types").Response;
    }

    let embedHtml: string | null = null;
    let isTwitterEmbed = false;

    try {
        // Fetch the Medium media page
        const mediaResponse = await fetch(mediaUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            redirect: 'follow' // Ensure redirects are followed
        });

        if (!mediaResponse.ok) {
            console.warn(`Failed to fetch media link ${mediaUrl}: ${mediaResponse.statusText}`);
            return new Response(JSON.stringify({ embedHtml: null, isTwitterEmbed: false }), {
                status: 200, // Return 200 even on failure to avoid breaking the client
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
        }

        const mediaHtml = await mediaResponse.text();
        const $$ = load(mediaHtml);

        // --- Step 1: Prioritize direct embeds from iframes or oEmbed data within the Medium page ---
        let foundSpecificEmbed = false;

        // Check for YouTube iframes
        $$('iframe').each((i, el) => {
            const iframeSrc = $$(el).attr('src');
            if (iframeSrc) {
                const youtubeId = getYouTubeVideoId(iframeSrc);
                if (youtubeId) {
                    embedHtml = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${youtubeId}?autoplay=0&modestbranding=1&rel=0" frameborder="0" allowfullscreen></iframe>`;
                    foundSpecificEmbed = true;
                    return false; // Break out of .each loop
                }
            }
        });

        if (!foundSpecificEmbed) {
            // Check for Deezer iframes
            $$('iframe').each((i, el) => {
                const iframeSrc = $$(el).attr('src');
                if (iframeSrc && iframeSrc.includes('deezer.com/plugins/player')) {
                    embedHtml = $$(el).prop('outerHTML');
                    foundSpecificEmbed = true;
                    return false;
                }
            });
        }

        if (!foundSpecificEmbed) {
            // Check for Apple Podcast iframes
            $$('iframe').each((i, el) => {
                const iframeSrc = $$(el).attr('src');
                if (iframeSrc && iframeSrc.includes('podcasts.apple.com/embed')) {
                    embedHtml = $$(el).prop('outerHTML');
                    foundSpecificEmbed = true;
                    return false;
                }
            });
        }

        // --- Step 2: If no specific iframe, look for Twitter blockquotes ---
        if (!foundSpecificEmbed) {
            const twitterBlockquote = $$('blockquote.twitter-tweet, div.twitter-tweet').first();
            if (twitterBlockquote.length > 0) {
                embedHtml = twitterBlockquote.prop('outerHTML');
                isTwitterEmbed = true;
                foundSpecificEmbed = true;
            }
        }

        // --- Step 3: Fallback to document.write in script tags if nothing else found ---
        if (!foundSpecificEmbed) {
            $$('script').each((i, el) => {
                const scriptContent = $$(el).html();
                if (scriptContent) {
                    const writeMatch = scriptContent.match(/document\.write\("(.*)"\)/);
                    if (writeMatch && writeMatch[1]) {
                        const decodedHtml = writeMatch[1]
                            .replace(/\\"/g, '"')
                            .replace(/\\'/g, "'")
                            .replace(/\\\//g, '/');
                        embedHtml = decodedHtml;
                        if (decodedHtml.includes('twitter-tweet')) {
                            isTwitterEmbed = true;
                        }
                        foundSpecificEmbed = true;
                        return false; // Break out of .each loop
                    }
                }
            });
        }

    } catch (e) {
        console.error(`Error processing media link ${mediaUrl}:`, e);
        embedHtml = null;
    }

    return new Response(JSON.stringify({ embedHtml, isTwitterEmbed }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    }) as unknown as import("@cloudflare/workers-types").Response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    }) as unknown as import("@cloudflare/workers-types").Response;
  }
};