import { load } from 'cheerio';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {}

// Utility to extract YouTube video ID from various YouTube URLs
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
        headers: new Headers({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }),
      });
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
                headers: new Headers({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }),
            });
        }

        const mediaHtml = await mediaResponse.text();
        const $$ = load(mediaHtml);

        let foundEmbed = false;

        // 1. Check for iframes first (most common for media embeds)
        $$('iframe').each((i, el) => {
            const iframeSrc = $$(el).attr('src');
            if (iframeSrc) {
                const youtubeId = getYouTubeVideoId(iframeSrc);
                const deezerInfo = getDeezerId(iframeSrc);
                const applePodcastInfo = getApplePodcastInfo(iframeSrc);

                if (youtubeId) {
                    // Construct a clean YouTube embed
                    embedHtml = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${youtubeId}?autoplay=0&modestbranding=1&rel=0" frameborder="0" allowfullscreen></iframe>`;
                    foundEmbed = true;
                    return false; // Break out of .each loop
                } else if (deezerInfo) {
                    // Construct a clean Deezer embed
                    embedHtml = `<iframe scrolling="no" frameborder="0" allowTransparency="true" src="https://www.deezer.com/plugins/player?format=classic&autoplay=false&playlist=true&width=100%&height=350&color=ff0000&layout=dark&size=medium&type=${deezerInfo.type}s&id=${deezerInfo.id}&app_id=1"></iframe>`;
                    foundEmbed = true;
                    return false;
                } else if (applePodcastInfo) {
                    // Construct a clean Apple Podcast embed
                    const embedSrc = `https://embed.podcasts.apple.com/${applePodcastInfo.country}/podcast/id${applePodcastInfo.podcastId}${applePodcastInfo.episodeId ? `?i=${applePodcastInfo.episodeId}` : ''}`;
                    const embedHeight = applePodcastInfo.episodeId ? 175 : 450;
                    embedHtml = `<iframe src="${embedSrc}" height="${embedHeight}" frameborder="0" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation allow-downloads allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation" allow="autoplay *; encrypted-media *; clipboard-write" style="width:100%;max-width:660px;overflow:hidden;border-radius:0;transform:translateZ(0);"></iframe>`;
                    foundEmbed = true;
                    return false;
                }
            }
        });

        // 2. If no specific media iframe, look for Twitter blockquotes
        if (!foundEmbed) {
            const twitterBlockquote = $$('blockquote.twitter-tweet, div.twitter-tweet').first();
            if (twitterBlockquote.length > 0) {
                embedHtml = twitterBlockquote.prop('outerHTML');
                isTwitterEmbed = true;
                foundEmbed = true;
            }
        }

        // 3. Fallback to document.write in script tags (less common but sometimes used)
        if (!foundEmbed) {
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
                        foundEmbed = true;
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
      headers: new Headers({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: new Headers({ 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }),
    });
  }
};