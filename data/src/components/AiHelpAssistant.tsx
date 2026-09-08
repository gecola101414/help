import React, { useState } from 'react';
import { Sparkles, Send, Bot, User, Loader2, HelpCircle, HeartHandshake } from 'lucide-react';

export const AiHelpAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Ciao! Sono l’assistente IA di HELP. Posso aiutarti a trovare idee su come offrire aiuto nel tuo quartiere, darti consigli di civile convivenza o suggerirti come gestire al meglio i crediti HELP. Come posso aiutarti oggi?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userText, action: 'chat' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages((prev) => [...prev, { role: 'assistant', text: data.result }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', text: 'Mi dispiace, si è verificato un errore di connessione con l’IA.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-lg flex items-center space-x-4">
        <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Assistente IA HELP (Gemini)</h1>
          <p className="text-xs text-amber-100 mt-0.5">Il tuo consulente personale per il vicinato solidale e la cittadinanza attiva</p>
        </div>
      </div>

      {/* Chat Container */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[550px]">
        
        {/* Messages list */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex items-start space-x-3 ${m.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-emerald-600 text-white rounded-br-xs' : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-xs'
              }`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center space-x-3 text-slate-400 text-xs">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex items-center space-x-2 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                <span>L'IA sta elaborando la risposta...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input form */}
        <form onSubmit={handleSend} className="p-4 bg-slate-50 border-t border-slate-200 flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Chiedi un consiglio, un'idea di aiuto o come organizzare il vicinato..."
            className="flex-1 px-4 py-3 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-800"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-amber-500/20 transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            <span>Invia</span>
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>

    </div>
  );
};
