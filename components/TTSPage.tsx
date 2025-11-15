
import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { Voice, TTSHistory } from '../types';
import { decode } from '../lib/audioUtils';
import { PlayIcon, PauseIcon, HistoryIcon, TextIcon } from './icons';
import { useApiKey } from '../contexts/ApiKeyContext';

const AudioPlayer: React.FC<{ src: string }> = ({ src }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = React.useRef<HTMLAudioElement>(null);

    const togglePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };
    
    useEffect(() => {
        const audio = audioRef.current;
        const handleEnd = () => setIsPlaying(false);
        audio?.addEventListener('ended', handleEnd);
        return () => audio?.removeEventListener('ended', handleEnd);
    }, []);

    return (
        <div className="flex items-center">
            <button onClick={togglePlayPause} className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white">
                {isPlaying ? <PauseIcon className="w-5 h-5"/> : <PlayIcon className="w-5 h-5"/>}
            </button>
            <audio ref={audioRef} src={src} className="hidden" />
        </div>
    );
};


const TTSPage: React.FC<{ session: Session | null }> = ({ session }) => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [history, setHistory] = useState<TTSHistory[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [text, setText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const { apiKey, isApiKeySet } = useApiKey();

  const fetchVoices = useCallback(async () => {
    if (!session) return;
    setLoadingVoices(true);
    const { data, error } = await supabase
      .from('voices')
      .select('*')
      .eq('user_id', session.user.id);
    if (error) {
      setError('Failed to load voices.');
    } else if (data) {
      setVoices(data);
      if (data.length > 0) {
        setSelectedVoiceId(data[0].id);
      }
    }
    setLoadingVoices(false);
  }, [session]);

  const fetchHistory = useCallback(async () => {
    if (!session) return;
    setLoadingHistory(true);
    const { data, error } = await supabase
        .from('tts_history')
        .select(`*, voice:voices (display_name)`)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
      console.error(error);
      setError('Failed to load history.');
    } else if (data) {
        const historyWithUrls = data.map(item => {
            const { data: urlData } = supabase.storage.from('tts-audios').getPublicUrl(item.audio_path);
            return { ...item, audio_public_url: urlData.publicUrl };
        });
        setHistory(historyWithUrls as TTSHistory[]);
    }
    setLoadingHistory(false);
  }, [session]);

  useEffect(() => {
    if (!isApiKeySet) {
        setError("Gemini API Key is not configured. Please set it using the button in the sidebar.");
    } else {
        setError(null);
    }
    if (session) {
        fetchVoices();
        fetchHistory();
    } else {
        setLoadingVoices(false);
        setLoadingHistory(false);
        setVoices([]);
        setHistory([]);
    }
  }, [session, fetchVoices, fetchHistory, isApiKeySet]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApiKeySet) {
        setError("Please set your Gemini API Key first.");
        return;
    }
    if (!session) {
      setError("Please sign in to generate audio.");
      return;
    }
    if (!selectedVoiceId || !text) {
      setError('Please select a voice and enter some text.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: apiKey! });
      const selectedVoice = voices.find(v => v.id === selectedVoiceId);
      if (!selectedVoice) throw new Error('Selected voice not found.');
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice.gemini_voice_name },
              },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("No audio data returned from API.");

      const audioBytes = decode(base64Audio);
      const audioBlob = new Blob([audioBytes], { type: 'audio/wav' });

      // Upload to Supabase Storage
      const filePath = `${session.user.id}/${Date.now()}-tts.wav`;
      const { error: uploadError } = await supabase.storage
        .from('tts-audios')
        .upload(filePath, audioBlob);
      if (uploadError) throw uploadError;

      // Save to history table
      const { error: historyError } = await supabase
        .from('tts_history')
        .insert({
          user_id: session.user.id,
          voice_id: selectedVoiceId,
          input_text: text,
          audio_path: filePath,
        });
      if (historyError) throw historyError;

      // Refresh history
      fetchHistory();
      setText('');

    } catch (error: any) {
      console.error(error);
      setError(error.message || 'Failed to generate speech.');
    } finally {
      setGenerating(false);
    }
  };

  if (!session) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center bg-gray-800 rounded-lg p-8">
        <TextIcon className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-white">Generate Text-to-Speech</h2>
        <p className="text-gray-400 mt-2 max-w-md">
          Please sign in to use your saved voice profiles and generate TTS audio. Your generation history will also be saved to your account.
        </p>
         <p className="text-gray-500 mt-4 text-sm">(Use the "Sign In" button in the bottom-left corner)</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-6">
        <div className="flex-shrink-0">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center"><TextIcon className="w-8 h-8 mr-3"/>Generate Text-to-Speech</h1>
            <p className="text-gray-400">Select a voice profile, type your text, and generate audio.</p>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg">
            <form onSubmit={handleGenerate} className="space-y-4">
            <div>
                <label htmlFor="voice" className="block text-sm font-medium text-gray-300 mb-1">Voice Profile</label>
                {loadingVoices ? <p className="text-sm text-gray-400">Loading voices...</p> : (
                    <select
                    id="voice"
                    value={selectedVoiceId}
                    onChange={(e) => setSelectedVoiceId(e.target.value)}
                    className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={voices.length === 0}
                    >
                    {voices.length > 0 ? (
                        voices.map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)
                    ) : (
                        <option>No voices available. Please create one first.</option>
                    )}
                    </select>
                )}
            </div>
            <div>
                <label htmlFor="text" className="block text-sm font-medium text-gray-300 mb-1">Text</label>
                <textarea
                    id="text"
                    rows={4}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter text to convert to speech..."
                />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
                type="submit"
                disabled={generating || voices.length === 0 || !isApiKeySet}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-lg transition duration-300 disabled:bg-indigo-800 disabled:cursor-not-allowed"
            >
                {generating ? 'Generating...' : 'Generate Audio'}
            </button>
            </form>
        </div>

        <div className="flex-grow flex flex-col min-h-0">
            <h2 className="text-2xl font-bold mb-4 flex items-center"><HistoryIcon className="w-6 h-6 mr-2"/>Generation History</h2>
            <div className="bg-gray-800 p-4 rounded-lg flex-grow overflow-y-auto">
            {loadingHistory ? <p>Loading history...</p> : history.length === 0 ? (
                <p className="text-center text-gray-400 py-4">No history yet. Generate some audio to see it here.</p>
            ) : (
                <ul className="space-y-3">
                {history.map(item => (
                    <li key={item.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg">
                    <div className="flex items-center gap-4">
                        {item.audio_public_url && <AudioPlayer src={item.audio_public_url} />}
                        <div>
                            <p className="text-white font-medium truncate w-64 md:w-96" title={item.input_text}>{item.input_text}</p>
                            <p className="text-sm text-gray-400">
                                Voice: {item.voice?.display_name || 'Unknown'} on {new Date(item.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    </li>
                ))}
                </ul>
            )}
            </div>
        </div>
    </div>
  );
};

export default TTSPage;