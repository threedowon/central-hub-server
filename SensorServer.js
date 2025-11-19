/**
 * 센서 데이터 수신 및 OSC 전송 서버
 */
import dgram from 'dgram';
import { spawn } from 'child_process';
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

    // BSOD 프로그램
    this.bsodProcess = null;

    // 소파
    this.sofaSitting = false;
    this.sofaProgress = 0;
    this.sofaProgressInterval = null;

    // false 유지 감지
    this.lastFalseTimestamp = Date.now();

    // 통계
    this.stats = {};
    for (const type in SensorType) this.stats[SensorType[type]] = 0;
  }

  // -------------------------------
  // 메인 센서 데이터 처리
  // -------------------------------
  handleSensorData(buf) {
    try {
      const jsonStr = buf.toString();
      const sensorData = SensorData.fromJSON(jsonStr);

      if (sensorData.sensorType === SensorType.FSR && sensorData.sensorId === "sofa") {
        const sit = sensorData.data.sitting;
        this.handleSofaState(sit);
      }

      this.processAndBroadcastData(sensorData);

    } catch (err) {
      console.error("[Server] JSON Error:", err.message);
    }
  }

  // -------------------------------
  // 공통 처리
  // -------------------------------
  processAndBroadcastData(sensorData) {
    this.stats[sensorData.sensorType]++;

    if (this.webServer) {
      this.webServer.broadcastSensorData(sensorData);
      this.webServer.broadcastStats(this.stats);
    }

    this.oscSender.sendSensorData(sensorData);

    console.log(`[Server] Processed ${sensorData.sensorType}`);
  }

  // -------------------------------
  // 소파 상태 처리
  // -------------------------------
  handleSofaState(isSitting) {
    const now = Date.now();

    if (isSitting) {
      this.sofaSitting = true;
      this.lastFalseTimestamp = now;

      this.startProgress();
    }

    else {
      this.sofaSitting = false;
      this.sofaProgress = 0;
      this.stopProgress();

      if (this.bsodProcess) this.bsodProcess.stdin.write(`0\n`);

      // --- false 10초 유지 체크 ---
      setTimeout(() => {
        if (!this.sofaSitting && Date.now() - this.lastFalseTimestamp >= 50000) {
          console.log("[SOFA] 10초 이상 FALSE → BSOD 재시작");
          this.stopBsodScript();
          this.startBsodScript();
        }
      }, 11000);
    }
  }

  // -------------------------------
  // 진행률 타이머
  // -------------------------------
  startProgress() {
    if (this.sofaProgressInterval) clearInterval(this.sofaProgressInterval);

    this.sofaProgress = 0;

    this.sofaProgressInterval = setInterval(() => {
      this.sofaProgress++;
      if (this.sofaProgress >= 100) {
        this.stopBsodScript();
        clearInterval(this.sofaProgressInterval);
        this.sofaProgressInterval = null;
        return;
      }

      // Python으로 전달
      if (this.bsodProcess) this.bsodProcess.stdin.write(`${this.sofaProgress}\n`);

      // 웹으로 전달
      const progressData = {
        sensor_type: "sofa_progress",
        sensor_id: "sofa_progress_bar",
        timestamp: Date.now() / 1000,
        progress: this.sofaProgress
      };

      this.handleSensorData(Buffer.from(JSON.stringify(progressData)));

    }, 80); // 100 → 8초
  }

  stopProgress() {
    if (this.sofaProgressInterval) {
      clearInterval(this.sofaProgressInterval);
      this.sofaProgressInterval = null;
    }
  }

  // -------------------------------
  // BSOD 스크립트
  // -------------------------------
  startBsodScript() {
    console.log("[BSOD] Start");

    this.bsodProcess = spawn("python", ["Webcam/bsod_invite_fullscreen.py"], { stdio: "pipe" });

    this.bsodProcess.stderr.on("data", (d) => console.error("[BSOD_err]", d.toString()));
    this.bsodProcess.on("close", () => console.log("[BSOD] closed"));
  }

  stopBsodScript() {
    if (this.bsodProcess) {
      this.bsodProcess.stdin.end();
      this.bsodProcess.kill("SIGINT");
      this.bsodProcess = null;
      console.log("[BSOD] Stop");
    }
  }

  // -------------------------------
  // 서버 시작
  // -------------------------------
  start() {
    this.startBsodScript();

    this.oscSender.connect();

    this.socket = dgram.createSocket("udp4");
    this.socket.on("message", (msg) => this.handleSensorData(msg));
    this.socket.bind(this.port, this.host);

    console.log(`[UDP] Listening ${this.host}:${this.port}`);
  }

  stop() {
    this.stopBsodScript();
    if (this.socket) this.socket.close();
  }
}
