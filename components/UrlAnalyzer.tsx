import React, { useState } from 'react';
import { extractProductInfo } from '../services/gemini';
import { ProductContext } from '../types';

interface Props {
  onComplete: (data: ProductContext) => void;
}

const UrlAnalyzer: React.FC<Props> = ({ onComplete }) => {
  const [url, setUrl] = useState('');
  const [manualText, setManualText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await extractProductInfo(url, manualText);
      onComplete(data);
    } catch (err) {
      alert("Noe gikk galt under analysen. Prøv igjen.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-lg mt-10">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Hva skal du selge?</h2>
      <p className="text-gray-600 mb-6">Lim inn en URL til produktet eller bedriften din, så henter vi informasjonen automatisk.</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nettside URL</label>
          <input
            type="url"
            required
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="https://minbedrift.no/produkt"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tilleggsinformasjon (valgfritt)</label>
          <textarea
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none h-24"
            placeholder="Kopier inn tekst fra nettsiden hvis URL-en er låst, eller skriv litt om hva du selger..."
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 px-4 rounded-lg text-white font-semibold transition-colors ${
            loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyserer...
            </span>
          ) : (
            'Generer Trenings-Personas'
          )}
        </button>
      </form>
    </div>
  );
};

export default UrlAnalyzer;
