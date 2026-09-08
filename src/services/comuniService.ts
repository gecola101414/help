// Client-side Italian Municipalities & Geocoding Service
// Works seamlessly on Vercel (static) and local/Cloud Run Express backend

export interface ComuneItem {
  nome: string;
  sigla: string;
  regione: string;
  provincia: string;
  cap: string;
  lat: number;
  lng: number;
}

let cachedComuni: ComuneItem[] | null = null;
let loadPromise: Promise<ComuneItem[]> | null = null;

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export async function loadComuni(): Promise<ComuneItem[]> {
  if (cachedComuni && cachedComuni.length > 0) {
    return cachedComuni;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      // 1. Try static file in public/ (available on Vercel & Vite)
      const res = await fetch("/comuni_italiani.json");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          cachedComuni = data;
          return data;
        }
      }
    } catch (e) {
      console.warn("Could not load /comuni_italiani.json from root, trying /api/comuni fallback", e);
    }

    try {
      // 2. Try server API endpoint if Express is running
      const resApi = await fetch("/api/comuni?q=a");
      if (resApi.ok) {
        const dataApi = await resApi.json();
        if (Array.isArray(dataApi) && dataApi.length > 0) {
          cachedComuni = dataApi;
          return dataApi;
        }
      }
    } catch (e) {
      console.warn("Could not load from /api/comuni", e);
    }

    cachedComuni = [];
    return [];
  })();

  return loadPromise;
}

export async function searchComuni(query: string, maxResults = 25): Promise<ComuneItem[]> {
  const q = normalize(query);
  if (!q) return [];

  const list = await loadComuni();
  if (!list || list.length === 0) {
    // If client-side json failed, try server endpoint with query
    try {
      const res = await fetch(`/api/comuni?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return [];
  }

  const exactMatches: ComuneItem[] = [];
  const startsWithMatches: ComuneItem[] = [];
  const wordStartsWithMatches: ComuneItem[] = [];
  const containsMatches: ComuneItem[] = [];
  const provinceMatches: ComuneItem[] = [];

  for (const item of list) {
    const normName = normalize(item.nome);
    const normSigla = normalize(item.sigla);
    const normProv = normalize(item.provincia);

    if (normName === q) {
      exactMatches.push(item);
    } else if (normName.startsWith(q)) {
      startsWithMatches.push(item);
    } else if (normName.split(/\s+/).some((w) => w.startsWith(q))) {
      wordStartsWithMatches.push(item);
    } else if (normName.includes(q)) {
      containsMatches.push(item);
    } else if (normSigla === q || normProv.startsWith(q)) {
      provinceMatches.push(item);
    }

    if (exactMatches.length + startsWithMatches.length >= maxResults * 2) {
      break;
    }
  }

  return [
    ...exactMatches,
    ...startsWithMatches,
    ...wordStartsWithMatches,
    ...containsMatches,
    ...provinceMatches,
  ].slice(0, maxResults);
}

export async function getComuneByName(name: string): Promise<ComuneItem | null> {
  const q = normalize(name);
  if (!q) return null;
  const list = await loadComuni();
  return list.find((item) => normalize(item.nome) === q) || null;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  found: boolean;
  isStreetLevel?: boolean;
  isComuneCenter?: boolean;
}

export async function resolveAddressGeocode(
  comune: string,
  via?: string,
  civico?: string
): Promise<GeocodeResult> {
  const cleanComune = comune.trim();
  const cleanVia = via ? via.trim() : "";
  const cleanCivico = civico ? civico.trim() : "";

  // 1. First look up the comune centroid from our trusted database
  const comuneItem = await getComuneByName(cleanComune);
  const fallbackLat = comuneItem ? comuneItem.lat : 45.4642;
  const fallbackLng = comuneItem ? comuneItem.lng : 9.1900;
  const comuneDisplay = comuneItem
    ? `${comuneItem.nome} (${comuneItem.sigla}), ${comuneItem.regione}`
    : cleanComune;

  // 2. If no street specified, return the official municipality center
  if (!cleanVia) {
    return {
      lat: fallbackLat,
      lng: fallbackLng,
      displayName: `Centro di ${comuneDisplay}`,
      found: true,
      isComuneCenter: true,
    };
  }

  // 3. If street is provided, attempt precision geocoding
  // First try local backend /api/geocode (works in full-stack dev/Cloud Run)
  try {
    const res = await fetch(
      `/api/geocode?comune=${encodeURIComponent(cleanComune)}&via=${encodeURIComponent(cleanVia)}&civico=${encodeURIComponent(cleanCivico)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.lat === "number" && typeof data.lng === "number") {
        return data;
      }
    }
  } catch {
    // Backend API not available (e.g. on Vercel static deployment)
  }

  // 4. On Vercel (or when backend API is unreachable), query Nominatim directly from browser
  try {
    const queryParts = [cleanVia, cleanCivico, cleanComune, "Italia"].filter(Boolean).join(", ");
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryParts)}&countrycodes=it&limit=1&addressdetails=1`;
    const nomRes = await fetch(nomUrl, {
      headers: { Accept: "application/json" },
    });
    if (nomRes.ok) {
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        const match = nomData[0];
        const parsedLat = parseFloat(match.lat);
        const parsedLng = parseFloat(match.lon);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          return {
            lat: parsedLat,
            lng: parsedLng,
            displayName: match.display_name,
            found: true,
            isStreetLevel: true,
          };
        }
      }
    }
  } catch (err) {
    console.warn("Direct Nominatim geocoding failed, falling back to comune center", err);
  }

  // 5. If street geocoding failed or returned nothing, return Comune center with 100% reliability
  return {
    lat: fallbackLat,
    lng: fallbackLng,
    displayName: `Centro di ${comuneDisplay}`,
    found: true,
    isComuneCenter: true,
  };
}
