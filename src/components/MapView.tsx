import React, { useEffect, useRef } from 'react';
import { HelpItem, UserProfile } from '../types';
import L from 'leaflet';
import { MapPin, Navigation, Heart, Plus, Sparkles, Coins } from 'lucide-react';

interface MapViewProps {
  items: HelpItem[];
  user: UserProfile | null;
  onSelectItem: (item: HelpItem) => void;
  onOpenCreate: () => void;
  onUpdateLocation: () => void;
}

export const MapView: React.FC<MapViewProps> = ({
  items,
  user,
  onSelectItem,
  onOpenCreate,
  onUpdateLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const userLat = user?.location?.lat || 45.4642;
  const userLng = user?.location?.lng || 9.1900;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
      }).setView([userLat, userLng], 14);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([userLat, userLng], mapInstanceRef.current.getZoom());
    }
  }, [userLat, userLng]);

  // Update markers when items change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add user marker
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `<div style="background-color: #0d9488; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">📍</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const userMarker = L.marker([userLat, userLng], { icon: userIcon })
      .addTo(map)
      .bindPopup(`<div style="font-family: sans-serif; padding: 4px;"><strong>La tua posizione</strong><br/>${user?.location?.address || 'Posizione attuale'}</div>`);
    markersRef.current.push(userMarker);

    // Add item markers
    items.forEach((item) => {
      if (!item.location || !item.location.lat || !item.location.lng) return;

      const isOffer = item.type === 'offer';
      const bgColor = isOffer ? '#0d9488' : '#3b82f6';
      const labelText = isOffer ? 'offerta' : 'richiesta';

      const customIcon = L.divIcon({
        className: 'custom-help-marker',
        html: `<div style="background-color: ${bgColor}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; white-space: nowrap; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); border: 2px solid white; display: flex; align-items: center; gap: 3px;">
          <span>${isOffer ? '🤝' : '🆘'}</span>
          <span>${item.category.split(' ')[0]}</span>
        </div>`,
        iconSize: [80, 30],
        iconAnchor: [40, 15],
      });

      const marker = L.marker([item.location.lat, item.location.lng], { icon: customIcon })
        .addTo(map);

      marker.on('click', () => {
        onSelectItem(item);
      });

      const popupContent = document.createElement('div');
      popupContent.style.fontFamily = 'sans-serif';
      popupContent.style.padding = '6px';
      popupContent.style.minWidth = '200px';
      popupContent.innerHTML = `
        <div style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: ${isOffer ? '#0d9488' : '#3b82f6'}; margin-bottom: 2px;">${isOffer ? '🤝 Offerta di Aiuto' : '🆘 Richiesta di Aiuto'}</div>
        <div style="font-weight: bold; font-size: 14px; color: #1f2937; margin-bottom: 4px;">${item.title}</div>
        <div style="font-size: 12px; color: #4b5563; margin-bottom: 6px;">${item.userNickname} • ${item.distanceKm ? item.distanceKm + ' km' : ''}</div>
        <button id="popup-btn-${item.id}" style="background-color: #0f766e; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: bold; cursor: pointer; width: 100%;">Visualizza Dettagli</button>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`popup-btn-${item.id}`);
        if (btn) {
          btn.onclick = () => onSelectItem(item);
        }
      });

      markersRef.current.push(marker);
    });

  }, [items, userLat, userLng, onSelectItem]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <span>🗺️</span> Mappa Interattiva di Vicinato
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Esplora in tempo reale chi offre aiuto o ha bisogno nelle tue immediate vicinanze. Clicca sui pin per i dettagli.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onUpdateLocation}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 text-teal-600" />
            <span>Aggiorna GPS Reale</span>
          </button>
          <button
            onClick={onOpenCreate}
            className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Pubblica Aiuto</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden relative">
        <div ref={mapContainerRef} className="w-full h-[600px] z-10" />

        <div className="absolute bottom-6 left-6 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-gray-200 shadow-lg space-y-2 text-xs max-w-xs">
          <div className="font-bold text-gray-900 mb-1">Legenda Mappa</div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-teal-600 inline-block"></span>
            <span className="text-gray-700">Offerte di Aiuto ({items.filter(i => i.type === 'offer').length})</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
            <span className="text-gray-700">Richieste di Aiuto ({items.filter(i => i.type === 'request').length})</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-teal-800 border border-white inline-block"></span>
            <span className="text-gray-700">La tua posizione GPS reale</span>
          </div>
        </div>
      </div>
    </div>
  );
};
