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
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-10 sm:h-11">
          
          {/* Logo & Brand - Compact */}
          <GeokindLogo size="sm" showSubtext={false} onClick={() => setActiveTab('feed')} />

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden md:flex items-center space-x-1 bg-gray-100/60 p-0.5 rounded-lg">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-2.5 py-1 rounded-md text-[11px] lg:text-xs font-bold transition-all flex items-center space-x-1 ${
                activeTab === 'feed'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
              }`}
            >
              <HeartHandshake className="w-3.5 h-3.5 text-teal-600" />
              <span>Bacheca</span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`px-2.5 py-1 rounded-md text-[11px] lg:text-xs font-bold transition-all flex items-center space-x-1 ${
                activeTab === 'map'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-teal-600" />
              <span>Mappa</span>
            </button>

            <button
              onClick={() => setActiveTab('community')}
              className={`px-2.5 py-1 rounded-md text-[11px] lg:text-xs font-bold transition-all flex items-center space-x-1 ${
                activeTab === 'community'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Comunità</span>
            </button>

            <button
              onClick={() => setActiveTab('sponsors')}
              className={`px-2.5 py-1 rounded-md text-[11px] lg:text-xs font-bold transition-all flex items-center space-x-1 ${
                activeTab === 'sponsors'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-amber-500" />
              <span>Sponsor</span>
            </button>

            <button
              onClick={() => setActiveTab('my-help')}
              className={`px-2.5 py-1 rounded-md text-[11px] lg:text-xs font-bold transition-all flex items-center space-x-1 ${
                activeTab === 'my-help'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/40'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>Miei</span>
            </button>
          </nav>

          {/* User Controls & Profile */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* GPS Location Status Toggle Button - Compact */}
            <button
              type="button"
              onClick={onOpenProfile}
              title={isLocationActive ? `Posizione: ${user?.location?.address}` : "Posizione non condivisa - Clicca per attivare o selezionare comune"}
              className={`hidden sm:flex items-center space-x-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                isLocationActive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <MapPin className={`w-3 h-3 ${isLocationActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="truncate max-w-[80px] lg:max-w-[120px]">
                {isLocationActive ? user?.location?.address : 'Off'}
              </span>
            </button>

            {/* Distance Filter Selector - Compact */}
            <div className="hidden lg:flex items-center space-x-1 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg text-[10px] text-gray-700">
              <span className="font-medium">Km:</span>
              <select
                value={distanceRadius}
                onChange={(e) => setDistanceRadius(Number(e.target.value))}
                className="bg-transparent font-bold text-gray-900 focus:outline-hidden cursor-pointer"
              >
                <option value={0}>Tutti</option>
                <option value={500}>500</option>
                <option value={100}>100</option>
                <option value={50}>50</option>
                <option value={25}>25</option>
                <option value={10}>10</option>
                <option value={5}>5</option>
              </select>
            </div>

            {/* Post Help Button - Compact */}
            <button
              onClick={onOpenCreate}
              className="bg-teal-600 hover:bg-teal-700 text-white font-black px-2.5 py-1.5 rounded-lg shadow-sm text-[10px] sm:text-xs transition-all flex items-center space-x-1 active:scale-95 cursor-pointer shrink-0"
            >
              <span>+ Gentilezza</span>
            </button>

            {/* Profile Button - Compact */}
            <button
              onClick={onOpenProfile}
              className="flex items-center space-x-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-1.5 py-1 rounded-lg transition-all"
            >
              <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                {user?.nickname ? user.nickname.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
              </div>
              <div className="text-left hidden xs:block">
                <div className="text-[10px] font-bold text-gray-800 truncate max-w-[50px] lg:max-w-[80px]">
                  {user?.nickname || 'Ospite'}
                </div>
                <div className="flex items-center space-x-0.5 text-[9px] text-amber-800 font-black bg-amber-50 px-1 py-0.25 rounded border border-amber-200">
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
