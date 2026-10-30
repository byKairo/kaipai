import { FollowComposer } from './follow-composer';
import ui from './components-panel.module.css';
import { INSERT_SNIPPETS } from './shared';
import type { SidebarModel } from './controller';
import { AUTO_MARKER, resolveArticleHighlight } from '../../lib/article-styles/highlight';
export function ComponentsPanel({ model }: {
  model: SidebarModel;
}) {
  const { p, highlight, setHighlight, dividerOpen, setDividerOpen, dividerLabel, setDividerLabel, recTitle, setRecTitle, recStyle, setRecStyle, recUrls, setRecUrls, recBusy, insertDivider, fetchRecs } = model;
  const mark = resolveArticleHighlight(p.styleId, highlight, p.resolvedPaper);
  return (
    <div className={"side-body"} id={"tab-styles"} hidden={p.tab !== "styles"}>
      <div className={"sec"}>
        <div className={"section-kicker"} data-neo-tape={"COMPONENTS"}>
          {"COMPONENTS"}
        </div>

        <header><h3 className={"big-side-title"}>
          {"补充文章局部结构"}
        </h3></header>

        <p className={"side-desc"}>
          {"组件只处理局部信息，不和编辑栏的基础格式重复。"}
        </p>

      </div>

      <div className={"sec"}>
        <header className={ui.sectionHeading}><h3>
          {"信息强调"}
        </h3></header>

        <div className={"highlight-component"}>
          <div className={"highlight-copy"}>
            <b>
              {"荧光重点"}
            </b>
            <span>
              {"颜色和荧光高度默认跟随文章风格，也可以自选颜色。选中文字后点击应用。"}
            </span>
          </div>

          <div className={"highlight-demo"} style={{ backgroundColor: p.resolvedPaper }}>
            <span id={"highlightPreviewText"} style={{ backgroundColor: mark.backgroundColor, backgroundImage: mark.backgroundImage, color: mark.color, padding: mark.padding }}>
              {"这是一句需要被扫到的重点"}
            </span>
          </div>

          <div className={"highlight-actions"}>
            <div className={"highlight-swatches"} id={"highlightSwatches"}>
              <button data-highlight={"#F3E2AB"} style={{ "--hl": "#F3E2AB" } as React.CSSProperties} aria-label={"暖黄"} className={"" + ((highlight) === "#F3E2AB" ? ' active' : '')} onClick={() => { setHighlight("#F3E2AB"); p.onHighlightColorChange?.("#F3E2AB"); }}>
              </button>
              <button data-highlight={"#D8E5DF"} style={{ "--hl": "#D8E5DF" } as React.CSSProperties} aria-label={"灰绿"} className={"" + ((highlight) === "#D8E5DF" ? ' active' : '')} onClick={() => { setHighlight("#D8E5DF"); p.onHighlightColorChange?.("#D8E5DF"); }}>
              </button>
              <button data-highlight={"#D6E7F5"} style={{ "--hl": "#D6E7F5" } as React.CSSProperties} aria-label={"雾蓝"} className={"" + ((highlight) === "#D6E7F5" ? ' active' : '')} onClick={() => { setHighlight("#D6E7F5"); p.onHighlightColorChange?.("#D6E7F5"); }}>
              </button>
              <button data-highlight={"#EFD7D8"} style={{ "--hl": "#EFD7D8" } as React.CSSProperties} aria-label={"淡玫瑰"} className={"" + ((highlight) === "#EFD7D8" ? ' active' : '')} onClick={() => { setHighlight("#EFD7D8"); p.onHighlightColorChange?.("#EFD7D8"); }}>
              </button>
              <label title={"自定义荧光色"}>
                <input id={"highlightCustom"} type={"color"} value={mark.bg} onChange={e => { setHighlight(e.target.value); p.onHighlightColorChange?.(e.target.value); }} />
                <span>
                  {"＋"}
                </span>
              </label>

            </div>

            <button className={"mini-action"} type={"button"} aria-pressed={mark.auto} onClick={() => { setHighlight(AUTO_MARKER); p.onHighlightColorChange?.(AUTO_MARKER); }}>跟随风格</button>
            <button className={"mini-action highlight-apply"} id={"applyHighlightToSelection"} type={"button"} onMouseDown={event => event.preventDefault()} onClick={() => {
              if(p.onApplyHighlight)
                p.onApplyHighlight(highlight);
              else
                p.onInsertMarkdown('==荧光重点==');
            }}>
              {"应用到选中文字"}
            </button>

          </div>

        </div>

        <div id={"calloutColors"}>
        </div>

      </div>

      <div className={"sec"}>
        <header className={ui.sectionHeading}><h3>
          {"开头 · 署名"}
        </h3></header>

        <div className={"component-grid two"}>
          <button className={"component-card"} data-neo-block={"block"} data-insert={"lead"} onClick={() => p.onInsertMarkdown(INSERT_SNIPPETS["lead"])}>
            <b>
              {"导语卡"}
            </b>
            <span>
              {"标题下的阅读引导"}
            </span>
          </button>

          <button className={"component-card"} data-neo-block={"block"} data-insert={"author"} onClick={() => p.onInsertMarkdown(INSERT_SNIPPETS["author"])}>
            <b>
              {"作者卡"}
            </b>
            <span>
              {"文末署名与定位"}
            </span>
          </button>

        </div>

      </div>

      <div className={"sec"}>
        <header className={ui.sectionHeading}><h3>
          {"装饰分割"}
        </h3></header>

        <p className={"component-note"}>
          {"用于章节换气或文末模块前。建议全文 1–2 次。"}
        </p>

        <div className={"divider-grid"} id={"dividerGrid"}>
          <button type={"button"} data-divider={"hairline"} onClick={() => p.onInsertMarkdown(":::divider\nhairline\n:::")}>
            <span className={"dv dv-hairline"}>
              <i>
              </i>
            </span>
            <b>
              {"留白细线"}
            </b>
          </button>

          <button type={"button"} data-divider={"chapter"} onClick={() => p.onInsertMarkdown(":::divider\nchapter\n:::")}>
            <span className={"dv dv-chapter"}>
              <i>
              </i>
              <em>
                {"02"}
              </em>
              <i>
              </i>
            </span>
            <b>
              {"章节过渡"}
            </b>
          </button>

          <button type={"button"} data-divider={"diamond"} onClick={() => p.onInsertMarkdown(":::divider\ndiamond\n:::")}>
            <span className={"dv dv-diamond"}>
              {"— ◆ —"}
            </span>
            <b>
              {"菱形"}
            </b>
          </button>

          <button type={"button"} data-divider={"editorial"} onClick={() => setDividerOpen(true)}>
            <span className={"dv dv-editorial"}>
              {"EDITORIAL"}
            </span>
            <b>
              {"杂志栏目"}
            </b>
          </button>

          <button type={"button"} data-divider={"neo"} onClick={() => p.onInsertMarkdown(":::divider\nneo\n:::")}>
            <span className={"dv dv-neo"}>
              {"＋　＋　＋"}
            </span>
            <b>
              {"粗犷标记"}
            </b>
          </button>

          <button type={"button"} data-divider={"pixel"} onClick={() => p.onInsertMarkdown(":::divider\npixel\n:::")}>
            <span className={"dv dv-pixel"}>
              {"// NEXT //"}
            </span>
            <b>
              {"像素切换"}
            </b>
          </button>

        </div>

        <div className={"divider-label-popover"} id={"dividerLabelPopover"} hidden={!dividerOpen}>
          <label htmlFor={"dividerEditorialLabel"}>
            {"栏目名称"}
          </label>

          <div>
            <input id={"dividerEditorialLabel"} maxLength={24} placeholder={"例如：人物、观察、专题"} value={dividerLabel} onChange={e => { setDividerLabel(e.target.value); }} onKeyDown={e => {
              if(e.key === 'Enter') {
                e.preventDefault();
                insertDivider();
              } if(e.key === 'Escape')
                setDividerOpen(false);
            }} />
            <button type={"button"} id={"dividerEditorialInsert"} onClick={() => { insertDivider(); }}>
              {"插入"}
            </button>
            <button type={"button"} id={"dividerEditorialCancel"} aria-label={"取消"} onClick={() => { setDividerOpen(false); }}>
              {"×"}
            </button>
          </div>

        </div>

      </div>

      <div className={"sec"}>
        <header className={ui.sectionHeading}><h3>
          {"文末关注"}
        </h3></header>

        <FollowComposer model={model} />

      </div>

      <div className={"sec"}>
        <header className={ui.sectionHeading}><h3>
          {"文末推荐"}
        </h3></header>

        <input id={"recTitle"} placeholder={"推荐区标题"} value={recTitle} onChange={e => { setRecTitle(e.target.value); }} />
        <select id={"recStyle"} value={recStyle} onChange={e => { setRecStyle(e.target.value); }}>
          <option value={"strip"}>
            {"图片细条 · 文字叠加"}
          </option>
          <option value={"plain"}>
            {"简洁文字条"}
          </option>
        </select>

        <textarea id={"recUrls"} placeholder={"每行粘贴一篇往期文章链接"} style={{ "width": "100%", "minHeight": "84px", "border": "1px solid var(--line)", "borderRadius": "10px", "background": "var(--panel)", "color": "var(--ink)", "padding": "10px", "fontSize": "11px", "lineHeight": "1.6", "resize": "vertical" } as React.CSSProperties} value={recUrls} onChange={e => { setRecUrls(e.target.value); }}>
        </textarea>

        <button className={"btn"} id={"recFetch"} style={{ "width": "100%", "margin": "8px 0" } as React.CSSProperties} onClick={() => { void fetchRecs(); }} disabled={recBusy}>
          {"提取标题和头图"}
        </button>

        <p className={"component-note"}>
          {"从链接读取标题、封面，生成往期推荐；提取不到时可在正文中修改。"}
        </p>

      </div>

    </div>);
}
