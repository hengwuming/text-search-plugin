#!/usr/bin/env node
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义扩展的根目录、私钥路径和输出目录
const extensionRoot = __dirname;
const outputPath = path.join(__dirname, 'dist');
const keyPath = path.join(__dirname, 'key.pem');
const outputZipPath = path.join(outputPath, 'text-search-plugin.zip');
const packageJsonPath = path.join(__dirname, 'package.json');
const manifestJsonPath = path.join(__dirname, 'manifest.json');

// 解析版本号
function parseVersion(version) {
  const parts = version.split('.').map(part => parseInt(part, 10));
  return {
    major: parts[0] || 0,
    minor: parts[1] || 0,
    patch: parts[2] || 0
  };
}

// 格式化版本号
function formatVersion(versionObj) {
  let versionStr = `${versionObj.major}.${versionObj.minor}`;
  if (versionObj.patch > 0) {
    versionStr += `.${versionObj.patch}`;
  }
  return versionStr;
}

// 增加大版本号 (major + 1, minor 和 patch 重置为 0)
function incrementMajorVersion(currentVersion) {
  const versionObj = parseVersion(currentVersion);
  versionObj.major += 1;
  versionObj.minor = 0;
  versionObj.patch = 0;
  return formatVersion(versionObj);
}

// 增加小版本号 (minor + 0.1, 实际是 minor + 1)
function incrementMinorVersion(currentVersion) {
  const versionObj = parseVersion(currentVersion);
  versionObj.minor += 1;
  versionObj.patch = 0;
  return formatVersion(versionObj);
}

// 更新 package.json 中的版本号
async function updatePackageJsonVersion(newVersion) {
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    packageJson.version = newVersion;
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
    console.log(`已更新 package.json 版本号为: ${newVersion}`);
  } catch (error) {
    console.error(`更新 package.json 版本号时出错: ${error.message}`);
    throw error;
  }
}

// 更新 manifest.json 中的版本号
async function updateManifestJsonVersion(newVersion) {
  try {
    const manifestJson = JSON.parse(await fs.readFile(manifestJsonPath, 'utf8'));
    // manifest.json 的版本号格式可能不包含 patch 部分
    const versionObj = parseVersion(newVersion);
    let manifestVersion = `${versionObj.major}.${versionObj.minor}`;
    if (versionObj.patch > 0) {
      manifestVersion += `.${versionObj.patch}`;
    }
    manifestJson.version = manifestVersion;
    await fs.writeFile(manifestJsonPath, JSON.stringify(manifestJson, null, 2), 'utf8');
    console.log(`已更新 manifest.json 版本号为: ${manifestVersion}`);
  } catch (error) {
    console.error(`更新 manifest.json 版本号时出错: ${error.message}`);
    throw error;
  }
}

// 处理版本控制
async function handleVersionControl() {
  try {
    // 获取当前版本号
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;
    
    console.log(`当前版本号: ${currentVersion}`);
    
    // 询问用户版本更新方式
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'versionType',
        message: '请选择版本更新方式:',
        choices: [
          { name: `增加大版本号 (${incrementMajorVersion(currentVersion)})`, value: 'major' },
          { name: `增加小版本号 (${incrementMinorVersion(currentVersion)})`, value: 'minor' },
          { name: '自定义版本号', value: 'custom' }
        ]
      },
      {
        type: 'input',
        name: 'customVersion',
        message: '请输入自定义版本号:',
        when: (answers) => answers.versionType === 'custom',
        validate: (input) => {
          // 简单验证版本号格式
          const versionRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)(\.(0|[1-9]\d*))?$/;
          if (!versionRegex.test(input)) {
            return '请输入有效的版本号，格式如: 1.0 或 1.1.0';
          }
          return true;
        }
      }
    ]);
    
    // 确定新版本号
    let newVersion;
    switch (answers.versionType) {
      case 'major':
        newVersion = incrementMajorVersion(currentVersion);
        break;
      case 'minor':
        newVersion = incrementMinorVersion(currentVersion);
        break;
      case 'custom':
        newVersion = answers.customVersion;
        break;
      default:
        throw new Error('未知的版本更新方式');
    }
    
    // 确认版本更新
    const confirm = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmUpdate',
        message: `确定要将版本号从 ${currentVersion} 更新为 ${newVersion} 吗？`,
        default: true
      }
    ]);
    
    if (!confirm.confirmUpdate) {
      console.log('已取消版本更新');
      return false;
    }
    
    // 更新版本号
    await updatePackageJsonVersion(newVersion);
    await updateManifestJsonVersion(newVersion);
    
    console.log(`版本号已成功更新为: ${newVersion}`);
    return true;
  } catch (error) {
    console.error(`处理版本控制时出错: ${error.message}`);
    throw error;
  }
}

// 创建输出目录的函数
async function createOutputDirectory() {
  try {
    await fs.mkdir(outputPath, { recursive: true });
    console.log(`输出目录已创建: ${outputPath}`);
  } catch (error) {
    console.error(`创建输出目录时出错: ${error.message}`);
  }
}

// 检查是否安装了必要工具
function checkRequiredTools() {
  try {
    // 检查openssl是否可用
    execSync('openssl version', { stdio: 'ignore' });
    console.log('已检测到 openssl 工具');
    
    // 检查zip是否可用
    execSync('zip --version', { stdio: 'ignore' });
    console.log('已检测到 zip 工具');
    return true;
  } catch (error) {
    console.error('错误：缺少必要的工具。请确保已安装 openssl 和 zip。');
    console.error('在Ubuntu/Debian上，您可以运行：sudo apt-get install openssl zip');
    console.error('在CentOS/RHEL上，您可以运行：sudo yum install openssl zip');
    console.error('在macOS上，您可以运行：brew install openssl zip');
    return false;
  }
}

// 生成私钥文件
async function generatePrivateKey() {
  try {
    // 检查私钥是否已存在
    await fs.access(keyPath);
    console.log(`使用已存在的私钥: ${keyPath}`);
  } catch (error) {
    // 如果私钥不存在，生成新的私钥
    console.log('生成新的私钥...');
    execSync(`openssl genpkey -algorithm RSA -out ${keyPath} -pkeyopt rsa_keygen_bits:2048`, {
      stdio: 'inherit'
    });
    console.log(`私钥已生成并保存至: ${keyPath}`);
    console.log('请妥善保管此私钥，用于将来更新扩展！');
  }
}

// 创建ZIP文件
function createZipFile() {
  try {
    console.log('创建扩展的ZIP文件...');
    
    // 首先删除旧的ZIP文件（如果存在）
    try {
      fsSync.unlinkSync(outputZipPath);
      console.log('已删除旧的ZIP文件');
    } catch (err) {
      // 忽略文件不存在的错误
    }
    
    // 明确指定需要包含的文件和目录
    const includeFiles = [
      'manifest.json',
      'background.js',
      'popup.html',
      'popup.js',
      'README.md',
      'icons/',
      'package.json'
    ];
    
    // 将所有文件路径连接成一个字符串
    const filesToZip = includeFiles.join(' ');
    
    // 直接创建ZIP文件，只包含指定的文件
    execSync(`cd ${extensionRoot} && zip -r ${outputZipPath} ${filesToZip}`, {
      stdio: 'inherit'
    });
    
    console.log(`ZIP文件已生成: ${outputZipPath}`);
  } catch (error) {
    console.error(`创建ZIP文件时出错: ${error.message}`);
    throw error;
  }
}

// 复制重要文件到输出目录
async function copyImportantFiles() {
  const filesToCopy = [
    'README.md',
    'TESTING_GUIDE.md', 
    'PACKAGING_GUIDE.md'
  ];
  
  for (const file of filesToCopy) {
    try {
      const sourcePath = path.join(__dirname, file);
      const destPath = path.join(outputPath, file);
      await fs.copyFile(sourcePath, destPath);
      console.log(`已复制 ${file} 到输出目录`);
    } catch (error) {
      console.warn(`复制 ${file} 时出错: ${error.message}`);
    }
  }
}

// 提供安装说明
function provideInstallationGuide() {
  console.log('\n================= 打包完成！=================');
  console.log('您现在有以下文件可以使用：');
  console.log(`1. 扩展ZIP文件: ${outputZipPath}`);
  console.log(`2. 私钥文件: ${keyPath} (请妥善保管)`);
  console.log('\n使用方法：');
  console.log('方法一：使用Chrome开发者工具打包成CRX');
  console.log('1. 在Chrome浏览器中打开 chrome://extensions/');
  console.log('2. 开启「开发者模式」');
  console.log('3. 点击「打包扩展程序」按钮');
  console.log('4. 扩展根目录: 选择当前项目目录');
  console.log('5. 私有密钥文件: 选择生成的key.pem文件');
  console.log('6. 点击「打包扩展程序」按钮，Chrome会生成CRX文件');
  console.log('\n方法二：直接使用ZIP文件安装（临时使用）');
  console.log('1. 在Chrome浏览器中打开 chrome://extensions/');
  console.log('2. 开启「开发者模式」');
  console.log('3. 将生成的ZIP文件拖放到扩展页面中');
  console.log('4. 点击「添加扩展程序」按钮完成安装');
  console.log('\n重要提示：');
  console.log('- 请妥善保管key.pem私钥文件，未来更新扩展时需要使用相同的密钥');
  console.log('- 更多详细信息请参考 PACKAGING_GUIDE.md 文件');
  console.log('==========================================');
}

// 主函数
async function main() {
  try {
    // 检查是否需要进行版本控制
    const shouldHandleVersion = process.argv.includes('--version');
    
    if (shouldHandleVersion) {
      const versionUpdated = await handleVersionControl();
      // 如果用户取消了版本更新，就不继续打包
      if (!versionUpdated) {
        return;
      }
    }
    
    // 检查必要工具
    if (!checkRequiredTools()) {
      return;
    }
    
    // 创建输出目录
    await createOutputDirectory();
    
    // 生成私钥
    await generatePrivateKey();
    
    // 创建ZIP文件
    createZipFile();
    
    // 复制重要文件
    await copyImportantFiles();
    
    // 提供安装说明
    provideInstallationGuide();
  } catch (error) {
    console.error('打包过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行主函数
main();