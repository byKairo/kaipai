"use client";
import "./v091-sidebar.css";
import "./neo-ux.css";
import type { V091SidebarProps } from './sidebar/shared';
export type { V091SidebarProps, V091SideTab, StyleItem, DraftItem } from './sidebar/shared';
import { useSidebarController } from './sidebar/controller';
import { LayoutPanel } from './sidebar/layout-panel';
import dynamic from 'next/dynamic';
import { DeferredLoading } from './deferred-loading';

const ComponentsPanel = dynamic(() => import('./sidebar/styles-panel').then(module => module.ComponentsPanel), { loading: DeferredLoading });
const DraftsPanel = dynamic(() => import('./sidebar/drafts-panel').then(module => module.DraftsPanel), { loading: DeferredLoading });
const AiPanel = dynamic(() => import('./sidebar/ai-panel').then(module => module.AiPanel), { loading: DeferredLoading });
import { useEffect, useState } from 'react';
export default function V091Sidebar(p: V091SidebarProps) {
  const model = useSidebarController(p);
  // Mount optional panels on first use, then keep their drafts/state across tab switches.
  const [visited, setVisited] = useState(() => new Set([p.tab]));
  useEffect(() => { setVisited(tabs => tabs.has(p.tab) ? tabs : new Set([...Array.from(tabs), p.tab])); }, [p.tab]);
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
        {(p.tab === 'layout' || visited.has('layout')) && <LayoutPanel model={model} />}

        {(p.tab === 'styles' || visited.has('styles')) && <div className="deferred-panel" hidden={p.tab !== 'styles'}><ComponentsPanel model={model} /></div>}

        {(p.tab === 'drafts' || visited.has('drafts')) && <div className="deferred-panel" hidden={p.tab !== 'drafts'}><DraftsPanel model={model} /></div>}

        {(p.tab === 'ai' || visited.has('ai')) && <div className="deferred-panel" hidden={p.tab !== 'ai'}><AiPanel model={model} /></div>}

      </div>

    </aside>
  </div>;
}
