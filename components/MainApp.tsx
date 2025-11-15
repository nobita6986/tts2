
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import VoicesPage from './VoicesPage';
import TTSPage from './TTSPage';
import TranscribePage from './TranscribePage';
import LivePage from './LivePage';
import { SoundWaveIcon, MicIcon, TextIcon, MessageSquareIcon, UserIcon, KeyIcon } from './icons';
import Auth from './Auth';
import ApiKeyModal from './ApiKeyModal';
import { useApiKey } from '../contexts/ApiKeyContext';

type Page = 'voices' | 'tts' | 'transcribe' | 'live';

const MainApp: React.FC<{ session: Session | null }> = ({ session }) => {
  const [page, setPage] = useState<Page>('voices');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const { isApiKeySet } = useApiKey();

  const renderPage = () => {
    switch (page) {
      case 'voices':
        return <VoicesPage session={session} />;
      case 'tts':
        return <TTSPage session={session} />;
      case 'transcribe':
        return <TranscribePage />;
      case 'live':
        return <LivePage />;
      default:
        return <VoicesPage session={session} />;
    }
  };
  
  const NavItem: React.FC<{
      label: string;
      pageName: Page;
      icon: React.ReactNode;
    }> = ({ label, pageName, icon }) => (
        <li>
            <a
            href="#"
            onClick={(e) => {
                e.preventDefault();
                setPage(pageName);
            }}
            className={`flex items-center p-2 text-base font-normal rounded-lg ${
                page === pageName ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700'
            }`}
            >
            {icon}
            <span className="ml-3">{label}</span>
            </a>
        </li>
    );

  return (
    <>
        <div className="flex h-full bg-gray-900 text-white">
        <aside className="w-64" aria-label="Sidebar">
            <div className="overflow-y-auto py-4 px-3 bg-gray-800 rounded-r-lg h-full flex flex-col">
                <a href="#" className="flex items-center pl-2.5 mb-5">
                    <SoundWaveIcon className="h-6 w-6 mr-3 text-indigo-400" />
                    <span className="self-center text-xl font-semibold whitespace-nowrap text-white">Gemini Voice</span>
                </a>
            <ul className="space-y-2 flex-grow">
                <NavItem label="My Voices" pageName="voices" icon={<UserIcon className="w-6 h-6" />} />
                <NavItem label="Generate TTS" pageName="tts" icon={<TextIcon className="w-6 h-6" />} />
                <NavItem label="Transcribe" pageName="transcribe" icon={<MicIcon className="w-6 h-6" />} />
                <NavItem label="Live Conversation" pageName="live" icon={<MessageSquareIcon className="w-6 h-6" />} />
            </ul>
            <div className="mt-auto space-y-2">
                <button
                    onClick={() => setIsApiKeyModalOpen(true)}
                    className={`w-full flex items-center justify-center gap-2 text-white font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors ${
                    isApiKeySet
                        ? 'bg-gray-600 hover:bg-gray-700'
                        : 'bg-yellow-600 hover:bg-yellow-700 animate-pulse'
                    }`}
                >
                    <KeyIcon className="w-5 h-5" />
                    {isApiKeySet ? 'Update API Key' : 'Set API Key'}
                </button>
                {session ? (
                <>
                    <div className="p-2 text-sm text-gray-400">
                        Logged in as: <br/> 
                        <span className="font-medium text-gray-300 break-all">{session.user.email}</span>
                    </div>
                    <button
                    onClick={() => supabase.auth.signOut()}
                    className="w-full text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:ring-red-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                    >
                    Sign Out
                    </button>
                </>
                ) : (
                <button
                    onClick={() => setIsAuthModalOpen(true)}
                    className="w-full text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-900 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                >
                    Sign In
                </button>
                )}
            </div>
            </div>
        </aside>

        <main className="flex-1 p-6 overflow-auto">
            {renderPage()}
        </main>
        </div>
        <Auth isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />
    </>
  );
};

export default MainApp;