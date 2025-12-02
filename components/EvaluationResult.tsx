import React, { useEffect, useState } from 'react';
import { ChatMessage, EvaluationMetrics, Persona, ProductContext } from '../types';
import { evaluateSession } from '../services/gemini';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  transcript: ChatMessage[];
  product: ProductContext;
  persona: Persona;
  onRestart: () => void;
}

const EvaluationResult: React.FC<Props> = ({ transcript, product, persona, onRestart }) => {
  const [evaluation, setEvaluation] = useState<EvaluationMetrics | null>(null);

  useEffect(() => {
    const runEval = async () => {
      if (transcript.length === 0) return;
      const res = await evaluateSession(transcript, product, persona);
      setEvaluation(res);
    };
    runEval();
  }, [transcript, product, persona]);

  if (!evaluation) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-6"></div>
        <h2 className="text-2xl font-bold text-gray-800">Analyserer samtalen din...</h2>
        <p className="text-gray-500 mt-2">AI-coachen ser på dine prestasjoner.</p>
      </div>
    );
  }

  const data = [
    { name: 'Åpning', value: evaluation.openingScore, color: '#60A5FA' },
    { name: 'Behov', value: evaluation.discoveryScore, color: '#34D399' },
    { name: 'Pitch', value: evaluation.pitchScore, color: '#818CF8' },
    { name: 'Innvendinger', value: evaluation.objectionHandlingScore, color: '#FBBF24' },
    { name: 'Closing', value: evaluation.closingScore, color: '#F87171' },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 pb-20">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Evaluering</h2>
        <p className="text-gray-500">Samtale med {persona.name} ({persona.title})</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
            <h3 className="text-xl font-semibold mb-4">Total Score</h3>
            {/* Added style with width and height to fix ResponsiveContainer warning */}
            <div className="relative flex items-center justify-center" style={{ width: 192, height: 192 }}>
               <div className="absolute inset-0 flex items-center justify-center flex-col z-10">
                  <span className="text-5xl font-bold text-gray-800">{evaluation.totalScore}</span>
                  <span className="text-sm text-gray-400">/ 100</span>
               </div>
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie
                      data={[{ value: evaluation.totalScore }, { value: 100 - evaluation.totalScore }]}
                      innerRadius={80}
                      outerRadius={90}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill={evaluation.totalScore > 70 ? '#10B981' : evaluation.totalScore > 40 ? '#F59E0B' : '#EF4444'} />
                      <Cell fill="#F3F4F6" />
                    </Pie>
                 </PieChart>
               </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
           <h3 className="text-xl font-semibold mb-4">Detaljert Score</h3>
           <div className="space-y-4">
             {data.map((item) => (
               <div key={item.name}>
                 <div className="flex justify-between text-sm mb-1">
                   <span className="font-medium text-gray-700">{item.name}</span>
                   <span className="font-bold text-gray-900">{item.value}/100</span>
                 </div>
                 <div className="w-full bg-gray-100 rounded-full h-2.5">
                   <div 
                      className="h-2.5 rounded-full transition-all duration-1000" 
                      style={{ width: `${item.value}%`, backgroundColor: item.color }}
                   ></div>
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-green-50 p-6 rounded-xl border border-green-100">
            <h4 className="font-bold text-green-800 mb-3 flex items-center">
                <span className="mr-2">👍</span> Bra jobba
            </h4>
            <ul className="space-y-2 text-sm text-green-900">
                {evaluation.goodPoints.map((p, i) => <li key={i}>• {p}</li>)}
            </ul>
        </div>
         <div className="bg-yellow-50 p-6 rounded-xl border border-yellow-100">
            <h4 className="font-bold text-yellow-800 mb-3 flex items-center">
                <span className="mr-2">💡</span> Forbedringspotensial
            </h4>
            <ul className="space-y-2 text-sm text-yellow-900">
                {evaluation.improvementPoints.map((p, i) => <li key={i}>• {p}</li>)}
            </ul>
        </div>
         <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
            <h4 className="font-bold text-blue-800 mb-3 flex items-center">
                <span className="mr-2">🚀</span> Neste steg
            </h4>
            <ul className="space-y-2 text-sm text-blue-900">
                {evaluation.nextSteps.map((p, i) => <li key={i}>• {p}</li>)}
            </ul>
        </div>
      </div>

      <div className="flex justify-center pt-8">
        <button 
            onClick={onRestart}
            className="px-8 py-3 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-colors shadow-lg"
        >
            Start Ny Økt
        </button>
      </div>
    </div>
  );
};

export default EvaluationResult;