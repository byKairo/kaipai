import type { Theme, InlineRenderer } from './elements';
import { wechatTextStyle } from '../wechat-typography';
import { accentTextOnPaper, inkOn } from './palette';

function box(t: Theme, tag: string, html: string, size: number, css = '') {
 return `<${tag} style="${wechatTextStyle(size)};${t.font}color:${t.ink};box-sizing:border-box;max-width:100%;overflow-wrap:anywhere;word-break:break-word;${css}">${html}</${tag}>`;
}
export function v4Heading(t: Theme, level: 1|2|3, html: string, number: string, eyebrow: string) {
 const p=t.style.preset!; if(number && p.nf.includes('{c}')) number=p.nf.replace('{c}',number); const ac=accentTextOnPaper(t.accent,t.paper,t.ink);
 const size=level===1?parseFloat(p.h1):level===2?parseFloat(p.h2):Math.max(16,t.bodySize);
 const badge=(css='')=>number?box(t,'span',number,Math.max(12,Math.round(size*.7)),`display:inline-block;margin-right:10px;color:${ac};font-weight:700;${css}`):'';
 let css=`margin:${level===1?'0 0 24px':level===2?'36px 0 18px':'26px 0 12px'};font-weight:700;text-align:left;`;
 let prefix='';
 if(level===3)return box(t,'h3',html,size,css);
 if(level===1){
  if(['center','seal','epi'].includes(p.o))css+='text-align:center;font-weight:500;';
  if(p.o==='kicker')css+=`border-top:3px solid ${t.ink};padding-top:14px;`;
  if(p.o==='diary')css+=`border-bottom:1px dashed ${t.line};padding-bottom:14px;`;
  if(p.o==='poster')css+=`border:3px solid ${t.ink};background-color:${t.surface};padding:10px 12px;box-shadow:4px 4px 0 ${t.ink};margin-right:5px;max-width:calc(100% - 5px);font-weight:900;`;
  if(p.o==='cover')css+=`border-bottom:4px solid ${t.accent};padding-bottom:18px;font-weight:900;`;
  if(p.o==='ep')css+=`border-left:5px solid ${t.accent};padding-left:12px;font-weight:900;`;
  if(p.o==='brand')css+=`border:1px solid ${t.line};border-top:8px solid ${t.ink};padding:16px 12px;`;
 }else{
  switch(p.h){
   case 'rule':css+=`border-top:2px solid ${t.ink};padding-top:10px;`;prefix=number?box(t,'span',number,12,`display:block;letter-spacing:3px;color:${ac};margin-bottom:6px;`):'';break;
   case 'under':css+=`border-bottom:1px dashed ${t.line};padding-bottom:6px;`;prefix=badge();break;
   case 'bar':css+=`border-left:3px solid ${t.accent};padding-left:10px;`;prefix=badge();break;
   case 'center':css+='text-align:center;font-weight:500;letter-spacing:3px;';break;
   case 'prefix':prefix=badge('font-family:Menlo,Consolas,monospace;');break;
   case 'block':css+=`display:table;background-color:${t.ink};color:${t.paper};padding:6px 12px;box-shadow:3px 3px 0 ${t.accent};max-width:calc(100% - 4px);`;prefix=badge(`color:${t.paper};`);break;
   case 'split':prefix=number?box(t,'span',number,Math.round(size*1.65),`display:block;color:${ac};font-weight:800;margin-bottom:4px;`):'';break;
   case 'tag':prefix=badge(`background-color:${t.surface};border:1px solid ${t.line};border-radius:30px;padding:1px 10px;`);break;
   case 'seal':prefix=badge(`background-color:${t.accent};color:${inkOn(t.accent)};padding:3px 6px;`);break;
   case 'dbl':css+='text-align:center;font-weight:600;letter-spacing:2px;margin-top:40px;';prefix=badge();break;
   case 'cap':css+=`display:table;border:2px solid ${t.ink};padding:4px 10px;background-color:${t.style.colors.mark};`;prefix=badge(`background-color:${t.ink};color:${t.paper};padding:1px 6px;`);break;
   case 'band':css+=`background-color:${t.ink};color:${t.paper};padding:8px 12px;`;prefix=badge(`color:${t.paper};`);break;
  }
 }
 return (eyebrow&&level===1?box(t,'p',eyebrow,12,`margin:0 0 12px;color:${ac};`):'')+box(t,`h${level}`,prefix+html,size,css);
}
export function v4Quote(t:Theme,value:string,inline:InlineRenderer){
 const p=t.style.preset!;const long=Array.from(value).length>90||value.includes('\n');
 let size=long?t.bodySize:Math.round(t.bodySize*(p.q==='big'?1.18:p.q==='pull'?1.12:1));
 let css=`margin:24px 0;padding:12px 0;text-align:${p.q==='pull'&&!long?'center':'left'};font-style:normal;line-height:${Math.max(t.lineHeight,Math.ceil(size*1.8))}px;`;
 if(p.q==='pull')css+=`border-top:1px solid ${t.ink};border-bottom:1px solid ${t.ink};`;
 if(['note','card','bar','top','speech'].includes(p.q))css+=`background-color:${t.quote};padding:12px 14px;`;
 if(p.q==='note')css+=`border:1px dashed ${t.line};border-radius:6px;`;
 if(p.q==='card')css+=`border:1px solid ${t.line};border-radius:${p.r};`;
 if(p.q==='bar')css+=`border-left:4px solid ${t.accent};`;
 if(p.q==='top')css+=`border-top:3px solid ${t.accent};`;
 if(['indent','small'].includes(p.q))css+='margin-left:12px;margin-right:6px;';
 if(p.q==='rail')css+=`border-left:2px solid ${t.line};padding-left:14px;`;
 if(p.q==='big')css+='font-weight:700;';
 if(p.q==='speech')css+=`border:2px solid ${t.ink};border-radius:18px 18px 18px 3px;`;
 return box(t,'blockquote',value.split('\n').map(v=>v?inline(v,size):'<br>').join('<br>'),size,css);
}
export function v4Paragraph(t:Theme,value:string,inline:InlineRenderer){
 const p=t.style.preset!;const book=p.id==='v4-book';
 return box(t,'p',inline(value,t.bodySize),t.bodySize,`margin:0 0 ${t.paragraphGap}px;line-height:${t.lineHeight}px;letter-spacing:${p.ls};text-align:${book?'justify':'left'};text-indent:${book?'2em':'0'};`);
}
export function v4Table(t:Theme,rows:string[][],inline:InlineRenderer){
 const p=t.style.preset!;const columns=Math.max(1,...rows.map(r=>r.length));
 const head= p.t==='head';const brutal=['brut','panel'].includes(p.t);
 const body=rows.map((row,i)=>`<tr>${Array.from({length:columns},(_,j)=>{
 let css=`padding:9px 10px;vertical-align:top;text-align:left;font-weight:${i?400:700};`;
 if(head)css+=i?`border-bottom:1px solid ${t.line};`:`background-color:${t.ink};color:${t.paper};`;
 else if(brutal)css+=`border:2px solid ${t.ink};background-color:${i?t.paper:t.surface};`;
 else if(p.t==='grid')css+=`border:1px solid ${t.line};background-color:${i?t.paper:t.surface};`;
 else if(p.t==='dotted')css+=`border-bottom:1px dashed ${t.line};`;
 else if(p.t==='soft')css+=`background-color:${t.surface};border:2px solid ${t.paper};`;
 else if(p.t==='zebra')css+=`background-color:${i%2?t.paper:t.surface};`;
 else if(p.t!=='bare')css+=`border-bottom:${!i&&p.t==='rule4'?3:1}px solid ${!i?t.accent:t.line};`;
 return box(t,i?'td':'th',inline(row[j]||'',14),14,css);
 }).join('')}</tr>`).join('');
 const minimum=columns>3?columns*100:0;
 return box(t,'section',box(t,'table',`<tbody>${body}</tbody>`,14,`width:100%;${minimum?`min-width:${minimum}px;max-width:none;`:''}table-layout:fixed;border-collapse:collapse;`),14,'margin:22px 0;overflow-x:auto;overscroll-behavior-x:contain;');
}
export function v4Image(t:Theme,source:string,caption:string,escape:(v:string)=>string){
 const p=t.style.preset!;let css='margin:26px 0;';
 if(p.id==='v4-comic')css+=`border:2px solid ${t.ink};padding:0;`;
 return box(t,'section',`<img src="${escape(source)}" alt="${escape(caption)}" style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:${t.imageRadius}px;">`+(caption?box(t,'p',escape(caption),12,`margin:8px 0 0;color:${t.muted};text-align:${p.id==='v4-editorial'?'left':'center'};`):''),t.bodySize,css);
}
