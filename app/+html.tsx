import { ScrollViewStyleReset } from 'expo-router/html';
    import { type PropsWithChildren } from 'react';

    /**
     * This file is used to generate the root HTML page on web.
     * It is a good place to add metadata, fonts, and other global styles.
     *
     * @see https://docs.expo.dev/router/advanced/html/
     */
    export default function Root({ children }: PropsWithChildren) {
      return (
        <html lang="en">
          <head>
            <meta charSet="utf-8" />
            <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1, shrink-to-fit=no"
            />

            {/*
              Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
              However, body scrolling is often expected on web.
            */}
            <ScrollViewStyleReset />

            {/* Add any additional <head> elements that you want globally available on web... */}
          </head>
          <body>{children}</body>
        </html>
      );
    }
