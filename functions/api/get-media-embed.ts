import { load } from 'cheerio';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {}

// Utility to extract YouTube video ID
function getYouTubeVideoId(url: string): string | null {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/i;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}

// Utility to parse a deezer.com URL (e.g., deezer.com/track/ID) for type and ID
function parseDeezerUrlForInfo(url: string): { type: string; id: string } | null {
  if (!url) return null;
  const deezerRegex = /deezer\.com\/(?:en\/)?(track|album|playlist|episode)\/(\d+)/i;
  const match = url.match(deezerRegex);
  if (match) {
    return { type: match[1], id: match[2] };
  }
  return null;
}

/**
 * Attempts to get the Deezer embed HTML from various Deezer-related URLs.
 * Handles direct widget URLs, standard deezer.com URLs (by constructing plugin URL),
 * and resolves link.deezer.com redirects.
 * Also attempts to parse HTML for Deezer iframes, including those from embedly.com.
 */
async function getDeezerEmbedHtml(urlToProcess: string): Promise<string | null> {
  try {
    // 1. Check if it's already a direct Deezer widget URL
    if (urlToProcess.includes('widget.deezer.com/widget/')) {
      return `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="${urlToProcess}"></iframe></div>`;
    }

    // 2. Check if it's a standard Deezer track/album/episode page URL
    const deezerInfo = parseDeezerUrlForInfo(urlToProcess);
    if (deezerInfo) {
      return `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="https://www.deezer.com/plugins/player?format=classic&autoplay=false&playlist=true&width=100%25&height=100%25&color=ff0000&layout=dark&size=medium&type=${deezerInfo.type}&id=${deezerInfo.id}&app_id=1"></iframe></div>`;
    }

    // 3. If it's a link.deezer.com or other redirect, fetch and follow redirects
    let response = await fetch(urlToProcess, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      console.error(`Failed to fetch Deezer URL (after redirect): ${response.status} for ${urlToProcess}`);
      return null;
    }

    const finalUrl = response.url; // This is the URL after all redirects

    // Re-check the final URL for direct widget or standard Deezer page
    if (finalUrl.includes('widget.deezer.com/widget/')) {
      return `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="${finalUrl}"></iframe></div>`;
    }
    const finalDeezerInfo = parseDeezerUrlForInfo(finalUrl);
    if (finalDeezerInfo) {
      return `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="https://www.deezer.com/plugins/player?format=classic&autoplay=false&playlist=true&width=100%25&height=100%25&color=ff0000&layout=dark&size=medium&type=${finalDeezerInfo.type}&id=${finalDeezerInfo.id}&app_id=1"></iframe></div>`;
    }

    // 4. If still no direct Deezer embed, parse the HTML content of the final URL
    const htmlContent = await response.text();
    const $$ = load(htmlContent);

    // Look for iframes within the fetched HTML
    const iframe = $$('iframe').first();
    if (iframe.length > 0) {
      const iframeSrc = iframe.attr('src');
      if (iframeSrc) {
        // If the iframe src is an embedly iframe, try to extract the inner src
        if (iframeSrc.includes('cdn.embedly.com/widgets/media.html')) {
          const embedlyUrl = new URL(iframeSrc);
          const innerSrcParam = embedlyUrl.searchParams.get('src');
          if (innerSrcParam) {
            const decodedInnerSrc = decodeURIComponent(innerSrcParam);
            // Recursively call getDeezerEmbedHtml on the decoded inner src
            // This handles cases where embedly points to another Deezer link
            return await getDeezerEmbedHtml(decodedInnerSrc);
          }
        }
        // If it's a direct Deezer widget iframe, use it
        if (iframeSrc.includes('widget.deezer.com/widget/')) {
          return `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="${iframeSrc}"></iframe></div>`;
        }
      }
    }

    return null; // No Deezer embed found or constructed
  } catch (error) {
    console.error(`Error getting Deezer embed for ${urlToProcess}:`, error);
    return null;
  }
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
      // Try to resolve as Deezer first, using the new comprehensive function
      const deezerEmbed = await getDeezerEmbedHtml(mediaUrl);
      if (deezerEmbed) {
        embedHtml = deezerEmbed;
      } else {
        // Fallback for other embeds (Twitter, etc.)
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
                // If it's an embedly iframe, try to extract the inner src
                if (extractedSrc.includes('cdn.embedly.com/widgets/media.html')) {
                  const embedlyUrl = new URL(extractedSrc);
                  const innerSrcParam = embedlyUrl.searchParams.get('src');
                  if (innerSrcParam) {
                    const decodedInnerSrc = decodeURIComponent(innerSrcParam);
                    // If the inner src is a Deezer link, it should have been caught by getDeezerEmbedHtml already.
                    // If not, it's some other embedly type, so use the embedly iframe itself.
                    embedHtml = `<div class="video-responsive"><iframe src="${extractedSrc}" frameborder="0" allowfullscreen></iframe></div>`;
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
              // Fallback to looking for document.write in script tags
              const scriptElements = $$('script');
              let foundScriptEmbed = false;
              for (let i = 0; i < scriptElements.length; i++) {
                const scriptContent = $$(scriptElements[i]).html();
                if (scriptContent) {
                  const writeMatch = scriptContent.match(/document\.write\("(.*)"\)/);
                  if (writeMatch && writeMatch[1]) {
                    const decodedHtml = writeMatch[1]
                      .replace(/\\"/g, '"')
                      .replace(/\\'/g, "'")
                      .replace(/\\\//g, '/');
                    
                    if (decodedHtml.includes('twitter-tweet')) {
                      isTwitterEmbed = true;
                      embedHtml = decodedHtml;
                      foundScriptEmbed = true;
                      break; // Found a Twitter embed, stop
                    } else if (decodedHtml.includes('<iframe')) {
                      const iframeSrcMatch = decodedHtml.match(/<iframe[^>]+src="([^">]+)"/);
                      if (iframeSrcMatch) {
                        // If it's an iframe, try to resolve it as Deezer or wrap as generic video
                        const deezerHtml = await getDeezerEmbedHtml(iframeSrcMatch[1]);
                        if (deezerHtml) {
                          embedHtml = deezerHtml;
                          foundScriptEmbed = true;
                          break; // Found a Deezer embed, stop
                        } else {
                          embedHtml = `<div class="video-responsive">${decodedHtml}</div>`;
                          foundScriptEmbed = true;
                          break; // Found a generic iframe, stop
                        }
                      } else {
                        embedHtml = `<div class="video-responsive">${decodedHtml}</div>`;
                        foundScriptEmbed = true;
                        break; // Found a generic iframe, stop
                      }
                    } else {
                      embedHtml = decodedHtml; // Other content from document.write
                      foundScriptEmbed = true;
                      break; // Found something, stop
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error(`Error processing media link ${mediaUrl}:`, e);
          embedHtml = null;
        }
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