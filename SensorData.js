/**
 * 센서 타입 정의
 */

// 센서 타입 열거
export const SensorType = {
  ACCELEROMETER: "accelerometer",
  GYROSCOPE: "gyroscope",
  MAGNETOMETER: "magnetometer",
  PRESSURE: "pressure",
  TEMPERATURE: "temperature",
  HUMIDITY: "humidity",
  LIGHT: "light",
  PROXIMITY: "proximity",
  FSR: "fsr", // FSR 센서 타입 추가
  MIC: "mic", // mic 센서 타입 추가
  SOFA_PROGRESS: "sofa_progress", // 소파 진행률 센서 타입 추가
  UNKNOWN: "unknown"
};

/**
 * 센서 데이터 클래스
 */
export class SensorData {
  constructor(sensorType, data, sensorId = null, timestamp = null) {
    this.sensorType = sensorType;
    this.data = data;
    this.sensorId = sensorId;
    this.timestamp = timestamp;
  }

  /**
   * JSON 문자열로부터 SensorData 생성
   */
  static fromJSON(jsonStr) {
    try {
      const obj = JSON.parse(jsonStr);
      
      // sensor_type 추출
      const sensorTypeStr = (obj.sensor_type || 'unknown').toLowerCase();
      const sensorType = SensorType[sensorTypeStr.toUpperCase()] || SensorType.UNKNOWN;
      
      // data 추출 (sensor_type, sensor_id, timestamp를 제외한 나머지)
      const data = {};
      for (const [key, value] of Object.entries(obj)) {
        if (!['sensor_type', 'sensor_id', 'timestamp'].includes(key)) {
          data[key] = value;
        }
      }
      
      return new SensorData(
        sensorType,
        data,
        obj.sensor_id,
        obj.timestamp
      );
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
  }

  /**
   * OSC 메시지로 전송할 데이터 형식으로 변환
   */
  toOSCData() {
    const values = [];
    // data의 값들을 정렬된 순서로 추가
    for (const key of Object.keys(this.data).sort()) {
      const val = this.data[key];
      if (typeof val === 'number') {
        values.push(val);
      }
    }
    
    return values.length > 0 ? values : [0.0];
  }
}
