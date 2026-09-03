import React from 'react';
import { HeartHandshake, MapPin, Coins, User, Sparkles, MessageSquare, Compass, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenProfile: () => void;
  onOpenCreate: () => void;
  distanceRadius: number;
  setDistanceRadius: (r: number) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onOpenProfile,
  onOpenCreate,
  distanceRadius,
  setDistanceRadius,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('feed')}>
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-teal-600/20">
              H
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-black text-2xl tracking-tighter text-gray-900 font-sans">HELP</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-100">Civile</span>
              </div>
              <p className="text-xs text-gray-400 hidden sm:block">Aiuto reciproco e vicinato solidale</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center space-x-1 bg-gray-100/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'feed'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              Bacheca Aiuti
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center space-x-1.5 ${
                activeTab === 'map'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <MapPin className="w-4 h-4 text-teal-600" />
              <span>Mappa</span>
            </button>
            <button
              onClick={() => setActiveTab('my-help')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'my-help'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              I Miei Aiuti & Offerte
            </button>
            <button
              onClick={() => setActiveTab('community')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === 'community'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              Storie & Classifica
            </button>
            <button
              onClick={() => setActiveTab('ai-assistant')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center space-x-1.5 ${
                activeTab === 'ai-assistant'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>IA Assistente</span>
            </button>
          </nav>

          {/* User Controls & Profile */}
          <div className="flex items-center space-x-3">
            {/* Distance Filter Selector */}
            <div className="hidden lg:flex items-center space-x-1.5 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs text-gray-700">
              <Compass className="w-3.5 h-3.5 text-teal-600" />
              <span>Raggio:</span>
              <select
                value={distanceRadius}
                onChange={(e) => setDistanceRadius(Number(e.target.value))}
                className="bg-transparent font-semibold text-gray-900 focus:outline-hidden cursor-pointer"
              >
                <option value={2}>2 km</option>
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={25}>25 km</option>
                <option value={50}>50 km</option>
                <option value={500}>Tutti (Ovunque)</option>
              </select>
            </div>

            {/* Post Help Button */}
            <button
              onClick={onOpenCreate}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-2 rounded-xl shadow-lg shadow-teal-100 text-sm transition-all flex items-center space-x-1.5 active:scale-95"
            >
              <span>+ Pubblica Aiuto</span>
            </button>

            {/* Profile Button */}
            <button
              onClick={onOpenProfile}
              className="flex items-center space-x-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs">
                {user?.nickname ? user.nickname.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-xs font-bold text-gray-800 truncate max-w-[90px]">
                  {user?.nickname || 'Ospite'}
                </div>
                <div className="flex items-center space-x-1 text-[11px] text-teal-700 font-semibold">
                  <Coins className="w-3 h-3 text-teal-600" />
                  <span>{user?.credits ?? 5} crediti</span>
                </div>
              </div>
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-gray-200 bg-white py-2 px-1">
        <button
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center py-1 px-3 text-xs ${activeTab === 'feed' ? 'text-teal-600 font-bold' : 'text-gray-400'}`}
        >
          <HeartHandshake className="w-5 h-5 mb-0.5" />
          <span>Bacheca</span>
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center py-1 px-3 text-xs ${activeTab === 'map' ? 'text-teal-600 font-bold' : 'text-gray-400'}`}
        >
          <MapPin className="w-5 h-5 mb-0.5" />
          <span>Mappa</span>
        </button>
        <button
          onClick={() => setActiveTab('my-help')}
          className={`flex flex-col items-center py-1 px-3 text-xs ${activeTab === 'my-help' ? 'text-teal-600 font-bold' : 'text-gray-400'}`}
        >
          <ShieldCheck className="w-5 h-5 mb-0.5" />
          <span>I Miei</span>
        </button>
        <button
          onClick={() => setActiveTab('community')}
          className={`flex flex-col items-center py-1 px-3 text-xs ${activeTab === 'community' ? 'text-teal-600 font-bold' : 'text-gray-400'}`}
        >
          <MessageSquare className="w-5 h-5 mb-0.5" />
          <span>Storie</span>
        </button>
        <button
          onClick={() => setActiveTab('ai-assistant')}
          className={`flex flex-col items-center py-1 px-3 text-xs ${activeTab === 'ai-assistant' ? 'text-teal-600 font-bold' : 'text-gray-400'}`}
        >
          <Sparkles className="w-5 h-5 mb-0.5 text-amber-500" />
          <span>IA</span>
        </button>
      </div>
    </header>
  );
};
