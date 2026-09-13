import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Users, MessageSquare, Plus, Search, Sparkles, Trophy, 
  HeartHandshake, Mic, Send, Volume2, ShieldCheck, Check, MapPin, 
  Store, UserPlus, LogOut, X, Loader2, Award, Play, Pause
} from 'lucide-react';
import { UserProfile, Community, CommunityMessage, AreaSponsor, SponsorInitiative } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, setDoc, query, orderBy } from 'firebase/firestore';

interface CommunityWallProps {
  user: UserProfile | null;
  onSaveProfile?: (updated: Partial<UserProfile>) => void;
}

export const CommunityWall: React.FC<CommunityWallProps> = ({ user, onSaveProfile }) => {
  const [activeSubTab, setActiveSubTab] = useState<'communities' | 'sponsors' | 'stories'>('communities');
  
  // State for Communities
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [searchCommunityQuery, setSearchCommunityQuery] = useState('');
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  
  // Create Community Form
  const [newCommName, setNewCommName] = useState('');
  const [newCommSede, setNewCommSede] = useState('');
  const [newCommComune, setNewCommComune] = useState(() => user?.location?.address?.split(',')[0] || 'Somma Lombardo');
  const [newCommDesc, setNewCommDesc] = useState('');
  const [isCreatingComm, setIsCreatingComm] = useState(false);

  // Community Chat Messages
  const [chatMessages, setChatMessages] = useState<CommunityMessage[]>([]);
  const [inputChatText, setInputChatText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<any>(null);
  const [activeAudioMessageId, setActiveAudioMessageId] = useState<string | null>(null);

  // State for Sponsors & Sponsored Initiatives
  const [sponsors, setSponsors] = useState<AreaSponsor[]>([]);
  const [initiatives, setInitiatives] = useState<SponsorInitiative[]>([]);
  const [isCreateSponsorOpen, setIsCreateSponsorOpen] = useState(false);
  const [isCreateInitiativeOpen, setIsCreateInitiativeOpen] = useState(false);
  
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorCategory, setSponsorCategory] = useState('Commerciante Locale');
  const [sponsorComune, setSponsorComune] = useState(() => user?.location?.address?.split(',')[0] || 'Somma Lombardo');
  const [sponsorBriko, setSponsorBriko] = useState<number>(500);
  const [sponsorMessage, setSponsorMessage] = useState('');
  const [isCreatingSponsor, setIsCreatingSponsor] = useState(false);

  // Form for New Sponsored Initiative
  const [initSponsorName, setInitSponsorName] = useState('Pizzeria & Focacceria Da Domenico');
  const [initTitle, setInitTitle] = useState('');
  const [initCategory, setInitCategory] = useState('Ambiente & Pulizia');
  const [initComune, setInitComune] = useState(() => user?.location?.address?.split(',')[0] || 'Somma Lombardo');
  const [initDesc, setInitDesc] = useState('');
  const [initReward, setInitReward] = useState<number>(100);
  const [initBudget, setInitBudget] = useState<number>(500);
  const [isCreatingInitiative, setIsCreatingInitiative] = useState(false);

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
    }
  ];

  const defaultSponsors: AreaSponsor[] = [
    {
      id: 'spon-1',
      name: 'Pizzeria & Focacceria Da Domenico',
      category: 'Ristorazione & Pizzeria',
      comune: 'Somma Lombardo',
      brikoOffered: 1000,
      message: 'Offriamo 1.000 BRIKO alla comunità locale per incentivare la gentilezza e aiutare i nostri vicini di casa!',
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'spon-2',
      name: 'Biscottificio Lombardo Artigianale',
      category: 'Alimentari & Dolciaria',
      comune: 'Gallarate',
      brikoOffered: 2500,
      message: 'Sosteniamo le buone azioni del territorio finanziando il capitale BRIKO per chi si mette a disposizione degli altri.',
      createdAt: Date.now() - 86400000 * 4,
    }
  ];

  const defaultInitiatives: SponsorInitiative[] = [
    {
      id: 'init-1',
      sponsorId: 'spon-1',
      sponsorName: 'Pizzeria & Focacceria Da Domenico',
      category: 'Ambiente & Verde Civico',
      title: 'Pulizia e Cura del Parco di Somma Lombardo',
      description: 'Offriamo 100 BRIKO a tutti i cittadini che partecipano alla sistemazione e rimozione cartacce nel parco del castello!',
      comune: 'Somma Lombardo',
      brikoRewardPerParticipant: 100,
      totalBrikoBudget: 500,
      brikoRemaining: 400,
      participantsCount: 1,
      createdAt: Date.now() - 86400000 * 1,
    },
    {
      id: 'init-2',
      sponsorId: 'spon-2',
      sponsorName: 'Biscottificio Lombardo Artigianale',
      category: 'Supporto Anziani',
      title: 'Spesa e consegna farmaci per i nonni soli del quartiere',
      description: 'Il Biscottificio premia con 150 BRIKO chiunque offra un passaggio o aiuti un anziano nella spesa settimanale.',
      comune: 'Gallarate',
      brikoRewardPerParticipant: 150,
      totalBrikoBudget: 900,
      brikoRemaining: 750,
      participantsCount: 1,
      createdAt: Date.now() - 86400000 * 2,
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

  // 2. Real-time Firestore sync for Area Sponsors
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onSnapshot(collection(db, 'help_sponsors'), (snap) => {
        const fetched: AreaSponsor[] = [];
        snap.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as AreaSponsor);
        });
        if (fetched.length > 0) {
          setSponsors(fetched);
        } else {
          setSponsors(defaultSponsors);
        }
      }, () => {
        setSponsors(defaultSponsors);
      });
    } catch {
      setSponsors(defaultSponsors);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // 3. Real-time Firestore sync for Sponsored Initiatives
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onSnapshot(collection(db, 'help_sponsor_initiatives'), (snap) => {
        const fetched: SponsorInitiative[] = [];
        snap.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as SponsorInitiative);
        });
        if (fetched.length > 0) {
          setInitiatives(fetched);
        } else {
          setInitiatives(defaultInitiatives);
        }
      }, () => {
        setInitiatives(defaultInitiatives);
      });
    } catch {
      setInitiatives(defaultInitiatives);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // 3. Real-time Firestore listener for selected Community messages
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

  const handleSendTextMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputChatText.trim() || !selectedCommunity || !user) return;
    const textToSend = inputChatText.trim();
    setInputChatText('');

    const newMsg: Omit<CommunityMessage, 'id'> = {
      communityId: selectedCommunity.id,
      senderId: user.id,
      senderNickname: user.nickname,
      text: textToSend,
      createdAt: Date.now(),
    };

    try {
      await addDoc(collection(db, 'help_communities', selectedCommunity.id, 'messages'), newMsg);
    } catch (e) {
      console.warn('Community text message add error:', e);
    }
  };

  // Create Community Submit
  const handleCreateCommunitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommName.trim() || !newCommSede.trim() || !user) return;

    setIsCreatingComm(true);
    const commId = 'comm-' + Date.now();
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

  // Join Community Handler
  const handleJoinCommunity = async (comm: Community) => {
    if (!user) return;
    if (comm.memberCount >= 100) {
      alert('Questa comunità ha raggiunto il limite massimo di 100 membri.');
      return;
    }
    if (comm.members.includes(user.id)) {
      alert('Fai già parte di questa comunità!');
      return;
    }

    const updatedMembers = [...comm.members, user.id];
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
      onSaveProfile({ communityId: comm.id });
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
      onSaveProfile({ communityId: undefined });
    }

    try {
      await updateDoc(doc(db, 'help_communities', comm.id), {
        members: updatedMembers,
        memberNicknames: updatedNicknames,
        memberCount: updatedCount,
      });
    } catch (e) {}
  };

  // Create Sponsor Submit
  const handleCreateSponsorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorName.trim() || !sponsorMessage.trim() || !user) return;

    setIsCreatingSponsor(true);
    const sponsorId = 'sponsor-' + Date.now();
    const newSponsorData: AreaSponsor = {
      id: sponsorId,
      name: sponsorName.trim(),
      category: sponsorCategory,
      comune: sponsorComune.trim(),
      brikoOffered: Number(sponsorBriko) || 500,
      message: sponsorMessage.trim(),
      createdAt: Date.now(),
    };

    try {
      await setDoc(doc(db, 'help_sponsors', sponsorId), newSponsorData);
      setSponsors((prev) => [newSponsorData, ...prev]);
      setIsCreateSponsorOpen(false);
      setSponsorName('');
      setSponsorMessage('');
      alert(`🎉 Grazie! La tua attività '${newSponsorData.name}' ha offerto ${newSponsorData.brikoOffered} BRIKO alla comunità di ${newSponsorData.comune}!`);
    } catch (e) {
      console.error('Create sponsor error:', e);
    } finally {
      setIsCreatingSponsor(false);
    }
  };

  // Create Sponsored Initiative Submit
  const handleCreateInitiativeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initTitle.trim() || !initDesc.trim() || !user) return;

    setIsCreatingInitiative(true);
    const initId = 'init-' + Date.now();
    const newInitiative: SponsorInitiative = {
      id: initId,
      sponsorId: 'spon-user-' + user.id,
      sponsorName: initSponsorName.trim() || 'Sponsor Civico ' + user.nickname,
      category: initCategory,
      title: initTitle.trim(),
      description: initDesc.trim(),
      comune: initComune.trim(),
      brikoRewardPerParticipant: Number(initReward) || 100,
      totalBrikoBudget: Number(initBudget) || 500,
      brikoRemaining: Number(initBudget) || 500,
      participantsCount: 0,
      createdAt: Date.now(),
    };

    try {
      await setDoc(doc(db, 'help_sponsor_initiatives', initId), newInitiative);
      setInitiatives((prev) => [newInitiative, ...prev]);
      setIsCreateInitiativeOpen(false);
      setInitTitle('');
      setInitDesc('');
      alert(`🌟 Campagna di Buona Azione Creata! '${newInitiative.title}' con budget di ${newInitiative.totalBrikoBudget} BRIKO in palio per la comunità!`);
    } catch (err) {
      console.error('Error creating initiative:', err);
    } finally {
      setIsCreatingInitiative(false);
    }
  };

  // Claim Sponsored Initiative Reward
  const handleClaimInitiativeReward = async (init: SponsorInitiative) => {
    if (!user) {
      alert('Effettua prima l\'accesso per partecipare ed accreditarti i BRIKO.');
      return;
    }
    if (init.brikoRemaining < init.brikoRewardPerParticipant) {
      alert('Questa iniziativa ha esaurito il budget BRIKO messo a disposizione dallo sponsor!');
      return;
    }

    const reward = init.brikoRewardPerParticipant;
    const newRemaining = init.brikoRemaining - reward;
    const newParticipants = init.participantsCount + 1;

    // Update local user profile BRIKO balance
    const updatedUserCredits = (user.credits ?? 100) + reward;
    if (onSaveProfile) {
      onSaveProfile({ credits: updatedUserCredits });
    }

    // Update initiative document
    setInitiatives((prev) =>
      prev.map((i) =>
        i.id === init.id
          ? { ...i, brikoRemaining: newRemaining, participantsCount: newParticipants }
          : i
      )
    );

    try {
      await updateDoc(doc(db, 'help_sponsor_initiatives', init.id), {
        brikoRemaining: newRemaining,
        participantsCount: newParticipants,
      });
      alert(`🎉 Congratulazioni ${user.nickname}! Hai completato la buona azione per '${init.title}' ed hai guadagnato +${reward} BRIKO dallo Sponsor ${init.sponsorName}! Il tuo nuovo saldo è di ${updatedUserCredits} BRIKO.`);
    } catch (e) {
      console.warn('Update initiative error:', e);
    }
  };

  const filteredCommunities = communities.filter((c) => {
    if (!searchCommunityQuery.trim()) return true;
    const q = searchCommunityQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.comune.toLowerCase().includes(q) ||
      c.sedeAddress.toLowerCase().includes(q)
    );
  });

  const totalSponsorBriko = sponsors.reduce((acc, s) => acc + (s.brikoOffered || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Hero Banner with BRIKO currency context */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="max-w-3xl space-y-4 relative z-10">
          <div className="inline-flex items-center space-x-2 bg-emerald-700/80 border border-emerald-400/40 px-3.5 py-1 rounded-full text-xs font-bold">
            <span>🧱 Bricazioni della Gentilezza (BRIKO)</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight font-sans">
            Comunità Civiche & Sponsor di Area BRIKO
          </h1>
          <p className="text-emerald-100 text-sm sm:text-base leading-relaxed">
            Nel Sud e nella tradizione italiana la <em>bricazione (BRIKO)</em> rappresenta il valore di un aiuto o un debito di gratitudine. 
            <strong> Ogni nuovo cittadino riceve subito 100 BRIKO regalati dalla piattaforma al primo ingresso</strong>. Gli altri BRIKO si guadagnano aiutando i vicini!
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => setIsCreateCommunityOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center space-x-2 cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              <span>+ Fonda una Nuova Comunità</span>
            </button>
            <button
              onClick={() => setIsCreateSponsorOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition-all shadow-md flex items-center space-x-2 cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>🏬 Diventa Sponsor di Area (Offri BRIKO)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Sub-tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('communities')}
          className={`flex-1 min-w-[150px] py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeSubTab === 'communities'
              ? 'bg-emerald-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Comunità Civiche ({communities.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('sponsors')}
          className={`flex-1 min-w-[150px] py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeSubTab === 'sponsors'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Sponsor di Area ({sponsors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('stories')}
          className={`flex-1 min-w-[150px] py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
            activeSubTab === 'stories'
              ? 'bg-teal-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Storie & Classifica BRIKO</span>
        </button>
      </div>

      {/* SUB-TAB 1: COMMUNITIES */}
      {activeSubTab === 'communities' && (
        <div className="space-y-6">
          
          {/* Rules Banner for Communities */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-1">
              <div className="font-extrabold text-sm text-emerald-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Regolamento Comunità Civiche GEOKIND:</span>
              </div>
              <p className="text-emerald-800 leading-relaxed">
                • <strong>Capacità massima: 100 membri</strong> per comunità per preservare lo spirito di vicinato.<br />
                • <strong>Ingresso Libero e Garantito:</strong> nessuno può rifiutare l'entrata di un nuovo cittadino.<br />
                • Ogni comunità dispone di una <strong>Chat di Gruppo dedicata con Messaggi e Vocali</strong> e una tesoreria in BRIKO!
              </p>
            </div>
            <button
              onClick={() => setIsCreateCommunityOpen(true)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shrink-0 cursor-pointer shadow-xs"
            >
              + Fondane una Tu
            </button>
          </div>

          {/* Search bar for communities */}
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

          {/* List of Communities & Active Community View */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col: Community Cards */}
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Comunità Disponibili ({filteredCommunities.length})</span>
              </h3>

              <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                {filteredCommunities.map((comm) => {
                  const isMember = user ? comm.members?.includes(user.id) : false;
                  const isSelected = selectedCommunity?.id === comm.id;

                  return (
                    <div
                      key={comm.id}
                      onClick={() => setSelectedCommunity(comm)}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 relative overflow-hidden ${
                        isSelected
                          ? 'bg-emerald-900 text-white border-emerald-700 shadow-lg ring-2 ring-emerald-500'
                          : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {comm.comune}
                          </span>
                          <h4 className={`text-base font-extrabold mt-1.5 leading-snug ${
                            isSelected ? 'text-white' : 'text-slate-900'
                          }`}>
                            {comm.name}
                          </h4>
                        </div>
                        {isMember && (
                          <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 shadow-xs">
                            Membro ✓
                          </span>
                        )}
                      </div>

                      <div className={`text-xs space-y-1 ${isSelected ? 'text-emerald-100' : 'text-slate-600'}`}>
                        <div className="flex items-center gap-1.5 font-medium">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{comm.sedeAddress}</span>
                        </div>
                        <p className="line-clamp-2 text-[11px] leading-relaxed pt-1 opacity-90">
                          {comm.description}
                        </p>
                      </div>

                      <div className={`pt-3 border-t flex items-center justify-between text-xs font-bold ${
                        isSelected ? 'border-emerald-800 text-emerald-200' : 'border-slate-100 text-slate-600'
                      }`}>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>{comm.memberCount} / 100 membri</span>
                        </span>
                        <span className="flex items-center gap-1 text-amber-500">
                          <span>🧱</span>
                          <span>{comm.brikoTreasury || 500} BRIKO</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Col: Community Details & Live Chat */}
            <div className="lg:col-span-2">
              {selectedCommunity ? (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 space-y-6">
                  
                  {/* Community Header */}
                  <div className="bg-gradient-to-r from-emerald-800 to-teal-800 text-white rounded-2xl p-6 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="bg-emerald-600/80 border border-emerald-400/40 text-emerald-100 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        {selectedCommunity.comune}
                      </span>
                      <span className="text-xs text-emerald-200">
                        Fondatore: <strong>{selectedCommunity.founderNickname}</strong>
                      </span>
                    </div>

                    <h2 className="text-2xl font-black">{selectedCommunity.name}</h2>
                    
                    <div className="flex items-center gap-2 text-xs text-emerald-100 bg-emerald-900/50 p-2.5 rounded-xl border border-emerald-700/50">
                      <MapPin className="w-4 h-4 text-emerald-300 shrink-0" />
                      <span><strong>Sede Ufficiale:</strong> {selectedCommunity.sedeAddress}</span>
                    </div>

                    <p className="text-xs text-emerald-100 leading-relaxed pt-1">
                      {selectedCommunity.description}
                    </p>

                    {/* Member status & Actions */}
                    <div className="pt-3 border-t border-emerald-700/60 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="bg-emerald-900/80 px-3 py-1.5 rounded-lg border border-emerald-600 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-emerald-300" />
                          <span>Capacità: {selectedCommunity.memberCount} / 100 Membri</span>
                        </span>
                        <span className="bg-amber-500/20 text-amber-200 border border-amber-400/30 px-3 py-1.5 rounded-lg flex items-center gap-1">
                          <span>🧱 Tesoreria:</span>
                          <strong className="text-amber-300">{selectedCommunity.brikoTreasury || 500} BRIKO</strong>
                        </span>
                      </div>

                      {user && selectedCommunity.members.includes(user.id) ? (
                        <button
                          onClick={() => handleLeaveCommunity(selectedCommunity)}
                          className="bg-red-500/80 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Esci dalla Comunità</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJoinCommunity(selectedCommunity)}
                          disabled={selectedCommunity.memberCount >= 100}
                          className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>Unisciti alla Comunità (Aperto a tutti)</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Community Chat Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-emerald-600" />
                        <span>Chat di Comunità (Gruppo Incontro)</span>
                      </h3>
                      <span className="text-xs text-slate-500">
                        {chatMessages.length} messaggi
                      </span>
                    </div>

                    {/* Chat messages stream */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 h-80 overflow-y-auto space-y-3">
                      {chatMessages.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-xs space-y-2">
                          <MessageSquare className="w-8 h-8 mx-auto opacity-40 text-emerald-600" />
                          <p className="font-semibold text-slate-600">Nessun messaggio ancora inviato in questa comunità.</p>
                          <p className="text-[11px]">Invia il primo messaggio o registra un vocale per salutare i tuoi vicini!</p>
                        </div>
                      ) : (
                        chatMessages.map((msg) => {
                          const isMine = user ? msg.senderId === user.id : false;

                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                            >
                              <div className="text-[10px] text-slate-500 font-bold mb-1 px-1">
                                {msg.senderNickname} • {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>

                              <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs font-medium space-y-1 shadow-2xs ${
                                  isMine
                                    ? 'bg-emerald-700 text-white rounded-br-none'
                                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                                }`}
                              >
                                <div>{msg.text}</div>

                                {/* Audio Player if audioUrl exists */}
                                {msg.audioUrl && (
                                  <div className={`pt-2 border-t mt-1.5 flex items-center space-x-2 ${
                                    isMine ? 'border-emerald-600' : 'border-slate-100'
                                  }`}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (activeAudioMessageId === msg.id) {
                                          setActiveAudioMessageId(null);
                                        } else {
                                          setActiveAudioMessageId(msg.id);
                                          const audio = new Audio(msg.audioUrl);
                                          audio.play();
                                          audio.onended = () => setActiveAudioMessageId(null);
                                        }
                                      }}
                                      className={`p-1.5 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer ${
                                        isMine ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                      }`}
                                    >
                                      {activeAudioMessageId === msg.id ? (
                                        <Pause className="w-3.5 h-3.5" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5 ml-0.5" />
                                      )}
                                    </button>
                                    <div className="flex-1 space-y-0.5">
                                      <div className="text-[10px] font-bold">
                                        Vocale Wappino Interno ({msg.audioDuration || 3}s)
                                      </div>
                                      <div className={`h-1 rounded-full overflow-hidden ${isMine ? 'bg-emerald-800' : 'bg-slate-200'}`}>
                                        <div
                                          className={`h-full ${isMine ? 'bg-amber-300' : 'bg-emerald-600'} ${
                                            activeAudioMessageId === msg.id ? 'w-full transition-all duration-3000' : 'w-1/3'
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Chat Input Controls */}
                    {isRecordingVoice ? (
                      <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-3 flex items-center justify-between animate-pulse">
                        <div className="flex items-center space-x-3 text-red-900 text-xs font-bold">
                          <Mic className="w-5 h-5 text-red-600 animate-bounce" />
                          <span>Registrazione Vocale in corso... ({recordingSeconds} sec)</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleStopRecordingAndSend}
                          className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md cursor-pointer"
                        >
                          Invia Vocale 🎤
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSendTextMessage} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={inputChatText}
                          onChange={(e) => setInputChatText(e.target.value)}
                          placeholder="Scrivi un messaggio per la comunità..."
                          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />

                        <button
                          type="button"
                          onClick={handleStartRecording}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center space-x-1 shadow-md shrink-0 active:scale-95"
                          title="Registra ed invia un messaggio vocale alla comunità"
                        >
                          <Mic className="w-4 h-4 text-emerald-200 animate-pulse" />
                          <span className="hidden sm:inline">Vocale 🎤</span>
                        </button>

                        <button
                          type="submit"
                          disabled={!inputChatText.trim()}
                          className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Invia</span>
                        </button>
                      </form>
                    )}

                  </div>

                </div>
              ) : (
                <div className="bg-slate-50 rounded-3xl border border-slate-200 p-12 text-center space-y-3">
                  <Building2 className="w-12 h-12 text-emerald-600/40 mx-auto" />
                  <h3 className="text-base font-bold text-slate-800">Seleziona una Comunità Civica</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Clicca su una comunità a sinistra per consultare la sede, i membri ed entrare nella chat di gruppo condivisa!
                  </p>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* SUB-TAB 2: SPONSORS */}
      {activeSubTab === 'sponsors' && (
        <div className="space-y-6">
          
          {/* Sponsor Banner */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center space-x-2 bg-amber-800/60 border border-amber-300/40 px-3 py-1 rounded-full text-xs font-bold">
                <Store className="w-4 h-4 text-amber-200" />
                <span>Incrementa il Capitale BRIKO del tuo Territorio</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold">Sponsor di Area & Commercianti</h2>
              <p className="text-amber-100 text-xs sm:text-sm leading-relaxed">
                Negozi, pizzerie, farmacie e aziende locali possono acquistare pacchetti BRIKO da offrire ai cittadini del quartiere. Ogni BRIKO donato finanzia e premia le buone azioni del vicinato!
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-center shrink-0 min-w-[220px]">
              <div className="text-[11px] font-bold text-amber-100 uppercase tracking-wider">Capitale BRIKO Donato</div>
              <div className="text-3xl font-black text-white mt-1">🧱 {totalSponsorBriko.toLocaleString()} BRIKO</div>
              <div className="mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => setIsCreateSponsorOpen(true)}
                  className="w-full bg-white text-amber-900 font-bold py-2 px-3 rounded-xl text-xs transition-all hover:bg-amber-50 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Store className="w-4 h-4 text-amber-600" />
                  <span>+ Offri BRIKO come Sponsor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateInitiativeOpen(true)}
                  className="w-full bg-amber-400 text-slate-950 font-black py-2 px-3 rounded-xl text-xs transition-all hover:bg-amber-300 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-slate-900" />
                  <span>+ Crea Iniziativa col tuo Budget BRIKO</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECTION: Sponsored Initiatives / Esigenze di Buone Azioni lanciate dagli Sponsor */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <span>Esigenze & Iniziative di Buone Azioni Sponsorizzate</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Gli sponsor usano i loro BRIKO acquistati per premiare direttamente i cittadini che eseguono buone azioni per la comunità!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateInitiativeOpen(true)}
                className="hidden sm:flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
              >
                <span>+ Pubblica Esigenza Sponsorizzata</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {initiatives.map((init) => (
                <div
                  key={init.id}
                  className="bg-white rounded-2xl border-2 border-amber-200/80 shadow-md p-6 space-y-4 relative overflow-hidden hover:border-amber-400 transition-all"
                >
                  <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                    Sponsorizzato • {init.comune}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-md">
                      {init.category}
                    </span>
                    <h4 className="text-lg font-black text-slate-900 pt-1 leading-snug">{init.title}</h4>
                    <div className="text-xs font-bold text-slate-600 flex items-center gap-1">
                      <span>Proposto da Sponsor:</span>
                      <strong className="text-amber-700">{init.sponsorName}</strong>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {init.description}
                  </p>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[10px] text-amber-800 font-bold uppercase">Ricompensa a Cittadino</div>
                      <div className="text-base font-black text-amber-700">🧱 +{init.brikoRewardPerParticipant} BRIKO</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Budget Rimanente</div>
                      <div className="text-xs font-extrabold text-slate-800">
                        {init.brikoRemaining} / {init.totalBrikoBudget} BRIKO
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleClaimInitiativeReward(init)}
                    disabled={init.brikoRemaining < init.brikoRewardPerParticipant}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-black py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                  >
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Partecipa & Guadagna +{init.brikoRewardPerParticipant} BRIKO</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Registered Area Sponsors Grid */}
          <div className="space-y-4 pt-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-600" />
              <span>Attività & Sponsor Registrati ({sponsors.length})</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sponsors.map((spon) => (
                <div key={spon.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-base border border-amber-200 shrink-0">
                        🏪
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-slate-900">{spon.name}</h4>
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {spon.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 leading-relaxed italic border border-slate-100">
                    "{spon.message}"
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      <span>{spon.comune}</span>
                    </span>
                    <span className="font-extrabold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      🧱 {spon.brikoOffered} BRIKO Donati
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* SUB-TAB 3: STORIES & LEADERBOARD */}
      {activeSubTab === 'stories' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Stories list */}
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

      {/* MODAL: Fondare una Comunità */}
      {isCreateCommunityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="bg-emerald-700 p-5 text-white flex items-center justify-between">
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
                <strong>Regola di Trasparenza:</strong> La comunità può ospitare fino a <strong>massimo 100 membri</strong>. L'entrata è libera e nessuno può rifiutare l'ingresso di un nuovo membro finché c'è posto.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Nome della Comunità *</label>
                <input
                  type="text"
                  value={newCommName}
                  onChange={(e) => setNewCommName(e.target.value)}
                  placeholder="es. Comunità Civica Somma Centro e Stazione"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Sede Comune e Indirizzo *</label>
                <input
                  type="text"
                  value={newCommSede}
                  onChange={(e) => setNewCommSede(e.target.value)}
                  placeholder="es. Corso Repubblica 12 (presso Centro Civico)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Comune *</label>
                <input
                  type="text"
                  value={newCommComune}
                  onChange={(e) => setNewCommComune(e.target.value)}
                  placeholder="es. Somma Lombardo, Milano, Gallarate..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Descrizione / Scopo della Comunità</label>
                <textarea
                  value={newCommDesc}
                  onChange={(e) => setNewCommDesc(e.target.value)}
                  rows={3}
                  placeholder="Descrivi di cosa si occupa la comunità e come supporta i cittadini..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isCreatingComm}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isCreatingComm ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Crea e Apri Comunità (500 BRIKO Fondo Iniziale)</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Offrire BRIKO come Sponsor */}
      {isCreateSponsorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="bg-amber-600 p-5 text-white flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Store className="w-5 h-5 text-amber-200" />
                <span>Diventa Sponsor di Area BRIKO</span>
              </h3>
              <button onClick={() => setIsCreateSponsorOpen(false)} className="text-white hover:opacity-80 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSponsorSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Nome Attività / Insegna / Azienda *</label>
                <input
                  type="text"
                  value={sponsorName}
                  onChange={(e) => setSponsorName(e.target.value)}
                  placeholder="es. Pizzeria Da Gino, Farmacia Centrale..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Categoria Commerciale</label>
                <select
                  value={sponsorCategory}
                  onChange={(e) => setSponsorCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="Ristorazione & Pizzeria">Ristorazione & Pizzeria</option>
                  <option value="Alimentari & Supermercato">Alimentari & Supermercato</option>
                  <option value="Farmacia & Salute">Farmacia & Salute</option>
                  <option value="Commerciante Locale">Commerciante Locale</option>
                  <option value="Azienda del Territorio">Azienda del Territorio</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Comune di Riferimento *</label>
                <input
                  type="text"
                  value={sponsorComune}
                  onChange={(e) => setSponsorComune(e.target.value)}
                  placeholder="es. Somma Lombardo, Gallarate, Milano..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Quantità di BRIKO Acquistati & Offerti *</label>
                <select
                  value={sponsorBriko}
                  onChange={(e) => setSponsorBriko(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value={500}>🧱 500 BRIKO (Pacchetto Base)</option>
                  <option value={1000}>🧱 1.000 BRIKO (Pacchetto Quartiere)</option>
                  <option value={2500}>🧱 2.500 BRIKO (Pacchetto Cittadino)</option>
                  <option value={5000}>🧱 5.000 BRIKO (Sponsor Ufficiale)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Messaggio alla Comunità *</label>
                <textarea
                  value={sponsorMessage}
                  onChange={(e) => setSponsorMessage(e.target.value)}
                  rows={3}
                  placeholder="es. Sosteniamo i nostri vicini finanziando la rete di aiuti di quartiere!"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isCreatingSponsor}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isCreatingSponsor ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Conferma Offerta Sponsor ({sponsorBriko} BRIKO)</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Creare una Campagna / Esigenza di Buona Azione col Budget BRIKO dello Sponsor */}
      {isCreateInitiativeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-5 text-white flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-200" />
                <span>Pubblica Iniziativa Sponsorizzata BRIKO</span>
              </h3>
              <button onClick={() => setIsCreateInitiativeOpen(false)} className="text-white hover:opacity-80 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInitiativeSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-950 leading-relaxed">
                <strong>Come funziona:</strong> Metti a disposizione il tuo budget BRIKO acquistato come Sponsor per finanziare e premiare i cittadini che eseguono buone azioni concrete per la comunità!
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Nome Sponsor / Insegna *</label>
                <input
                  type="text"
                  value={initSponsorName}
                  onChange={(e) => setInitSponsorName(e.target.value)}
                  placeholder="es. Pizzeria Da Domenico"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Titolo della Buona Azione Richiesta *</label>
                <input
                  type="text"
                  value={initTitle}
                  onChange={(e) => setInitTitle(e.target.value)}
                  placeholder="es. Pulizia Parco Comunale o Assistenza Anziani"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Categoria Iniziativa</label>
                <select
                  value={initCategory}
                  onChange={(e) => setInitCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="Ambiente & Verde Civico">Ambiente & Verde Civico</option>
                  <option value="Supporto Anziani">Supporto Anziani</option>
                  <option value="Assistenza & Spesa">Assistenza & Spesa</option>
                  <option value="Doposcuola & Studio">Doposcuola & Studio</option>
                  <option value="Condivisione Attrezzi">Condivisione Attrezzi</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Comune *</label>
                <input
                  type="text"
                  value={initComune}
                  onChange={(e) => setInitComune(e.target.value)}
                  placeholder="es. Somma Lombardo, Gallarate..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Descrizione Iniziativa *</label>
                <textarea
                  value={initDesc}
                  onChange={(e) => setInitDesc(e.target.value)}
                  rows={3}
                  placeholder="Spiega cosa devono fare i cittadini e come verrà accreditata la ricompensa BRIKO..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Premio a Partecipante *</label>
                  <select
                    value={initReward}
                    onChange={(e) => setInitReward(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value={50}>🧱 +50 BRIKO</option>
                    <option value={100}>🧱 +100 BRIKO</option>
                    <option value={150}>🧱 +150 BRIKO</option>
                    <option value={200}>🧱 +200 BRIKO</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider">Budget Totale *</label>
                  <select
                    value={initBudget}
                    onChange={(e) => setInitBudget(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-bold text-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value={500}>🧱 500 BRIKO</option>
                    <option value={1000}>🧱 1.000 BRIKO</option>
                    <option value={2500}>🧱 2.500 BRIKO</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreatingInitiative}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isCreatingInitiative ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Lancia Iniziativa e Metti in Palio {initBudget} BRIKO</span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
