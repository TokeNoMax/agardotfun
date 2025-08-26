import { SocketServer } from "./SocketServer";

const PORT = Number(process.env.PORT) || 3001;
const server = new SocketServer(PORT);

// Tick simulation 20 Hz
setInterval(() => server.tick(50), 50);
