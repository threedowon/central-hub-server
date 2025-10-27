/**
 * OSC 프로토콜을 통한 언리얼 엔진으로의 데이터 전송
 */
import dgram from 'dgram';
import { config } from './config.js';

/**
 * OSC 메시지 생성
 */
function createOSCMessage(address, args) {
  // OSC 주소
  const addressBytes = Buffer.alloc(4 + address.length + 4 - (address.length % 4));
  addressBytes.write(address, 'utf8');
  
  // 타입 태그
  let typeTags = ',';
  for (const arg of args) {
    if (typeof arg === 'number') {
      if (Number.isInteger(arg)) {
        typeTags += 'i';
      } else {
        typeTags += 'f';
      }
    } else if (typeof arg === 'string') {
      typeTags += 's';
    }
  }
  
  const typeTagBytes = Buffer.alloc(typeTags.length + (4 - (typeTags.length % 4)));
  typeTagBytes.write(typeTags, 'utf8');
  
  // 인자들
  const argBuffers = [];
  for (const arg of args) {
    if (typeof arg === 'number') {
      const buffer = Buffer.alloc(4);
      if (Number.isInteger(arg)) {
        buffer.writeInt32BE(arg, 0);
      } else {
        buffer.writeFloatBE(arg, 0);
      }
      argBuffers.push(buffer);
    } else if (typeof arg === 'string') {
      const buffer = Buffer.alloc(4 + arg.length + 4 - (arg.length % 4));
      buffer.write(arg, 'utf8');
      argBuffers.push(buffer);
    }
  }
  
  // 전체 OSC 메시지 조합
  return Buffer.concat([addressBytes, typeTagBytes, ...argBuffers]);
}

export class OSCSender {
  constructor(host = config.osc.host, port = config.osc.port) {
    this.host = host;
    this.port = port;
    this.client = null;
  }

  /**
   * OSC 클라이언트 연결
   */
  connect() {
    try {
      this.client = dgram.createSocket('udp4');
      console.log(`[OSC] Connected to OSC server at ${this.host}:${this.port}`);
    } catch (error) {
      console.error(`[OSC] Failed to connect to OSC server: ${error.message}`);
    }
  }

  /**
   * OSC 클라이언트 연결 해제
   */
  disconnect() {
    if (this.client) {
      this.client.close();
      this.client = null;
      console.log('[OSC] Disconnected from OSC server');
    }
  }

  /**
   * 센서 타입에 따라 OSC 주소 생성
   */
  getOSCAddress(sensorData) {
    const baseAddress = "/sensor";
    const sensorTypePath = sensorData.sensorType;
    
    if (sensorData.sensorId) {
      return `${baseAddress}/${sensorTypePath}/${sensorData.sensorId}`;
    } else {
      return `${baseAddress}/${sensorTypePath}`;
    }
  }

  /**
   * 센서 데이터를 OSC로 전송
   */
  sendSensorData(sensorData) {
    if (!this.client) {
      console.warn('[OSC] OSC client not connected');
      return;
    }

    try {
      const oscAddress = this.getOSCAddress(sensorData);
      const oscData = sensorData.toOSCData();
      
      const message = createOSCMessage(oscAddress, oscData);
      
      this.client.send(message, this.port, this.host, (err) => {
        if (err) {
          console.error(`[OSC] Error sending message: ${err.message}`);
        }
      });
      
      console.log(`[OSC] Sent: ${oscAddress} -> [${oscData.join(', ')}]`);
    } catch (error) {
      console.error(`[OSC] Error sending OSC message: ${error.message}`);
    }
  }
}
