# 开发与发布

正式源码位于 app/、lib/。本地使用 npm ci、npm run dev；开发服务与生产构建不要同时运行。提交前执行 npm test、npm run typecheck、npm run build；Workers 部署另执行 cf:ci 及工作流中的运行时检查。

## 唯一生产发布流程

1. 从 GitHub main 获取当前已提交源码。工作区可能有未发布的修改，先查看 git status，保留它们。
2. 完成修改和验证后提交并推送到 main。只有 main 推送或手动运行现有 Deploy Kaipai 工作流会部署。
3. GitHub Actions 根据锁文件安装依赖，完整测试、检查类型，保留旧版资源并构建；再检查公开产物和 Workers 运行时行为。任何必要检查失败都不发布。
4. 使用已有 Worker 专属部署 Secret 上传新的代码版本，再将该版本切换为 100% 流量。此流程保留现有域名绑定，不尝试修改域名，不需要扩大令牌权限。不要从本机直接发布，也不要把密钥写入源码或日志。
5. 读取正式站点 GET /api/release，核对 commit 与该次 GitHub Actions 的完整 SHA 相同；只有流程成功并核对一致才算发布完成。

入口：https://kaipai.itskairo.com/ 。构建记录：https://github.com/byKairo/kaipai/actions 。

浏览器已经打开的页面可能继续运行旧代码；新发布包保留旧模块，并补齐已验证的公开缓存。需要明确打开最新在线页面时可在地址上带 release 参数；该导航绕过旧缓存首页，不清理用户文稿。

公开缓存分阶段准备：先验证首页静态依赖和编辑器，让基础工作台可再次打开；可选功能按需或在页面空闲时逐个补充，失败不撤销基础缓存。历史代码保留在线上发布包，不再要求每位访客预先下载所有历史版本。离线验收应区分基础编辑和此前未使用、未缓存的可选功能，不能用基础缓存就绪代替完整功能验收。

## 资源兼容与源码对应

cloudflare/asset-history/ 保存已发布的公开 JS/CSS 与哈希；cf:build 和 cf:ci 在准备源码前同步当前生产资源。首次构建需要网络。cf:deploy 在上传前再次检查旧依赖。构建和运行时校验产生的 .wrangler 临时数据库不属于发布产物，真实代码仍参与完整指纹校验。

GitHub Actions 将 GITHUB_SHA 写入准备记录和 Worker 构建。/api/release 使用该固定值，不根据浏览器缓存或本地配置猜测版本。本机 cf:deploy 会明确拒绝；本机 cf:build、cf:preview 不受影响。

旧静态入口、桥接服务和停用的图片转存接口已删除。正式与备用域名共用同一份产品源码，生成目录不可单独修改；历史资源仅为已打开页面提供兼容。
