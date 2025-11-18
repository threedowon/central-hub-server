/**
 * 센서 서버 메인 진입점
 */
import { config } from './config.js';
import { SensorServer } from './SensorServer.js';
import { OSCSender } from './OSCSender.js';
import { WebServer } from './WebServer.js';

// 시그널 핸들러
const signalHandler = (server, webServer, signal) => {
  console.log(`\n[System] Received ${signal}`);
  console.log('[System] Shutting down server...');
  server.printStats();
  server.stop();
  if (webServer) {
    webServer.stop();
  }
  process.exit(0);
};

/**
 * 메인 함수
 */
async function main() {
  // 웹 서버 생성 및 시작
  const webServer = new WebServer(config.web.port);
  webServer.start();
  
  // OSC 전송자 생성
  const oscSender = new OSCSender(config.osc.host, config.osc.port);
  
  // 센서 서버 생성
  const server = new SensorServer(config.udp.host, config.udp.port, oscSender, webServer);
  
  // WebServer에 SensorServer 인스턴스 연결
  webServer.setSensorServer(server);
  
  // 시그널 핸들러 등록
  process.on('SIGINT', () => signalHandler(server, webServer, 'SIGINT'));
  process.on('SIGTERM', () => signalHandler(server, webServer, 'SIGTERM'));
  
  // 서버 시작
  try {
    await server.start();
    
    console.log('\n=== Central Hub Server ===');
    console.log(`UDP: ${config.udp.host}:${config.udp.port}`);
    console.log(`OSC Target: ${config.osc.host}:${config.osc.port}`);
    console.log(`Web UI: http://${config.web.host}:${config.web.port}`);
    console.log('Press Ctrl+C to stop\n');
  } catch (error) {
    console.error(`[System] Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// 서버 실행
main().catch((error) => {
  console.error(`[System] Fatal error: ${error.message}`);
  process.exit(1);
});
