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
    if (!fs.existsSync(ITEMS_FILE)) {
      fs.writeFileSync(ITEMS_FILE, "[]", "utf-8");
      return [];
    }
    const data = fs.readFileSync(ITEMS_FILE, "utf-8");
    return JSON.parse(data) || [];
  } catch (err) {
    console.error("Error reading items file:", err);
    return [];
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
    res.json(getStoredItems());
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
    const items = getStoredItems().filter((i: any) => !i.id?.startsWith('init-'));
    let modified = false;

    clientItems.forEach((cItem: any) => {
      if (!cItem || !cItem.title || cItem.id?.startsWith('init-')) return;
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

  // Geocoding helper for static announcements (Comune, Via, Numero Civico)
  const ITALIAN_CITIES_FALLBACK: Record<string, { lat: number; lng: number }> = {
    roma: { lat: 41.9028, lng: 12.4964 },
    milano: { lat: 45.4642, lng: 9.1900 },
    napoli: { lat: 40.8518, lng: 14.2681 },
    torino: { lat: 45.0703, lng: 7.6869 },
    palermo: { lat: 38.1157, lng: 13.3615 },
    genova: { lat: 44.4056, lng: 8.9463 },
    bologna: { lat: 44.4949, lng: 11.3426 },
    firenze: { lat: 43.7696, lng: 11.2558 },
    bari: { lat: 41.1171, lng: 16.8719 },
    catania: { lat: 37.5079, lng: 15.0830 },
    verona: { lat: 45.4384, lng: 10.9916 },
    venezia: { lat: 45.4408, lng: 12.3155 },
    padova: { lat: 45.4064, lng: 11.8768 },
    trieste: { lat: 45.6495, lng: 13.7768 },
    brescia: { lat: 45.5416, lng: 10.2118 },
    parma: { lat: 44.8015, lng: 10.3279 },
    savona: { lat: 44.3080, lng: 8.4810 },
    bergamo: { lat: 45.6983, lng: 9.6773 },
    trento: { lat: 46.0748, lng: 11.1217 },
    bolzano: { lat: 46.4983, lng: 11.3548 },
    ancona: { lat: 43.6158, lng: 13.5189 },
    perugia: { lat: 43.1107, lng: 12.3908 },
    cagliari: { lat: 39.2238, lng: 9.1217 },
    pescara: { lat: 42.4618, lng: 14.2144 },
    salerno: { lat: 40.6824, lng: 14.7681 },
    rimini: { lat: 44.0678, lng: 12.5695 },
    monza: { lat: 45.5845, lng: 9.2744 },
    lecce: { lat: 40.3515, lng: 18.1750 },
  };

  app.get("/api/geocode", async (req, res) => {
    const q = (req.query.q as string || "").trim();
    if (!q) {
      return res.status(400).json({ error: "Missing query parameter 'q'" });
    }

    try {
      // Try Nominatim with custom user agent and timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ", Italia")}&format=json&limit=1&addressdetails=1`;
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
          });
        }
      }
    } catch (err) {
      console.warn("Nominatim geocoding error or timeout, checking fallback...", err);
    }

    // Fallback: Check if city is in fallback dictionary
    const queryNormalized = q.toLowerCase();
    for (const [cityName, coords] of Object.entries(ITALIAN_CITIES_FALLBACK)) {
      if (queryNormalized.includes(cityName)) {
        return res.json({
          lat: coords.lat,
          lng: coords.lng,
          displayName: `${q}, Italia`,
          found: true,
          isFallback: true,
        });
      }
    }

    // Default fallback: Center of Italy
    res.json({
      lat: 42.5042,
      lng: 12.5736,
      displayName: q,
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
    const msgs = getStoredMessages().filter((m: any) => m.helpItemId === id);
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
