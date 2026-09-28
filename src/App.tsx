import { useState } from 'react';
import { Login } from './components/Login';
import { ChatWorkspace } from './components/ChatWorkspace';
import type { Session } from './hooks/useChatSession';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  return session ? (
    <ChatWorkspace session={session} onLogout={() => setSession(null)} />
  ) : (
    <Login onStart={setSession} />
  );
}
