declare module 'mammoth/mammoth.browser' {
  export interface MammothBrowser {
    convertToHtml: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  }
  const mammoth: MammothBrowser;
  export default mammoth;
}
