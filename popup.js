// 创建提示工具
const createTooltip = () => {
  let tooltip = document.getElementById('urlTooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'urlTooltip';
    tooltip.className = 'tooltip';
    document.body.appendChild(tooltip);
  }
  return tooltip;
};

// 加载搜索引擎列表并显示
const loadAndDisplayEngines = async () => {
  const engineListElement = document.getElementById('engineList');
  engineListElement.innerHTML = '';

  try {
    const result = await chrome.storage.sync.get('searchEngines');
    const engines = result.searchEngines || [];

    if (engines.length === 0) {
      engineListElement.innerHTML = '<p style="color: #999;">暂无搜索引擎，请添加</p>';
      return;
    }

    // 创建提示工具
    const tooltip = createTooltip();

    engines.forEach((engine, index) => {
      const engineItem = document.createElement('div');
      engineItem.className = 'engine-item';
      engineItem.setAttribute('draggable', 'true');
      engineItem.setAttribute('data-index', index);

      // 添加拖拽手柄
      const dragHandle = document.createElement('span');
      dragHandle.className = 'drag-handle';
      dragHandle.textContent = '⋮⋮';

      const engineInfo = document.createElement('div');
      engineInfo.className = 'engine-info';

      const engineName = document.createElement('div');
      engineName.className = 'engine-name';
      engineName.textContent = engine.name;

      const engineUrl = document.createElement('div');
      engineUrl.className = 'engine-url';
      engineUrl.textContent = engine.url;
      engineUrl.setAttribute('title', engine.url);

      // 添加URL悬停显示功能
      engineUrl.addEventListener('mouseenter', (e) => {
        tooltip.textContent = engine.url;
        tooltip.style.display = 'block';
        tooltip.style.left = (e.pageX + 10) + 'px';
        tooltip.style.top = (e.pageY - 10) + 'px';
      });

      engineUrl.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });

      engineUrl.addEventListener('mousemove', (e) => {
        tooltip.style.left = (e.pageX + 10) + 'px';
        tooltip.style.top = (e.pageY - 10) + 'px';
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '删除';
      deleteBtn.addEventListener('click', () => deleteEngine(index));

      engineInfo.appendChild(engineName);
      engineInfo.appendChild(engineUrl);
      engineItem.appendChild(dragHandle);
      engineItem.appendChild(engineInfo);
      engineItem.appendChild(deleteBtn);

      // 添加拖拽事件
      engineItem.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', index);
        engineItem.classList.add('dragging');
      });

      engineItem.addEventListener('dragend', () => {
        engineItem.classList.remove('dragging');
        // 清除所有放置指示器
        document.querySelectorAll('.engine-item').forEach(item => {
          item.style.borderTop = '';
        });
      });

      engineItem.addEventListener('dragover', (e) => {
        e.preventDefault();

        // 清除所有放置指示器
        document.querySelectorAll('.engine-item').forEach(item => {
          item.style.borderTop = '';
        });

        // 设置当前项的放置指示器
        const rect = engineItem.getBoundingClientRect();
        const y = e.clientY - rect.top;

        if (y < rect.height / 2) {
          engineItem.style.borderTop = '2px solid #4CAF50';
        } else {
          engineItem.style.borderBottom = '2px solid #4CAF50';
        }
      });

      engineItem.addEventListener('dragleave', () => {
        engineItem.style.borderTop = '';
        engineItem.style.borderBottom = '';
      });

      engineItem.addEventListener('drop', async (e) => {
        e.preventDefault();

        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toIndex = parseInt(engineItem.getAttribute('data-index'));

        // 如果拖放到同一位置，则不执行操作
        if (fromIndex === toIndex) {
          return;
        }

        // 重新排序引擎列表
        const updatedEngines = [...engines];
        const [movedEngine] = updatedEngines.splice(fromIndex, 1);

        // 确定插入位置
        let insertIndex = toIndex;
        if (fromIndex < toIndex) {
          insertIndex = toIndex;
        } else {
          insertIndex = toIndex;
        }

        updatedEngines.splice(insertIndex, 0, movedEngine);

        // 保存更新后的引擎列表
        try {
          await chrome.storage.sync.set({ searchEngines: updatedEngines });

          // 重新加载并显示列表
          loadAndDisplayEngines();

          // 通知后台更新菜单
          chrome.runtime.sendMessage({ action: 'refreshContextMenus' });
        } catch (error) {
          console.error('保存排序失败:', error);
          alert('排序保存失败，请重试');
        }

        // 清除放置指示器
        engineItem.style.borderTop = '';
        engineItem.style.borderBottom = '';
      });

      engineListElement.appendChild(engineItem);
    });
  } catch (error) {
    console.error('加载搜索引擎失败:', error);
    engineListElement.innerHTML = '<p style="color: #ff4444;">加载失败，请重试</p>';
  }
};

// 添加新搜索引擎
const addEngine = async () => {
  const engineName = document.getElementById('engineName').value.trim();
  const engineUrl = document.getElementById('engineUrl').value.trim();

  if (!engineName) {
    alert('请输入搜索引擎名称');
    return;
  }

  if (!engineUrl) {
    alert('请输入搜索URL');
    return;
  }

  if (!engineUrl.includes('%s')) {
    alert('搜索URL必须包含%s作为关键词占位符');
    return;
  }

  try {
    const result = await chrome.storage.sync.get('searchEngines');
    const engines = result.searchEngines || [];

    // 生成唯一ID
    const newId = 'engine_' + Date.now();

    engines.push({
      id: newId,
      name: engineName,
      url: engineUrl
    });

    await chrome.storage.sync.set({ searchEngines: engines });

    // 清空输入框
    document.getElementById('engineName').value = '';
    document.getElementById('engineUrl').value = '';

    // 重新加载并显示列表
    loadAndDisplayEngines();

    // 通知后台更新菜单
    chrome.runtime.sendMessage({ action: 'refreshContextMenus' });
  } catch (error) {
    console.error('添加搜索引擎失败:', error);
    alert('添加失败，请重试');
  }
};

// 删除搜索引擎
const deleteEngine = async (index) => {
  if (confirm('确定要删除这个搜索引擎吗？')) {
    try {
      const result = await chrome.storage.sync.get('searchEngines');
      const engines = result.searchEngines || [];

      if (index >= 0 && index < engines.length) {
        engines.splice(index, 1);
        await chrome.storage.sync.set({ searchEngines: engines });
        loadAndDisplayEngines();

        // 通知后台更新菜单
        chrome.runtime.sendMessage({ action: 'refreshContextMenus' });
      }
    } catch (error) {
      console.error('删除搜索引擎失败:', error);
      alert('删除失败，请重试');
    }
  }
};

// 加载当前图标
const loadCurrentIcon = async () => {
  try {
    const result = await chrome.storage.sync.get('customIcon');
    const currentIconElement = document.getElementById('currentIcon');

    if (result.customIcon) {
      currentIconElement.src = result.customIcon;
    } else {
      currentIconElement.src = 'icons/icon128.svg';
    }
  } catch (error) {
    console.error('加载图标失败:', error);
  }
};

// 处理图标上传
const handleIconUpload = async (file) => {
  if (!file) return;

  // 检查文件类型是否为图片
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件');
    return;
  }

  // 读取文件并转换为Data URL
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const iconDataUrl = event.target.result;
      await chrome.storage.sync.set({ customIcon: iconDataUrl });

      // 更新预览
      document.getElementById('currentIcon').src = iconDataUrl;

      // 通知后台更新图标
      chrome.runtime.sendMessage({
        action: 'updateExtensionIcon',
        iconDataUrl: iconDataUrl
      });

      alert('图标已更新');
    } catch (error) {
      console.error('保存图标失败:', error);
      alert('图标更新失败，请重试');
    }
  };
  reader.readAsDataURL(file);
};

// 恢复默认图标
const resetToDefaultIcon = async () => {
  if (confirm('确定要恢复默认图标吗？')) {
    try {
      // 从存储中删除自定义图标
      await chrome.storage.sync.remove('customIcon');

      // 更新预览
      document.getElementById('currentIcon').src = 'icons/icon128.svg';

      // 通知后台更新图标
      chrome.runtime.sendMessage({ action: 'resetExtensionIcon' });

      alert('已恢复默认图标');
    } catch (error) {
      console.error('恢复默认图标失败:', error);
      alert('恢复失败，请重试');
    }
  }
};

// 添加事件监听器
document.addEventListener('DOMContentLoaded', () => {
  // 加载并显示搜索引擎列表
  loadAndDisplayEngines();

  // 加载当前图标
  loadCurrentIcon();

  // 添加按钮点击事件
  document.getElementById('addEngineBtn').addEventListener('click', addEngine);

  // 图标上传事件
  document.getElementById('iconInput').addEventListener('change', (e) => {
    handleIconUpload(e.target.files[0]);
  });

  // 恢复默认图标事件
  document.getElementById('resetIconBtn').addEventListener('click', resetToDefaultIcon);

  // 监听键盘事件（回车添加）
  document.getElementById('engineName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('engineUrl').focus();
    }
  });

  document.getElementById('engineUrl').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addEngine();
    }
  });
});

// 监听后台消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'refreshPopup') {
    loadAndDisplayEngines();
  }
});