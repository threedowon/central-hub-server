document.addEventListener('DOMContentLoaded', () => {
    const webcamVideo = document.getElementById('webcam-bg');
    const desktop = document.getElementById('desktop');
    let activeIcon = null;
    let offsetX, offsetY;

    // 그리드 사이즈 정의
    const gridWidth = 90;  // 가로 그리드 간격
    const gridHeight = 100; // 세로 그리드 간격

    // Node.js의 path 모듈을 가져옵니다.
    const path = require('path');

    // 1. 웹캠 스트림 가져오기
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(function (stream) {
                webcamVideo.srcObject = stream;
                webcamVideo.play();
            })
            .catch(function (error) {
                console.error("웹캠에 접근할 수 없습니다:", error);
                alert('웹캠을 찾을 수 없거나 접근 권한이 없습니다. 페이지를 새로고침하거나 권한을 확인해주세요.');
            });
    } else {
        alert('이 브라우저에서는 웹캠을 지원하지 않습니다.');
    }

    // 2. 아이콘 데이터 정의
    const icons = [
        { name: 'AboutMe.txt', type: 'file', img: 'icons/notepad.png', file: path.join(__dirname, 'AboutMe.txt'), top: 150, left: 80 },
        { name: 'MIC.mov', type: 'script', img: 'icons/mic1.png', script: 'mic_control.py', top: 350, left: 150 },
        { name: '3dowon.print', type: 'script', img: 'icons/print.png', script: 'print_receipt.py', top: 600, left: 100 },
        { name: 'CV_2020.pdf', type: 'file', img: 'icons/pdf.png', file: 'C:\\\\Users\\\\User\\\\Documents\\\\CV_2020.pdf', top: 250, left: 250 },
        { name: 'Project 1 (Private)', type: 'file', img: 'icons/unreal.png', file: 'D:\\\\Projects\\\\Private', top: 500, left: 750 },
        { name: 'Project 2 (Control)', type: 'file', img: 'icons/folder.png', file: 'D:\\\\Projects\\\\Control', top: 380, left: 650 },
        { name: 'Psycho_Dia_01.jpg', type: 'file', img: 'icons/file.png', file: 'C:\\\\Users\\\\User\\\\Pictures\\\\Psycho_Dia_01.jpg', top: 600, left: 550 },
        { name: 'YouTube', type: 'url', img: 'icons/youtube.png', url: 'https://www.youtube.com/@threeDowon', top: 450, left: 50 },
        { name: 'Experiments', type: 'file', img: 'icons/computer.png', file: 'C:\\\\Program Files\\\\Experiments', top: 250, left: 50 },
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
        
        // 5. 더블클릭 이벤트 핸들러
        iconDiv.addEventListener('dblclick', () => {
            // Electron의 shell 모듈을 가져옵니다.
            const { shell, ipcRenderer } = require('electron');

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
            
            desktop.addEventListener('mousemove', onMouseMove);
        });
    });

    function onMouseMove(e) {
        if (!activeIcon) return;
        let newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;

        // 화면 경계 체크
        const desktopRect = desktop.getBoundingClientRect();
        newX = Math.max(0, Math.min(newX, desktopRect.width - activeIcon.offsetWidth));
        newY = Math.max(0, Math.min(newY, desktopRect.height - activeIcon.offsetHeight));

        activeIcon.style.left = newX + 'px';
        activeIcon.style.top = newY + 'px';
    }

    desktop.addEventListener('mouseup', () => {
        if (activeIcon) {
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
});
