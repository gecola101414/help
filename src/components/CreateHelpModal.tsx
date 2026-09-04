import React, { useState } from 'react';
import { X, Sparkles, HeartHandshake, HelpCircle, Coins, MapPin, Loader2, Compass, Radio, Building2, Navigation, Check, Search, LocateFixed } from 'lucide-react';
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
    trackingType: 'dynamic' | 'static';
    actionRadiusKm: number;
    staticLocation?: {
      comune: string;
      via?: string;
      civico?: string;
      formattedAddress: string;
    };
    customCoords?: {
      lat: number;
      lng: number;
    };
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
  const [trackingType, setTrackingType] = useState<'dynamic' | 'static'>('dynamic');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(DEFAULT_HELP_CATEGORIES[0].id);
  const [creditsRequired, setCreditsRequired] = useState<number>(0);
  const [isFree, setIsFree] = useState<boolean>(true);
  const [actionRadiusKm, setActionRadiusKm] = useState<number>(5);

  // Static location states (Comune, Via, Civico)
  const [staticComune, setStaticComune] = useState(() => {
    if (!user?.location?.address) return 'Roma';
    const firstPart = user.location.address.split(',')[0]?.trim();
    return firstPart.startsWith('GPS') ? 'Roma' : firstPart;
  });
  const [staticVia, setStaticVia] = useState('');
  const [staticCivico, setStaticCivico] = useState('');
  const [staticCoords, setStaticCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [staticFormattedAddress, setStaticFormattedAddress] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeFeedback, setGeocodeFeedback] = useState<{ status: 'success' | 'error' | 'idle'; message: string }>({
    status: 'idle',
    message: '',
  });

  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGeocodeAddress = async () => {
    if (!staticComune.trim()) {
      setGeocodeFeedback({ status: 'error', message: 'Inserisci almeno il Comune.' });
      return;
    }
    setIsGeocoding(true);
    setGeocodeFeedback({ status: 'idle', message: '' });
    try {
      const fullQuery = [staticVia.trim(), staticCivico.trim(), staticComune.trim()].filter(Boolean).join(' ');
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(fullQuery)}`);
      const data = await res.json();
      if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
        setStaticCoords({ lat: data.lat, lng: data.lng });
        const pretty = [staticVia.trim(), staticCivico.trim(), staticComune.trim()].filter(Boolean).join(', ');
        setStaticFormattedAddress(pretty || data.displayName);
        setGeocodeFeedback({
          status: 'success',
          message: `Localizzato: ${pretty || data.displayName} (${data.lat.toFixed(4)}, ${data.lng.toFixed(4)})`,
        });
      } else {
        setGeocodeFeedback({
          status: 'error',
          message: 'Indirizzo non trovato con precisione. Verranno usate le coordinate approssimative.',
        });
      }
    } catch {
      setGeocodeFeedback({
        status: 'error',
        message: 'Impossibile verificare l’indirizzo al momento.',
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleUseCurrentLocationAsStatic = () => {
    if (user?.location) {
      setStaticCoords({ lat: user.location.lat, lng: user.location.lng });
      setStaticFormattedAddress(user.location.address || 'Punto fissato');
      setGeocodeFeedback({
        status: 'success',
        message: `Fissato sulla tua posizione attuale: ${user.location.address}`,
      });
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Compila titolo e descrizione.');
      return;
    }

    let finalCoords = staticCoords;
    let formattedAddr = staticFormattedAddress;

    if (trackingType === 'static') {
      if (!staticComune.trim()) {
        setError('Specifica almeno il Comune per l’annuncio statico.');
        return;
      }
      if (!finalCoords) {
        try {
          const fullQuery = [staticVia.trim(), staticCivico.trim(), staticComune.trim()].filter(Boolean).join(' ');
          const res = await fetch(`/api/geocode?q=${encodeURIComponent(fullQuery)}`);
          const data = await res.json();
          if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
            finalCoords = { lat: data.lat, lng: data.lng };
            formattedAddr = [staticVia.trim(), staticCivico.trim(), staticComune.trim()].filter(Boolean).join(', ');
          }
        } catch {
          finalCoords = user?.location ? { lat: user.location.lat, lng: user.location.lng } : { lat: 45.4642, lng: 9.1900 };
        }
      }

      if (!finalCoords) {
        finalCoords = user?.location ? { lat: user.location.lat, lng: user.location.lng } : { lat: 45.4642, lng: 9.1900 };
      }
      if (!formattedAddr) {
        formattedAddr = [staticVia.trim(), staticCivico.trim(), staticComune.trim()].filter(Boolean).join(', ') || 'Luogo fisico';
      }
    }

    onSave({
      type,
      title: title.trim(),
      description: description.trim(),
      category,
      creditsRequired: isFree ? 0 : Number(creditsRequired),
      isFree,
      trackingType,
      actionRadiusKm,
      staticLocation: trackingType === 'static' ? {
        comune: staticComune.trim(),
        via: staticVia.trim() || undefined,
        civico: staticCivico.trim() || undefined,
        formattedAddress: formattedAddr,
      } : undefined,
      customCoords: trackingType === 'static' ? (finalCoords || undefined) : undefined,
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
              className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border transition-all cursor-pointer ${
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
              className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border transition-all cursor-pointer ${
                type === 'request'
                  ? 'bg-teal-700 text-white border-teal-700 shadow-md shadow-teal-700/20'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <HelpCircle className="w-4 h-4" />
              <span>Ho Bisogno di Aiuto</span>
            </button>
          </div>

          {/* TWO MODES: Dynamic (Persona) vs Static (Luogo Fisso) */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Modalità di Presenza & Localizzazione
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTrackingType('dynamic');
                  if (actionRadiusKm === 0.3 || actionRadiusKm === 0.5) setActionRadiusKm(5);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  trackingType === 'dynamic'
                    ? 'bg-teal-700 text-white border-teal-700 shadow-md shadow-teal-700/20'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Radio className={`w-4 h-4 ${trackingType === 'dynamic' ? 'text-teal-200 animate-pulse' : 'text-teal-600'}`} />
                  <span className="font-extrabold text-xs">🏃 Dinamico (Segue Te)</span>
                </div>
                <p className={`text-[11px] leading-snug ${trackingType === 'dynamic' ? 'text-teal-100' : 'text-slate-500'}`}>
                  L'annuncio segue i tuoi spostamenti via GPS in tempo reale. Perfetto per chi è in giro o offre disponibilità personale.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTrackingType('static');
                  if (actionRadiusKm === 5 || actionRadiusKm === 10) setActionRadiusKm(1);
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  trackingType === 'static'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center space-x-2 mb-1">
                  <Building2 className={`w-4 h-4 ${trackingType === 'static' ? 'text-amber-100' : 'text-amber-600'}`} />
                  <span className="font-extrabold text-xs">📌 Statico (Luogo Fisso)</span>
                </div>
                <p className={`text-[11px] leading-snug ${trackingType === 'static' ? 'text-amber-100' : 'text-slate-500'}`}>
                  Fissato a un indirizzo (Comune, via o civico). Visibile solo alle persone quando passano fisicamente nel suo raggio di influenza.
                </p>
              </button>
            </div>

            {/* If STATIC: Detailed Address Inputs (Comune, Via, Numero Civico) */}
            {trackingType === 'static' && (
              <div className="mt-3 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    Localizza il Luogo Fisso (senza bisogno di GPS)
                  </span>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocationAsStatic}
                    className="text-[11px] text-amber-800 hover:text-amber-950 underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <LocateFixed className="w-3 h-3" />
                    Usa posizione attuale
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">
                      Comune *
                    </label>
                    <input
                      type="text"
                      value={staticComune}
                      onChange={(e) => {
                        setStaticComune(e.target.value);
                        setStaticCoords(null);
                      }}
                      placeholder="es. Roma, Milano..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-amber-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">
                      Via / Piazza
                    </label>
                    <input
                      type="text"
                      value={staticVia}
                      onChange={(e) => {
                        setStaticVia(e.target.value);
                        setStaticCoords(null);
                      }}
                      placeholder="es. Via Garibaldi"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-amber-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold uppercase text-amber-900 mb-1">
                      N. Civico (opzionale)
                    </label>
                    <div className="flex space-x-1">
                      <input
                        type="text"
                        value={staticCivico}
                        onChange={(e) => {
                          setStaticCivico(e.target.value);
                          setStaticCoords(null);
                        }}
                        placeholder="es. 12"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-amber-300 bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleGeocodeAddress}
                        disabled={isGeocoding || !staticComune.trim()}
                        title="Verifica coordinate indirizzo"
                        className="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-2 rounded-lg text-xs font-bold shrink-0 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isGeocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Geocode result feedback */}
                {geocodeFeedback.message && (
                  <div className={`text-[11px] p-2 rounded-lg flex items-center space-x-1.5 ${
                    geocodeFeedback.status === 'success'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                      : 'bg-red-100 text-red-900 border border-red-200'
                  }`}>
                    {geocodeFeedback.status === 'success' && <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                    <span>{geocodeFeedback.message}</span>
                  </div>
                )}
              </div>
            )}
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

          {/* Influence Radius (Raggio d'Azione o di Influenza) */}
          <div className={`border rounded-2xl p-4 space-y-3 ${
            trackingType === 'dynamic'
              ? 'bg-teal-50/80 border-teal-200'
              : 'bg-amber-50/80 border-amber-200'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className={`flex items-center space-x-1.5 text-xs font-black uppercase tracking-wider ${
                  trackingType === 'dynamic' ? 'text-teal-950' : 'text-amber-950'
                }`}>
                  {trackingType === 'dynamic' ? (
                    <>
                      <Radio className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
                      <span>Raggio di Disponibilità (L'annuncio ti segue in movimento)</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-3.5 h-3.5 text-amber-600" />
                      <span>Raggio di Influenza del Luogo Fisso (Chi passa di lì lo vede)</span>
                    </>
                  )}
                </div>
                <p className={`text-[11px] mt-1 leading-snug ${
                  trackingType === 'dynamic' ? 'text-teal-800' : 'text-amber-900'
                }`}>
                  {trackingType === 'dynamic'
                    ? "L'annuncio viaggia insieme alla tua posizione GPS. Chiunque si trovi dentro questo raggio da te potrà vederlo e interagire."
                    : "L'annuncio resta ancorato a questo luogo fisico. Sarà visibile alle persone solo quando passano fisicamente all'interno del suo raggio d'influenza."}
                </p>
              </div>
              <span className={`shrink-0 font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-xs text-white ${
                trackingType === 'dynamic' ? 'bg-teal-700' : 'bg-amber-600'
              }`}>
                {actionRadiusKm === 0 ? 'Illimitato' : actionRadiusKm < 1 ? `${actionRadiusKm * 1000} metri` : `${actionRadiusKm} km`}
              </span>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
              {(trackingType === 'dynamic' ? [
                { value: 1, label: '1 km', desc: 'A piedi' },
                { value: 3, label: '3 km', desc: 'In bici' },
                { value: 5, label: '5 km', desc: 'Quartiere' },
                { value: 10, label: '10 km', desc: 'In auto' },
                { value: 25, label: '25 km', desc: 'Area metrop.' },
                { value: 0, label: 'Tutto', desc: 'Senza limiti' },
              ] : [
                { value: 0.3, label: '300 m', desc: 'Stesso isolato' },
                { value: 0.5, label: '500 m', desc: 'Quartiere' },
                { value: 1, label: '1 km', desc: 'A piedi' },
                { value: 3, label: '3 km', desc: 'Zona vicina' },
                { value: 5, label: '5 km', desc: 'Area comune' },
                { value: 0, label: 'Tutto', desc: 'Senza limiti' },
              ]).map((preset) => {
                const isSelected = actionRadiusKm === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setActionRadiusKm(preset.value)}
                    className={`px-2 py-2 rounded-xl text-center border transition-all cursor-pointer ${
                      isSelected
                        ? trackingType === 'dynamic'
                          ? 'bg-teal-700 text-white border-teal-700 font-bold shadow-xs'
                          : 'bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <div className="text-xs font-bold leading-none">{preset.label}</div>
                    <div className={`text-[9px] mt-0.5 ${
                      isSelected ? 'text-white/80' : 'text-slate-500'
                    }`}>
                      {preset.desc}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className={`flex items-center justify-between text-[11px] pt-1 ${
              trackingType === 'dynamic' ? 'text-teal-800' : 'text-amber-900'
            }`}>
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-current" />
                <span>
                  {trackingType === 'dynamic' ? (
                    <>Centro in movimento: <strong>{user?.location?.address || 'GPS attuale'}</strong></>
                  ) : (
                    <>Punto fisso ancorato a: <strong>{staticFormattedAddress || staticComune || 'Indirizzo scelto'}</strong></>
                  )}
                </span>
              </span>
            </div>
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
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Pubblica Annuncio ({trackingType === 'dynamic' ? 'In Movimento' : 'Punto Fisso'})</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
