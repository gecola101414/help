import React, { useState } from 'react';
import { HelpItem, UserProfile, DEFAULT_HELP_CATEGORIES } from '../types';
import { Search, MapPin, Coins, HeartHandshake, HelpCircle, Filter, Compass, Plus, Sparkles, CheckCircle2, Radio, Info } from 'lucide-react';

interface HelpFeedProps {
  items: HelpItem[];
  user: UserProfile | null;
  distanceRadius: number;
  setDistanceRadius?: (radius: number) => void;
  onSelectItem: (item: HelpItem) => void;
  onOpenCreate: () => void;
  onOpenProfile: () => void;
}

export const HelpFeed: React.FC<HelpFeedProps> = ({
  items,
  user,
  distanceRadius,
  setDistanceRadius,
  onSelectItem,
  onOpenCreate,
  onOpenProfile,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'offer' | 'request' | 'free'>('all');
  const [filterTracking, setFilterTracking] = useState<'all' | 'dynamic' | 'static'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Novità: vedi solo le cose dove ti trovi (l'annuncio segue l'autore e copre la tua posizione)
  const [onlyInActionRadius, setOnlyInActionRadius] = useState<boolean>(true);

  // Filter items based on type, tracking mode, category, distance, creator's dynamic radius, and search query
  const filteredItems = items.filter((item) => {
    // Type filter
    if (filterType === 'offer' && item.type !== 'offer') return false;
    if (filterType === 'request' && item.type !== 'request') return false;
    if (filterType === 'free' && !item.isFree) return false;

    // Tracking type filter (Dynamic vs Static)
    if (filterTracking === 'dynamic' && item.trackingType === 'static') return false;
    if (filterTracking === 'static' && item.trackingType !== 'static') return false;

    // Category filter
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

    // Novità fondamentale: Raggio di influenza (100m fissi dinamici per interazione umana, 0-10km per statici)
    if (onlyInActionRadius) {
      const isStatic = item.trackingType === 'static';
      const effectiveRadius = isStatic
        ? Math.min(10, Math.max(0.1, item.actionRadiusKm || 1))
        : 0.1; // 100 metri fissa per annunci dinamici
      const isCovered = item.distanceKm !== undefined && item.distanceKm <= effectiveRadius;
      if (!isCovered) return false;
    }

    // Secondary client distance filter (if set)
    if (distanceRadius > 0 && item.distanceKm !== undefined && item.distanceKm > distanceRadius) return false;

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

  const itemsOutsideActionRadius = items.filter((item) => {
    const isStatic = item.trackingType === 'static';
    const effectiveRadius = isStatic
      ? Math.min(10, Math.max(0.1, item.actionRadiusKm || 1))
      : 0.1;
    return item.distanceKm !== undefined && item.distanceKm > effectiveRadius;
  }).length;

  const itemsExcludedByDistance = items.filter(
    (item) => distanceRadius > 0 && item.distanceKm !== undefined && item.distanceKm > distanceRadius
  ).length;

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

          {/* Type Filters & Distance Selector */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Dynamic Proximity Toggle */}
            <button
              type="button"
              onClick={() => setOnlyInActionRadius(!onlyInActionRadius)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                onlyInActionRadius
                  ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
              title="Vedi solo gli annunci che coprono la tua posizione attuale (100 metri per quelli dinamici, max 10 km per quelli statici)"
            >
              <Radio className={`w-3.5 h-3.5 ${onlyInActionRadius ? 'text-teal-200 animate-pulse' : 'text-slate-400'}`} />
              <span>{onlyInActionRadius ? '🎯 Solo nel raggio di vicinanza' : '🌐 Mostra tutti gli annunci'}</span>
            </button>

            {/* Distance Selector */}
            {setDistanceRadius && (
              <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-700">
                <Compass className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="font-semibold text-slate-500">Raggio max:</span>
                <select
                  value={distanceRadius}
                  onChange={(e) => setDistanceRadius(Number(e.target.value))}
                  className="bg-transparent font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                >
                  <option value={0}>Tutta Italia (Senza Limiti)</option>
                  <option value={500}>500 km</option>
                  <option value={100}>100 km</option>
                  <option value={50}>50 km</option>
                  <option value={25}>25 km</option>
                  <option value={10}>10 km</option>
                  <option value={5}>5 km</option>
                </select>
              </div>
            )}

            <div className="flex items-center space-x-1.5 overflow-x-auto">
              {/* Tracking Mode Quick Filter */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterTracking('all')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterTracking === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tutti
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTracking('dynamic')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    filterTracking === 'dynamic' ? 'bg-teal-700 text-white shadow-xs' : 'text-slate-600 hover:text-teal-800'
                  }`}
                  title="Annunci che seguono la persona via GPS"
                >
                  <Radio className="w-3 h-3 text-current animate-pulse" />
                  <span>In Movimento</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTracking('static')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                    filterTracking === 'static' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-amber-800'
                  }`}
                  title="Annunci ancorati a un luogo fisso"
                >
                  <span>📌 Punti Fissi</span>
                </button>
              </div>

              <span className="text-slate-300">|</span>

              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  filterType === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tutti i Tipi
              </button>
              <button
                onClick={() => setFilterType('offer')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  filterType === 'offer' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                Offerte
              </button>
              <button
                onClick={() => setFilterType('request')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  filterType === 'request' ? 'bg-teal-700 text-white shadow-xs' : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
                }`}
              >
                Richieste
              </button>
              <button
                onClick={() => setFilterType('free')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  filterType === 'free' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                Gratis
              </button>
            </div>
          </div>

        </div>

        {/* Informative Banner about the Dynamic Persona-Centric model */}
        {onlyInActionRadius && itemsOutsideActionRadius > 0 && (
          <div className="bg-teal-50/90 border border-teal-200/80 rounded-xl p-3 text-xs text-teal-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Radio className="w-4 h-4 text-teal-600 shrink-0 animate-pulse" />
              <span>
                <strong>{filteredItems.length} annunci attivi</strong> coprono la tua posizione in tempo reale. Ci sono altri <strong>{itemsOutsideActionRadius} annunci</strong> il cui autore ha definito un raggio diverso da dove ti trovi.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOnlyInActionRadius(false)}
              className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all self-start sm:self-auto cursor-pointer"
            >
              Mostra anche quelli fuori raggio
            </button>
          </div>
        )}

        {/* Banner if items are excluded by distance */}
        {itemsExcludedByDistance > 0 && (
          <div className="bg-amber-50/90 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Ci sono <strong>{itemsExcludedByDistance} annunci</strong> pubblicati oltre il raggio di {distanceRadius} km (es. altre città o regioni).
              </span>
            </div>
            {setDistanceRadius && (
              <button
                type="button"
                onClick={() => setDistanceRadius(0)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all self-start sm:self-auto cursor-pointer"
              >
                Mostra Tutti gli Annunci (Tutta Italia)
              </button>
            )}
          </div>
        )}

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
          <h3 className="text-lg font-bold text-slate-900">
            {distanceRadius > 0
              ? `Nessun annuncio trovato nel raggio di ${distanceRadius} km`
              : 'Nessun annuncio trovato con i filtri selezionati'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            {distanceRadius > 0 && items.length > 0
              ? `Ci sono ${items.length} annunci disponibili allargando il raggio a tutta Italia!`
              : 'Pubblica tu stesso il primo aiuto o richiesta di solidarietà nella tua zona!'}
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-2">
            {distanceRadius > 0 && items.length > 0 && setDistanceRadius && (
              <button
                onClick={() => setDistanceRadius(0)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer"
              >
                Vedi Tutti gli Annunci ({items.length})
              </button>
            )}
            <button
              onClick={onOpenCreate}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
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
                    <span className="text-xs text-slate-500 font-bold">
                      {item.distanceKm !== undefined
                        ? item.distanceKm < 0.1
                          ? `${Math.round(item.distanceKm * 1000)} m da te (Entro 100m!)`
                          : item.distanceKm < 1
                          ? `${Math.round(item.distanceKm * 1000)} m da te`
                          : `${item.distanceKm.toFixed(1)} km da te`
                        : 'Vicinanze'}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-emerald-700 font-bold block">{item.category}</span>
                      <span className="text-[10px] text-slate-400 font-medium">da {item.userNickname}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Tracking Type & Action Radius Badge (Statico 0-10km vs Dinamico 100m fisso) */}
                  <div className="pt-1">
                    {item.trackingType === 'static' ? (
                      (() => {
                        const staticRadius = Math.min(10, Math.max(0.1, item.actionRadiusKm || 1));
                        const isCovered = item.distanceKm !== undefined && item.distanceKm <= staticRadius;
                        return (
                          <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${
                            isCovered
                              ? 'bg-amber-100 text-amber-950 border-amber-300 font-bold'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}>
                            <span className="shrink-0 text-amber-700 font-bold">📌</span>
                            <span>
                              Punto Fisso: <strong>{item.staticLocation?.comune || 'Luogo fisso'}</strong>
                              {` • Influenza: ${staticRadius < 1 ? Math.round(staticRadius * 1000) + ' m' : staticRadius + ' km'}`}
                              {isCovered ? ' (🎯 Sei nel raggio!)' : ''}
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      (() => {
                        const isCovered = item.distanceKm !== undefined && item.distanceKm <= 0.1;
                        return (
                          <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${
                            isCovered
                              ? 'bg-teal-100 text-teal-950 border-teal-300 font-bold'
                              : 'bg-teal-50/60 text-teal-800 border-teal-200'
                          }`}>
                            <Radio className="w-2.5 h-2.5 text-teal-600 shrink-0 animate-pulse" />
                            <span>
                              In movimento: <strong>100m fissi</strong> (segue {item.userNickname})
                              {isCovered ? ' (🎯 Entro 100m - Vicino ora!)' : ''}
                            </span>
                          </div>
                        );
                      })()
                    )}
                  </div>

                </div>

                {/* Footer details */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="truncate max-w-[140px]">{item.location?.address || 'Posizione indicata'}</span>
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
