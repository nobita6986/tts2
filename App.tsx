
import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import MainApp from './components/MainApp';
import type { Session } from '@supabase/supabase-js';
import { ApiKeyProvider } from './contexts/ApiKeyContext';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  return (
    <ApiKeyProvider>
        <div className="h-full">
            <MainApp session={session} />
        </div>
    </ApiKeyProvider>
  );
};

export default App;