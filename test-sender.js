/**
 * 테스트용 센서 데이터 전송 스크립트
 */
import dgram from 'dgram';

/**
 * 센서 데이터를 UDP로 전송
 */
function sendSensorData(sensorType, data, host = '127.0.0.1', port = 5000) {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket('udp4');
    
    const message = {
      sensor_type: sensorType,
      ...data
    };
    
    const jsonStr = JSON.stringify(message);
    const buffer = Buffer.from(jsonStr, 'utf-8');
    
    client.send(buffer, port, host, (err) => {
      if (err) {
        reject(err);
      } else {
        console.log(`Sent: ${jsonStr}`);
        resolve();
      }
      client.close();
    });
  });
}

/**
 * 테스트 메인
 */
async function main() {
  console.log('Starting sensor data test sender...');
  console.log('Press Ctrl+C to stop\n');
  
  try {
    while (true) {
      // 가속도계 데이터
      await sendSensorData('accelerometer', {
        sensor_id: 'accel_001',
        x: Math.random() * 20 - 10,
        y: Math.random() * 20 - 10,
        z: Math.random() * 20 - 10,
        timestamp: Date.now() / 1000
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 자이로스코프 데이터
      await sendSensorData('gyroscope', {
        sensor_id: 'gyro_001',
        x: Math.random() * 360 - 180,
        y: Math.random() * 360 - 180,
        z: Math.random() * 360 - 180,
        timestamp: Date.now() / 1000
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 온도 센서 데이터
      await sendSensorData('temperature', {
        sensor_id: 'temp_001',
        value: Math.random() * 20 + 15,
        timestamp: Date.now() / 1000
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 압력 센서 데이터
      await sendSensorData('pressure', {
        sensor_id: 'pressure_001',
        value: Math.random() * 40 + 980,
        timestamp: Date.now() / 1000
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Ctrl+C 처리
process.on('SIGINT', () => {
  console.log('\nStopped sending test data');
  process.exit(0);
});

main();
