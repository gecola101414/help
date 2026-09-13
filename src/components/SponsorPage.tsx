import React, { useState, useEffect } from 'react';
import { 
  Store, Award, Sparkles, MapPin, Check, X, Loader2, Plus
} from 'lucide-react';
import { UserProfile, AreaSponsor, SponsorInitiative } from '../types';
import { ComuneAutocompleteInput } from './ComuneAutocompleteInput';
import { resolveAddressGeocode } from '../services/comuniService';
import { db } from '../lib/firebase';
import { collection, onSnapshot, setDoc, doc, updateDoc } from 'firebase/firestore';

interface SponsorPageProps {
  user: UserProfile | null;
  sponsors?: AreaSponsor[];
  setSponsors?: React.Dispatch<React.SetStateAction<AreaSponsor[]>>;
  initiatives?: SponsorInitiative[];
  setInitiatives?: React.Dispatch<React.SetStateAction<SponsorInitiative[]>>;
  onSaveProfile?: (updated: Partial<UserProfile>) => void;
}

export const SponsorPage: React.FC<SponsorPageProps> = ({ 
  user, 
  sponsors: externalSponsors,
  setSponsors: setExternalSponsors,
  initiatives: externalInitiatives,
  setInitiatives: setExternalInitiatives,
  onSaveProfile 
}) => {
  // State for Sponsors & Sponsored Initiatives
  const [localSponsors, setLocalSponsors] = useState<AreaSponsor[]>([]);
  const [localInitiatives, setLocalInitiatives] = useState<SponsorInitiative[]>([]);

  const sponsors = externalSponsors || localSponsors;
  const setSponsors = setExternalSponsors || setLocalSponsors;
  const initiatives = externalInitiatives || localInitiatives;
  const setInitiatives = setExternalInitiatives || setLocalInitiatives;

  const [isCreateSponsorOpen, setIsCreateSponsorOpen] = useState(false);
  const [isCreateInitiativeOpen, setIsCreateInitiativeOpen] = useState(false);
  
  // Create Sponsor Form State
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorCategory, setSponsorCategory] = useState('Commerciante Locale');
  const [sponsorComune, setSponsorComune] = useState(() => (user?.location?.address && user.location.address !== 'Posizione non condivisa' ? user.location.address.split(',')[0] : ''));
  const [sponsorBriko, setSponsorBriko] = useState<number>(500);
  const [sponsorMessage, setSponsorMessage] = useState('');
  const [isCreatingSponsor, setIsCreatingSponsor] = useState(false);

  // Create Sponsored Initiative Form State
  const [initSponsorName, setInitSponsorName] = useState('');
  const [initTitle, setInitTitle] = useState('');
  const [initCategory, setInitCategory] = useState('Ambiente & Verde Civico');
  const [initComune, setInitComune] = useState(() => (user?.location?.address && user.location.address !== 'Posizione non condivisa' ? user.location.address.split(',')[0] : ''));
  const [initDesc, setInitDesc] = useState('');
  const [initReward, setInitReward] = useState<number>(100);
  const [initBudget, setInitBudget] = useState<number>(500);
  const [isCreatingInitiative, setIsCreatingInitiative] = useState(false);

  // Default initial demo data
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

  // Real-time Firestore sync for Area Sponsors
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

  // Real-time Firestore sync for Sponsored Initiatives
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

  // Create Sponsor Submit
  const handleCreateSponsorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorName.trim() || !sponsorMessage.trim() || !user) return;

    setIsCreatingSponsor(true);
    const sponsorId = 'sponsor-' + Date.now();
    const geo = await resolveAddressGeocode(sponsorComune.trim(), sponsorName.trim());

    const newSponsorData: AreaSponsor = {
      id: sponsorId,
      name: sponsorName.trim(),
      category: sponsorCategory,
      comune: sponsorComune.trim(),
      brikoOffered: Number(sponsorBriko) || 500,
      message: sponsorMessage.trim(),
      createdAt: Date.now(),
      location: {
        lat: geo.lat || 45.6836,
        lng: geo.lng || 8.7071,
        address: `${sponsorName.trim()}, ${sponsorComune.trim()}`
      }
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
    const geo = await resolveAddressGeocode(initComune.trim(), initTitle.trim());

    const newInitiative: SponsorInitiative = {
      id: initId,
      sponsorId: 'spon-user-' + user.id,
      sponsorName: initSponsorName.trim() || 'Sponsor ' + (sponsorName || user.nickname),
      category: initCategory,
      title: initTitle.trim(),
      description: initDesc.trim(),
      comune: initComune.trim(),
      brikoRewardPerParticipant: Number(initReward) || 100,
      totalBrikoBudget: Number(initBudget) || 500,
      brikoRemaining: Number(initBudget) || 500,
      participantsCount: 0,
      createdAt: Date.now(),
      location: {
        lat: geo.lat || 45.6836,
        lng: geo.lng || 8.7071,
        address: `${initTitle.trim()}, ${initComune.trim()}`
      }
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
      alert("Effettua prima l'accesso per partecipare ed accreditarti i BRIKO.");
      return;
    }
    if (init.brikoRemaining < init.brikoRewardPerParticipant) {
      alert('Questa iniziativa ha esaurito il budget BRIKO messo a disposizione dallo sponsor!');
      return;
    }

    const reward = init.brikoRewardPerParticipant;
    const newRemaining = init.brikoRemaining - reward;
    const newParticipants = init.participantsCount + 1;

    const updatedUserCredits = (user.credits ?? 100) + reward;
    if (onSaveProfile) {
      onSaveProfile({ credits: updatedUserCredits });
    }

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

  const totalSponsorBriko = sponsors.reduce((acc, curr) => acc + (curr.brikoOffered || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Sponsor Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center space-x-2 bg-amber-900/60 border border-amber-300/40 px-3 py-1 rounded-full text-xs font-bold">
            <Store className="w-4 h-4 text-amber-200" />
            <span>Sostenitori & Attività Commerciali del Territorio</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight">Sponsor di Area & Commercianti</h1>
          <p className="text-amber-100 text-xs sm:text-sm leading-relaxed">
            Negozi, pizzerie, farmacie e aziende locali acquistano ed offrono pacchetti BRIKO per finanziare la rete di mutuo soccorso del quartiere. Mettendo in palio il proprio budget BRIKO, gli sponsor premano direttamente i cittadini che compiono buone azioni concrete!
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 text-center shrink-0 min-w-[240px]">
          <div className="text-[11px] font-bold text-amber-100 uppercase tracking-wider">Capitale BRIKO Donato dagli Sponsor</div>
          <div className="text-3xl font-black text-white mt-1">🧱 {totalSponsorBriko.toLocaleString()} BRIKO</div>
          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => setIsCreateSponsorOpen(true)}
              className="w-full bg-white text-amber-900 font-extrabold py-2.5 px-3 rounded-xl text-xs transition-all hover:bg-amber-50 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              <Store className="w-4 h-4 text-amber-600" />
              <span>+ Diventa Sponsor di Area</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreateInitiativeOpen(true)}
              className="w-full bg-amber-400 text-slate-950 font-black py-2.5 px-3 rounded-xl text-xs transition-all hover:bg-amber-300 cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-slate-900" />
              <span>+ Lancia Iniziativa BRIKO</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: Sponsored Initiatives / Esigenze di Buone Azioni finanziate dagli Sponsor */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Award className="w-6 h-6 text-amber-500" />
              <span>Esigenze & Iniziative Sponsorizzate (Guadagna BRIKO)</span>
            </h2>
            <p className="text-xs text-slate-500">
              Iniziative di utilità pubblica financiate dagli sponsor: svolgi l'azione richiesta ed accredita i BRIKO nel tuo portafoglio.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateInitiativeOpen(true)}
            className="self-start sm:self-auto bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-xs flex items-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>Pubblica Esigenza Sponsorizzata</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {initiatives.map((init) => (
            <div
              key={init.id}
              className="bg-white rounded-2xl border-2 border-amber-200 shadow-sm p-6 space-y-4 relative overflow-hidden hover:border-amber-400 transition-all"
            >
              <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                Sponsorizzato • {init.comune}
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-md">
                  {init.category}
                </span>
                <h3 className="text-lg font-black text-slate-900 pt-1 leading-snug">{init.title}</h3>
                <div className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <span>Proposto dallo Sponsor:</span>
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

      {/* SECTION 2: Registered Area Sponsors Grid */}
      <div className="space-y-4 pt-6 border-t border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Store className="w-5 h-5 text-amber-600" />
          <span>Attività Commerciali & Sponsor Registrati ({sponsors.length})</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sponsors.map((spon) => (
            <div key={spon.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-base border border-amber-200 shrink-0">
                    🏪
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{spon.name}</h3>
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

              <ComuneAutocompleteInput
                label="Comune di Riferimento *"
                value={sponsorComune}
                onChange={(comuneName) => setSponsorComune(comuneName)}
                placeholder="Digita e seleziona comune (es. Milano, Gallarate, Roma...)"
                required
              />

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

              <ComuneAutocompleteInput
                label="Comune *"
                value={initComune}
                onChange={(comuneName) => setInitComune(comuneName)}
                placeholder="Digita e seleziona comune (es. Milano, Gallarate...)"
                required
              />

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
