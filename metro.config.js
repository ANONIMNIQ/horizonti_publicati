// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// This configuration helps resolve an issue where asset paths are incorrectly
// generated in web builds, causing 404 errors for fonts and images.
// By setting a publicPath, we tell Metro how to prefix asset URLs
// in the bundled output, ensuring they point to the correct location.
config.transformer.publicPath = '/assets';

module.exports = config;
