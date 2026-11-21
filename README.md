# FocusNotes

FocusNotes 是一款面向 Windows 和 Android 的任务管理与专注工具，帮助你把待办、日程、习惯、备忘录和专注时间放在一个轻量的工作空间里。

## 功能

- **待办与清单**：按清单整理任务，用重要/紧急象限安排优先级，并为任务设置截止时间。
- **日历与提醒**：按日期查看待办；两端均支持任务到期提醒。Android 版可为单个任务设置提前时间并添加到系统日历；桌面版支持按 `HH:MM` 的习惯每日提醒。
- **习惯追踪**：按每天/工作日/周末安排习惯，记录打卡与连续天数，可设置目标次数与提醒时间。Android 版习惯提醒时间当前仅保存，不参与计数与通知；桌面版会在设定时间发送通知。Android 主屏幕小组件可查看今日打卡状态与连续天数。
- **备忘录**：独立于待办的长文本记录，支持置顶、搜索与最多 500 条、单条 5 万字符；桌面和 Android 均已提供。
- **专注计时**：番茄倒计时或正计时，关联任务并查看专注记录；桌面版在专注页与小组件中展示「今日完成」。
- **环境音**：播放程序合成的环境音并调节音量。桌面版提供雨声、海浪、森林、咖啡馆、粉红噪音、雷声、篝火、瀑布、鸟鸣、棕噪音、风声、夏夜共 12 种场景，支持最多 4 种同时混音与 15/30/45/60/90 分钟睡眠定时；Android 版支持最多 4 种音效混合与睡眠定时。
- **Gitee 云同步**：把待办、清单、习惯打卡、专注记录与备忘录同步到你自己的 Gitee 仓库 JSON 文件；桌面版令牌经系统安全存储加密，移动端保存在应用私有存储。
- **小组件**：Windows 桌面悬浮小组件及 Android 主屏幕小组件；Android 提供 1x1、1x2、2x2、2x4 四种尺寸。
- **本地数据与备份**：数据保存在本机；两端均可导入、导出并合并 JSON 数据（桌面版另支持 CSV）；Android 版可通过系统文件选择器读写云盘中的 JSON 文件进行同步。
- **外观设置**：支持浅色、深色或跟随系统。Android 版可用滑块调整字体大小（80%–140%）与页面留白密度（80%–130%）；桌面版可调字体族、小组件字号与窗口透明度等。
- **分页导航**：Android 版可在待办、日历、习惯、专注、备忘录页之间左右滑动切换。

## 系统要求

| 平台 | 要求 |
| --- | --- |
| Windows | Windows 10/11（x64） |
| Android | Android 7.0（API 24）及以上 |
| 开发环境 | Node.js 18+、npm 9+ |
| Android 构建 | Android SDK 35、JDK 17、Gradle 8.8（wrapper 自动下载） |

## 安装

### Windows

1. 从 [GitHub Releases](https://github.com/Jak1r0/FocusNotes/releases/latest) 下载 `FocusNotes-Setup-0.1.1.exe`。
2. 运行安装包并按提示完成安装；首次启动时允许通知，以便接收待办与习惯提醒。
3. 覆盖安装会保留本地数据。

### Android

1. 下载 `FocusNotes-0.1.1.apk`。
2. 按系统提示允许从当前来源安装应用。
3. 首次启动时授予通知权限；需要提醒和主屏幕小组件时，同时允许自启动与后台运行。

升级时请使用与已安装版本相同的签名。若更换签名，Android 会拒绝覆盖安装，请先导出备份再卸载重装。

发布 APK 内嵌 APK Signature Scheme v1 / v2 / v3 签名，单文件即可完成签名校验与覆盖安装；本版本不再附带 `.idsig`。签名证书与 0.1.0 相同（SHA-256 `7a85…`），`versionCode` 4 可直接覆盖 0.1.0。APK SHA-256 为 `4da05deb…`。Release 同时提供公钥证书 `FocusNotes-0.1.1-cert.pem` 与校验文件 `FocusNotes-0.1.1.apk.sha256`；私钥 keystore 不公开、不上传。

> 注意：0.1.1 的 `versionCode` 为 4，可从 0.1.0 直接覆盖安装。若仍在使用 2.x 版本，请先导出 JSON 备份、卸载旧版后再安装。

## 配置

- **外观**：设置页可切换浅色、深色或跟随系统。Android 还可拖动滑块调整字体大小与界面高度；桌面可调整字体族、小组件字号与窗口透明度。
- **提醒**：Android 可为单个待办设置 0–240 分钟滑块提醒，或在自定义输入框填写 0–10080 分钟；桌面端在任务到期前按全局提前分钟数提醒。桌面习惯提醒使用习惯自身保存的时间，每个习惯每天提醒一次。
- **环境音**：在专注页点击场景即可开启，再次点击关闭；最多同时混合 4 种，超出时自动移除最早选择的场景。桌面睡眠定时会在最后 15 秒渐弱后停止；重新播放会沿用上次选择的时长。
- **Gitee 同步**：在设置中填写 Gitee 用户名、仓库名、分支、文件路径（默认 `focusnotes/data.json`）与私人令牌。应用启动时拉取并合并远端数据，本地修改后约 3 秒自动提交一次。
- **数据与备份**：设置页可导出完整 JSON 备份、导入并合并，Android 还可通过系统文件选择器选择云盘中的同一 JSON 文件进行双向同步。
- **隐私**：应用不会把工作数据上传到 FocusNotes 自有服务器；仅在启用 Gitee 同步时写入你指定的仓库，详见下文「数据与隐私」。

## 使用示例

### 新建一条带提醒的待办

1. 打开「待办」页，点击右下角加号。
2. 输入标题，选择清单与截止时间。
3. 拖动「提前提醒」滑块，或输入自定义分钟数。
4. 保存后，到达提醒时间会收到系统通知。

### 番茄专注 + 环境音

1. 打开「专注」页，选择关联任务与番茄时长。
2. 在环境音区域选择 1–4 个场景混音，并调节音量。
3. 需要睡前停止时，选择 30 分钟睡眠定时，音效会在最后 15 秒渐弱。
4. 专注结束后，在「今日完成」卡中查看待办、习惯与番茄的合计。

### 习惯打卡与提醒

1. 打开「习惯」页，新建习惯并选择每天/工作日/周末。
2. 点击当日圆点完成打卡，连续天数会同步更新。
3. 桌面版填写提醒时间（如 `09:00`），保存后每天到点提醒；点击通知可直接跳到习惯页。

### 记录备忘录

1. 打开「备忘录」页，新建记录并填写标题与正文。
2. 常用内容可置顶，列表会优先展示置顶记录。
3. 启用 Gitee 同步后，备忘录会与其他数据一起同步。

### 启用 Gitee 同步

1. 在 Gitee 创建仓库并生成具备仓库读写权限的私人令牌。
2. 在应用设置中填写用户名、仓库、分支与文件路径，保存并测试连接。
3. 首次同步会拉取远端数据并与本机合并；之后本地修改会在约 3 秒后自动提交。

### 使用桌面小组件

在桌面「概览」或悬浮小组件中查看今日完成、待办、习惯与倒计时；点击条目可跳转到对应页面。Android 可添加 1x1、1x2、2x2 或 2x4 尺寸的小组件。

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

### Android 发布签名

Release 构建从 `apps/mobile/android/local.properties`（已 gitignore）读取签名配置，不再使用入库的 `gradle.properties`：

```properties
FN_RELEASE_STORE_FILE=focusnotes-release.jks
FN_RELEASE_STORE_PASSWORD=你的密码
FN_RELEASE_KEY_ALIAS=focusnotes
FN_RELEASE_KEY_PASSWORD=你的密码
```

`FN_RELEASE_STORE_FILE` 的相对路径以 `apps/mobile/android/app` 为基准，也可填写绝对路径。签名文件默认放在 `apps/mobile/android/app/focusnotes-release.jks`，不应提交到仓库。

构建脚本启用 v1/v2/v3 签名方案并禁用 v4；Release 只发布一个自包含 APK，不提供 `.idsig`。

## 测试与检查

```powershell
npm run typecheck
npm test
npm run build
```

核心包测试位于 `packages/core/tests/`，当前包含 `core.test.ts`、`features.test.ts` 与 `memo-sync.test.ts`，共 43 项用例。

## 数据与隐私

FocusNotes 默认将工作数据保存在设备本地。Android 云盘同步通过系统文件选择器读写你明确选择的 JSON 文件；启用 Gitee 同步后，数据会写入你指定的 Gitee 仓库。应用不会将数据上传到 FocusNotes 自有服务器。请妥善保管备份与私人令牌。

## 已知限制

- Android 习惯提醒时间当前仅保存，不发送通知。
- Windows 安装包未做代码签名，SmartScreen 可能提示「未知发布者」。
- Android 从旧版升级时，「紧凑 / 标准 / 宽松」密度偏好不会自动换算为百分比。
- Gitee 同步以整文件提交，多设备同时编辑时可能发生提交冲突，需要重新拉取后再提交。

## 变更说明

发布说明已迁移至 GitHub Releases：

- [最新版本与下载](https://github.com/Jak1r0/FocusNotes/releases/latest)
- [仓库内归档：发布说明 0.1.1](docs/RELEASE_NOTES.md)

## 版本

当前 Windows 与 Android 统一使用 **0.1.1**。此前的 2.x 版本号已停用，旧 Release 不再维护。