import React from 'react';
import { View, Pressable, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { BlurView } from 'expo-blur';

export default function ArticleHeader() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';

  return (
    <SafeAreaView style={styles.headerContainer} edges={['top']}>
      <View style={styles.headerContent}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.buttonContainer,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <BlurView
            intensity={80}
            tint={colorScheme === 'dark' ? 'dark' : 'light'}
            style={styles.blurView}
          >
            <ChevronLeft size={24} color={Colors[colorScheme].text} />
          </BlurView>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
  },
  buttonContainer: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  blurView: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
});
