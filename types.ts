// Add a global declaration for the APP_CONFIG object
// This makes TypeScript aware of the object we are defining in index.html
declare global {
  interface Window {
    APP_CONFIG: {
      VITE_SUPABASE_URL: string;
      VITE_SUPABASE_ANON_KEY: string;
    };
  }
}

export interface Voice {
  id: string;
  user_id: string;
  display_name: string;
  created_at: string;
  gemini_voice_name: string;
}

export interface TTSHistory {
  id: string;
  user_id: string;
  voice_id: string;
  input_text: string;
  audio_path: string;
  created_at: string;
  audio_public_url?: string;
  voice?: {
    display_name: string;
  };
}

export const GEMINI_VOICES = [
    { id: 'Kore', name: 'Kore (Female)'},
    { id: 'Puck', name: 'Puck (Male)'},
    { id: 'Charon', name: 'Charon (Male)'},
    { id: 'Fenrir', name: 'Fenrir (Male)'},
    { id: 'Zephyr', name: 'Zephyr (Female)'},
];