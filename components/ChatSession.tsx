import React, { useState, useEffect, useRef } from 'react';
import { Persona, ProductContext, ChatMessage } from '../types';
import { getClient } from '../services/gemini';
import { Chat } from '@google/genai';

interface Props {
  persona: Persona;
  product: ProductContext;
  onEndCall: (transcript: ChatMessage[]) => void;
  onCancel: () => void;
}

const ChatSession: React.FC<Props> = ({ persona, product, onEndCall, onCancel }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<Chat | null>(null);

  useEffect(() => {
    // Initialize Chat
    const systemInstruction = `
      Du er ${persona.name}, ${persona.title} i ${persona.companySize}. 
      Du chatter med en selger fra ${product.companyName}.
      
      Din personlighet:
      - Motivasjon: ${persona.motivation}
      - Smertepunkter: ${persona.painPoints}
      - Stil: ${persona.communicationStyle}
      - Vanskelighetsgrad: ${persona.difficulty}/5 (1=lett, 5=umulig).
      
      Produktinfo selgeren har: ${product.description}. USP: ${product.sellingPoints.join(', ')}.
      
      Instruksjoner:
      - Svar på norsk.
      - Vær kort og konsis (som i en chat/SMS).
      - Ikke vær for hjelpsom hvis vanskelighetsgraden er høy.
    `;

    const ai = getClient();
    chatRef.current = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: { systemInstruction }
    });

    // Initial greeting from Persona
    const start = async () => {
        setIsLoading(true);
        try {
            const res = await chatRef.current?.sendMessage({ message: "Start samtalen ved å si hei." });
            if (res?.text) {
                setMessages([{ role: 'model', text: res.text, timestamp: Date.now() }]);
            }
        } finally {
            setIsLoading(false);
        }
    };
    start();
  }, [persona, product]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await chatRef.current?.sendMessage({ message: userMsg.text });
      if (result?.text) {
        setMessages(prev => [...prev, { role: 'model', text: result.text, timestamp: Date.now() }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-3">
           <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${persona.avatarColor}`}>
              {persona.name.charAt(0)}
           </div>
           <div>
             <h3 className="font-bold text-gray-800">{persona.name}</h3>
             <p className="text-xs text-gray-500">{persona.title} @ {persona.companySize}</p>
           </div>
        </div>
        <button 
            onClick={() => onEndCall(messages)}
            className="text-red-600 font-semibold text-sm hover:bg-red-50 px-3 py-1 rounded"
        >
            Avslutt Samtale
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
              msg.role === 'user' 
              ? 'bg-blue-600 text-white rounded-br-none' 
              : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
            }`}>
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                 <div className="bg-gray-200 text-gray-500 rounded-2xl px-4 py-2 text-xs animate-pulse">
                    Skriver...
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 bg-white border-t border-gray-200">
        <div className="flex space-x-2">
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Skriv melding..."
                className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="bg-blue-600 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center hover:bg-blue-700 disabled:opacity-50"
            >
                &uarr;
            </button>
        </div>
      </form>
    </div>
  );
};

export default ChatSession;
