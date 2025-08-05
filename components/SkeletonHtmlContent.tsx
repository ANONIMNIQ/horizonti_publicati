import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { DESKTOP_TEXT_CONTENT_WIDTH } from '@/constants/Layout';

interface SkeletonHtmlContentProps {
  isDesktopWeb: boolean;
  desktopLeftOffset?: number;
}

export default function SkeletonHtmlContent({ isDesktopWeb, desktopLeftOffset = 0 }: SkeletonHtmlContentProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const skeletonColor = Colors[colorScheme].skeletonBackground;

  const renderLines = (count: number, minWidth: number, maxWidth: number) => {
    return Array.from({ length: count }).map((_, index) => (
      <View
        key={index}
        style={[
          styles.line,
          { backgroundColor: skeletonColor },
          { width: `${Math.random() * (maxWidth - minWidth) + minWidth}%` },
        ]}
      />
    ));
  };

  return (
    <View style={[styles.container, isDesktopWeb && { paddingLeft: desktopLeftOffset }]}>
      {/* Simulate a heading */}
      <View style={[styles.headingLine, { backgroundColor: skeletonColor, width: '70%' }]} />
      <View style={[styles.headingLine, { backgroundColor: skeletonColor, width: '50%' }]} />

      {/* Simulate paragraphs */}
      {renderLines(4, 80, 100)}
      <View style={styles.spacer} />
      {renderLines(3, 70, 95)}
      <View style={styles.spacer} />
      {renderLines(5, 60, 100)}
      <View style={styles.spacer} />
      {renderLines(2, 75, 90)}
      <View style={styles.spacer} />
      {renderLines(4, 80, 100)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headingLine: {
    height: 28, // Larger height for headings
    borderRadius: 4,
    marginBottom: 12,
  },
  line: {
    height: 18, // Height for text lines
    borderRadius: 4,
    marginBottom: 8,
  },
  spacer: {
    height: 24, // Space between simulated paragraphs
  },
});