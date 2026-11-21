# FocusNotes 发布说明

## 0.1.1（Windows / Android）

发布日期：2026-11-19

| 平台 | 版本号 | 说明 |
| --- | --- | --- |
| Windows | 0.1.1 | 安装包目录 `apps/desktop/release-011c` |
| Android | 0.1.1（versionCode 4） | 可从 0.1.0 覆盖安装 |
| 核心包 `@focusnotes/core` | 0.1.1 | 新增备忘录、同步载荷、Gitee 与小组件布局模块 |

### 主要变更

#### 备忘录

- 桌面与 Android 新增备忘录视图，支持置顶、搜索、长文本（单条 5 万字符，最多 500 条）。
- 备忘录写入 `WorkspaceExtras.memos`，旧数据自动兼容。
- 桌面导航与 Android 分页新增「备忘录」入口。

#### Gitee 云同步

- 新增 `createGiteeSync()`：基于 Gitee OpenAPI 的 pull / push / test，读写仓库中的 JSON 文件。
- 新增 `SyncPayload` 与 `mergeSyncPayload()`：同步待办与附属数据（清单、习惯打卡、专注记录、备忘录），偏好以远端为准。
- 桌面令牌通过 Electron `safeStorage` 加密后落盘，设置页新增 Gitee 配置面板。
- 启动时拉取并合并远端数据，本地修改后约 3 秒防抖提交。
- 移动端令牌保存在 AsyncStorage 应用私有存储中。

#### Android 小组件

- 新增 1x1、1x2、2x2、2x4 四种尺寸 Provider 与布局。
- 新增 `pickWidgetLayout()` 与 `widget_info_*` 配置，按占位格数选择布局。
- 统一刷新逻辑，按尺寸渲染今日计数、首条待办、方形列表或完整列表。

#### 其他

- 桌面新增 `app:version` 与 `ui:set-zoom` IPC，设置页显示版本并支持界面缩放。
- 默认隐藏「搜索」导航项，可在设置中重新开启。
- 新增 `memo-sync.test.ts`（12 项用例），核心包测试共 43 项。

### 修复内容

- Gitee base64 编码改为纯 JS UTF-8 实现，避免 React Native/Hermes 缺少 `TextEncoder`、`btoa`、`atob` 时运行时崩溃。
- Gitee contents 路径改为按路径段编码并用 `/` 连接，避免 `%2F` 被服务端误判为字面量。
- 签名默认 keystore 路径修正为 `focusnotes-release.jks`，避免解析到 `app/app/...`。
- Android APK 改为内嵌 v1 / v2 / v3 签名并禁用 v4，不再单独发布 `.idsig`；单 APK 即可完成签名校验与覆盖安装。签名证书与 0.1.0 一致（SHA-256 `7a85…`）。

### 兼容性

- **数据格式**：`extras` 新增 `memos` 字段，旧数据可正常读取；0.1.0 读取新备份时会忽略备忘录。
- **Android**：`versionCode` 为 4，可从 0.1.0 覆盖安装；从 2.x 版本升级仍需卸载重装。
- **Android 签名**：APK 内嵌 v1 / v2 / v3 签名，证书 SHA-256 为 `7a851890d7d62edf66d08f7183846517cdcb98f6fc24fc23bfa87b2f2aa39c2b`，与 0.1.0 相同；不再提供 `.idsig`。Release 附件提供公钥证书 `FocusNotes-0.1.1-cert.pem` 与校验文件 `FocusNotes-0.1.1.apk.sha256`（APK SHA-256 `4da05deb…`），私钥 keystore 不公开。
- **Gitee**：同步文件格式版本为 1，仅写入用户自己的仓库。
- **容量限制**：备忘录最多 500 条、单条 5 万字符；Gitee 以整文件提交，多设备并发可能冲突。

### 升级注意事项

1. 升级前导出 JSON 备份。
2. Android 0.1.0 → 0.1.1 使用相同证书且 `versionCode` 更高，可直接覆盖；若系统仍提示签名冲突，说明设备上的安装包不是同证书版本（如旧 2.x 或第三方重签包），需先卸载再安装。
3. Gitee 私人令牌需要仓库 contents 读写权限；桌面端加密保存，移动端保存在应用私有存储。
4. 多设备同步前先拉取最新数据，避免同时提交造成冲突。
5. Windows 覆盖安装保留本地数据。

### 已知限制

- Android 习惯提醒时间当前仅保存，不发送本地通知。
- Gitee 同步为整文件覆盖，冲突时需要重新拉取后再提交。
- Windows 安装包未做代码签名。
- R8 代码混淆与资源压缩尚未启用。

### 验证记录

本次发布前已执行：

```powershell
npm run typecheck   # core / desktop / mobile 均通过
npm test            # 3 个测试文件，43 项用例通过
npm run build       # core 与 desktop 构建通过
npm run dist -w @focusnotes/desktop  # 生成 Setup 0.1.1
gradlew assembleRelease  # APK 0.1.1，v1/v2/v3 内嵌签名，无 .idsig
```

## 0.1.0（Windows / Android）

发布日期：2026-11-19

| 平台 | 版本号 | 说明 |
| --- | --- | --- |
| Windows | 0.1.0 | 安装包目录 `apps/desktop/release-010` |
| Android | 0.1.0（versionCode 1） | `versionCode` 重置为 1 |
| 核心包 `@focusnotes/core` | 0.1.0 | 版本号与项目统一 |

### 版本号重置说明

- 此前版本使用 2.x 版本号，迭代节奏过快。自本版本起统一为 **0.1.0**，作为重新规划后的首个版本。
- 旧版本号不再使用，此前的 Release 将清理，仅保留 0.1.0。
- 功能上 0.1.0 包含此前 2.6.0 / 2.9.0 的全部能力，没有功能删减。

### 主要功能

- **待办与清单**：按清单整理任务，用重要/紧急象限安排优先级，并为任务设置截止时间。
- **日历与提醒**：按日期查看待办；任务到期提醒；Android 支持单任务提前提醒并添加到系统日历；桌面支持习惯每日提醒。
- **习惯追踪**：按每天/工作日/周末排期，记录打卡与连续天数，支持目标次数与提醒时间。
- **专注计时**：番茄倒计时或正计时，关联任务并记录专注会话；桌面展示「今日完成」聚合。
- **环境音**：程序合成环境音，桌面 12 种场景、最多 4 种混音与睡眠定时；Android 支持最多 4 种混音与睡眠定时。
- **桌面小组件**：Windows 悬浮小组件与 Android 主屏幕小组件，支持深色外观和今日完成汇总。
- **本地数据与备份**：两端支持 JSON 导入/导出与合并，桌面另支持 CSV；Android 支持系统文件选择器访问云盘 JSON。
- **外观与导航**：浅色/深色/跟随系统；Android 滑块调整字号与留白，支持左右滑动分页。

### 本版本包含的修复

- 白噪音混音后停止或切换场景时，统一清理 `interval` 与递归 `timeout`，避免继续操作已关闭的 `AudioContext`。
- 睡眠定时进入淡出阶段后，关闭定时或重新设定时恢复主音量，避免环境音保持静音。
- 混音时按场景数量均摊子增益，降低叠加爆音风险。
- 修复设置页打开期间被 PagerView 分页事件切走的问题。
- 修复「记录档案」锚定弹窗缺少定位与遮罩样式的问题。
- 提醒分钟数统一钳制为 0–10080 整数；移动端读取旧设置时增加数值校验。
- Android 签名凭据从入库的 `gradle.properties` 移出，改为读取 `local.properties`。
- Android APK 显式启用 APK Signature Scheme v2 / v3 / v4，并生成 v4 的 `.idsig` 附属文件；发布包已重新签名构建。

### 兼容性

- **数据格式**：本地数据与 JSON 备份结构未变，旧版数据可直接导入。
- **Windows**：Windows 10/11 x64；覆盖安装保留本地数据。
- **Android**：Android 7.0（API 24）及以上，编译/目标 SDK 35。
- **Android 签名**：发布 APK 使用 v2 / v3 / v4 签名方案，证书 RSA-2048、有效期至 2054 年；v4 增量安装需要随包提供 `.idsig`。
- **环境音偏好**：音量与睡眠定时会持久化；当前混音场景集合不持久化，启动后需重新选择。
- **混音上限**：最多 4 种，选择第 5 种时会自动移除最早选择的场景。

### 升级注意事项

1. **先备份**：升级前在「设置 → 导出完整备份」保存 JSON 文件。
2. **Android 必须卸载重装**：0.1.0 的 `versionCode` 为 1，低于此前 2.x 版本的 9，Android 会拒绝覆盖安装。请先导出备份，卸载旧版，再安装 0.1.0 并导入备份。
3. **Windows 覆盖安装**：可直接覆盖安装并保留数据；如遇异常，先导出备份。
4. **签名要求**：Android 安装包仍需使用与发布流程一致的签名；重装后首次启动需重新授予通知与自启动权限。
5. **通知权限**：Windows 与 Android 均需允许通知；桌面习惯提醒依赖系统通知。
6. **Windows 安装包未做代码签名**：SmartScreen 可能提示「未知发布者」。

### 已知限制

- Android 版的习惯提醒时间目前仅保存，不参与本地通知；桌面版已支持习惯每日提醒。
- Android 自定义提醒输入超过 10080 分钟时，状态值会被钳制，但输入框仍显示原始文本。
- 桌面端深色模式的日出日落功能仍依赖内置的 OpenWeatherMap Key。

### 验证记录

本次发布前已执行：

```powershell
npm run typecheck   # core / desktop / mobile 均通过
npm test            # 2 个测试文件，31 项用例通过
npm run build       # core 与 desktop 构建通过
npm run dist -w @focusnotes/desktop  # 生成 Setup 0.1.0
```