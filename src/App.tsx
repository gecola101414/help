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
  const [distanceRadius, setDistanceRadius] = useState<number>(25); // km
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<HelpItem | null>(null);

  // Real GPS Geolocation on startup
  const handleUpdateLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLat = position.coords.latitude;
          const newLng = position.coords.longitude;
          const updatedUser = {
            ...user!,
            location: {
              ...user!.location,
              lat: newLat,
              lng: newLng,
              address: `GPS (${newLat.toFixed(3)}, ${newLng.toFixed(3)})`,
            },
          };
          setUser(updatedUser);
          localStorage.setItem('help_user_profile', JSON.stringify(updatedUser));
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
          setUser(prev => prev ? {
            ...prev,
            location: { ...prev.location, lat: newLat, lng: newLng, address: `GPS (${newLat.toFixed(3)}, ${newLng.toFixed(3)})` }
          } : prev);
        },
        () => {},
        { timeout: 5000 }
      );
    }
  }, []);

  // Sync items to localStorage
  useEffect(() => {
    localStorage.setItem('help_items_local', JSON.stringify(items));
  }, [items]);

  // Initialize Firebase auth and items subscription with graceful fallback
  useEffect(() => {
    let unsubscribeItems: (() => void) | undefined;

    async function init() {
      try {
        await ensureAuth();

        // Listen to Firestore help_items
        unsubscribeItems = onSnapshot(collection(db, 'help_items'), (snapshot) => {
          if (!snapshot.empty) {
            const fetched: HelpItem[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as HelpItem;
              const dist = user ? calculateDistance(user.location.lat, user.location.lng, data.location.lat, data.location.lng) : 1.0;
              fetched.push({ id: docSnap.id, ...data, distanceKm: dist });
            });
            setItems(fetched);
          }
        }, (err) => {
          // Silent fallback to local state
        });
      } catch (err) {
        // Silent fallback
      }
    }

    init();

    return () => {
      if (unsubscribeItems) unsubscribeItems();
    };
  }, [user?.location]);

  // Save user profile to localStorage & sync
  const handleSaveProfile = (updated: Partial<UserProfile>) => {
    if (!user) return;
    const newProfile = { ...user, ...updated };
    setUser(newProfile);
    localStorage.setItem('help_user_profile', JSON.stringify(newProfile));
  };

  // Create new help item
  const handleCreateHelp = async (newHelpData: {
    type: HelpItem['type'];
    title: string;
    description: string;
    category: string;
    creditsRequired: number;
    isFree: boolean;
  }) => {
    if (!user) return;

    const newItemData = {
      userId: user.id,
      userNickname: user.nickname,
      type: newHelpData.type,
      title: newHelpData.title,
      description: newHelpData.description,
      category: newHelpData.category,
      location: user.location,
      creditsRequired: newHelpData.creditsRequired,
      isFree: newHelpData.isFree,
      status: 'active' as const,
      createdAt: Date.now(),
    };

    const localItem: HelpItem = {
      id: 'local-' + Date.now(),
      ...newItemData,
      distanceKm: 0.5,
    };

    setItems((prev) => [localItem, ...prev]);

    try {
      await addDoc(collection(db, 'help_items'), newItemData);
    } catch (err) {
      // Handled locally
    }
  };

  // Update item status (e.g. In Progress, Completed)
  const handleUpdateItemStatus = async (itemId: string, newStatus: HelpItem['status'], helperId?: string, helperNickname?: string) => {
    // If completed, update credits and karma
    if (newStatus === 'completed' && user) {
      const targetItem = items.find(i => i.id === itemId);
      const earnedCredits = targetItem && targetItem.creditsRequired > 0 ? targetItem.creditsRequired : 1;
      const updatedCredits = user.credits + earnedCredits;
      const updatedHelped = (user.helpedCount || 0) + 1;
      const updatedKarma = (user.karma || 120) + 15;
      handleSaveProfile({ credits: updatedCredits, helpedCount: updatedHelped, karma: updatedKarma });
    }

    // Update local state immediately
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, status: newStatus, helperId: helperId || i.helperId, helperNickname: helperNickname || i.helperNickname } : i))
    );
    if (selectedItem && selectedItem.id === itemId) {
      setSelectedItem((prev) => prev ? { ...prev, status: newStatus, helperId: helperId || prev.helperId, helperNickname: helperNickname || prev.helperNickname } : null);
    }

    try {
      const itemRef = doc(db, 'help_items', itemId);
      const updatePayload: any = { status: newStatus };
      if (helperId) updatePayload.helperId = helperId;
      if (helperNickname) updatePayload.helperNickname = helperNickname;
      await updateDoc(itemRef, updatePayload);
    } catch (err) {
      // Handled locally
    }
  };

  // Delete item
  const handleDeleteItem = async (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try {
      await deleteDoc(doc(db, 'help_items', itemId));
    } catch (err) {
      // Handled locally
    }
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
