const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const dgram = require('dgram'); // UDP 전송을 위한 모듈 추가

let mainWindow;               // renderer에 메시지를 보내기 위한 전역 참조
let bgServerProcess = null;   // Python 스트리밍 서버 프로세스
let kayaProcess = null;       // BG용 kaya.exe
let externalExeProcess = null; // 일반 .exe 프로세스 (아이콘에서 실행)
const KAYA_EXE_PATH = 'F:\\\\UprisingFesta\\\\UE5\\\\BuildTest\\\\Kaya\\\\Windows\\\\kaya.exe';

function createWindow() {
    // 브라우저 창을 생성합니다.
    mainWindow = new BrowserWindow({
        fullscreen: false, // 전체 화면으로 실행
        frame: false, // 창 프레임 제거
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            // renderer process에서 Node.js API를 직접 사용할 수 있도록 설정
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // index.html 파일을 로드합니다.
    mainWindow.loadFile('index.html');

    // 개발자 도구를 엽니다. (선택 사항)
    // mainWindow.webContents.openDevTools();
}

// Python 스크립트를 실행하는 리스너
ipcMain.on('run-script', (event, scriptName) => {
    const scriptPath = path.join(__dirname, scriptName);
    const pythonProcess = spawn('python', [scriptPath]);

    pythonProcess.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
        // 파이썬 스크립트가 끝나면 웹캠을 다시 켜도록 렌더러에 알림
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('restart-webcam');
        }
    });
});

// UDP 패킷 전송 리스너 (다른 노트북에 신호 보내기)
ipcMain.on('send-udp', (event, payload) => {
    const { host, port, message } = payload;
    const client = dgram.createSocket('udp4');
    const buf = Buffer.from(message ?? 'wake', 'utf8');

    client.send(buf, port, host, (err) => {
        if (err) {
            console.error('[UDP] Send error:', err);
        } else {
            console.log(`[UDP] Sent "${buf.toString()}" to ${host}:${port}`);
        }
        client.close();
    });
});

// 임의의 .exe 실행/종료 리스너
ipcMain.on('exec-start', (event, exePath) => {
    if (externalExeProcess) {
        console.log('[EXEC] Process already running.');
        return;
    }
    console.log('[EXEC] Starting exe:', exePath);
    externalExeProcess = spawn(exePath, [], { detached: false });

    externalExeProcess.stdout && externalExeProcess.stdout.on('data', (data) => {
        console.log(`[EXEC stdout]: ${data}`);
    });
    externalExeProcess.stderr && externalExeProcess.stderr.on('data', (data) => {
        console.error(`[EXEC stderr]: ${data}`);
    });

    externalExeProcess.on('close', (code) => {
        console.log(`[EXEC] exe exited with code ${code}`);
        externalExeProcess = null;
    });
});

ipcMain.on('exec-stop', () => {
    if (externalExeProcess) {
        console.log('[EXEC] Stopping exe...');
        // Windows의 경우 일부 exe가 SIGTERM을 무시하므로 taskkill 사용
        if (process.platform === 'win32') {
            try {
                const pid = externalExeProcess.pid;
                console.log(`[EXEC] taskkill /PID ${pid} /T /F`);
                exec(`taskkill /PID ${pid} /T /F`, (err) => {
                    if (err) {
                        console.error('[EXEC] taskkill error:', err);
                    }
                });
            } catch (e) {
                console.error('[EXEC] Failed to taskkill:', e);
            }
        } else {
            externalExeProcess.kill();
        }
        externalExeProcess = null;
    }
});

// BG 세션 제어 (kaya.exe 실행/종료)
ipcMain.on('bg-session-start', () => {
    if (kayaProcess) return; // 이미 실행 중이면 무시
    console.log('Starting kaya.exe...');
    kayaProcess = spawn(KAYA_EXE_PATH, [], { detached: false });

    kayaProcess.stdout && kayaProcess.stdout.on('data', (data) => {
        console.log(`kaya stdout: ${data}`);
    });
    kayaProcess.stderr && kayaProcess.stderr.on('data', (data) => {
        console.error(`kaya stderr: ${data}`);
    });

    kayaProcess.on('close', (code) => {
        console.log(`kaya.exe exited with code ${code}`);
        kayaProcess = null;
        // 렌더러에 세션 종료 알림
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bg-session-ended');
        }
    });
});

ipcMain.on('bg-session-stop', () => {
    if (kayaProcess) {
        console.log('Stopping kaya.exe...');
        kayaProcess.kill();
        kayaProcess = null;
    }
});

// 휴지통 열기 리스너
ipcMain.on('open-recycle-bin', () => {
    // Windows에서 휴지통을 여는 명령어
    exec('start shell:RecycleBinFolder', (err) => {
        if (err) {
            console.error("휴지통을 열 수 없습니다:", err);
        }
    });
});


// Electron이 준비되면 앱 창을 생성합니다.
app.whenReady().then(() => {
    // 1) 파이썬 배경 치환 스트리밍 서버 실행
    const serverScript = path.join(__dirname, 'bg_stream_server.py');
    bgServerProcess = spawn('python', [serverScript]);

    bgServerProcess.stdout.on('data', (data) => {
        console.log(`bg_server stdout: ${data}`);
    });

    bgServerProcess.stderr.on('data', (data) => {
        console.error(`bg_server stderr: ${data}`);
    });

    bgServerProcess.on('close', (code) => {
        console.log(`bg_stream_server exited with code ${code}`);
    });

    createWindow();

    // 'Shift+Q' 전역 단축키 등록
    globalShortcut.register('Shift+Q', () => {
        app.quit();
    });

    app.on('activate', function () {
        // macOS에서 dock 아이콘이 클릭되었을 때 창이 없으면 새로 생성합니다.
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// 앱이 종료되기 전에 단축키 해제 및 파이썬 서버 종료
app.on('will-quit', () => {
    if (bgServerProcess) {
        bgServerProcess.kill();
        bgServerProcess = null;
    }
    if (kayaProcess) {
        kayaProcess.kill();
        kayaProcess = null;
    }
    if (externalExeProcess) {
        console.log('[EXEC] Cleaning up exe on app quit...');
        if (process.platform === 'win32') {
            try {
                const pid = externalExeProcess.pid;
                exec(`taskkill /PID ${pid} /T /F`, (err) => {
                    if (err) {
                        console.error('[EXEC] taskkill error (on quit):', err);
                    }
                });
            } catch (e) {
                console.error('[EXEC] Failed to taskkill on quit:', e);
            }
        } else {
            externalExeProcess.kill();
        }
        externalExeProcess = null;
    }
    globalShortcut.unregisterAll();
});

// 모든 창이 닫혔을 때 앱을 종료합니다. (Windows & Linux)
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
