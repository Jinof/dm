let baseUrl = 'https://dm-server-three.vercel.app';

// 从存储中加载 baseUrl
chrome.storage.sync.get({ baseUrl: 'https://dm-server-three.vercel.app' }, (items) => {
    baseUrl = items.baseUrl;
});

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.baseUrl) {
        baseUrl = changes.baseUrl.newValue;
    }
});

// 处理获取弹幕的请求
async function getDanmaku(cid) {
    try {
        const response = await fetch(baseUrl + '/api/x_v1_dm_list.so?cid='+cid, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Origin': 'https://www.bilibili.com',
                'Referer': 'https://www.bilibili.com/video/',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
            credentials: 'omit'
        });
        if (!response.ok || response.status === 0) {
            throw new Error(`请求失败，状态码: ${response.status}，请检查：\n1. 代理服务是否运行（端口 8080）\n2. 是否安装了CORS插件\n3. 网络连接是否正常`);
        }
        const text = await response.text();
        return text;
    } catch (error) {
        console.error('请求失败:', error);
        throw new Error(`网络请求异常: ${error.message}`);
    }
}

// 处理视频链接
async function handleVideoLink(url) {
    try {
        // 预处理URL
        let processedUrl = url.trim();
        if (!processedUrl.match(/^https?:\/\//i)) {
            processedUrl = 'https://' + processedUrl;
        }

        // 创建URL对象来解析链接
        let videoUrl;
        try {
            videoUrl = new URL(processedUrl);
        } catch (urlError) {
            throw new Error('无效的URL格式，请确保输入完整的B站视频链接');
        }

        // 检查是否是B站视频链接
        if (!videoUrl.hostname.includes('bilibili.com') || !videoUrl.pathname.includes('/video/')) {
            throw new Error('请输入有效的B站视频链接');
        }

        // 提取BV号
        const bvMatch = videoUrl.pathname.match(/\/video\/([A-Za-z0-9]+)/);
        if (!bvMatch) {
            throw new Error('无法从链接中提取BV号');
        }

        const bvid = bvMatch[1];
        console.log('提取到的BV号:', bvid);

        // 请求视频信息API
        const response = await fetch(baseUrl + '/api/x_player_pagelist?bvid='+bvid, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Origin': 'https://www.bilibili.com',
                'Referer': `https://www.bilibili.com/video/${bvid}`,
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
            credentials: 'omit'
        });

        if (!response.ok || response.status === 0) {
            throw new Error(`请求失败，状态码: ${response.status}，请检查：\n1. 代理服务是否运行（端口 8080）\n2. 是否安装了CORS插件\n3. 网络连接是否正常`);
        }

        const text = await response.text();
        console.log('API响应文本:', text);
        let data = null;
        try {
            data = JSON.parse(text);
            console.log('API响应数据:', data);
        } catch (error) {
            console.error('JSON解析失败:', error);
            throw new Error('API返回数据格式异常，无法解析');
        }

        if (!data || data.code !== 0) {
            throw new Error(`API返回错误: ${data?.message || '未知错误'}`);
        }

        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
            throw new Error('API返回数据格式异常：data数组为空');
        }

        const cid = data.data[0].cid;
        if (!cid) {
            throw new Error('API返回数据中没有cid字段');
        }

        console.log('获取到视频cid:', cid);
        const danmakuList = await getDanmaku(cid);
        return danmakuList;
    } catch (error) {
        console.error('处理视频链接失败:', error);
        throw error;
    }
}

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'getDanmaku') {
        handleVideoLink(request.url)
            .then(danmakuList => {
                sendResponse({ success: true, data: danmakuList });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true; // 表示会异步发送响应
    }
});
