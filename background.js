// 定义默认搜索引擎
const DEFAULT_SEARCH_ENGINES = [
  { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=%s' },
  { id: 'google', name: '谷歌', url: 'https://www.google.com/search?q=%s' },
  { id: 'bing', name: '必应', url: 'https://www.bing.com/search?q=%s' }
];

// 保存搜索引擎列表到本地存储
const saveSearchEngines = async (engines) => {
  try {
    await chrome.storage.sync.set({ searchEngines: engines });
  } catch (error) {
    console.error('保存搜索引擎失败:', error);
  }
};

// 从本地存储加载搜索引擎列表
const loadSearchEngines = async () => {
  try {
    const result = await chrome.storage.sync.get('searchEngines');
    // 如果没有保存的搜索引擎，则使用默认的
    if (!result.searchEngines || result.searchEngines.length === 0) {
      await saveSearchEngines(DEFAULT_SEARCH_ENGINES);
      return DEFAULT_SEARCH_ENGINES;
    }
    return result.searchEngines;
  } catch (error) {
    console.error('加载搜索引擎失败:', error);
    return DEFAULT_SEARCH_ENGINES;
  }
};

// 创建右键菜单
const createContextMenus = async () => {
  // 先清除所有已有的菜单项，并等待操作完成
  await new Promise(resolve => {
    chrome.contextMenus.removeAll(() => {
      resolve();
    });
  });

  try {
    // 获取搜索引擎列表并创建菜单项
    const engines = await loadSearchEngines();
    
    // 根据搜索引擎数量决定显示方式
    if (engines.length > 0) {
      // 所有搜索引擎都作为一级菜单直接显示
      engines.forEach(engine => {
        // 检查engine.id是否存在
        if (engine.id) {
          chrome.contextMenus.create({
            id: engine.id,
            title: `${engine.name}搜索`,
            contexts: ['selection'],
            parentId: null // 明确设置为null，确保是顶级菜单项
          }, () => {
            // 捕获可能的错误，但不中断流程
            if (chrome.runtime.lastError) {
              console.warn('创建菜单项失败:', engine.id, chrome.runtime.lastError.message);
            }
          });
        } else {
          console.warn('跳过无效的搜索引擎项（缺少ID）:', engine);
        }
      });
    }
  } catch (error) {
    console.error('创建菜单失败:', error);
  }
};

// 处理菜单点击事件
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'searchWith') return; // 如果点击的是主菜单，不执行操作

  const engines = await loadSearchEngines();
  const selectedEngine = engines.find(engine => engine.id === info.menuItemId);

  if (selectedEngine && info.selectionText) {
    const encodedText = encodeURIComponent(info.selectionText);
    const searchUrl = selectedEngine.url.replace('%s', encodedText);

    // 在新标签页中打开搜索结果
    chrome.tabs.create({
      url: searchUrl,
      index: tab.index + 1
    });
  }
});

// 监听存储变化，更新菜单
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.searchEngines) {
    createContextMenus();
  }
});

// 加载并应用保存的自定义图标
const loadAndApplyCustomIcon = async () => {
  try {
    const result = await chrome.storage.sync.get('customIcon');
    if (result.customIcon) {
      // 创建一个离屏canvas用于处理图片
      const canvas = new OffscreenCanvas(128, 128);
      const ctx = canvas.getContext('2d');

      // 加载图片
      const img = new Image();
      img.onload = async () => {
        // 绘制图片到canvas
        ctx.drawImage(img, 0, 0, 128, 128);
        // 获取ImageData并设置为扩展图标
        const imageData = ctx.getImageData(0, 0, 128, 128);
        await chrome.action.setIcon({ imageData: imageData });
      };
      img.src = result.customIcon;
    }
  } catch (error) {
    console.error('加载自定义图标失败:', error);
  }
};

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'refreshContextMenus') {
    createContextMenus();
    sendResponse({ success: true });
  } else if (message.action === 'updateExtensionIcon') {
    // 创建一个离屏canvas用于处理图片
    const canvas = new OffscreenCanvas(128, 128);
    const ctx = canvas.getContext('2d');

    // 加载图片
    const img = new Image();
    img.onload = () => {
      // 绘制图片到canvas
      ctx.drawImage(img, 0, 0, 128, 128);
      // 获取ImageData并设置为扩展图标
      const imageData = ctx.getImageData(0, 0, 128, 128);
      chrome.action.setIcon({ imageData: imageData }, () => {
        sendResponse({ success: true });
      });
    };
    img.src = message.iconDataUrl;
  } else if (message.action === 'resetExtensionIcon') {
    // 恢复默认图标
    chrome.action.setIcon({
      path: {
        '16': 'icons/icon16.svg',
        '48': 'icons/icon48.svg',
        '128': 'icons/icon128.svg'
      }
    }, () => {
      sendResponse({ success: true });
    });
  }
  return true; // 表示会异步发送响应
});

// 当扩展安装或更新时创建菜单
chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
  // 加载并应用保存的自定义图标
  loadAndApplyCustomIcon();
});

// 当浏览器启动时创建菜单
chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
  // 加载并应用保存的自定义图标
  loadAndApplyCustomIcon();
});