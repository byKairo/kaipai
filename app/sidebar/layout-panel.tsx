import { findStyle } from '../../lib/styles';
import { styleUseCases } from '../../lib/article-styles/visual-rules';
import { StyleThumb } from './style-thumb';

import { STYLE_ORDER, STYLE_FAMILY, STYLE_NAMES, STYLE_SUMMARY, HEADING_STYLES, EMOJI_CHOICES, EMOJI_NAMES, READING_PRESETS, DEFAULT_FONT_FAMILY, barPreview } from './shared';
import type { V091SidebarProps } from './shared';
import type { SidebarModel } from './controller';
export function LayoutPanel({ model }: {
  model: SidebarModel;
}) {
  const { p, expanded, setExpanded, headingOpen, setHeadingOpen, emojiQuery, setEmojiQuery, brandOpen, setBrandOpen, brandName, setBrandName, brandNote, setBrandNote, activePreset, heading, visible, stylePaper, tinted } = model;
  return (
    <div className={"side-body"} id={"tab-layout"} hidden={p.tab !== "layout"}>
      <div className={"sec"}>
        <div className={"section-kicker"} data-neo-tape={"STYLE"}>
          {"STYLE SYSTEM"}
        </div>

        <h3 className={"big-side-title"}>
          {"整篇风格"}
        </h3>

        <p className={"side-desc"}>
          {"12 种本地风格，直接应用，无需配置 API。"}
        </p>

        <div className={"style-current"} id={"styleCurrent"}>
          <div className={"style-current-feature"}>
            <span className={"style-current-preview"} id={"styleCurrentPreview"} aria-hidden={"true"}>
              <StyleThumb id={p.styleId} />
            </span>
            <div>
              <span>
                {"当前风格"}
              </span>
              <b id={"styleCurrentName"}>
                {p.styleName}
              </b>
              <small id={"styleCurrentSummary"}>
                {STYLE_SUMMARY[p.styleId as keyof typeof STYLE_SUMMARY] || '整篇排版已应用'}
              </small>
            </div>
          </div>

          <div className={"variant-switch"} id={"styleVariantSwitch"}>
            <button data-variant={"quiet"} className={"" + ((p.variant) === "quiet" ? ' active' : '')} onClick={() => p.onVariantChange("quiet")}>
              {"克制"}
            </button>
            <button data-variant={"standard"} className={"" + ((p.variant) === "standard" ? ' active' : '')} onClick={() => p.onVariantChange("standard")}>
              {"标准"}
            </button>
            <button data-variant={"visual"} className={"" + ((p.variant) === "visual" ? ' active' : '')} onClick={() => p.onVariantChange("visual")}>
              {"视觉化"}
            </button>

          </div>

          <div className={"style-accent-row"}>
            <span>
              {"主题色"}
            </span>

            <div className={"accent-swatches"} id={"accentSwatches"}>
              <button type={"button"} data-accent={"#2563eb"} style={{ "--sw": "#2563eb" } as React.CSSProperties} aria-label={"蓝色"} className={"" + ((p.accent) === "#2563eb" ? ' active' : '')} onClick={() => p.onAccentChange("#2563eb")}>
              </button>

              <button type={"button"} data-accent={"#0f766e"} style={{ "--sw": "#0f766e" } as React.CSSProperties} aria-label={"青绿色"} className={"" + ((p.accent) === "#0f766e" ? ' active' : '')} onClick={() => p.onAccentChange("#0f766e")}>
              </button>

              <button type={"button"} data-accent={"#dc2626"} style={{ "--sw": "#dc2626" } as React.CSSProperties} aria-label={"红色"} className={"" + ((p.accent) === "#dc2626" ? ' active' : '')} onClick={() => p.onAccentChange("#dc2626")}>
              </button>

              <button type={"button"} data-accent={"#7c3aed"} style={{ "--sw": "#7c3aed" } as React.CSSProperties} aria-label={"紫色"} className={"" + ((p.accent) === "#7c3aed" ? ' active' : '')} onClick={() => p.onAccentChange("#7c3aed")}>
              </button>

              <label className={"accent-custom"} title={"自定义主题色"} aria-label={"自定义主题色"}>
                <input id={"themeColor"} type={"color"} value={p.accent} onChange={e => { p.onAccentChange(e.target.value); }} />
              </label>

            </div>

          </div>

          <div className={"style-font-color-row"}>
            <span>
              {"字体颜色"}
            </span>
            <div className={"accent-swatches font-color-swatches"} id={"fontColorSwatches"}>
              <button type={"button"} data-font-color={"#202124"} style={{ "--sw": "#202124" } as React.CSSProperties} aria-label={"深黑"} className={"" + ((p.fontColor || '') === "#202124" ? ' active' : '')} onClick={() => p.onFontColorChange?.("#202124")}>
              </button>
              <button type={"button"} data-font-color={"#2563eb"} style={{ "--sw": "#2563eb" } as React.CSSProperties} aria-label={"蓝色"} className={"" + ((p.fontColor || '') === "#2563eb" ? ' active' : '')} onClick={() => p.onFontColorChange?.("#2563eb")}>
              </button>
              <button type={"button"} data-font-color={"#dc2626"} style={{ "--sw": "#dc2626" } as React.CSSProperties} aria-label={"红色"} className={"" + ((p.fontColor || '') === "#dc2626" ? ' active' : '')} onClick={() => p.onFontColorChange?.("#dc2626")}>
              </button>
              <button type={"button"} data-font-color={"#ffffff"} style={{ "--sw": "#ffffff" } as React.CSSProperties} aria-label={"白色"} className={"" + ((p.fontColor || '') === "#ffffff" ? ' active' : '')} onClick={() => p.onFontColorChange?.("#ffffff")}>
              </button>
              <label className={"accent-custom font-color-picker"} title={"自定义字体颜色"} aria-label={"自定义字体颜色"}>
                <input id={"fontColor"} type={"color"} value={p.fontColor || '#202124'} onChange={e => { p.onFontColorChange?.(e.target.value); }} />
              </label>
            </div>
          </div>

          <p id={"styleGrammar"} hidden={true}>
            {"编号章节 · 重点句 · 轻引用 · TL;DR 收束"}
          </p>

          <div className={"style-meta-actions"}>
            <button className={"mini-action"} id={"styleStructureBtn"} onClick={() => { const style = findStyle(p.styleId); const scenario = styleUseCases[style.design]; p.onSay(style.preset ? `${style.preset.u}：${style.preset.why}` : `${scenario.audience}：${scenario.purpose}。${p.styleGrammar || style.grammar}`); }}>
              {"查看风格特点"}
            </button>
            <button className={"mini-action"} id={"styleAccentReset"} onClick={() => { p.onAccentChange(p.styles.find(x => x.id === p.styleId)?.accent || p.accent); p.onFontColorChange?.(''); p.onSay('已恢复默认主题色和字体颜色'); }}>
              {"恢复默认色"}
            </button>
          </div>

        </div>

        <div className={"brand-compact"} id={"brandCompact"}>
          <div>
            <span>
              {"我的风格"}
            </span>
            <b id={"brandCompactName"}>
              {activePreset?.name || '当前配置'}
            </b>
            <small id={"brandCompactMeta"}>
              {activePreset ? (p.savedStyleDirty ? '当前配置已调整，保存的风格未改变' : '已应用保存的风格') : '调整好当前文章，再保存为常用风格'}
            </small>
          </div>

          <button className={"mini-action"} id={"brandStyleOpen"} onClick={() => { setBrandName(p.brandName || ''); setBrandNote(p.brandNote || ''); setBrandOpen(!brandOpen); }}>
            {"保存当前配置"}
          </button>

        </div>

        <div className={"brand-style-editor"} id={"brandStyleEditor"} hidden={!brandOpen}>
          <label>
            {"风格名称"}
            <input id={"brandStyleName"} placeholder={"例如：我的公众号风格"} value={brandName} onChange={e => { setBrandName(e.target.value); }} />
          </label>
          <label>
            {"使用说明（可选）"}
            <textarea id={"brandStyleNote"} rows={2} placeholder={"例如：适合每周观点文章"} value={brandNote} onChange={e => { setBrandNote(e.target.value); }}>
            </textarea>
          </label>
          <button className={"mini-action"} id={"brandStyleSave"} onClick={() => { p.onSaveStylePreset?.(brandName.trim() || '我的公众号风格', brandNote.trim()); setBrandOpen(false); }}>
            {"保存为新风格"}
          </button>
        </div>

        <div className={"brand-preset-list"} id={"brandPresetList"}>
          {(p.savedStylePresets || []).map(preset =>
            <div key={preset.id} className={'brand-preset' + (preset.id === p.activeSavedStyleId ? ' active' : '')}>
              <div className="brand-preset-info">
                <b>
                  {preset.name}
                </b>
                <small>
                  {[preset.styleName, preset.note].filter(Boolean).join(' · ')}
                </small>
              </div>
              <button type="button" onClick={() => p.onApplyStylePreset?.(preset.id)}>
                {preset.id === p.activeSavedStyleId && !p.savedStyleDirty ? '已应用' : '应用'}
              </button>
              {preset.id === p.activeSavedStyleId && p.savedStyleDirty &&
                <button type="button" onClick={() => p.onUpdateStylePreset?.(preset.id)}>更新保存
                </button>}
              <button type="button" className="brand-preset-delete" aria-label={`删除 ${preset.name}`} onClick={() => p.onDeleteStylePreset?.(preset.id)}>×
              </button>
            </div>)}
        </div>

        <div className={"quick-style-head"}>
          <div>
            <b>
              {"选择文章风格"}
            </b>
            <span>
              {"先看 4 套，点击缩略图预览整篇"}
            </span>
          </div>
        </div>


        <div className={"quick-style-list"} id={"quickStyleList"}>
          {STYLE_ORDER.map(id =>
            <button key={id} type="button" className={'quick-style-card' + (id === p.styleId ? ' active' : '')} data-neo-block="style" data-family={STYLE_FAMILY[id]} data-v080-style={id} data-layout={id} hidden={!expanded && !visible.includes(id)} aria-pressed={id === p.styleId} onClick={() => p.onStyleChange(id)}>
              <StyleThumb id={id} />
              <span>
                <b>
                  {p.styles.find(x => x.id === id)?.name || STYLE_NAMES[id]}
                </b>
              </span>
            </button>)}
        </div>

        <button type={"button"} className={"quick-style-toggle"} id={"toggleAllStyles"} onClick={() => { setExpanded(!expanded); }} aria-expanded={expanded}>
          {expanded ? '收起风格' : '查看全部 12 套风格'}
          <span aria-hidden="true">
            {expanded ? '↑' : '↓'}
          </span>
        </button>

        

      </div>

      <details className={"advanced-settings"}>
        <summary>
          {"高级微调 "}
          <span>
            {"字体、留白与章节标题"}
          </span>
        </summary>

        <div className={"advanced-body"}>
          <div className={"sec advanced-section"}>
            <h3>
              {"正文阅读参数"}
            </h3>

            <p className={"advanced-hint"}>
              {"只保留肉眼可感知、会直接影响手机阅读节奏的参数。"}
            </p>

            <label className={"slide advanced-row"} style={{ "gridTemplateColumns": "88px 1fr" } as React.CSSProperties}>
              <span>
                {"字体"}
              </span>

              <select className={"ctrl"} id={"fontFamily"} style={{ "width": "100%" } as React.CSSProperties} value={p.fontFamily || DEFAULT_FONT_FAMILY} onChange={e => { p.onFontFamilyChange?.(e.target.value); }}>
                <option value={"\"Noto Sans SC\",\"PingFang SC\",\"Microsoft YaHei\",sans-serif"}>
                  {"思源黑体 · 清晰现代"}
                </option>

                <option value={"\"Noto Serif SC\",\"Songti SC\",\"SimSun\",serif"}>
                  {"思源宋体 · 编辑阅读"}
                </option>

                <option value={"\"LXGW WenKai\",\"Kaiti SC\",\"KaiTi\",serif"}>
                  {"霞鹜文楷 · 温和手写"}
                </option>

                <option value={"\"Zhuque Fangsong\",\"FangSong\",\"STFangsong\",serif"}>
                  {"朱雀仿宋 · 传统叙事"}
                </option>

              </select>

            </label>

            <p className={"advanced-hint font-hint"}>
              {"以上均为开源字体路线；复制到微信后自动使用相近系统字体回退。"}
            </p>

            <div className={"reading-presets"} id={"readingPresets"}>
              <button data-reading={"compact"} className={Object.entries(READING_PRESETS["compact"]).every(([k, v]) => p[k as keyof V091SidebarProps] === v) ? 'active' : ''} onClick={() => {
                const preset = READING_PRESETS["compact"]; if(p.onReadingChange)
                  p.onReadingChange(preset);
                else {
                  p.onFontSizeChange?.(preset.fontSize);
                  p.onLineHeightChange?.(preset.lineHeight);
                  p.onParagraphGapChange?.(preset.paragraphGap);
                  p.onPadXChange?.(preset.padX);
                }
              }}>
                {"紧凑"}
              </button>
              <button data-reading={"standard"} className={Object.entries(READING_PRESETS["standard"]).every(([k, v]) => p[k as keyof V091SidebarProps] === v) ? 'active' : ''} onClick={() => {
                const preset = READING_PRESETS["standard"]; if(p.onReadingChange)
                  p.onReadingChange(preset);
                else {
                  p.onFontSizeChange?.(preset.fontSize);
                  p.onLineHeightChange?.(preset.lineHeight);
                  p.onParagraphGapChange?.(preset.paragraphGap);
                  p.onPadXChange?.(preset.padX);
                }
              }}>
                {"推荐"}
              </button>
              <button data-reading={"relaxed"} className={Object.entries(READING_PRESETS["relaxed"]).every(([k, v]) => p[k as keyof V091SidebarProps] === v) ? 'active' : ''} onClick={() => {
                const preset = READING_PRESETS["relaxed"]; if(p.onReadingChange)
                  p.onReadingChange(preset);
                else {
                  p.onFontSizeChange?.(preset.fontSize);
                  p.onLineHeightChange?.(preset.lineHeight);
                  p.onParagraphGapChange?.(preset.paragraphGap);
                  p.onPadXChange?.(preset.padX);
                }
              }}>
                {"舒展"}
              </button>
            </div>

            <label className={"slide advanced-row"}>
              <span>
                {"正文字号 "}
                <b id={"fontSizeVal"}>
                  {p.fontSize ?? 16}
                  px
                </b>
              </span>
              <input id={"fontSize"} type={"range"} min={"14"} max={"19"} step={"1"} value={p.fontSize ?? 16} onChange={e => { p.onFontSizeChange?.(Number(e.target.value)); }} />
            </label>

            <label className={"slide advanced-row"}>
              <span>
                {"行高 "}
                <b id={"lineHeightVal"}>
                  {(p.lineHeight ?? 1.75).toFixed(2)}
                </b>
              </span>
              <input id={"lineHeight"} type={"range"} min={"160"} max={"205"} step={"1"} value={Math.round((p.lineHeight ?? 1.75) * 100)} onChange={e => { p.onLineHeightChange?.(Number(e.target.value) / 100); }} />
            </label>

            <label className={"slide advanced-row"}>
              <span>
                {"段落间距 "}
                <b id={"paragraphGapVal"}>
                  {p.paragraphGap ?? 16}
                  px
                </b>
              </span>
              <input id={"paragraphGap"} type={"range"} min={"10"} max={"36"} step={"1"} value={p.paragraphGap ?? 16} onChange={e => { p.onParagraphGapChange?.(Number(e.target.value)); }} />
            </label>

            <label className={"slide advanced-row"}>
              <span>
                {"左右间距 "}
                <b id={"padXVal"}>
                  {p.padX ?? 32}
                  px
                </b>
              </span>
              <input id={"padX"} type={"range"} min={"18"} max={"42"} step={"1"} value={p.padX ?? 32} onChange={e => { p.onPadXChange?.(Number(e.target.value)); }} />
            </label>

            <label className={"slide advanced-row"}>
              <span>
                {"图片圆角 "}
                <b id={"imageRadiusVal"}>
                  {p.imageRadius ?? 8}
                  px
                </b>
              </span>
              <input id={"imageRadius"} type={"range"} min={"0"} max={"16"} step={"1"} value={p.imageRadius ?? 8} onChange={e => { p.onImageRadiusChange?.(Number(e.target.value)); }} />
            </label>

            <div className={"paper-setting"} id={"paperSetting"}>
              <div className={"paper-setting-head"}>
                <div>
                  <b>
                    {"文章背景"}
                  </b>
                  <span>
                    {"默认使用当前 Style 推荐的背景。"}
                  </span>
                </div>
                <i className={"paper-swatch"} id={"paperSwatch"} style={{ background: (p.paperMode || 'style') === 'custom' ? p.paperColor : (p.paperMode === 'follow' && !tinted ? '#ffffff' : stylePaper) }}>
                </i>
              </div>

              <div className={"paper-mode-switch"} id={"paperModeSwitch"}>
                <button type={"button"} data-paper-mode={"follow"} className={"" + ((p.paperMode || 'style') === "follow" ? ' active' : '')} onClick={() => p.onPaperModeChange?.("follow")}>
                  {"跟随微信"}
                </button>
                <button type={"button"} data-paper-mode={"style"} className={"" + ((p.paperMode || 'style') === "style" ? ' active' : '')} onClick={() => p.onPaperModeChange?.("style")}>
                  {"Style 推荐"}
                </button>
                <button type={"button"} data-paper-mode={"custom"} className={"" + ((p.paperMode || 'style') === "custom" ? ' active' : '')} onClick={() => p.onPaperModeChange?.("custom")}>
                  {"自定义"}
                </button>
              </div>

              <div className={"paper-color-row"} id={"paperColorRow"} hidden={(p.paperMode || 'style') !== 'custom'}>
                <label className={"paper-color-picker"} title={"选择文章背景色"}>
                  <input id={"paperColor"} type={"color"} value={p.paperColor || '#ffffff'} onChange={e => { p.onPaperColorChange?.(e.target.value); }} />
                </label>
                <div className={"paper-color-copy"}>
                  <b id={"paperColorHex"}>
                    {(p.paperColor || '#ffffff').toUpperCase()}
                  </b>
                  <span>
                    {"仅在“自定义”模式下固定到公众号内容。"}
                  </span>
                </div>
                <button type={"button"} className={"mini-action"} id={"paperReset"} onClick={() => { p.onPaperColorChange?.('#ffffff'); p.onPaperModeChange?.('custom'); }}>
                  {"恢复白色"}
                </button>
              </div>

              {p.styleId === 'knowledge' && p.paperMode !== 'custom' && <div className="paper-note">
                <label htmlFor="paperTextureUrl">棉纸素材地址</label>
                <input id="paperTextureUrl" type="url" value={p.paperTextureUrl || ''} onChange={e => p.onPaperTextureUrlChange?.(e.target.value)} placeholder="上传公众号素材后，粘贴 https:// 图片地址" />
                <p>未填写时使用本地纸纹。发布前请上传素材并填入地址。</p>
                <a href="/article-assets/cotton-paper.jpg" download="棉纸纹理.jpg">下载棉纸纹理</a>
              </div>}
              <p className={"paper-note"} id={"paperNote"}>
                {tinted ?
                  <>
                    <strong>当前 Style 有专属纸色
                      {stylePaper.toUpperCase()}
                      ，复制时会带上。
                    </strong>
                    也可改用 Style 推荐 / 自定义。</> :
                  <>
                    <strong>默认：Style 推荐。
                    </strong>
                    当前文章采用这套风格的背景色；也可手动改成跟随微信或自定义。</>}
              </p>

            </div>

          </div>

          <div className={"sec advanced-section"}>
            <div className={"section-row"}>
              <div>
                <h3>
                  {"章节标题"}
                </h3>
                <p className={"advanced-hint"}>
                  {"二级章节可选结构；三级标题随风格显示竖线、荧光线或双下划线。三级标题文字与编号由你自己输入。"}
                </p>
              </div>
            </div>

            <div className={"heading-style-grid"} id={"headingStyles"} style={{ '--heading-marker-color': p.accent } as React.CSSProperties}>
              {HEADING_STYLES.map(h =>
                <button key={h.id} type="button" className={'heading-style-card' + (heading === h.id ? ' active' : '')} data-id={h.id} aria-pressed={heading === h.id} title={h.desc} onClick={() => { p.onHeadingStyleChange?.(h.id); setHeadingOpen(h.id === 'bar' || h.id === 'iconTag'); }}>
                  <span className="heading-style-name">
                    {h.id === 'bar' ? '风格标题' : h.label}
                  </span>
                  <span className="heading-preview" aria-hidden="true">
                    {h.id === 'bar' ?
                      <>
                        <span className="hp-pack-label">
                          {barPreview(p.headingPrefix || '', p.headingLabel || '', p.headingNumberFormat || '01', p.headingSeparator || '')}
                        </span>
                        <span>章节标题
                        </span>
                      </> : h.id === 'iconTag' ?
                        <>
                          <span className="hp-icon">
                            {p.headingIcon || '◆'}
                          </span>
                          <span>章节标题
                          </span>
                        </> :
                        <span dangerouslySetInnerHTML={{ __html: h.preview }} />}
                  </span>
                </button>)}
            </div>

            <div className={"heading-label-popover"} style={{ gridColumn: "1 / -1" }} id={"headingLabelPopover"} hidden={!headingOpen}>
              <div className={"heading-label-popover-head"}>
                <b id={"headingLabelTitle"}>
                  {heading === 'bar' ? '风格标题内容' : '选择标题图标'}
                </b>
                <button type={"button"} id={"headingLabelClose"} aria-label={"关闭设置"} onClick={() => { setHeadingOpen(false); }}>
                  {"×"}
                </button>
              </div>

              <div className={"heading-icon-control"} id={"headingIconControl"} hidden={heading !== 'iconTag'}>
                <div className={"heading-icon-picks"} id={"headingIconPicks"}>
                  <button type={"button"} data-heading-icon={"◆"} className={"" + ((p.headingIcon || '◆') === "◆" ? ' active' : '')} onClick={() => p.onHeadingIconChange?.("◆")}>
                    {"◆"}
                  </button>
                  <button type={"button"} data-heading-icon={"●"} className={"" + ((p.headingIcon || '◆') === "●" ? ' active' : '')} onClick={() => p.onHeadingIconChange?.("●")}>
                    {"●"}
                  </button>
                  <button type={"button"} data-heading-icon={"✦"} className={"" + ((p.headingIcon || '◆') === "✦" ? ' active' : '')} onClick={() => p.onHeadingIconChange?.("✦")}>
                    {"✦"}
                  </button>
                  <button type={"button"} data-heading-icon={"◈"} className={"" + ((p.headingIcon || '◆') === "◈" ? ' active' : '')} onClick={() => p.onHeadingIconChange?.("◈")}>
                    {"◈"}
                  </button>
                  <button type={"button"} data-heading-icon={"→"} className={"" + ((p.headingIcon || '◆') === "→" ? ' active' : '')} onClick={() => p.onHeadingIconChange?.("→")}>
                    {"→"}
                  </button>
                  <button type={"button"} data-heading-icon={"💡"} className={"" + ((p.headingIcon || '◆') === "💡" ? ' active' : '')} onClick={() => p.onHeadingIconChange?.("💡")}>
                    {"💡"}
                  </button>
                  <button type={"button"} data-heading-icon={"📌"} className={"" + ((p.headingIcon || '◆') === "📌" ? ' active' : '')} onClick={() => p.onHeadingIconChange?.("📌")}>
                    {"📌"}
                  </button>
                  <button type={"button"} data-heading-icon={"🚀"} className={"" + ((p.headingIcon || '◆') === "🚀" ? ' active' : '')} onClick={() => p.onHeadingIconChange?.("🚀")}>
                    {"🚀"}
                  </button>

                </div>

                <div className={"heading-icon-custom"}>
                  <input id={"headingIconCustom"} maxLength={4} placeholder={"输入自定义图标，即时生效"} aria-label={"自定义标题图标"} value={p.headingIcon || '◆'} onChange={e => { p.onHeadingIconChange?.(e.target.value.slice(0, 4)); }} />
                </div>

                <details className={"heading-emoji-more"}>
                  <summary>
                    {"更多 Emoji"}
                  </summary>
                  <input id={"headingEmojiSearch"} placeholder={"搜索 Emoji，如：书、灵感"} aria-label={"搜索标题 Emoji"} value={emojiQuery} onChange={e => { setEmojiQuery(e.target.value); }} />
                  <div className={"heading-emoji-grid"} id={"headingEmojiGrid"}>
                    {EMOJI_CHOICES.filter(emoji => !emojiQuery || emoji.includes(emojiQuery) || (EMOJI_NAMES[emoji] || '').includes(emojiQuery)).map(emoji =>
                      <button type="button" key={emoji} data-heading-icon={emoji} onClick={() => p.onHeadingIconChange?.(emoji)} aria-label={emoji}>
                        {emoji}
                      </button>)}
                  </div>
                </details>

              </div>

              <div id={"headingBarControls"} className={"heading-bar-controls"} hidden={heading !== 'bar'}>
                <label>
                  {"前缀符号"}
                  <input id={"headingPrefixInput"} maxLength={4} placeholder={"留空则不显示"} value={p.headingPrefix || ''} onChange={e => { p.onHeadingPrefixChange?.(e.target.value); }} />
                </label>

                <label>
                  {"短文字（可选）"}
                  <input id={"headingLabelInput"} maxLength={12} placeholder={"例如：DIR、章节"} value={p.headingLabel || ''} onChange={e => { p.onHeadingLabelChange?.(e.target.value); }} />
                </label>

                <label>
                  {"标题分隔符"}
                  <input id={"headingSeparatorInput"} maxLength={4} placeholder={"例如：/；留空则不显示"} value={p.headingSeparator || ''} onChange={e => { p.onHeadingSeparatorChange?.(e.target.value); }} />
                </label>

                <label>
                  {"自动编号"}
                  <select id={"headingNumberFormat"} value={p.headingNumberFormat || '01'} onChange={e => { p.onHeadingNumberFormatChange?.(e.target.value as '01' | '1' | '一' | 'none'); }}>
                    <option value={"01"}>
                      {"01、02、03"}
                    </option>
                    <option value={"1"}>
                      {"1、2、3"}
                    </option>
                    <option value={"一"}>
                      {"一、二、三"}
                    </option>
                    <option value={"none"}>
                      {"不显示编号"}
                    </option>
                  </select>
                </label>

                <div className={"heading-label-popover-actions"}>
                  <small>
                    {"修改后立即显示在预览中"}
                  </small>
                  <button type={"button"} id={"headingLabelReset"} onClick={() => { p.onHeadingLabelChange?.(''); p.onHeadingPrefixChange?.(''); p.onHeadingSeparatorChange?.(''); p.onHeadingNumberFormatChange?.('01'); }}>
                    {"恢复默认"}
                  </button>
                </div>

              </div>

            </div>

          </div>

        </div>

        
        
        
        

      </details>

    </div>);
}
