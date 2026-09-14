import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Users, MessageSquare, Plus, Search, Sparkles, Trophy, 
  HeartHandshake, Mic, Send, Volume2, ShieldCheck, Check, MapPin, 
  Store, UserPlus, LogOut, X, Loader2, Award, Play, Pause, AlertCircle, Clock,
  ArrowLeft, Calendar, Info, Smile, Heart, ThumbsUp, Compass
} from 'lucide-react';
import { UserProfile, Community, CommunityMessage, CommunityInitiative, isCommunityExpired } from '../types';
import { ComuneAutocompleteInput } from './ComuneAutocompleteInput';
import { resolveAddressGeocode } from '../services/comuniService';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, setDoc, query, orderBy } from 'firebase/firestore';

interface CommunityWallProps {
  user: UserProfile | null;
  communities?: Community[];
  setCommunities?: React.Dispatch<React.SetStateAction<Community[]>>;
  onSaveProfile?: (updated: Partial<UserProfile>) => void;
  initialSubTab?: 'communities' | 'stories';
  preSelectedCommunityId?: string | null;
  onClearPreSelection?: () => void;
}

export const CommunityWall: React.FC<CommunityWallProps> = ({ 
  user, 
  communities: externalCommunities, 
  setCommunities: setExternalCommunities, 
  onSaveProfile, 
  initialSubTab = 'communities',
  preSelectedCommunityId,
  onClearPreSelection
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'communities' | 'stories'>(
    initialSubTab === 'stories' ? 'stories' : 'communities'
  );

  useEffect(() => {
    if (initialSubTab && initialSubTab !== 'sponsors' as any) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);
  
  // State for Communities
  const [localCommunities, setLocalCommunities] = useState<Community[]>([]);
  const communities = externalCommunities || localCommunities;
  const setCommunities = setExternalCommunities || setLocalCommunities;

  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);

  // Handle pre-selection from map or other sources
  useEffect(() => {
    if (preSelectedCommunityId && communities.length > 0) {
      const comm = communities.find(c => c.id === preSelectedCommunityId);
      if (comm) {
        setSelectedCommunity(comm);
        // Clear it so it doesn't re-trigger if we navigate back and forth
        if (onClearPreSelection) onClearPreSelection();
      }
    }
  }, [preSelectedCommunityId, communities, onClearPreSelection]);

  // Auto-select community if user is in any community (makes it faster on mobile)
  useEffect(() => {
    if (user && (user.communityIds?.length || 0) > 0 && !selectedCommunity && communities.length > 0) {
      // If user is in exactly one, enter it. If more, the list view now shows "My Communities" prominently.
      if (user.communityIds!.length === 1) {
        const commId = user.communityIds![0];
        const comm = communities.find(c => c.id === commId);
        if (comm) {
          setSelectedCommunity(comm);
        }
      }
    }
  }, [user, communities, selectedCommunity]);
  const [searchCommunityQuery, setSearchCommunityQuery] = useState('');
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [isGenesisModalOpen, setIsGenesisModalOpen] = useState(false);
  
  // Hub Inner Tab state: 'chat' | 'initiatives' | 'members'
  const [activeCommHubTab, setActiveCommHubTab] = useState<'chat' | 'initiatives' | 'members'>('chat');
  
  // Create Community Form
  const [newCommName, setNewCommName] = useState('');
  const [newCommSede, setNewCommSede] = useState('');
  const [newCommComune, setNewCommComune] = useState(() => (user?.location?.address && user.location.address !== 'Posizione non condivisa' ? user.location.address.split(',')[0] : ''));
  const [newCommDesc, setNewCommDesc] = useState('');
  const [newCommRadiusKm, setNewCommRadiusKm] = useState<number>(5);
  const [isCreatingComm, setIsCreatingComm] = useState(false);

  // Community Chat Messages
  const [chatMessages, setChatMessages] = useState<CommunityMessage[]>([]);
  const [inputChatText, setInputChatText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<any>(null);
  const [activeAudioMessageId, setActiveAudioMessageId] = useState<string | null>(null);

  // Community Initiatives State
  const [communityInitiatives, setCommunityInitiatives] = useState<CommunityInitiative[]>([]);
  const [isCreateInitiativeOpen, setIsCreateInitiativeOpen] = useState(false);
  const [newInitTitle, setNewInitTitle] = useState('');
  const [newInitDesc, setNewInitDesc] = useState('');
  const [newInitDate, setNewInitDate] = useState('');
  const [newInitLoc, setNewInitLoc] = useState('');
  const [isSubmittingInit, setIsSubmittingInit] = useState(false);

  // Initial demo communities if database is empty
  const defaultCommunities: Community[] = [
    {
      id: 'comm-somma-1',
      name: 'Comunità Civica Somma Centro & Castello',
      sedeAddress: 'Corso Repubblica 12 (presso Centro Civico)',
      comune: 'Somma Lombardo',
      description: 'Cittadini attivi per il mutuo soccorso, supporto anziani, e condivisione attrezzi a Somma Lombardo.',
      founderId: 'user-demo-1',
      founderNickname: 'MarcoSolidale',
      members: ['user-demo-1', 'user-demo-2', 'user-demo-3'],
      memberNicknames: ['MarcoSolidale', 'ElenaVicina', 'Giuseppe_Mi'],
      memberCount: 3,
      brikoTreasury: 1250,
      createdAt: Date.now() - 86400000 * 5,
      actionRadiusKm: 5,
    },
    {
      id: 'comm-milano-1',
      name: 'Rete Solidale Porta Romana & Navigli',
      sedeAddress: 'Via Muratori 24 (Sede di Quartiere)',
      comune: 'Milano',
      description: 'Comunità aperta per aiutarsi nelle commissioni quotidiane, spesa e supporto studenti universitari.',
      founderId: 'user-demo-2',
      founderNickname: 'ElenaVicina',
      members: ['user-demo-2', 'user-demo-4'],
      memberNicknames: ['ElenaVicina', 'Luca_Civico'],
      memberCount: 2,
      brikoTreasury: 890,
      createdAt: Date.now() - 86400000 * 3,
      actionRadiusKm: 8,
    }
  ];

  // 1. Real-time Firestore sync for Communities
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onSnapshot(collection(db, 'help_communities'), (snap) => {
        const fetched: Community[] = [];
        snap.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as Community);
        });
        if (fetched.length > 0) {
          setCommunities(fetched);
        } else {
          setCommunities(defaultCommunities);
        }
      }, () => {
        setCommunities(defaultCommunities);
      });
    } catch {
      setCommunities(defaultCommunities);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // 2. Real-time Firestore listener for selected Community messages
  useEffect(() => {
    if (!selectedCommunity) return;
    let unsubscribe: (() => void) | undefined;
    try {
      const msgsRef = collection(db, 'help_communities', selectedCommunity.id, 'messages');
      const q = query(msgsRef, orderBy('createdAt', 'asc'));
      unsubscribe = onSnapshot(q, (snap) => {
        const fetched: CommunityMessage[] = [];
        snap.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as CommunityMessage);
        });
        setChatMessages(fetched);
      });
    } catch (err) {
      console.warn('Community chat listener error:', err);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedCommunity]);

  // 3. Real-time Firestore listener for selected Community initiatives
  useEffect(() => {
    if (!selectedCommunity) return;
    let unsubscribe: (() => void) | undefined;
    try {
      const initsRef = collection(db, 'help_communities', selectedCommunity.id, 'initiatives');
      const q = query(initsRef, orderBy('createdAt', 'desc'));
      unsubscribe = onSnapshot(q, (snap) => {
        const fetched: CommunityInitiative[] = [];
        snap.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as CommunityInitiative);
        });
        setCommunityInitiatives(fetched);
      });
    } catch (err) {
      console.warn('Initiatives listener error:', err);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedCommunity]);

  // Voice recording handlers
  const handleStartRecording = () => {
    setIsRecordingVoice(true);
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const handleStopRecordingAndSend = async () => {
    if (!selectedCommunity || !user) return;
    clearInterval(recordingTimerRef.current);
    const audioDur = Math.max(1, recordingSeconds);
    setIsRecordingVoice(false);
    setRecordingSeconds(0);

    const newMsg: Omit<CommunityMessage, 'id'> = {
      communityId: selectedCommunity.id,
      senderId: user.id,
      senderNickname: user.nickname,
      text: `🎤 Messaggio Vocale (${audioDur} sec)`,
      audioUrl: 'https://actions.google.com/sounds/v1/human/human_voice_talking.ogg',
      audioDuration: audioDur,
      createdAt: Date.now(),
    };

    try {
      await addDoc(collection(db, 'help_communities', selectedCommunity.id, 'messages'), newMsg);
    } catch (e) {
      console.warn('Voice message add error:', e);
    }
  };

  const handleSendTextMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !selectedCommunity || !user) return;

    const newMsg: Omit<CommunityMessage, 'id'> = {
      communityId: selectedCommunity.id,
      senderId: user.id,
      senderNickname: user.nickname,
      text: textToSend.trim(),
      createdAt: Date.now(),
    };

    try {
      await addDoc(collection(db, 'help_communities', selectedCommunity.id, 'messages'), newMsg);
    } catch (e) {
      console.warn('Community text message add error:', e);
    }
  };

  const handleFormSendTextMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputChatText.trim()) return;
    handleSendTextMessage(inputChatText);
    setInputChatText('');
  };

  // Create Community Submit
  const handleCreateCommunitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommName.trim() || !newCommSede.trim() || !user) return;

    // Check user max 5 communities limit
    const userCommunitiesCount = communities.filter(
      (c) => !isCommunityExpired(c) && c.members?.includes(user.id)
    ).length;
    if (userCommunitiesCount >= 5) {
      alert('⚠️ Limite raggiunto: sei già iscritto a 5 comunità civiche (massimo consentito per persona). Per crearne una nuova devi prima lasciarne una a cui sei iscritto.');
      return;
    }

    setIsCreatingComm(true);
    const commId = 'comm-' + Date.now();
    
    // Geocode Sede Address
    const geo = await resolveAddressGeocode(newCommComune.trim(), newCommSede.trim());

    const newCommunityData: Community = {
      id: commId,
      name: newCommName.trim(),
      sedeAddress: newCommSede.trim(),
      comune: newCommComune.trim(),
      description: newCommDesc.trim() || 'Comunità locale per la gentilezza ed il reciproco aiuto.',
      founderId: user.id,
      founderNickname: user.nickname,
      members: [user.id],
      memberNicknames: [user.nickname],
      memberCount: 1,
      brikoTreasury: 500, // Fondo iniziale omaggio
      createdAt: Date.now(),
      actionRadiusKm: Math.min(10, Math.max(1, Number(newCommRadiusKm) || 5)),
      location: {
        lat: geo.lat || 45.6836,
        lng: geo.lng || 8.7071,
        address: `${newCommSede.trim()}, ${newCommComune.trim()}`
      }
    };

    try {
      await setDoc(doc(db, 'help_communities', commId), newCommunityData);
      setCommunities((prev) => [newCommunityData, ...prev]);
      if (onSaveProfile) {
        onSaveProfile({ communityId: commId });
      }
      setSelectedCommunity(newCommunityData);
      setIsCreateCommunityOpen(false);
      setNewCommName('');
      setNewCommSede('');
      setNewCommDesc('');
    } catch (err) {
      console.error('Error creating community:', err);
    } finally {
      setIsCreatingComm(false);
    }
  };

  // Create Initiative Submit
  const handleCreateInitiativeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInitTitle.trim() || !selectedCommunity || !user) return;

    setIsSubmittingInit(true);
    const initData: Omit<CommunityInitiative, 'id'> = {
      communityId: selectedCommunity.id,
      title: newInitTitle.trim(),
      description: newInitDesc.trim() || 'Incontro locale o attività solidale per la comunità.',
      organizerId: user.id,
      organizerNickname: user.nickname,
      dateStr: newInitDate.trim() || 'Data da concordare',
      locationStr: newInitLoc.trim() || selectedCommunity.sedeAddress,
      participants: [user.id],
      createdAt: Date.now(),
    };

    try {
      await addDoc(collection(db, 'help_communities', selectedCommunity.id, 'initiatives'), initData);
      setIsCreateInitiativeOpen(false);
      setNewInitTitle('');
      setNewInitDesc('');
      setNewInitDate('');
      setNewInitLoc('');
    } catch (err) {
      console.warn('Initiative creation error:', err);
    } finally {
      setIsSubmittingInit(false);
    }
  };

  // Join Initiative Handler
  const handleJoinInitiative = async (init: CommunityInitiative) => {
    if (!user || !selectedCommunity) return;
    if (init.participants.includes(user.id)) return;

    const updatedParticipants = [...init.participants, user.id];
    setCommunityInitiatives((prev) =>
      prev.map((i) => (i.id === init.id ? { ...i, participants: updatedParticipants } : i))
    );

    try {
      await updateDoc(doc(db, 'help_communities', selectedCommunity.id, 'initiatives', init.id), {
        participants: updatedParticipants,
      });
    } catch (err) {
      console.warn('Join initiative error:', err);
    }
  };

  // Join Community Handler
  const handleJoinCommunity = async (comm: Community) => {
    if (!user) return;
    if (comm.memberCount >= 100) {
      alert('Questa comunità ha raggiunto il limite massimo di 100 membri.');
      return;
    }
    if (comm.members?.includes(user.id)) {
      alert('Fai già parte di questa comunità!');
      return;
    }

    // Check user max 5 communities limit
    const userCommunitiesCount = communities.filter(
      (c) => !isCommunityExpired(c) && c.members?.includes(user.id)
    ).length;
    if (userCommunitiesCount >= 5) {
      alert('⚠️ Limite raggiunto: puoi iscriverti ad un massimo di 5 comunità civiche contemporaneamente. Per iscriverti a questa comunità devi prima uscirne da un\'altra.');
      return;
    }

    const updatedMembers = [...(comm.members || []), user.id];
    const updatedNicknames = [...(comm.memberNicknames || []), user.nickname];
    const updatedCount = updatedMembers.length;

    const updatedComm = {
      ...comm,
      members: updatedMembers,
      memberNicknames: updatedNicknames,
      memberCount: updatedCount,
    };

    setCommunities((prev) => prev.map((c) => (c.id === comm.id ? updatedComm : c)));
    if (selectedCommunity?.id === comm.id) {
      setSelectedCommunity(updatedComm);
    }

    if (onSaveProfile) {
      const currentIds = user.communityIds || [];
      onSaveProfile({ 
        communityId: comm.id, // Primary
        communityIds: [...currentIds, comm.id] // All
      });
    }

    try {
      await updateDoc(doc(db, 'help_communities', comm.id), {
        members: updatedMembers,
        memberNicknames: updatedNicknames,
        memberCount: updatedCount,
      });
    } catch (e) {
      console.warn('Firestore join community error:', e);
    }
  };

  // Leave Community Handler
  const handleLeaveCommunity = async (comm: Community) => {
    if (!user) return;
    const updatedMembers = comm.members.filter((m) => m !== user.id);
    const updatedNicknames = (comm.memberNicknames || []).filter((n) => n !== user.nickname);
    const updatedCount = updatedMembers.length;

    const updatedComm = {
      ...comm,
      members: updatedMembers,
      memberNicknames: updatedNicknames,
      memberCount: updatedCount,
    };

    setCommunities((prev) => prev.map((c) => (c.id === comm.id ? updatedComm : c)));
    if (selectedCommunity?.id === comm.id) {
      setSelectedCommunity(updatedComm);
    }

    if (onSaveProfile) {
      const currentIds = user.communityIds || [];
      const newIds = currentIds.filter(id => id !== comm.id);
      onSaveProfile({ 
        communityId: newIds.length > 0 ? newIds[0] : undefined,
        communityIds: newIds 
      });
    }

    try {
      await updateDoc(doc(db, 'help_communities', comm.id), {
        members: updatedMembers,
        memberNicknames: updatedNicknames,
        memberCount: updatedCount,
      });
    } catch (e) {}
  };

  const filteredCommunities = communities.filter((c) => {
    if (isCommunityExpired(c)) return false;
    if (!searchCommunityQuery.trim()) return true;
    const q = searchCommunityQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.comune.toLowerCase().includes(q) ||
      c.sedeAddress.toLowerCase().includes(q)
    );
  });

  const myCommunities = communities.filter(c => user?.communityIds?.includes(c.id) || c.members?.includes(user?.id || ''));

  return (
    <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-6 space-y-6 animate-in fade-in duration-300">
      
      {/* 🟢 IF A COMMUNITY IS SELECTED -> FULL DEDICATED COMMUNITY ROOM HUB ("Vivere la Comunità") */}
      {selectedCommunity ? (
        <div className="space-y-4 sm:space-y-6 animate-in zoom-in-95 duration-200 min-h-screen sm:min-h-0 bg-white sm:bg-transparent">
          <div className="bg-white rounded-none sm:rounded-2xl border-b sm:border border-slate-200 p-2.5 sm:p-3 shadow-xs flex items-center justify-between flex-wrap gap-2 sticky top-0 z-40">
            <button onClick={() => setSelectedCommunity(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl text-[10px] sm:text-xs transition-all flex items-center gap-1.5 cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-700" />
              <span>Esci dalla Stanza</span>
            </button>
            <div className="flex items-center gap-1.5">
              <span className="bg-emerald-100 text-emerald-900 font-extrabold text-[10px] px-2.5 py-1 rounded-full uppercase">🏛️ {selectedCommunity.comune}</span>
            </div>
            <div className="flex border border-slate-200 bg-slate-50 rounded-xl p-1 shadow-2xs">
              <button onClick={() => setActiveCommHubTab('chat')} className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeCommHubTab === 'chat' ? 'bg-emerald-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><MessageSquare className="w-3.5 h-3.5" /><span>Chat</span></button>
              <button onClick={() => setActiveCommHubTab('initiatives')} className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeCommHubTab === 'initiatives' ? 'bg-emerald-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><Award className="w-3.5 h-3.5" /><span>Bacheca</span></button>
              <button onClick={() => setActiveCommHubTab('members')} className={`px-3 sm:px-4 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeCommHubTab === 'members' ? 'bg-emerald-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}><Users className="w-3.5 h-3.5" /><span>Dati & Membri</span></button>
            </div>
          </div>
          <div className="px-4 sm:px-0 space-y-4 sm:space-y-6">
            <div className="bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden border border-emerald-700/40">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none"></div>
              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="inline-flex items-center space-x-2 bg-emerald-800/90 border border-emerald-400/30 px-3 py-1 rounded-full text-[10px] font-bold text-emerald-200 uppercase tracking-tighter"><Building2 className="w-3.5 h-3.5 text-emerald-400" /><span>Ambiente Civico a Km 0</span></div>
                  {((selectedCommunity.memberCount || 0) >= 10) ? (<span className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">✅ Ufficiale</span>) : (<span className="bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">⏳ Prova: {selectedCommunity.memberCount}/10</span>)}
                </div>
                <div className="space-y-1">
                  <h1 className="text-xl sm:text-4xl font-black text-white tracking-tight leading-tight">{selectedCommunity.name}</h1>
                  <p className="text-emerald-100 text-[11px] sm:text-sm font-medium flex items-center gap-1.5 opacity-90"><MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" /><span>Sede: <strong>{selectedCommunity.sedeAddress}</strong></span></p>
                </div>
                <p className="text-emerald-100 text-[11px] sm:text-sm leading-relaxed bg-emerald-950/60 p-3 rounded-xl border border-emerald-800/50 italic opacity-90">\"{selectedCommunity.description}\"</p>
                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-emerald-800/80">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold"><span className="bg-emerald-800/80 px-2.5 py-1.5 rounded-xl border border-emerald-600 flex items-center gap-1"><Users className="w-3.5 h-3.5 text-emerald-300" /><span>{selectedCommunity.memberCount} / 100</span></span><span className="bg-amber-500/20 text-amber-200 border border-amber-400/30 px-2.5 py-1.5 rounded-xl flex items-center gap-1">🧱 Tesoreria: {selectedCommunity.brikoTreasury || 500}</span></div>
                  {!user?.communityIds?.includes(selectedCommunity.id) && !selectedCommunity.members.includes(user?.id || '') ? (<button onClick={() => handleJoinCommunity(selectedCommunity)} className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-6 py-3 rounded-2xl text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer active:scale-95"><Plus className="w-4.5 h-4.5" /><span>ENTRA E VIVI QUESTA COMUNITÀ</span></button>) : (<div className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2"><span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span><span>Sei già membro della stanza civica</span></div>)}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-50/50 sm:bg-transparent px-3 sm:px-0 py-4 sm:py-0">
              <div className="space-y-4 sm:space-y-6 overflow-y-auto pb-20 sm:pb-0">
                {activeCommHubTab === 'chat' && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2"><h3 className="text-xs font-black text-slate-900 uppercase">Chat & Vocali</h3><span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{chatMessages.length} messaggi</span></div>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 h-96 overflow-y-auto space-y-3">
                      {chatMessages.length === 0 ? (<div className="text-center py-16 text-slate-400 text-xs space-y-3"><HeartHandshake className="w-10 h-10 mx-auto opacity-40 text-emerald-600 animate-pulse" /><p className="font-bold text-slate-700 text-sm">Nessun messaggio presente.</p></div>) : (chatMessages.map((msg) => { const isMine = user ? msg.senderId === user.id : false; return ( <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}><div className="text-[10px] text-slate-500 font-bold mb-1 px-1">{msg.senderNickname}</div><div className={`max-w-[85%] rounded-2xl px-4 py-2 text-xs ${isMine ? 'bg-emerald-800 text-white' : 'bg-white text-slate-900 border'}`}>{msg.text}</div></div> ); }))}
                    </div>
                    {user && selectedCommunity.members.includes(user.id) && (<form onSubmit={handleFormSendTextMessage} className="flex gap-2"><input type="text" value={inputChatText} onChange={(e) => setInputChatText(e.target.value)} placeholder="Scrivi..." className="flex-1 bg-slate-50 border p-3 rounded-xl text-xs" /><button type="submit" className="bg-slate-900 text-white px-4 rounded-xl text-xs">Invia</button></form>)}
                  </div>
                )}
                {activeCommHubTab === 'initiatives' && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
                    <h3 className="text-base font-bold flex items-center gap-2"><Award className="w-5 h-5 text-emerald-600" />Iniziative Locale</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{communityInitiatives.map(init => (<div key={init.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200"><h4 className="font-bold text-sm">{init.title}</h4><p className="text-xs text-slate-600 mt-1">{init.description}</p></div>))}</div>
                  </div>
                )}
                {activeCommHubTab === 'members' && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-sm">
                    <h3 className="text-base font-bold flex items-center gap-2"><Users className="w-5 h-5 text-emerald-600" />Membri</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{(selectedCommunity.memberNicknames || []).map((nick, i) => (<div key={i} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs font-bold">{nick}</div>))}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
) : (
        <div className="space-y-6">
          
          {/* Main Directory Hero Banner */}
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="max-w-3xl space-y-4 relative z-10">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-emerald-700/80 border border-emerald-400/40 px-3.5 py-1 rounded-full text-xs font-bold text-emerald-100">
                  🏛️ Comunità Civiche di Quartiere (BRIKO)
                </span>
                <button
                  onClick={() => setIsGenesisModalOpen(true)}
                  className="bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/40 text-amber-200 font-bold px-3 py-1 rounded-full text-xs transition-all cursor-pointer flex items-center gap-1"
                >
                  <Info className="w-3.5 h-3.5 text-amber-300" />
                  <span>Genesi di GeoKind & Storia dei BRIKO</span>
                </button>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black tracking-tight font-sans">
                Comunità Civiche & Mutuo Soccorso
              </h1>
              <p className="text-emerald-100 text-sm sm:text-base leading-relaxed">
                Gli spazi caldi di quartiere per aiutarsi tra vicini di casa. Seleziona una comunità o entravi per usufruire della chat di gruppo, vocali ed eventi locali!
              </p>
              
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  onClick={() => setIsCreateCommunityOpen(true)}
                  className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-6 py-3 rounded-2xl text-xs sm:text-sm transition-all shadow-lg flex items-center space-x-2 cursor-pointer active:scale-95"
                >
                  <Building2 className="w-4.5 h-4.5" />
                  <span>+ Fonda una Nuova Comunità Civica</span>
                </button>
              </div>
            </div>
          </div>

          {/* Directory Sub-tabs */}
          <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveSubTab('communities')}
              className={`flex-1 min-w-[150px] py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeSubTab === 'communities'
                  ? 'bg-emerald-800 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Elenco Comunità Civiche ({communities.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('stories')}
              className={`flex-1 min-w-[150px] py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                activeSubTab === 'stories'
                  ? 'bg-teal-800 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Storie & Classifica BRIKO</span>
            </button>
          </div>

          {activeSubTab === 'communities' && (
            <div className="space-y-6">
              
              {/* Rules Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="space-y-1">
                  <div className="font-extrabold text-sm text-emerald-900 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>Condizioni d'Ingresso & Trasparenza GEOKIND:</span>
                  </div>
                  <p className="text-emerald-800 leading-relaxed">
                    • <strong>Capacità massima: 100 membri</strong> per comunità per preservare lo spirito di vicinato reale.<br />
                    • <strong>Ingresso Garantito:</strong> Nessuno può rifiutare l'ingresso di un nuovo membro finché c'è posto.<br />
                    • Clicca su qualsiasi comunità per <strong>entrare nell'ambiente dedicato con Chat, Vocali e Iniziative!</strong>
                  </p>
                </div>
                <button
                  onClick={() => setIsCreateCommunityOpen(true)}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shrink-0 cursor-pointer shadow-xs"
                >
                  + Fondane una Tu
                </button>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchCommunityQuery}
                  onChange={(e) => setSearchCommunityQuery(e.target.value)}
                  placeholder="Cerca comunità per nome, sede o comune (es. Somma Lombardo, Milano...)"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none shadow-xs"
                />
              </div>

              {/* Communities Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCommunities.map((comm) => {
                  const isMember = user ? comm.members?.includes(user.id) : false;
                  
                  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
                  const age = Date.now() - (comm.createdAt || Date.now());
                  const daysLeft = Math.max(0, Math.ceil((ONE_MONTH_MS - age) / (24 * 60 * 60 * 1000)));
                  const isOfficial = (comm.memberCount || 0) >= 10;

                  return (
                    <div
                      key={comm.id}
                      className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="bg-emerald-100 text-emerald-900 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                            🏛️ {comm.comune}
                          </span>
                          {isMember && (
                            <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 shadow-xs">
                              Membro ✓
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-800 transition-colors leading-snug">
                          {comm.name}
                        </h3>

                        {/* 30-Day trial status banner */}
                        <div className={`text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                          isOfficial
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {isOfficial ? (
                            <><span>✅</span> <span>Comunità Ufficiale Permanente</span></>
                          ) : (
                            <><span>⏳</span> <span>Prova 1 Mese: {daysLeft} gg rimasti per 10 membri ({comm.memberCount}/10)</span></>
                          )}
                        </div>

                        <div className="text-xs text-slate-600 space-y-1">
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{comm.sedeAddress}</span>
                          </div>
                          <p className="line-clamp-2 text-[11px] leading-relaxed pt-1 text-slate-500">
                            {comm.description}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-500" />
                            <span>{comm.memberCount} / 100 Membri</span>
                          </span>
                          <span className="flex items-center gap-1 text-amber-600">
                            <span>🧱</span>
                            <span>{comm.brikoTreasury || 500} BRIKO</span>
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedCommunity(comm);
                            setActiveCommHubTab('chat');
                          }}
                          className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-3 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                        >
                          <Building2 className="w-4 h-4 text-amber-300" />
                          <span>Vivi e Entra in Comunità →</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* Stories Sub-tab */}
          {activeSubTab === 'stories' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <span>Storie di Solidarietà Recente</span>
                </h2>

                <div className="space-y-4">
                  {[
                    {
                      id: '1',
                      title: 'Spesa e medicinali consegnati a Somma Lombardo',
                      content: 'Grazie ai 100 BRIKO ricevuti ed al supporto di Marco, la signora Anna ha ricevuto la spesa direttamente a casa. La bricazione della gentilezza rende la nostra comunità più unita!',
                      helper: 'MarcoSolidale',
                      recipient: 'Signora Anna',
                      date: 'Oggi',
                    },
                    {
                      id: '2',
                      title: 'Riparazione bicicletta in cortile',
                      content: 'Un guasto al cambio della bici risolto in 15 minuti grazie agli attrezzi condivisi da Giuseppe in cambio di 10 BRIKO simbolici.',
                      helper: 'Giuseppe_Mi',
                      recipient: 'Davide',
                      date: 'Ieri',
                    },
                  ].map((story) => (
                    <div key={story.id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">Storie dal Vicinato</span>
                        <span>{story.date}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900">{story.title}</h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{story.content}</p>
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <div>Aiutante: <strong className="text-slate-800">{story.helper}</strong></div>
                        <div>Ricevente: <strong className="text-slate-800">{story.recipient}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leaderboard */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <Trophy className="w-5 h-5 text-amber-500" />
                      <span>Classifica Cittadini BRIKO</span>
                    </h3>
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">Top Quartiere</span>
                  </div>

                  <div className="space-y-3">
                    {[
                      { rank: 1, nickname: 'MarcoSolidale', helped: 24, briko: 450, rating: 5.0 },
                      { rank: 2, nickname: 'ElenaVicina', helped: 19, briko: 380, rating: 4.9 },
                      { rank: 3, nickname: 'Giuseppe_Mi', helped: 15, briko: 300, rating: 4.8 },
                    ].map((item) => (
                      <div key={item.rank} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center space-x-3">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                            item.rank === 1 ? 'bg-amber-400 text-white' : 'bg-slate-300 text-slate-800'
                          }`}>
                            {item.rank}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">{item.nickname}</div>
                            <div className="text-[10px] text-slate-500">{item.helped} aiuti completati</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-amber-600">🧱 {item.briko} BRIKO</div>
                          <div className="text-[10px] text-slate-400">{item.rating} ⭐</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* MODAL 1: Fondare una Comunità Civica */}
      {isCreateCommunityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="bg-emerald-800 p-5 text-white flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-200" />
                <span>Fonda una Nuova Comunità Civica</span>
              </h3>
              <button onClick={() => setIsCreateCommunityOpen(false)} className="text-white hover:opacity-80 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCommunitySubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-emerald-950 leading-relaxed">
                <strong>Regola d'Ingresso:</strong> La comunità può ospitare fino a <strong>massimo 100 membri</strong>. L'entrata è libera e garantita a chiunque senza approvazioni estenuanti.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Nome della Comunità *</label>
                <input
                  type="text"
                  value={newCommName}
                  onChange={(e) => setNewCommName(e.target.value)}
                  placeholder="es. Comunità Civica Somma Centro e Stazione"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <ComuneAutocompleteInput
                label="Comune Sede Comunità (dall'Archivio Ufficiale) *"
                value={newCommComune}
                onChange={(comuneName) => setNewCommComune(comuneName)}
                placeholder="Digita e seleziona comune (es. Milano, Somma Lombardo...)"
                required
              />

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Via e Civico Sede (Inserimento a mano) *</label>
                <input
                  type="text"
                  value={newCommSede}
                  onChange={(e) => setNewCommSede(e.target.value)}
                  placeholder="es. Corso Repubblica 12"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-slate-800 font-bold">
                  <label className="uppercase tracking-wider">Raggio d'Influenza Territoriale *</label>
                  <span className="bg-emerald-800 text-white px-2.5 py-0.5 rounded-lg text-xs font-black">
                    {newCommRadiusKm} km (max 10 km)
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={newCommRadiusKm}
                  onChange={(e) => setNewCommRadiusKm(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500">
                  Definisce l'area della comunità visibile sulla mappa attorno alla sede (Max 10 km).
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Descrizione / Scopo della Comunità</label>
                <textarea
                  value={newCommDesc}
                  onChange={(e) => setNewCommDesc(e.target.value)}
                  rows={3}
                  placeholder="Descrivi di cosa si occupa la comunità e come supporta i cittadini..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isCreatingComm}
                className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isCreatingComm ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Crea e Apri Comunità (500 BRIKO Fondo Iniziale)</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Proporre Iniziativa di Comunità */}
      {isCreateInitiativeOpen && selectedCommunity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="bg-emerald-800 p-5 text-white flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-200" />
                <span>Proponi Iniziativa per {selectedCommunity.name}</span>
              </h3>
              <button onClick={() => setIsCreateInitiativeOpen(false)} className="text-white hover:opacity-80 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInitiativeSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Titolo Iniziativa *</label>
                <input
                  type="text"
                  value={newInitTitle}
                  onChange={(e) => setNewInitTitle(e.target.value)}
                  placeholder="es. Pulizia Parco di Quartiere, Caffè tra Vicini..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Data / Orario Previsto</label>
                <input
                  type="text"
                  value={newInitDate}
                  onChange={(e) => setNewInitDate(e.target.value)}
                  placeholder="es. Sabato 20 Settembre ore 10:00"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Luogo dell'Incontro</label>
                <input
                  type="text"
                  value={newInitLoc}
                  onChange={(e) => setNewInitLoc(e.target.value)}
                  placeholder={`es. ${selectedCommunity.sedeAddress} oppure Parco di Via Roma`}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Descrizione Attività</label>
                <textarea
                  value={newInitDesc}
                  onChange={(e) => setNewInitDesc(e.target.value)}
                  rows={3}
                  placeholder="Spiega cosa farete e come i vicini possono partecipare..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingInit}
                className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingInit ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Pubblica Iniziativa in Comunità</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Genesi di GeoKind & La Storia dei BRIKO */}
      {isGenesisModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200 space-y-0">
            
            <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-6 text-white flex items-center justify-between">
              <div className="space-y-1">
                <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase">
                  📜 Origine & Filosofia
                </span>
                <h3 className="text-xl font-black">Genesi di GeoKind & I BRIKO</h3>
              </div>
              <button onClick={() => setIsGenesisModalOpen(false)} className="text-white hover:opacity-80 p-1 cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                  <span>🧱 1. Che cos'è la Bricazione (BRIKO)?</span>
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nella tradizione del Sud Italia e del mutuo soccorso contadino, la <em>"bricazione"</em> indica il legame di gratitudine e l'impegno morale di contraccambiare un aiuto o un favore ricevuto tra vicini. Non è una moneta speculativa né un mezzo di profitto, ma la misura della generosità reciproca.
                </p>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                  <span>🏛️ 2. Perché Comunità al massimo di 100 Membri?</span>
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  I social media tradizionali disperdono le persone in grandi numeri anonimi. Su <strong>GeoKind</strong>, ogni Comunità Civica ospita un massimo di 100 membri per mantenere la dimensione calda, umana e di quartiere, dove ci si conosce, ci si saluta per strada e ci si può fidare l'un l'altro.
                </p>
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                  <span>🤝 3. Ingresso Garantito e Libertà</span>
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nessuna comunità è un club chiuso o selettivo: finché ci sono posti disponibili nei 100 membri, l'ingresso è immediato in 1-click. I cittadini possono partecipare alla chat di gruppo, inviare messaggi vocali e proporre o partecipare ad iniziative locali.
                </p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-emerald-950 text-xs space-y-1">
                <strong>💡 Nota dell'Autore:</strong> GeoKind nasce per ridare valore al vicinato reale. La tecnologia deve essere solo il mezzo per far incontrare le persone nella vita vera!
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setIsGenesisModalOpen(false)}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-5 py-2 rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Ho Capito, Grazie!
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
