# AI Development Rules

This document outlines the technology stack and development conventions for this application. Following these rules ensures consistency and maintainability.

## Tech Stack

This is a React Native application built with Expo.

- **Framework:** React Native with Expo for cross-platform development (iOS, Android, Web).
- **Language:** TypeScript for type safety and improved developer experience.
- **Routing:** Expo Router is used for file-based routing, creating a web-like navigation experience.
- **Styling:** Styling is done using React Native's `StyleSheet` API. Responsiveness, especially for the web, is handled via the `useResponsiveLayout` custom hook.
- **UI Components:** The app uses custom-built components. Icons are provided by `lucide-react-native`, and visual effects like blur are from `expo-blur`.
- **Data Fetching:** Data is fetched from a Medium RSS feed using the `fetch` API and parsed via the `rss2json.com` service.
- **HTML Rendering:** `react-native-render-html` is used to display article content on native platforms, while a custom `WebHtmlRenderer` component handles it on the web.
- **Animation:** `react-native-reanimated` is used for animations, such as the splash screen transition.

## Library Usage Rules

- **Routing & Navigation:**
  - **ALWAYS** use `expo-router` for navigation.
  - Create new files in the `app/` directory to define new routes.
  - Use the `<Link>` component from `expo-router` for navigating between screens.

- **Styling:**
  - **ALWAYS** use `StyleSheet.create` for styling components.
  - For platform-specific styles (iOS, Android, Web), use the `Platform.OS` API.
  - For responsive web design (mobile vs. desktop), use the `useResponsiveLayout` custom hook.
  - **ALWAYS** use color and layout constants from `constants/Colors.ts` and `constants/Layout.ts` to maintain a consistent theme.

- **Icons:**
  - **ONLY** use icons from the `lucide-react-native` library.

- **Component Creation:**
  - Create all new components inside the `src/components/` directory.
  - Keep components small, focused, and reusable.

- **Data Fetching:**
  - All data fetching from the RSS feed should be handled within the `hooks/useRssFeed.ts` hook.

- **HTML Content:**
  - When rendering HTML from the feed, continue the existing pattern:
    - Use `react-native-render-html` for native platforms (iOS/Android).
    - Use the custom `WebHtmlRenderer` component for the web platform.

- **State Management:**
  - For component-level state, use React Hooks (`useState`, `useEffect`, etc.).
  - For global state, use the React Context API before considering adding a new state management library.

- **Dependencies:**
  - Do not add new third-party libraries unless absolutely necessary. Prefer using the APIs provided by Expo, React, and React Native.