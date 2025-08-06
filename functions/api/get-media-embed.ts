import { load } from 'cheerio';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {}

// Utility to extract YouTube video ID
function getYouTubeVideoId(url: string): string | null {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/i;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}

// Utility to extract Deezer ID (track, album, playlist, episode)
function getDeezerId(url: string): { type: string; id: string } | null {
  if (!url) return null;
  // Regex for deezer.com/type/ID or widget.deezer.com/widget/dark/type/ID
  const deezerRegex = /(?:deezer\.com\/(?:en\/)?|widget\.deezer\.com\/widget\/(?:dark\/)?)(track|album|playlist|episode)\/(\d+)/i;
  const match = url.match(deezerRegex);
  if (match) {
    return { type: match[1], id: match[2] };
  }
  return null;
}

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  try {
    const url = new URL(request.url);
    let mediaUrl = url.searchParams.get('mediaUrl');

    if (!mediaUrl) {
      return new Response(JSON.stringify({ error: 'Missing mediaUrl' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }) as unknown as import("@cloudflare/workers-types").Response;
    }

    const youtubeId = getYouTubeVideoId(mediaUrl);
    let deezerInfo = getDeezerId(mediaUrl); // Check if mediaUrl is already a direct Deezer link
    let embedHtml: string | null = null;
    let isTwitterEmbed = false;

    if (youtubeId) {
      embedHtml = `<div class="video-responsive"><iframe width="560" height="315" src="https://www.youtube.com/embed/${youtubeId}?autoplay=0&modestbranding=1&rel=0" frameborder="0" allowfullscreen></iframe></div>`;
    } else if (deezerInfo) {
      // Use a specific class for Deezer embeds with 1:1 aspect ratio
      embedHtml = `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="https://www.deezer.com/plugins/player?format=classic&autoplay=false&playlist=true&width=100%25&height=100%25&color=ff0000&layout=dark&size=medium&type=${deezerInfo.type}&id=${deezerInfo.id}&app_id=1"></iframe></div>`;
    } else {
      // Fallback for other embeds: fetch the media link and extract embed code
      try {
        let currentFetchUrl = mediaUrl;
        let mediaResponse = await fetch(currentFetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          },
          redirect: 'follow'
        });

        if (mediaResponse.redirected) {
          currentFetchUrl = mediaResponse.url;
          // Re-check for YouTube/Deezer if it redirected to a direct media link
          const redirectedYoutubeId = getYouTubeVideoId(currentFetchUrl);
          const redirectedDeezerInfo = getDeezerId(currentFetchUrl);
          if (redirectedYoutubeId) {
            embedHtml = `<div class="video-responsive"><iframe width="560" height="315" src="https://www.youtube.com/embed/${redirectedYoutubeId}?autoplay=0&modestbranding=1&rel=0" frameborder="0" allowfullscreen></iframe></div>`;
          } else if (redirectedDeezerInfo) {
            deezerInfo = redirectedDeezerInfo; // Update deezerInfo
            embedHtml = `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="https://www.deezer.com/plugins/player?format=classic&autoplay=false&playlist=true&width=100%25&height=100%25&color=ff0000&layout=dark&size=medium&type=${deezerInfo.type}&id=${deezerInfo.id}&app_id=1"></iframe></div>`;
          }
        }

        if (!embedHtml && mediaResponse.ok) { // Only proceed if embedHtml hasn't been set by direct YouTube/Deezer link
          const mediaHtml = await mediaResponse.text();
          const $$ = load(mediaHtml);
          
          // 1. Look for direct iframe or blockquote embeds
          const directEmbed = $$('iframe, blockquote.twitter-tweet, div.twitter-tweet').first();
          if (directEmbed.length > 0) {
            let extractedSrc = directEmbed.attr('src');
            if (directEmbed.is('iframe') && extractedSrc && extractedSrc.includes('cdn.embedly.com/widgets/media.html')) {
              // This is an embedly iframe, try to extract the inner src
              const embedlyUrl = new URL(extractedSrc);
              const innerSrcParam = embedlyUrl.searchParams.get('src');
              if (innerSrcParam) {
                const decodedInnerSrc = decodeURIComponent(innerSrcParam);
                const embedlyDeezerInfo = getDeezerId(decodedInnerSrc);
                if (embedlyDeezerInfo) {
                  deezerInfo = embedlyDeezerInfo; // Update deezerInfo
                  embedHtml = `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="https://www.deezer.com/plugins/player?format=classic&autoplay=false&playlist=true&width=100%25&height=100%25&color=ff0000&layout=dark&size=medium&type=${deezerInfo.type}&id=${deezerInfo.id}&app_id=1"></iframe></div>`;
                }
              }
            }
            
            if (!embedHtml) { // If not handled as a specific embedly Deezer, use the direct embed
              embedHtml = directEmbed.html();
              if (directEmbed.hasClass('twitter-tweet')) {
                isTwitterEmbed = true;
              }
              // If it's an iframe, wrap it for responsiveness (default 16:9)
              if (directEmbed.is('iframe')) {
                embedHtml = `<div class="video-responsive">${embedHtml}</div>`;
              }
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
    }) as unknown as import("@cloudflare/workers-types").Response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    }) as unknown as import("@cloudflare/workers-types").Response;
  }
};