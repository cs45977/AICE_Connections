import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import cookieParser from "cookie-parser";
import { google } from "googleapis";
import * as dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "nexus-outreach-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: true,
        sameSite: "none",
        httpOnly: true,
      },
    })
  );

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Google OAuth URL Generation (for Google Workspace permissions if needed beyond Firebase Auth)
  // Note: For MVP, Firebase Auth handles SSO. Google Docs might need extra scopes.
  app.get("/api/auth/google-url", (req, res) => {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_URL}/auth/callback`
    );

    const scopes = [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/documents",
    ];

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
    });

    res.json({ url });
  });

  // Export to Google Doc API
  app.post("/api/export-doc", async (req, res) => {
    // This will take content, contact name, and tokens
    const { content, contactName, accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      
      const docs = google.docs({ version: "v1", auth });
      const drive = google.drive({ version: "v3", auth });

      // Create a new document
      const doc = await docs.documents.create({
        requestBody: {
          title: `Nexus Outreach: ${contactName}`,
        },
      });

      const documentId = doc.data.documentId;

      // Insert Email Draft Building Block
      // Note: "Email draft" building block is a special component. 
      // We'll insert the text content first.
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content,
              },
            },
          ],
        },
      });

      res.json({ success: true, documentId, url: `https://docs.google.com/document/d/${documentId}/edit` });
    } catch (error) {
      console.error("Error creating Google Doc:", error);
      res.status(500).json({ error: "Failed to create Google Doc" });
    }
  });

  // Gemini Proxy
  app.post("/api/gemini/generate", async (req, res) => {
    const { model, contents, config } = req.body;
    
    try {
      // Platform provides GEMINI_API_KEY. Fallback to GOOGLE_API_KEY or generic API_KEY if needed.
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;
      
      if (!apiKey) {
        const msg = "Gemini API key is not configured in the server environment. Please check your AI Studio secrets (ensure GEMINI_API_KEY is set).";
        console.error("CRITICAL: " + msg);
        console.log("Current ENV keys related to AI:", Object.keys(process.env).filter(k => /API|KEY|GEMINI|GOOGLE/i.test(k)));
        return res.status(500).json({ error: msg });
      }
      
      const client = new GoogleGenAI({ apiKey });
      
      console.log(`[Gemini Proxy] Requesting model: ${model || "gemini-3-flash-preview"} (Grounded: ${!!config?.tools})`);

      // The @google/genai SDK uses client.models.generateContent
      const result = await client.models.generateContent({
        model: model || "gemini-3-flash-preview",
        contents: typeof contents === 'string' ? [{ role: 'user', parts: [{ text: contents }] }] : contents,
        ...config
      });
      
      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Gemini Server Error:", error);
      
      // Categorize the error for the client
      let statusCode = error.status || 500;
      let errorType = "SERVER_ERROR";
      
      const errString = String(error).toLowerCase();
      if (errString.includes("429") || errString.includes("resource_exhausted") || errString.includes("quota")) {
        statusCode = 429;
        errorType = "QUOTA_EXCEEDED";
      } else if (errString.includes("403") || errString.includes("forbidden") || errString.includes("permission_denied")) {
        statusCode = 403;
        errorType = "FORBIDDEN";
      }

      res.status(statusCode).json({ 
        error: error.message || "An error occurred with the Gemini API",
        type: errorType,
        details: typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error)
      });
    }
  });

  // Log API Key status on startup
  const envKeys = Object.keys(process.env);
  const foundKeys = envKeys.filter(k => /API|KEY|GEMINI|GOOGLE/i.test(k));
  const hasGemini = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY);
  
  console.log("-----------------------------------------");
  console.log(`[Status] Build: v1.0.43`);
  console.log(`[Status] Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`[Status] Gemini API Key: ${hasGemini ? "CONFIGURED" : "MISSING"}`);
  console.log(`[Status] Related ENV keys present: ${foundKeys.join(", ") || "None"}`);
  console.log("-----------------------------------------");

  app.get("/api/config/status", (req, res) => {
    res.json({
      geminiKey: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY),
      googleAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      env: process.env.NODE_ENV || "development",
      build: "v1.0.42"
    });
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
