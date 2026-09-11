import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Coins, User, Send, CheckCircle, Clock, HeartHandshake, MessageSquare, Trash2, ShieldCheck, Lock, Mic, MicOff, Radio, Volume2, Play, Pause, Square } from 'lucide-react';
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

// Componente Simbolo Classico delle Linee Audio che Vibrano (Equalizzatore Vocale)
const AudioEqualizer: React.FC<{ isSpeaking?: boolean; color?: string; size?: 'sm' | 'md' }> = ({
  isSpeaking = true,
  color = 'bg-emerald-400',
  size = 'md',
}) => {
  const barClass = size === 'sm' ? 'w-0.5 max-h-3' : 'w-1 max-h-4';
  const containerHeight = size === 'sm' ? 'h-3' : 'h-4';

  if (!isSpeaking) {
    return (
      <div className={`flex items-center space-x-0.5 ${containerHeight} px-1 opacity-40 shrink-0`}>
        <span className={`${barClass} h-1 rounded-full ${color}`}></span>
        <span className={`${barClass} h-1 rounded-full ${color}`}></span>
        <span className={`${barClass} h-1 rounded-full ${color}`}></span>
        <span className={`${barClass} h-1 rounded-full ${color}`}></span>
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-0.5 ${containerHeight} px-1 shrink-0`}>
      <span className={`${barClass} rounded-full ${color} animate-[pulse_0.4s_ease-in-out_infinite] h-full`}></span>
      <span className={`${barClass} rounded-full ${color} animate-[pulse_0.6s_ease-in-out_infinite_100ms] h-2/3`}></span>
      <span className={`${barClass} rounded-full ${color} animate-[pulse_0.3s_ease-in-out_infinite_200ms] h-full`}></span>
      <span className={`${barClass} rounded-full ${color} animate-[pulse_0.5s_ease-in-out_infinite_150ms] h-4/5`}></span>
      <span className={`${barClass} rounded-full ${color} animate-[pulse_0.4s_ease-in-out_infinite_250ms] h-3/5`}></span>
    </div>
  );
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
  const [piazzaMuted, setPiazzaMuted] = useState(true);
  const [userIsSpeaking, setUserIsSpeaking] = useState(false);
  const [simulatedSpeaker, setSimulatedSpeaker] = useState<string | null>(null);
  const [simulatePresence, setSimulatePresence] = useState(false);

  // Voice recording state for Wappino Interno
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

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
      stopMicAnalysis();
    };
  }, [isOpen, item?.id]);

  // Real-time Mic audio volume detector for Piazza Room when unmuted
  useEffect(() => {
    if (isPiazzaOpen && !piazzaMuted) {
      startMicAnalysis();
    } else {
      stopMicAnalysis();
      setUserIsSpeaking(false);
    }
  }, [isPiazzaOpen, piazzaMuted]);

  const startMicAnalysis = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setUserIsSpeaking(true);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setUserIsSpeaking(average > 10);
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      setUserIsSpeaking(true);
    }
  };

  const stopMicAnalysis = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setUserIsSpeaking(false);
  };

  if (!isOpen || !item) return null;

  const isOffer = item.type === 'offer';
  const isOwner = user?.id === item.userId;
  const isHelper = user?.id === item.helperId;
  const isStatic = item.trackingType === 'static';
  const effectiveRadius = isStatic
    ? Math.min(10, Math.max(0.1, item.actionRadiusKm || 1))
    : 0.1; // 100 meters for dynamic

  const actualIsWithinRadius = item.distanceKm !== undefined && item.distanceKm <= effectiveRadius;
  const isWithinRadius = actualIsWithinRadius || simulatePresence;
  const isClosed = item.status === 'completed' || item.status === 'cancelled';

  // --- RECORDING VOICE MESSAGE LOGIC FOR WAPPINO INTERNO ---
  const handleStartRecording = async () => {
    if (!isWithinRadius || isClosed) return;
    try {
      audioChunksRef.current = [];
      setRecordingTime(0);

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        mediaRecorder.start(100);
        setIsRecording(true);

        recordingTimerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } else {
        throw new Error('Mic not supported');
      }
    } catch (err) {
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  };

  const handleCancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }
    }
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  };

  const handleSendVoiceMessage = async () => {
    if (!user || !isWithinRadius || isClosed) return;

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const duration = Math.max(1, recordingTime);

    let audioDataUrl = '';

    if (mediaRecorderRef.current && audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      }

      audioDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });
    }

    if (!audioDataUrl) {
      audioDataUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    }

    setIsRecording(false);
    setRecordingTime(0);

    const msgPayload: ChatMessage = {
      id: 'msg-voice-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      helpItemId: item.id,
      senderId: user.id,
      senderNickname: user.nickname,
      text: `🎤 Messaggio Vocale (${duration}s)`,
      audioUrl: audioDataUrl,
      audioDuration: duration,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, msgPayload]);
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
      console.error('Error sending voice message to Firestore:', err);
    } finally {
      setLoadingMsg(false);
    }
  };

  const handleTogglePlayAudio = (msgId: string, audioUrl?: string) => {
    if (playingAudioId === msgId) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingAudioId(null);
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.play().catch(() => {
        if ('speechSynthesis' in window) {
          const utter = new SpeechSynthesisUtterance("Messaggio vocale da Wappino Interno");
          utter.lang = "it-IT";
          window.speechSynthesis.speak(utter);
        }
      });
      setPlayingAudioId(msgId);
      audio.onended = () => setPlayingAudioId(null);
    } else {
      setPlayingAudioId(msgId);
      setTimeout(() => setPlayingAudioId(null), 3000);
    }
  };

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
                Puoi consultare le informazioni della gentilezza, ma <strong>non puoi scrivere messaggi, né registrare vocali o attivare la funzione Pizza (Audio Live)</strong> se non ti trovi nell'area di influenza ({effectiveRadius < 1 ? Math.round(effectiveRadius * 1000) + ' metri' : effectiveRadius + ' km'}).
              </p>
              <div className="text-[11px] font-bold text-amber-800 border-t border-amber-200/80 pt-2 flex items-center justify-between">
                <span className="flex items-center gap-1">✨ Solo la presenza sul posto attiva l'interazione.</span>
                <button
                  type="button"
                  onClick={() => setSimulatePresence(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center space-x-1 shrink-0"
                >
                  <span>📍 Attiva Presenza (Test)</span>
                </button>
              </div>
            </div>
          )}

          {/* Chat & Wappino Interno Section */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden flex flex-col h-80 bg-slate-50 shadow-xs">
            {/* Header Chat */}
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>Wappino Interno (Chat & Vocali)</span>
              </div>
              
              {/* PIAZZA LIVE AUDIO / FUNZIONE PIZZA BUTTON */}
              <button
                onClick={() => {
                  if (!isWithinRadius) {
                    if (window.confirm("🔒 Funzione Pizza / Piazza disattivata: sei fuori dal raggio di questa gentilezza. Vuoi attivare la 'Modalità Test Presenza' per entrare nella stanza audio live?")) {
                      setSimulatePresence(true);
                      setIsPiazzaOpen(true);
                    }
                    return;
                  }
                  setIsPiazzaOpen(true);
                }}
                className={`font-bold px-3 py-1.5 rounded-lg text-xs shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer ${
                  !isWithinRadius
                    ? 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200 border border-indigo-300'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white animate-pulse'
                }`}
                title="Entra nella Funzione Pizza / Piazza: stanza audio live"
              >
                <Radio className="w-3.5 h-3.5 text-indigo-200" />
                <span>
                  {isWithinRadius ? '🏛️ Funzione Pizza (Audio Live)' : '🏛️ Funzione Pizza (Test Audio)'}
                </span>
              </button>
            </div>

            {/* Chat Message List */}
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
                      Per inviare messaggi scritti, registrare vocali o parlare in live audio devi trovarti nel raggio d'azione ({effectiveRadius < 1 ? Math.round(effectiveRadius * 1000) + ' metri' : effectiveRadius + ' km'}).
                    </div>
                  </div>
                </div>
              ) : null}

              {!isClosed && messages.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-6">
                  Nessun messaggio. Scrivi, invia un vocale 🎤 o entra in Pizza per parlare a voce!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  const hasAudio = !!msg.audioUrl;
                  const isPlaying = playingAudioId === msg.id;

                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="text-[10px] text-slate-500 mb-0.5 px-1">{msg.senderNickname}</div>
                      
                      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow-xs ${
                        isMe ? 'bg-emerald-600 text-white rounded-br-xs' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                      }`}>
                        {hasAudio ? (
                          /* Wappino Voice Message Bubble */
                          <div className="flex items-center space-x-3 py-1">
                            <button
                              type="button"
                              onClick={() => handleTogglePlayAudio(msg.id, msg.audioUrl)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 cursor-pointer ${
                                isMe ? 'bg-white text-emerald-800' : 'bg-emerald-600 text-white'
                              }`}
                            >
                              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                            </button>

                            <div className="flex flex-col flex-1 min-w-[120px]">
                              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                                <span>🎤 Messaggio Vocale</span>
                                <span>{msg.audioDuration ? `${msg.audioDuration}s` : '0:03'}</span>
                              </div>
                              <AudioEqualizer isSpeaking={isPlaying} color={isMe ? 'bg-white' : 'bg-emerald-600'} size="sm" />
                            </div>
                          </div>
                        ) : (
                          /* Text Message */
                          <div>{msg.text}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Bar: Text + Voice Message Recording */}
            {isRecording ? (
              /* Voice Recording Bar */
              <div className="p-3 bg-red-50/90 border-t border-red-200 flex items-center justify-between space-x-3 animate-in fade-in duration-200">
                <div className="flex items-center space-x-2 text-red-700 font-bold text-xs">
                  <span className="w-3 h-3 rounded-full bg-red-600 animate-ping"></span>
                  <span>Registrazione Vocale in corso... ({recordingTime}s)</span>
                  <AudioEqualizer isSpeaking={true} color="bg-red-600" size="sm" />
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCancelRecording}
                    className="p-2 text-slate-500 hover:text-red-600 rounded-xl bg-white border border-slate-200 cursor-pointer"
                    title="Annulla registrazione"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSendVoiceMessage}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Invia Vocale</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Normal Input Form */
              <form onSubmit={handleSendMessage} className="p-2.5 bg-white border-t border-slate-200 flex items-center space-x-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={isClosed || !isWithinRadius}
                  placeholder={isClosed ? 'Annuncio chiuso' : !isWithinRadius ? '🔒 Presenza sul posto richiesta (Clicca "Vocale 🎤" per testare)' : 'Scrivi un messaggio...'}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50"
                />

                {/* Microfono per Inviare Vocale */}
                <button
                  type="button"
                  onClick={() => {
                    if (isClosed) return;
                    if (!isWithinRadius) {
                      if (window.confirm("🔒 Sei fuori dall'area di questa gentilezza. Vuoi attivare la 'Modalità Test Presenza' per provare subito la registrazione ed i messaggi vocali?")) {
                        setSimulatePresence(true);
                      }
                      return;
                    }
                    handleStartRecording();
                  }}
                  disabled={isClosed}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center space-x-1 shadow-md shrink-0 active:scale-95"
                  title="Registra ed invia un messaggio vocale (Wappino Interno)"
                >
                  <Mic className="w-4 h-4 text-emerald-200 animate-pulse" />
                  <span>Vocale 🎤</span>
                </button>

                {/* Pulsante Invia Testo */}
                <button
                  type="submit"
                  disabled={isClosed || !isWithinRadius || !inputText.trim()}
                  className="bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Invia</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* PIAZZA LIVE AUDIO ROOM OVERLAY / MODAL */}
        {isPiazzaOpen && (
          <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-md p-6 flex flex-col justify-between text-white animate-in zoom-in-95 duration-200">
            {/* Piazza Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg animate-pulse">
                  <Radio className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-black text-base flex items-center gap-1.5">
                    <span>🏛️ La Piazza Audio Live</span>
                    <span className="text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full uppercase tracking-wider font-extrabold">
                      Presenza Attiva
                    </span>
                  </h3>
                  <p className="text-xs text-indigo-300">Stanza vocale condivisa: tutti parlano e tutti ascoltano</p>
                </div>
              </div>
              <button
                onClick={() => {
                  stopMicAnalysis();
                  setIsPiazzaOpen(false);
                }}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Central Microphone Visualizer & Active Speaker Indicator */}
            <div className="flex-1 py-4 flex flex-col items-center justify-center space-y-5">
              <div className="relative flex items-center justify-center">
                <div className={`absolute w-36 h-36 rounded-full bg-indigo-500/20 animate-ping ${(!piazzaMuted && userIsSpeaking) || simulatedSpeaker ? 'opacity-100' : 'opacity-0'}`}></div>
                
                <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-2xl border-4 transition-all ${
                  !piazzaMuted && userIsSpeaking
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 border-emerald-300 scale-105'
                    : 'bg-gradient-to-tr from-indigo-700 to-slate-800 border-slate-700'
                }`}>
                  <div className="flex flex-col items-center space-y-1">
                    <Mic className={`w-8 h-8 ${!piazzaMuted ? 'text-white' : 'text-slate-400'}`} />
                    <AudioEqualizer isSpeaking={(!piazzaMuted && userIsSpeaking) || !!simulatedSpeaker} color="bg-amber-300" size="sm" />
                  </div>
                </div>
              </div>

              <div className="text-center space-y-1">
                <div className="font-bold text-sm flex items-center justify-center gap-2">
                  {piazzaMuted ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <MicOff className="w-4 h-4" /> Microfono Muto (Ascolti i presenti)
                    </span>
                  ) : (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Mic className="w-4 h-4 animate-bounce" /> Microfono Attivo
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 max-w-xs">
                  In Piazza il canale vocale è unico: il simbolo con le <strong>linee che vibrano</strong> indica chi sta parlando in tempo reale.
                </p>
              </div>

              {/* Participants list with Speaking Equalizer indicators */}
              <div className="w-full max-w-sm bg-slate-800/90 border border-slate-700 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300 uppercase tracking-wider border-b border-slate-700/80 pb-2">
                  <span>Partecipanti in Stanza (3)</span>
                  <button
                    onClick={() => setSimulatedSpeaker(simulatedSpeaker ? null : item.userNickname)}
                    className="text-[10px] bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-700 px-2 py-0.5 rounded cursor-pointer transition-colors"
                  >
                    {simulatedSpeaker ? 'Interrompi Voce Autore' : 'Simula Voce Autore'}
                  </button>
                </div>

                {/* Participant 1: Author */}
                <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${
                  simulatedSpeaker === item.userNickname
                    ? 'bg-indigo-950/90 border border-indigo-500/80 shadow-md'
                    : 'bg-slate-900/60'
                }`}>
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${simulatedSpeaker === item.userNickname ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'}`}></span>
                    <span className="font-bold text-slate-200">{item.userNickname} (Autore)</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Symbol of vibrating equalizer lines near speaker name */}
                    <AudioEqualizer isSpeaking={simulatedSpeaker === item.userNickname} color="bg-indigo-400" size="sm" />
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      simulatedSpeaker === item.userNickname
                        ? 'text-amber-300 bg-amber-950/80 border border-amber-500/40'
                        : 'text-slate-400 bg-slate-800'
                    }`}>
                      {simulatedSpeaker === item.userNickname ? 'Parlando 🎙️' : 'In ascolto'}
                    </span>
                  </div>
                </div>

                {/* Participant 2: Current User (You) */}
                {user && (
                  <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all ${
                    !piazzaMuted && userIsSpeaking
                      ? 'bg-emerald-950/90 border border-emerald-500/80 shadow-md'
                      : 'bg-slate-900/60'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${!piazzaMuted ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500'}`}></span>
                      <span className="font-bold text-slate-100">{user.nickname} (Tu)</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* Symbol of vibrating equalizer lines near speaker name */}
                      <AudioEqualizer isSpeaking={!piazzaMuted && userIsSpeaking} color="bg-emerald-400" size="sm" />
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        !piazzaMuted && userIsSpeaking
                          ? 'text-emerald-300 bg-emerald-900/80 border border-emerald-500/40'
                          : piazzaMuted
                          ? 'text-amber-300 bg-amber-950/60'
                          : 'text-slate-300 bg-slate-800'
                      }`}>
                        {!piazzaMuted && userIsSpeaking ? 'Parlando 🎙️' : piazzaMuted ? 'Muto' : 'Microfono Attivo'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Participant 3: Citizen Nearby */}
                <div className="flex items-center justify-between bg-slate-900/60 px-3 py-2 rounded-xl text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                    <span className="font-bold text-slate-300">Cittadino_Vicinato</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <AudioEqualizer isSpeaking={false} size="sm" />
                    <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">In ascolto</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Controls */}
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
                <span>{piazzaMuted ? 'Attiva Microfono (Parla)' : 'Disattiva Microfono'}</span>
              </button>

              <button
                onClick={() => {
                  stopMicAnalysis();
                  setIsPiazzaOpen(false);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-3 rounded-2xl font-bold text-xs transition-all shadow-lg cursor-pointer flex items-center space-x-2"
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
