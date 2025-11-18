/**
 * 서버 설정 파일
 */

export const config = {
  // UDP 수신 설정
  udp: {
    host: "0.0.0.0",  // 모든 네트워크 인터페이스에서 수신
    port: 5000        // UDP 수신 포트
  },

  // OSC 전송 설정 (언리얼 엔진)
  osc: {
    host: "127.0.0.1",  // 언리얼 엔진의 OSC 수신 주소
    port: 7000          // 언리얼 엔진의 OSC 수신 포트
  },

  // 웹 UI 설정
  web: {
    host: "0.0.0.0",  // 웹 서버 호스트
    port: 3000        // 웹 서버 포트
  },

  // 로깅 설정
  logging: {
    level: "INFO"  // DEBUG, INFO, WARNING, ERROR
  },

  // 센서 타입별 OSC 주소 패턴
  oscAddressPatterns: {
    accelerometer: "/sensor/accel",
    gyroscope: "/sensor/gyro",
    magnetometer: "/sensor/magnet",
    pressure: "/sensor/pressure",
    temperature: "/sensor/temp",
    humidity: "/sensor/humidity",
    light: "/sensor/light",
    proximity: "/sensor/proximity",
    fsr: "/sensor/fsr",
    mic: "/sensor/mic" // mic 센서 OSC 주소 추가
  }
};
