import React, { useState } from 'react';
import { X, MapPin, Sparkles, CheckCircle2, ShieldAlert, Coins, Plus, Trash2, RotateCcw, Loader2, KeyRound, Copy, Check, LogIn, UserCheck, ShieldCheck } from 'lucide-react';
import { UserProfile, DEFAULT_HELP_CATEGORIES } from '../types';
import { resolveAddressGeocode } from '../services/comuniService';
import { db } from '../lib/firebase';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { accreditUser, generateSuggestedPasscode, loginWithCredentials } from '../services/accreditationService';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onSave: (updatedUser: Partial<UserProfile>) => void;
  onResetAllItems?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
  onResetAllItems,
}) => {
  const [tab, setTab] = useState<'profile' | 'login'>('profile');

  // Profile form state
  const [nickname, setNickname] = useState(user?.nickname || 'Vicino' + Math.floor(Math.random() * 900 + 100));
  const [passcode, setPasscode] = useState(user?.passcode || generateSuggestedPasscode(user?.nickname || 'Vicino'));
  const [address, setAddress] = useState(user?.location?.address || 'Somma Lombardo (VA)');
  const [lat, setLat] = useState(user?.location?.lat || 45.6836);
  const [lng, setLng] = useState(user?.location?.lng || 8.7071);
  const [offers, setOffers] = useState<string[]>(user?.offers || ['Spesa e Commissioni a Domicilio', 'Piccoli Lavoretti Domestici']);
  const [customOffer, setCustomOffer] = useState('');

  // Login from another device state
  const [loginNickname, setLoginNickname] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Status & feedback
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');

  if (!isOpen) return null;

  const handleRegenerateCode = () => {
    const newCode = generateSuggestedPasscode(nickname);
    setPasscode(newCode);
    setSuccessInfo(`Nuovo codice generato: ${newCode}`);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(passcode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLat(position.coords.latitude);
          setLng(position.coords.longitude);
          setAddress(`Posizione GPS (${position.coords.latitude.toFixed(3)}, ${position.coords.longitude.toFixed(3)})`);
        },
        () => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessInfo('');

    if (!nickname.trim()) {
      setError('Inserisci un nome o nickname per l\'accreditamento.');
      return;
    }
    if (offers.length === 0) {
      setError('Per partecipare a HELP e poter chiedere aiuto, devi mettere a disposizione almeno un tipo di aiuto ("Solo chi aiuta può essere aiutato").');
      return;
    }

    setIsSaving(true);
    try {
      let finalLat = lat;
      let finalLng = lng;
      if (address.trim() && (!finalLat || address !== user?.location?.address)) {
        try {
          const geo = await resolveAddressGeocode('', address.trim(), '');
          if (geo && typeof geo.lat === 'number' && typeof geo.lng === 'number') {
            finalLat = geo.lat;
            finalLng = geo.lng;
          }
        } catch (err) {}
      }

      // Auto-managed accreditation:
      const result = await accreditUser(nickname.trim(), passcode.trim(), {
        ...user,
        location: { lat: finalLat, lng: finalLng, address },
        offers,
      });

      onSave(result.user);

      if (result.status === 'suffixed') {
        alert(result.message);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Errore durante l\'accreditamento del profilo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeviceLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessInfo('');

    if (!loginNickname.trim() || !loginPasscode.trim()) {
      setError('Inserisci sia il nome che il codice segreto.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await loginWithCredentials(loginNickname.trim(), loginPasscode.trim());
      if (res.success && res.user) {
        onSave(res.user);
        setSuccessInfo(`Bentornato ${res.user.nickname}! Profilo ripristinato con successo.`);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res.error || 'Credenziali non valide.');
      }
    } catch (err: any) {
      setError(err.message || 'Errore durante il recupero del profilo.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleResetDatabase = async () => {
    if (!window.confirm('Sei sicuro di voler azzerare tutti gli annunci dal database? Questa azione eliminerà tutti gli annunci attivi per ricominciare da zero.')) {
      return;
    }
    setIsResetting(true);
    setResetSuccess('');
    try {
      // 1. Reset Firestore items & subcollections
      const snap = await getDocs(collection(db, 'help_items'));
      for (const d of snap.docs) {
        const msgsSnap = await getDocs(collection(db, 'help_items', d.id, 'messages'));
        for (const m of msgsSnap.docs) {
          await deleteDoc(doc(db, 'help_items', d.id, 'messages', m.id));
        }
        await deleteDoc(doc(db, 'help_items', d.id));
      }

      // 2. Reset Server API
      try {
        await fetch('/api/help-items/reset', { method: 'POST' });
      } catch (e) {}

      // 3. Clear local storage
      localStorage.removeItem('help_items_local');
      if (onResetAllItems) {
        onResetAllItems();
      }
      setResetSuccess('Tutti gli annunci e relative chat sono stati azzerati dal database cloud!');
    } catch (err) {
      console.error('Reset error:', err);
      setError('Errore durante l\'azzeramento del database.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>Il Tuo Accreditamento HELP</span>
              <span className="text-[10px] bg-emerald-700/80 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold border border-emerald-400/40">
                Libero & Aperto
              </span>
            </h2>
            <p className="text-xs text-emerald-100 mt-1">Senza email o moduli: solo il tuo nome e un codice segreto</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'profile'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Mio Profilo & Codice</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('login')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'login'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Accedi da Altro Dispositivo</span>
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successInfo && (
          <div className="mx-6 mt-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successInfo}</span>
          </div>
        )}

        {tab === 'profile' ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            
            {/* Explanatory Banner */}
            <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 text-xs text-emerald-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Accreditamento Auto-Gestito (100% Libero):</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Nessuna registrazione complicata: il tuo <strong>Nome</strong> e il <strong>Codice</strong> ti identificano ovunque. Se due utenti scelgono lo stesso nome, il sistema assegna in automatico un suffisso numerico progressivo. Se dimentichi il codice, il profilo si resetta e riparti da zero con un nuovo accreditamento.
              </p>
            </div>

            {/* Nickname */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Nome o Nickname
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 font-bold"
                placeholder="es. Marco, Pasticceria Dolce, Luisa..."
                maxLength={30}
                required
              />
            </div>

            {/* Passcode / Codice 6 cifre o lettere */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                  <span>Codice Segreto / Password Personale</span>
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateCode}
                  className="text-[11px] text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
                >
                  Genera Nuovo
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-white rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  placeholder="Nome + 6 cifre o password a scelta..."
                  required
                />
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  title="Copia negli appunti"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copiato!' : 'Copia'}</span>
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                💡 Conserva questo codice: usalo per accedere allo stesso profilo da cellulare o un altro browser.
              </p>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  La tua Posizione (per trovare aiuti nel raggio locale)
                </label>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1 cursor-pointer"
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
                placeholder="es. Somma Lombardo (VA), Via Roma..."
                required
              />
            </div>

            {/* Credits & Stats summary if user exists */}
            {user && (
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Crediti HELP</div>
                      <div className="text-base font-extrabold text-emerald-900">{user.credits} 🪙</div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-600">
                    <div>Aiuti offerti: <span className="font-bold text-slate-900">{user.helpedCount || 0}</span></div>
                    <div>Reputazione: <span className="font-bold text-slate-900">{user.rating || 5.0} ⭐</span></div>
                  </div>
                </div>
                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1 text-amber-700 font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Karma Solidarietà:</span>
                  </div>
                  <div className="font-black text-amber-800 text-sm">{user.karma || 120} punti 🔥</div>
                </div>
              </div>
            )}

            {/* What you offer (Mandatory rule: Solo chi aiuta può essere aiutato) */}
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Cosa metti a disposizione per la comunità?</h3>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">Regola d'oro</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  "Solo chi si rende disponibile può chiedere aiuto."
                </p>
              </div>

              {/* Selected offers list */}
              <div className="flex flex-wrap gap-1.5">
                {offers.map((offer, index) => (
                  <div
                    key={index}
                    className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-2.5 py-1 rounded-lg text-xs flex items-center space-x-1.5 font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{offer}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveOffer(index)}
                      className="text-emerald-700 hover:text-red-600 transition-colors ml-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Quick add from default categories */}
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Aggiungi dalle categorie pronte:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-36 overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50">
                  {DEFAULT_HELP_CATEGORIES.map((cat) => {
                    const isAdded = offers.includes(cat.title);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        disabled={isAdded}
                        onClick={() => handleAddOffer(cat.title)}
                        className={`text-left p-1.5 rounded-lg text-xs flex items-center justify-between transition-all cursor-pointer ${
                          isAdded
                            ? 'bg-emerald-100/50 text-emerald-800 opacity-60 cursor-not-allowed'
                            : 'bg-white hover:bg-emerald-50 text-slate-800 border border-slate-200/60'
                        }`}
                      >
                        <span className="truncate pr-1 font-medium">{cat.title}</span>
                        <span className="text-[10px] text-emerald-600 font-bold shrink-0">{isAdded ? '✓' : '+ Aggiungi'}</span>
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
                  placeholder="Oppure scrivi un altro aiuto specifico..."
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddOffer(customOffer)}
                  className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-xl text-xs font-medium shrink-0 flex items-center space-x-1 cursor-pointer"
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
                disabled={isSaving}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3 px-4 rounded-xl shadow-md text-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Salva e Accredita Profilo</span>
              </button>
            </div>

            {/* Admin / Reset Section */}
            <div className="pt-3 border-t border-slate-100">
              <div className="p-3 bg-red-50/70 border border-red-200 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    <span>Azzeramento Database Annunci</span>
                  </h4>
                  <p className="text-[11px] text-red-700 mt-0.5">
                    Azzera tutti gli annunci e le chat per ripartire da zero
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetDatabase}
                  disabled={isResetting}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Azzeramento...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Azzera Database</span>
                    </>
                  )}
                </button>
              </div>
              {resetSuccess && (
                <p className="mt-2 text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 p-2 rounded-lg text-center">
                  {resetSuccess}
                </p>
              )}
            </div>

          </form>
        ) : (
          /* Login tab */
          <form onSubmit={handleDeviceLogin} className="p-6 space-y-5">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <LogIn className="w-4 h-4 text-amber-700" />
                <span>Accedi allo stesso account su Smartphone o altro PC</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Inserisci il nome e il codice esatto con cui ti sei accreditato. Il sistema caricherà all'istante i tuoi crediti HELP, il punteggio Karma e le offerte attive.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Nome o Nickname Registrato
              </label>
              <input
                type="text"
                value={loginNickname}
                onChange={(e) => setLoginNickname(e.target.value)}
                placeholder="es. Marco o Marco_1"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Codice Segreto Personale
              </label>
              <input
                type="text"
                value={loginPasscode}
                onChange={(e) => setLoginPasscode(e.target.value)}
                placeholder="es. Marco123456"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 font-mono"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md"
            >
              {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              <span>Carica Profilo & Sincronizza Dispositivo</span>
            </button>

            <div className="text-center pt-2">
              <p className="text-xs text-slate-500">
                Hai dimenticato il codice? Nessun problema: torna a <strong className="text-emerald-700 cursor-pointer" onClick={() => setTab('profile')}>Mio Profilo</strong> e crea liberamente un nuovo accreditamento.
              </p>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
