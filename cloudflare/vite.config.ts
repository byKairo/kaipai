import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { createHash } from "node:crypto";
import { patchCssModules } from "vite-css-modules";
import path from "node:path";

export default defineConfig({
  plugins: [
    patchCssModules({ exportMode: "default" }),
    {
      // Vite's dynamic-import helper only checks <link>; vinext emits <style>.
      // Reuse an exact inline stylesheet instead of downloading it a second time
      // and blocking hydration. Deferred styles still use Vite's normal loader.
      name: "kaipai-reuse-inline-css",
      apply: "build",
      enforce: "post",
      transform(source, id) {
        if (id !== "\0vite/preload-helper.js") return;
        const marker = "const isCss = isCssPreloadUrl(dep);";
        if (!source.includes(marker)) throw new Error("Vite CSS preload helper changed; review inline CSS reuse");
        return { code: source.replace(marker, `${marker}
          if (isCss && Array.from(document.querySelectorAll('style[data-vinext-inline-css][data-href]')).some(style =>
            (style.getAttribute('data-href') || '').split(/\\s+/).some(href => new URL(href, document.baseURI).href === dep.href)
          )) return;
        `), map: null };
      },
    },
    // Keep first paint independent of a second CSS download on slow routes.
    // This setting applies only to the Workers build; local Next.js stays unchanged.
    vinext({ nextConfig: { reactStrictMode: true, experimental: { inlineCss: true } } }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  environments: {
    client: {
      define: { 'process.env.NEXT_PUBLIC_KAIPAI_OFFLINE': JSON.stringify('1') },
      build: {
        rolldownOptions: {
          output: {
            codeSplitting: {
              minSize: 16_000,
              groups: [{
                name: 'shared',
                includeDependenciesRecursively: true,
                test: (id: string) => /node_modules\/(?:react(?:-dom|-server-dom-webpack)?|vinext)\//.test(id) || id.includes('rolldown/runtime') || /\/lib\/(?:assets|credential-format|ai-transport|wechat-html)\.ts$/.test(id),
              }],
            },
          },
        },
      },
    },
  },
  css: {
    modules: {
      generateScopedName(name: string, filename: string) {
        const relativePath = path.relative(import.meta.dirname, filename.replace(/\?.*$/, "")).replaceAll("\\", "/");
        return `_${name}_${createHash("sha256").update(relativePath).digest("hex").slice(0, 7)}`;
      },
    },
  },
});
