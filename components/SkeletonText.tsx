import React from 'react';
    import { View, StyleSheet, useColorScheme } from 'react-native';
    import { Colors } from '@/constants/Colors';

    interface SkeletonTextProps {
      lines?: number;
    }

    export default function SkeletonText({ lines = 15 }: SkeletonTextProps) {
      const colorScheme = useColorScheme() ?? 'light';
      const skeletonColor = Colors[colorScheme].skeletonBackground;

      const renderLines = () => {
        return Array.from({ length: lines }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.line,
              { backgroundColor: skeletonColor },
              // Make the last line shorter for a more realistic look
              index === lines - 1
                ? { width: '60%' }
                : { width: `${Math.random() * 10 + 90}%` }, // Random width between 90% and 100%
            ]}
          />
        ));
      };

      return <View>{renderLines()}</View>;
    }

    const styles = StyleSheet.create({
      line: {
        height: 17,
        borderRadius: 4,
        marginBottom: 8, // Corresponds to lineHeight (25) - fontSize (17) in AboutScreen
      },
    });
