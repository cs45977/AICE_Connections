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
