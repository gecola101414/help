export interface UserProfile {
  id: string;
  nickname: string;
  passcode?: string; // Codice segreto per accreditamento auto-gestito (es. Nome+6cifre)
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  offers: string[]; // what this user offers to help with
  requests: string[]; // current requests or needs
  credits: number; // BRIKO balance (Inizia con 100 BRIKO offerti dalla piattaforma)
  rating: number;
  helpedCount: number;
  karma: number; // Solidarietà Karma score
  communityId?: string; // ID della comunità di appartenenza primaria
  communityIds?: string[]; // IDs di tutte le comunità a cui l'utente è iscritto (max 5)
  createdAt: number;
}

export interface AreaSponsor {
  id: string;
  name: string;
  category: string; // e.g. "Pizzeria & Ristorante", "Biscottificio", "Supermercato", "Commerciante Locale"
  comune: string;
  address?: string;
  logoUrl?: string;
  brikoOffered: number; // BRIKO acqisiti e offerti alla comunità
  message: string;
  createdAt: number;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
}

export interface SponsorInitiative {
  id: string;
  sponsorId: string;
  sponsorName: string;
  category: string;
  title: string;
  description: string;
  comune: string;
  brikoRewardPerParticipant: number; // Ricompensa in BRIKO dallo sponsor a chi completa l'azione
  totalBrikoBudget: number; // Budget BRIKO allocato dallo sponsor
  brikoRemaining: number;
  participantsCount: number;
  createdAt: number;
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
}

export interface Community {
  id: string;
  name: string;
  sedeAddress: string;
  comune: string;
  description: string;
  founderId: string;
  founderNickname: string;
  members: string[]; // List of userIds (max 100)
  memberNicknames?: string[];
  memberCount: number; // Max 100
  brikoTreasury: number; // Fondo BRIKO di comunità
  createdAt: number;
  actionRadiusKm?: number; // Raggio d'influenza territoriale (Max 10 km)
  location?: {
    lat: number;
    lng: number;
    address: string;
  };
}

export interface CommunityInitiative {
  id: string;
  communityId: string;
  title: string;
  description: string;
  organizerId: string;
  organizerNickname: string;
  dateStr: string;
  locationStr: string;
  participants: string[];
  createdAt: number;
}

// Helper to check if a community has expired (30 days without reaching 10 members)
export function isCommunityExpired(community: Community): boolean {
  if (!community || !community.createdAt) return false;
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000; // 30 Giorni (1 mese)
  const age = Date.now() - community.createdAt;
  const count = typeof community.memberCount === 'number' 
    ? community.memberCount 
    : (community.members ? community.members.length : 0);
  
  // Se ha superato i 30 giorni (1 mese) E ha meno di 10 membri -> Scade e scompare
  return age >= ONE_MONTH_MS && count < 10;
}

export interface CommunityMessage {
  id: string;
  communityId: string;
  senderId: string;
  senderNickname: string;
  text: string;
  audioUrl?: string;
  audioDuration?: number;
  createdAt: number;
}

export type HelpType = 'offer' | 'request';

export interface HelpItem {
  id: string;
  userId: string;
  userNickname: string;
  type: HelpType; // 'offer' (metto a disposizione) or 'request' (ho bisogno)
  title: string;
  description: string;
  category: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  distanceKm?: number;
  trackingType?: 'dynamic' | 'static'; // 'dynamic' (segue la persona via GPS) oppure 'static' (fissato a un luogo/comune/via)
  staticLocation?: {
    comune: string;
    via?: string;
    civico?: string;
    formattedAddress: string;
  };
  customCoords?: {
    lat: number;
    lng: number;
  };
  actionRadiusKm?: number; // Raggio d'azione/influenza (entro cui bisogna passare/trovarsi per visualizzarlo)
  durationMinutes?: number; // Durata dell'annuncio (da 10 min a 24 ore)
  valoreGentilezzaBriko?: number; // Valore della gentilezza (0 - 100 BRIKO) stabilito da chi la offre/richiede
  targetCommunityIds?: string[]; // Se la gentilezza è aperta a tutti ([]/undefined) o dedicata a specifiche comunità civiche dell'utente
  sponsorId?: string; // Se è una richiesta/iniziativa creata o sostenuta da uno Sponsor con montepremi BRIKO
  sponsorName?: string;
  creditsRequired: number; // 0 for free, >0 if needs credits
  isFree: boolean;
  status: 'active' | 'in_progress' | 'completed' | 'cancelled';
  helperId?: string;
  helperNickname?: string;
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  helpItemId: string;
  senderId: string;
  senderNickname: string;
  text: string;
  audioUrl?: string;
  audioDuration?: number;
  createdAt: number;
}

export const DEFAULT_HELP_CATEGORIES = [
  { id: 'spesa', title: 'Spesa e Commissioni a Domicilio', icon: 'ShoppingBag', description: 'Acquisto e consegna generi alimentari o medicinali' },
  { id: 'domestici', title: 'Piccoli Lavoretti Domestici', icon: 'Wrench', description: 'Riparazioni lampadine, montaggio mobili, serrature' },
  { id: 'compagnia', title: 'Compagnia e Assistenza Anziani', icon: 'HeartHandshake', description: 'Due chiacchiere, passeggiate o compagnia' },
  { id: 'digital', title: 'Supporto Informatico e Digitale', icon: 'Laptop', description: 'Aiuto con smartphone, computer, SPID o app' },
  { id: 'riparazioni', title: 'Riparazione Bici e Oggetti', icon: 'Bike', description: 'Aggiustare biciclette, piccoli elettrodomestici' },
  { id: 'ripetizioni', title: 'Ripetizioni e Aiuto Studio', icon: 'BookOpen', description: 'Supporto scolastico per bambini e ragazzi' },
  { id: 'burocrazia', title: 'Consigli Burocratici e Pratiche', icon: 'FileText', description: 'Orientamento con moduli, bollette o documenti' },
  { id: 'trasporto', title: 'Passaggio in Auto e Mobilità', icon: 'Car', description: 'Passaggio per visite mediche o commissioni urgenti' },
  { id: 'animali', title: 'Cura Animali Domestici (Pet Sitting)', icon: 'Dog', description: 'Passeggiate cani, cura gatti se assenti' },
  { id: 'utensili', title: 'Condivisione Attrezzi e Utensili', icon: 'Hammer', description: 'Prestito trapani, scale, attrezzi da giardinaggio' }
];
