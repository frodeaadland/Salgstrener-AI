import React, { useState } from 'react';
import { AppState, ProductContext, Persona, ChatMessage, CallMode } from './types';
import UrlAnalyzer from './components/UrlAnalyzer';
import PersonaSelector from './components/PersonaSelector';
import CallInterface from './components/CallInterface';
import ChatSession from './components/ChatSession';
import EvaluationResult from './components/EvaluationResult';

function App() {
  const [state, setState] = useState<AppState>(AppState.SETUP);
  const [productContext, setProductContext] = useState<ProductContext | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [callTranscript, setCallTranscript] = useState<ChatMessage[]>([]);
  const [callMode, setCallMode] = useState<CallMode>(CallMode.VOICE);

  const handleProductAnalyzed = (data: ProductContext) => {
    setProductContext(data);
    setState(AppState.PERSONA_SELECTION);
  };

  const handlePersonaSelected = (persona: Persona) => {
    setSelectedPersona(persona);
    // You could add a mode selector modal here, for now we default to what user picked or hardcode
    // Let's toggle mode via UI in next step or just default to Voice for "Trening"
    // For this demo, let's assume Voice is the primary feature but allow fallback if needed.
    setState(AppState.CALLING);
  };

  const handleEndCall = (transcript: ChatMessage[]) => {
    setCallTranscript(transcript);
    setState(AppState.EVALUATION);
  };

  const handleRestart = () => {
    setCallTranscript([]);
    setSelectedPersona(null);
    setState(AppState.PERSONA_SELECTION);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-2xl font-extrabold text-blue-600 tracking-tight">SalgsTrener AI</span>
            </div>
            <div className="flex items-center space-x-4">
               {state === AppState.CALLING && (
                   <div className="flex bg-gray-100 rounded-lg p-1">
                       <button 
                         onClick={() => setCallMode(CallMode.VOICE)}
                         className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${callMode === CallMode.VOICE ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                       >
                           Tale
                       </button>
                       <button 
                         onClick={() => setCallMode(CallMode.TEXT)}
                         className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${callMode === CallMode.TEXT ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                       >
                           Chat
                       </button>
                   </div>
               )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="h-[calc(100vh-64px)] overflow-hidden">
        {state === AppState.SETUP && (
          <div className="h-full overflow-y-auto">
            <UrlAnalyzer onComplete={handleProductAnalyzed} />
          </div>
        )}

        {state === AppState.PERSONA_SELECTION && productContext && (
          <div className="h-full overflow-y-auto">
             <PersonaSelector 
               productContext={productContext} 
               onSelect={handlePersonaSelected}
               onBack={() => setState(AppState.SETUP)}
             />
          </div>
        )}

        {state === AppState.CALLING && selectedPersona && productContext && (
          <div className="h-full">
            {callMode === CallMode.VOICE ? (
              <CallInterface 
                persona={selectedPersona} 
                product={productContext}
                mode={CallMode.VOICE}
                onEndCall={handleEndCall}
                onCancel={() => setState(AppState.PERSONA_SELECTION)}
              />
            ) : (
               <ChatSession 
                 persona={selectedPersona} 
                 product={productContext}
                 onEndCall={handleEndCall}
                 onCancel={() => setState(AppState.PERSONA_SELECTION)}
               />
            )}
          </div>
        )}

        {state === AppState.EVALUATION && selectedPersona && productContext && (
          <div className="h-full overflow-y-auto">
            <EvaluationResult 
              transcript={callTranscript}
              product={productContext}
              persona={selectedPersona}
              onRestart={handleRestart}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
