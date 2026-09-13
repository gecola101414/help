import React from 'react';
import { HeartHandshake, MapPin, User, Building2, Store, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';
import { GeokindLogo } from './GeokindLogo';

interface NavbarProps {
  user: UserProfile | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenProfile: () => void;
  onOpenCreate: () => void;
  distanceRadius: number;
  setDistanceRadius: (r: number) => void;
  onSaveProfile?: (updated: Partial<UserProfile>) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onOpenProfile,
  onOpenCreate,
  distanceRadius,
  setDistanceRadius,
  onSaveProfile,
}) => {
  const isLocationActive =
    user?.location?.address &&
    user.location.address !== 'Posizione non condivisa' &&
    (user.location.lat !== 0 || user.location.lng !== 0);
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <GeokindLogo onClick={() => setActiveTab('feed')} />

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex items-center space-x-1 bg-gray-100/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-3.5 py-2 rounded-lg text-xs lg:text-sm font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'feed'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <HeartHandshake className="w-4 h-4 text-teal-600" />
              <span>Bacheca Aiuti</span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`px-3.5 py-2 rounded-lg text-xs lg:text-sm font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'map'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <MapPin className="w-4 h-4 text-teal-600" />
              <span>Mappa</span>
            </button>

            <button
              onClick={() => setActiveTab('community')}
              className={`px-3.5 py-2 rounded-lg text-xs lg:text-sm font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'community'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Comunità</span>
            </button>

            <button
              onClick={() => setActiveTab('sponsors')}
              className={`px-3.5 py-2 rounded-lg text-xs lg:text-sm font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'sponsors'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Store className="w-4 h-4 text-amber-500" />
              <span>Sponsor BRIKO</span>
            </button>

            <button
              onClick={() => setActiveTab('my-help')}
              className={`px-3.5 py-2 rounded-lg text-xs lg:text-sm font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'my-help'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>I Miei Aiuti</span>
            </button>
          </nav>

          {/* User Controls & Profile */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* GPS Location Status Toggle Button */}
            <button
              type="button"
              onClick={onOpenProfile}
              title={isLocationActive ? `Posizione: ${user?.location?.address}` : "Posizione non condivisa - Clicca per attivare o selezionare comune"}
              className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isLocationActive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <MapPin className={`w-3.5 h-3.5 ${isLocationActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="truncate max-w-[110px] sm:max-w-[140px]">
                {isLocationActive ? user?.location?.address : '⚪ Posizione Off'}
              </span>
            </button>

            {/* Distance Filter Selector */}
            <div className="hidden lg:flex items-center space-x-1 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-xl text-xs text-gray-700">
              <span className="font-medium">Raggio:</span>
              <select
                value={distanceRadius}
                onChange={(e) => setDistanceRadius(Number(e.target.value))}
                className="bg-transparent font-bold text-gray-900 focus:outline-hidden cursor-pointer"
              >
                <option value={0}>Tutta Italia</option>
                <option value={500}>500 km</option>
                <option value={100}>100 km</option>
                <option value={50}>50 km</option>
                <option value={25}>25 km</option>
                <option value={10}>10 km</option>
                <option value={5}>5 km</option>
              </select>
            </div>

            {/* Post Help Button */}
            <button
              onClick={onOpenCreate}
              className="bg-teal-600 hover:bg-teal-700 text-white font-black px-3 sm:px-4 py-2 rounded-xl shadow-md text-xs sm:text-sm transition-all flex items-center space-x-1 active:scale-95 cursor-pointer shrink-0"
            >
              <span>+ Gentilezza</span>
            </button>

            {/* Profile Button */}
            <button
              onClick={onOpenProfile}
              className="flex items-center space-x-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2.5 sm:px-3 py-1.5 rounded-xl transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
                {user?.nickname ? user.nickname.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <div className="text-[11px] sm:text-xs font-bold text-gray-800 truncate max-w-[65px] sm:max-w-[90px] hidden xs:block">
                  {user?.nickname || 'Ospite'}
                </div>
                <div className="flex items-center space-x-0.5 text-[10px] sm:text-[11px] text-amber-800 font-black bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                  <span>🧱</span>
                  <span>{user?.credits ?? 100}</span>
                </div>
              </div>
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Nav Bar - Fully Responsive 5-column layout */}
      <div className="md:hidden border-t border-gray-200 bg-white/98 backdrop-blur-md px-1 py-1.5 shadow-sm">
        <div className="grid grid-cols-5 gap-0.5 max-w-md mx-auto text-center">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
              activeTab === 'feed' ? 'bg-teal-50 text-teal-800' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <HeartHandshake className={`w-5 h-5 mb-0.5 ${activeTab === 'feed' ? 'text-teal-600' : 'text-gray-400'}`} />
            <span className="truncate w-full text-[10px]">Bacheca</span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
              activeTab === 'map' ? 'bg-teal-50 text-teal-800' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <MapPin className={`w-5 h-5 mb-0.5 ${activeTab === 'map' ? 'text-teal-600' : 'text-gray-400'}`} />
            <span className="truncate w-full text-[10px]">Mappa</span>
          </button>

          <button
            onClick={() => setActiveTab('community')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
              activeTab === 'community' ? 'bg-emerald-50 text-emerald-800 font-black' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Building2 className={`w-5 h-5 mb-0.5 ${activeTab === 'community' ? 'text-emerald-700' : 'text-gray-400'}`} />
            <span className="truncate w-full text-[10px]">Comunità</span>
          </button>

          <button
            onClick={() => setActiveTab('sponsors')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
              activeTab === 'sponsors' ? 'bg-amber-50 text-amber-800 font-black' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Store className={`w-5 h-5 mb-0.5 ${activeTab === 'sponsors' ? 'text-amber-600' : 'text-gray-400'}`} />
            <span className="truncate w-full text-[10px]">Sponsor</span>
          </button>

          <button
            onClick={() => setActiveTab('my-help')}
            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
              activeTab === 'my-help' ? 'bg-teal-50 text-teal-800' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ShieldCheck className={`w-5 h-5 mb-0.5 ${activeTab === 'my-help' ? 'text-teal-600' : 'text-gray-400'}`} />
            <span className="truncate w-full text-[10px]">I Miei</span>
          </button>
        </div>
      </div>
    </header>
  );
};
