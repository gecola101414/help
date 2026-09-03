import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
