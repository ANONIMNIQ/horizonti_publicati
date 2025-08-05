export interface Article {
  guid: string;
  link: string;
  title: string;
  pubDate: string;
  creator: string;
  content: string;
  isoDate: string;
  'content:encoded': string;
  categories: string[]; // Added categories
  fullContent?: string; // Added for full HTML content including iframes
  embeds?: string[]; // New property for storing fetched embed HTML
}