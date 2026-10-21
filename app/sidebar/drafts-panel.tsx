import type { V091SidebarProps } from './shared';
import type { SidebarModel } from './controller';
export function DraftsPanel({ model }: {
  model: SidebarModel;
}) {
  const { p, scope, setScope } = model;
  return (
    <div className={"side-body"} id={"tab-drafts"} hidden={p.tab !== "drafts"}>
      <div className={"section-kicker"} data-neo-tape={"DRAFTS"}>
        {"CONTENT LIBRARY"}
      </div>

      <div className={"draft-headline"}>
        <div>
          <h3>
            {"我的文稿"}
          </h3>

          <p id={"draftAccountHint"}>
            {"未登录 · 当前仅保存在本机"}
          </p>

        </div>

        <button type={"button"} className={"mini-action"} id={"draftLoginBtn"} onClick={() => { p.onSay('当前文稿保存在本机，云端同步尚未开放'); }}>
          {"登录"}
        </button>

      </div>

      <div className={"segmented"} id={"draftScope"}>
        <button type={"button"} data-scope={"local"} className={"" + ((scope) === "local" ? ' active' : '')} onClick={() => setScope("local")}>
          {"本地"}
        </button>

        <button type={"button"} data-scope={"cloud"} className={"" + ((scope) === "cloud" ? ' active' : '')} onClick={() => setScope("cloud")}>
          {"云端"}
        </button>

      </div>

      <div id={"draftLocalPane"} hidden={scope !== 'local'}>
        <div className={"draft-actions"}>
          <button type={"button"} className={"btn"} id={"newDraft"} onClick={() => { p.onCreateDraft(); }}>
            {"＋ 新建"}
          </button>

          <button type={"button"} className={"btn"} id={"loadSample"} onClick={() => { p.onLoadSample?.(); }}>
            {"示例"}
          </button>

          <button type={"button"} className={"btn"} id={"importFromDraft"} onClick={() => { p.onImportDraft?.(); }}>
            {"导入"}
          </button>

        </div>

        <div id={"draftList"}>
          {p.drafts.length ? p.drafts.map(d =>
            <article key={d.id} className="draft draft-row" data-neo-block="draft" data-draft-id={d.id}>
              <button type="button" className="draft-main draft-open" data-draft-open={d.id} onClick={() => p.onOpenDraft(d.id)}>
                <b>
                  {d.title || '未命名文稿'}
                </b>
                <small>
                  {new Date(d.updatedAt).toLocaleString('zh-CN')}
                </small>
              </button>
              <button type="button" className="draft-del draft-delete" data-draft-delete={d.id} onClick={() => p.onDeleteDraft(d.id)}>删除
              </button>
            </article>) :
            <div className="draft-empty">还没有文稿。点击上方新建，或导入已有 Markdown。
            </div>}
        </div>

      </div>

      <div id={"draftCloudPane"} hidden={scope !== 'cloud'}>
        <div className={"empty-state"} id={"cloudDraftEmpty"}>
          <b>
            {"跨设备文稿与历史版本"}
          </b>

          <p>
            {"登录后自动保存到云端，并可查看版本、恢复历史内容。"}
          </p>

          <button type={"button"} className={"btn primary"} id={"cloudLoginBtn"} onClick={() => { p.onSay('云端同步尚未开放'); }}>
            {"登录后开启"}
          </button>

        </div>

        

      </div>

      <div className={"history-card"}>
        <span>
          {"当前文稿"}
        </span>

        <b>
          {"版本历史"}
        </b>

        <p>
          {"每次 AI 重排或同步前创建版本点，方便回退。"}
        </p>

        <button type={"button"} className={"mini-action"} id={"historyBtn"} onClick={() => { p.onSay('版本历史尚未开放'); }}>
          {"查看版本（原型）"}
        </button>

      </div>

    </div>);
}
