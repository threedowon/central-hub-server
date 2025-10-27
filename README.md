# Central Hub Server

여러 센서로부터 JSON 데이터를 UDP로 수신하고, 센서 타입에 따라 분류하여 언리얼 엔진에 OSC 프로토콜로 전송하는 중앙 서버입니다.

## 주요 기능

- UDP로 센서 데이터 수신 (JSON 형식)
- 센서 타입별 자동 분류
- OSC 프로토콜을 통한 언리얼 엔진 데이터 전송
- 웹 UI를 통한 실시간 모니터링 및 디버깅
- 이벤트 기반 비동기 처리
- 센서별 데이터 통계 추적

## 설치

```bash
npm install
```

## 사용 방법

### 1. 서버 실행

```bash
npm start
```

기본 설정:
- UDP 수신: `0.0.0.0:5000` (모든 네트워크 인터페이스에서 수신)
- OSC 전송: `127.0.0.1:7000`
- 웹 UI: `http://localhost:3000`

### 2. Arduino/센서에서 데이터 전송

Arduino나 센서 디바이스에서 UDP로 데이터를 전송합니다:

**서버 IP 주소**: 서버가 실행 중인 컴퓨터의 IP 주소  
**포트**: `5000`  
**프로토콜**: UDP  
**데이터 형식**: JSON (아래 참조)

> 📘 **Arduino 예제 코드는 `ARDUINO_GUIDE.md` 파일을 참조하세요.**

서버 IP 주소 확인 방법:
- Windows: `ipconfig` 실행
- Mac/Linux: `ifconfig` 또는 `ip addr` 실행

### 3. 웹 UI 접속

서버 실행 후 브라우저에서 다음 주소로 접속하세요:
```
http://localhost:3000
```
또는 네트워크의 다른 컴퓨터에서:
```
http://서버IP:3000
```

웹 UI 기능:
- ✅ **실시간 센서 데이터**: 최근 50개의 센서 데이터를 스크롤로 확인
- ✅ **센서 필터링**: 특정 센서 타입만 선택하여 보기
- ✅ **활성 센서 표시**: 현재 데이터를 전송 중인 센서 확인
- ✅ **센서별 통계**: 타입별 데이터 개수 추적
- ✅ **활동 로그**: 모든 활동을 시간순으로 표시
- ✅ **데이터 레이트 차트**: 데이터 전송 속도를 그래프로 표시

### 4. 설정 변경

`config.js` 파일을 수정하여 포트 및 호스트를 변경할 수 있습니다.

### 5. 테스트

다른 터미널에서 테스트 데이터 전송:

```bash
npm test
```

또는

```bash
node test-sender.js
```

## 데이터 형식

### 수신 형식 (JSON)

```json
{
    "sensor_type": "accelerometer",
    "sensor_id": "accel_001",
    "x": 1.5,
    "y": 2.3,
    "z": 0.8,
    "timestamp": 1234567890.123
}
```

### 전송 형식 (OSC)

센서 타입별로 다음 OSC 주소로 전송됩니다:
- `/sensor/{sensor_type}/{sensor_id}` (sensor_id가 있는 경우)
- `/sensor/{sensor_type}` (sensor_id가 없는 경우)

예시:
- `/sensor/accelerometer/accel_001` -> [1.5, 2.3, 0.8]

## 지원하는 센서 타입

- `accelerometer` - 가속도계
- `gyroscope` - 자이로스코프
- `magnetometer` - 자기계
- `pressure` - 압력
- `temperature` - 온도
- `humidity` - 습도
- `light` - 조도
- `proximity` - 근접

## 프로젝트 구조

```
central-hub-server/
├── index.js             # 메인 진입점
├── config.js            # 설정 파일
├── SensorServer.js      # 센서 서버
├── SensorData.js        # 센서 타입 정의
├── OSCSender.js         # OSC 전송
├── WebServer.js         # 웹 UI 서버
├── test-sender.js       # 테스트 스크립트
├── public/
│   └── index.html       # 웹 UI
├── package.json         # 의존성
└── README.md
```

## 웹 UI 기능

- **실시간 모니터링**: 센서 데이터를 실시간으로 표시
- **통계 대시보드**: 센서별 데이터 개수 추적
- **로그 뷰어**: 모든 활동을 시간순으로 표시
- **차트**: 데이터 전송 레이트를 그래프로 표시
- **반응형 디자인**: 모바일/태블릿/데스크톱 지원

## 의존성

- `osc` - OSC 프로토콜 구현
- `express` - 웹 서버
- `socket.io` - 실시간 통신

## 언리얼 엔진 설정

언리얼 엔진에서 OSC를 수신하려면:

1. OSC 플러그인 활성화
2. OSC 수신 포트를 7000으로 설정
3. `/sensor/`로 시작하는 주소를 구독

## 빠른 시작 요약

1. **서버 시작**:
   ```bash
   npm install
   npm start
   ```

2. **서버 IP 확인**:
   ```bash
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig
   ```

3. **Arduino 코드에서 설정**:
   - 서버 IP: 위에서 확인한 IP 주소
   - 포트: `5000`
   - JSON 형식으로 데이터 전송

4. **웹 UI 확인**:
   - 브라우저에서 `http://서버IP:3000` 접속
   - 실시간 센서 데이터 확인

## 자세한 사용법

Arduino에서 데이터를 보내는 방법과 예제 코드는 `ARDUINO_GUIDE.md` 파일을 참조하세요.

## 라이선스

MIT