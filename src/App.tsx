import React, { useState, useEffect } from 'react';
import { UserProfile, HelpItem } from './types';
import { db, ensureAuth } from './lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { Navbar } from './components/Navbar';
import { UserProfileModal } from './components/UserProfileModal';
import { CreateHelpModal } from './components/CreateHelpModal';
import { HelpDetailModal } from './components/HelpDetailModal';
import { HelpFeed } from './components/HelpFeed';
import { MyHelpSection } from './components/MyHelpSection';
import { CommunityWall } from './components/CommunityWall';
import { AiHelpAssistant } from './components/AiHelpAssistant';
import { MapView } from './components/MapView';

// Helper function to calculate distance in km using Haversine formula
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
  return Math.round(d * 10) / 10;
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
      try { return JSON.parse(saved); } catch (e) { }
    }
    return {
      id: 'user-' + Math.random().toString(36).substring(2, 9),
      nickname: 'CittadinoSolidale',
      location: { lat: 45.4642, lng: 9.1900, address: 'Milano, Centro (GPS)' },
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
    const saved = localStorage.getItem('help_items_local');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState('feed');
  const [distanceRadius, setDistanceRadius] = useState<number>(0); // 0 = Tutta Italia / Senza Limiti di raggio
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HelpItem | null>(null);

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
            return {
              ...prev,
              location: newLocation,
            };
          });
        },
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  // Helper to attach distance to items and discard legacy mock items
  const enrichItemsWithDistance = (itemList: HelpItem[], currentUser: UserProfile | null) => {
    return itemList
      .filter((item) => item && !item.id?.startsWith('init-'))
      .map((item) => {
        const dist = currentUser?.location?.lat
          ? Number(calculateDistance(currentUser.location.lat, currentUser.location.lng, item.location.lat, item.location.lng).toFixed(1))
          : (item.distanceKm || 1.0);
        return { ...item, distanceKm: dist };
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
        const serverList = await res.json();
        if (Array.isArray(serverList)) {
          const cleanServerList = serverList.filter(i => !i.id?.startsWith('init-'));
          setItems(enrichItemsWithDistance(cleanServerList, userRef.current));
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
          if (Array.isArray(list)) {
            const cleanList = list.filter((i: any) => !i.id?.startsWith('init-'));
            setItems(enrichItemsWithDistance(cleanList, userRef.current));
          }
        } catch (err) {}
      };
      eventSource.onerror = () => {
        // SSE will attempt auto-reconnect; fallback polling ensures updates continue
      };
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

    // Polling fallback every 3 seconds
    const interval = setInterval(fetchServerItems, 3000);
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

  // Firestore real-time listener (dual-channel sync)
  useEffect(() => {
    let unsubscribeItems: (() => void) | undefined;

    async function initFirestore() {
      try {
        await ensureAuth();

        unsubscribeItems = onSnapshot(
          collection(db, 'help_items'),
          (snapshot) => {
            if (!snapshot.empty) {
              const fetched: HelpItem[] = [];
              snapshot.forEach((docSnap) => {
                const data = docSnap.data() as HelpItem;
                const dist = user
                  ? calculateDistance(user.location.lat, user.location.lng, data.location.lat, data.location.lng)
                  : 1.0;
                fetched.push({ id: docSnap.id, ...data, distanceKm: dist });
              });

              setItems((prev) => {
                const map = new Map<string, HelpItem>();
                fetched.forEach((item) => map.set(item.id, item));
                prev.forEach((item) => {
                  if (!map.has(item.id)) map.set(item.id, item);
                });
                return Array.from(map.values());
              });
            }
          },
          (err) => {
            // Handled via server polling
          }
        );
      } catch (err) {
        // Handled via server polling
      }
    }

    initFirestore();

    return () => {
      if (unsubscribeItems) unsubscribeItems();
    };
  }, [user?.location?.lat, user?.location?.lng]);

  // Save user profile to localStorage & sync
  const handleSaveProfile = (updated: Partial<UserProfile>) => {
    if (!user) return;
    const newProfile = { ...user, ...updated };
    setUser(newProfile);
    localStorage.setItem('help_user_profile', JSON.stringify(newProfile));
    if (updated.location && user.id) {
      syncCreatorLocationToAnnouncements(user.id, updated.location);
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
      staticLocation: newHelpData.staticLocation,
      actionRadiusKm: newHelpData.actionRadiusKm ?? (trackingType === 'static' ? 1 : 5),
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

    // 1. Post to Server shared API (syncs to PC/mobile immediately)
    try {
      await fetch('/api/help-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItemData),
      });
    } catch (err) {
      console.warn('Server item post failed:', err);
    }

    // 2. Also save to Firestore cloud database
    try {
      await addDoc(collection(db, 'help_items'), newItemData);
    } catch (err) {
      console.warn('Firestore write fallback:', err);
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

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));

    // 1. Delete on Server API
    try {
      await fetch(`/api/help-items/${itemId}`, { method: 'DELETE' });
    } catch (err) {}

    // 2. Delete on Firestore
    try {
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
          />
        )}

        {activeTab === 'map' && (
          <MapView
            items={items}
            user={user}
            onSelectItem={(item) => setSelectedItem(item)}
            onOpenCreate={() => setIsCreateOpen(true)}
            onUpdateLocation={handleUpdateLocation}
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
