import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const DATA_DIR = path.join(process.cwd(), "data");
const ITEMS_FILE = path.join(DATA_DIR, "help_items.json");

function getStoredItems(): any[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    let items: any[] = [];
    if (!fs.existsSync(ITEMS_FILE)) {
      items = [];
    } else {
      const data = fs.readFileSync(ITEMS_FILE, "utf-8");
      items = JSON.parse(data) || [];
    }
    return items;
  } catch (err) {
    console.error("Error reading items file:", err);
    return [];
  }
}

const RESET_FILE = path.join(DATA_DIR, "reset_state.json");
function getLastResetTimestamp(): number {
  try {
    if (fs.existsSync(RESET_FILE)) {
      const data = JSON.parse(fs.readFileSync(RESET_FILE, "utf-8"));
      return data.resetAt || 0;
    }
  } catch {}
  return 0;
}

function setLastResetTimestamp(ts: number) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(RESET_FILE, JSON.stringify({ resetAt: ts }, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving reset state:", err);
  }
}

function saveStoredItems(items: any[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ITEMS_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving items file:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Real-time Server-Sent Events (SSE) client registry
  const sseClients = new Set<express.Response>();

  function broadcastItemsUpdate(items: any[]) {
    const payload = `data: ${JSON.stringify(items)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(payload);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  // SSE Stream endpoint for instantaneous updates across all devices
  app.get("/api/help-items/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (typeof (res as any).flushHeaders === "function") {
      (res as any).flushHeaders();
    }

    // Send immediate current state
    const current = getStoredItems();
    res.write(`data: ${JSON.stringify(current)}\n\n`);

    sseClients.add(res);

    // Heartbeat every 20s
    const keepAlive = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 20000);

    req.on("close", () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  // API Routes for shared cross-device help items
  app.get("/api/help-items", (req, res) => {
    const now = Date.now();
    let items = getStoredItems();
    
    // Filtra gli annunci scaduti (tempo di default 24 ore se non specificato)
    const validItems = items.filter((item: any) => {
      const durationMs = (item.durationMinutes || 24 * 60) * 60 * 1000;
      const isExpired = (now - item.createdAt) > durationMs;
      // Mantieni gli annunci non scaduti (o quelli completati/cancellati che forse vogliamo tenere in storico, 
      // ma per ora filtriamo tutto ciò che è scaduto per l'effetto "cogli l'attimo")
      return !isExpired;
    });

    if (validItems.length !== items.length) {
      saveStoredItems(validItems); // clean up storage
    }

    res.json(validItems);
  });

  app.post("/api/help-items", (req, res) => {
    const newItem = req.body;
    if (!newItem.title) {
      return res.status(400).json({ error: "Title is required" });
    }
    const items = getStoredItems();
    const isStatic = newItem.trackingType === 'static';
    const actionRadiusKm = isStatic
      ? Math.min(10, Math.max(0.1, Number(newItem.actionRadiusKm) || 1))
      : 0.1; // 100 metri fissi per incentivare interazioni umane dirette

    const itemToSave = {
      ...newItem,
      id: newItem.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: newItem.createdAt || Date.now(),
      status: newItem.status || 'active',
      actionRadiusKm,
    };
    
    // Check if already exists by id
    const existingIndex = items.findIndex((i: any) => i.id === itemToSave.id);
    if (existingIndex >= 0) {
      items[existingIndex] = itemToSave;
    } else {
      items.unshift(itemToSave);
    }
    saveStoredItems(items);
    broadcastItemsUpdate(items);
    res.status(201).json(itemToSave);
  });

  // Sync array of items from client
  app.post("/api/help-items/sync", (req, res) => {
    const clientItems = req.body;
    if (!Array.isArray(clientItems)) {
      return res.status(400).json({ error: "Expected array of items" });
    }
    const lastReset = getLastResetTimestamp();
    const items = getStoredItems().filter((i: any) => !i.id?.startsWith('init-'));
    let modified = false;

    clientItems.forEach((cItem: any) => {
      if (!cItem || !cItem.title || cItem.id?.startsWith('init-')) return;
      // Discard items created before database reset
      if (cItem.createdAt && cItem.createdAt < lastReset) return;

      const isStatic = cItem.trackingType === 'static';
      const normalizedItem = {
        ...cItem,
        actionRadiusKm: isStatic
          ? Math.min(10, Math.max(0.1, Number(cItem.actionRadiusKm) || 1))
          : 0.1,
      };
      const index = items.findIndex((i: any) => i.id === cItem.id || (i.title === cItem.title && i.userId === cItem.userId));
      if (index >= 0) {
        items[index] = { ...items[index], ...normalizedItem };
        modified = true;
      } else {
        items.unshift(normalizedItem);
        modified = true;
      }
    });

    if (modified) {
      saveStoredItems(items);
      broadcastItemsUpdate(items);
    }
    res.json(items);
  });

  // Reset / Clear ALL announcements from database
  app.post("/api/help-items/reset", (req, res) => {
    const now = Date.now();
    setLastResetTimestamp(now);
    saveStoredItems([]);
    broadcastItemsUpdate([]);
    res.json({ success: true, message: "Database annunci azzerato con successo", resetAt: now });
  });

  app.delete("/api/help-items", (req, res) => {
    const now = Date.now();
    setLastResetTimestamp(now);
    saveStoredItems([]);
    broadcastItemsUpdate([]);
    res.json({ success: true, message: "Database annunci azzerato con successo", resetAt: now });
  });

  app.patch("/api/help-items/:id", (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const items = getStoredItems();
    const index = items.findIndex((i: any) => i.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Item not found" });
    }
    items[index] = { ...items[index], ...updates };
    saveStoredItems(items);
    broadcastItemsUpdate(items);
    res.json(items[index]);
  });

  app.delete("/api/help-items/:id", (req, res) => {
    const { id } = req.params;
    let items = getStoredItems();
    items = items.filter((i: any) => i.id !== id);
    saveStoredItems(items);
    broadcastItemsUpdate(items);
    res.json({ success: true });
  });

  // Dynamic Aura: When a creator moves, their active DYNAMIC announcements follow them!
  // Static announcements stay firmly anchored at their chosen place/address!
  app.post("/api/users/:userId/location", (req, res) => {
    const { userId } = req.params;
    const { lat, lng, address } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ error: "lat and lng required" });
    }

    const items = getStoredItems();
    let updatedCount = 0;

    for (let i = 0; i < items.length; i++) {
      // ONLY update dynamic announcements; static items remain at their fixed address!
      if (
        items[i].userId === userId &&
        items[i].trackingType !== 'static' &&
        items[i].status !== 'completed' &&
        items[i].status !== 'cancelled'
      ) {
        items[i].location = {
          lat,
          lng,
          address: address || items[i].location?.address || `GPS (${lat.toFixed(3)}, ${lng.toFixed(3)})`
        };
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      saveStoredItems(items);
      broadcastItemsUpdate(items);
    }

    res.json({ success: true, updatedCount });
  });

  // Official database of all 7,904 Italian municipalities with coordinates
  interface ItalianComune {
    nome: string;
    sigla: string;
    regione: string;
    provincia: string;
    cap: string;
    lat: number;
    lng: number;
  }

  const COMUNI_FILE = path.join(DATA_DIR, "comuni_italiani.json");
  let comuniList: ItalianComune[] = [];
  try {
    if (fs.existsSync(COMUNI_FILE)) {
      comuniList = JSON.parse(fs.readFileSync(COMUNI_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Failed to load comuni_italiani.json", err);
  }

  // Comuni Autocomplete API (Search Italian municipalities)
  app.get("/api/comuni", (req, res) => {
    const query = (req.query.q as string || "").trim().toLowerCase();
    if (!query || query.length < 1) {
      return res.json([]);
    }
    const startsWith = comuniList.filter(c => c.nome.toLowerCase().startsWith(query));
    const includes = comuniList.filter(c => !c.nome.toLowerCase().startsWith(query) && c.nome.toLowerCase().includes(query));
    const results = [...startsWith, ...includes].slice(0, 20);
    res.json(results);
  });

  // Geocoding helper with street resolution & automatic fallback to the center of the chosen Comune
  app.get("/api/geocode", async (req, res) => {
    const q = (req.query.q as string || "").trim();
    const comuneName = (req.query.comune as string || "").trim();
    const via = (req.query.via as string || "").trim();
    const civico = (req.query.civico as string || "").trim();

    // 1. Identify the chosen Comune in our official database of 7,904 Italian municipalities
    let comuneCentroid: ItalianComune | null = null;
    const targetComune = comuneName || q;
    if (targetComune) {
      const cleanComune = targetComune.toLowerCase();
      comuneCentroid = comuniList.find(c => c.nome.toLowerCase() === cleanComune)
        || comuniList.find(c => cleanComune.startsWith(c.nome.toLowerCase()) || c.nome.toLowerCase().startsWith(cleanComune))
        || comuniList.find(c => cleanComune.includes(c.nome.toLowerCase()))
        || null;
    }

    // 2. If a street or specific query is provided, attempt precision geocoding via Nominatim
    const fullStreetQuery = [via, civico, comuneCentroid ? comuneCentroid.nome : comuneName].filter(Boolean).join(", ") || q;
    if (via || (q && q !== comuneName)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullStreetQuery + ", Italia")}&format=json&limit=1&addressdetails=1`;
        const response = await fetch(url, {
          headers: {
            "User-Agent": "HelpCommunityPlatform/1.0",
            "Accept-Language": "it",
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data: any = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            const first = data[0];
            return res.json({
              lat: parseFloat(first.lat),
              lng: parseFloat(first.lon),
              displayName: first.display_name,
              found: true,
              isStreetLevel: true,
            });
          }
        }
      } catch (err) {
        console.warn("Nominatim geocoding error or timeout, falling back to comune center...", err);
      }
    }

    // 3. Fallback: Exact center of the selected municipality (Centro del Comune)
    if (comuneCentroid) {
      return res.json({
        lat: comuneCentroid.lat,
        lng: comuneCentroid.lng,
        displayName: `Centro di ${comuneCentroid.nome} (${comuneCentroid.sigla}), Italia`,
        found: true,
        isComuneCenter: true,
        comune: comuneCentroid.nome,
        sigla: comuneCentroid.sigla,
      });
    }

    // 4. Default fallback (Center of Italy) only if comune is unknown
    res.json({
      lat: 42.5042,
      lng: 12.5736,
      displayName: q || comuneName || "Italia",
      found: false,
    });
  });

  // Chat messages API
  const MESSAGES_FILE = path.join(DATA_DIR, "help_messages.json");
  function getStoredMessages(): any[] {
    try {
      if (!fs.existsSync(MESSAGES_FILE)) return [];
      return JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf-8")) || [];
    } catch {
      return [];
    }
  }
  function saveStoredMessages(msgs: any[]) {
    try {
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(msgs, null, 2), "utf-8");
    } catch {}
  }

  app.get("/api/help-items/:id/messages", (req, res) => {
    const { id } = req.params;
    const now = Date.now();
    let allMsgs = getStoredMessages();
    
    // Filtra i messaggi più vecchi di 1 minuto (60.000 ms) per l'effetto "cogli l'attimo"
    const validMsgs = allMsgs.filter((m: any) => (now - m.createdAt) <= 60000);
    
    if (validMsgs.length !== allMsgs.length) {
      saveStoredMessages(validMsgs); // clean up storage
      allMsgs = validMsgs;
    }

    const msgs = allMsgs.filter((m: any) => m.helpItemId === id);
    res.json(msgs);
  });

  app.post("/api/help-items/:id/messages", (req, res) => {
    const { id } = req.params;
    const msg = req.body;
    const all = getStoredMessages();
    const newMsg = {
      id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      helpItemId: id,
      senderId: msg.senderId,
      senderNickname: msg.senderNickname,
      text: msg.text,
      createdAt: msg.createdAt || Date.now(),
    };
    all.push(newMsg);
    saveStoredMessages(all);
    res.status(201).json(newMsg);
  });

  // Gemini AI endpoint for custom help generation and matching
  app.post("/api/ai-help", async (req, res) => {
    try {
      const { prompt, action, category } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({ apiKey });

      let systemPrompt = "";
      if (action === "generate_offer") {
        id: "generate_offer";
        systemPrompt = `Sei l'assistente IA di "HELP", una piattaforma di aiuto reciproco e civile convivenza. L'utente vuole creare un aiuto da mettere a disposizione per la comunità. Basandoti sulla richiesta dell'utente ("${prompt}"), genera un titolo accattivante e una descrizione dettagliata e utile per l'offerta di aiuto. Ritorna ESCLUSIVAMENTE un JSON con i campi: {"title": "...", "description": "...", "category": "${category || 'generico'}", "creditsRequired": 0}.`;
      } else if (action === "generate_request") {
        systemPrompt = `Sei l'assistente IA di "HELP", una piattaforma di aiuto reciproco e civile convivenza. L'utente ha bisogno di aiuto. Basandoti sulla richiesta dell'utente ("${prompt}"), genera un titolo e una descrizione dettagliata per la richiesta di aiuto. Determina se dovrebbe richiedere crediti (0 se è un favore gratuito di vicinato, 1-3 se richiede impegno speciale). Ritorna ESCLUSIVAMENTE un JSON con i campi: {"title": "...", "description": "...", "category": "${category || 'generico'}", "creditsRequired": number}.`;
      } else {
        systemPrompt = `Sei l'assistente IA di "HELP", una piattaforma di solidarietà e vicinato. Rispondi in modo amichevole, costruttivo e in italiano alla richiesta dell'utente: "${prompt}". Dai consigli pratici su come aiutarsi nella comunità.`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: systemPrompt,
      });

      const text = response.text;
      
      if (action === "generate_offer" || action === "generate_request") {
        try {
          // Clean markdown code blocks if present
          const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
          const jsonResult = JSON.parse(cleanText);
          return res.json(jsonResult);
        } catch (parseErr) {
          return res.json({ title: prompt, description: text, category: category || 'generico', creditsRequired: 0 });
        }
      }

      res.json({ result: text });
    } catch (error: any) {
      console.error("AI API Error:", error);
      const errMessage = error.message || "";
      if (errMessage.includes("resource_exhausted") || errMessage.includes("quota") || errMessage.includes("Rate limit")) {
        const { prompt, action, category } = req.body;
        if (action === "generate_offer") {
          return res.json({
            title: prompt ? `Offerta: ${prompt.slice(0, 40)}` : "Offerta di aiuto solidale",
            description: prompt || "Disponibile per aiutare i vicini in zona con disponibilità e cortesia.",
            category: category || "Spesa e Commissioni a Domicilio",
            creditsRequired: 0
          });
        }
        if (action === "generate_request") {
          return res.json({
            title: prompt ? `Richiesta: ${prompt.slice(0, 40)}` : "Richiesta di aiuto in zona",
            description: prompt || "Cerco supporto da parte di un vicino disponibile.",
            category: category || "Piccoli Lavoretti Domestici",
            creditsRequired: 1
          });
        }
        return res.json({ result: "Ciao! Sono l'assistente IA di HELP. Al momento la quota temporanea dell'API è esaurita, ma puoi comunque pubblicare offerte, richieste, guadagnare crediti e visualizzare la mappa interattiva in tempo reale!" });
      }
      res.status(500).json({ error: errMessage || "Internal server error" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
