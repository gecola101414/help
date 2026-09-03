import React, { useState } from 'react';
import { X, Sparkles, HeartHandshake, HelpCircle, Coins, MapPin, Loader2 } from 'lucide-react';
import { UserProfile, HelpType, DEFAULT_HELP_CATEGORIES } from '../types';

interface CreateHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSave: (item: {
    type: HelpType;
    title: string;
    description: string;
    category: string;
    creditsRequired: number;
    isFree: boolean;
  }) => void;
  onOpenProfile: () => void;
}

export const CreateHelpModal: React.FC<CreateHelpModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
  onOpenProfile,
}) => {
  const [type, setType] = useState<HelpType>('offer');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(DEFAULT_HELP_CATEGORIES[0].id);
  const [creditsRequired, setCreditsRequired] = useState<number>(0);
  const [isFree, setIsFree] = useState<boolean>(true);
  
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Check if user has offers set up (required to request help or participate)
  if (!user || user.offers.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            ⚠️
          </div>
          <h3 className="text-lg font-bold text-slate-900">Regola d'oro di HELP</h3>
          <p className="text-sm text-slate-600">
            "Solo chi si mette a disposizione per gli altri può essere aiutato." Prima di pubblicare richieste o offerte, configura cosa puoi mettere a disposizione nel tuo profilo.
          </p>
          <div className="pt-2">
            <button
              onClick={() => {
                onClose();
                onOpenProfile();
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20"
            >
              Configura il tuo profilo ora
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      setError('Inserisci una breve descrizione per l’IA (es: "Ho bisogno di un passaggio per la spesa" o "Offro ripetizioni di matematica")');
      return;
    }
    setIsAiLoading(true);
    setError('');

    try {
      const action = type === 'offer' ? 'generate_offer' : 'generate_request';
      const res = await fetch('/api/ai-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, action, category }),
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.category) setCategory(data.category);
      if (typeof data.creditsRequired === 'number') {
        setCreditsRequired(data.creditsRequired);
        setIsFree(data.creditsRequired === 0);
      }
    } catch (err: any) {
      setError(err.message || 'Errore nella generazione con IA');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Compila titolo e descrizione.');
      return;
    }

    onSave({
      type,
      title: title.trim(),
      description: description.trim(),
      category,
      creditsRequired: isFree ? 0 : Number(creditsRequired),
      isFree,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Pubblica su HELP</h2>
            <p className="text-xs text-emerald-100 mt-1">Condividi un aiuto o esponi la tua esigenza</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Type Selector: Offer vs Request */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('offer')}
              className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border transition-all ${
                type === 'offer'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <HeartHandshake className="w-4 h-4" />
              <span>Offro Aiuto (Metto a disp.)</span>
            </button>
            <button
              type="button"
              onClick={() => setType('request')}
              className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border transition-all ${
                type === 'request'
                  ? 'bg-teal-700 text-white border-teal-700 shadow-md shadow-teal-700/20'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Ho Bisogno di Aiuto</span>
            </button>
          </div>

          {/* AI Generator Helper */}
          <div className="bg-emerald-50/80 border border-emerald-100 p-4 rounded-xl space-y-2">
            <div className="flex items-center space-x-2 text-emerald-900 text-xs font-bold">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Genera con IA (Gemini)</span>
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={type === 'offer' ? 'es. Posso riparare biciclette nel weekend...' : 'es. Ho bisogno di aiuto per la spesa pesante...'}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-emerald-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                disabled={isAiLoading}
                onClick={handleAiGenerate}
                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-xl text-xs font-bold shrink-0 flex items-center space-x-1 transition-all disabled:opacity-50"
              >
                {isAiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Genera</span>
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 text-xs font-medium"
            >
              {DEFAULT_HELP_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.title}>
                  {cat.title}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Titolo dell'annuncio
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm font-medium"
              placeholder="es. Spesa urgente per anziani in zona Duomo"
              required
              maxLength={80}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Descrizione Dettagliata
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 text-xs"
              placeholder="Descrivi in modo chiaro come puoi aiutare o di cosa hai bisogno..."
              required
            />
          </div>

          {/* Free vs Credits */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-900">Gratuito (Solidarietà di vicinato)</div>
                <div className="text-[11px] text-slate-500">Nessun credito richiesto, puro spirito di convivenza civile</div>
              </div>
              <input
                type="checkbox"
                checked={isFree}
                onChange={(e) => {
                  setIsFree(e.target.checked);
                  if (e.target.checked) setCreditsRequired(0);
                }}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
              />
            </div>

            {!isFree && (
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Crediti HELP richiesti (per servizi speciali):
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={creditsRequired}
                    onChange={(e) => setCreditsRequired(Number(e.target.value))}
                    className="w-24 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold"
                  />
                  <div className="text-xs text-amber-600 flex items-center space-x-1 font-semibold">
                    <Coins className="w-3.5 h-3.5" />
                    <span>crediti HELP</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2"
            >
              <span>Pubblica Subito</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
