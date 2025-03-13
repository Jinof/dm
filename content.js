console.log('开启注入脚本');

// 初始化插件的主要逻辑
function initializePlugin() {
    console.log('准备初始化弹幕获取器...');
    console.log('弹幕获取器已启动');

    // 创建悬浮窗样式
    const style = document.createElement('style');
    style.textContent = `
        #danmaku-window {
          position: fixed;
          right: 20px;
          bottom: 20px;
          width: 300px;
          height: 300px;
          background-color: rgba(0, 0, 0, 0.7);
          border-radius: 10px;
          padding: 10px;
          box-sizing: border-box;
          color: #FF69B4;
          font-size: 14px;
          overflow-y: auto;
          z-index: 999999;
          display: flex;
          flex-direction: column;
        }
        #danmaku-input-container {
          display: flex;
          gap: 5px;
          margin-bottom: 10px;
          flex-shrink: 0;
          align-items: center;
        }
        #danmaku-input-container::before {
          content: "⋮⋮";
          font-size: 16px;
          color: #FF69B4;
          cursor: move;
          padding: 0 5px;
          class: "drag-handle";
        }
        #danmaku-input {
          flex: 1;
          padding: 5px;
          border: 1px solid #FF69B4;
          border-radius: 5px;
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        #danmaku-submit {
          padding: 5px 10px;
          background: #FF69B4;
          border: none;
          border-radius: 5px;
          color: #fff;
          cursor: pointer;
        }
        #danmaku-submit:hover {
          background: #FF1493;
        }
        #danmaku-content {
          flex: 1;
          overflow-y: auto;
        }
        @keyframes fadeInOut {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
    `;
    document.head.appendChild(style);

    // 创建悬浮窗
    const floatingWindow = document.createElement('div');
    floatingWindow.id = 'danmaku-window';

    // 移除标题栏相关代码

    // 创建输入框容器
    const inputContainer = document.createElement('div');
    inputContainer.id = 'danmaku-input-container';

    // 创建输入框
    const input = document.createElement('input');
    input.id = 'danmaku-input';
    input.type = 'text';
    input.placeholder = '输入B站视频链接...';

    // 创建提交按钮
    const submit = document.createElement('button');
    submit.id = 'danmaku-submit';
    submit.textContent = '获取';

    // 创建弹幕内容容器
    const danmakuContent = document.createElement('div');
    danmakuContent.id = 'danmaku-content';

    // 添加拖拽功能
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    floatingWindow.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        console.log('dragStart', e);
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        if (e.target === inputContainer) {
            isDragging = true;
        }
    }

    function drag(e) {
        console.log('drag', e, floatingWindow)
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;

            xOffset = currentX;
            yOffset = currentY;

            setTranslate(currentX, currentY, floatingWindow);
        }
    }

    function dragEnd(e) {
        console.log('dragEnd', e)
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
    }

    // 组装悬浮窗
    inputContainer.appendChild(input);
    inputContainer.appendChild(submit);
    floatingWindow.appendChild(inputContainer);
    floatingWindow.appendChild(danmakuContent);
    document.body.appendChild(floatingWindow);

    // 处理视频链接输入
    async function handleVideoLink(url) {
        try {
            // 发送消息给background script获取弹幕数据
            chrome.runtime.sendMessage({ type: 'getDanmaku', url: url }, async (response) => {
                if (response.success) {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(response.data, 'text/xml');
                    const danmakuElements = xmlDoc.getElementsByTagName('d');
                    const danmakuList = Array.from(danmakuElements).map(element => {
                        const attributes = element.getAttribute('p').split(',');
                        return {
                            time: parseFloat(attributes[0]),
                            type: parseInt(attributes[1]),
                            size: parseInt(attributes[2]),
                            color: `#${parseInt(attributes[3]).toString(16)}`,
                            timestamp: new Date(parseInt(attributes[4]) * 1000),
                            content: element.textContent
                        };
                    }).sort((a, b) => a.time - b.time);
                    console.log('成功获取到弹幕数据，总数:', danmakuList.length);

                    // 获取视频播放器元素
                    const videoElement = document.querySelector('.bpx-player-video-wrap video') || document.querySelector('.html5-main-video');
                    if (!videoElement) {
                        throw new Error('无法找到视频播放器元素');
                    }

                    // 记录已显示的弹幕时间点
                    const shownDanmakuTimes = new Set();

                    // 监听视频时间更新事件
                    videoElement.addEventListener('timeupdate', () => {
                        // 兼容YouTube播放器时间更新事件
                        const currentTime = videoElement.currentTime;

                        // 查找当前时间点的弹幕
                        danmakuList.forEach(danmakuInfo => {
                            // 如果弹幕时间在当前播放时间的前后0.5秒内，且未显示过，则显示弹幕
                            if (Math.abs(danmakuInfo.time - currentTime) <= 0.5 && !shownDanmakuTimes.has(danmakuInfo.time)) {
                                // 创建弹幕元素
                                const danmakuElement = document.createElement('div');
                                danmakuElement.style.color = danmakuInfo.color;
                                danmakuElement.style.marginBottom = '5px';
                                danmakuElement.style.animation = 'fadeInOut 2s ease-in-out';
                                danmakuElement.textContent = `${danmakuInfo.content} (${danmakuInfo.timestamp.toLocaleTimeString()})`;

                                // 将弹幕添加到悬浮窗
                                floatingWindow.appendChild(danmakuElement);

                                // 记录已显示的弹幕时间点
                                shownDanmakuTimes.add(danmakuInfo.time);

                                // 限制显示的弹幕数量，保持最新的100条
                                if (floatingWindow.children.length > 100) {
                                    floatingWindow.removeChild(floatingWindow.firstChild);
                                }

                                // 3秒后移除弹幕元素
                                setTimeout(() => {
                                    if (danmakuElement.parentNode === floatingWindow) {
                                        floatingWindow.removeChild(danmakuElement);
                                    }
                                }, 3000);
                            }
                        });
                    });

                    // 监听视频跳转事件
                    videoElement.addEventListener('seeking', () => {
                        // 清空已显示的弹幕时间点记录
                        shownDanmakuTimes.clear();
                        // 清空悬浮窗中的所有弹幕
                        while (floatingWindow.firstChild) {
                            floatingWindow.removeChild(floatingWindow.firstChild);
                        }
                    });
                } else {
                    throw new Error(response.error);
                }
            });
        } catch (error) {
            console.error('处理视频链接失败:', error);
            alert(error.message);
        }
    }

    // 添加提交按钮点击事件
    submit.addEventListener('click', () => {
        const url = input.value.trim();
        if (url) {
            handleVideoLink(url);
        } else {
            alert('请输入B站视频链接');
        }
    });

    // 添加输入框回车事件
    input.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            const url = event.target.value.trim();
            if (url) {
                handleVideoLink(url);
            } else {
                alert('请输入B站视频链接');
            }
        }
    });
};

// 检查DOM是否已经可用
if (document.readyState === 'loading') {
    // DOM还在加载中，添加事件监听器
    document.addEventListener('DOMContentLoaded', initializePlugin);
} else {
    // DOM已经加载完成，直接初始化
    initializePlugin();
}

console.log('注入脚本已启动');