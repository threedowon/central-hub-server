import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { SensorData, SensorType } from './SensorData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WebServer {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.io = null;
    this.ws = null;
    this.logs = [];
    this.maxLogs = 1000;
    this.sensorServer = null;
  }

  setSensorServer(server) {
    this.sensorServer = server;
  }

  start() {
    this.app.use(express.static(path.join(__dirname, 'public')));

    this.app.get('/api/logs', (req, res) => {
      res.json(this.logs);
    });

    this.server = createServer(this.app);

    this.io = new SocketIOServer(this.server, {
      cors: { origin: "*", methods: ["GET", "POST"] }
    });

    // -------------------------------
    // WebSocket (from ESP32)
    // -------------------------------
    this.ws = new WebSocketServer({ server: this.server });

    this.ws.on('connection', (ws) => {
      console.log('[FSR] Arduino connected');
      this.addLog({ type: 'info', message: 'FSR sensor connected' });

      ws.on('message', (msg) => {
        const msgStr = msg.toString('utf-8');
        console.log("[FSR] Received:", msgStr);

        try {
          // 정식 SensorData JSON으로 파싱
          const sensorData = SensorData.fromJSON(msgStr);

          // SensorServer에 직접 전달
          if (this.sensorServer) {
            this.sensorServer.handleSensorData(Buffer.from(msgStr));
          }

          // Web 로그 추가
          this.addLog({
            type: 'success',
            message: `[FSR] sitting: ${sensorData.data.sitting}, raw: ${sensorData.data.raw}`
          });
        }
        catch (err) {
          console.error("[FSR] Error:", err.message);
          this.addLog({
            type: 'error',
            message: `[FSR] Parse error: ${err.message}`
          });
        }
      });

      ws.on('close', () => {
        console.log('[FSR] Arduino disconnected');
        this.addLog({ type: 'info', message: 'FSR sensor disconnected' });
      });

      ws.on('error', (err) => {
        console.error("[FSR] WebSocket error:", err.message);
        this.addLog({
          type: 'error',
          message: `[FSR] WebSocket error: ${err.message}`
        });
      });
    });

    // -------------------------------
    // Socket.IO for Web UI
    // -------------------------------
    this.io.on('connection', (socket) => {
      console.log('[Web] Client connected');
      socket.emit('logs', this.logs);
    });

    this.server.listen(this.port, () => {
      console.log(`[Web] Web server running on http://0.0.0.0:${this.port}`);
      this.broadcastLog({ type: 'info', message: 'Web server started' });
    });
  }

  addLog(log) {
    const entry = { ...log, timestamp: new Date().toISOString() };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) this.logs.shift();
    if (this.io) this.io.emit('log', entry);
  }

  broadcastLog(log) {
    if (this.io) this.io.emit('log', log);
  }

  broadcastStats(stats) {
    if (this.io) this.io.emit('stats', stats);
  }

  broadcastSensorData(sensorData) {
    if (this.io) this.io.emit('sensorData', sensorData);
  }

  stop() {
    if (this.ws) this.ws.close();
    if (this.server) this.server.close();
    console.log('[Web] Web server stopped');
  }
}
