
import React, { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { Voice } from '../types';
import { GEMINI_VOICES } from '../types';
import { UserIcon, PlusCircleIcon } from './icons';

const VoicesPage: React.FC<{ session: Session | null }> = ({ session }) => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newVoiceName, setNewVoiceName] = useState('');
  const [selectedGeminiVoice, setSelectedGeminiVoice] = useState(GEMINI_VOICES[0].id);
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVoices = useCallback(async () => {
    if (!session) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('voices')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVoices(data || []);
    } catch (error: any) {
      console.error('Error fetching voices:', error);
      setError('Failed to fetch voices.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if(session) {
      fetchVoices();
    } else {
      setLoading(false);
      setVoices([]);
    }
  }, [session, fetchVoices]);

  const handleCreateVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) {
        setError('You must be logged in to create a voice.');
        return;
    }
    if (!newVoiceName || !selectedGeminiVoice) {
        setError('Please provide a display name and select a base voice.');
        return;
    }
    // Mock upload, no files needed, but we could add them
    // if (!files || files.length === 0) {
    //   setError('Please select at least one audio file.');
    //   return;
    // }
    
    setUploading(true);
    setError(null);

    try {
        // Step 1: Insert voice profile into DB
        const { data: voiceData, error: dbError } = await supabase
            .from('voices')
            .insert({
                user_id: session.user.id,
                display_name: newVoiceName,
                gemini_voice_name: selectedGeminiVoice,
            })
            .select()
            .single();

        if (dbError) throw dbError;

        // Step 2: (Optional) Upload files if provided
        if (files && files.length > 0) {
             for (const file of Array.from(files)) {
                const filePath = `${session.user.id}/${voiceData.id}/${file.name}`;
                const { error: uploadError } = await supabase.storage
                .from('voice-samples')
                .upload(filePath, file);

                if (uploadError) {
                    console.error('Partial upload failed:', uploadError);
                    // Handle partial failure, e.g., by deleting the voice record
                    await supabase.from('voices').delete().eq('id', voiceData.id);
                    throw new Error('Failed to upload one or more files.');
                }
            }
        }

      setNewVoiceName('');
      setSelectedGeminiVoice(GEMINI_VOICES[0].id);
      setFiles(null);
      setShowCreateForm(false);
      fetchVoices(); // Refresh the list
    } catch (error) {
      // FIX: The user-reported error 'Property 'name' does not exist' likely stems from
      // incorrect handling of the 'error' object. This logic safely extracts the
      // error message, preventing crashes from unexpected error shapes.
      console.error('Error creating voice:', error);
      let errorMessage = 'Failed to create voice profile.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  if (!session) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center bg-gray-800 rounded-lg p-8">
        <UserIcon className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-2xl font-bold text-white">Manage Your Voice Profiles</h2>
        <p className="text-gray-400 mt-2 max-w-md">
          Please sign in to create, view, and manage your custom voice profiles. Your profiles are securely stored and linked to your account.
        </p>
         <p className="text-gray-500 mt-4 text-sm">(Use the "Sign In" button in the bottom-left corner)</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">My Voice Profiles</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
        >
          <PlusCircleIcon className="w-5 h-5 mr-2"/>
          {showCreateForm ? 'Cancel' : 'Create New Voice'}
        </button>
      </div>

      {error && <div className="bg-red-500/20 text-red-300 p-3 rounded-lg mb-4">{error}</div>}

      {showCreateForm && (
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <form onSubmit={handleCreateVoice}>
            <div className="mb-4">
              <label htmlFor="voiceName" className="block text-sm font-medium text-gray-300 mb-1">Voice Display Name</label>
              <input
                type="text"
                id="voiceName"
                value={newVoiceName}
                onChange={(e) => setNewVoiceName(e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., My Podcast Voice"
              />
            </div>
             <div className="mb-4">
              <label htmlFor="geminiVoice" className="block text-sm font-medium text-gray-300 mb-1">Base Gemini Voice</label>
              <select 
                id="geminiVoice"
                value={selectedGeminiVoice}
                onChange={(e) => setSelectedGeminiVoice(e.target.value)}
                className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    {GEMINI_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label htmlFor="audioFiles" className="block text-sm font-medium text-gray-300 mb-1">
                Audio Samples (Optional)
                <p className="text-xs text-gray-400">Upload short audio files for voice cloning. This is a mock feature for now.</p>
              </label>
              <input
                type="file"
                id="audioFiles"
                multiple
                onChange={(e) => setFiles(e.target.files)}
                className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700"
              />
            </div>
            <button
              type="submit"
              disabled={uploading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 disabled:bg-green-800"
            >
              {uploading ? 'Creating...' : 'Create Voice Profile'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <p>Loading voices...</p>
      ) : voices.length === 0 ? (
        <div className="text-center py-10 bg-gray-800 rounded-lg">
            <UserIcon className="mx-auto h-12 w-12 text-gray-500" />
            <h3 className="mt-2 text-sm font-medium text-white">No voice profiles</h3>
            <p className="mt-1 text-sm text-gray-400">Get started by creating a new voice profile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {voices.map((voice) => (
            <div key={voice.id} className="bg-gray-800 p-4 rounded-lg shadow">
              <h3 className="font-bold text-lg text-white">{voice.display_name}</h3>
              <p className="text-sm text-gray-400">Base Voice: {GEMINI_VOICES.find(v => v.id === voice.gemini_voice_name)?.name || voice.gemini_voice_name}</p>
              <p className="text-xs text-gray-500 mt-2">Created: {new Date(voice.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VoicesPage;
