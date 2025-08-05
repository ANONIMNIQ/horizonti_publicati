import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';

interface WebHtmlRendererProps {
  htmlContent: string;
  style?: any; // React Native style object
  className?: string; // Web class name
}

const WebHtmlRenderer: React.FC<WebHtmlRendererProps> = ({ htmlContent, style, className }) => {
  if (Platform.OS === 'web') {
    // For web, render a standard div and apply styles as CSS properties
    // StyleSheet.flatten converts React Native styles to a plain object suitable for inline CSS
    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
        style={StyleSheet.flatten(style)}
      />
    );
  } else {
    // This component is primarily for web. For native, RenderHTML is used for main content.
    // This branch is a fallback or for other potential uses where a View might be needed.
    return (
      <View style={style}>
        {/* On native, the main article content uses RenderHTML, not this component directly. */}
        {/* If this component were to be used on native for some reason, it would render a View. */}
      </View>
    );
  }
};

export default WebHtmlRenderer;
