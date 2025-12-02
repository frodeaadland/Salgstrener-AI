import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Persona, ProductContext, ChatMessage, CallMode } from '../types';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPCM16Blob, decodeAudioData, base64ToUint8Array } from '../utils/audio';

interface Props {
  persona: Persona;
  product: ProductContext;
  mode: CallMode;
  onEndCall: (transcript: ChatMessage[]) => void;
  onCancel: () => void;
}

const CallInterface: React.FC<Props> = ({ persona, product, mode, onEndCall, onCancel }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  
  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Playback Refs
  const nextStartTimeRef = useRef<number>(0);
  const audioQueueRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Session Ref
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const mountedRef = useRef(true);

  // Helper to update transcript smartly
  const updateTranscript = useCallback((role: 'user' | 'model', text: string) => {
    setTranscript(prev => {
      const lastMsg = prev[prev.length - 1];
      // If the last message is from the same role, append/update it
      if (lastMsg && lastMsg.role === role) {
        const updated = [...prev];
        updated[updated.length - 1] = { ...lastMsg, text: lastMsg.text + text };
        return updated;
      }
      // Otherwise add new message
      return [...prev, { role, text, timestamp: Date.now() }];
    });
  }, []);

  const startSession = async () => {
    if (status === 'connecting' || status === 'connected') return;
    setStatus('connecting');
    setErrorMsg('');
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      
      // Input stream for microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
          } 
      });
      streamRef.current = stream;

      // Config for Gemini Live
      const systemInstruction = `
        Du er ${persona.name}, ${persona.title} i ${persona.companySize}. 
        Du blir oppringt av en selger fra ${product.companyName}.
        
        Din personlighet:
        - Motivasjon: ${persona.motivation}
        - Smertepunkter: ${persona.painPoints}
        - Stil: ${persona.communicationStyle}
        - Vanskelighetsgrad: ${persona.difficulty}/5 (1=lett, 5=umulig).
        
        Produktinfo selgeren har: ${product.description}. USP: ${product.sellingPoints.join(', ')}.
        
        Instruksjoner:
        - Snakk norsk.
        - Vær kort og konsis som i en telefonsamtale.
        - Ikke vær for hjelpsom hvis vanskelighetsgraden er høy.
        - Avbryt gjerne hvis det er naturlig.
        - Start samtalen med å si "Hallo?" eller "Ja, det er ${persona.name}?" når du kobler til.
      `;

      const config = {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction,
          inputAudioTranscription: {}, 
          outputAudioTranscription: {} 
        },
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            if (mountedRef.current) {
                setStatus('connected');
                setupAudioInput(stream);
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!mountedRef.current) return;

            // Handle Transcription
            if (message.serverContent?.outputTranscription?.text) {
               updateTranscript('model', message.serverContent.outputTranscription.text);
            }
            if (message.serverContent?.inputTranscription?.text) {
               updateTranscript('user', message.serverContent.inputTranscription.text);
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const ctx = audioContextRef.current;
              // Ensure context is running (sometimes browsers suspend it)
              if (ctx.state === 'suspended') {
                  try { await ctx.resume(); } catch(e) { console.error(e); }
              }
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              
              try {
                  const audioBuffer = await decodeAudioData(
                      base64ToUint8Array(base64Audio),
                      ctx
                  );
                  
                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(ctx.destination);
                  
                  source.onended = () => {
                      audioQueueRef.current.delete(source);
                  };
                  
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  audioQueueRef.current.add(source);
              } catch (e) {
                  console.error("Error decoding audio", e);
              }
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              console.log("Interrupted!");
              audioQueueRef.current.forEach(source => {
                  try { source.stop(); } catch(e) {}
              });
              audioQueueRef.current.clear();
              if (audioContextRef.current) {
                   nextStartTimeRef.current = audioContextRef.current.currentTime;
              }
            }
          },
          onclose: () => {
            console.log("Session closed");
          },
          onerror: (err: any) => {
            console.error("Session error", err);
            if (mountedRef.current) {
                setStatus('error');
                setErrorMsg("Mistet kontakten med serveren. Sjekk internett eller prøv igjen.");
            }
          }
        }
      };

      sessionPromiseRef.current = ai.live.connect(config);
    } catch (err: any) {
      console.error("Failed to start session", err);
      setStatus('error');
      setErrorMsg(err.message || "Kunne ikke starte sesjonen");
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // NOTE: Removed auto-start useEffect to prevent AudioContext issues.
    // User must click "Start Samtale" to explicitly start.

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, []);

  const setupAudioInput = (stream: MediaStream) => {
    if (!audioContextRef.current) return;
    
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const source = inputCtx.createMediaStreamSource(stream);
    const processor = inputCtx.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (e) => {
      if (isMuted) return;
      
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for UI visualizer
      let sum = 0;
      for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
      const rms = Math.sqrt(sum / inputData.length);
      setVolumeLevel(Math.min(1, rms * 5)); 

      // VAD (Voice Activity Detection) - Simple Gate
      // Only send audio if volume is above threshold to prevent noise/echo loops
      if (rms > 0.01) {
          const pcmBlob = createPCM16Blob(inputData);
          if (sessionPromiseRef.current) {
              sessionPromiseRef.current.then(session => {
                  try {
                    session.sendRealtimeInput({ media: pcmBlob });
                  } catch(e) {
                      console.error("Failed to send input", e);
                  }
              });
          }
      }
    };

    source.connect(processor);
    processor.connect(inputCtx.destination);
    
    inputSourceRef.current = source as any; 
    processorRef.current = processor;
  };

  const cleanup = () => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (inputSourceRef.current) {
        inputSourceRef.current.disconnect();
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleHangup = () => {
      cleanup();
      onEndCall(transcript);
  };

  if (status === 'error') {
      return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gray-50">
              <div className="text-red-500 text-6xl mb-6">⚠️</div>
              <h3 className="text-2xl font-bold mb-3 text-gray-800">Kunne ikke koble til samtale</h3>
              <p className="mb-6 text-gray-600 max-w-md">
                  {errorMsg}
              </p>
              <div className="flex space-x-4">
                  <button 
                    onClick={() => { setStatus('idle'); startSession(); }} 
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
                  >
                    Prøv Igjen
                  </button>
                  <button 
                    onClick={onCancel} 
                    className="px-6 py-3 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Gå tilbake
                  </button>
              </div>
          </div>
      )
  }

  if (status === 'idle' || status === 'connecting') {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white">
            <div className="mb-8 relative">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center text-4xl font-bold border-4 border-white/20 ${persona.avatarColor}`}>
                    {persona.name.charAt(0)}
                </div>
                {status === 'connecting' && (
                    <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                )}
            </div>
            <h2 className="text-2xl font-bold mb-2">Ringer {persona.name}...</h2>
            <p className="text-gray-400 mb-8">{persona.title}</p>
            
            {status === 'idle' && (
                <button 
                    onClick={startSession}
                    className="px-8 py-4 bg-green-600 text-white font-bold rounded-full text-lg hover:bg-green-700 transition-transform hover:scale-105 shadow-xl flex items-center space-x-2"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                    <span>Start Samtale</span>
                </button>
            )}
        </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full bg-green-500 animate-pulse`}></div>
          <span className="font-mono text-sm uppercase tracking-widest opacity-80">
            SAMTALE AKTIV
          </span>
        </div>
        <div className="text-sm font-semibold opacity-75">{product.companyName} Salgstrening</div>
      </div>

      {/* Main Visualizer Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative p-4">
        {/* Persona Avatar / Visual */}
        <div className="relative z-0 mb-12">
           <div className={`w-48 h-48 rounded-full flex items-center justify-center text-6xl font-bold shadow-2xl border-4 border-white/10 transition-transform duration-200 ${persona.avatarColor}`}
                style={{ transform: `scale(${1 + volumeLevel * 0.1})` }}>
              {persona.name.charAt(0)}
           </div>
           {/* Ambient Pulse */}
           <div className="absolute inset-0 rounded-full border border-white/20 animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>
        </div>

        <div className="text-center space-y-2 z-10 mb-12">
          <h2 className="text-4xl font-bold tracking-tight">{persona.name}</h2>
          <p className="text-xl text-gray-400">{persona.title}</p>
        </div>

        {/* Live Transcripts (Subtitles) */}
        <div className="absolute bottom-36 left-0 right-0 px-4 flex justify-center">
            <div className="bg-black/60 backdrop-blur-md p-6 rounded-2xl max-w-3xl w-full text-center min-h-[80px] flex items-center justify-center transition-all duration-300 border border-white/10">
                <p className="text-lg font-medium leading-relaxed">
                    {transcript.length > 0 ? transcript[transcript.length - 1].text : "..."}
                </p>
            </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800/80 backdrop-blur-lg p-8 flex justify-center items-center space-x-10 pb-12 rounded-t-[3rem] shadow-2xl z-20 border-t border-white/5">
        <button 
          onClick={toggleMute}
          className={`p-6 rounded-full transition-all transform hover:scale-105 shadow-lg ${isMuted ? 'bg-white text-gray-900' : 'bg-gray-700 text-white hover:bg-gray-600'}`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18"></path></svg>
          ) : (
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
          )}
        </button>

        <button 
          onClick={handleHangup}
          className="p-8 bg-red-600 rounded-full text-white shadow-red-600/30 shadow-xl hover:bg-red-700 transform hover:scale-110 transition-all ring-4 ring-red-500/20"
          title="Avslutt samtale"
        >
          <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.5 7.57 6.13 12 6.13s8.66 2.37 11.71 5.54c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CallInterface;