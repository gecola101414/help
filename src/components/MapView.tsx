import React, { useEffect, useRef, useState, useMemo } from 'react';
import { HelpItem, UserProfile, DEFAULT_HELP_CATEGORIES } from '../types';
import L from 'leaflet';
import {
  Navigation,
  Plus,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Search,
  Filter,
  X,
  Layers,
  Sparkles,
  SlidersHorizontal,
  Check,
  Radio
} from 'lucide-react';

interface MapViewProps {
  items: HelpItem[];
  user: UserProfile | null;
  onSelectItem: (item: HelpItem) => void;
  onOpenCreate: () => void;
  onUpdateLocation: () => void;
}

interface PositionedItem {
  item: HelpItem;
  displayLat: number;
  displayLng: number;
  isDisplaced: boolean;
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
  const circlesRef = useRef<L.Circle[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const itemMarkersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const hasInitializedViewRef = useRef(false);

  const [currentZoom, setCurrentZoom] = useState<number>(12);

  // Filtering states
  const [filterType, setFilterType] = useState<'all' | 'offer' | 'request' | 'free'>('all');
  const [filterTracking, setFilterTracking] = useState<'all' | 'dynamic' | 'static'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [markerStyle, setMarkerStyle] = useState<'pill' | 'compact'>('pill');
  const [antiOverlap, setAntiOverlap] = useState<boolean>(true);
  const [showActionCircles, setShowActionCircles] = useState<boolean>(true);
  const [onlyInActionRadius, setOnlyInActionRadius] = useState<boolean>(false);

  const userLat = user?.location?.lat || 45.4642;
  const userLng = user?.location?.lng || 9.1900;

  // Extract all unique categories present in items for convenient filtering
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  // Filtered items based on active criteria
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Type filter
      if (filterType === 'offer' && item.type !== 'offer') return false;
      if (filterType === 'request' && item.type !== 'request') return false;
      if (filterType === 'free' && !item.isFree) return false;

      // Tracking type filter (Dynamic vs Static)
      if (filterTracking === 'dynamic' && item.trackingType === 'static') return false;
      if (filterTracking === 'static' && item.trackingType !== 'static') return false;

      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

      // Creator Action Radius filter (L'annuncio segue chi lo crea o raggio di influenza)
      if (onlyInActionRadius) {
        const isCovered =
          !item.actionRadiusKm ||
          item.actionRadiusKm === 0 ||
          (item.distanceKm !== undefined && item.distanceKm <= item.actionRadiusKm);
        if (!isCovered) return false;
      }

      // Search keyword filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        const matchNick = item.userNickname.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchCat && !matchNick) return false;
      }

      return true;
    });
  }, [items, filterType, filterTracking, selectedCategory, searchQuery, onlyInActionRadius]);

  // Compute positioned items with intelligent anti-overlap de-clustering
  const positionedItems: PositionedItem[] = useMemo(() => {
    if (!antiOverlap) {
      return filteredItems
        .filter((item) => item.location && item.location.lat && item.location.lng)
        .map((item) => ({
          item,
          displayLat: item.location.lat,
          displayLng: item.location.lng,
          isDisplaced: false,
        }));
    }

    // Group items that are within ~60 meters of each other (prevents visual stacking)
    const validItems = filteredItems.filter(
      (item) => item.location && item.location.lat && item.location.lng
    );

    const clusters: HelpItem[][] = [];

    validItems.forEach((item) => {
      const existingCluster = clusters.find((cluster) => {
        const ref = cluster[0];
        const dLat = Math.abs(ref.location.lat - item.location.lat);
        const dLng = Math.abs(ref.location.lng - item.location.lng);
        return dLat < 0.00065 && dLng < 0.00085;
      });

      if (existingCluster) {
        existingCluster.push(item);
      } else {
        clusters.push([item]);
      }
    });

    const result: PositionedItem[] = [];

    clusters.forEach((cluster) => {
      if (cluster.length === 1) {
        result.push({
          item: cluster[0],
          displayLat: cluster[0].location.lat,
          displayLng: cluster[0].location.lng,
          isDisplaced: false,
        });
      } else {
        // Fan out radially so every marker is independently visible and clickable
        const count = cluster.length;
        const baseLat = cluster[0].location.lat;
        const baseLng = cluster[0].location.lng;
        const radius = 0.00045 * Math.min(1.4, Math.sqrt(count / 2));

        cluster.forEach((item, index) => {
          const angle = (index * 2 * Math.PI) / count - Math.PI / 2;
          const displayLat = baseLat + Math.cos(angle) * radius;
          const displayLng = baseLng + Math.sin(angle) * (radius * 1.35);

          result.push({
            item,
            displayLat,
            displayLng,
            isDisplaced: true,
          });
        });
      }
    });

    return result;
  }, [filteredItems, antiOverlap]);

  const hasActiveFilters = filterType !== 'all' || selectedCategory !== 'all' || searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setFilterType('all');
    setSelectedCategory('all');
    setSearchQuery('');
  };

  // Manual trigger: Inquadra tutti gli annunci su richiesta dell'utente
  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const allMarkers = [...markersRef.current];
    if (userMarkerRef.current) allMarkers.push(userMarkerRef.current);
    if (allMarkers.length === 0) return;
    try {
      const group = L.featureGroup(allMarkers);
      map.fitBounds(group.getBounds().pad(0.2), { maxZoom: 14, animate: true, duration: 0.8 });
    } catch (e) {}
  };

  // Manual trigger: Centra sulla posizione dell'utente su richiesta
  const handleCenterUser = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([userLat, userLng], 14, { duration: 0.8 });
    if (userMarkerRef.current) {
      setTimeout(() => userMarkerRef.current?.openPopup(), 400);
    }
  };

  // Manual trigger: Zoom In / Zoom Out
  const handleZoomIn = () => {
    const map = mapInstanceRef.current;
    if (map) map.zoomIn();
  };

  const handleZoomOut = () => {
    const map = mapInstanceRef.current;
    if (map) map.zoomOut();
  };

  // 1. Initialize Map Instance (Only Once)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([userLat, userLng], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      map.on('zoomend', () => {
        setCurrentZoom(map.getZoom());
      });

      mapInstanceRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }
  }, []);

  // Invalidate size on container resize
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // 2. Update User Position Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `<div style="background-color: #0f766e; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 13px; font-weight: bold;">📍</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLat, userLng]);
      userMarkerRef.current.setPopupContent(
        `<div style="font-family: sans-serif; padding: 4px;"><strong>La tua posizione</strong><br/>${user?.location?.address || 'Posizione attuale'}</div>`
      );
    } else {
      const uMarker = L.marker([userLat, userLng], { icon: userIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family: sans-serif; padding: 4px;"><strong>La tua posizione</strong><br/>${user?.location?.address || 'Posizione attuale'}</div>`
        );
      userMarkerRef.current = uMarker;
    }
  }, [userLat, userLng, user?.location?.address]);

  // 3. Update Item Markers with filtered and positioned items (Zero auto-pan/reset)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old item markers & circles
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    circlesRef.current.forEach((circle) => circle.remove());
    circlesRef.current = [];
    itemMarkersMapRef.current.clear();

    // Render positioned items
    positionedItems.forEach(({ item, displayLat, displayLng, isDisplaced }) => {
      const isOffer = item.type === 'offer';
      const isStatic = item.trackingType === 'static';
      
      // Color and visual identity:
      // Static: warm amber/orange (#d97706)
      // Dynamic offer: teal (#0d9488)
      // Dynamic request: blue (#2563eb)
      const bgColor = isStatic
        ? (isOffer ? '#d97706' : '#b45309')
        : (isOffer ? '#0d9488' : '#2563eb');
      
      const emoji = isStatic
        ? '📌'
        : (isOffer ? '🤝' : '🆘');

      // Draw Action Radius Circle (L'annuncio segue l'autore in movimento OPPURE resta ancorato al luogo fisso)
      if (showActionCircles && item.actionRadiusKm && item.actionRadiusKm > 0 && item.location?.lat) {
        const circle = L.circle([item.location.lat, item.location.lng], {
          radius: item.actionRadiusKm * 1000,
          color: bgColor,
          fillColor: bgColor,
          fillOpacity: isStatic ? 0.08 : 0.06,
          weight: isStatic ? 2 : 1.5,
          dashArray: isStatic ? '4, 4' : '3, 6',
        }).addTo(map);
        circlesRef.current.push(circle);
      }

      let customIcon: L.DivIcon;

      if (markerStyle === 'compact') {
        // Compact circular badge
        customIcon = L.divIcon({
          className: 'custom-help-marker-compact',
          html: `<div style="background-color: ${bgColor}; color: white; width: 32px; height: 32px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 14px; cursor: pointer; transition: transform 0.15s ease;" title="${item.title}">
            ${emoji}
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
      } else {
        // Full pill marker with title and dynamic/static indicator
        customIcon = L.divIcon({
          className: 'custom-help-marker-pill',
          html: `<div style="background-color: ${bgColor}; color: white; padding: 5px 9px; border-radius: 14px; font-size: 11px; font-weight: bold; white-space: nowrap; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25); border: 2px solid white; display: flex; align-items: center; gap: 4px; cursor: pointer; max-width: 175px; overflow: hidden; text-overflow: ellipsis;">
            <span>${emoji}</span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.title.substring(0, 18)}</span>
          </div>`,
          iconSize: [135, 32],
          iconAnchor: [67, 16],
        });
      }

      const marker = L.marker([displayLat, displayLng], { icon: customIcon }).addTo(map);

      // Raise marker on hover so it sits on top of any neighbors
      marker.on('mouseover', () => {
        marker.setZIndexOffset(1000);
      });
      marker.on('mouseout', () => {
        marker.setZIndexOffset(0);
      });

      marker.on('click', () => {
        onSelectItem(item);
      });

      const popupContent = document.createElement('div');
      popupContent.style.fontFamily = 'sans-serif';
      popupContent.style.padding = '6px';
      popupContent.style.minWidth = '230px';
      popupContent.innerHTML = `
        <div style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: ${bgColor}; margin-bottom: 2px;">
          ${isStatic ? '📌 Annuncio Fisso (Luogo)' : (isOffer ? '🏃 Offerta Dinamica (Segue persona)' : '🏃 Richiesta Dinamica (Segue persona)')}
        </div>
        <div style="font-weight: bold; font-size: 14px; color: #1f2937; margin-bottom: 4px;">${item.title}</div>
        <div style="font-size: 12px; color: #4b5563; margin-bottom: 4px;">${item.userNickname} • ${item.distanceKm !== undefined ? (item.distanceKm < 1 ? 'A meno di 1 km' : item.distanceKm + ' km da te') : ''}</div>
        <div style="font-size: 11px; color: ${isStatic ? '#92400e' : '#0f766e'}; background-color: ${isStatic ? '#fffbeb' : '#f0fdfa'}; border: 1px solid ${isStatic ? '#fde68a' : '#ccfbf1'}; padding: 4px 6px; border-radius: 6px; margin-bottom: 6px;">
          ${isStatic
            ? `📌 <strong>Luogo Fisso Ancorato:</strong> Raggio d'influenza <strong>${item.actionRadiusKm ? (item.actionRadiusKm < 1 ? (item.actionRadiusKm * 1000) + ' m' : item.actionRadiusKm + ' km') : 'Illimitato'}</strong>. Visibile solo passando in quest'area.`
            : `📡 <strong>Segue ${item.userNickname}:</strong> Raggio disponibilità <strong>${item.actionRadiusKm ? item.actionRadiusKm + ' km' : 'Illimitato'}</strong> (si sposta via GPS).`
          }
        </div>
        <div style="font-size: 11px; color: #6b7280; margin-bottom: 6px;">${item.location?.address || ''}</div>
        ${isDisplaced ? '<div style="font-size: 10px; color: #0d9488; background-color: #f0fdf4; padding: 2px 6px; border-radius: 4px; margin-bottom: 8px; display: inline-block;">📍 Posizione distanziata per leggibilità</div>' : ''}
        <button id="popup-btn-${item.id}" style="background-color: ${bgColor}; color: white; border: none; padding: 7px 12px; border-radius: 8px; font-size: 12px; font-weight: bold; cursor: pointer; width: 100%;">Visualizza Dettagli</button>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`popup-btn-${item.id}`);
        if (btn) {
          btn.onclick = () => onSelectItem(item);
        }
      });

      markersRef.current.push(marker);
      itemMarkersMapRef.current.set(item.id, marker);
    });

    // ONLY on first initial load, frame all markers once
    if (!hasInitializedViewRef.current && (items.length > 0 || userLat)) {
      hasInitializedViewRef.current = true;
      const all = [...markersRef.current];
      if (userMarkerRef.current) all.push(userMarkerRef.current);
      if (all.length > 0) {
        try {
          const group = L.featureGroup(all);
          map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 13 });
        } catch (e) {
          map.setView([userLat, userLng], 12);
        }
      } else {
        map.setView([userLat, userLng], 12);
      }
    }
  }, [positionedItems, markerStyle, showActionCircles, onSelectItem]);

  // Focus specific item on customer click
  const handleFocusItem = (item: HelpItem) => {
    const map = mapInstanceRef.current;
    if (!map || !item.location) return;
    map.flyTo([item.location.lat, item.location.lng], 15, { duration: 0.8 });
    const marker = itemMarkersMapRef.current.get(item.id);
    if (marker) {
      setTimeout(() => marker.openPopup(), 450);
    }
  };

  const offersCount = items.filter((i) => i.type === 'offer').length;
  const requestsCount = items.filter((i) => i.type === 'request').length;
  const freeCount = items.filter((i) => i.isFree).length;
  const dynamicCount = items.filter((i) => i.trackingType !== 'static').length;
  const staticCount = items.filter((i) => i.trackingType === 'static').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <span>🗺️</span> Mappa Interattiva di Vicinato
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Naviga liberamente sulla mappa: vedi sia annunci dinamici (in movimento con l'autore) sia annunci statici (punti fissi con raggio di influenza).
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleFitAll}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Inquadra tutti i pin sulla mappa"
          >
            <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Inquadra Tutti</span>
          </button>
          <button
            onClick={handleCenterUser}
            className="bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Centra la mappa sulla tua posizione attuale"
          >
            <Crosshair className="w-3.5 h-3.5 text-teal-600" />
            <span>La Mia Posizione</span>
          </button>
          <button
            onClick={onUpdateLocation}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
            title="Rileva nuovamente le coordinate GPS"
          >
            <Navigation className="w-3.5 h-3.5 text-teal-600" />
            <span>Aggiorna GPS</span>
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

      {/* Map Filter Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Filter Type & Tracking Pills */}
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-teal-600" /> Modalità:
            </span>
            <button
              onClick={() => setFilterTracking('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterTracking === 'all'
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              Tutti ({items.length})
            </button>
            <button
              onClick={() => setFilterTracking('dynamic')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                filterTracking === 'dynamic'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200'
              }`}
              title="Annunci che seguono la persona via GPS"
            >
              <Radio className="w-3 h-3 text-current animate-pulse" />
              <span>In Movimento</span>
              <span className="opacity-80 text-[10px]">({dynamicCount})</span>
            </button>
            <button
              onClick={() => setFilterTracking('static')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                filterTracking === 'static'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
              }`}
              title="Annunci fissati a un indirizzo con raggio di influenza"
            >
              <span>📌 Punti Fissi</span>
              <span className="opacity-80 text-[10px]">({staticCount})</span>
            </button>

            <span className="text-gray-300 mx-1">|</span>

            <button
              onClick={() => setFilterType(filterType === 'offer' ? 'all' : 'offer')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                filterType === 'offer'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <span>🤝 Offerte</span>
              <span className="opacity-80 text-[10px]">({offersCount})</span>
            </button>
            <button
              onClick={() => setFilterType(filterType === 'request' ? 'all' : 'request')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                filterType === 'request'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <span>🆘 Richieste</span>
              <span className="opacity-80 text-[10px]">({requestsCount})</span>
            </button>
            <button
              onClick={() => setFilterType(filterType === 'free' ? 'all' : 'free')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                filterType === 'free'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <span>🎁 Gratuiti</span>
              <span className="opacity-80 text-[10px]">({freeCount})</span>
            </button>
          </div>

          {/* Marker Display and Anti-Overlap Controls */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setMarkerStyle('pill')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  markerStyle === 'pill'
                    ? 'bg-white text-gray-900 shadow-xs font-bold'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                title="Mostra cartellini con titolo"
              >
                Cartellini
              </button>
              <button
                type="button"
                onClick={() => setMarkerStyle('compact')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  markerStyle === 'compact'
                    ? 'bg-white text-teal-700 shadow-xs font-bold'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                title="Mostra icone compatte per evitare sovrapposizioni visive"
              >
                Icone Compatte
              </button>
            </div>

            {/* Anti-Overlap Checkbox */}
            <button
              type="button"
              onClick={() => setAntiOverlap(!antiOverlap)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                antiOverlap
                  ? 'bg-teal-50 border-teal-200 text-teal-800 font-bold'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}
              title="Separa radialmente gli annunci con coordinate identiche o vicine"
            >
              <div
                className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] text-white ${
                  antiOverlap ? 'bg-teal-600' : 'bg-gray-300'
                }`}
              >
                {antiOverlap && <Check className="w-2.5 h-2.5" />}
              </div>
              <span>Separa vicini</span>
            </button>

            {/* Action Radius Circles Toggle */}
            <button
              type="button"
              onClick={() => setShowActionCircles(!showActionCircles)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                showActionCircles
                  ? 'bg-teal-50 border-teal-200 text-teal-800 font-bold'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}
              title="Mostra i cerchi del raggio di disponibilità impostati dagli autori"
            >
              <div
                className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[10px] text-white ${
                  showActionCircles ? 'bg-teal-600' : 'bg-gray-300'
                }`}
              >
                {showActionCircles && <Check className="w-2.5 h-2.5" />}
              </div>
              <span>Bolle d'Azione</span>
            </button>

            {/* Only In Action Radius Toggle */}
            <button
              type="button"
              onClick={() => setOnlyInActionRadius(!onlyInActionRadius)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                onlyInActionRadius
                  ? 'bg-teal-700 border-teal-700 text-white font-bold shadow-xs'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
              title="Mostra solo gli annunci la cui sfera di disponibilità copre la tua posizione GPS"
            >
              <Radio className={`w-3.5 h-3.5 ${onlyInActionRadius ? 'text-teal-200 animate-pulse' : 'text-gray-400'}`} />
              <span>{onlyInActionRadius ? '🎯 Coprono dove sono' : '🌐 Tutti gli annunci'}</span>
            </button>
          </div>
        </div>

        {/* Second Row: Category & Search Keyword */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-gray-100">
          {/* Category Dropdown */}
          <div className="w-full sm:w-64">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs font-medium bg-gray-50 hover:bg-gray-100 focus:bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-800 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all cursor-pointer"
            >
              <option value="all">📂 Tutte le Categorie ({items.length})</option>
              {availableCategories.map((cat) => {
                const count = items.filter((i) => i.category === cat).length;
                return (
                  <option key={cat} value={cat}>
                    {cat} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Search Query Input */}
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca per titolo, descrizione o autore..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-gray-50 hover:bg-gray-100 focus:bg-white border border-gray-200 rounded-xl pl-9 pr-8 py-2 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Active Filter Badge and Reset */}
          {hasActiveFilters && (
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-1.5 rounded-xl border border-teal-100">
                Mostrati: {positionedItems.length} su {items.length}
              </span>
              <button
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 hover:underline font-bold px-2 py-1 cursor-pointer"
              >
                Azzera Filtri
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Select Carousel for map markers */}
      {filteredItems.length > 0 ? (
        <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-xs flex items-center space-x-2 overflow-x-auto">
          <span className="text-xs font-bold text-gray-500 shrink-0 ml-1">
            Visibili sulla mappa ({filteredItems.length}):
          </span>
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleFocusItem(item)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:border-teal-500 bg-gray-50 hover:bg-teal-50 text-xs font-medium text-gray-800 shrink-0 transition-all cursor-pointer"
              title="Clicca per centrare la mappa su questo annuncio"
            >
              <span>{item.type === 'offer' ? '🤝' : '🆘'}</span>
              <span className="font-bold truncate max-w-[130px]">{item.title}</span>
              <span className="text-[10px] text-gray-400">({item.userNickname})</span>
            </button>
          ))}
        </div>
      ) : hasActiveFilters ? (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center justify-between text-xs text-amber-900">
          <span>Nessun annuncio corrisponde ai filtri selezionati.</span>
          <button
            onClick={handleResetFilters}
            className="font-bold text-amber-900 hover:underline ml-2 cursor-pointer"
          >
            Reimposta tutti i filtri
          </button>
        </div>
      ) : null}

      {/* Map Container */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden relative">
        <div ref={mapContainerRef} className="w-full h-[620px] z-10" />

        {/* Custom Map Navigation Controls (Top Right) */}
        <div className="absolute top-4 right-4 z-20 flex flex-col space-y-2">
          <div className="bg-white/95 backdrop-blur-md rounded-xl border border-gray-200 shadow-md flex flex-col overflow-hidden">
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2.5 hover:bg-gray-100 text-gray-700 active:bg-gray-200 border-b border-gray-200 transition-all cursor-pointer"
              title="Ingrandisci (Zoom In)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-5 h-5 text-gray-800" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2.5 hover:bg-gray-100 text-gray-700 active:bg-gray-200 transition-all cursor-pointer"
              title="Rimpicciolisci (Zoom Out)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-5 h-5 text-gray-800" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleCenterUser}
            className="p-2.5 bg-white/95 backdrop-blur-md hover:bg-teal-50 text-teal-700 rounded-xl border border-gray-200 shadow-md transition-all cursor-pointer"
            title="Centra su di me"
            aria-label="La mia posizione"
          >
            <Crosshair className="w-5 h-5 text-teal-700" />
          </button>

          <button
            type="button"
            onClick={handleFitAll}
            className="p-2.5 bg-white/95 backdrop-blur-md hover:bg-emerald-50 text-emerald-700 rounded-xl border border-gray-200 shadow-md transition-all cursor-pointer"
            title="Mostra tutti i punti"
            aria-label="Mostra tutti i punti"
          >
            <Maximize2 className="w-5 h-5 text-emerald-700" />
          </button>
        </div>

        {/* Map Legend (Bottom Left) */}
        <div className="absolute bottom-6 left-6 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-gray-200 shadow-lg space-y-2 text-xs max-w-xs">
          <div className="font-bold text-gray-900 mb-1 flex items-center justify-between">
            <span>Legenda Mappa</span>
            <span className="text-[10px] text-gray-400 font-normal">Zoom: {currentZoom}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-teal-600 inline-block"></span>
            <span className="text-gray-700">Offerte ({positionedItems.filter((p) => p.item.type === 'offer').length})</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
            <span className="text-gray-700">Richieste ({positionedItems.filter((p) => p.item.type === 'request').length})</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-teal-800 border border-white inline-block"></span>
            <span className="text-gray-700">La tua posizione GPS</span>
          </div>
          {antiOverlap && (
            <div className="pt-1 border-t border-gray-100 text-[10px] text-teal-700 flex items-center gap-1 font-medium">
              <span>✨ Anti-sovrapposizione attiva</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
