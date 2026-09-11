import React, { useState, useEffect } from 'react';
import { X, MapPin, Coins, User, Send, CheckCircle, Clock, HeartHandshake, MessageSquare, Trash2, ShieldCheck, Lock, Mic, MicOff, Radio, Volume2 } from 'lucide-react';
import { HelpItem, UserProfile, ChatMessage } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, doc, deleteDoc, getDocs } from 'firebase/firestore';

interface HelpDetailModalProps {
  item: HelpItem | null;
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onUpdateItemStatus: (itemId: string, newStatus: HelpItem['status'], helperId?: string, helperNickname?: string) => void;
  onDeleteItem?: (itemId: string) => void;
  followedUserId?: string | null;
  setFollowedUserId?: (id: string | null) => void;
}

const getCategorySymbol = (catName: string) => {
  const c = (catName || '').toLowerCase();
  if (c.includes('spesa') || c.includes('commissioni')) return '🛒';
  if (c.includes('domestici') || c.includes('lavoretti')) return '🔧';
  if (c.includes('compagnia') || c.includes('assistenza')) return '☕';
  if (c.includes('digital') || c.includes('informatico')) return '💻';
  if (c.includes('riparazione') || c.includes('bici')) return '🚲';
  if (c.includes('ripetizioni') || c.includes('studio')) return '📚';
  if (c.includes('burocrazia') || c.includes('pratiche')) return '📄';
  if (c.includes('trasporto') || c.includes('passaggio')) return '🚗';
  if (c.includes('animali') || c.includes('pet')) return '🐾';
  if (c.includes('utensili') || c.includes('attrezzi')) return '🔨';
  return '💡';
};

export const HelpDetailModal: React.FC<HelpDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  user,
  onUpdateItemStatus,
  onDeleteItem,
  followedUserId,
  setFollowedUserId,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(false);

  // Piazza Audio Room state
  const [isPiazzaOpen, setIsPiazzaOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [piazzaMuted, setPiazzaMuted] = useState(true);

  useEffect(() => {
    // 0. RESET MESSAGES: ogni annuncio ha la sua chat dedicata ed esclusiva
    setMessages([]);
    setIsPiazzaOpen(false);

    if (!isOpen || !item) return;

    // 1. Fetch from server API
    const fetchServerMessages = async () => {
      try {
        const res = await fetch(`/api/help-items/${item.id}/messages`);
        if (res.ok) {
          const sMsgs = await res.json();
          if (Array.isArray(sMsgs)) {
            setMessages((prev) => {
              const map = new Map<string, ChatMessage>();
              prev.forEach((m) => map.set(m.id, m));
              sMsgs.forEach((m: ChatMessage) => map.set(m.id, m));
              const combined = Array.from(map.values());
              combined.sort((a, b) => a.createdAt - b.createdAt);
              return combined;
            });
          }
        }
      } catch (err) {}
    };

    fetchServerMessages();

    // 2. Listen to dedicated Firestore subcollection for this specific announcement
    let unsubscribe: (() => void) | undefined;
    try {
      const messagesRef = collection(db, 'help_items', item.id, 'messages');
      unsubscribe = onSnapshot(
        messagesRef,
        (snapshot) => {
          const msgs: ChatMessage[] = [];
          snapshot.forEach((docSnap) => {
            msgs.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
          });
          msgs.sort((a, b) => a.createdAt - b.createdAt);
          setMessages(msgs);
        },
        (err) => {
          console.warn('[Firestore] subcollection chat listener warning:', err);
        }
      );
    } catch (err) {}

    return () => {
      if (unsubscribe) unsubscribe();
      setMessages([]);
    };
  }, [isOpen, item?.id]);

  if (!isOpen || !item) return null;

  const isOffer = item.type === 'offer';
  const isOwner = user?.id === item.userId;
  const isHelper = user?.id === item.helperId;
  const isStatic = item.trackingType === 'static';
  const effectiveRadius = isStatic
    ? Math.min(10, Math.max(0.1, item.actionRadiusKm || 1))
    : 0.1; // 100 meters for dynamic

  const isWithinRadius = item.distanceKm !== undefined && item.distanceKm <= effectiveRadius;
  const isClosed = item.status === 'completed' || item.status === 'cancelled';

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || isClosed || !isWithinRadius) return;

    const msgPayload = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      helpItemId: item.id,
      senderId: user.id,
      senderNickname: user.nickname,
      text: inputText.trim(),
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, msgPayload]);
    setInputText('');
    setLoadingMsg(true);

    try {
      await fetch(`/api/help-items/${item.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgPayload),
      });
    } catch (err) {}

    try {
      const sanitizedPayload = JSON.parse(JSON.stringify(msgPayload));
      await addDoc(collection(db, 'help_items', item.id, 'messages'), sanitizedPayload);
    } catch (err) {
      console.error('Error sending Firestore message:', err);
    } finally {
      setLoadingMsg(false);
    }
  };

  const handleTakeAction = () => {
    if (!user) return;
    onUpdateItemStatus(item.id, 'in_progress', user.id, user.nickname);
  };

  const handleComplete = () => {
    onUpdateItemStatus(item.id, 'completed');
  };

  const handleDeleteOrClose = () => {
    if (window.confirm('Vuoi chiudere definitivamente questo annuncio? Tutti i messaggi di questa chat dedicata verranno eliminati per sempre.')) {
      if (onDeleteItem) {
        onDeleteItem(item.id);
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
        
        {/* Header - Subtle color coding: Red/Rose for offer, Blue for request */}
        <div className={`p-6 text-white flex items-center justify-between shrink-0 ${
          isOffer ? 'bg-gradient-to-r from-rose-600 to-red-600' : 'bg-gradient-to-r from-blue-600 to-indigo-600'
        }`}>
          <div>
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full ${
                isOffer ? 'bg-rose-100 text-rose-900' : 'bg-blue-100 text-blue-900'
              }`}>
                {getCategorySymbol(item.category)} {isOffer ? 'Disponibilità' : 'Richiesta'}
              </span>
              <span className="text-xs opacity-90">{item.category}</span>
            </div>
            <h2 className="text-lg font-bold mt-1">{item.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Description & Details */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{item.description}</p>
            
            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-200/60 text-xs text-slate-500 gap-2">
              <div className="flex items-center space-x-1.5">
                <User className={`w-3.5 h-3.5 ${isOffer ? 'text-rose-600' : 'text-blue-600'}`} />
                <span>Pubblicato da: <strong className="text-slate-800">{item.userNickname}</strong></span>
              </div>
              
              {!isOwner && setFollowedUserId && (
                <button
                  onClick={() => setFollowedUserId(followedUserId === item.userId ? null : item.userId)}
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                    followedUserId === item.userId
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {followedUserId === item.userId ? 'Non seguire più' : 'Segui Annunci'}
                </button>
              )}

              <div className="flex items-center space-x-1.5 mt-2 w-full sm:w-auto sm:mt-0">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                <span>{item.location.address} {item.distanceKm !== undefined ? `(${item.distanceKm} km)` : ''}</span>
              </div>
              <div className="flex items-center space-x-1 text-amber-600 font-bold">
                <Coins className="w-3.5 h-3.5" />
                <span>{item.isFree ? 'Gratuito (Solidarietà)' : `${item.creditsRequired} Crediti HELP`}</span>
              </div>
            </div>
          </div>

          {/* Status & Actions Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-700">Stato Annuncio</div>
              <div className="text-sm font-extrabold text-slate-900 capitalize flex items-center space-x-1.5 mt-0.5">
                {item.status === 'active' && <Clock className="w-4 h-4 text-amber-500" />}
                {item.status === 'in_progress' && <HeartHandshake className="w-4 h-4 text-emerald-600 animate-pulse" />}
                {item.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                <span>
                  {item.status === 'active' && 'Attivo / In attesa'}
                  {item.status === 'in_progress' && `In corso con ${item.helperNickname || 'un vicino'}`}
                  {item.status === 'completed' && 'Completato con successo 🎉'}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {item.status === 'active' && !isOwner && (
                isWithinRadius ? (
                  <button
                    onClick={handleTakeAction}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <HeartHandshake className="w-4 h-4" />
                    <span>{item.type === 'request' ? 'Voglio Aiutare io!' : 'Accetta questo Aiuto'}</span>
                  </button>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl text-[11px] font-bold flex items-center space-x-1.5">
                    <span>🔒</span>
                    <span>Fuori dal raggio ({effectiveRadius < 1 ? Math.round(effectiveRadius * 1000) + 'm' : effectiveRadius + 'km'})</span>
                  </div>
                )
              )}

              {item.status === 'in_progress' && (isOwner || isHelper) && (
                <button
                  onClick={() => {
                    if (!isWithinRadius) {
                      alert("🔒 Presenza richiesta: devi trovarti nell'area di influenza per concludere la gentilezza sul posto.");
                      return;
                    }
                    handleComplete();
                  }}
                  disabled={!isWithinRadius}
                  className={`font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center space-x-1.5 ${
                    !isWithinRadius
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed opacity-60'
                      : 'bg-teal-700 hover:bg-teal-800 text-white cursor-pointer'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Segna come Concluso</span>
                </button>
              )}

              {isOwner && (
                <button
                  onClick={handleDeleteOrClose}
                  className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
                  title="Chiude l'annuncio ed elimina definitivamente tutti i messaggi"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>Chiudi Annuncio</span>
                </button>
              )}
            </div>
          </div>

          {/* PRESENCE WARNING BANNER (When user is outside radius) */}
          {!isClosed && !isWithinRadius && (
            <div className="bg-amber-50 border-2 border-amber-300/80 rounded-2xl p-4 text-xs text-amber-950 space-y-2 shadow-xs">
              <div className="flex items-center justify-between font-black text-amber-950">
                <span className="flex items-center gap-1.5 text-sm">
                  <span>📍</span> Presenza Fisica Richiesta per Interagire
                </span>
                <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Tutti i Cittadini
                </span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                Puoi consultare le informazioni della gentilezza, ma <strong>non puoi scrivere messaggi, né attivare la funzione Pizza (Audio Live)</strong> se non ti trovi nell'area di influenza ({effectiveRadius < 1 ? Math.round(effectiveRadius * 1000) + ' metri' : effectiveRadius + ' km'}).
              </p>
              <div className="text-[11px] font-bold text-amber-800 border-t border-amber-200/80 pt-1.5 flex items-center gap-1">
                <span>✨</span> Solo la presenza sul posto attiva la possibilità di interagire (vale anche per chi ha creato la gentilezza).
              </div>
            </div>
          )}

          {/* Chat & Piazza Section */}
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col h-72 bg-slate-50">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>Chat Dedicata</span>
              </div>
              
              {/* PIAZZA LIVE AUDIO / FUNZIONE PIZZA BUTTON */}
              <button
                onClick={() => {
                  if (!isWithinRadius) {
                    alert("🔒 Funzione Pizza / Piazza disattivata: devi trovarti nell'area di influenza per attivare ed entrare nella stanza audio live. Solo la presenza fisica sul posto sblocca l'interazione (valido per tutti, anche per l'autore).");
                    return;
                  }
                  setIsPiazzaOpen(true);
                }}
                disabled={!isWithinRadius}
                className={`font-bold px-3 py-1.5 rounded-lg text-xs shadow-xs transition-all flex items-center space-x-1.5 ${
                  !isWithinRadius
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed opacity-60 border border-slate-300'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer animate-pulse'
                }`}
                title={
                  !isWithinRadius
                    ? "Presenza fisica sul posto richiesta per attivare la Funzione Pizza / Piazza Live"
                    : "Entra nella Funzione Pizza / Piazza: stanza audio live"
                }
              >
                <Radio className="w-3.5 h-3.5 text-indigo-200" />
                <span>
                  {isWithinRadius ? '🏛️ Funzione Pizza (Audio Live)' : '🔒 Pizza Audio (Presenza Richiesta)'}
                </span>
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {isClosed ? (
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 text-center flex flex-col items-center justify-center py-6">
                  <Lock className="w-6 h-6 text-slate-400 mb-1" />
                  <div className="font-bold text-slate-800">Questo annuncio è stato chiuso</div>
                </div>
              ) : !isWithinRadius ? (
                <div className="bg-amber-100/70 border border-amber-300 rounded-xl p-3 text-xs text-amber-950 flex items-start space-x-2.5">
                  <span className="text-base shrink-0">📍</span>
                  <div className="space-y-0.5">
                    <div className="font-bold">Chat e Funzione Pizza bloccate per assenza sul posto:</div>
                    <div className="text-[11px] opacity-90 leading-relaxed">
                      Per inviare messaggi o parlare in live audio devi trovarti nel raggio d'azione ({effectiveRadius < 1 ? Math.round(effectiveRadius * 1000) + ' metri' : effectiveRadius + ' km'}). Avvicinati per sbloccare l'interazione!
                    </div>
                  </div>
                </div>
              ) : null}

              {!isClosed && messages.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-6">
                  Nessun messaggio. Scrivi qui sotto o attiva la funzione Pizza per parlare a voce!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="text-[10px] text-slate-500 mb-0.5 px-1">{msg.senderNickname}</div>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs shadow-xs ${
                        isMe ? 'bg-emerald-600 text-white rounded-br-xs' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex space-x-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isClosed || !isWithinRadius}
                placeholder={isClosed ? 'Annuncio chiuso' : !isWithinRadius ? '🔒 Fuori area - Presenza sul posto richiesta' : 'Scrivi un messaggio...'}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isClosed || !isWithinRadius || !inputText.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Invia</span>
              </button>
            </form>
          </div>
        </div>

        {/* PIAZZA LIVE AUDIO ROOM OVERLAY / MODAL */}
        {isPiazzaOpen && (
          <div className="absolute inset-0 z-50 bg-slate-900/90 backdrop-blur-md p-6 flex flex-col justify-between text-white animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg animate-pulse">
                  <Radio className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-base">🏛️ La Piazza (Audio Live)</h3>
                  <p className="text-xs text-indigo-300">Stanza vocale condivisa per "{item.title}"</p>
                </div>
              </div>
              <button
                onClick={() => setIsPiazzaOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 py-6 flex flex-col items-center justify-center space-y-6">
              <div className="relative flex items-center justify-center">
                <div className={`absolute w-32 h-32 rounded-full bg-indigo-500/20 animate-ping ${isSpeaking && !piazzaMuted ? 'opacity-100' : 'opacity-0'}`}></div>
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-indigo-600 to-teal-500 flex items-center justify-center shadow-2xl border-4 border-slate-800 text-3xl">
                  🎙️
                </div>
              </div>

              <div className="text-center space-y-1">
                <div className="font-bold text-sm">
                  {piazzaMuted ? 'Microfono disattivato (Sei in ascolto)' : 'Microfono attivo (Tutti ti sentono)'}
                </div>
                <p className="text-xs text-slate-400">
                  Stile Piazza: chiunque può attivare il microfono e parlare liberamente con i presenti.
                </p>
              </div>

              {/* Participants list */}
              <div className="w-full max-w-sm bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-2">
                <div className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Partecipanti in Piazza (2)</div>
                <div className="flex items-center justify-between bg-slate-900/60 px-3 py-2 rounded-xl text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-bold">{item.userNickname} (Autore)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">In ascolto</span>
                </div>
                {user && (
                  <div className="flex items-center justify-between bg-slate-900/60 px-3 py-2 rounded-xl text-xs">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${piazzaMuted ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                      <span className="font-bold">{user.nickname} (Tu)</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${piazzaMuted ? 'text-amber-300 bg-amber-950/60' : 'text-emerald-300 bg-emerald-950/60'}`}>
                      {piazzaMuted ? 'Silenziato' : 'Parlando 🎙️'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4 flex items-center justify-center gap-4">
              <button
                onClick={() => setPiazzaMuted(!piazzaMuted)}
                className={`flex items-center space-x-2 px-5 py-3 rounded-2xl font-bold text-xs transition-all shadow-lg cursor-pointer ${
                  piazzaMuted
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {piazzaMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 animate-bounce" />}
                <span>{piazzaMuted ? 'Attiva Microfono (Parla)' : 'Muta Microfono'}</span>
              </button>

              <button
                onClick={() => setIsPiazzaOpen(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-2xl font-bold text-xs transition-all shadow-lg cursor-pointer flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>Esci dalla Piazza</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
