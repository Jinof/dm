// 保存配置
function saveOptions() {
    const baseUrl = document.getElementById('baseUrl').value.trim();
    
    // 验证输入
    if (!baseUrl) {
        showStatus('请输入代理服务器地址', false);
        return;
    }

    try {
        new URL(baseUrl);
    } catch (e) {
        showStatus('请输入有效的URL地址', false);
        return;
    }

    // 保存到 Chrome 存储
    chrome.storage.sync.set({
        baseUrl: baseUrl
    }, () => {
        if (chrome.runtime.lastError) {
            showStatus('保存失败：' + chrome.runtime.lastError.message, false);
        } else {
            showStatus('配置已保存', true);
        }
    });
}

// 加载配置
function loadOptions() {
    chrome.storage.sync.get({
        baseUrl: 'http://127.0.0.1:8080' // 默认值
    }, (items) => {
        document.getElementById('baseUrl').value = items.baseUrl;
    });
}

// 显示状态信息
function showStatus(message, success) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.style.display = 'block';
    status.className = 'status ' + (success ? 'success' : 'error');

    // 3秒后隐藏状态信息
    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
}

// 初始化
document.addEventListener('DOMContentLoaded', loadOptions);
document.getElementById('save').addEventListener('click', saveOptions);