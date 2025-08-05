import { Tabs } from 'expo-router';
import { useColorScheme, Platform } from 'react-native';
import { BookOpen, Info, Search } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { BlurView } from 'expo-blur';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

export default function TabLayout() {
  const colorScheme = useColorScheme() ?? 'light';
  const { isDesktopWeb } = useResponsiveLayout();
  const iconSize = isDesktopWeb ? 20 : 24;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarInactiveTintColor: Colors[colorScheme].tabIconDefault,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          // Conditional styles for desktop web
          ...(isDesktopWeb && {
            // Layout
            width: 240,
            left: 0,
            right: 0,
            bottom: 24,
            marginHorizontal: 'auto',
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 8,
            // Shadow
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: colorScheme === 'dark' ? 0.4 : 0.2,
            shadowRadius: 6,
            elevation: 8,
          }),
        },
        tabBarBackground: () => (
          <BlurView
            tint={Colors[colorScheme].blurTint}
            intensity={Platform.OS === 'ios' ? 100 : 200}
            style={{
              flex: 1,
              backgroundColor: Colors[colorScheme].cardBackground,
              ...(isDesktopWeb && {
                borderRadius: 999,
                overflow: 'hidden',
              }),
            }}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Публикации',
          tabBarIcon: ({ color }) => (
            <BookOpen color={color} size={iconSize} />
          ),
          ...(Platform.OS === 'web' && {
            animation: 'fade',
          }),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Търсене',
          tabBarIcon: ({ color }) => <Search color={color} size={iconSize} />,
          ...(Platform.OS === 'web' && {
            animation: 'fade',
          }),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: 'За нас',
          tabBarIcon: ({ color }) => <Info color={color} size={iconSize} />,
          ...(Platform.OS === 'web' && {
            animation: 'fade',
          }),
        }}
      />
    </Tabs>
  );
}