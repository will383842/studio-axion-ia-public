/**
 * Image de CONTRÔLE (pas un rendu Remotion) : 1080×1920, vraie prise (D0), vraie police Montserrat 900, mot long « ACCOMPAGNEMENT » à la taille calculée
 * par `SousTitresV4` (corps 74, mesuré) + pile de 3 bulles aux cotes de `PileNotifications` ; contours des zones protégées TikTok / Reels / Shorts par-dessus.
 * Usage : node image-controle.mjs  →  controle-mot-long-bulles.png (dans ce dossier)
 */
import { chromium } from "/home/user/studio-axion-ia/node_modules/@playwright/test/index.mjs";
import fs from "node:fs";
const V4 = "/home/user/studio-axion-ia/studio-rendu/compositions/interface-claire/motion-v4/";
const b64 = (f) => fs.readFileSync(f).toString("base64");
const W = 1080, H = 1920, CORPS = 74, BH = 116, BW = 940, DECAL = 0.052 * H, YBAS = 0.7 * H - BH - 5 - 6;
// Largeur mesurée du mot à corps 74 (813 px) ; même décalage que `bordGaucheSousTitres` : centré s'il tient jusqu'à 0,82 L, sinon décalé à gauche (min 0,06 L).
const LARGEUR = 813, LEFT = Math.max(0.06 * W, Math.min(W / 2, 0.82 * W - LARGEUR / 2) - LARGEUR / 2);
const zones = [["TikTok", 10, 18, 26, 4, "#25F4EE"], ["Reels", 14, 16, 30, 6, "#E1306C"], ["Shorts", 10, 16, 20, 4, "#FF0000"]];
const rect = ([n, h, d, b, g, c]) => `<div style="position:absolute;left:${g / 100 * W}px;top:${h / 100 * H}px;width:${W * (1 - (g + d) / 100)}px;height:${H * (1 - (h + b) / 100)}px;border:4px dashed ${c};box-sizing:border-box"><span style="position:absolute;left:6px;top:${n === "TikTok" ? 6 : n === "Reels" ? 34 : 62}px;font:700 24px sans-serif;color:${c};background:#000a;padding:0 6px">${n}</span></div>`;
const bulles = [["Relance envoyée", 2], ["Le client répond", 1], ["Devis signé", 0]].map(([t, r]) => `<div style="position:absolute;left:${(W - BW) / 2}px;top:${YBAS - DECAL * r}px;width:${BW}px;height:${BH}px;box-sizing:border-box;background:#fff;border:5px solid #110A05;border-radius:18px;box-shadow:5px 6px 0 #110A05;display:flex;align-items:center;gap:28px;padding:0 30px;transform:scale(${1 - 0.04 * r})"><div style="width:84px;height:84px;border-radius:50%;background:#F07C3E;border:5px solid #110A05;flex:none"></div><div style="font:800 46px sans-serif;color:#110A05">${t}</div></div>`).join("");
const html = `<style>@font-face{font-family:M;font-weight:900;src:url(data:font/woff2;base64,${b64(V4 + "lot5/polices/Montserrat-900-latin.woff2")})}body{margin:0}</style>
<div style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:url(data:image/png;base64,${b64(V4 + "communs/prise-commune-1080x1920.png")}) 0 0/${W}px ${H}px">
<div style="position:absolute;left:${LEFT}px;top:${0.174 * H - CORPS / 2}px;font:900 ${CORPS}px/1 M;letter-spacing:.01em;color:#fff;-webkit-text-stroke:${0.14 * CORPS}px #110A05;paint-order:stroke fill;white-space:nowrap">ACCOMPAGNEMENT</div>
${bulles}${zones.map(rect).join("")}</div>`;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.setContent(html); await p.evaluate(() => document.fonts.load("900 74px M")); await p.waitForTimeout(300);
await p.screenshot({ path: new URL("./controle-mot-long-bulles.png", import.meta.url).pathname });
await b.close();
