# Chrome扩展自动化构建工作流

## 工作流概述

此GitHub Actions工作流用于自动化构建Chrome浏览器文本搜索插件。它会在代码推送到main分支、创建PR到main分支或手动触发时运行构建流程。

## 触发条件

工作流会在以下情况下触发：
- 代码推送到`main`分支
- 创建或更新针对`main`分支的Pull Request
- 通过GitHub界面手动触发（`workflow_dispatch`）

## 构建环境要求

- 运行在`ubuntu-latest`环境
- 使用Node.js 18.x版本

## 工作流步骤

1. **检出代码** - 获取最新的代码仓库内容
2. **设置Node.js环境** - 配置Node.js 18.x运行环境
3. **安装依赖** - 执行`npm install`安装项目依赖
4. **处理私钥** - 
   - 如果GitHub Secrets中提供了`EXTENSION_PRIVATE_KEY`，则使用该私钥
   - 如果没有提供私钥，则为本次构建生成一个临时私钥
5. **构建扩展** - 执行`npm run build`命令运行构建脚本
6. **上传构建产物** - 将构建好的扩展文件上传为GitHub Actions的构建产物

## 私钥设置指南

为了确保扩展的一致性更新（特别是发布到Chrome Web Store时），建议设置一个持久的私钥：

1. 生成私钥（如果还没有）：
   ```bash
   openssl genpkey -algorithm RSA -out key.pem -pkeyopt rsa_keygen_bits:2048
   ```

2. 登录GitHub，进入仓库页面
3. 点击`Settings` > `Secrets and variables` > `Actions`
4. 点击`New repository secret`
5. 名称输入`EXTENSION_PRIVATE_KEY`
6. 值输入私钥文件（key.pem）的完整内容
7. 点击`Add secret`保存

> **注意**：请妥善保管私钥文件，丢失后将无法使用相同的密钥更新已发布的扩展。

## 获取构建产物

工作流运行完成后，可以通过以下步骤获取构建产物：

1. 进入仓库的`Actions`标签页
2. 选择对应运行的工作流
3. 在工作流详情页的底部找到`Artifacts`部分
4. 点击`text-search-plugin`下载构建好的扩展文件

构建产物包含：
- 扩展的ZIP文件（可用于临时安装）
- 其他重要文档（如README.md等）

## 手动运行工作流

如果需要手动触发构建，可以：
1. 进入仓库的`Actions`标签页
2. 选择`Build Chrome Extension`工作流
3. 点击`Run workflow`按钮
4. 选择分支并点击`Run workflow`确认