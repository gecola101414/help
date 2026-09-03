import React, { useState } from 'react';
import { HelpItem, UserProfile, DEFAULT_HELP_CATEGORIES } from '../types';
import { Search, MapPin, Coins, HeartHandshake, HelpCircle, Filter, Compass, Plus, Sparkles, CheckCircle2 } from 'lucide-react';

interface HelpFeedProps {
  items: HelpItem[];
  user: UserProfile | null;
  distanceRadius: number;
  onSelectItem: (item: HelpItem) => void;
  onOpenCreate: () => void;
  onOpenProfile: () => void;
}

export const HelpFeed: React.FC<HelpFeedProps> = ({
  items,
  user,
  distanceRadius,
  onSelectItem,
  onOpenCreate,
  onOpenProfile,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'offer' | 'request' | 'free'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter items based on type, category, distance, and search query
  const filteredItems = items.filter((item) => {
    // Type filter
    if (filterType === 'offer' && item.type !== 'offer') return false;
    if (filterType === 'request' && item.type !== 'request') return false;
    if (filterType === 'free' && !item.isFree) return false;

    // Category filter
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

    // Distance filter
    if (item.distanceKm !== undefined && item.distanceKm > distanceRadius) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchCat = item.category.toLowerCase().includes(q);
      const matchNick = item.userNickname.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat && !matchNick) return false;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Hero Welcome Card */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-700 rounded-3xl p-6 sm:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="max-w-2xl space-y-4 relative z-10">
          <div className="inline-flex items-center space-x-2 bg-teal-800/60 border border-teal-500/40 px-3 py-1 rounded-full text-xs font-semibold">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Piattaforma di Vicinato e Convivenza Civile</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight font-sans">
            Aiutarsi è semplice, senza impegni né registrazioni.
          </h1>
          <p className="text-teal-100 text-sm sm:text-base leading-relaxed">
            Condividi la tua posizione, metti a disposizione un aiuto o cerca ciò di cui hai bisogno nel raggio che preferisci. <br />
            <strong className="text-white">Regola d'oro:</strong> Solo chi aiuta può essere aiutato.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={onOpenCreate}
              className="bg-white text-teal-800 hover:bg-teal-50 font-bold px-6 py-3 rounded-xl shadow-lg transition-all text-sm flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Pubblica un Aiuto</span>
            </button>
            <button
              onClick={onOpenProfile}
              className="bg-teal-900/50 hover:bg-teal-900 text-white border border-teal-500/40 font-semibold px-6 py-3 rounded-xl transition-all text-sm"
            >
              Il Mio Profilo ({user?.nickname || 'Ospite'})
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca per titolo, categoria, vicinato o utente..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm"
            />
          </div>

          {/* Type Filters */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 lg:pb-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterType === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tutti ({items.length})
            </button>
            <button
              onClick={() => setFilterType('offer')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterType === 'offer' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Offerte di Aiuto
            </button>
            <button
              onClick={() => setFilterType('request')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterType === 'request' ? 'bg-teal-700 text-white shadow-xs' : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
              }`}
            >
              Richieste
            </button>
            <button
              onClick={() => setFilterType('free')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                filterType === 'free' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              Gratuiti
            </button>
          </div>

        </div>

        {/* Categories horizontal scroll */}
        <div className="flex items-center space-x-2 overflow-x-auto pt-2 border-t border-slate-100 pb-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === 'all' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tutte le Categorie
          </button>
          {DEFAULT_HELP_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.title)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat.title ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.title}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Help Items */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm space-y-4">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
            🔍
          </div>
          <h3 className="text-lg font-bold text-slate-900">Nessun aiuto trovato nel raggio di {distanceRadius} km</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Prova ad ampliare il raggio di ricerca in alto nella barra di navigazione oppure pubblica tu stesso il primo aiuto nella zona!
          </p>
          <div className="pt-2">
            <button
              onClick={onOpenCreate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all"
            >
              Pubblica un Aiuto Ora
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const isOffer = item.type === 'offer';
            return (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-200 p-6 flex flex-col justify-between cursor-pointer group hover:-translate-y-1"
              >
                <div className="space-y-3">
                  
                  {/* Top tags */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full flex items-center space-x-1 ${
                      isOffer ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {isOffer ? <HeartHandshake className="w-3 h-3 mr-1" /> : <HelpCircle className="w-3 h-3 mr-1" />}
                      <span>{isOffer ? 'Offre Aiuto' : 'Cerca Aiuto'}</span>
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {item.distanceKm !== undefined ? `${item.distanceKm} km da te` : 'Vicinanze'}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <span className="text-[11px] text-emerald-700 font-bold block mb-1">{item.category}</span>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                </div>

                {/* Footer details */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="truncate max-w-[120px]">{item.location.address}</span>
                  </div>
                  <div className="flex items-center space-x-1 font-bold text-amber-600">
                    <Coins className="w-3.5 h-3.5" />
                    <span>{item.isFree ? 'Gratis' : `${item.creditsRequired} Crediti`}</span>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
