import React, { useState, useEffect } from 'react';
import { UserProfile, HelpItem } from './types';
import { db, ensureAuth } from './lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { Navbar } from './components/Navbar';
import { UserProfileModal } from './components/UserProfileModal';
import { CreateHelpModal } from './components/CreateHelpModal';
import { HelpDetailModal } from './components/HelpDetailModal';
import { HelpFeed } from './components/HelpFeed';
import { MyHelpSection } from './components/MyHelpSection';
import { CommunityWall } from './components/CommunityWall';
import { AiHelpAssistant } from './components/AiHelpAssistant';
import { MapView } from './components/MapView';

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
          localStorage.setItem('help_user_profile', JSON.stringify(parsed));
        }
        return parsed;
      } catch (e) { }
    }
    const defaultName = 'CittadinoSolidale';
    const defaultCode = defaultName + Math.floor(100000 + Math.random() * 900000);
    return {
      id: 'user-' + Math.random().toString(36).substring(2, 9),
      nickname: defaultName,
      passcode: defaultCode,
      location: { lat: 45.6836, lng: 8.7071, address: 'Somma Lombardo (VA)' },
      offers: ['Spesa e Commissioni a Domicilio', 'Piccoli Lavoretti Domestici'],
      requests: [],
      credits: 5,
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
  const [distanceRadius, setDistanceRadius] = useState<number>(0); // 0 = Tutta Italia / Senza Limiti di raggio
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HelpItem | null>(null);
  const [followedUserId, setFollowedUserId] = useState<string | null>(null);

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
    return itemList
      .filter((item) => {
        if (!item || item.id?.startsWith('init-')) return false;
        const durationMs = (item.durationMinutes || 24 * 60) * 60 * 1000;
        return (now - item.createdAt) <= durationMs;
      })
      .map((item) => {
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
            const durationMs = (data.durationMinutes || 24 * 60) * 60 * 1000;
            const isExpired = (Date.now() - data.createdAt) > durationMs;
            if (isExpired) return;

            const targetCoords = data.trackingType === 'static' && data.customCoords 
              ? data.customCoords 
              : data.location;
            const rawDist = userRef.current && targetCoords && typeof targetCoords.lat === 'number'
              ? calculateDistance(userRef.current.location.lat, userRef.current.location.lng, targetCoords.lat, targetCoords.lng)
              : 1.0;
            const dist = Number(rawDist.toFixed(3));
            fetched.push({ ...data, id: docSnap.id, distanceKm: dist });
          });

          // Authoritative Firestore database update
          const enriched = enrichItemsWithDistance(fetched, userRef.current);
          setItems(enriched);
          localStorage.setItem('help_items_local', JSON.stringify(enriched));
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

    const newItemData = {
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
            onSelectItem={(item) => setSelectedItem(item)}
            onOpenCreate={() => setIsCreateOpen(true)}
            onUpdateLocation={handleUpdateLocation}
            followedUserId={followedUserId}
            setFollowedUserId={setFollowedUserId}
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

        {activeTab === 'community' && <CommunityWall />}

        {activeTab === 'ai-assistant' && <AiHelpAssistant />}
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
          <div>
            <strong className="text-slate-800 font-bold">HELP</strong> — Piattaforma di Aiuto Reciproco e Convivenza Civile a 360°
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-emerald-700 font-semibold">"Solo chi aiuta può essere aiutato"</span>
            <span>•</span>
            <span>Senza Registrazioni Obbligatorie</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
