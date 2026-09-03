import React, { useState, useEffect } from 'react';
import { X, MapPin, Coins, User, Send, CheckCircle, Clock, HeartHandshake, ShieldCheck, MessageSquare } from 'lucide-react';
import { HelpItem, UserProfile, ChatMessage } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';

interface HelpDetailModalProps {
  item: HelpItem | null;
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onUpdateItemStatus: (itemId: string, newStatus: HelpItem['status'], helperId?: string, helperNickname?: string) => void;
}

export const HelpDetailModal: React.FC<HelpDetailModalProps> = ({
  item,
  isOpen,
  onClose,
  user,
  onUpdateItemStatus,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingMsg, setLoadingMsg] = useState(false);

  useEffect(() => {
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
    const interval = setInterval(fetchServerMessages, 3000);

    // 2. Listen to Firestore messages
    let unsubscribe: (() => void) | undefined;
    try {
      const q = query(
        collection(db, 'help_messages'),
        where('helpItemId', '==', item.id)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const msgs: ChatMessage[] = [];
          snapshot.forEach((docSnap) => {
            msgs.push({ id: docSnap.id, ...docSnap.data() } as ChatMessage);
          });
          if (msgs.length > 0) {
            setMessages((prev) => {
              const map = new Map<string, ChatMessage>();
              prev.forEach((m) => map.set(m.id, m));
              msgs.forEach((m) => map.set(m.id, m));
              const combined = Array.from(map.values());
              combined.sort((a, b) => a.createdAt - b.createdAt);
              return combined;
            });
          }
        },
        () => {}
      );
    } catch (err) {}

    return () => {
      clearInterval(interval);
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const isOwner = user?.id === item.userId;
  const isHelper = user?.id === item.helperId;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

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

    // 2. Post to Firestore
    try {
      await addDoc(collection(db, 'help_messages'), msgPayload);
    } catch (err) {
      console.error('Error sending Firestore message:', err);
    } finally {
      setLoadingMsg(false);
    }
  };

  const handleTakeAction = () => {
    if (!user) return;
    if (item.type === 'request') {
      // User is offering to help this request
      onUpdateItemStatus(item.id, 'in_progress', user.id, user.nickname);
    } else {
      // User is asking help from this offer
      onUpdateItemStatus(item.id, 'in_progress', user.id, user.nickname);
    }
  };

  const handleComplete = () => {
    onUpdateItemStatus(item.id, 'completed');
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
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white transition-colors">
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
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>{item.location.address} {item.distanceKm !== undefined ? `(${item.distanceKm} km)` : ''}</span>
              </div>
              <div className="flex items-center space-x-1 text-amber-600 font-bold">
                <Coins className="w-3.5 h-3.5" />
                <span>{item.isFree ? 'Gratuito (Solidarietà)' : `${item.creditsRequired} Crediti HELP`}</span>
              </div>
            </div>
          </div>

          {/* Status & Actions Box */}
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-slate-700">Stato Attuale</div>
              <div className="text-sm font-extrabold text-emerald-800 capitalize flex items-center space-x-1.5 mt-0.5">
                {item.status === 'active' && <Clock className="w-4 h-4 text-amber-500" />}
                {item.status === 'in_progress' && <HeartHandshake className="w-4 h-4 text-emerald-600 animate-pulse" />}
                {item.status === 'completed' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                <span>
                  {item.status === 'active' && 'Disponibile / In attesa di aiuto'}
                  {item.status === 'in_progress' && `In corso (Aiutante: ${item.helperNickname || 'Assegnato'})`}
                  {item.status === 'completed' && 'Completato con successo 🎉'}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div>
              {item.status === 'active' && !isOwner && (
                <button
                  onClick={handleTakeAction}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5"
                >
                  <HeartHandshake className="w-4 h-4" />
                  <span>{item.type === 'request' ? 'Voglio Aiutare io!' : 'Accetta questo Aiuto'}</span>
                </button>
              )}

              {item.status === 'in_progress' && (isOwner || isHelper) && (
                <button
                  onClick={handleComplete}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md shadow-teal-700/20 transition-all flex items-center space-x-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Segna come Completato & Crediti</span>
                </button>
              )}

              {item.status === 'completed' && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl">
                  Aiuto Concluso ✨
                </span>
              )}
            </div>
          </div>

          {/* Chat / Coordination Section */}
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col h-64 bg-slate-50">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center space-x-2 text-xs font-bold text-slate-700">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Coordinamento & Chat di Vicinato</span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-8">
                  Nessun messaggio ancora. Scrivi qui sotto per accordarti sui dettagli dell'aiuto in modo semplice e diretto!
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
                placeholder="Scrivi un messaggio per coordinarti..."
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={loadingMsg || !inputText.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 disabled:opacity-50"
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
