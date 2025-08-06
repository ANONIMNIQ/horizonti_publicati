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
  // Regex to capture track, album, playlist, episode and their IDs
  const deezerRegex = /deezer\.com\/(?:en\/)?(track|album|playlist|episode)\/(\d+)/i;
  const match = url.match(deezerRegex);
  if (match) {
    return { type: match[1], id: match[2] };
  }
  return null;
}

// Utility to parse a spotify.com URL for type and ID
function parseSpotifyUrlForInfo(url: string): { type: string; id: string } | null {
  if (!url) return null;
  const spotifyRegex = /open\.spotify\.com\/(track|episode|album|playlist)\/([a-zA-Z0-9]+)/i;
  const match = url.match(spotifyRegex);
  if (match) {
    return { type: match[1], id: match[2] };
  }
  return null;
}

/**
 * Attempts to get the Deezer embed HTML (iframe) from a given URL.
 * This function will prioritize constructing the official widget.deezer.com/widget/auto URL.
 */
async function getDeezerEmbedHtml(urlToProcess: string): Promise<string | null> {
  try {
    // Step 1: Fetch the URL and follow redirects to get the final Deezer page URL
    let response = await fetch(urlToProcess, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://deezer.com/' // Added Referer header
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      console.error(`Failed to fetch Deezer URL (after redirect): ${response.status} for ${urlToProcess}`);
      return null;
    }

    const finalDeezerPageUrl = response.url; // This is the URL after all redirects (e.g., deezer.com/en/episode/775626721?host=0...)

    // Clean the URL to get only the origin and pathname for parsing
    const cleanDeezerUrl = new URL(finalDeezerPageUrl);
    const baseUrlForParsing = cleanDeezerUrl.origin + cleanDeezerUrl.pathname;

    // Step 2: Try to extract Deezer content type and ID from the clean final URL
    const deezerInfo = parseDeezerUrlForInfo(baseUrlForParsing);
    if (deezerInfo) {
      // Construct the official Deezer widget player URL as specified by the user
      const widgetUrl = `https://widget.deezer.com/widget/auto/${deezerInfo.type}/${deezerInfo.id}`;
      return `<div class="deezer-responsive"><iframe title="deezer-widget" src="${widgetUrl}" width="100%" height="300" frameborder="0" allowtransparency="true" allow="encrypted-media; clipboard-write"></iframe></div>`;
    }

    // Step 3: Fallback to scraping if direct construction failed (e.g., URL is not a standard Deezer content page)
    // This might catch cases where the original URL was already an embedly iframe or a direct widget.deezer.com link
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
            // This handles cases where embedly points to another Deezer link (which will then be handled by Step 2)
            return await getDeezerEmbedHtml(decodedInnerSrc);
          }
        }
        // If it's a direct Deezer widget iframe, use it
        if (iframeSrc.includes('widget.deezer.com/widget/')) {
          return `<div class="deezer-responsive"><iframe scrolling="no" frameborder="0" allowTransparency="true" src="${iframeSrc}"></iframe></div>`;
        }
      }
    }

    // Step 4: Fallback to looking for document.write in script tags (less common for Deezer)
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

/**
 * Attempts to get the Spotify embed HTML (iframe) from a given URL.
 */
async function getSpotifyEmbedHtml(urlToProcess: string): Promise<string | null> {
  try {
    // Step 1: Fetch the URL and follow redirects to get the final Spotify page URL
    let response = await fetch(urlToProcess, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://open.spotify.com/' // Referer for Spotify
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      console.error(`Failed to fetch Spotify URL (after redirect): ${response.status} for ${urlToProcess}`);
      return null;
    }

    const finalSpotifyPageUrl = response.url;

    // Step 2: Try to extract Spotify content type and ID from the final URL
    const spotifyInfo = parseSpotifyUrlForInfo(finalSpotifyPageUrl);

    if (spotifyInfo) {
      const { type, id } = spotifyInfo;
      const embedSrc = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator`;
      const height = (type === 'track' || type === 'episode') ? 152 : 352; // Standard heights

      return `<div class="spotify-embed-wrapper"><iframe style="border-radius:12px" src="${embedSrc}" width="100%" height="${height}" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe></div>`;
    }

    // Fallback: If direct parsing failed, try to scrape for an iframe in the HTML
    const htmlContent = await response.text();
    const $$ = load(htmlContent);

    const iframe = $$('iframe[src*="open.spotify.com/embed"]').first();
    if (iframe.length > 0) {
      const iframeSrc = iframe.attr('src');
      const iframeWidth = iframe.attr('width') || '100%';
      const iframeHeight = iframe.attr('height') || '152'; // Use default if not found
      const iframeStyle = iframe.attr('style') || 'border-radius:12px';
      const iframeFrameBorder = iframe.attr('frameBorder') || '0';
      const iframeAllow = iframe.attr('allow') || 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      const iframeLoading = iframe.attr('loading') || 'lazy';

      return `<div class="spotify-embed-wrapper"><iframe style="${iframeStyle}" src="${iframeSrc}" width="${iframeWidth}" height="${iframeHeight}" frameBorder="${iframeFrameBorder}" allowfullscreen="" allow="${iframeAllow}" loading="${iframeLoading}"></iframe></div>`;
    }

    return null; // No Spotify embed found or constructed
  } catch (error) {
    console.error(`Error getting Spotify embed for ${urlToProcess}:`, error);
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
      const deezerEmbed = await getDeezerEmbedHtml(mediaUrl);
      if (deezerEmbed) {
        embedHtml = deezerEmbed;
      } else {
        const spotifyEmbed = await getSpotifyEmbedHtml(mediaUrl); // NEW SPOTIFY CHECK
        if (spotifyEmbed) {
          embedHtml = spotifyEmbed;
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