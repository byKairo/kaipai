/** Keep preview and inserted content identical; fields cannot create extra block lines. */
export function buildFollowBlock(template: string, fields: string[], defaults: readonly string[]) {
  const values = fields.map((value, index) => (value.trim() || (index < 3 ? defaults[index] : '')).replace(/\|/g, '／').replace(/[\r\n]/g, ' '));
  return `:::follow\n${[template, ...values].join('|')}\n:::`;
}
export function appendFollowBlock(markdown: string, block: string) {
  return `${markdown.trimEnd()}${markdown.trim() ? '\n\n' : ''}${block}\n`;
}
