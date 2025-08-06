export const Colors = {
  light: {
    text: '#11181C',
    background: '#FFFFFF', // Changed to pure white
    tint: '#6366F1',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#6366F1',
    cardBackground: 'rgba(255, 255, 255, 0.8)',
    cardBorder: 'rgba(0, 0, 0, 0.1)',
    blurTint: 'light' as const,
    skeletonBackground: '#E0E0E0', // Light gray for skeleton
    commentsButtonBackground: '#000000',
    commentsButtonBackgroundPressed: '#00000080',
    commentsButtonText: '#FFFFFF',
    floatingText: '#000000', // Darker color for floating text
  },
  dark: {
    text: '#ECEDEE',
    background: '#161618',
    tint: '#6366F1',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#6366F1',
    cardBackground: 'rgba(255, 255, 255, 0.08)',
    cardBorder: 'rgba(255, 255, 255, 0.1)',
    blurTint: 'dark' as const,
    skeletonBackground: '#333333', // Darker gray for skeleton
    commentsButtonBackground: '#FFFFFF',
    commentsButtonBackgroundPressed: '#FFFFFF80',
    commentsButtonText: '#000000',
    floatingText: '#FFFFFF', // Lighter color for floating text in dark mode
  },
};