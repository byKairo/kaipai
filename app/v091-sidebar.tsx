"use client";
import "./v091-sidebar.css";
import "./neo-ux.css";
import type { V091SidebarProps } from './sidebar/shared';
export type { V091SidebarProps, V091SideTab, StyleItem, DraftItem } from './sidebar/shared';
import { useSidebarController } from './sidebar/controller';
import { LayoutPanel } from './sidebar/layout-panel';
import { ComponentsPanel } from './sidebar/styles-panel';
import { DraftsPanel } from './sidebar/drafts-panel';
import { AiPanel } from './sidebar/ai-panel';
export default function V091Sidebar(p: V091SidebarProps) {
  const model = useSidebarController(p);
  return <div className="v091-sidebar-host workspace-sidebar-host">
    <aside className={"sidebar expanded open"} id={"sidebar"}>
      <nav className={"rail"} id={"rail"}>
        <button data-tab={"ai"} className={"" + ((p.tab) === "ai" ? ' active' : '')} onClick={() => p.onTabChange("ai")}>
          {"AI"}
        </button>

        <button data-tab={"layout"} className={"" + ((p.tab) === "layout" ? ' active' : '')} onClick={() => p.onTabChange("layout")}>
          {"风格"}
        </button>

        <button data-tab={"styles"} className={"" + ((p.tab) === "styles" ? ' active' : '')} onClick={() => p.onTabChange("styles")}>
          {"组件"}
        </button>

        <button data-tab={"drafts"} className={"" + ((p.tab) === "drafts" ? ' active' : '')} onClick={() => p.onTabChange("drafts")}>
          {"文稿"}
        </button>

      </nav>

      <div className={"side-main"}>
        <LayoutPanel model={model} />

        <ComponentsPanel model={model} />

        <DraftsPanel model={model} />

        <AiPanel model={model} />

      </div>

    </aside>
  </div>;
}
