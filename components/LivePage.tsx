import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAiBlob } from "@google/genai";
import { decode, encode, decodeAudioData } from '../lib/audioUtils';
import { MicIcon, BotIcon, UserIcon } from './icons';
import { useApiKey } from '../contexts/ApiKeyContext';

interface TranscriptionTurn {
    type: 'user' | 'model';
    text: string;
}

const LivePage: React.FC = () => {
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [status, setStatus] = useState('Idle');
    const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionTurn[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [currentOutput, setCurrentOutput] = useState('');

    const { apiKey, isApiKeySet } = useApiKey();
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const transcriptEndRef = useRef<HTMLDivElement>(null);

     const scrollToBottom = () => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [transcriptionHistory, currentInput, currentOutput]);
    
    useEffect(() => {
        if (!isApiKeySet) {
            setStatus("Gemini API Key is not configured. Please set it using the button in the sidebar.");
        } else {
            setStatus("Idle");
        }
    }, [isApiKeySet])

    const stopSession = useCallback(async () => {
        setStatus('Stopping...');
        if (sessionPromiseRef.current) {
            try {
                const session = await sessionPromiseRef.current;
                session.close();
            } catch (e) {
                console.error("Error closing session:", e);
            }
        }

        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close();
        }
        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close();
        }
        
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();

        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();

        sessionPromiseRef.current = null;
        setIsSessionActive(false);
        setStatus('Idle');
    }, []);

    const startSession = async () => {
        if (!isApiKeySet) {
            setStatus("Please set your Gemini API Key first.");
            return;
        }
        setStatus('Initializing...');
        setTranscriptionHistory([]);
        setCurrentInput('');
        setCurrentOutput('');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            inputAudioContextRef.current = new (window.AudioContext)({ sampleRate: 16000 });
            outputAudioContextRef.current = new (window.AudioContext)({ sampleRate: 24000 });
            nextStartTimeRef.current = 0;
            const ai = new GoogleGenAI({ apiKey: apiKey! });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setStatus('Connected. Speak now.');
                        setIsSessionActive(true);

                        mediaStreamSourceRef.current = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob: GenAiBlob = {
                                data: encode(new Uint8Array(new Int16Array(inputData.map(x => x * 32768)).buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            setCurrentInput(prev => prev + message.serverContent.inputTranscription.text);
                        }
                        if (message.serverContent?.outputTranscription) {
                            setCurrentOutput(prev => prev + message.serverContent.outputTranscription.text);
                        }
                        if (message.serverContent?.turnComplete) {
                            setTranscriptionHistory(prev => [
                                ...prev,
                                { type: 'user', text: currentInput + (message.serverContent.inputTranscription?.text || '') },
                                { type: 'model', text: currentOutput + (message.serverContent.outputTranscription?.text || '') }
                            ]);
                            setCurrentInput('');
                            setCurrentOutput('');
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (base64Audio && outputAudioContextRef.current) {
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContextRef.current, 24000, 1);
                            const source = outputAudioContextRef.current.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContextRef.current.destination);
                            
                            const currentTime = outputAudioContextRef.current.currentTime;
                            const startTime = Math.max(currentTime, nextStartTimeRef.current);
                            source.start(startTime);
                            nextStartTimeRef.current = startTime + audioBuffer.duration;
                            audioSourcesRef.current.add(source);
                            source.onended = () => audioSourcesRef.current.delete(source);
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Session error:', e);
                        setStatus(`Error: ${e.message}`);
                        stopSession();
                    },
                    onclose: () => {
                        setStatus('Session closed.');
                        stream.getTracks().forEach(track => track.stop());
                        setIsSessionActive(false);
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    outputAudioTranscription: {},
                    inputAudioTranscription: {},
                },
            });

        } catch (err) {
            console.error("Failed to start session:", err);
            setStatus('Failed to start. Check mic permissions.');
        }
    };
    
    useEffect(() => {
        return () => {
            if (isSessionActive) {
                stopSession();
            }
        };
    }, [isSessionActive, stopSession]);

    const Turn: React.FC<{ turn: TranscriptionTurn }> = ({ turn }) => (
        <div className={`flex gap-3 my-4 ${turn.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            {turn.type === 'model' && <div className="w-10 h-10 rounded-full bg-indigo-500 flex-shrink-0 flex items-center justify-center"><BotIcon/></div>}
            <div className={`p-3 rounded-lg max-w-sm md:max-w-md ${turn.type === 'user' ? 'bg-blue-600' : 'bg-gray-700'}`}>
                <p>{turn.text}</p>
            </div>
             {turn.type === 'user' && <div className="w-10 h-10 rounded-full bg-gray-600 flex-shrink-0 flex items-center justify-center"><UserIcon/></div>}
        </div>
    );

    return (
        <div className="h-full flex flex-col">
            <h1 className="text-3xl font-bold text-white mb-2">Live Conversation</h1>
            <p className="text-gray-400 mb-4">Have a real-time voice conversation with Gemini.</p>

            <div className="flex-grow flex flex-col bg-gray-800 rounded-lg p-4 overflow-hidden">
                <div className="flex-grow overflow-y-auto pr-2">
                    {transcriptionHistory.map((turn, index) => <Turn key={index} turn={turn} />)}
                    {currentInput && <Turn turn={{ type: 'user', text: currentInput }} />}
                    {currentOutput && <Turn turn={{ type: 'model', text: currentOutput }} />}
                    <div ref={transcriptEndRef} />
                </div>
                
                <div className="flex-shrink-0 pt-4 border-t border-gray-700 mt-2 text-center">
                    <p className="text-lg font-medium text-gray-300 mb-3">{status}</p>
                    <button
                        onClick={isSessionActive ? stopSession : startSession}
                        disabled={!isApiKeySet && !isSessionActive}
                        className={`px-8 py-4 rounded-full text-white font-bold text-lg transition-all duration-300 flex items-center space-x-3 mx-auto
                        ${isSessionActive ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}
                        disabled:bg-gray-600 disabled:cursor-not-allowed`}
                    >
                        <MicIcon className="w-6 h-6" />
                        <span>{isSessionActive ? 'End Conversation' : 'Start Conversation'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LivePage;