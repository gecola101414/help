import React, { useState, useEffect } from 'react';
import { UserProfile, HelpItem, Community, AreaSponsor, SponsorInitiative, isCommunityExpired } from './types';
import { db, ensureAuth } from './lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { Navbar } from './components/Navbar';
import { UserProfileModal } from './components/UserProfileModal';
import { CreateHelpModal } from './components/CreateHelpModal';
import { HelpDetailModal } from './components/HelpDetailModal';
import { HelpFeed } from './components/HelpFeed';
import { MyHelpSection } from './components/MyHelpSection';
import { CommunityWall } from './components/CommunityWall';
import { SponsorPage } from './components/SponsorPage';
import { MapView } from './components/MapView';
import { GeokindLogo } from './components/GeokindLogo';

// Helper function to calculate distance in km using Haversine formula (precision down to 1 meter)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 1.5; // default fallback distance
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return Math.round(d * 1000) / 1000; // 3 decimal places = precision to 1 meter
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Zero simulated initial items (real data only)
const INITIAL_HELP_ITEMS: Omit<HelpItem, 'id'>[] = [];

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('help_user_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.passcode) {
          parsed.passcode = (parsed.nickname || 'Vicino') + Math.floor(100000 + Math.random() * 900000);
        }
        // Welcome Gift: Ensure every user has at least 100 BRIKO offered by GEOKIND platform
        if (typeof parsed.credits !== 'number' || parsed.credits < 100) {
          parsed.credits = 100;
        }
        localStorage.setItem('help_user_profile', JSON.stringify(parsed));
        return parsed;
      } catch (e) { }
    }
    const defaultName = 'CittadinoSolidale';
    const defaultCode = defaultName + Math.floor(100000 + Math.random() * 900000);
    return {
      id: 'user-' + Math.random().toString(36).substring(2, 9),
      nickname: defaultName,
      passcode: defaultCode,
      location: { lat: 0, lng: 0, address: 'Posizione non condivisa' },
      offers: ['Spesa e Commissioni a Domicilio', 'Piccoli Lavoretti Domestici'],
      requests: [],
      credits: 100, // 100 BRIKO offerti dalla piattaforma al primo ingresso
      rating: 5.0,
      helpedCount: 2,
      karma: 120,
      createdAt: Date.now(),
    };
  });

  const [items, setItems] = useState<HelpItem[]>(() => {
    // Migration check: clean up any old cached test items from previous versions
    if (!localStorage.getItem('help_db_reset_v4')) {
      localStorage.removeItem('help_items_local');
      localStorage.setItem('help_db_reset_v4', 'true');
      return [];
    }
    const saved = localStorage.getItem('help_items_local');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((i: any) => !i.id?.startsWith('init-'));
        }
      } catch (e) {}
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState('feed');
  const [preSelectedCommunityId, setPreSelectedCommunityId] = useState<string | null>(null);
  const [distanceRadius, setDistanceRadius] = useState<number>(0); // 0 = Tutta Italia / Senza Limiti di raggio
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HelpItem | null>(null);
  const [followedUserId, setFollowedUserId] = useState<string | null>(null);

  // Default initial data for Communities, Sponsors and Initiatives with map locations
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
      location: { lat: 45.6836, lng: 8.7071, address: 'Corso Repubblica 12, Somma Lombardo (VA)' }
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
      location: { lat: 45.4530, lng: 9.2025, address: 'Via Muratori 24, Milano (MI)' }
    }
  ];

  const defaultSponsors: AreaSponsor[] = [
    {
      id: 'spon-1',
      name: 'Bar & Ristorante "Al Castello"',
      category: 'Commerciante Locale',
      comune: 'Somma Lombardo',
      address: 'Piazza Vittorio Emanuele II, Somma Lombardo',
      brikoOffered: 500,
      message: 'Offriamo 500 BRIKO alla nostra comunità per sostenere la consegna della spesa agli anziani!',
      createdAt: Date.now() - 86400000 * 2,
      location: { lat: 45.6840, lng: 8.7080, address: 'Piazza Vittorio Emanuele II, Somma Lombardo (VA)' }
    },
    {
      id: 'spon-2',
      name: 'Biscottificio Lombardo Artigianale',
      category: 'Supermercato & Alimentari',
      comune: 'Gallarate',
      address: 'Corso Italia 15, Gallarate',
      brikoOffered: 900,
      message: 'Premiano la gentilezza vicinale con 900 BRIKO in palio per chi fa azioni solidali sul territorio.',
      createdAt: Date.now() - 86400000 * 4,
      location: { lat: 45.6660, lng: 8.7920, address: 'Corso Italia 15, Gallarate (VA)' }
    }
  ];

  const defaultInitiatives: SponsorInitiative[] = [
    {
      id: 'init-1',
      sponsorId: 'spon-1',
      sponsorName: 'Bar & Ristorante "Al Castello"',
      category: 'Ambiente & Verde Civico',
      title: 'Pulizia e Cura del Parco di Somma Lombardo',
      description: 'Lo Sponsor Bar Al Castello regala 100 BRIKO a chiunque partecipi alla giornata di pulizia delle aree verdi.',
      comune: 'Somma Lombardo',
      brikoRewardPerParticipant: 100,
      totalBrikoBudget: 500,
      brikoRemaining: 400,
      participantsCount: 1,
      createdAt: Date.now() - 86400000 * 1,
      location: { lat: 45.6850, lng: 8.7090, address: 'Parco di Somma Lombardo (VA)' }
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
      location: { lat: 45.6670, lng: 8.7930, address: 'Corso Italia 15, Gallarate (VA)' }
    }
  ];

  const [communities, setCommunities] = useState<Community[]>(defaultCommunities);
  const [sponsors, setSponsors] = useState<AreaSponsor[]>(defaultSponsors);
  const [initiatives, setInitiatives] = useState<SponsorInitiative[]>(defaultInitiatives);

  // Real GPS Geolocation on startup and manual sync (Announcements follow the creator!)
  const syncCreatorLocationToAnnouncements = async (userId: string, newLocation: { lat: number; lng: number; address: string }) => {
    // 1. Update items in local state
    setItems((prev) =>
      prev.map((item) => {
        if (item.userId === userId && item.status !== 'completed' && item.status !== 'cancelled') {
          return { ...item, location: newLocation };
        }
        return item;
      })
    );

    // 2. Broadcast to server so other devices see the creator's new position immediately
    try {
      await fetch(`/api/users/${userId}/location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLocation),
      });
    } catch (e) {}
  };

  const handleUpdateLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLat = position.coords.latitude;
          const newLng = position.coords.longitude;
          const newLocation = {
            lat: newLat,
            lng: newLng,
            address: `GPS (${newLat.toFixed(3)}, ${newLng.toFixed(3)})`,
          };
          const updatedUser = {
            ...user!,
            location: newLocation,
          };
          setUser(updatedUser);
          localStorage.setItem('help_user_profile', JSON.stringify(updatedUser));
          if (user?.id) {
            syncCreatorLocationToAnnouncements(user.id, newLocation);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('Impossibile rilevare la posizione GPS. Assicurati di aver concesso i permessi di geolocalizzazione.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      alert('La geolocalizzazione non è supportata dal tuo browser.');
    }
  };

  useEffect(() => {
    // Attempt automatic geolocation on first load if default location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLat = position.coords.latitude;
          const newLng = position.coords.longitude;
          const newLocation = {
            lat: newLat,
            lng: newLng,
            address: `GPS (${newLat.toFixed(3)}, ${newLng.toFixed(3)})`,
          };
          setUser((prev) => {
            if (!prev) return prev;
            syncCreatorLocationToAnnouncements(prev.id, newLocation);
            const updated = {
              ...prev,
              location: newLocation,
            };
            localStorage.setItem('help_user_profile', JSON.stringify(updated));
            return updated;
          });
        },
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  // Helper to attach distance to items, enforce proximity constraints, and discard legacy mock items
  const enrichItemsWithDistance = (itemList: HelpItem[], currentUser: UserProfile | null) => {
    const now = Date.now();
    // Deduplicate by item.id to ensure unique keys in renders
    const uniqueMap = new Map<string, HelpItem>();
    itemList.forEach((item) => {
      if (item && item.id && !item.id.startsWith('init-')) {
        uniqueMap.set(item.id, item);
      }
    });

    const validItems = Array.from(uniqueMap.values()).filter((item) => {
      const durationMs = (item.durationMinutes || 24 * 60) * 60 * 1000;
      const isNotExpired = (now - item.createdAt) <= durationMs;
      
      // Community Visibility Filtering:
      // If item has targetCommunityIds, only show if currentUser is in at least one of them or is the creator
      const isVisibleToUser = !currentUser || item.userId === currentUser.id || !item.targetCommunityIds || item.targetCommunityIds.length === 0 || 
        (currentUser.communityIds && item.targetCommunityIds.some(id => currentUser.communityIds?.includes(id)));
        
      return isNotExpired && isVisibleToUser;
    });

    return validItems.map((item) => {
      const targetCoords = item.trackingType === 'static' && item.customCoords 
        ? item.customCoords 
        : item.location;
        
      const rawDist = currentUser?.location?.lat && targetCoords
        ? calculateDistance(currentUser.location.lat, currentUser.location.lng, targetCoords.lat, targetCoords.lng)
        : (item.distanceKm || 0.1);
      const dist = Number(rawDist.toFixed(3));
      
      // Enforce proximity rules:
      // Dynamic: exactly 100 meters (0.1 km) fixed
      // Static: between 0.1 and 10 km (max 10 km)
      const isStatic = item.trackingType === 'static';
      const actionRadiusKm = isStatic
        ? Math.min(10, Math.max(0.1, Number(item.actionRadiusKm) || 1))
        : 0.1;

      return { ...item, distanceKm: dist, actionRadiusKm };
    });
  };

  // Keep reference to latest user for distance calculations in real-time callbacks
  const userRef = React.useRef<UserProfile | null>(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Sync items to localStorage
  useEffect(() => {
    const cleanItems = items.filter(i => !i.id?.startsWith('init-'));
    localStorage.setItem('help_items_local', JSON.stringify(cleanItems));
  }, [items]);

  // Server API fetching and syncing
  const fetchServerItems = async () => {
    try {
      const res = await fetch('/api/help-items');
      if (res.ok) {
        const text = await res.text();
        if (text.startsWith('[') || text.startsWith('{')) {
          const serverList = JSON.parse(text);
          if (Array.isArray(serverList) && serverList.length > 0) {
            const cleanServerList = serverList.filter(i => !i.id?.startsWith('init-'));
            setItems((prev) => {
              const map = new Map<string, HelpItem>();
              cleanServerList.forEach((item) => map.set(item.id, item));
              prev.forEach((item) => {
                if (!map.has(item.id)) map.set(item.id, item);
              });
              return enrichItemsWithDistance(Array.from(map.values()), userRef.current);
            });
          }
        }
      }
    } catch (err) {
      // Server offline or network issue
    }
  };

  // Multi-device real-time synchronization effect (SSE Push + Polling Fallback)
  useEffect(() => {
    fetchServerItems();

    // 1. Real-time Server-Sent Events stream for instant sub-second sync across devices
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/help-items/stream');
      eventSource.onmessage = (e) => {
        try {
          const list = JSON.parse(e.data);
          if (Array.isArray(list) && list.length > 0) {
            const cleanList = list.filter((i: any) => !i.id?.startsWith('init-'));
            setItems((prev) => {
              const map = new Map<string, HelpItem>();
              cleanList.forEach((item: HelpItem) => map.set(item.id, item));
              prev.forEach((item) => {
                if (!map.has(item.id)) map.set(item.id, item);
              });
              return enrichItemsWithDistance(Array.from(map.values()), userRef.current);
            });
          }
        } catch (err) {}
      };
      eventSource.onerror = () => {};
    } catch (e) {}

    // Check if there are local items to sync to server
    const saved = localStorage.getItem('help_items_local');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          fetch('/api/help-items/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed),
          })
            .then((r) => r.json())
            .then((merged) => {
              if (Array.isArray(merged)) {
                setItems(enrichItemsWithDistance(merged, userRef.current));
              }
            })
            .catch(() => {});
        }
      } catch (e) {}
    }

    // Polling fallback every 10 seconds
    const interval = setInterval(fetchServerItems, 10000);
    const handleFocus = () => fetchServerItems();
    const handleOnline = () => fetchServerItems();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [user?.location?.lat, user?.location?.lng]);

  // Firestore real-time listener (primary cloud database for Vercel, mobile & desktop)
  useEffect(() => {
    let unsubscribeItems: (() => void) | undefined;

    try {
      unsubscribeItems = onSnapshot(
        collection(db, 'help_items'),
        (snapshot) => {
          const fetched: HelpItem[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as HelpItem;
            
            // Skip legacy test or expired items
            if (data.id?.startsWith('init-') || docSnap.id.startsWith('test_')) return;

            // Handle Firestore timestamp objects or numbers safely
            const createdAtNum = typeof data.createdAt === 'number'
              ? data.createdAt
              : (data.createdAt && typeof (data.createdAt as any).toMillis === 'function')
              ? (data.createdAt as any).toMillis()
              : (data.createdAt && typeof (data.createdAt as any).seconds === 'number')
              ? (data.createdAt as any).seconds * 1000
              : Date.now();

            const durationMs = (data.durationMinutes || 24 * 60) * 60 * 1000;
            const isExpired = (Date.now() - createdAtNum) > durationMs;
            if (isExpired) return;

            const targetCoords = data.trackingType === 'static' && data.customCoords 
              ? data.customCoords 
              : data.location;
            const rawDist = userRef.current && targetCoords && typeof targetCoords.lat === 'number'
              ? calculateDistance(userRef.current.location.lat, userRef.current.location.lng, targetCoords.lat, targetCoords.lng)
              : 1.0;
            const dist = Number(rawDist.toFixed(3));
            
            // Ensure location is safely structured with numeric coordinates
            const safeLocation = {
              lat: typeof data.location?.lat === 'number' ? data.location.lat : (userRef.current?.location?.lat || 45.6836),
              lng: typeof data.location?.lng === 'number' ? data.location.lng : (userRef.current?.location?.lng || 8.7071),
              address: data.location?.address || 'Posizione indicata',
            };

            fetched.push({ ...data, createdAt: createdAtNum, location: safeLocation, id: docSnap.id, distanceKm: dist });
          });

          // Authoritative Firestore database update WITH LOCAL PRESERVATION
          setItems((prev) => {
            const map = new Map<string, HelpItem>();
            // 1. Add all items fetched from Firestore
            fetched.forEach((item) => map.set(item.id, item));
            
            // 2. Preserve active local items from prev (e.g. just created by current user in this session)
            prev.forEach((item) => {
              if (item && item.id && !item.id.startsWith('init-') && !map.has(item.id)) {
                map.set(item.id, item);
              }
            });

            const merged = Array.from(map.values());
            const enriched = enrichItemsWithDistance(merged, userRef.current);
            localStorage.setItem('help_items_local', JSON.stringify(enriched));
            return enriched;
          });
        },
        (err) => {
          console.warn('[Firestore] snapshot listener warning:', err);
        }
      );
    } catch (err) {
      console.warn('[Firestore] init error:', err);
    }

    return () => {
      if (unsubscribeItems) unsubscribeItems();
    };
  }, [user?.location?.lat, user?.location?.lng]);

  // Firestore real-time listeners for Communities, Sponsors & Initiatives
  useEffect(() => {
    let unSubComm: (() => void) | undefined;
    let unSubSpon: (() => void) | undefined;
    let unSubInit: (() => void) | undefined;

    try {
      unSubComm = onSnapshot(collection(db, 'help_communities'), (snap) => {
        const fetched: Community[] = [];
        snap.forEach((d) => {
          const comm = { id: d.id, ...d.data() } as Community;
          if (!isCommunityExpired(comm)) {
            fetched.push(comm);
          }
        });
        if (fetched.length > 0) {
          setCommunities(fetched);
        } else {
          setCommunities(defaultCommunities.filter((c) => !isCommunityExpired(c)));
        }
      });
    } catch (e) {}

    try {
      unSubSpon = onSnapshot(collection(db, 'help_sponsors'), (snap) => {
        const fetched: AreaSponsor[] = [];
        snap.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as AreaSponsor);
        });
        if (fetched.length > 0) {
          setSponsors(fetched);
        } else {
          setSponsors(defaultSponsors);
        }
      });
    } catch (e) {}

    try {
      unSubInit = onSnapshot(collection(db, 'help_sponsor_initiatives'), (snap) => {
        const fetched: SponsorInitiative[] = [];
        snap.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as SponsorInitiative);
        });
        if (fetched.length > 0) {
          setInitiatives(fetched);
        } else {
          setInitiatives(defaultInitiatives);
        }
      });
    } catch (e) {}

    return () => {
      if (unSubComm) unSubComm();
      if (unSubSpon) unSubSpon();
      if (unSubInit) unSubInit();
    };
  }, []);

  // Save user profile to localStorage & sync
  const handleSaveProfile = async (updated: Partial<UserProfile>) => {
    if (!user) return;
    const newProfile = { ...user, ...updated };
    setUser(newProfile);
    localStorage.setItem('help_user_profile', JSON.stringify(newProfile));
    if (updated.location && user.id) {
      syncCreatorLocationToAnnouncements(user.id, updated.location);
    }
    // Also sync to cloud collection help_users
    try {
      if (newProfile.id) {
        await setDoc(doc(db, 'help_users', newProfile.id), JSON.parse(JSON.stringify({
          ...newProfile,
          lastLoginAt: Date.now()
        })), { merge: true });
      }
    } catch (e) {
      console.warn('Firestore user profile sync error:', e);
    }
  };

  // Create new help item
  const handleCreateHelp = async (newHelpData: {
    type: HelpItem['type'];
    title: string;
    description: string;
    category: string;
    creditsRequired: number;
    isFree: boolean;
    trackingType?: 'dynamic' | 'static';
    actionRadiusKm?: number;
    durationMinutes?: number;
    valoreGentilezzaBriko?: number;
    targetCommunityIds?: string[];
    sponsorId?: string;
    sponsorName?: string;
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
  }) => {
    if (!user) return;

    const newId = 'help-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    const trackingType = newHelpData.trackingType || 'dynamic';
    
    // Choose location: if static, use customCoords / static formatted address; else user GPS location
    const itemLocation = (trackingType === 'static' && newHelpData.customCoords)
      ? {
          lat: newHelpData.customCoords.lat,
          lng: newHelpData.customCoords.lng,
          address: newHelpData.staticLocation?.formattedAddress || [newHelpData.staticLocation?.via, newHelpData.staticLocation?.civico, newHelpData.staticLocation?.comune].filter(Boolean).join(', ') || 'Luogo fisso',
        }
      : { ...user.location };

    // Proximity rule:
    // Dynamic: exactly 100 meters (0.1 km) fixed for human interaction
    // Static: between 0.1 and 10 km (max 10 km)
    const effectiveRadius = trackingType === 'static'
      ? Math.min(10, Math.max(0.1, Number(newHelpData.actionRadiusKm) || 1))
      : 0.1;

    const newItemData: HelpItem = {
      id: newId,
      userId: user.id,
      userNickname: user.nickname,
      type: newHelpData.type,
      title: newHelpData.title,
      description: newHelpData.description,
      category: newHelpData.category,
      location: itemLocation,
      trackingType,
      staticLocation: newHelpData.staticLocation ? {
        comune: newHelpData.staticLocation.comune || '',
        via: newHelpData.staticLocation.via || '',
        civico: newHelpData.staticLocation.civico || '',
        formattedAddress: newHelpData.staticLocation.formattedAddress || itemLocation.address,
      } : undefined,
      customCoords: trackingType === 'static' ? (newHelpData.customCoords || itemLocation) : undefined,
      actionRadiusKm: effectiveRadius,
      durationMinutes: newHelpData.durationMinutes || 24 * 60,
      valoreGentilezzaBriko: newHelpData.valoreGentilezzaBriko || 10,
      targetCommunityIds: newHelpData.targetCommunityIds,
      sponsorId: newHelpData.sponsorId,
      sponsorName: newHelpData.sponsorName,
      creditsRequired: newHelpData.creditsRequired,
      isFree: newHelpData.isFree,
      status: 'active' as const,
      createdAt: Date.now(),
    };

    const dist = user
      ? calculateDistance(user.location.lat, user.location.lng, itemLocation.lat, itemLocation.lng)
      : 0.1;

    const localItem: HelpItem = {
      ...newItemData,
      distanceKm: dist,
    };

    // Update locally immediately
    setItems((prev) => [localItem, ...prev]);

    // 1. Post to Server shared API (syncs if server is present)
    try {
      await fetch('/api/help-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItemData),
      });
    } catch (err) {
      console.warn('Server item post failed:', err);
    }

    // 2. Also save to Firestore cloud database with complete undefined-sanitization
    try {
      const sanitizedPayload = JSON.parse(JSON.stringify(newItemData));
      await setDoc(doc(db, 'help_items', newId), sanitizedPayload);
      console.log('[Firestore] Annuncio salvato nel cloud con successo:', newId);
    } catch (err) {
      console.error('[Firestore] Errore salvataggio annuncio cloud:', err);
    }
  };

  // Update item status (e.g. In Progress, Completed)
  const handleUpdateItemStatus = async (itemId: string, newStatus: HelpItem['status'], helperId?: string, helperNickname?: string) => {
    // If completed, update credits and karma
    if (newStatus === 'completed' && user) {
      const targetItem = items.find((i) => i.id === itemId);
      const earnedCredits = targetItem && targetItem.creditsRequired > 0 ? targetItem.creditsRequired : 1;
      const updatedCredits = user.credits + earnedCredits;
      const updatedHelped = (user.helpedCount || 0) + 1;
      const updatedKarma = (user.karma || 120) + 15;
      handleSaveProfile({ credits: updatedCredits, helpedCount: updatedHelped, karma: updatedKarma });
    }

    // Update local state immediately
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, status: newStatus, helperId: helperId || i.helperId, helperNickname: helperNickname || i.helperNickname }
          : i
      )
    );
    if (selectedItem && selectedItem.id === itemId) {
      setSelectedItem((prev) =>
        prev
          ? { ...prev, status: newStatus, helperId: helperId || prev.helperId, helperNickname: helperNickname || prev.helperNickname }
          : null
      );
    }

    const updatePayload: any = { status: newStatus };
    if (helperId) updatePayload.helperId = helperId;
    if (helperNickname) updatePayload.helperNickname = helperNickname;

    // 1. Update on Server API
    try {
      await fetch(`/api/help-items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
    } catch (err) {}

    // 2. Update on Firestore
    try {
      const itemRef = doc(db, 'help_items', itemId);
      await updateDoc(itemRef, updatePayload);
    } catch (err) {}
  };

  // Delete item & clean up dedicated chat messages
  const handleDeleteItem = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    if (selectedItem && selectedItem.id === itemId) {
      setSelectedItem(null);
    }

    // 1. Delete on Server API
    try {
      await fetch(`/api/help-items/${itemId}`, { method: 'DELETE' });
    } catch (err) {}

    // 2. Delete on Firestore: remove subcollection chat messages + announcement doc
    try {
      const msgsSnap = await getDocs(collection(db, 'help_items', itemId, 'messages'));
      for (const mDoc of msgsSnap.docs) {
        await deleteDoc(doc(db, 'help_items', itemId, 'messages', mDoc.id));
      }
      await deleteDoc(doc(db, 'help_items', itemId));
    } catch (err) {}
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      
      {/* Navbar */}
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenCreate={() => setIsCreateOpen(true)}
        distanceRadius={distanceRadius}
        setDistanceRadius={setDistanceRadius}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'feed' && (
          <HelpFeed
            items={items}
            user={user}
            distanceRadius={distanceRadius}
            setDistanceRadius={setDistanceRadius}
            onSelectItem={(item) => setSelectedItem(item)}
            onOpenCreate={() => setIsCreateOpen(true)}
            onOpenProfile={() => setIsProfileOpen(true)}
            followedUserId={followedUserId}
            setFollowedUserId={setFollowedUserId}
          />
        )}

        {activeTab === 'map' && (
          <MapView
            items={items}
            user={user}
            communities={communities}
            sponsors={sponsors}
            initiatives={initiatives}
            onSelectItem={(item) => setSelectedItem(item)}
            onOpenCreate={() => setIsCreateOpen(true)}
            onUpdateLocation={handleUpdateLocation}
            followedUserId={followedUserId}
            setFollowedUserId={setFollowedUserId}
            onOpenCommunity={(comm) => {
              setPreSelectedCommunityId(comm.id);
              setActiveTab('community');
            }}
            onOpenSponsor={() => setActiveTab('sponsors')}
          />
        )}

        {activeTab === 'my-help' && (
          <MyHelpSection
            items={items}
            user={user}
            onSelectItem={(item) => setSelectedItem(item)}
            onDeleteItem={handleDeleteItem}
            onOpenCreate={() => setIsCreateOpen(true)}
          />
        )}

        {activeTab === 'community' && (
          <CommunityWall 
            user={user} 
            communities={communities}
            setCommunities={setCommunities}
            onSaveProfile={handleSaveProfile} 
            initialSubTab="communities"
            preSelectedCommunityId={preSelectedCommunityId}
            onClearPreSelection={() => setPreSelectedCommunityId(null)}
          />
        )}

        {activeTab === 'sponsors' && (
          <SponsorPage 
            user={user} 
            sponsors={sponsors}
            setSponsors={setSponsors}
            initiatives={initiatives}
            setInitiatives={setInitiatives}
            onSaveProfile={handleSaveProfile} 
            onCreateHelp={handleCreateHelp}
            communities={communities}
          />
        )}
      </main>

      {/* Modals */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onSave={handleSaveProfile}
        onResetAllItems={() => setItems([])}
      />

      <CreateHelpModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        user={user}
        communities={communities}
        onSave={handleCreateHelp}
        onOpenProfile={() => setIsProfileOpen(true)}
      />

      <HelpDetailModal
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        user={user}
        onUpdateItemStatus={handleUpdateItemStatus}
        onDeleteItem={handleDeleteItem}
        followedUserId={followedUserId}
        setFollowedUserId={setFollowedUserId}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <GeokindLogo size="sm" showSubtext={false} />
            <span className="text-slate-400 font-medium">— Gentilezza & Scambio Civico Geolocalizzato</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-teal-800 font-bold bg-teal-50 px-3 py-1 rounded-full border border-teal-100">
              2026@Gimondo Domenico
            </span>
            <span>•</span>
            <span>Senza Registrazioni Obbligatorie</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
