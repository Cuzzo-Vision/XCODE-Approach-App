import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { generateIcebreaker } from '../services/geminiService';
import { IcebreakerResponse, ScenarioType } from '../types';
import { Sparkles, Send, Copy, ThumbsUp, MessageCircle, AlertCircle } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [scenario, setScenario] = useState('');
  const [tone, setTone] = useState<string>(ScenarioType.CASUAL);
  const [result, setResult] = useState<IcebreakerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!scenario.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await generateIcebreaker(scenario, tone);
      setResult(data);
    } catch (err) {
      setError("We couldn't generate an approach right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result.opener);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-8">
        {/* Header Section */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white flex items-center justify-center gap-3">
            <Sparkles className="text-red-500" />
            <span>The Wingman</span>
          </h1>
          <p className="text-zinc-400 max-w-lg mx-auto">
            Describe the situation, and our AI will craft the perfect icebreaker to help you make your move.
          </p>
        </div>

        {/* Input Section */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                What's the situation?
              </label>
              <textarea
                value={scenario}
                onChange={(e) => setScenario(e.target.value)}
                placeholder="e.g., I see someone reading 'Dune' at a coffee shop..."
                className="w-full h-32 bg-black border border-zinc-800 rounded-xl p-4 text-white placeholder-zinc-600 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none resize-none transition-all"
              />
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Desired Vibe
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.values(ScenarioType).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        tone === t
                          ? 'bg-red-600 text-white shadow-lg shadow-red-900/20'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={loading || !scenario.trim()}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                    loading || !scenario.trim()
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-gray-200 active:scale-95'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-zinc-500 border-t-black rounded-full animate-spin"></div>
                      <span>Thinking...</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>Generate Approach</span>
                    </>
                  )}
                </button>
              </div>
              
              {error && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Results Section */}
          <div className="md:col-span-1">
             {result ? (
               <div className="bg-gradient-to-b from-red-900/20 to-zinc-900 border border-red-900/30 rounded-2xl p-6 h-full flex flex-col animate-fade-in relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                    <MessageCircle size={100} className="text-red-500" />
                 </div>
                 
                 <div className="relative z-10">
                   <h3 className="text-red-400 font-bold uppercase tracking-wider text-xs mb-3">Suggested Opener</h3>
                   <div className="bg-black/50 p-4 rounded-xl border border-red-900/30 mb-4 backdrop-blur-sm">
                     <p className="text-lg text-white font-medium italic">"{result.opener}"</p>
                   </div>
                   
                   <button 
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors mb-6"
                   >
                     <Copy size={12} />
                     <span>Copy to clipboard</span>
                   </button>

                   <div className="space-y-4">
                     <div>
                       <h3 className="text-zinc-500 font-bold uppercase tracking-wider text-xs mb-1">Pro Tip</h3>
                       <p className="text-zinc-300 text-sm leading-relaxed">{result.advice}</p>
                     </div>
                     
                     <div>
                       <h3 className="text-zinc-500 font-bold uppercase tracking-wider text-xs mb-2">Success Probability</h3>
                       <div className="flex items-center gap-3">
                         <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                           <div 
                              className="h-full bg-red-500 rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${result.confidenceScore}%` }}
                           ></div>
                         </div>
                         <span className="text-red-400 font-bold">{result.confidenceScore}%</span>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
             ) : (
               <div className="h-full bg-zinc-900/30 border border-zinc-800/50 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-zinc-600 border-dashed">
                 <ThumbsUp size={48} className="mb-4 opacity-20" />
                 <p className="text-sm">Ready when you are.<br/>Fill in the details to get started.</p>
               </div>
             )}
          </div>
        </div>

        {/* Recent Tips / Static Content Filler */}
        <div className="mt-8 border-t border-zinc-900 pt-8">
          <h2 className="text-xl font-bold text-white mb-6">Mastering the Art of Approach</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "Eye Contact", desc: "Hold it for a second before approaching to gauge interest." },
              { title: "Body Language", desc: "Keep your hands visible and shoulders open." },
              { title: "The Exit", desc: "Always have a graceful exit strategy if they aren't interested." }
            ].map((item, i) => (
              <div key={i} className="bg-zinc-950 border border-zinc-900 p-5 rounded-xl hover:border-zinc-800 transition-colors">
                <h3 className="text-red-500 font-bold mb-2">{item.title}</h3>
                <p className="text-zinc-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};