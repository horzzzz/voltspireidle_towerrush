import * as WebBrowser from 'expo-web-browser';

// TODO: replace with the real hosted documents before release.
const TERMS_URL = 'https://example.com/terms';
const PRIVACY_URL = 'https://example.com/privacy';

export const openTerms = () => WebBrowser.openBrowserAsync(TERMS_URL);
export const openPrivacy = () => WebBrowser.openBrowserAsync(PRIVACY_URL);
