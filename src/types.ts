export interface UserProfile {
  id: string;
  nickname: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  offers: string[]; // what this user offers to help with
  requests: string[]; // current requests or needs
  credits: number;
  rating: number;
  helpedCount: number;
  karma: number; // Solidarietà Karma score
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
  actionRadiusKm?: number; // Raggio d'azione/influenza (entro cui bisogna passare/trovarsi per visualizzarlo)
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
