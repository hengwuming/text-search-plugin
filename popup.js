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

      // 创建删除按钮，但当只有一个搜索引擎时隐藏
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '删除';
      deleteBtn.addEventListener('click', () => deleteEngine(index));
      
      // 当只有一个搜索引擎时隐藏删除按钮
      if (engines.length <= 1) {
        deleteBtn.style.display = 'none';
      }

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
  try {
    const result = await chrome.storage.sync.get('searchEngines');
    const engines = result.searchEngines || [];

    // 如果只剩一个搜索引擎，则不允许删除
    if (engines.length <= 1) {
      alert('最少需要保留一个搜索引擎，不能全部删除');
      return;
    }

    if (confirm('确定要删除这个搜索引擎吗？')) {
      if (index >= 0 && index < engines.length) {
        engines.splice(index, 1);
        await chrome.storage.sync.set({ searchEngines: engines });
        loadAndDisplayEngines();

        // 通知后台更新菜单
        chrome.runtime.sendMessage({ action: 'refreshContextMenus' });
      }
    }
  } catch (error) {
    console.error('删除搜索引擎失败:', error);
    alert('删除失败，请重试');
  }
};



// 添加事件监听器
document.addEventListener('DOMContentLoaded', () => {
  // 加载并显示搜索引擎列表
  loadAndDisplayEngines();

  // 添加按钮点击事件
  document.getElementById('addEngineBtn').addEventListener('click', addEngine);

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