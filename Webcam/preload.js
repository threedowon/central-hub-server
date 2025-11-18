// preload.js

// 모든 Node.js API는 preload 프로세스에서 사용할 수 있습니다.
// 웹 페이지와 동일한 샌드박스를 가집니다.
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element) element.innerText = text;
    };

    for (const dependency of ['chrome', 'node', 'electron']) {
        replaceText(`${dependency}-version`, process.versions[dependency]);
    }
});
