import React, { useEffect, useState } from 'react';
import { generatePersonas } from '../services/gemini';
import { Persona, ProductContext } from '../types';

interface Props {
  productContext: ProductContext;
  onSelect: (persona: Persona) => void;
  onBack: () => void;
}

const PersonaSelector: React.FC<Props> = ({ productContext, onSelect, onBack }) => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const result = await generatePersonas(productContext);
      if (mounted) {
        setPersonas(result);
        setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [productContext]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Genererer realistiske kunder...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-900 font-medium">
          &larr; Tilbake
        </button>
        <h2 className="text-2xl font-bold text-gray-800">Velg en kunde å ringe</h2>
        <div className="w-16"></div> 
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {personas.map((persona) => (
          <div 
            key={persona.id} 
            onClick={() => onSelect(persona)}
            className="bg-white rounded-xl shadow-md hover:shadow-xl transition-all cursor-pointer border border-transparent hover:border-blue-500 group overflow-hidden"
          >
            <div className={`h-2 ${persona.avatarColor} w-full`}></div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600">{persona.name}</h3>
                  <p className="text-sm text-gray-500">{persona.title}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  persona.difficulty <= 2 ? 'bg-green-100 text-green-800' :
                  persona.difficulty <= 4 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  Nivå {persona.difficulty}
                </span>
              </div>
              
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="font-semibold text-gray-700 block">Motivasjon:</span>
                  <p className="text-gray-600">{persona.motivation}</p>
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-gray-700 block">Smertepunkt:</span>
                  <p className="text-gray-600">{persona.painPoints}</p>
                </div>
                 <div className="text-sm">
                  <span className="font-semibold text-gray-700 block">Stil:</span>
                  <p className="text-gray-600 italic">"{persona.communicationStyle}"</p>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                <span className="text-blue-600 font-semibold text-sm group-hover:translate-x-1 transition-transform flex items-center">
                  Start Samtale &rarr;
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PersonaSelector;
