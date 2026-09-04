import * as WebBrowser from 'expo-web-browser';

const TERMS_URL = 'https://telegra.ph/TERMS-OF-USE-09-04-2';
const PRIVACY_URL = 'https://telegra.ph/PRIVACY-POLICY-09-04-150';

export const openTerms = () => WebBrowser.openBrowserAsync(TERMS_URL);
export const openPrivacy = () => WebBrowser.openBrowserAsync(PRIVACY_URL);
