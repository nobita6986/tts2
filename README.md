# Gemini Voice Studio

This is a React-based web application that allows users to create custom voice profiles, generate Text-to-Speech (TTS) audio, transcribe speech, and have real-time voice conversations using Google's Gemini API. The application uses Supabase for authentication, database, and storage.

## 🚀 Getting Started

### Prerequisites

- Node.js and npm (or yarn/pnpm)
- A Supabase account ([supabase.com](https://supabase.com))
- A Google AI Studio API Key ([aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey))

### 1. Set up Supabase Project

1.  Go to your Supabase Dashboard and click **"New project"**.
2.  Give your project a name and create a secure database password.
3.  Once the project is created, navigate to **Project Settings** > **API**. You will need the **Project URL** and the **`anon` public key**.

### 2. Set up Configuration

Open the `index.html` file and locate the `<script>` tag at the beginning of the `<body>`. Update the placeholder values inside the `window.APP_CONFIG` object with your credentials from Supabase.

```html
<script>
  window.APP_CONFIG = {
    VITE_SUPABASE_URL: "YOUR_SUPABASE_PROJECT_URL",
    VITE_SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_PUBLIC_KEY"
  };
</script>
```

**Note:** The Gemini API Key is no longer set here. You will be prompted to enter it within the application itself after launching it.

### 3. Set up Supabase Database & Storage

Go to the **SQL Editor** in your Supabase dashboard and run the single, comprehensive SQL script below. This script is safe to run multiple times; it will reset your database tables and policies to ensure a clean setup.

**Warning:** Running this script will delete any existing data in the `voices` and `tts_history` tables.

```sql
-- =================================================================
-- GEMINI VOICE STUDIO - SUPABASE SETUP SCRIPT
-- This script is safe to run multiple times. It will drop existing
-- tables and policies before recreating them to ensure a clean setup.
-- WARNING: This will delete all existing data in the tables.
-- =================================================================

-- =========== PART 1: RESET SCHEMA (DROPPING OLD OBJECTS) ===========

-- Drop tables if they exist. CASCADE also removes dependent RLS policies.
DROP TABLE IF EXISTS public.tts_history CASCADE;
DROP TABLE IF EXISTS public.voices CASCADE;

-- Drop storage policies separately as they are on a different schema.
DROP POLICY IF EXISTS "Allow individual upload in voice-samples" ON storage.objects;
DROP POLICY IF EXISTS "Allow individual read in voice-samples" ON storage.objects;
DROP POLICY IF EXISTS "Allow individual upload in tts-audios" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read in tts-audios" ON storage.objects;


-- =========== PART 2: CREATE TABLES ===========

-- Create `voices` table to store user-created voice profiles.
CREATE TABLE public.voices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    gemini_voice_name TEXT NOT NULL -- e.g., 'Kore', 'Puck'
);

-- Enable Row Level Security (RLS) to protect data.
ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;

-- Create `tts_history` table to store history of generated TTS audio.
CREATE TABLE public.tts_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    voice_id uuid NOT NULL REFERENCES public.voices(id) ON DELETE CASCADE,
    input_text TEXT NOT NULL,
    audio_path TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS to protect data.
ALTER TABLE public.tts_history ENABLE ROW LEVEL SECURITY;


-- =========== PART 3: SETUP ROW LEVEL SECURITY (RLS) POLICIES ===========

-- --- Policies for `voices` table ---

CREATE POLICY "Allow individual read access on voices"
ON public.voices FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow individual insert access on voices"
ON public.voices FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual delete access on voices"
ON public.voices FOR DELETE USING (auth.uid() = user_id);


-- --- Policies for `tts_history` table ---

CREATE POLICY "Allow individual read access on tts_history"
ON public.tts_history FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow individual insert access on tts_history"
ON public.tts_history FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow individual delete access on tts_history"
ON public.tts_history FOR DELETE USING (auth.uid() = user_id);


-- =========== PART 4: SETUP STORAGE POLICIES ===========

-- --- Policies for 'voice-samples' bucket ---

CREATE POLICY "Allow individual upload in voice-samples"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'voice-samples' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow individual read in voice-samples"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'voice-samples' AND (storage.foldername(name))[1] = auth.uid()::text);


-- --- Policies for 'tts-audios' bucket ---

CREATE POLICY "Allow individual upload in tts-audios"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tts-audios' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow public read in tts-audios"
ON storage.objects FOR SELECT USING (bucket_id = 'tts-audios');
```

### 4. Set up Supabase Storage Buckets

Go to the **Storage** section in your Supabase dashboard.

1.  Click **"Create a new bucket"**. Name it `voice-samples` and make it a **public** bucket.
2.  Click **"Create a new bucket"**. Name it `tts-audios` and make it a **public** bucket.

(If the buckets already exist, you can skip this step).

### 5. Install Dependencies and Run

Now you are ready to run the application.

```bash
npm install
npm run dev
```

The application should now be running on your local server. Once loaded, click the "Set API Key" button to enter your Gemini API key.