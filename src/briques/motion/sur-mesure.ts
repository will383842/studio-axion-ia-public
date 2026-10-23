/**
 * CARTE SUR MESURE (brique `motion`, plan v4 B.10 et correctif du 09/10) : HTML, CSS et timeline GSAP écrits par
 * Claude, affichés dans une iframe ISOLÉE (sandbox sans même origine, politique de sécurité sans aucune adresse :
 * pas de réseau), polices, GSAP et Three.js locaux, timeline calée sur l'image Remotion par `tl.seek(image / 25)`.
 *
 * Ce fichier est PUR (sans React, sans alias « @/ ») : il contrôle le code (garde-fous) et construit le document de
 * l'iframe. Les bibliothèques (chaînes de plusieurs centaines de Ko) sont passées en argument par la composition.
 *
 * Garde-fous (refus → repli sur le modèle fixe) : 3 à 8 s ; aucune adresse ni API réseau ; rien qui dépende de
 * l'horloge (CSS animé, minuteries, `Math.random`, `Date`) : chaque image doit se recalculer depuis `t` seul ;
 * couleurs de la charte seulement ; Poppins seulement ; texte d'au moins 3 % de la hauteur ; zones sûres (contrôlées
 * à l'image par le mode `controle`, relue par Claude).
 */
import { DUREE_CARTE_SEC } from "./catalogue";
import { COULEURS_PERMISES, FPS_MOTION, TAILLE_TEXTE_MIN, variablesCss, ZONES_SURES, type RatioMotion } from "./jetons";

export interface CodeSurMesure {
  html: string;
  css: string;
  js: string;
  troisD?: boolean;
}

export interface VerdictSurMesure {
  ok: boolean;
  /** Raisons du refus, en français simple (reprises dans la demande de correction à Claude). */
  erreurs: string[];
  /** Points à surveiller sans refus. */
  avertissements: string[];
}

/** Taille maximale du code (HTML + CSS + JS) : une carte, pas une application. */
export const TAILLE_MAX_CODE = 60_000;

const INTERDITS: { motif: RegExp; raison: string }[] = [
  { motif: /\b(?:https?|wss?|ftp):\/\//i, raison: "aucune adresse web (tout est local)" },
  { motif: /\/\/[a-z0-9-]+\.[a-z]{2,}\//i, raison: "aucune adresse web (tout est local)" },
  { motif: /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|RTCPeerConnection/, raison: "aucun accès réseau" },
  { motif: /\bimport\s*\(|\bimportScripts\b|<\s*script\b|<\s*link\b|<\s*iframe\b|<\s*object\b|<\s*embed\b|@import\b/i, raison: "aucun chargement de fichier ou de script externe" },
  { motif: /\beval\s*\(|new\s+Function\b|\bFunction\s*\(/, raison: "pas d'évaluation de code" },
  { motif: /\b(?:localStorage|sessionStorage|indexedDB|document\.cookie|window\.parent|window\.top|\btop\.|\bparent\.|opener)\b/, raison: "la carte ne sort pas de son cadre" },
  { motif: /\b(?:setTimeout|setInterval|requestAnimationFrame|performance\.now|Date\.now|new\s+Date\b)/, raison: "rien ne doit dépendre de l'horloge : tout passe par la timeline (tl.seek)" },
  { motif: /\bMath\.random\b/, raison: "pas de hasard non reproductible : utiliser AXION.hasard(n)" },
  { motif: /\.play\s*\(\s*\)|repeat\s*:\s*-1|yoyo\s*:\s*true.*repeat\s*:\s*-1/, raison: "la timeline reste en pause et finie (pas de lecture ni de répétition infinie)" },
];

const INTERDITS_CSS: { motif: RegExp; raison: string }[] = [
  { motif: /@keyframes|(?:^|[;{\s])animation\s*:|(?:^|[;{\s])animation-name\s*:|(?:^|[;{\s])transition\s*:/i, raison: "pas d'animation CSS : tout passe par la timeline GSAP" },
  { motif: /url\s*\(\s*['"]?(?!data:|#)/i, raison: "aucun fichier externe dans le CSS" },
];

/** Couleurs écrites dans le code (#hex, rgb()), ramenées en #rrggbb minuscule. */
export function couleursDuCode(code: string): string[] {
  const vues = new Set<string>();
  for (const m of code.matchAll(/#([0-9a-f]{3,8})\b/gi)) {
    let h = m[1].toLowerCase();
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).replace(/./g, (c) => c + c);
    if (h.length === 8) h = h.slice(0, 6);
    if (h.length === 6) vues.add(`#${h}`);
  }
  for (const m of code.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi)) {
    vues.add(`#${[m[1], m[2], m[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, "0")).join("")}`);
  }
  return [...vues];
}

/** Couleurs du code hors charte (le noir et le blanc purs compris). Les variables `var(--axion-…)` sont la voie normale. */
export function couleursHorsCharte(code: string): string[] {
  return couleursDuCode(code).filter((c) => !COULEURS_PERMISES.includes(c));
}

/**
 * Contrôle statique d'une carte sur mesure. `hauteurVideo` sert au plancher des tailles de texte écrites en px
 * (3 % de la hauteur) ; les tailles calculées sont contrôlées à l'image (mode `controle`).
 */
export function verifierSurMesure(code: CodeSurMesure, dureeSec: number, hauteurVideo = 1920): VerdictSurMesure {
  const erreurs: string[] = [];
  const avertissements: string[] = [];
  const tout = `${code.html}\n${code.css}\n${code.js}`;
  if (dureeSec < DUREE_CARTE_SEC.min - 1e-6 || dureeSec > DUREE_CARTE_SEC.max + 1e-6) erreurs.push(`durée de ${DUREE_CARTE_SEC.min} à ${DUREE_CARTE_SEC.max} s (reçu ${dureeSec.toFixed(1)} s)`);
  if (tout.length > TAILLE_MAX_CODE) erreurs.push(`code trop long (${tout.length} caractères, ${TAILLE_MAX_CODE} au plus)`);
  if (!code.js.trim()) erreurs.push("aucune timeline : le code doit construire une timeline GSAP en pause et l'enregistrer (AXION.enregistrer(tl))");
  else if (!/AXION\s*\.\s*enregistrer\s*\(/.test(code.js)) avertissements.push("timeline non enregistrée par AXION.enregistrer(tl) : toutes les animations GSAP seront regroupées d'office");
  for (const { motif, raison } of INTERDITS) if (motif.test(tout) && !erreurs.includes(raison)) erreurs.push(raison);
  for (const { motif, raison } of INTERDITS_CSS) if (motif.test(code.css) && !erreurs.includes(raison)) erreurs.push(raison);
  if (/<\s*style\b/i.test(code.html) || /\bstyle\s*=\s*["'][^"']*(?:animation|transition)\s*:/i.test(code.html)) erreurs.push("pas de style animé dans le HTML : le CSS va dans le champ CSS");
  if (/\bon[a-z]+\s*=/i.test(code.html)) erreurs.push("pas de gestionnaire d'événement dans le HTML");
  const hors = couleursHorsCharte(tout);
  if (hors.length) erreurs.push(`couleurs hors charte : ${hors.slice(0, 6).join(", ")} (utiliser var(--axion-orange), var(--axion-creme)…)`);
  for (const m of tout.matchAll(/font-family\s*:\s*([^;"}]+)/gi)) {
    const f = m[1].toLowerCase();
    if (!/var\(--axion-police\)|poppins/.test(f) || /serif(?!-)|monospace|arial|helvetica|inter\b|roboto/.test(f.replace(/sans-serif/g, ""))) {
      erreurs.push("police : Poppins seulement (font-family: var(--axion-police))");
      break;
    }
  }
  const plancher = Math.ceil(TAILLE_TEXTE_MIN * hauteurVideo);
  for (const m of tout.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)) {
    if (Number(m[1]) < plancher) {
      erreurs.push(`texte trop petit (${m[1]} px) : ${plancher} px au moins (3 % de la hauteur)`);
      break;
    }
  }
  for (const m of tout.matchAll(/fontSize\s*:\s*["']?(\d+(?:\.\d+)?)(?:px)?["']?/g)) {
    if (Number(m[1]) < plancher) {
      erreurs.push(`texte trop petit (${m[1]} px) : ${plancher} px au moins (3 % de la hauteur)`);
      break;
    }
  }
  if (code.troisD && !/THREE\./.test(code.js)) avertissements.push("3D demandée mais Three.js n'est pas utilisé");
  if (/THREE\./.test(code.js) && !code.troisD) erreurs.push("Three.js utilisé sans le demander (troisD: true)");
  if (/THREE\./.test(code.js) && !/AXION\s*\.\s*surImage\s*\(/.test(code.js)) erreurs.push("3D : le rendu de la scène doit passer par AXION.surImage(t => renderer.render(scene, camera))");
  return { ok: erreurs.length === 0, erreurs, avertissements };
}

/** Une balise </script> ou </style> dans le code fermerait son bloc : on l'échappe. */
const echapperScript = (js: string) => js.replace(/<\/script/gi, "<\\/script");
const echapperStyle = (css: string) => css.replace(/<\/style/gi, "<\\/style");

/** Politique de sécurité de l'iframe : AUCUNE adresse (ni réseau, ni fichier) ; seuls le code et les `data:` en ligne. */
export const POLITIQUE_IFRAME = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data: blob:; media-src 'none'; connect-src 'none'; frame-src 'none'; worker-src 'none'; child-src 'none'; form-action 'none'; base-uri 'none'";

export interface BibliothequesIframe {
  gsap: string;
  troisD: string;
  polices: string;
}

export interface ParametresDocument extends CodeSurMesure {
  largeur: number;
  hauteur: number;
  hauteurVideo: number;
  ratio: RatioMotion;
  dureeSec: number;
  /** Mode contrôle : zones sûres dessinées, texte trop petit ou hors zone encadré en rouge (image relue par Claude). */
  controle?: boolean;
}

/**
 * Document HTML complet de l'iframe (attribut `srcdoc`). Protocole avec la composition (postMessage) :
 *   iframe → parent : `{ type: "pret", erreurs }` une fois les polices chargées et le code exécuté ;
 *   parent → iframe : `{ type: "seek", t, id }` ; iframe → parent : `{ type: "vu", id, erreurs }` après deux images.
 * Le code de Claude reçoit `gsap`, `racine` (#carte), `AXION` et `THREE` (si demandé) ; il n'a accès à rien d'autre.
 */
export function documentSurMesure(p: ParametresDocument, b: BibliothequesIframe): string {
  const vars = Object.entries(variablesCss(p.largeur, p.hauteurVideo))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  const z = ZONES_SURES[p.ratio];
  const zone = {
    x: Math.round(z.gauche * p.largeur),
    y: Math.round(z.haut * p.hauteurVideo),
    largeur: Math.round(p.largeur * (1 - z.gauche - z.droite)),
    hauteur: Math.round((p.hauteur === p.hauteurVideo ? p.hauteurVideo * (1 - z.bas) : p.hauteur - 0.035 * p.hauteurVideo) - z.haut * p.hauteurVideo),
  };
  const axion = {
    largeur: p.largeur,
    hauteur: p.hauteur,
    hauteurVideo: p.hauteurVideo,
    fps: FPS_MOTION,
    duree: p.dureeSec,
    zone,
    tailleMin: Math.ceil(TAILLE_TEXTE_MIN * p.hauteurVideo),
  };
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${POLITIQUE_IFRAME}">
<style>${b.polices}</style>
<style>:root{${vars}}
html,body{margin:0;padding:0;width:${p.largeur}px;height:${p.hauteur}px;overflow:hidden;background:transparent;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
body{font-family:var(--axion-police);color:var(--axion-creme)}
#carte{position:relative;width:${p.largeur}px;height:${p.hauteur}px;overflow:hidden}
#controle{position:absolute;inset:0;pointer-events:none;z-index:2147483647}</style>
<style>${echapperStyle(p.css)}</style>
</head><body><div id="carte">${p.html}</div>${p.controle ? '<div id="controle"></div>' : ""}
<script>${b.gsap}</script>
${p.troisD ? `<script>${b.troisD}</script>\n<script>(function(){if(!window.THREE)return;var R=THREE.WebGLRenderer;function A(o){return new R(Object.assign({antialias:true,preserveDrawingBuffer:true,alpha:true},o||{}))}A.prototype=R.prototype;THREE.WebGLRenderer=A;})();</script>` : ""}
<script>(function(){
var A=${JSON.stringify(axion)};
A._erreurs=[];A._tl=null;A._images=[];
window.addEventListener("error",function(e){A._erreurs.push(String(e.message||e))});
A.enregistrer=function(t){A._tl=t;t.pause(0);return t};
A.surImage=function(f){if(typeof f==="function")A._images.push(f)};
A.hasard=function(n){var x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)};
window.AXION=A;
try{gsap.registerPlugin(CustomEase,DrawSVGPlugin,MorphSVGPlugin,MotionPathPlugin,SplitText)}catch(e){A._erreurs.push("plugins: "+e.message)}
gsap.ticker.lagSmoothing(0);
})();</script>
<script>(function(gsap,racine,AXION,THREE){"use strict";
${echapperScript(p.js)}
})(window.gsap,document.getElementById("carte"),window.AXION,window.THREE);</script>
<script>(function(){
var A=window.AXION;
// La timeline enregistrée par le code ; sinon toutes ses animations GSAP regroupées (en pause).
var tl=A._tl;
if(!tl){tl=gsap.exportRoot();tl.pause(0)}
gsap.globalTimeline.pause();
function controle(){var c=document.getElementById("controle");if(!c)return;c.innerHTML="";
var z=A.zone;var cadre=document.createElement("div");cadre.style.cssText="position:absolute;left:"+z.x+"px;top:"+z.y+"px;width:"+z.largeur+"px;height:"+z.hauteur+"px;outline:3px dashed rgba(246,238,224,.55)";c.appendChild(cadre);
var marche=document.createTreeWalker(document.getElementById("carte"),NodeFilter.SHOW_TEXT);var n;
while((n=marche.nextNode())){if(!n.textContent.trim())continue;var el=n.parentElement;var st=getComputedStyle(el);if(st.visibility==="hidden"||st.display==="none")continue;
var o=1,e=el;while(e&&e!==document.body){o*=parseFloat(getComputedStyle(e).opacity||"1");e=e.parentElement}if(o<0.05)continue;
var r=document.createRange();r.selectNodeContents(n);var b=r.getBoundingClientRect();if(!b.width)continue;
var petit=parseFloat(st.fontSize)<A.tailleMin;var dehors=b.left<z.x-1||b.top<z.y-1||b.right>z.x+z.largeur+1||b.bottom>z.y+z.hauteur+1;
if(petit||dehors){var m=document.createElement("div");m.style.cssText="position:absolute;left:"+b.left+"px;top:"+b.top+"px;width:"+b.width+"px;height:"+b.height+"px;outline:4px solid #ff2a2a;background:rgba(255,42,42,.18)";c.appendChild(m)}}}
window.addEventListener("message",function(ev){var d=ev.data||{};if(d.type!=="seek")return;
try{tl.seek(Math.max(0,d.t),false);for(var k=0;k<A._images.length;k++)A._images[k](d.t);controle()}catch(e){A._erreurs.push(String(e.message||e))}
requestAnimationFrame(function(){requestAnimationFrame(function(){parent.postMessage({type:"vu",id:d.id,erreurs:A._erreurs.slice(0,5)},"*")})})});
document.fonts.ready.then(function(){parent.postMessage({type:"pret",erreurs:A._erreurs.slice(0,5),duree:tl.duration()},"*")});
})();</script>
</body></html>`;
}
