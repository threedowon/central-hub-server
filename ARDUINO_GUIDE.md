# Arduino UDP 데이터 전송 가이드

## 📡 네트워크 설정

- **수신 서버**: `0.0.0.0`의 `5000번 포트`에서 수신
- **프로토콜**: UDP (User Datagram Protocol)
- **데이터 형식**: JSON 문자열

## 📋 서버 IP 주소 확인 방법

서버가 실행 중인 컴퓨터의 IP 주소를 찾아야 합니다:

### Windows
```cmd
ipconfig
```
- 이더넷 또는 Wi-Fi의 `IPv4 주소`를 확인하세요 (예: `192.168.0.100`)

### Mac/Linux
```bash
ifconfig
# 또는
ip addr
```

## 📦 JSON 데이터 형식

센서 데이터는 다음 JSON 형식으로 전송해야 합니다:

```json
{
  "sensor_type": "accelerometer",
  "sensor_id": "sensor_001",
  "timestamp": 1234567890,
  "data": {
    "x": 0.5,
    "y": -0.3,
    "z": 9.8
  }
}
```

### 필수 필드

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `sensor_type` | string | 센서 타입 | `"accelerometer"`, `"gyroscope"`, `"temperature"` 등 |
| `sensor_id` | string | 센서 고유 ID (선택) | `"sensor_001"` |
| `timestamp` | number | Unix 타임스탬프 (초 단위) | `1234567890` |
| `data` | object | 센서 데이터 (키-값 쌍) | `{"x": 0.5, "y": -0.3}` |

### 지원되는 센서 타입

- `accelerometer` - 가속도계
- `gyroscope` - 자이로스코프
- `magnetometer` - 자기계
- `pressure` - 압력 센서
- `temperature` - 온도 센서
- `humidity` - 습도 센서
- `light` - 조도 센서
- `proximity` - 근접 센서

## 🔧 Arduino 예제 코드

### 예제 1: WiFi를 사용하는 ESP8266/ESP32

```cpp
#include <ESP8266WiFi.h>  // ESP32면 #include <WiFi.h>
#include <WiFiUdp.h>

// WiFi 설정
const char* ssid = "your_wifi_ssid";
const char* password = "your_wifi_password";

// 서버 설정
const char* serverIP = "192.168.0.100";  // 서버 IP 주소
const int serverPort = 5000;

WiFiUDP udp;

void setup() {
  Serial.begin(115200);
  
  // WiFi 연결
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
  
  udp.begin(8888);  // 로컬 포트
}

void loop() {
  // 센서 데이터 수집 (예제)
  float x = 0.5;
  float y = -0.3;
  float z = 9.8;
  
  // JSON 데이터 생성
  String jsonData = "{\"sensor_type\":\"accelerometer\",";
  jsonData += "\"sensor_id\":\"sensor_001\",";
  jsonData += "\"timestamp\":" + String(millis() / 1000) + ",";
  jsonData += "\"data\":{";
  jsonData += "\"x\":" + String(x) + ",";
  jsonData += "\"y\":" + String(y) + ",";
  jsonData += "\"z\":" + String(z);
  jsonData += "}}";
  
  // UDP로 전송
  udp.beginPacket(serverIP, serverPort);
  udp.write((const uint8_t*)jsonData.c_str(), jsonData.length());
  udp.endPacket();
  
  Serial.println("Sent: " + jsonData);
  
  delay(100);  // 100ms마다 전송
}
```

### 예제 2: Ethernet을 사용하는 Arduino

```cpp
#include <Ethernet.h>
#include <EthernetUdp.h>

// MAC 주소 (하드웨어에 맞게 수정)
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };

// 서버 설정
IPAddress serverIP(192, 168, 0, 100);  // 서버 IP 주소
const int serverPort = 5000;

EthernetUDP udp;

void setup() {
  Serial.begin(9600);
  
  // Ethernet 시작 (DHCP 사용)
  if (Ethernet.begin(mac) == 0) {
    Serial.println("Failed to configure Ethernet using DHCP");
    // 정적 IP 설정이 필요한 경우
    // Ethernet.begin(mac, IPAddress(192, 168, 0, 177));
  }
  
  Serial.print("IP address: ");
  Serial.println(Ethernet.localIP());
  
  udp.begin(8888);  // 로컬 포트
}

void loop() {
  // 센서 데이터 수집 및 JSON 생성
  float temperature = 25.5;
  
  String jsonData = "{\"sensor_type\":\"temperature\",";
  jsonData += "\"sensor_id\":\"temp_001\",";
  jsonData += "\"timestamp\":" + String(millis() / 1000) + ",";
  jsonData += "\"data\":{";
  jsonData += "\"value\":" + String(temperature);
  jsonData += "}}";
  
  // UDP로 전송
  udp.beginPacket(serverIP, serverPort);
  udp.write((const uint8_t*)jsonData.c_str(), jsonData.length());
  udp.endPacket();
  
  Serial.println("Sent: " + jsonData);
  
  delay(1000);  // 1초마다 전송
}
```

### 예제 3: ArduinoJson 라이브러리 사용 (권장)

먼저 Arduino IDE에서 **ArduinoJson** 라이브러리를 설치하세요.

```cpp
#include <ESP8266WiFi.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>

const char* ssid = "your_wifi_ssid";
const char* password = "your_wifi_password";
const char* serverIP = "192.168.0.100";
const int serverPort = 5000;

WiFiUDP udp;

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
  udp.begin(8888);
}

void loop() {
  // JSON 문서 생성
  StaticJsonDocument<200> doc;
  doc["sensor_type"] = "accelerometer";
  doc["sensor_id"] = "sensor_001";
  doc["timestamp"] = millis() / 1000;
  
  // 데이터 객체 생성
  JsonObject data = doc.createNestedObject("data");
  data["x"] = 0.5;
  data["y"] = -0.3;
  data["z"] = 9.8;
  
  // JSON 문자열로 직렬화
  char jsonBuffer[200];
  serializeJson(doc, jsonBuffer);
  
  // UDP로 전송
  udp.beginPacket(serverIP, serverPort);
  udp.write((const uint8_t*)jsonBuffer, strlen(jsonBuffer));
  udp.endPacket();
  
  Serial.println("Sent: " + String(jsonBuffer));
  
  delay(100);
}
```

## 🎯 주요 포인트

1. **서버 IP 주소**: `0.0.0.0`은 모든 인터페이스를 의미하므로, 실제로는 서버의 **실제 IP 주소**(예: `192.168.0.100`)로 전송해야 합니다.
2. **포트**: `5000`번 포트로 전송
3. **JSON 형식**: 정확한 JSON 형식을 준수해야 파싱이 성공합니다.
4. **타임스탬프**: Unix 타임스탬프(초 단위)를 사용합니다. `millis() / 1000`로 현재 시간을 계산할 수 있습니다.
5. **센서 타입**: 지원되는 센서 타입 중 하나를 사용해야 OSC 주소가 올바르게 매핑됩니다.

## 🧪 테스트 방법

1. 서버를 시작합니다:
   ```bash
   npm start
   ```

2. 웹 브라우저에서 `http://localhost:3000` 또는 `http://서버IP:3000` 접속

3. Arduino에서 코드를 업로드하고 Serial Monitor 확인

4. 웹 대시보드에서 실시간 데이터 확인

## 📝 참고사항

- 데이터 전송 주기는 센서의 특성과 네트워크 상황에 맞게 조정하세요.
- JSON 문자열이 너무 길면 네트워크 패킷 크기 제한에 걸릴 수 있습니다.
- 여러 센서가 있는 경우 각 센서마다 고유한 `sensor_id`를 사용하세요.
