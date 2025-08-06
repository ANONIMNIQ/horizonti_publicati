import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const SCREEN_WIDTH = width;
export const SCREEN_HEIGHT = height;

export const DESKTOP_CONTENT_MAX_CONTAINER_WIDTH = 1024;
export const DESKTOP_FULL_CONTENT_WIDTH = DESKTOP_CONTENT_MAX_CONTAINER_WIDTH - 32; // 1024 - (2 * 16px padding) = 992
export const DESKTOP_TEXT_CONTENT_WIDTH = 584; // Define the constant here
export const DISCOVER_HEADER_HEIGHT_MOBILE = 180;
export const DISCOVER_HEADER_HEIGHT_DESKTOP = 220; // Adjusted to provide more space for buttons