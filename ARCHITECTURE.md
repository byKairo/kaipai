# 楷排技术架构

## 产品与网络边界

楷排默认提供无需注册、无需登录、无需服务端数据库的访客工作台；账号和公众号服务已预留适配接口，当前尚未启用。文章、排版设置和素材记录默认保存在当前浏览器；不会自动同步到其他设备。

本地编辑、风格切换、预览、导入与导出在页面及所需资源已加载后不依赖 AI 服务。首次加载网页仍需要本地或远程 Next.js 服务；当前没有 Service Worker，不承诺断网后重新打开网页可用。

在线 AI 功能采用 BYOK，通过 Next.js 的 `/api/ai/*` 服务端路由转发请求。用户的 API 密钥以及相应的文章内容、提示词会经过运行本项目的服务端，再发送给所选供应商。保存 API 配置时，服务端使用 AES-256-GCM 把密钥封装成绑定供应商、基础地址和业务空间的加密凭证；浏览器将该凭证及模型配置保存在 `localStorage`，关闭标签后可恢复。原始 Key 在输入和首次保存请求中仍可由本机开发者工具看到；后续调用只提交凭证，服务端解密后转发。服务端路由没有把访客原始密钥写入文件或数据库的实现，也没有向浏览器返回原始 Key 的接口。这不代表部署平台、反向代理或供应商的日志与保留策略也由本项目控制。

当前部署需要支持 Next.js Route Handlers 的运行环境，不能用纯静态导出保留完整 AI 功能。浏览器直连不是当前实现；若以后增加，须验证供应商跨域支持并明确选择行为。

## 页面与功能边界

- `app/page.tsx`：工作台入口与功能组合。
- `app/workspace/`：工作台状态及交互职责，按具体模块查看源码。
- `app/v091-sidebar.tsx` 与 `app/sidebar/`：左侧栏及各面板。
- `app/rich-editor.tsx`：Tiptap / ProseMirror 结构化编辑器。
- `app/api-settings.tsx`：供应商、模型和访客持久凭证配置。
- `app/assets/page.tsx`：浏览器本地素材库。
- `lib/document.ts`、`lib/storage.ts`：文章类型、保存与恢复。
- `lib/styles.ts`：12 套文章风格与组件默认值。
- `lib/wechat-html.ts`：Markdown 分段与转换入口，保持原调用接口。
- `lib/article-styles/`：文章元素、局部组件、标题模板、颜色计算和纸纹资源；只渲染 HTML，不维护 UI 状态。
- `lib/wechat-text.ts`、`lib/wechat-compliance.ts`、`lib/wechat-resources.ts`：文字转义、排版检查和发布素材提示。
- `lib/providers.ts`：浏览器调用本项目文字 AI 路由的统一接口。
- `lib/server-endpoint.ts`：服务端上游地址校验。
- `app/api/ai/`：文字、配图、模型列表及连接相关服务端路由。

编辑器文档使用 Tiptap / ProseMirror Document JSON；Markdown 同时用于排版转换、兼容存档和导入导出。重构不得仅保留其中一种表示而丢失另一种。

### 正文内文章建议

正文顶部的“检查文章”独立于整篇排版方案。`lib/article-review.ts` 用 ProseMirror 插件状态与 Decorations 显示虚线，建议不写入 Document JSON、Markdown、存档或导出。点击虚线展示单条建议；只在采用时通过单个可撤销事务修改文字或添加强调。忽略不改正文。前方编辑通过事务映射位置；原句变化后移除旧建议，重复且无法唯一定位的文字不标注。代码、链接、跨段移动和整段重写不在当前可执行范围内。

`app/workspace/use-article-review.ts` 将请求绑定当前文章与版本；切文稿、取消或检查期间改文会拒绝旧结果。`review` 服务端流程加载随网站发布的 Kairo Layout 建议规则，并限定为简短的句子替换、强调与待确认项；缺依据的待确认项没有采用按钮。本地模拟只演示强调交互，明确标注演示，不冒充全文编辑结论。暂不跨刷新保存建议；文章内容按原存储流程保存。

## 浏览器存储

1. IndexedDB `kaipai-community`：`articles` 保存结构化文章，`drafts` 保存 Markdown 草稿。
2. `localStorage`：当前文章指针、历史兼容设置、用户风格、Local Memory、素材元数据及文章保存降级备份、多文稿离开页面恢复备份。
3. `localStorage` 的 `kaipai.community.api-profiles.v4`：模型配置及加密凭证。原始 Key 不允许写入此项。旧 `sessionStorage` API 配置在加密、持久保存成功后删除；迁移失败保留旧数据并提示。
4. `sessionStorage`：其他会话临时状态。
5. AI 生成图片按 `lib/generated-images.ts` 的本地存储实现保存；本地预览不等于已经上传到公众号素材库。

存储异常、旧数据恢复和文章切换必须保持内容完整；不可把配置保存成功当作供应商连接成功。

## 样式维护

界面 CSS 与输出文章的内联样式是两个系统。公众号转换不能依赖工作台 CSS。

历史界面样式仍存在覆盖层；本轮只移除同一作用域、选择器、属性、值及优先级完全相同的重复声明，保留加载顺序和兼容值。禁止用批量删除 `!important` 的方式清理样式。新组件优先使用明确的组件类，修改已有规则，避免在文件尾追加同一选择器的补丁。

`node scripts/css-audit.cjs` 检查重复声明；`--write` 执行上述保守清理。新的响应式或视觉修改仍需浏览器验收。

## 源码、归档与验证

根目录 `app/`、`lib/` 是当前实现。`archive/legacy/` 是旧副本及历史截图，排除在 TypeScript 检查之外，不参与页面构建。`archive/baselines/` 保存本轮修改前的源码备份。

`public/kaipai_v091.html`、`work/` 保留为视觉参考，不作为正式入口。

执行 `npm test`、`npm run typecheck` 和 `npm run build`。生产构建会使用 `.next`；同一目录的开发服务应先停止，再执行生产构建。浏览器验收应覆盖面板切换、风格与微调、草稿恢复、组件插入、AI 本地模拟和复制导出。真实供应商调用需要实际配置与网络，离线测试不能替代它。

## 公众号图片发布边界

当前没有接通公众号图片上传接口。用户真实后台已拒绝 HTML 内嵌 Base64 图片，因此撤掉为剪贴板转换 PNG 的实验，不再提示“正文与图片已写入剪贴板”代表可在公众号使用。

`lib/wechat-publication.ts` 只处理发布副本：保留微信 `mmbiz.qpic.cn` 图片地址，将其余图片替换为按正文顺序编号的待上传提示，保留正文、外层图片装饰与图注；未转为微信素材的背景在复制时去掉，保留底色。编辑器和预览中的原图不变。

`lib/article-image-download.ts` 为这些位置打包图片和图注，PNG/JPEG 原图保留，SVG 等转换为 PNG 文件。包内附上传步骤及无法下载的图片说明；网络图片可能受跨域限制，不静默忽略失败。下载位图转换不参与复制。用户在公众号后台上传图片并移除对应占位提示，背景素材需取得微信地址后填回楷排再复制。

普通网页不能依赖公众号登录状态执行跨站上传；未来接口接入需要配置公众号授权、账号凭证仓库和真实上传验收。`/api/wechat/drafts` 目前只拒绝未登录请求或返回未接通状态，不发送微信请求。富文本复制保留 Clipboard API 与旧浏览器回退，复制成功不等于微信保存与手机预览成功。

## 本地 AI 代理

生产构建的本机运行使用 `npm run start:local`（先执行 `npm run build`），监听 `127.0.0.1:3003`，显式开启 `KAIPAI_ALLOW_LOOPBACK_API=1`。该模式允许 `localhost`、`127.0.0.1`、`[::1]` 的 HTTP/HTTPS 代理及自定义端口，适用于本机 `/v1` 服务。一般生产启动不设置该选项，仍限制自定义端点为公网域名。局域网、云元数据地址及解析到内网的域名不因此放开。

模型发现、文本与配图均使用 `lib/server-endpoint.ts` 的同一规则。地址错误返回明确的 400 提示，超时和代理未启动保留可操作的错误信息，不显示密钥。`node scripts/verify-local-api.cjs` 使用临时本机模拟服务验证生产路由，无真实供应商调用。


## 访客凭证与 Skill 框架

- `lib/server/credential-codec.ts`：凭证加解密、服务绑定和密钥轮换。`KAIPAI_CREDENTIAL_KEYS` 是服务端环境秘密，各实例必须一致。不能设为 `NEXT_PUBLIC_*`，不能每次启动重新生成。
- `app/api/credentials/seal`：生成凭证，不验证供应商余额或可用性。模型发现、测试、文字、图片各路由在发出请求前校验实际服务绑定；官方目录接口不接受其他地址的凭证。
- `lib/server/request.ts`：JSON 请求大小、来源检查和不缓存响应。反向代理部署可设置 `KAIPAI_PUBLIC_ORIGIN` 为浏览器实际站点 Origin。
- `server/skills/`：随网站发布的两个 Skill 快照和内容版本清单；不在 public 下。`npm run skills:sync` 从本机 Skill 源同步，构建产物包含相应资源，不依赖开发者电脑的绝对路径。
- `lib/server/skill-workflows.ts`：固定排版、配图规划及生图指令流程。排版阅读全文（最多 4 万字符，超出则拒绝，不静默截断），使用 Kairo Layout 的规则；配图规划使用 Kairo Design 的知识和风格目录，生图时加载简报及匹配风格文件。返回建议供用户确认。网站没有通用 Agent 的联网或脚本执行能力。正文配图卡仍是候选流程；新版封面使用下述独立看图审核与有额度的修正流程。
- `lib/server/platform-contracts.ts`、`platform.ts`：账号认证、账号凭证仓库及公众号草稿服务适配边界。身份必须来自服务端登录会话；仓库接口包含 ownerId，读取后再次校验归属。当前没有实际登录供应商、账号数据库或公众号授权。
- `GET /api/platform`：只返回公开能力状态和 Skill 版本。可配置 `KAIPAI_GITHUB_URL` 展示真实 GitHub 链接；未配置时不显示占位链接。

隔离边界：不同设备或浏览器配置文件的访客不共享本地数据，服务端没有访客凭证列表。共享同一浏览器配置文件的人共享该访客身份。加密凭证本身可用于调用，必须按秘密保护；若被扩展、XSS 或本机人员复制，可以重放。删除浏览器配置只删除本地副本，不撤销已复制的凭证；需要在供应商撤销原 Key。服务端运营者持有解密密钥，因此本方案不承诺运营者无法解密，也不承诺绝对防盗。前端加密不能消除这些边界。

部署和后续账号接入步骤见 `docs/architecture/guest-skill-framework.md`。

### Cloudflare 部署准备（尚未完成公网验收）

Workers 不支持 `node:dns` 的 `lookup`。部署到 Workers 时设置 `KAIPAI_DNS_RESOLVER=records`，服务端会查询 A 和 AAAA 记录，并对所有返回地址执行原有公网校验；无地址或解析异常时拒绝请求。普通 Node.js 部署留空，继续使用系统解析器。

`cloudflare/` 保存独立的 vinext 部署依赖、锁文件和 Workers 配置；根目录保持原 Next.js 依赖。`npm run cf:prepare` 只把 app、lib、server、public 和构建配置复制到忽略版本管理的 `.cloudflare-deploy/`，不复制 `.env.local`、用户输出或历史归档。准备脚本验证 Skill 文件哈希，并仅在部署副本中将文件读取改为服务端 JSON 模块读取。配置变更后重新准备，在部署目录运行 `npm ci --legacy-peer-deps`，再执行 `npm run cf:build`；预览和发布分别使用 `npm run cf:preview`、`npm run cf:deploy`。首次发布需完成官方 Wrangler 授权，并单独设置稳定的 `KAIPAI_CREDENTIAL_KEYS` Secret；本地预览临时密钥不能作为生产密钥。

2026-10-21 已通过独立 Workers 构建、本机首页与平台接口、虚拟凭证加密及跨站请求拒绝检查，浏览器验证了风格面板及风格切换；五种 Skill 操作和配图提示词与原实现的输出一致。公网部署、真实模型调用、免费 CPU 配额和大陆访问尚未验收。先以 Workers Free 和平台地址验证，域名、R2、数据库及 Workers AI 均不是当前版本首次部署的必要购买项。

同日已将 Worker `kaipai` 发布到用户账号，并上传 `KAIPAI_CREDENTIAL_KEYS` Secret；生产密钥备份在忽略版本管理、权限 600 的 `.env.cloudflare-keyring`，不可公开或覆盖。账号免费子域已由自动分配值改为 `kairostudio.workers.dev`，目标地址 `https://kaipai.kairostudio.workers.dev`。修改前的平台地址首页和 `/api/platform` 已返回 200；新子域 HTTPS 已就绪，首页与平台接口返回 200，生产虚拟凭证加密和外站 Origin 拒绝均通过；线上浏览器完成风格切换与 HTML 导出。没有调用真实付费模型，没有完成大陆多运营商访问测量。


## 新版封面设计

`app/sidebar/cover-designer.tsx` 提供有字/完全无字、完整标题、微信公众号画幅、三种推荐及多选风格。封面风格来自 `kairo-design/catalog.json`，与文章排版主题分开；严格无字不开放字图穿插的关键词例外。用户先明确路线，再选择风格；每种选定风格默认一张目标图。用户可在生成额度中选择每种风格最多1–3次生成，界面始终显示当前额度，失败才使用余下次数。

`/api/ai/design` 提供路线对应的公开风格摘要。`/api/ai` 的 `design-recommend`、`design-compose`、`design-review` 是固定步骤：通读完整文章、按当前路线META推荐、加载本路线STYLE与父项及设计指南编译画面方案、再用实际图片进行单独审核。设计与审核分开请求；支持 Chat Completions 和 Responses 的图片输入。已有文章模型可被选择为审核连接，但它必须实际支持图片输入；没有模型、接口拒绝或审核格式缺项时不放行。模型审核是机器判断，不能等同于独立专家或用户认可。

`/api/ai/image` 接收编译后的具体画面方案和明确的路线/风格/锁定文案，不把整份风格目录拼给生图模型。生成服务按适配器提供画幅参数，不能原生满足时记录最近的支持画幅；前端保留原图，不裁切、不拉伸。实际像素与生成画幅按2%容差核对；模型回退画幅在界面显示，不宣称精确满足原始比例。

审核要求实际图片、逐字观察记录、六项可见依据和明确保留决定。`lib/cover-design.ts` 对有字标题只忽略排版换行，其余空格、标点和文字均须一致；无字必须没有观察文字。缺项、不适用误用、要求修正或重构不能成为成品。记录绑定原始图片字节SHA-256，前端再次核对；全部通过才提供成品下载并保存到本机图片库。未通过会把反馈交回构思步骤，在用户设定额度内调整；未验证则保留候选供重试审核，服务故障停止。更换文章或离开封面面板会取消当前任务，迟到结果不能更新当前文稿。

全局skill更新后需显式同步、构建并重启/部署。快照包括 `catalog.json`、`routes/`、路线STYLE及支持资料，旧版已删除资源不会保留在当前快照内。网站不执行skill里的本机Python脚本；已实现的文件哈希、文字契约及尺寸检查是网站宿主检查，不宣称运行过本机final_gate或完成微信后台上传验收。
