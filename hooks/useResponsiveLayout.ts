import { useWindowDimensions, Platform } from 'react-native';

const DESKTOP_BREAKPOINT = 1024;

export function useResponsiveLayout() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktopWeb = isWeb && width >= DESKTOP_BREAKPOINT;
  const isMobileWeb = isWeb && width < DESKTOP_BREAKPOINT;

  return {
    isWeb,
    isDesktopWeb,
    isMobileWeb,
    width,
  };
}
