# 楷排

基于 V091 视觉与交互参考、按 Kaipai Community 技术规范重建的本地优先公众号排版工作台。

## 本地运行

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3003
```

打开 <http://127.0.0.1:3003/>。

开发服务运行期间不要同时执行 `npm run build`；生产构建会重写 `.next`，需要先停止开发服务，构建完成后再重新启动。

## 当前能力

- Tiptap / ProseMirror 结构化编辑与公众号预览
- 12 套 Style 切换
- 引用块、重点卡、代码示例和配图组件插入
- 导入 Markdown、复制公众号 HTML、导出独立 HTML
- IndexedDB 优先、本地存储兼容和降级恢复
- `/assets` 本地图片资产库，保存图片地址、名称和备注
- 加载页和错误恢复页

`public/kaipai_v091.html` 是视觉与功能参考样稿，不作为根路由直接套壳。根路由使用真正的 React + Tiptap 编辑器；`/assets` 作为独立的本地素材库页面。文章默认保存在浏览器，不需要服务端数据库。在线 AI 通过 Next.js 服务端路由转发，密钥和对应请求内容会经过项目服务端，因此完整功能需要 Next.js 服务，详见 `ARCHITECTURE.md`。

## 检查与源码位置

```bash
npm test
npm run typecheck
npm run build
node scripts/css-audit.cjs
```

排版测试包含 12 套风格的内容、结构、转义与兼容检查，以及已确认的输出基线。输出基线只能在核对实际变化后显式更新。

正式源码是根目录的 `app/` 和 `lib/`；旧副本、历史截图和压缩包位于 `archive/legacy/`。本轮修改前的源码备份位于 `archive/baselines/`，恢复时请先解压到独立目录核对，不要直接覆盖当前源码。
