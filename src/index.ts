import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

// __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new IOServer(server, {
  transports: ["websocket"],
  cors: {
    origin: true,          // même origine (play.agar3.fun)
    methods: ["GET", "POST"]
  }
});

// (optionnel) redirection vers HTTPS derrière Railway
app.use((req, res, next) => {
  const proto = req.headers["x-forwarded-proto"];
  if (proto && proto !== "https") {
    return res.redirect("https://" + req.headers.host + req.url);
  }
  next();
});

// Endpoint santé
app.get("/health", (_, res) => res.send("ok"));

// Fichiers statiques du front
const publicDir = path.join(__dirname, "../public");
app.use(express.static(publicDir));

// SPA fallback
app.get("*", (_, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Lancement
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("✅ listening on " + PORT));
