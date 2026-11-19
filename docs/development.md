# 开发与测试

在仓库根目录使用 Node.js 22 和 npm。Windows PowerShell 如果拦截 `npm.ps1`，把命令中的 `npm` 换成 `npm.cmd`。

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

`typecheck` 检查核心、桌面和移动端的 TypeScript。单元测试覆盖共享核心。最后一条命令构建 Windows 桌面端的前端资源。

## Windows 桌面调试

```powershell
npm run dev:desktop
```

- Vite 使用 `127.0.0.1:5173`。修改 React 组件会热更新。修改共享核心、Electron 主进程或 preload 后，重启开发命令。
- 在应用窗口按 **F12** 调试渲染进程。在 VS Code 打开仓库，选 **FocusNotes: Attach to Electron main** 调试主进程，监听地址为 `127.0.0.1:9229`。
- 开发版把工作数据写入 `apps/desktop/data-dev/`，并使用独立的 Electron 用户数据目录。可以同时打开已安装的正式版。
- 测试通知时，用开发版建一个几分钟后到期的待办，确认系统通知到达，再点击通知确认能回到应用。

## Android 真机或模拟器调试

安装 JDK 17，以及 Android SDK Platform 35、Build Tools 35.0.0、Platform-Tools 和 NDK 26.1.10909125。设好 `JAVA_HOME` 和 `ANDROID_HOME`，并将 SDK 的 `platform-tools` 加入 `PATH`。连接已授权 USB 调试的设备，或启动模拟器。以下命令假设只连接一台设备。

终端一启动 Metro。

```powershell
npm run dev:mobile
```

终端二安装 Debug 版并打开应用。

```powershell
adb devices -l
adb reverse tcp:8081 tcp:8081
Push-Location apps/mobile/android
.\gradlew.bat :app:installDebug
Pop-Location
adb shell am start -n com.focusnotes.debug/com.focusnotes.MainActivity
```

需要查看启动崩溃或 React Native 日志时，运行 `adb logcat "AndroidRuntime:E" "ReactNativeJS:V" "*:S"`。修改 Kotlin、Manifest 或 Gradle 后重新运行 `installDebug`。Linux/macOS 使用 `bash ./gradlew :app:installDebug`。

### 独立测试 APK

```powershell
npm run build:android:qa
adb install -r apps/mobile/android/app/build/outputs/apk/qa/app-qa.apk
adb shell am start -n com.focusnotes.qa/com.focusnotes.MainActivity
```

QA APK 内置 JS bundle，采用 Android 调试签名，包名为 `com.focusnotes.qa`。可以与正式版 `com.focusnotes` 和 Metro 调试版 `com.focusnotes.debug` 同时安装。GitHub Actions 和本机通常使用不同的调试签名。两者之间切换时，Android 会拒绝覆盖安装同包名、不同签名的 QA 版。如需更换，先备份 QA 数据，再通过系统设置卸载 QA 版。

真机回归时可创建几分钟后到期的待办，明确选择提前提醒时间，授予通知权限，退到后台观察通知。也可检查习惯打卡、应用重开后的数据保存、备份导入和桌面小组件。当前版本的习惯提醒时间仅保存。

## GitHub Actions

推送分支或提交 PR 时，会运行 Windows 类型检查、共享测试与桌面构建，以及 Android QA 打包。工作流成功后，可从 Android 作业所在运行页面的 **Artifacts** 下载 **FocusNotes-Android-QA**。新 fork 若停用了 Actions，在该仓库的 **Actions** 页面启用即可。
