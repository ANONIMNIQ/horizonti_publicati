import { load } from 'cheerio';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {}

// Utility to extract YouTube video ID
function getYouTubeVideoId(url: string): string | null {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/i;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}

// Utility to get the final Deezer embed URL from various Deezer link types
function getFinalDeezerEmbedUrl(url: string): string | null {
  if (!url) return null;

  // Case 1: Already a widget.deezer.com URL
  if (url.includes('widget.deezer.com/widget/')) {
    return url; // Use it directly
  }

  // Case 2: deezer.com/type/ID URL, needs conversion to widget URL
  const deezerRegex = /deezer\.com\/(?:en\/)?(track|album|playlist|episode)\/(\d+)/i;
  const match = url.match(deezerRegex);
  if (match) {
    const type = match[1];
    const id = match[2];
    // Construct the widget URL. app_id=1 is a generic ID, often required.
    return `https://www.deezer.com/plugins/player?format=classic&autoplay=false&playlist=true&width=100%25&height=100%25&color=ff0000&layout=dark&size=medium&type=${type}&id=${id}&app_id=1`;
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
    let embedHtml: string | null = null;
    let isTwitterEmbed = false;

    if (youtubeId) {
      embedHtml = `<div class="video-responsive"><iframe width="560" height="315" src="https://www.youtube.com/embed/${youtubeId}?autoplay=0&modestbranding=1&rel=0" frameborder="0" allowfullscreen></iframe></div>`;
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
          // Re-check for YouTube if it redirected to a direct YouTube link
          const redirectedYoutubeId = getYouTubeVideoId(currentFetchUrl);
          if (redirectedYoutubeId) {
            embedHtml = `<div class="video-responsive"><iframe width="560" height="315" src="https://www.youtube.com/embed/${redirectedYoutubeId}?autoplay=0&modestbranding=1&rel=0" frameborder="0" allowfullscreen></iframe></div>`;
          }
        }

        if (!embedHtml && mediaResponse.ok) {
          const mediaHtml = await mediaResponse.text();
          const $$ = load(mediaHtml);
          
          const directEmbed = $$('iframe, blockquote.twitter-tweet, div.twitter-tweet').first();
          if (directEmbed.length > 0) {
            let extractedSrc = directEmbed.attr('src');
            if (directEmbed.is('iframe') && extractedSrc) {
              if (extractedSrc.includes('cdn.embedly.com/widgets/media.html')) {
                const embedlyUrl = new URL(extractedSrc);
                const innerSrcParam = embedlyUrl.searchParams.get('src');
                if (innerSrcParam) {
                  const decodedInnerSrc = decodeURIComponent(innerSrcParam);
                  const finalDeezerSrc = getFinalDeezerEmbedUrl(decodedInnerSrc); // Use the new helper
                  if (finalDeezerSrc) {
                    embedHtml = `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="${finalDeezerSrc}"></iframe></div>`;
                  } else {
                    // If it's an iframe from embedly but not a recognized Deezer, use the embedly iframe itself
                    embedHtml = `<div class="video-responsive"><iframe src="${extractedSrc}" frameborder="0" allowfullscreen></iframe></div>`;
                  }
                }
              } else {
                // If it's a direct iframe (not from embedly), wrap it for responsiveness
                embedHtml = `<div class="video-responsive"><iframe src="${extractedSrc}" frameborder="0" allowfullscreen></iframe></div>`;
              }
            } else if (directEmbed.hasClass('twitter-tweet')) {
              embedHtml = directEmbed.html();
              isTwitterEmbed = true;
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
                    const iframeSrcMatch = decodedHtml.match(/<iframe[^>]+src="([^">]+)"/);
                    if (iframeSrcMatch) {
                      const finalDeezerSrc = getFinalDeezerEmbedUrl(iframeSrcMatch[1]);
                      if (finalDeezerSrc) {
                        embedHtml = `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="${finalDeezerSrc}"></iframe></div>`;
                      } else {
                        embedHtml = `<div class="video-responsive">${decodedHtml}</div>`;
                      }
                    } else {
                      embedHtml = `<div class="video-responsive">${decodedHtml}</div>`;
                    }
                  }
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