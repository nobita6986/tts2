import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MicIcon, TextIcon } from './icons';
import { useApiKey } from '../contexts/ApiKeyContext';

const TranscribePage: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const [transcription, setTranscription] = useState('');
    const [error, setError] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const { apiKey, isApiKeySet } = useApiKey();

    useEffect(() => {
        if (!isApiKeySet) {
            setError("Gemini API Key is not configured. Please set it using the button in the sidebar.");
        } else {
            setError(null);
        }
    }, [isApiKeySet]);

    const handleStartRecording = async () => {
        if (!isApiKeySet) {
            setError("Please set your Gemini API Key first.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            mediaRecorderRef.current.ondataavailable = (event) => {
                audioChunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = handleStopRecording;
            audioChunksRef.current = [];
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setTranscription('');
            setError(null);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            setError("Could not access microphone. Please check permissions.");
        }
    };

    const handleStopRecording = async () => {
        if (!mediaRecorderRef.current) return;
        
        const processRecording = async () => {
            setIsRecording(false);
            setTranscribing(true);

            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            
            // Convert Blob to Base64
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = (reader.result as string).split(',')[1];
                
                try {
                    const ai = new GoogleGenAI({ apiKey: apiKey! });
                    const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: {
                            parts: [
                                { inlineData: { mimeType: 'audio/webm', data: base64Audio } },
                                { text: 'Transcribe this audio.' }
                            ]
                        }
                    });
                    setTranscription(response.text);
                } catch (apiError: any) {
                    console.error("Transcription error:", apiError);
                    setError("Failed to transcribe audio. Please try again.");
                } finally {
                    setTranscribing(false);
                    // Stop all media tracks
                    mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
                }
            };
        };

        if (mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        } else {
           // onstop will call this function again, so we can process here if already stopped
           await processRecording();
        }
    };

    return (
        <div className="h-full flex flex-col">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
                <MicIcon className="w-8 h-8 mr-3"/>
                Transcribe Audio
            </h1>
            <p className="text-gray-400 mb-6">Record audio using your microphone and get a text transcription from Gemini.</p>

            <div className="flex-grow flex flex-col items-center justify-center bg-gray-800 p-6 rounded-lg">
                <button
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    disabled={!isApiKeySet}
                    className={`px-8 py-4 rounded-full text-white font-bold text-lg transition-all duration-300 flex items-center space-x-3
                    ${isRecording ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}
                    disabled:bg-gray-600 disabled:cursor-not-allowed`}
                >
                    <MicIcon className="w-6 h-6" />
                    <span>{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
                </button>
                {isRecording && <p className="mt-4 text-indigo-300 animate-pulse">Recording...</p>}
                
                {error && <p className="mt-4 text-red-400">{error}</p>}

                <div className="mt-8 w-full max-w-2xl">
                    <h2 className="text-xl font-semibold text-white mb-2 flex items-center">
                        <TextIcon className="w-5 h-5 mr-2" />
                        Transcription
                    </h2>
                    <div className="bg-gray-900 p-4 rounded-lg min-h-[150px] text-gray-300 whitespace-pre-wrap">
                        {transcribing ? 'Transcribing audio...' : transcription || 'Your transcription will appear here.'}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TranscribePage;