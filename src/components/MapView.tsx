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
, User } from 'lucide-react';

interface MapViewProps {
  items: HelpItem[];
  user: UserProfile | null;
  onSelectItem: (item: HelpItem) => void;
  onOpenCreate: () => void;
  onUpdateLocation: () => void;
  followedUserId?: string | null;
  setFollowedUserId?: (id: string | null) => void;
}

interface PositionedItem {
  item: HelpItem;
  displayLat: number;
  displayLng: number;
  isDisplaced: boolean;
}

const getCategorySymbol = (catName: string) => {
  const c = (catName || '').toLowerCase();
  if (c.includes('spesa') || c.includes('commissioni')) return '🛒';
  if (c.includes('domestici') || c.includes('lavoretti')) return '🔧';
  if (c.includes('compagnia') || c.includes('assistenza')) return '☕';
  if (c.includes('digital') || c.includes('informatico')) return '💻';
  if (c.includes('riparazione') || c.includes('bici')) return '🚲';
  if (c.includes('ripetizioni') || c.includes('studio')) return '📚';
  if (c.includes('burocrazia') || c.includes('pratiche')) return '📄';
  if (c.includes('trasporto') || c.includes('passaggio')) return '🚗';
  if (c.includes('animali') || c.includes('pet')) return '🐾';
  if (c.includes('utensili') || c.includes('attrezzi')) return '🔨';
  return '💡';
};

interface PositionedCluster {
  id: string;
  lat: number;
  lng: number;
  items: HelpItem[];
  isCluster: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  items,
  user,
  onSelectItem,
  onOpenCreate,
  onUpdateLocation,
  followedUserId,
  setFollowedUserId,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const circlesRef = useRef<L.Circle[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const itemMarkersMapRef = useRef<Map<string, L.Marker>>(new Map());
  const hasInitializedViewRef = useRef(false);

  const [currentZoom, setCurrentZoom] = useState<number>(12);
  const [activeClusterModal, setActiveClusterModal] = useState<HelpItem[] | null>(null);

  // Modal local filter states
  const [modalFilterType, setModalFilterType] = useState<'all' | 'offer' | 'request'>('all');
  const [modalSelectedCategory, setModalSelectedCategory] = useState<string>('all');

  // Map Filter Bar Collapsible State
  const [isFilterBarOpen, setIsFilterBarOpen] = useState<boolean>(false);

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
      // Follow filter
      if (followedUserId && item.userId !== followedUserId) {
        return false;
      }

      // Type filter
      if (filterType === 'offer' && item.type !== 'offer') return false;
      if (filterType === 'request' && item.type !== 'request') return false;
      if (filterType === 'free' && !item.isFree) return false;

      // Tracking type filter (Dynamic vs Static)
      if (filterTracking === 'dynamic' && item.trackingType === 'static') return false;
      if (filterTracking === 'static' && item.trackingType !== 'static') return false;

      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

      // Creator Action Radius filter (100m fissi per annunci dinamici, 0-10km per punti fissi)
      if (onlyInActionRadius) {
        const isStatic = item.trackingType === 'static';
        const effectiveRadius = isStatic
          ? Math.min(10, Math.max(0.1, item.actionRadiusKm || 1))
          : 0.1; // 100 metri fissa per annunci dinamici
        const isCovered = item.distanceKm !== undefined && item.distanceKm <= effectiveRadius;
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

  // Compute positioned clusters for announcements within 100m radius
  const positionedClusters: PositionedCluster[] = useMemo(() => {
    const validItems = filteredItems.filter(
      (item) => item.location && item.location.lat && item.location.lng
    );

    if (!antiOverlap) {
      return validItems.map((item) => ({
        id: item.id,
        lat: item.location.lat,
        lng: item.location.lng,
        items: [item],
        isCluster: false,
      }));
    }

    const clusters: HelpItem[][] = [];

    validItems.forEach((item) => {
      const existingCluster = clusters.find((cluster) => {
        const ref = cluster[0];
        const dLat = Math.abs(ref.location.lat - item.location.lat);
        const dLng = Math.abs(ref.location.lng - item.location.lng);
        // ~100 meters threshold (~0.0009 degrees)
        return dLat < 0.0009 && dLng < 0.0011;
      });

      if (existingCluster) {
        existingCluster.push(item);
      } else {
        clusters.push([item]);
      }
    });

    return clusters.map((cluster, idx) => {
      const baseLat = cluster[0].location.lat;
      const baseLng = cluster[0].location.lng;
      if (cluster.length === 1) {
        return {
          id: cluster[0].id,
          lat: baseLat,
          lng: baseLng,
          items: cluster,
          isCluster: false,
        };
      } else {
        return {
          id: `cluster-${idx}-${baseLat}-${baseLng}`,
          lat: baseLat,
          lng: baseLng,
          items: cluster,
          isCluster: true,
        };
      }
    });
  }, [filteredItems, antiOverlap]);

  // Categories available inside the open cluster modal
  const clusterCategories = useMemo(() => {
    if (!activeClusterModal) return [];
    const set = new Set<string>();
    activeClusterModal.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [activeClusterModal]);

  // Filtered items inside the open cluster modal
  const filteredClusterItems = useMemo(() => {
    if (!activeClusterModal) return [];
    return activeClusterModal.filter((item) => {
      if (modalFilterType === 'offer' && item.type !== 'offer') return false;
      if (modalFilterType === 'request' && item.type !== 'request') return false;
      if (modalSelectedCategory !== 'all' && item.category !== modalSelectedCategory) return false;
      return true;
    });
  }, [activeClusterModal, modalFilterType, modalSelectedCategory]);

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

  // 3. Update Item Markers with filtered and positioned clusters (Zero auto-pan/reset)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old item markers & circles
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    circlesRef.current.forEach((circle) => circle.remove());
    circlesRef.current = [];
    itemMarkersMapRef.current.clear();

    // Render positioned clusters
    positionedClusters.forEach(({ id, lat, lng, items: clusterItems, isCluster }) => {
      if (!isCluster) {
        const item = clusterItems[0];
        const isOffer = item.type === 'offer';
        const isStatic = item.trackingType === 'static';
        
        const bgColor = isStatic
          ? (isOffer ? '#d97706' : '#b45309')
          : (isOffer ? '#0d9488' : '#2563eb');
        
        const emoji = isStatic
          ? '📌'
          : (isOffer ? '🤝' : '🆘');

        // Draw Action Radius Circle
        if (showActionCircles && item.location?.lat) {
          const radiusMeters = isStatic
            ? Math.min(10000, Math.max(100, (item.actionRadiusKm || 1) * 1000))
            : 100;

          const circle = L.circle([item.location.lat, item.location.lng], {
            radius: radiusMeters,
            color: bgColor,
            fillColor: bgColor,
            fillOpacity: isStatic ? 0.08 : 0.16,
            weight: isStatic ? 2 : 2.5,
            dashArray: isStatic ? '4, 4' : undefined,
          }).addTo(map);
          circlesRef.current.push(circle);
        }

        let customIcon: L.DivIcon;

        // Lightweight Single Marker: Clean circular badge showing ONLY category symbol
        customIcon = L.divIcon({
          className: 'custom-help-marker-single',
          html: `<div style="background-color: ${bgColor}; color: white; width: 36px; height: 36px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; font-size: 17px; cursor: pointer; transition: transform 0.15s ease;" title="${item.title}">
            ${getCategorySymbol(item.category)}
          </div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        marker.on('mouseover', () => {
          marker.setZIndexOffset(1000);
        });
        marker.on('mouseout', () => {
          marker.setZIndexOffset(0);
        });

        marker.on('click', () => {
          onSelectItem(item);
        });

        const distText = item.distanceKm !== undefined
          ? item.distanceKm < 0.1
            ? `${Math.round(item.distanceKm * 1000)} m da te (Entro 100m!)`
            : item.distanceKm < 1
            ? `${Math.round(item.distanceKm * 1000)} m da te`
            : `${item.distanceKm.toFixed(1)} km da te`
          : '';

        const popupContent = document.createElement('div');
        popupContent.style.fontFamily = 'sans-serif';
        popupContent.style.padding = '6px';
        popupContent.style.minWidth = '230px';
        popupContent.innerHTML = `
          <div style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: ${bgColor}; margin-bottom: 2px;">
            ${isStatic ? '📌 Annuncio Fisso (Luogo)' : (isOffer ? '🏃 Disponibilità Dinamica' : '🏃 Richiesta Dinamica')}
          </div>
          <div style="font-weight: bold; font-size: 14px; color: #1f2937; margin-bottom: 4px;">${getCategorySymbol(item.category)} ${item.title}</div>
          <div style="font-size: 12px; color: #4b5563; margin-bottom: 4px;">${item.userNickname} ${distText ? `• <strong>${distText}</strong>` : ''}</div>
          <div style="font-size: 11px; color: ${isStatic ? '#92400e' : (isOffer ? '#9f1239' : '#1e40af')}; background-color: ${isStatic ? '#fffbeb' : (isOffer ? '#fff1f2' : '#eff6ff')}; border: 1px solid ${isStatic ? '#fde68a' : (isOffer ? '#fecdd3' : '#bfdbfe')}; padding: 5px 7px; border-radius: 6px; margin-bottom: 6px; line-height: 1.4;">
            ${isStatic
              ? `📌 <strong>Punto Fisso:</strong> Area d'influenza <strong>${item.actionRadiusKm ? (item.actionRadiusKm < 1 ? (Math.round(item.actionRadiusKm * 1000)) + ' m' : item.actionRadiusKm + ' km') : '1 km'}</strong> (max 10 km).`
              : `🏃 <strong>Dinamico (Segue ${item.userNickname}):</strong> Distanza fissa <strong>100 metri</strong> per stimolare l'interazione umana diretta.`
            }
          </div>
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 6px;">${item.location?.address || ''}</div>
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
      } else {
        // Lightweight Cluster Union Marker (Removed 'Gruppo' text, icon 🔗 + count + emojis)
        const count = clusterItems.length;
        const emojisPreview = Array.from(new Set(clusterItems.map(i => getCategorySymbol(i.category)))).slice(0, 3).join(' ');

        // Draw Group Action Radius Circle
        if (showActionCircles && lat && lng) {
          const staticRadii = clusterItems
            .filter((i) => i.trackingType === 'static')
            .map((i) => Math.min(10000, Math.max(100, (i.actionRadiusKm || 1) * 1000)));

          let groupRadiusMeters = 150;
          if (staticRadii.length > 0) {
            groupRadiusMeters = Math.max(...staticRadii);
          } else {
            groupRadiusMeters = Math.min(300, 150 + (clusterItems.length - 1) * 25);
          }

          const groupCircle = L.circle([lat, lng], {
            radius: groupRadiusMeters,
            color: '#6366f1',
            fillColor: '#8b5cf6',
            fillOpacity: 0.14,
            weight: 2,
            dashArray: '5, 5',
          }).addTo(map);
          circlesRef.current.push(groupCircle);
        }

        const clusterIcon = L.divIcon({
          className: 'custom-help-cluster-marker',
          html: `<div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 4px 9px; border-radius: 20px; font-size: 13px; font-weight: 800; white-space: nowrap; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.45); border: 2.5px solid white; display: flex; align-items: center; gap: 5px; cursor: pointer;" title="${count} gentilezze raggruppate in raggio 100m">
            <span style="font-size: 14px;">🔗</span>
            <span style="background: rgba(255,255,255,0.25); padding: 1px 6px; border-radius: 12px; font-size: 12px; font-weight: 900;">${count}</span>
            <span style="font-size: 12px;">${emojisPreview}</span>
          </div>`,
          iconSize: [80, 32],
          iconAnchor: [40, 16],
        });

        const clusterMarker = L.marker([lat, lng], { icon: clusterIcon }).addTo(map);

        clusterMarker.on('mouseover', () => {
          clusterMarker.setZIndexOffset(1000);
        });
        clusterMarker.on('mouseout', () => {
          clusterMarker.setZIndexOffset(0);
        });

        clusterMarker.on('click', () => {
          setModalFilterType('all');
          setModalSelectedCategory('all');
          setActiveClusterModal(clusterItems);
        });

        markersRef.current.push(clusterMarker);
      }
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
  }, [positionedClusters, markerStyle, showActionCircles, onSelectItem, antiOverlap]);

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
    <div className="w-full h-[calc(100vh-80px)] min-h-[680px] p-2 sm:p-4 animate-in fade-in duration-300">
      {/* Map Container - Full Screen & Clean */}
      <div className="w-full h-full bg-white rounded-3xl border border-gray-200 shadow-md overflow-hidden relative">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Top Right Floating Action & Navigation Controls */}
        <div className="absolute top-4 right-4 z-20 flex flex-col items-end space-y-2">
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCreate}
              className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-lg transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Pubblica Aiuto</span>
            </button>
            <button
              onClick={onUpdateLocation}
              className="bg-white/95 backdrop-blur-md hover:bg-gray-100 text-gray-800 border border-gray-200 text-xs font-bold px-3 py-2 rounded-xl shadow-md transition-all flex items-center space-x-1 cursor-pointer"
              title="Aggiorna Posizione GPS"
            >
              <Navigation className="w-3.5 h-3.5 text-teal-600" />
              <span>GPS</span>
            </button>
          </div>

          {/* Navigation Zoom & Location Stack */}
          <div className="bg-white/95 backdrop-blur-md rounded-xl border border-gray-200 shadow-md flex flex-col overflow-hidden">
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-2.5 hover:bg-gray-100 text-gray-700 active:bg-gray-200 border-b border-gray-200 transition-all cursor-pointer"
              title="Ingrandisci (Zoom In)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-4 h-4 text-gray-800" />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-2.5 hover:bg-gray-100 text-gray-700 active:bg-gray-200 border-b border-gray-200 transition-all cursor-pointer"
              title="Rimpicciolisci (Zoom Out)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-4 h-4 text-gray-800" />
            </button>
            <button
              type="button"
              onClick={handleCenterUser}
              className="p-2.5 hover:bg-teal-50 text-teal-700 border-b border-gray-200 transition-all cursor-pointer"
              title="Centra sulla mia posizione"
              aria-label="La mia posizione"
            >
              <Crosshair className="w-4 h-4 text-teal-700" />
            </button>
            <button
              type="button"
              onClick={handleFitAll}
              className="p-2.5 hover:bg-emerald-50 text-emerald-700 transition-all cursor-pointer"
              title="Mostra tutti i punti sulla mappa"
              aria-label="Inquadra tutti"
            >
              <Maximize2 className="w-4 h-4 text-emerald-700" />
            </button>
          </div>
        </div>

        {/* Followed User Indicator Badge (Top Left) */}
        {followedUserId && (
          <div className="absolute top-4 left-4 z-20 bg-amber-100/95 backdrop-blur-md border border-amber-300 rounded-2xl px-3.5 py-2 flex items-center space-x-2 shadow-lg text-xs">
            <User className="w-4 h-4 text-amber-700" />
            <span className="font-bold text-amber-900">Mappa seguendo un utente</span>
            {setFollowedUserId && (
              <button
                onClick={() => setFollowedUserId(null)}
                className="ml-2 font-bold text-amber-800 hover:underline cursor-pointer"
              >
                Rimuovi
              </button>
            )}
          </div>
        )}

        {/* Map Legend & Integrated Filters Card (Bottom Right) */}
        <div className="absolute bottom-4 right-4 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-gray-200/90 shadow-xl space-y-2.5 text-xs w-72 sm:w-80 transition-all max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="font-bold text-gray-900 flex items-center justify-between border-b border-gray-100 pb-2">
            <span className="text-sm font-black flex items-center gap-1.5 text-gray-900">
              <span>🗺️</span> Legenda Mappa
            </span>
            <span className="text-[10px] text-gray-400 font-semibold bg-gray-100 px-2 py-0.5 rounded-full">
              Zoom: {currentZoom}
            </span>
          </div>

          {/* Integrated Dropdown Filters inside Legenda Card */}
          <div className="space-y-2 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/90">
            <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
              <span>🔍 Filtra Mappa:</span>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="text-[10px] font-extrabold text-rose-600 hover:underline cursor-pointer"
                >
                  Azzera
                </button>
              )}
            </div>

            {/* Tipo Annuncio Dropdown */}
            <div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-2xs"
              >
                <option value="all">Tutte le Gentilezze ({items.length})</option>
                <option value="offer">🤝 Solo Offerte ({offersCount})</option>
                <option value="request">🆘 Solo Richieste ({requestsCount})</option>
                <option value="free">🎁 Solo Gratuiti ({freeCount})</option>
              </select>
            </div>

            {/* Categoria Dropdown */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-2xs"
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

            {/* Modalità Tracking Dropdown */}
            <div>
              <select
                value={filterTracking}
                onChange={(e) => setFilterTracking(e.target.value as any)}
                className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-2xs"
              >
                <option value="all">🌐 Tutti i Tipi (Dinamici + Fissi)</option>
                <option value="dynamic">🏃 Solo Dinamici GPS ({dynamicCount})</option>
                <option value="static">📌 Solo Punti Fissi ({staticCount})</option>
              </select>
            </div>

            {/* Toggles */}
            <div className="pt-1 space-y-1 text-[11px]">
              <label className="flex items-center justify-between font-bold text-slate-700 cursor-pointer">
                <span>🔗 Raggruppa 100m</span>
                <input
                  type="checkbox"
                  checked={antiOverlap}
                  onChange={(e) => setAntiOverlap(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5 cursor-pointer"
                />
              </label>
              <label className="flex items-center justify-between font-bold text-slate-700 cursor-pointer">
                <span>⭕ Cerchi d'influenza</span>
                <input
                  type="checkbox"
                  checked={showActionCircles}
                  onChange={(e) => setShowActionCircles(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 h-3.5 w-3.5 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Legend Items */}
          <div className="space-y-1.5 pt-1 text-xs">
            <div className="flex items-center space-x-2 font-medium">
              <span className="w-3 h-3 rounded-full bg-teal-600 inline-block shrink-0"></span>
              <span className="text-gray-800">Offerte ({filteredItems.filter((i) => i.type === 'offer').length})</span>
            </div>
            <div className="flex items-center space-x-2 font-medium">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block shrink-0"></span>
              <span className="text-gray-800">Richieste ({filteredItems.filter((i) => i.type === 'request').length})</span>
            </div>
            <div className="flex items-center space-x-2 font-medium">
              <span className="text-xs shrink-0">📌</span>
              <span className="text-amber-800">Punti Fissi (Area 0-10 km)</span>
            </div>
            <div className="flex items-center space-x-2 font-medium">
              <span className="text-xs shrink-0">🏃</span>
              <span className="text-teal-800">Dinamici (100m fissi GPS)</span>
            </div>
            <div className="flex items-center space-x-2 font-medium">
              <span className="text-xs font-bold text-indigo-700 shrink-0">🔗</span>
              <span className="text-indigo-900">Gruppi (Raggio &lt;100m)</span>
            </div>
            <div className="flex items-center space-x-2 font-medium">
              <span className="w-3 h-3 rounded-full bg-teal-800 border border-white inline-block shrink-0"></span>
              <span className="text-gray-800">La tua posizione GPS</span>
            </div>
            {antiOverlap && (
              <div className="pt-1.5 border-t border-gray-100 text-[10px] text-teal-700 flex items-center gap-1 font-extrabold">
                <span>✨ Raggruppamento 100m attivo</span>
              </div>
            )}
          </div>
        </div>

        {/* Cluster Expansion Modal Overlay */}
        {activeClusterModal && (
          <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
              {/* Modal Top Banner */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl font-black">
                    🔗
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Gruppo di Gentilezze (Raggio 100m)</h3>
                    <p className="text-xs text-indigo-100">
                      Mostrate {filteredClusterItems.length} di {activeClusterModal.length} gentilezze nel gruppo
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveClusterModal(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Dropdown Filters Bar */}
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-slate-700">Tipo:</span>
                  <select
                    value={modalFilterType}
                    onChange={(e) => setModalFilterType(e.target.value as any)}
                    className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value="all">Tutti ({activeClusterModal.length})</option>
                    <option value="offer">🤝 Disponibilità ({activeClusterModal.filter(i => i.type === 'offer').length})</option>
                    <option value="request">🆘 Richieste ({activeClusterModal.filter(i => i.type === 'request').length})</option>
                  </select>
                </div>

                {clusterCategories.length > 1 && (
                  <div className="flex items-center space-x-1.5">
                    <span className="font-bold text-slate-700">Categoria:</span>
                    <select
                      value={modalSelectedCategory}
                      onChange={(e) => setModalSelectedCategory(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                    >
                      <option value="all">Tutte le Categorie ({activeClusterModal.length})</option>
                      {clusterCategories.map((cat) => {
                        const count = activeClusterModal.filter((i) => i.category === cat).length;
                        return (
                          <option key={cat} value={cat}>
                            {getCategorySymbol(cat)} {cat} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
                {filteredClusterItems.length > 0 ? (
                  filteredClusterItems.map((item) => {
                    const isOffer = item.type === 'offer';
                    const symbol = getCategorySymbol(item.category);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setActiveClusterModal(null);
                          onSelectItem(item);
                        }}
                        className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-2xs shrink-0 ${
                            isOffer ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {symbol}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                                isOffer ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {isOffer ? 'Disponibilità' : 'Richiesta'}
                              </span>
                              <span className="text-xs text-slate-500 font-medium">{item.category}</span>
                            </div>
                            <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-700 transition-colors mt-0.5">
                              {item.title}
                            </h4>
                            <p className="text-xs text-slate-600 mt-0.5">Da: {item.userNickname} {item.distanceKm !== undefined ? `• ${Math.round(item.distanceKm * 1000)}m` : ''}</p>
                          </div>
                        </div>

                        <div className="px-3 py-1.5 rounded-lg bg-indigo-600 group-hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs shrink-0 transition-colors">
                          Apri →
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    <p className="font-semibold text-sm">Nessuna gentilezza corrisponde ai filtri selezionati nel gruppo.</p>
                    <button
                      onClick={() => {
                        setModalFilterType('all');
                        setModalSelectedCategory('all');
                      }}
                      className="mt-2 text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Mostra tutte le gentilezze del gruppo
                    </button>
                  </div>
                )}
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-500 font-medium">
                Clicca su una gentilezza per aprirne i dettagli e contattare l'utente.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
