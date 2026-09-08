import React, { useState } from 'react';
import { X, MapPin, Sparkles, CheckCircle2, ShieldAlert, Coins, Plus, Trash2 } from 'lucide-react';
import { UserProfile, DEFAULT_HELP_CATEGORIES } from '../types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSave: (updatedUser: Partial<UserProfile>) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
}) => {
  const [nickname, setNickname] = useState(user?.nickname || 'VicinoSolidale' + Math.floor(Math.random() * 900 + 100));
  const [address, setAddress] = useState(user?.location?.address || 'Milano, Centro');
  const [lat, setLat] = useState(user?.location?.lat || 45.4642);
  const [lng, setLng] = useState(user?.location?.lng || 9.1900);
  const [offers, setOffers] = useState<string[]>(user?.offers || ['Spesa e Commissioni a Domicilio', 'Piccoli Lavoretti Domestici']);
  const [customOffer, setCustomOffer] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude);
          setLng(position.coords.longitude);
          setAddress(`Posizione GPS (${position.coords.latitude.toFixed(3)}, ${position.coords.longitude.toFixed(3)})`);
        },
        (err) => {
          setError('Impossibile rilevare la posizione GPS. Inserisci la località manualmente.');
        }
      );
    } else {
      setError('Geolocalizzazione non supportata dal browser.');
    }
  };

  const handleAddOffer = (offerText: string) => {
    if (!offerText.trim()) return;
    if (!offers.includes(offerText)) {
      setOffers([...offers, offerText.trim()]);
    }
    setCustomOffer('');
  };

  const handleRemoveOffer = (index: number) => {
    setOffers(offers.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError('Inserisci un nickname valido');
      return;
    }
    if (offers.length === 0) {
      setError('Per fare parte di HELP e poter chiedere aiuto, devi mettere a disposizione almeno un tipo di aiuto per gli altri ("Solo chi aiuta può essere aiutato").');
      return;
    }

    onSave({
      nickname: nickname.trim(),
      location: { lat, lng, address },
      offers,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Il Tuo Profilo HELP</h2>
            <p className="text-xs text-emerald-100 mt-1">Senza registrazioni complesse, entra ed aiuta la tua comunità</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Nickname */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Il tuo Nickname (puoi cambiarlo quando vuoi)
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
              placeholder="es. MarcoSolidale o VicinoDiCasa"
              maxLength={30}
              required
            />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                La tua Posizione (per trovare e offrire aiuti vicini)
              </label>
              <button
                type="button"
                onClick={handleDetectLocation}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Rileva GPS</span>
              </button>
            </div>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm"
              placeholder="es. Via Roma 10, Città"
              required
            />
          </div>

          {/* Credits & Stats summary if user exists */}
          {user && (
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Crediti HELP accumulati</div>
                    <div className="text-lg font-extrabold text-emerald-900">{user.credits} 🪙</div>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <div>Aiuti offerti: <span className="font-bold text-slate-900">{user.helpedCount || 0}</span></div>
                  <div>Reputazione: <span className="font-bold text-slate-900">{user.rating || 5.0} ⭐</span></div>
                </div>
              </div>
              <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5 text-amber-700 font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>Punteggio Karma Solidarietà:</span>
                </div>
                <div className="font-black text-amber-800 text-sm">{user.karma || 120} punti 🔥</div>
              </div>
            </div>
          )}

          {/* What you offer (Mandatory rule: Solo chi aiuta può essere aiutato) */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">Cosa metti a disposizione per gli altri?</h3>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Regola d'oro</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                "Solo chi si mette a disposizione per gli altri può essere aiutato." Scegli tra i default o aggiungi il tuo aiuto.
              </p>
            </div>

            {/* Selected offers list */}
            <div className="flex flex-wrap gap-2">
              {offers.map((offer, index) => (
                <div
                  key={index}
                  className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-3 py-1.5 rounded-xl text-xs flex items-center space-x-2 font-medium"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{offer}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveOffer(index)}
                    className="text-emerald-700 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Quick add from default categories */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">Aggiungi dai 10 aiuti standard:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50">
                {DEFAULT_HELP_CATEGORIES.map((cat) => {
                  const isAdded = offers.includes(cat.title);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      disabled={isAdded}
                      onClick={() => handleAddOffer(cat.title)}
                      className={`text-left p-2 rounded-lg text-xs flex items-center justify-between transition-all ${
                        isAdded
                          ? 'bg-emerald-100/50 text-emerald-800 opacity-60 cursor-not-allowed'
                          : 'bg-white hover:bg-emerald-50 text-slate-800 border border-slate-200/60'
                      }`}
                    >
                      <span className="truncate pr-2 font-medium">{cat.title}</span>
                      <span className="text-[10px] text-emerald-600 font-bold shrink-0">{isAdded ? 'Inserito' : '+ Aggiungi'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom offer input */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={customOffer}
                onChange={(e) => setCustomOffer(e.target.value)}
                placeholder="Oppure scrivi un altro aiuto personalizzato..."
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => handleAddOffer(customOffer)}
                className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-medium shrink-0 flex items-center space-x-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Aggiungi</span>
              </button>
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-600/20 text-sm transition-all"
            >
              Salva e Entra in HELP
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
