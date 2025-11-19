document.addEventListener('DOMContentLoaded', () => {
    const bgCanvas = document.getElementById('webcam-bg');
    const bgCtx = bgCanvas.getContext('2d');
    const desktop = document.getElementById('desktop');
    const progressOverlay = document.getElementById('bg-session-overlay');
    const progressRing = document.getElementById('bg-progress-ring');
    const progressText = document.getElementById('bg-progress-text');

    // Guestbook elements
    const guestOverlay = document.getElementById('guestbook-overlay');
    const guestNickname = document.getElementById('guestbook-nickname');
    const guestMessage = document.getElementById('guestbook-message');
    const guestSaveBtn = document.getElementById('guestbook-save');
    const guestCloseBtn = document.getElementById('guestbook-close');
    const guestStatus = document.getElementById('guestbook-status');
    const guestList = document.getElementById('guestbook-list');

    // Info 말풍선 요소
    const infoButton = document.getElementById('info-button');
    const infoTooltip = document.getElementById('info-tooltip');
    let infoHideTimeout = null;

    // Laptop 안내 오버레이 요소
    const laptopOverlay = document.getElementById('laptop-overlay');
    const laptopCloseBtn = document.getElementById('laptop-close');
    let currentLaptopUdpConfig = null; // 마지막으로 사용한 Laptop UDP 설정 보관

    // Mouse 휠 안내 오버레이 요소
    const mouseOverlay = document.getElementById('mouse-overlay');
    const mouseCloseBtn = document.getElementById('mouse-close');
    let mouseModeActive = false;
    let mouseValue = 0; // 0.0 ~ 1.0 사이 값

    // Hand 모드 안내 오버레이 요소
    const handOverlay = document.getElementById('hand-overlay');
    const handCloseBtn = document.getElementById('hand-close');
    let handModeActive = false;

    // 식물(Plant) LED ON/OFF 상태
    const plantStates = {}; // key: ledIndex -> boolean

    // .exe 실행 상태
    let externalExeRunning = false;

    // Hand 모드시 움직일 아이콘 관리
    const allIcons = [];
    const iconOriginalPos = new Map();
    let handCenterNorm = null; // { x, y } (0~1, 0~1)

    let activeIcon = null;
    let offsetX, offsetY;
    let isDragging = false; // 드래그 여부 판단

    // 창 크기에 맞게 캔버스 리사이즈
    function resizeBackground() {
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeBackground);
    resizeBackground();

    // 그리드 사이즈 정의
    const gridWidth = 90;  // 가로 그리드 간격
    const gridHeight = 100; // 세로 그리드 간격

    // Node.js의 path / fs / electron 모듈
    const path = require('path');
    const fs = require('fs');
    const { ipcRenderer, shell } = require('electron');

    const GUESTBOOK_PATH = path.join(__dirname, 'guestbook.json');

    // run-script 종료 후 웹캠 재시작용 (현재는 스트리밍이라 noop)
    function startWebcam() {
        // Webcam is driven by Python streaming server; nothing to restart here.
    }

    // BG 세션 상태 (배경 치환용) - 진행률/프로그레스 바는 더 이상 사용하지 않음
    let bgSessionActive = false;
    // kaya.exe 실행 상태 (Project 아이콘에서 제어)
    let kayaRunning = false;

    // 1. 파이썬 스트리밍 서버(WebSocket)에서 배경 프레임 수신
    const ws = new WebSocket('ws://localhost:8765');
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
        console.log('Connected to Python bg_stream_server.');
    };

    // 손 랜드마크 (파이썬에서 전달받은 21개 포인트 배열들)
    // handsData: [ [ {x,y}, ...21개 ], [ {x,y}, ... ], ... ]
    let handsData = [];

    function drawHandsOverlay() {
        if (!handsData.length) return;
        bgCtx.save();

        let bestCenter = null;
        let bestX = -1;

        handsData.forEach((hand) => {
            if (!hand || !hand.length) return;

            let minX = 1, maxX = 0, minY = 1, maxY = 0;
            hand.forEach((p) => {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            });

            // 약간의 패딩을 줘서 손보다 살짝 큰 사각형
            const padding = 0.1;
            const widthNorm = (maxX - minX) * (1 + padding);
            const heightNorm = (maxY - minY) * (1 + padding);
            const centerXNorm = (minX + maxX) / 2;
            const centerYNorm = (minY + maxY) / 2;

            const width = widthNorm * bgCanvas.width;
            const height = heightNorm * bgCanvas.height;
            const x = (centerXNorm * bgCanvas.width) - width / 2;
            const y = (centerYNorm * bgCanvas.height) - height / 2;

            // 손 영역에 맞는 반투명 사각형
            bgCtx.beginPath();
            bgCtx.rect(x, y, width, height);
            bgCtx.fillStyle = 'rgba(0, 0, 0, 0.25)';
            bgCtx.fill();
            bgCtx.lineWidth = 3;
            bgCtx.strokeStyle = '#FFFFFF';
            bgCtx.stroke();

            // 오른손 후보: 더 오른쪽(큰 x)을 선택
            if (centerXNorm > bestX) {
                bestX = centerXNorm;
                bestCenter = { x: centerXNorm, y: centerYNorm };
            }
        });
        bgCtx.restore();

        // 글로벌 handCenterNorm 업데이트
        handCenterNorm = bestCenter;

        // Hand 모드에서 아이콘들을 손 주변으로 모으기
        if (handModeActive && handCenterNorm && allIcons.length) {
            const desktopRect = desktop.getBoundingClientRect();
            const cx = handCenterNorm.x * bgCanvas.width;
            const cy = handCenterNorm.y * bgCanvas.height;
            const radius = 120; // 손 주변으로 모일 반지름

            allIcons.forEach((icon, index) => {
                const angle = (index / allIcons.length) * Math.PI * 2;
                let x = cx + Math.cos(angle) * radius;
                let y = cy + Math.sin(angle) * radius;

                // 화면 경계 내로 제한
                x = Math.max(0, Math.min(x, desktopRect.width - icon.offsetWidth));
                y = Math.max(0, Math.min(y, desktopRect.height - icon.offsetHeight));

                icon.style.left = `${x}px`;
                icon.style.top = `${y}px`;
            });
        }
    }

    ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
            // 손 랜드마크 메타데이터
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'hands' && Array.isArray(msg.hands)) {
                    handsData = msg.hands;
                }
            } catch (e) {
                console.error('Failed to parse metadata:', e);
            }
        } else {
            // JPEG 프레임
            const blob = new Blob([event.data], { type: 'image/jpeg' });
            const img = new Image();
            img.onload = () => {
                bgCtx.drawImage(img, 0, 0, bgCanvas.width, bgCanvas.height);
                drawHandsOverlay(); // 프레임 위에 손 GUI 그리기
                URL.revokeObjectURL(img.src);
            };
            img.src = URL.createObjectURL(blob);
        }
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
    };

    // BG 모드 제어 헬퍼
    function sendBgCommand(cmd) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(cmd);
        }
    }

    // BG 진행률/프로그레스 바는 현재 사용하지 않으므로 더미 함수로 둡니다.
    function updateProgressUI() {}
    function showProgress() {}
    function hideProgress() {}

    function startBgSession() {
        if (bgSessionActive) return;
        bgSessionActive = true;
        sendBgCommand('BG_ON');

        bgTimerId = setInterval(() => {
            bgRemaining -= 1;
            if (bgRemaining <= 0) {
                stopBgSession(true);
            } else {
                updateProgressUI();
            }
        }, 1000);
    }

    // fromTimerOrUser=true → 우리가 직접 kaya.exe 종료 요청도 보냄
    function stopBgSession(fromTimerOrUser) {
        if (!bgSessionActive) return;
        bgSessionActive = false;
        sendBgCommand('BG_OFF');
    }

    // kaya.exe 가 스스로 종료된 경우 main → renderer 로 통지
    ipcRenderer.on('bg-session-ended', () => {
        stopBgSession(false);
    });

    // --- Guestbook helpers ---
    function loadGuestbook() {
        try {
            const raw = fs.readFileSync(GUESTBOOK_PATH, 'utf-8');
            const data = JSON.parse(raw);
            if (Array.isArray(data)) return data;
            return [];
        } catch (e) {
            return [];
        }
    }

    function saveGuestbook(entries) {
        try {
            fs.writeFileSync(GUESTBOOK_PATH, JSON.stringify(entries, null, 2), 'utf-8');
        } catch (e) {
            console.error('Failed to save guestbook:', e);
        }
    }

    function renderGuestbookList() {
        const entries = loadGuestbook();
        guestList.innerHTML = '';
        if (!entries.length) {
            guestList.textContent = 'No entries yet.';
            return;
        }
        const reversed = entries.slice().reverse();
        reversed.forEach((entry) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'guestbook-entry';

            const header = document.createElement('div');
            header.className = 'guestbook-entry-header';

            const nickSpan = document.createElement('span');
            nickSpan.className = 'guestbook-nick';
            nickSpan.textContent = entry.nickname || 'Unknown';

            const timeSpan = document.createElement('span');
            timeSpan.className = 'guestbook-time';
            try {
                const d = new Date(entry.timestamp);
                timeSpan.textContent = d.toLocaleString();
            } catch {
                timeSpan.textContent = entry.timestamp || '';
            }

            header.appendChild(nickSpan);
            header.appendChild(timeSpan);

            const msgDiv = document.createElement('div');
            msgDiv.textContent = entry.message || '';

            wrapper.appendChild(header);
            wrapper.appendChild(msgDiv);
            guestList.appendChild(wrapper);
        });
    }

    function openGuestbook() {
        if (!guestOverlay) return;
        guestNickname.value = '';
        guestMessage.value = '';
        guestStatus.textContent = '';
        renderGuestbookList();
        guestOverlay.classList.remove('guestbook-hidden');
        guestNickname.focus();
    }

    function closeGuestbook() {
        if (!guestOverlay) return;
        guestOverlay.classList.add('guestbook-hidden');
    }

    if (guestSaveBtn) {
        guestSaveBtn.addEventListener('click', () => {
            const nick = guestNickname.value.trim();
            const msg = guestMessage.value.trim();
            if (!nick || !msg) {
                guestStatus.textContent = 'Please enter nickname and message.';
                return;
            }
            const entries = loadGuestbook();
            entries.push({
                nickname: nick,
                message: msg,
                timestamp: new Date().toISOString(),
            });
            saveGuestbook(entries);
            guestMessage.value = '';
            guestStatus.textContent = 'Saved!';
            renderGuestbookList();
        });
    }

    if (guestCloseBtn) {
        guestCloseBtn.addEventListener('click', () => {
            closeGuestbook();
        });
    }

    // 2. 아이콘 데이터 정의
    const icons = [
        { name: 'AboutMe.txt', type: 'file', img: 'icons/notepad.png', file: path.join(__dirname, 'AboutMe.txt'), top: 150, left: 80 },
        { name: 'Guestbook.txt', type: 'guestbook', img: 'icons/notepad.png', top: 250, left: 80 },
        { name: 'MIC.mov', type: 'script', img: 'icons/mic1.png', script: 'mic_control.py', top: 350, left: 150 },
        { name: 'BG.png', type: 'bg', img: 'icons/bg.png', top: 450, left: 150 },
        { name: '3dowon.print', type: 'script', img: 'icons/print.png', script: 'print_receipt.py', top: 600, left: 100 },
        // 마우스 휠 상호작용 아이콘 (별도의 .exe도 함께 실행하고 싶으면 exePath 설정)
        // JS 문자열에서는 백슬래시를 이스케이프해야 하므로 \\ 로 작성
        { 
            name: 'Mouse_scroll.exe',
            type: 'mouse_scroll',
            img: 'icons/mouse.png',
            exePath: 'F:\\UprisingFesta\\UE5\\BuildTest\\Landscape\\Windows\\Lens.exe',
            top: 450,
            left: 300
        },
        // 손 제스처 모드 아이콘 (이미지는 hand 아이콘)
        { name: 'Hand_mode', type: 'hand_mode', img: 'icons/hand.png', top: 350, left: 300 },
        // 식물(ESP32 LED 제어) 아이콘 - ledIndex 로 LED1~LED10 지정, host 는 ESP32 IP 로 변경
        {
            name: 'Plant 1',
            type: 'plant',
            img: 'icons/plant.png',       
            host: '192.168.0.57',          // ESP32 가 받은 IP 로 수정
            port: 5007,
            ledIndex: 1,
            top: 350,
            left: 450
        },
        // 노트북 전원 제어용 UDP 아이콘 (host/port는 실제 대상 노트북의 IP/포트로 수정해서 사용)
        { name: 'Notebook.exe', type: 'udp', img: 'icons/notebook.png', host: '192.168.0.88', port: 5005, message: 'wake', top: 600, left: 250 },
        { name: 'Project 1 (Private)', type: 'kaya', img: 'icons/unreal.png', top: 500, left: 750 },
        { name: 'Project 2 (Control)', type: 'file', img: 'icons/folder.png', file: 'D:\\\\Projects\\\\Control', top: 380, left: 650 },
        { name: 'Psycho_Dia_01.jpg', type: 'file', img: 'icons/file.png', file: 'C:\\\\Users\\\\User\\\\Pictures\\\\Psycho_Dia_01.jpg', top: 600, left: 550 },
        { name: 'YouTube', type: 'url', img: 'icons/youtube.png', url: 'https://www.youtube.com/@threeDowon', top: 450, left: 50 },
        { name: 'Recycle Bin', type: 'special', img: 'icons/recycle-bin.png', action: 'open-recycle-bin', top: 50, left: 1150 },
    ];

    // 3. 아이콘 요소 생성
    icons.forEach(iconData => {
        const iconDiv = document.createElement('div');
        iconDiv.className = 'icon';
        iconDiv.style.left = iconData.left + 'px';
        iconDiv.style.top = iconData.top + 'px';
        
        const img = document.createElement('img');
        img.src = iconData.img;
        img.alt = iconData.name;
        img.draggable = false;

        const span = document.createElement('span');
        span.textContent = iconData.name;

        iconDiv.appendChild(img);
        iconDiv.appendChild(span);
        desktop.appendChild(iconDiv);

        // Hand 모드를 위해 모든 아이콘의 초기 위치 저장
        allIcons.push(iconDiv);
        iconOriginalPos.set(iconDiv, { left: iconData.left, top: iconData.top });
        
        // 5. 더블클릭 이벤트 핸들러
        iconDiv.addEventListener('dblclick', () => {
            if (iconData.type === 'url') {
                // 외부 브라우저에서 URL을 엽니다.
                shell.openExternal(iconData.url);
            } else if (iconData.type === 'file') {
                // 파일 경로를 기본 프로그램으로 엽니다.
                shell.openPath(iconData.file)
                    .catch(err => {
                        console.error("파일을 열 수 없습니다:", err);
                        alert(`'${iconData.file}' 파일을 열 수 없습니다. 경로를 확인하거나 파일이 존재하는지 확인해주세요.`);
                    });
            } else if (iconData.type === 'script') {
                // main 프로세스에 스크립트 실행을 요청합니다.
                ipcRenderer.send('run-script', iconData.script);
            } else if (iconData.type === 'bg') {
                // BG 아이콘: 배경 치환 + kaya.exe 세션 토글
                if (!bgSessionActive) {
                    startBgSession();
                } else {
                    stopBgSession(true);
                }
            } else if (iconData.type === 'udp') {
                // UDP 패킷 전송 요청 (다른 노트북에 'wake' 신호 보내기)
                const wakeMessage = iconData.message ?? 'wake';
                ipcRenderer.send('send-udp', {
                    host: iconData.host,
                    port: iconData.port,
                    message: wakeMessage
                });

                // 현재 설정 저장 후 Laptop 안내 오버레이 표시
                currentLaptopUdpConfig = {
                    host: iconData.host,
                    port: iconData.port,
                    // overlay 닫힐 때 보낼 메시지 (없으면 'close')
                    closeMessage: iconData.closeMessage ?? 'close'
                };
                if (laptopOverlay) {
                    laptopOverlay.classList.remove('laptop-hidden');
                }
            } else if (iconData.type === 'mouse_scroll') {
                // 마우스 휠 모드 활성화 & 안내 오버레이 표시
                mouseModeActive = true;
                mouseValue = 0; // 시작 시 0에서 시작
                if (mouseOverlay) {
                    mouseOverlay.classList.remove('mouse-hidden');
                }

                // 이 아이콘에 exePath가 설정되어 있다면, 모드 시작과 함께 exe 실행
                if (!externalExeRunning && iconData.exePath) {
                    ipcRenderer.send('exec-start', iconData.exePath);
                    externalExeRunning = true;
                }

                // wheel 핸들러를 한 번만 등록
                if (!window.__mouseWheelHandler) {
                    window.__mouseWheelHandler = (event) => {
                        if (!mouseModeActive) return;

                        // deltaY는 위로 스크롤 시 음수, 아래로 스크롤 시 양수
                        // 감도(sensitivity)를 조절해서 0~1 범위 안에서 부드럽게 이동
                        const sensitivity = -0.001; // 필요에 따라 조절 가능
                        mouseValue += event.deltaY * sensitivity;
                        // 0.0 ~ 1.0 범위로 클램프
                        if (mouseValue < 0) mouseValue = 0;
                        if (mouseValue > 1) mouseValue = 1;

                        const payload = {
                            sensor_type: 'mouse',
                            sensor_id: 'mouse_wheel',
                            timestamp: Date.now() / 1000,
                            value: mouseValue
                        };

                        // Unreal 쪽에서 수신하는 UDP/OSC 포트에 맞게 설정
                        ipcRenderer.send('send-udp', {
                            host: '127.0.0.1',
                            port: 7000,
                            message: JSON.stringify(payload)
                        });
                    };
                    window.addEventListener('wheel', window.__mouseWheelHandler, { passive: true });
                }
            } else if (iconData.type === 'plant') {
                // 식물 아이콘: ESP32로 LED ON/OFF 토글 신호 전송
                const ledIndex = iconData.ledIndex ?? 1; // 기본 LED1
                const key = `led${ledIndex}`;
                const isOn = !plantStates[key];
                plantStates[key] = isOn;

                const cmd = `LED_${isOn ? 'ON' : 'OFF'}`;
                console.log('[PLANT] send', cmd, 'to', iconData.host, iconData.port);

                ipcRenderer.send('send-udp', {
                    host: iconData.host,
                    port: iconData.port,
                    message: cmd
                });
            } else if (iconData.type === 'hand_mode') {
                // Hand 모드 활성화 & 안내 오버레이 표시
                handModeActive = true;
                if (handOverlay) {
                    handOverlay.classList.remove('hand-hidden');
                }
            } else if (iconData.type === 'kaya') {
                // kaya.exe 실행/종료 토글 (Project 아이콘 전용)
                if (!kayaRunning) {
                    ipcRenderer.send('bg-session-start');
                    kayaRunning = true;
                } else {
                    ipcRenderer.send('bg-session-stop');
                    kayaRunning = false;
                }
            } else if (iconData.type === 'guestbook') {
                openGuestbook();
            } else if (iconData.type === 'special') {
                // main 프로세스에 특별 동작을 요청합니다.
                ipcRenderer.send(iconData.action);
            }
        });

        // 4. 드래그 앤 드롭 이벤트 핸들러
        iconDiv.addEventListener('mousedown', (e) => {
            if (activeIcon) {
                activeIcon.classList.remove('selected');
            }
            activeIcon = iconDiv;
            activeIcon.classList.add('selected');

            offsetX = e.clientX - iconDiv.getBoundingClientRect().left;
            offsetY = e.clientY - iconDiv.getBoundingClientRect().top;
            isDragging = false; // 새 드래그 시작 시 초기화
            
            desktop.addEventListener('mousemove', onMouseMove);
        });
    });

    // Info 말풍선 표시/숨기기 로직
    function showInfoTooltip() {
        if (!infoTooltip) return;
        clearTimeout(infoHideTimeout);
        infoTooltip.classList.remove('info-hidden');
    }

    function hideInfoTooltipSoon() {
        if (!infoTooltip) return;
        clearTimeout(infoHideTimeout);
        infoHideTimeout = setTimeout(() => {
            infoTooltip.classList.add('info-hidden');
        }, 200);
    }

    if (infoButton && infoTooltip) {
        infoButton.addEventListener('mouseenter', showInfoTooltip);
        infoButton.addEventListener('mouseleave', hideInfoTooltipSoon);

        infoButton.addEventListener('click', () => {
            if (infoTooltip.classList.contains('info-hidden')) {
                showInfoTooltip();
            } else {
                infoTooltip.classList.add('info-hidden');
            }
        });

        infoTooltip.addEventListener('mouseenter', () => {
            clearTimeout(infoHideTimeout);
        });
        infoTooltip.addEventListener('mouseleave', hideInfoTooltipSoon);
    }

    // Laptop 오버레이 닫기 → UDP로 close 신호 전송
    if (laptopCloseBtn && laptopOverlay) {
        laptopCloseBtn.addEventListener('click', () => {
            if (currentLaptopUdpConfig) {
                ipcRenderer.send('send-udp', {
                    host: currentLaptopUdpConfig.host,
                    port: currentLaptopUdpConfig.port,
                    message: currentLaptopUdpConfig.closeMessage ?? 'close'
                });
            }
            laptopOverlay.classList.add('laptop-hidden');
        });

        // 오버레이 배경 클릭 시에도 닫기 (모달 바깥 클릭)
        laptopOverlay.addEventListener('click', (e) => {
            if (e.target === laptopOverlay) {
                laptopCloseBtn.click();
            }
        });
    }

    // Mouse 오버레이 닫기 → 휠 모드 비활성화
    if (mouseCloseBtn && mouseOverlay) {
        mouseCloseBtn.addEventListener('click', () => {
            mouseModeActive = false;
            mouseOverlay.classList.add('mouse-hidden');

            // 마우스 모드와 함께 실행한 exe가 있다면 여기서도 종료
            if (externalExeRunning) {
                ipcRenderer.send('exec-stop');
                externalExeRunning = false;
            }
        });

        mouseOverlay.addEventListener('click', (e) => {
            if (e.target === mouseOverlay) {
                mouseCloseBtn.click();
            }
        });
    }

    // Hand 오버레이 닫기 → Hand 모드 비활성화 및 아이콘 원위치 복원
    if (handCloseBtn && handOverlay) {
        handCloseBtn.addEventListener('click', () => {
            handModeActive = false;
            handOverlay.classList.add('hand-hidden');

            // 아이콘들을 원래 자리로 복원
            allIcons.forEach((icon) => {
                const pos = iconOriginalPos.get(icon);
                if (pos) {
                    icon.style.left = pos.left + 'px';
                    icon.style.top = pos.top + 'px';
                }
            });
        });

        handOverlay.addEventListener('click', (e) => {
            if (e.target === handOverlay) {
                handCloseBtn.click();
            }
        });
    }

    function onMouseMove(e) {
        if (!activeIcon) return;
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;

        // 실제로 위치가 변하면 드래그 중으로 판단
        const currentLeft = parseInt(activeIcon.style.left, 10);
        const currentTop = parseInt(activeIcon.style.top, 10);
        if (Math.abs(newX - currentLeft) > 2 || Math.abs(newY - currentTop) > 2) {
            isDragging = true;
        }

        // 화면 경계 체크
        const desktopRect = desktop.getBoundingClientRect();
        newX = Math.max(0, Math.min(newX, desktopRect.width - activeIcon.offsetWidth));
        newY = Math.max(0, Math.min(newY, desktopRect.height - activeIcon.offsetHeight));

        activeIcon.style.left = newX + 'px';
        activeIcon.style.top = newY + 'px';
    }

    desktop.addEventListener('mouseup', () => {
        if (activeIcon && isDragging) {
            const finalLeft = parseInt(activeIcon.style.left, 10);
            const finalTop = parseInt(activeIcon.style.top, 10);

            // 가장 가까운 그리드에 맞추기
            const snappedX = Math.round(finalLeft / gridWidth) * gridWidth;
            const snappedY = Math.round(finalTop / gridHeight) * gridHeight;

            activeIcon.style.left = snappedX + 'px';
            activeIcon.style.top = snappedY + 'px';
        }
        desktop.removeEventListener('mousemove', onMouseMove);
    });

    // 바탕화면 클릭 시 아이콘 선택 해제
    desktop.addEventListener('mousedown', (e) => {
        if (e.target === desktop && activeIcon) {
            activeIcon.classList.remove('selected');
            activeIcon = null;
        }
    });

    // 시계 기능
    const clockElement = document.getElementById('clock');
    function updateClock() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        clockElement.textContent = `${hours}:${minutes}:${seconds}`;
    }

    setInterval(updateClock, 1000);
    updateClock(); // 초기 실행

    // 눈동자 움직임 기능
    const eyes = document.querySelectorAll('.eye');
    let idleInterval = null;

    function startIdleAnimation() {
        if (idleInterval) return; // 이미 실행 중이면 중복 방지
        let angle = 0;
        idleInterval = setInterval(() => {
            angle += 0.05; // 움직임 속도
            eyes.forEach(eye => {
                const pupil = eye.querySelector('.pupil');
                const maxDistance = (eye.offsetWidth / 2) - (pupil.offsetWidth / 2);
                const pupilX = Math.sin(angle) * maxDistance;
                // Y축은 고정
                pupil.style.transform = `translate(-50%, -50%) translate(${pupilX}px, 0px)`;
            });
        }, 20); // 애니메이션 부드러움 조절
    }

    function stopIdleAnimation() {
        clearInterval(idleInterval);
        idleInterval = null;
    }

    // 마우스가 창에 들어왔을 때
    document.body.addEventListener('mouseenter', () => {
        stopIdleAnimation();
    });

    // 마우스가 창을 나갔을 때
    document.body.addEventListener('mouseleave', () => {
        startIdleAnimation();
    });

    // 마우스 움직임 추적
    document.addEventListener('mousemove', (e) => {
        // 유휴 애니메이션이 실행 중일 때는 마우스 추적 안 함
        if (idleInterval) return;

        eyes.forEach(eye => {
            const pupil = eye.querySelector('.pupil');
            const eyeRect = eye.getBoundingClientRect();
            const eyeCenterX = eyeRect.left + eyeRect.width / 2;
            const eyeCenterY = eyeRect.top + eyeRect.height / 2;
            
            const mouseX = e.clientX;
            const mouseY = e.clientY;

            const angle = Math.atan2(mouseY - eyeCenterY, mouseX - eyeCenterX);
            
            const maxDistance = (eye.offsetWidth / 2) - (pupil.offsetWidth / 2);
            
            const pupilX = Math.cos(angle) * maxDistance;
            const pupilY = Math.sin(angle) * maxDistance;

            pupil.style.transform = `translate(-50%, -50%) translate(${pupilX}px, ${pupilY}px)`;
        });
    });

    // 페이지 로드 시 유휴 애니메이션 시작
    startIdleAnimation();

    // 파이썬 스크립트 종료 후 웹캠을 다시 켜라는 신호 수신
    ipcRenderer.on('restart-webcam', () => {
        startWebcam();
    });
});


