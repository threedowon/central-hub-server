/**
 * 웹 UI 서버
 */
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WebServer {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.server = null;
    this.io = null;
    this.logs = [];
    this.maxLogs = 1000; // 최대 로그 개수
  }

  /**
   * 웹 서버 시작
   */
  start() {
    // 정적 파일 서빙
    this.app.use(express.static(path.join(__dirname, 'public')));

    // API 엔드포인트
    this.app.get('/api/logs', (req, res) => {
      res.json(this.logs);
    });

    // HTTP 서버 생성
    this.server = createServer(this.app);

    // Socket.IO 서버 생성
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Socket.IO 연결 처리
    this.io.on('connection', (socket) => {
      console.log('[Web] Client connected');
      
      // 클라이언트에게 현재 로그 전송
      socket.emit('logs', this.logs);

      socket.on('disconnect', () => {
        console.log('[Web] Client disconnected');
      });
    });

    // 서버 시작
    this.server.listen(this.port, () => {
      console.log(`[Web] Web server running on http://0.0.0.0:${this.port}`);
      this.broadcastLog({
        type: 'info',
        message: 'Web server started',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * 로그 추가 및 브로드캐스트
   */
  addLog(log) {
    const logEntry = {
      ...log,
      timestamp: log.timestamp || new Date().toISOString()
    };

    this.logs.push(logEntry);

    // 최대 로그 개수 제한
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // 클라이언트에게 브로드캐스트
    if (this.io) {
      this.io.emit('log', logEntry);
    }
  }

  /**
   * 로그 브로드캐스트만 (중복 방지)
   */
  broadcastLog(log) {
    const logEntry = {
      ...log,
      timestamp: log.timestamp || new Date().toISOString()
    };

    if (this.io) {
      this.io.emit('log', logEntry);
    }
  }

  /**
   * 통계 업데이트 브로드캐스트
   */
  broadcastStats(stats) {
    if (this.io) {
      this.io.emit('stats', stats);
    }
  }

  /**
   * 센서 데이터 브로드캐스트
   */
  broadcastSensorData(sensorData) {
    if (this.io) {
      this.io.emit('sensorData', sensorData);
    }
  }

  /**
   * 서버 중지
   */
  stop() {
    if (this.server) {
      this.server.close();
      console.log('[Web] Web server stopped');
    }
  }
}
