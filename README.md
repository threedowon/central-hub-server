# Central Hub Server

여러 센서로부터 JSON 데이터를 UDP로 수신하고, 센서 타입에 따라 분류하여 언리얼 엔진에 OSC 프로토콜로 전송하는 중앙 서버입니다.

## 주요 기능

- UDP로 센서 데이터 수신 (JSON 형식)
- 센서 타입별 자동 분류
- OSC 프로토콜을 통한 언리얼 엔진 데이터 전송
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
- UDP 수신: `0.0.0.0:5000`
- OSC 전송: `127.0.0.1:7000`

### 2. 설정 변경

`config.js` 파일을 수정하여 포트 및 호스트를 변경할 수 있습니다.

### 3. 테스트

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
├── test-sender.js       # 테스트 스크립트
├── package.json         # 의존성
└── README.md
```

## 의존성

- `osc` - OSC 프로토콜 구현

## 언리얼 엔진 설정

언리얼 엔진에서 OSC를 수신하려면:

1. OSC 플러그인 활성화
2. OSC 수신 포트를 7000으로 설정
3. `/sensor/`로 시작하는 주소를 구독

## 라이선스

MIT