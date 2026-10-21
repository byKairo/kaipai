'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f4f5f7', color: '#202124', fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ maxWidth: 520, padding: 28, border: '1px solid #dfe3e8', borderRadius: 16, background: '#fff', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 12px' }}>编辑器暂时遇到问题</h1>
        <p style={{ margin: '0 0 20px', color: '#687078', lineHeight: 1.7 }}>本机文稿仍保存在浏览器中，可以尝试重新加载编辑器。</p>
        <button type="button" onClick={() => reset()} style={{ padding: '9px 16px', border: 0, borderRadius: 8, background: '#168b75', color: '#fff', cursor: 'pointer' }}>重新加载</button>
      </section>
    </main>
  );
}
