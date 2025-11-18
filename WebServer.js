/**
 * 웹 UI 서버
 */
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { WebSocketServer } from 'ws'; // ws 라이브러리 추가
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
    this.ws = null; // WebSocket 서버 인스턴스 추가
    this.logs = [];
    this.maxLogs = 1000; // 최대 로그 개수
    this.sensorServer = null; // SensorServer 인스턴스 참조
  }

  /**
   * SensorServer 인스턴스 설정
   */
  setSensorServer(server) {
    this.sensorServer = server;
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

    // Arduino용 WebSocket 서버 생성
    this.ws = new WebSocketServer({ server: this.server });

    this.ws.on('connection', (ws) => {
      console.log('[FSR] Arduino (FSR sensor) connected');
      this.addLog({
        type: 'info',
        message: 'FSR sensor connected'
      });

      ws.on('message', (message) => {
        try {
          const messageStr = message.toString('utf-8');
          console.log(`[FSR] Received: ${messageStr}`);
          
          const data = JSON.parse(messageStr);
          
          // FSR 센서 데이터 처리
          if (data.clientId === 'sofa' && data.interaction === 'seat') {
            // SensorData 형식으로 데이터 재구성
            const sensorData = {
              sensorType: 'fsr',
              sensorId: data.clientId,
              timestamp: Date.now() / 1000,
              data: {
                interaction: data.interaction,
                sitting: data.value
              }
            };
            
            // SensorServer를 통해 데이터 처리
            if (this.sensorServer) {
              const dataBuffer = Buffer.from(JSON.stringify(sensorData));
              this.sensorServer.handleSensorData(dataBuffer);
            } else {
              // SensorServer가 없는 경우 직접 로그만 남김
              const status = data.value ? '앉음' : '일어남';
              this.addLog({
                type: 'success',
                message: `[FSR] 데이터 수신: ${status} (값: ${data.value})`
              });
            }
          } else {
            this.addLog({
              type: 'warning',
              message: `[FSR] Received unknown data: ${messageStr}`
            });
          }
        } catch (error) {
          console.error(`[FSR] Error processing message: ${error.message}`);
          this.addLog({
            type: 'error',
            message: `[FSR] Error: ${error.message}`
          });
        }
      });

      ws.on('close', () => {
        console.log('[FSR] Arduino (FSR sensor) disconnected');
        this.addLog({
          type: 'info',
          message: 'FSR sensor disconnected'
        });
      });

      ws.on('error', (error) => {
        console.error(`[FSR] WebSocket error: ${error.message}`);
        this.addLog({
          type: 'error',
          message: `[FSR] WebSocket error: ${error.message}`
        });
      });
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
    if (this.ws) {
      this.ws.close();
      console.log('[FSR] FSR WebSocket server stopped');
    }
    if (this.server) {
      this.server.close();
      console.log('[Web] Web server stopped');
    }
  }
}
