import { chromium } from "/home/user/studio-axion-ia/node_modules/@playwright/test/index.mjs";
import fs from "node:fs";
const dir = "/home/user/studio-axion-ia/studio-rendu/compositions/interface-claire/motion-v4/lot5/polices/";
const b64 = (f) => fs.readFileSync(dir + f).toString("base64");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
const p = await b.newPage();
await p.setContent(`<style>@font-face{font-family:M;font-weight:900;src:url(data:font/woff2;base64,${b64("Montserrat-900-latin.woff2")})}</style><span style="font:900 20px M">x</span>`);
const r = await p.evaluate(async () => {
  await document.fonts.load("900 84px M");
  const c = document.createElement("canvas").getContext("2d");
  const lt = (t, k) => { c.font = `900 ${k}px M`; return c.measureText(t.toUpperCase()).width + t.length * 0.01 * k; };
  const MAX = 0.76 * 1080, T = 5;
  const out = {};
  for (const [nom, mots, fort] of [["accompagnement", ["accompagnement"], [false]], ["administratives", ["administratives"], [false]], ["accompagnement(plaque)", ["accompagnement"], [true]], ["administratives(plaque)", ["administratives"], [true]], ["2 mots", ["accompagnement", "administratives"], [false, false]], ["2 mots plaques", ["accompagnement", "administratives"], [true, true]]]) {
    const lp = (k) => mots.reduce((s, m, i) => s + lt(m, k) + (fort[i] ? 0.48 * k + 2 * T : 0), 0) + 0.32 * k * (mots.length - 1);
    let k = 84; while (k > 48 && lp(k) > MAX) k -= 2;
    out[nom] = { l84: Math.round(lp(84)), corpsFinal: k, largeurFinale: Math.round(lp(k)), max: MAX, tient: lp(k) <= MAX };
  }
  return out;
});
console.log(JSON.stringify(r, null, 1)); await b.close();
