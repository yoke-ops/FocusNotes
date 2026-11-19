# FocusNotes

FocusNotes 是一款面向 Windows 和 Android 的任务管理与专注工具，帮助你把待办、日程、习惯和专注时间放在一个轻量的工作空间里。

## 功能

- **待办与清单**：按清单整理任务，用重要/紧急象限安排优先级，并为任务设置截止时间。
- **日历与提醒**：按日期查看待办；Android 版支持提前提醒和将任务添加到系统日历。
- **习惯追踪**：设置习惯频率、目标和提醒，记录打卡与连续天数；Android 主屏幕小组件可查看习惯进度。
- **专注计时**：番茄倒计时或正计时，关联任务并查看专注记录。
- **环境音**：播放可混合的程序合成环境音，调节音量，并设置睡眠定时。
- **桌面小组件**：Windows 桌面悬浮小组件及 Android 主屏幕小组件，支持深色外观。
- **本地数据与备份**：数据保存在本机；Android 版可导出、导入并合并 JSON 备份，也可通过云盘文件同步。
- **外观设置**：支持浅色、深色或跟随系统，以及字体大小和界面密度调整。

## 下载

从 [GitHub Releases](https://github.com/Jak1r0/FocusNotes/releases/latest) 下载：

- **Windows 10/11（x64）**：[FocusNotes-Setup-2.3.0.exe](https://github.com/Jak1r0/FocusNotes/releases/latest/download/FocusNotes-Setup-2.3.0.exe)
- **Android 7.0+**：[FocusNotes-Android-2.5.0.apk](https://github.com/Jak1r0/FocusNotes/releases/latest/download/FocusNotes-Android-2.5.0.apk)

Android 安装 APK 时，系统可能会要求允许从当前来源安装应用。通知提醒需要授予通知权限。

## 开发

本地调试、Android 测试包和 GitHub Actions 的用法见[开发与测试指南](docs/development.md)。团队和 CI 使用 Node.js 22。Android 构建还需要 JDK 17 和 Android SDK。

```powershell
npm ci
npm run typecheck
npm test
```

桌面开发与 Windows 安装包：

```powershell
npm run dev:desktop
npm run build -w @focusnotes/core
npm run dist -w @focusnotes/desktop
```

Android 发布包：

```powershell
cd apps/mobile/android
.\gradlew.bat assembleRelease
```

APK 输出在 `apps/mobile/android/app/build/outputs/apk/release/`。

## 数据与隐私

FocusNotes 默认将工作数据保存在设备本地。Android 云盘同步通过系统文件选择器读写你明确选择的 JSON 文件；应用不会将数据上传到 FocusNotes 自有服务器。请妥善保管备份文件。

## 版本

本次发布包含 Windows 版 **2.3.0** 和 Android 版 **2.5.0**。两个平台独立维护版本号。
