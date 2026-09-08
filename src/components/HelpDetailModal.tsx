import React, { useState, useEffect } from 'react';
import { X, MapPin, Coins, User, Send, CheckCircle, Clock, HeartHandshake, MessageSquare, Trash2, ShieldCheck, Lock } from 'lucide-react';
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

  useEffect(() => {
    // 0. RESET MESSAGES: ogni annuncio ha la sua chat dedicata ed esclusiva
    setMessages([]);

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

  const isOwner = user?.id === item.userId;
  const isHelper = user?.id === item.helperId;
  const isStatic = item.trackingType === 'static';
  const effectiveRadius = isStatic
    ? Math.min(10, Math.max(0.1, item.actionRadiusKm || 1))
    : 0.1; // 100 meters for dynamic

  const isWithinRadius = isOwner || (item.distanceKm !== undefined && item.distanceKm <= effectiveRadius);
  const isClosed = item.status === 'completed' || item.status === 'cancelled';

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || isClosed) return;

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

    // 1. Post to server API
    try {
      await fetch(`/api/help-items/${item.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgPayload),
      });
    } catch (err) {}

    // 2. Post to dedicated Firestore subcollection
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
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                item.type === 'offer' ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
              }`}>
                {item.type === 'offer' ? 'Offerta di Aiuto' : 'Richiesta di Aiuto'}
              </span>
              <span className="text-xs text-emerald-100">{item.category}</span>
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
                <User className="w-3.5 h-3.5 text-emerald-600" />
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
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>{item.location.address} {item.distanceKm !== undefined ? `(${item.distanceKm} km)` : ''}</span>
              </div>
              <div className="flex items-center space-x-1 text-amber-600 font-bold">
                <Coins className="w-3.5 h-3.5" />
                <span>{item.isFree ? 'Gratuito (Solidarietà)' : `${item.creditsRequired} Crediti HELP`}</span>
              </div>
            </div>
          </div>

          {/* Announcement Spatial Presence Banner */}
          {item.trackingType === 'static' ? (
            <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 flex items-start space-x-3 text-xs">
              <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 shadow-xs">
                📌
              </div>
              <div className="space-y-1 w-full">
                <div className="font-bold flex items-center justify-between text-amber-950">
                  <span>📍 Annuncio Statico (Ancorato al luogo / attività)</span>
                  <span className="bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">
                    Raggio: {effectiveRadius} km
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900">
                  Questo annuncio resta fisso all'indirizzo impostato (<strong>{item.staticLocation?.formattedAddress || item.location.address}</strong>). Gli utenti possono interagire e chattare entro un raggio di <strong>{effectiveRadius} km</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div className={`p-4 rounded-xl border flex items-start space-x-3 text-xs ${
              item.distanceKm !== undefined && item.distanceKm <= 0.1
                ? 'bg-teal-50 border-teal-300 text-teal-950'
                : 'bg-teal-50/60 border-teal-200 text-teal-900'
            }`}>
              <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-xs animate-pulse">
                100m
              </div>
              <div className="space-y-1 w-full">
                <div className="font-bold flex items-center justify-between text-teal-950">
                  <span>🏃 Annuncio Dinamico (Segue {item.userNickname} via GPS)</span>
                  <span className="bg-teal-700 text-white px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase">
                    100 metri FISSI
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-teal-900">
                  {(() => {
                    const isInside100m = item.distanceKm !== undefined && item.distanceKm <= 0.1;
                    const distStr = item.distanceKm !== undefined
                      ? item.distanceKm < 1 ? `${Math.round(item.distanceKm * 1000)} metri` : `${item.distanceKm.toFixed(1)} km`
                      : '? km';
                    return isInside100m ? (
                      <>
                        🎯 <strong>Sei a meno di 100 metri dalla persona ({distStr})!</strong> Sei nelle immediate vicinanze di {item.userNickname}. Questo annuncio rispetta la regola di vicinanza per incentivare un'interazione umana immediata e spontanea.
                      </>
                    ) : (
                      <>
                        ⚡ <strong>Distanza fissa a 100 metri:</strong> Viaggia con la persona via GPS. Attualmente ti trovi a <strong>{distStr}</strong>; l'annuncio diventerà interagibile quando sarete a meno di 100 metri l'uno dall'altro.
                      </>
                    );
                  })()}
                </p>
              </div>
            </div>
          )}

          {/* Status & Actions Box */}
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-700">Stato Annuncio</div>
              <div className="text-sm font-extrabold text-emerald-800 capitalize flex items-center space-x-1.5 mt-0.5">
                {item.status === 'active' && <Clock className="w-4 h-4 text-amber-500" />}
                {item.status === 'in_progress' && <HeartHandshake className="w-4 h-4 text-emerald-600 animate-pulse" />}
                {item.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                <span>
                  {item.status === 'active' && 'Attivo / In attesa di aiuto'}
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
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5 cursor-pointer"
                  >
                    <HeartHandshake className="w-4 h-4" />
                    <span>{item.type === 'request' ? 'Voglio Aiutare io!' : 'Accetta questo Aiuto'}</span>
                  </button>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-xl text-[11px] font-bold flex items-center space-x-1.5">
                    <span>🔒</span>
                    <span>Fuori dal raggio d'azione ({effectiveRadius < 1 ? Math.round(effectiveRadius * 1000) + 'm' : effectiveRadius + 'km'})</span>
                  </div>
                )
              )}

              {item.status === 'in_progress' && (isOwner || isHelper) && (
                <button
                  onClick={handleComplete}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-teal-700/20 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Segna come Concluso</span>
                </button>
              )}

              {isOwner && (
                <button
                  onClick={handleDeleteOrClose}
                  className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
                  title="Chiude l'annuncio ed elimina definitivamente tutti i messaggi della chat"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-600" />
                  <span>Chiudi Annuncio e Cancella Chat</span>
                </button>
              )}
            </div>
          </div>

          {/* Chat / Coordination Section */}
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col h-64 bg-slate-50">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>Chat Dedicata a Questo Annuncio</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  Effimera
                </span>
              </div>
              {!isWithinRadius && !isOwner && !isClosed && (
                <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-extrabold uppercase tracking-wide">
                  🔒 Sbloccabile nel raggio ({effectiveRadius < 1 ? Math.round(effectiveRadius * 1000) + 'm' : effectiveRadius + 'km'})
                </span>
              )}
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {isClosed ? (
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 text-center flex flex-col items-center justify-center py-6">
                  <Lock className="w-6 h-6 text-slate-400 mb-1" />
                  <div className="font-bold text-slate-800">Questo annuncio è stato chiuso</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">La chat dedicata è stata conclusa ed archiviata.</div>
                </div>
              ) : !isWithinRadius && !isOwner ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950 flex items-start space-x-2.5">
                  <span className="text-base shrink-0">📍</span>
                  <div className="space-y-0.5">
                    <div className="font-bold">Regola di vicinanza per i messaggi:</div>
                    <div className="text-[11px] opacity-90 leading-relaxed">
                      Puoi consultare l'annuncio da qualsiasi distanza, ma per inviare messaggi devi trovarti nel raggio d'azione ({effectiveRadius < 1 ? Math.round(effectiveRadius * 1000) + ' metri' : effectiveRadius + ' km'}). Avvicinati per sbloccare la chat e accordarti con {item.userNickname}!
                    </div>
                  </div>
                </div>
              ) : null}

              {!isClosed && messages.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-6">
                  Nessun messaggio per questo annuncio. Scrivi qui sotto per accordarti sui dettagli!
                  <div className="text-[10px] text-slate-400/80 mt-1">Tutti i messaggi spariranno automaticamente quando l'annuncio verrà chiuso.</div>
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
                disabled={isClosed || (!isWithinRadius && !isOwner)}
                placeholder={
                  isClosed
                    ? "🔒 Annuncio chiuso, chat disattivata"
                    : isWithinRadius || isOwner
                    ? "Scrivi un messaggio dedicato per questo annuncio..."
                    : `🔒 Avvicinati entro ${effectiveRadius < 1 ? Math.round(effectiveRadius * 1000) + ' metri' : effectiveRadius + ' km'} per scrivere`
                }
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isClosed || loadingMsg || !inputText.trim() || (!isWithinRadius && !isOwner)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Invia</span>
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
};
