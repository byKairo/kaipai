import { buildFollowBlock, appendFollowBlock } from '../../lib/follow-composer';
import { useEffect, useState } from 'react';
import { STYLE_ORDER, FOLLOW_DEFAULTS } from './shared';
import type { V091SidebarProps } from './shared';
import { parseRecUrls, extractLinkMeta, buildRecsBlock, upsertRecsBlock } from '../../lib/link-meta';
import { AUTO_MARKER } from '../../lib/article-styles/highlight';
export function useSidebarController(p: V091SidebarProps) {
  const [expanded, setExpanded] = useState(false), [headingOpen, setHeadingOpen] = useState(false), [emojiQuery, setEmojiQuery] = useState('');
  const [brandOpen, setBrandOpen] = useState(false), [brandName, setBrandName] = useState(p.brandName || ''), [brandNote, setBrandNote] = useState(p.brandNote || '');
  const [highlight, setHighlight] = useState(p.markerColor || AUTO_MARKER), [dividerOpen, setDividerOpen] = useState(false), [dividerLabel, setDividerLabel] = useState('');
  const [follow, setFollow] = useState('minimal'), [followFields, setFollowFields] = useState(['关注我们', '持续分享真正有用的内容', '关注公众号', '', '']);
  const [recTitle, setRecTitle] = useState('往期推荐'), [recStyle, setRecStyle] = useState('strip'), [recUrls, setRecUrls] = useState(''), [recBusy, setRecBusy] = useState(false);
  const [ratios, setRatios] = useState(['4:3']), [visualStyle, setVisualStyle] = useState('跟随文章风格');
  // Hydrated presets arrive after the first render; retain edits on unrelated updates.
  useEffect(() => { setBrandName(p.brandName || ''); }, [p.brandName]);
  useEffect(() => { setBrandNote(p.brandNote || ''); }, [p.brandNote]);
  useEffect(() => { setHighlight(p.markerColor || AUTO_MARKER); }, [p.markerColor]);
  const activePreset = p.savedStylePresets?.find(x => x.id === p.activeSavedStyleId);
  const heading = p.headingStyle || 'bar';
  const phase = p.aiPhase || 'entry';
  const mode = p.aiResultMode;
  const featured: readonly string[] = STYLE_ORDER.slice(0, 4);
  const visible = featured.includes(p.styleId) ? featured : [...featured.slice(0, 3), p.styleId];
  const stylePaper = p.styles.find(x => x.id === p.styleId)?.paper || '#f7f7f2';
  const tinted = !['#fff', '#ffffff'].includes(stylePaper.toLowerCase());
  const mediaMeta: Record<string, [
    string,
    string
  ]> = { qr: ['二维码图片', '上传公众号二维码或填写图片 URL'], avatar: ['作者头像', '上传作者头像或填写图片 URL'], split: ['左侧图片', '上传品牌图、作品图或填写图片 URL'], account: ['公众号头像', '视觉名片；正文链接和原生名片需在微信后台配置'] };
  const say = (message: string, action: () => void) => { action(); p.onSay(message); };
  const setFollowField = (i: number, value: string) => setFollowFields(current => current.map((v, j) => j === i ? value : v));
  function chooseFollow(template: string) { setFollow(template); }
  function insertFollow() { const block = buildFollowBlock(follow, followFields, FOLLOW_DEFAULTS[follow] || FOLLOW_DEFAULTS.minimal); if (p.onPatchContent) p.onPatchContent(md => appendFollowBlock(md, block)); else p.onInsertMarkdown(block); p.onSay(p.onPatchContent ? '已添加关注模块到文末，可撤销' : '已插入关注模块'); }
  function insertDivider() { p.onInsertMarkdown(`:::divider\neditorial${dividerLabel.trim() ? `|${dividerLabel.trim().replace(/[\n|]/g, ' ').slice(0, 24)}` : ''}\n:::`); setDividerOpen(false); setDividerLabel(''); p.onSay('已插入「杂志栏目」分割'); }
  async function fetchRecs() {
    const urls = parseRecUrls(recUrls); if(!urls.length) {
      p.onSay('先粘贴至少一条文章链接');
      return;
    } if(!p.onPatchContent) {
      p.onSay('当前编辑器未就绪，无法写入往期推荐');
      return;
    } setRecBusy(true); p.onSay(`正在提取 ${urls.length} 条…`); try {
      const rows: Array<{
        title: string;
        image: string;
        href: string;
      }> = [];
      const seen = new Set<string>();
      let weak = 0;
      for(const url of urls) {
        if(seen.has(url))
          continue;
        const meta = await extractLinkMeta(url);
        const href = meta.href || url;
        if(seen.has(href))
          continue;
        seen.add(url);
        seen.add(href);
        const title = meta.title || url;
        if(!meta.image || title === url || title === href)
          weak++;
        rows.push({ title, image: meta.image || '', href });
      }
      if(!rows.length) {
        p.onSay('未能提取任何链接');
        return;
      }
      const block = buildRecsBlock(rows).replace(':::recs\n', `:::recs\n@title:${(recTitle.trim() || '往期推荐').replace(/\n|\|/g, ' ')}\n@style:${recStyle}\n`);
      p.onPatchContent(md => upsertRecsBlock(md, block));
      p.onSay(`已生成往期推荐（${rows.length} 条${weak ? '，部分需手改标题/封面' : ''}）`);
    }
    catch(error) {
      p.onSay(error instanceof Error ? error.message : '提取失败，请稍后重试');
    }
    finally {
      setRecBusy(false);
    }
  }
  return { p, expanded, setExpanded, headingOpen, setHeadingOpen, emojiQuery, setEmojiQuery, brandOpen, setBrandOpen, brandName, setBrandName, brandNote, setBrandNote, highlight, setHighlight, dividerOpen, setDividerOpen, dividerLabel, setDividerLabel, follow, followFields, recTitle, setRecTitle, recStyle, setRecStyle, recUrls, setRecUrls, recBusy, ratios, setRatios, visualStyle, setVisualStyle,  activePreset, heading, phase, mode, visible, stylePaper, tinted, mediaMeta, say, setFollowField, chooseFollow, insertFollow, insertDivider, fetchRecs };
}
export type SidebarModel = ReturnType<typeof useSidebarController>;
