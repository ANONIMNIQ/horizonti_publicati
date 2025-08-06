import { load } from 'cheerio';
import type { PagesFunction } from '@cloudflare/workers-types';

interface Env {}

// Utility to extract YouTube video ID
function getYouTubeVideoId(url: string): string | null {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/i;
  const match = url.match(youtubeRegex);
  return match ? match[1] : null;
}

/**
 * Attempts to find and return the Deezer embed HTML (iframe) from a given URL.
 * This function will follow redirects and scrape the final page for the actual widget iframe.
 */
async function getDeezerEmbedHtml(urlToProcess: string): Promise<string | null> {
  try {
    // Step 1: Fetch the URL and follow redirects
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

    // Step 2: Check if the final URL is already a direct Deezer widget URL
    if (finalUrl.includes('widget.deezer.com/widget/')) {
      return `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="${finalUrl}"></iframe></div>`;
    }

    // Step 3: If not a direct widget, parse the HTML content of the final URL
    // This covers deezer.com/track/ID pages and embedly.com iframes
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
            // If the decoded inner src is a Deezer widget URL, use it
            if (decodedInnerSrc.includes('widget.deezer.com/widget/')) {
              return `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="${decodedInnerSrc}"></iframe></div>`;
            }
            // Otherwise, if it's a standard deezer.com link, try to get its embed HTML recursively
            // This handles cases where embedly points to a deezer.com/track/ID page
            if (decodedInnerSrc.includes('deezer.com/')) {
                return await getDeezerEmbedHtml(decodedInnerSrc); // Recursive call
            }
          }
        }
        // If it's a direct Deezer widget iframe, use it
        if (iframeSrc.includes('widget.deezer.com/widget/')) {
          return `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="${iframeSrc}"></iframe></div>`;
        }
      }
    }

    // Step 4: If no iframe found, or iframe not a Deezer widget, check for script tags with document.write
    // This is less common for Deezer but good for general embeds
    const scriptElements = $$('script');
    for (let i = 0; i < scriptElements.length; i++) {
      const scriptContent = $$(scriptElements[i]).html();
      if (scriptContent) {
        const writeMatch = scriptContent.match(/document\.write\("(.*)"\)/);
        if (writeMatch && writeMatch[1]) {
          const decodedHtml = writeMatch[1]
            .replace(/\\"/g, '"')
            .replace(/\\'/g, "'")
            .replace(/\\\//g, '/');
          
          // Check if the decoded HTML contains a Deezer widget iframe
          const iframeSrcMatch = decodedHtml.match(/<iframe[^>]+src="([^">]+)"/);
          if (iframeSrcMatch && iframeSrcMatch[1].includes('widget.deezer.com/widget/')) {
            return `<div class="deezer-responsive">${decodedHtml}</div>`;
          }
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