import { load } from 'cheerio';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {}

// Utility to extract YouTube video ID
function getYouTubeVideoId(url: string): string | null {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/i;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}

// Utility to extract Deezer ID (track, album, playlist)
function getDeezerId(url: string): { type: string; id: string } | null {
  const trackMatch = url.match(/deezer\.com\/track\/(\d+)/);
  if (trackMatch) return { type: 'track', id: trackMatch[1] };
  const albumMatch = url.match(/deezer\.com\/album\/(\d+)/);
  if (albumMatch) return { type: 'album', id: albumMatch[1] };
  const playlistMatch = url.match(/deezer\.com\/playlist\/(\d+)/);
  if (playlistMatch) return { type: 'playlist', id: playlistMatch[1] };
  return null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  try {
    const url = new URL(request.url);
    let mediaUrl = url.searchParams.get('mediaUrl'); // Expecting a single media URL

    if (!mediaUrl) {
      return new Response(JSON.stringify({ error: 'Missing mediaUrl' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }) as unknown as import("@cloudflare/workers-types").Response; // Explicit cast
    }

    const youtubeId = getYouTubeVideoId(mediaUrl);
    const deezerInfo = getDeezerId(mediaUrl);
    let embedHtml: string | null = null;
    let isTwitterEmbed = false;

    if (youtubeId) {
      // Wrap YouTube iframe in a responsive container
      embedHtml = `<div class="video-responsive"><iframe width="560" height="315" src="https://www.youtube.com/embed/${youtubeId}?autoplay=0&modestbranding=1&rel=0" frameborder="0" allowfullscreen></iframe></div>`;
    } else if (deezerInfo) {
      embedHtml = `<iframe scrolling="no" frameborder="0" allowTransparency="true" src="https://www.deezer.com/plugins/player?format=classic&autoplay=false&playlist=true&width=700&height=350&color=ff0000&layout=dark&size=medium&type=${deezerInfo.type}s&id=${deezerInfo.id}&app_id=1"></iframe>`;
    } else {
      // Fallback for other embeds: fetch the media link and extract embed code
      try {
        let currentFetchUrl = mediaUrl;
        let mediaResponse = await fetch(currentFetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          redirect: 'follow' // Ensure redirects are followed
        });

        // If there was a redirect, update the URL to the final destination
        if (mediaResponse.redirected) {
          currentFetchUrl = mediaResponse.url;
          // Re-check for YouTube/Deezer if it redirected to a direct media link
          const redirectedYoutubeId = getYouTubeVideoId(currentFetchUrl);
          const redirectedDeezerInfo = getDeezerId(currentFetchUrl);
          if (redirectedYoutubeId) {
            embedHtml = `<div class="video-responsive"><iframe width="560" height="315" src="https://www.youtube.com/embed/${redirectedYoutubeId}?autoplay=0&modestbranding=1&rel=0" frameborder="0" allowfullscreen></iframe></div>`;
            return new Response(JSON.stringify({ embedHtml, isTwitterEmbed }), {
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            }) as unknown as import("@cloudflare/workers-types").Response;
          } else if (redirectedDeezerInfo) {
            embedHtml = `<iframe scrolling="no" frameborder="0" allowTransparency="true" src="https://www.deezer.com/plugins/player?format=classic&autoplay=false&playlist=true&width=700&height=350&color=ff0000&layout=dark&size=medium&type=${redirectedDeezerInfo.type}s&id=${redirectedDeezerInfo.id}&app_id=1"></iframe>`;
            return new Response(JSON.stringify({ embedHtml, isTwitterEmbed }), {
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            }) as unknown as import("@cloudflare/workers-types").Response;
          }
        }

        if (!mediaResponse.ok) {
          console.warn(`Failed to fetch media link ${mediaUrl}: ${mediaResponse.statusText}`);
          embedHtml = null;
        } else {
          const mediaHtml = await mediaResponse.text();
          const $$ = load(mediaHtml);
          
          // 1. Look for direct iframe or blockquote embeds
          const directEmbed = $$('iframe, blockquote.twitter-tweet, div.twitter-tweet').first();
          if (directEmbed.length > 0) {
            embedHtml = directEmbed.html();
            if (directEmbed.hasClass('twitter-tweet')) {
              isTwitterEmbed = true;
            }
            // If it's an iframe, wrap it for responsiveness
            if (directEmbed.is('iframe')) {
              embedHtml = `<div class="video-responsive">${embedHtml}</div>`;
            }
          } else {
            // 2. Fallback to looking for document.write in script tags
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
                  // If the decoded HTML contains an iframe, wrap it
                  if (decodedHtml.includes('<iframe')) {
                    embedHtml = `<div class="video-responsive">${embedHtml}</div>`;
                  }
                  // Found it, no need to continue
                  return false; // Break out of .each loop
                }
              }
            });
          }
        }
      } catch (e) {
        console.error(`Error processing media link ${mediaUrl}:`, e);
        embedHtml = null;
      }
    }

    return new Response(JSON.stringify({ embedHtml, isTwitterEmbed }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
    }) as unknown as import("@cloudflare/workers-types").Response; // Explicit cast
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    }) as unknown as import("@cloudflare/workers-types").Response; // Explicit cast
  }
};