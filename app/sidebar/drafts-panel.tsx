import type { SidebarModel } from './controller';
export function DraftsPanel({ model }: {
  model: SidebarModel;
}) {
  const { p } = model;
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
            {"保存在当前浏览器，不会自动同步到其他设备"}
          </p>

        </div>

      </div>

      <div id={"draftLocalPane"}>
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

    </div>);
}
