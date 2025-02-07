import { createClient } from '@supabase/supabase-js';

// Type safety for environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be defined');
}

const STORAGE_KEY = 'app-auth';
const SESSION_EXPIRY_HOURS = 12;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_HOURS * 60 * 60 * 1000;

interface StorageItem<T> {
  value: T;
  expiresAt: string;
}

// Custom storage implementation with strong typing and error handling
const customStorage = {
  getItem: (key: string): string | null => {
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return null;

      const item = JSON.parse(itemStr) as StorageItem<string>;
      const now = new Date();
      const expiresAt = new Date(item.expiresAt);

      if (expiresAt < now) {
        localStorage.removeItem(key);
        return null;
      }

      return item.value;
    } catch (error) {
      console.error('Error reading from storage:', error);
      // Clean up potentially corrupted data
      localStorage.removeItem(key);
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    try {
      const item: StorageItem<string> = {
        value,
        expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS).toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (error) {
      console.error('Error writing to storage:', error);
      // Attempt to clean up on error
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore cleanup errors
      }
    }
  },

  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from storage:', error);
    }
  },
};

// Create Supabase client with enhanced session handling
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: STORAGE_KEY,
    flowType: 'pkce',
    storage: customStorage,
    // Enable debug logs only in development
    debug: import.meta.env.DEV
  },
});

// Comprehensive auth state clearing
export const clearAuthState = async (): Promise<void> => {
  try {
    // Sign out of current session
    await supabase.auth.signOut();
    
    // Clear auth storage
    customStorage.removeItem(STORAGE_KEY);
    
    // Clear auth cookies with proper attributes
    const cookiesToClear = [
      'sb-access-token',
      'sb-refresh-token',
      '__stripe_mid',
      '__stripe_sid'
    ];

    const cookieAttributes = [
      'expires=Thu, 01 Jan 1970 00:00:00 UTC',
      'path=/',
      'domain=' + window.location.hostname,
      'secure',
      'samesite=strict'
    ].join('; ');

    cookiesToClear.forEach((cookieName) => {
      document.cookie = `${cookieName}=; ${cookieAttributes}`;
    });

    // Clear any other auth-related storage
    const authStorageKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('sb-') || key.includes('auth') || key.includes('session')
    );
    authStorageKeys.forEach(key => localStorage.removeItem(key));

    // Use location.replace for cleaner navigation (no history entry)
    window.location.replace('/auth/login');
  } catch (error) {
    console.error('Error clearing auth state:', error);
    // Ensure redirect even on error
    window.location.replace('/auth/login');
  }
};

// Export typed helper to check if session is expired
export const isSessionExpired = (session: string | null): boolean => {
  if (!session) return true;
  
  try {
    const item = JSON.parse(session) as StorageItem<string>;
    return new Date(item.expiresAt) < new Date();
  } catch {
    return true;
  }
};
