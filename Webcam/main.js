const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');

function createWindow() {
    // 브라우저 창을 생성합니다.
    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        frame: false, // 창 프레임 제거
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            // renderer process에서 Node.js API를 사용할 수 있도록 설정
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
    });
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

// 앱이 종료되기 전에 단축키 해제
app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

// 모든 창이 닫혔을 때 앱을 종료합니다. (Windows & Linux)
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
