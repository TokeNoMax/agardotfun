import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new IOServer(server, {
  transports: ["websocket"],
  cors: { origin: true, methods: ["GET","POST"] }
});

app.use((req, res, next) => {
  const proto = req.headers["x-forwarded-proto"];
  if (proto && proto !== "https") return res.redirect("https://" + req.headers.host + req.url);
  next();
});

app.get("/health", (_, res) => res.send("ok"));

const publicDir = path.join(__dirname, "../public");
app.use(express.static(publicDir));
app.get("*", (_, res) => res.sendFile(path.join(publicDir, "index.html")));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("✅ listening on " + PORT));
