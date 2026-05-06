import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import cookieParser from "cookie-parser";
import { google } from "googleapis";
import * as dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

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

  // Google OAuth URL Generation
  app.get("/api/auth/google-url", (req, res) => {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_URL}/auth/google/callback`
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

  // Google OAuth Callback
  app.get("/auth/google/callback", async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect("/profile?error=no_code");

    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.APP_URL}/auth/google/callback`
      );

      const { tokens } = await oauth2Client.getToken(code as string);
      (req.session as any).googleTokens = tokens;
      
      // Return a script that notifies the opener and closes the popup
      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8f9fa;">
            <div style="text-align: center; padding: 2rem; background: white; border-radius: 1rem; border: 2px solid #0f172a; box-shadow: 4px 4px 0 0 #0f172a;">
              <h2 style="margin: 0 0 1rem 0; font-weight: 900; text-transform: uppercase; letter-spacing: -0.05em;">Nexus Outreach</h2>
              <p style="font-weight: 600; color: #64748b;">Workspace connected successfully!</p>
              <p style="font-size: 0.75rem; color: #94a3b8;">This window will close automatically.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', provider: 'google' }, '*');
                  setTimeout(() => window.close(), 1000);
                } else {
                  window.location.href = '/profile';
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Auth error:", error);
      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fff1f2;">
            <div style="text-align: center; padding: 2rem; background: white; border-radius: 1rem; border: 2px solid #991b1b; box-shadow: 4px 4px 0 0 #991b1b;">
              <h2 style="margin: 0 0 1rem 0; font-weight: 900; text-transform: uppercase; color: #991b1b;">Connection Failed</h2>
              <p style="font-weight: 600; color: #ef4444;">Failed to connect to Google Workspace.</p>
              <button onclick="window.close()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #991b1b; color: white; border: none; border-radius: 0.5rem; font-weight: 900; cursor: pointer;">CLOSE WINDOW</button>
            </div>
          </body>
        </html>
      `);
    }
  });

  // Export to Google Doc API
  app.post("/api/export-doc", async (req, res) => {
    const { content, contactName } = req.body;
    const tokens = (req.session as any).googleTokens;
    
    if (!tokens || !tokens.access_token) {
      return res.status(401).json({ error: "Google Workspace not connected" });
    }

    try {
      const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      auth.setCredentials(tokens);
      
      // If access token is expired, refresh it
      if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
        const { credentials } = await auth.refreshAccessToken();
        (req.session as any).googleTokens = credentials;
      }
      
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

  // Log API Key status on startup
  const envKeys = Object.keys(process.env);
  const foundKeys = envKeys.filter(k => /API|KEY|GEMINI|GOOGLE/i.test(k));
  const hasGemini = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY);
  
  console.log("-----------------------------------------");
  console.log(`[Status] Build: v1.0.44`);
  console.log(`[Status] Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`[Status] Port: ${PORT}`);
  console.log(`[Status] Gemini API Key: ${hasGemini ? "CONFIGURED" : "MISSING"}`);
  console.log(`[Status] Related ENV keys present: ${foundKeys.join(", ") || "None"}`);
  console.log("-----------------------------------------");

  app.get("/api/config/status", (req, res) => {
    const envKeys = Object.keys(process.env);
    res.json({
      geminiKey: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY),
      googleAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      googleConnected: !!((req.session as any).googleTokens?.access_token),
      env: process.env.NODE_ENV || "development",
      build: "v1.0.47",
      port: PORT,
      availableKeys: envKeys.filter(k => /API|KEY|GEMINI|GOOGLE/i.test(k)),
      allKeysCount: envKeys.length
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
