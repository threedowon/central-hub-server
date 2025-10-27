/**
 * 센서 데이터 수신 및 OSC 전송 서버
 */
import dgram from 'dgram';
import { config } from './config.js';
import { SensorData, SensorType } from './SensorData.js';
import { OSCSender } from './OSCSender.js';

export class SensorServer {
  constructor(host = config.udp.host, port = config.udp.port, oscSender = null, webServer = null) {
    this.host = host;
    this.port = port;
    this.oscSender = oscSender || new OSCSender();
    this.webServer = webServer;
    this.socket = null;
    this.running = false;
    
    // 센서별 데이터 카운터
    this.stats = {};
    for (const type in SensorType) {
      this.stats[SensorType[type]] = 0;
    }
  }

  /**
   * 센서 데이터 처리
   */
  handleSensorData(data) {
    try {
      // JSON 디코딩
      const jsonStr = data.toString('utf-8');
      
      // SensorData 객체로 변환
      const sensorData = SensorData.fromJSON(jsonStr);
      
      // 통계 업데이트
      this.stats[sensorData.sensorType]++;
      
      // 웹 서버에 로그 추가
      if (this.webServer) {
        this.webServer.addLog({
          type: 'success',
          message: `Processed ${sensorData.sensorType} data (sensor_id: ${sensorData.sensorId || 'N/A'})`
        });
        this.webServer.broadcastSensorData(sensorData);
        this.webServer.broadcastStats(this.stats);
      }
      
      // OSC로 전송
      this.oscSender.sendSensorData(sensorData);
      
      console.log(
        `[Server] Processed ${sensorData.sensorType} data ` +
        `(sensor_id: ${sensorData.sensorId || 'N/A'})`
      );
    } catch (error) {
      console.error(`[Server] Error handling sensor data: ${error.message}`);
      
      // 웹 서버에 에러 로그 추가
      if (this.webServer) {
        this.webServer.addLog({
          type: 'error',
          message: `Error: ${error.message}`
        });
      }
    }
  }

  /**
   * UDP 소켓 생성 및 데이터 수신 시작
   */
  start() {
    return new Promise((resolve) => {
      // OSC 연결
      this.oscSender.connect();
      
      // UDP 소켓 생성
      this.socket = dgram.createSocket('udp4');
      
      // 데이터 수신 이벤트
      this.socket.on('message', (msg, rinfo) => {
        console.log(`[UDP] Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
        this.handleSensorData(msg);
      });
      
      // 에러 처리
      this.socket.on('error', (err) => {
        console.error(`[UDP] Error: ${err.message}`);
      });
      
      // 바인딩 완료
      this.socket.on('listening', () => {
        const address = this.socket.address();
        console.log(`[UDP] Server listening on ${address.address}:${address.port}`);
        this.running = true;
        resolve();
      });
      
      // UDP 소켓 바인딩
      this.socket.bind(this.port, this.host);
    });
  }

  /**
   * 서버 중지
   */
  stop() {
    this.running = false;
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.oscSender.disconnect();
    console.log('[Server] Server stopped');
  }

  /**
   * 통계 출력
   */
  printStats() {
    console.log('\n=== Sensor Statistics ===');
    for (const [sensorType, count] of Object.entries(this.stats)) {
      if (count > 0) {
        console.log(`${sensorType}: ${count}`);
      }
    }
    console.log('='.repeat(25) + '\n');
  }
}
