const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/drive';
const SIGNED_IN_KEY = 'google_signed_in';

export interface GoogleAuthState {
  isInitialized: boolean;
  isSignedIn: boolean;
  accessToken: string | null;
  userName: string | null;
  userEmail: string | null;
  userPhoto: string | null;
}

export type AuthListener = (state: GoogleAuthState) => void;

let authState: GoogleAuthState = {
  isInitialized: false,
  isSignedIn: false,
  accessToken: null,
  userName: null,
  userEmail: null,
  userPhoto: null,
};

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
const listeners: Set<AuthListener> = new Set();

function notifyListeners() {
  listeners.forEach((fn) => fn({ ...authState }));
}

export function isGoogleConfigured(): boolean {
  return CLIENT_ID.length > 0;
}

export function getAuthState(): GoogleAuthState {
  return { ...authState };
}

export function addAuthListener(listener: AuthListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function fetchUserInfo(accessToken: string) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      authState.userName = data.name || null;
      authState.userEmail = data.email || null;
      authState.userPhoto = data.picture || null;
    }
  } catch {
    // Non-critical, ignore
  }
}

export async function initGoogleAuth(): Promise<void> {
  if (!isGoogleConfigured()) return;
  if (authState.isInitialized) return;

  await loadScript('https://accounts.google.com/gsi/client');
  await loadScript('https://apis.google.com/js/api.js');

  await new Promise<void>((resolve) => {
    gapi.load('client', () => resolve());
  });

  await gapi.client.init({});

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: async (response) => {
      if (response.error) {
        authState.isSignedIn = false;
        authState.accessToken = null;
        notifyListeners();
        return;
      }
      authState.isSignedIn = true;
      authState.accessToken = response.access_token;
      gapi.client.setToken({ access_token: response.access_token });
      localStorage.setItem(SIGNED_IN_KEY, '1');
      await fetchUserInfo(response.access_token);
      notifyListeners();
    },
    error_callback: () => {
      // User closed popup or silent restore failed — clear flag
      localStorage.removeItem(SIGNED_IN_KEY);
    },
  });

  authState.isInitialized = true;
  notifyListeners();

  // Silently restore session if user was previously signed in
  if (localStorage.getItem(SIGNED_IN_KEY) === '1') {
    tokenClient.requestAccessToken({ prompt: '' });
  }
}

export function signIn(): void {
  if (!tokenClient) return;
  tokenClient.requestAccessToken({ prompt: 'select_account' });
}

export function signOut(): void {
  const token = authState.accessToken;
  if (token) {
    google.accounts.oauth2.revoke(token);
    gapi.client.setToken(null);
  }
  authState.isSignedIn = false;
  authState.accessToken = null;
  authState.userName = null;
  authState.userEmail = null;
  authState.userPhoto = null;
  localStorage.removeItem(SIGNED_IN_KEY);
  notifyListeners();
}
