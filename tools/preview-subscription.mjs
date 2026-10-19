// Render the real presentation component using HTML primitives for design review.
// This preview does not execute StoreKit and is not a native-device acceptance test.
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

const output = "/private/tmp/matriva-subscription-preview";
await mkdir(output, { recursive: true });
await build({
  entryPoints: ["apps/mobile/src/screens/SubscriptionView.tsx"], bundle: true, platform: "node", format: "esm",
  outfile: `${output}/view.mjs`, packages: "external", jsx: "automatic",
  plugins: [{ name: "native-preview", setup(b) {
    b.onResolve({ filter: /^file:/ }, args => ({ path: args.path, external: true }));
    b.onResolve({ filter: /^react-native$/ }, () => ({ path: "native", namespace: "preview" }));
    b.onLoad({ filter: /.*/, namespace: "preview" }, () => ({ contents: `
      import React from ${JSON.stringify(pathToFileURL(`${process.cwd()}/node_modules/react/index.js`).href)};
      const flatten = v => Array.isArray(v) ? Object.assign({}, ...v.filter(Boolean).map(flatten)) : (v || {});
      const css = v => { const result = {...flatten(v)}; if (typeof result.lineHeight === 'number') result.lineHeight += 'px'; return result; };
      export const StyleSheet = { create: value => value };
      export const View = ({children,style}) => React.createElement('div',{style:{display:'flex',flexDirection:'column',boxSizing:'border-box',minWidth:0,...css(style)}},children);
      export const Text = ({children,style}) => React.createElement('span',{style:{whiteSpace:'pre-wrap',...css(style)}},children);
      export const Pressable = ({children,style,disabled,accessibilityLabel}) => React.createElement('button',{disabled,'aria-label':accessibilityLabel,style:{display:'flex',flexDirection:'column',border:0,background:'transparent',font:'inherit',textAlign:'left',boxSizing:'border-box',...css(typeof style === 'function' ? style({pressed:false}) : style)}},children);
      export const ActivityIndicator = () => React.createElement('span',null,'◌');
    ` }));
  }}]
});
// Resolve React from the workspace, also when output is outside the repository.
const { readFile } = await import("node:fs/promises");
let compiled = await readFile(`${output}/view.mjs`, "utf8");
compiled = compiled.replaceAll('from "react/jsx-runtime"', `from ${JSON.stringify(pathToFileURL(`${process.cwd()}/node_modules/react/jsx-runtime.js`).href)}`);
await writeFile(`${output}/view.mjs`, compiled);
const { SubscriptionView } = await import(pathToFileURL(`${output}/view.mjs`).href);
const free = { plan: "free", configuredPlan: "free", accessPlan: "free", status: "free", source: "default", complimentaryProGrant: null, features: {}, evaluatedAt: new Date().toISOString(), usage: { houses: { active: 1, limit: 1 }, documents: { active: 1, limit: 2, storageBytes: 0, storageLimitBytes: 10485760 }, tasks: { active: 3, limit: 4 } } };
const paid = { ...free, plan: "pro", configuredPlan: "pro", accessPlan: "pro", status: "active", source: "billing", expiresAt: new Date(Date.now() + 86400000).toISOString(), usage: { houses: { active: 2, limit: null }, documents: { active: 8, limit: null, storageBytes: 0, storageLimitBytes: null }, tasks: { active: 6, limit: null } } };
const states = { free, pro: paid, complimentary: { ...paid, source: "complimentary", expiresAt: undefined }, expired: { ...free, source: "billing", status: "expired" }, billingIssue: { ...free, source: "billing", status: "billing_issue" } };
const noop = () => {};
const render = state => renderToStaticMarkup(React.createElement(SubscriptionView, { entitlements: state, price: "59,00 kr.", ios: true, connected: true, checking: false, verified: true, busy: false, message: null, onBack: noop, onBuy: noop, onRestore: noop, onManage: noop, onRefresh: noop, onRetryStore: noop }));
for (const [name, state] of Object.entries(states)) {
  const html = render(state);
  if (name === "pro" && (html.includes("Få Matriva PRO") || !html.includes("Administrer abonnement"))) throw new Error("Active PRO has incorrect actions");
  if (name === "free" && (!html.includes("Få Matriva PRO") || html.includes("Administrer abonnement"))) throw new Error("Free has incorrect actions");
  if (name === "complimentary" && (html.includes("Få Matriva PRO") || html.includes("Administrer abonnement"))) throw new Error("Complimentary access must not imply a store subscription");
  if (name === "billingIssue" && (html.includes("Få Matriva PRO") || !html.includes("Administrer abonnement"))) throw new Error("Payment issues must direct users to management, not repurchase");
  await writeFile(`${output}/${name}.html`, `<!doctype html><html lang="da"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Matriva abonnement · ${name}</title><style>body{margin:0;background:#F3F6F4;color:#173D32;font-family:system-ui,-apple-system,sans-serif}main{max-width:390px;margin:auto;padding:20px;box-sizing:border-box}button{cursor:pointer}</style><main>${html}</main></html>`);
}
await writeFile(`${output}/index.html`, `<!doctype html><html lang="da"><meta charset="utf-8"><title>Matriva · abonnement</title><style>body{background:#e4eae5;font:16px system-ui;margin:24px;color:#173d32}h1{font-size:22px}.screens{display:flex;gap:28px;flex-wrap:wrap}iframe{border:1px solid #c4d2c8;border-radius:28px;width:390px;height:1040px;background:#f3f6f4}h2{font-size:15px}a{color:inherit}</style><h1>Abonnement · designforhåndsvisning</h1><p>Den implementerede visning med eksempeldata. Apple-køb afvikles kun i appen.</p><div class="screens"><section><h2>Med PRO</h2><iframe title="Med PRO" src="pro.html"></iframe></section><section><h2>Uden abonnement</h2><iframe title="Uden abonnement" src="free.html"></iframe></section></div><p><a href="complimentary.html">Gratis PRO</a> · <a href="expired.html">Udløbet PRO</a></p></html>`);
console.log(`Preview generated in ${output}; Free/PRO action assertions passed.`);
