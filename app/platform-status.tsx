'use client';
import { useEffect, useState } from 'react';
type Status = { guest: { persistentCredentials: boolean }; githubUrl: string | null };
export default function PlatformStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/platform', { cache: 'no-store', signal: controller.signal }).then(response => response.ok ? response.json() : null).then(setStatus).catch(() => {});
    return () => controller.abort();
  }, []);
  return <span title="AI 排版与配图方案由服务端加载 Skill；本地模拟不调用模型。生成图片需人工检查，公众号同步尚未开放。">
    Kairo Layout · Kairo Design
    {status?.githubUrl && <> · <a href={status.githubUrl} target="_blank" rel="noopener noreferrer">GitHub ↗</a></>}
    {status && !status.guest.persistentCredentials && ' · API 安全保存待配置'}
  </span>;
}
