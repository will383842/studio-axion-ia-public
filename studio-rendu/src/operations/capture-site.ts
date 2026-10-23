/**
 * Opération `capture-site` (file longue, « Source axion-ia.com ») : le navigateur sans affichage de Remotion (déjà
 * dans l'image) photographie ou filme UNE page publique du site axion-ia.com, puis dépose le résultat à `sortie.urlDepot`.
 *
 * Entrée : `page` (adresse https://axion-ia.com/…, SEULEMENT ce site : le conteneur est sur le réseau interne, il ne
 * doit jamais servir à lire autre chose). Paramètres :
 *  - `type: "image"`  + `format` (« 9:16 » | « 16:9 » | « 1:1 ») → JPEG 1080 × 1920, 1920 × 1080 ou 1080 × 1080 ;
 *  - `type: "video"`  + `format` + `mouvement` (« defilement » : défilement doux ; « survol » : la flèche va se poser
 *    sur une offre, appui visible, sans clic) + `dureeSec` (4 à 8) + `cible` facultative (texte du lien à survoler)
 *    → MP4 H.264 30 images/s, sans son ;
 *  - `type: "page-entiere"` + `format` → JPEG de toute la page, 1080 px de large, hauteur plafonnée à 12 000 px ;
 *  - `type: "video"` + `mouvement: "frappe"` + `saisies` (1 à 4 champs, désignés par leur identifiant, remplis lettre
 *    par lettre), `cocher` (≤ 3 cases), `survoler` (le bouton : survolé, JAMAIS cliqué) → MP4. Aucun envoi ne part :
 *    garde en deux couches (hôtes de mesure bloqués par le navigateur, script posé avant le chargement qui neutralise
 *    tout envoi autre que GET/HEAD/OPTIONS et annule toute soumission). Le formulaire filmé est celui de la production ;
 *  - `sansMesure: true` (facultatif) : la visite n'est pas comptée (plausible_ignore, hôtes de mesure bloqués).
 * Les mesures rendent toujours `mouvement` (0 défilement, 1 survol, 2 frappe) : un rendu ancien, qui ramènerait la
 * frappe au défilement, se voit.
 * Les images de la vidéo sont prises une à une (position calculée pour chaque image) : le mouvement est toujours
 * régulier, quelle que soit la vitesse du processeur.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ErreurRendu, type Operation } from "../contrat.js";
import { deposer, executer, FFMPEG } from "../outils.js";

/** Seuls hôtes que le conteneur accepte de photographier. */
export const HOTES_CAPTURE = ["axion-ia.com", "www.axion-ia.com"];

export type FormatCapture = "9:16" | "16:9" | "1:1";

/** Fenêtre du navigateur (px CSS) et échelle : 9:16 en mise en page téléphone, 16:9 en ordinateur, 1:1 en tablette. */
export const FENETRES: Record<FormatCapture, { largeur: number; hauteur: number; echelle: number; mobile: boolean }> = {
  "9:16": { largeur: 432, hauteur: 768, echelle: 2.5, mobile: true },
  "16:9": { largeur: 1280, hauteur: 720, echelle: 1.5, mobile: false },
  "1:1": { largeur: 720, hauteur: 720, echelle: 1.5, mobile: false },
};

export const IMAGES_PAR_SECONDE = 30;

/** Hôtes de mesure d'audience bloqués en frappe et avec `sansMesure`. */
export const HOTES_MESURE = ["plausible.io", "google-analytics.com", "googletagmanager.com", "connect.facebook.net", "clarity.ms"];

/** Page entière : largeur rendue et hauteur maximale (px). */
export const PAGE_ENTIERE = { largeur: 1080, hauteurMax: 12_000 };

/** Frappe : images par lettre, par case cochée ; défilement vers le premier champ, trajet de la flèche, tenue finale. */
export const FRAPPE = { parLettre: 2, parCase: 6, defilement: 30, trajet: 24, tenue: 15 };

const CODE_MOUVEMENT = { defilement: 0, survol: 1, frappe: 2 } as const;
const IDENTIFIANT = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;

export interface Saisie {
  champ: string;
  texte: string;
}

export interface ParametresCapture {
  type: "image" | "video" | "page-entiere";
  format: FormatCapture;
  mouvement: "defilement" | "survol" | "frappe";
  dureeSec: number;
  cible?: string;
  saisies?: Saisie[];
  cocher?: string[];
  survoler?: string;
  sansMesure?: boolean;
}

/** Adresse acceptée : https, hôte axion-ia.com, sans identifiants ni port. PUR. */
export function adresseAutorisee(adresse: string): boolean {
  let u: URL;
  try {
    u = new URL(adresse);
  } catch {
    return false;
  }
  return u.protocol === "https:" && HOTES_CAPTURE.includes(u.hostname) && !u.port && !u.username && !u.password;
}

const refus = (message: string) => new ErreurRendu({ code: "refuse", reessayable: false, message });

function identifiant(x: unknown, quoi: string): string {
  if (typeof x !== "string" || !IDENTIFIANT.test(x)) throw refus(`Identifiant de ${quoi} invalide.`);
  return x;
}

/** Frappe : saisies (1 à 4, texte ≤ 60 caractères, sans caractère de commande : aucune touche Entrée), cases, bouton. */
function lireFrappe(p: Record<string, unknown>): Pick<ParametresCapture, "saisies" | "cocher" | "survoler"> {
  if (!Array.isArray(p.saisies) || p.saisies.length < 1 || p.saisies.length > 4) throw refus("Frappe : 1 à 4 saisies.");
  const saisies = p.saisies.map((s: unknown) => {
    const x = (s ?? {}) as Record<string, unknown>;
    const texte = x.texte;
    if (typeof texte !== "string" || !texte || [...texte].length > 60 || /[\u0000-\u001f\u007f]/.test(texte)) throw refus("Frappe : texte invalide.");
    return { champ: identifiant(x.champ, "champ"), texte };
  });
  if (p.cocher !== undefined && (!Array.isArray(p.cocher) || p.cocher.length > 3)) throw refus("Frappe : 3 cases au plus.");
  const cocher = Array.isArray(p.cocher) ? p.cocher.map((c: unknown) => identifiant(c, "case")) : [];
  return { saisies, ...(cocher.length ? { cocher } : {}), ...(p.survoler !== undefined ? { survoler: identifiant(p.survoler, "bouton") } : {}) };
}

/** Paramètres relus et bornés (forme seulement). PUR. */
export function lireParametres(p: Record<string, unknown>): ParametresCapture {
  const format = p.format === "16:9" || p.format === "1:1" ? p.format : p.format === "9:16" || p.format === undefined ? "9:16" : null;
  if (!format) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Format inconnu." });
  if (p.type !== "image" && p.type !== "video" && p.type !== "page-entiere") throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Type de capture inconnu." });
  if (p.mouvement === "frappe" && p.type !== "video") throw refus("La frappe se filme (type « video »).");
  const duree = Number(p.dureeSec ?? 6);
  return {
    type: p.type,
    format,
    mouvement: p.mouvement === "survol" ? "survol" : p.mouvement === "frappe" ? "frappe" : "defilement",
    dureeSec: Math.max(4, Math.min(8, Number.isFinite(duree) ? duree : 6)),
    ...(typeof p.cible === "string" && p.cible.trim() ? { cible: p.cible.trim().slice(0, 80) } : {}),
    ...(p.mouvement === "frappe" ? lireFrappe(p) : {}),
    ...(p.sansMesure === true ? { sansMesure: true } : {}),
  };
}

/** Courbe douce (départ et arrivée lents). PUR. */
export function douceur(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Positions de défilement, une par image : un court arrêt au début et à la fin (12 % chacun), un défilement doux entre
 * les deux. Toujours croissantes, de 0 à `distance`. PUR.
 */
export function positionsDefilement(images: number, distance: number): number[] {
  const n = Math.max(1, images);
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 1 : i / (n - 1);
    return Math.round(douceur((t - 0.12) / 0.76) * Math.max(0, distance));
  });
}

/** Distance défilée : deux écrans et demi au plus, jamais au-delà du bas de la page. PUR. */
export function distanceDefilement(hauteurPage: number, hauteurFenetre: number): number {
  return Math.max(0, Math.min(hauteurPage - hauteurFenetre, Math.round(hauteurFenetre * 2.5)));
}

export interface PoseImage {
  defilement: number;
  curseur?: { x: number; y: number; appui: number };
}

/**
 * Survol d'une offre (positions dans la page entière) : la page descend jusqu'à mettre la cible au centre (0-45 %),
 * la flèche part du bas à droite et va se poser sur elle (45-85 %), puis l'appui se voit (85-100 %). PUR.
 */
export function posesSurvol(images: number, fenetre: { largeur: number; hauteur: number }, cible: { x: number; y: number }, hauteurPage: number): PoseImage[] {
  const n = Math.max(1, images);
  const arrivee = Math.max(0, Math.min(hauteurPage - fenetre.hauteur, Math.round(cible.y - fenetre.hauteur / 2)));
  const depart = { x: fenetre.largeur * 0.82, y: fenetre.hauteur * 0.86 };
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 1 : i / (n - 1);
    const defilement = Math.round(douceur(t / 0.45) * arrivee);
    const visee = { x: cible.x, y: cible.y - arrivee };
    const k = douceur((t - 0.45) / 0.4);
    const x = Math.round(depart.x + (visee.x - depart.x) * k);
    const y = Math.round(depart.y + (visee.y - depart.y) * k);
    const appui = t <= 0.85 ? 0 : Math.round(Math.min(1, (t - 0.85) / 0.1) * 100) / 100;
    return { defilement, curseur: { x, y, appui } };
  });
}

/* ------------------------------------------------------------------ */
/* Navigateur (Chrome Headless Shell de Remotion)                        */
/* ------------------------------------------------------------------ */

/** Zone photographiée depuis le haut de la page (px CSS), au-delà de la fenêtre ; `echelle` s'ajoute à celle de la fenêtre. */
export interface ZonePage {
  largeur: number;
  hauteur: number;
  echelle: number;
}

/**
 * Ce dont la capture a besoin d'une page de navigateur (remplacé dans les tests). Les trois dernières méthodes sont
 * facultatives : sans elles, la frappe et `sansMesure` sont refusées.
 */
export interface PageCapture {
  ouvrir(url: string, fenetre: (typeof FENETRES)[FormatCapture]): Promise<string>;
  evaluer<T>(expression: string): Promise<T>;
  photographier(zone?: ZonePage): Promise<Buffer>;
  survoler(x: number, y: number): Promise<void>;
  fermer(): Promise<void>;
  /** Insère du texte dans le champ qui a la main (aucune touche, donc jamais Entrée). */
  taper?(texte: string): Promise<void>;
  /** Script exécuté dans chaque document AVANT ses propres scripts. */
  avantChargement?(script: string): Promise<void>;
  /** Adresses que le navigateur refuse de charger (motifs avec « * »). */
  bloquer?(motifs: string[]): Promise<void>;
}

const AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36 studio-axion-ia-capture/1.0";

type Envoi = (methode: string, parametres?: Record<string, unknown>) => Promise<Record<string, unknown>>;

/** Ouvre le navigateur de Remotion (déjà installé dans l'image) et une page pilotée par le protocole DevTools. */
export async function ouvrirNavigateur(): Promise<PageCapture> {
  const { openBrowser } = await import("@remotion/renderer");
  const navigateur = await openBrowser("chrome", { chromiumOptions: { gl: "swangle", userAgent: AGENT }, logLevel: "error" });
  try {
    const page = await navigateur.newPage({ context: () => null, logLevel: "error", indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => undefined });
    const client = page._client();
    // Le protocole complet (le type de Remotion ne déclare qu'une partie des commandes).
    const brut = client.send.bind(client) as unknown as (m: string, p?: Record<string, unknown>) => Promise<{ value: Record<string, unknown> }>;
    const envoyer: Envoi = (m, p) => brut(m, p).then((r) => r.value);
    return {
      async ouvrir(url, f) {
        await envoyer("Emulation.setDeviceMetricsOverride", { width: f.largeur, height: f.hauteur, deviceScaleFactor: f.echelle, mobile: f.mobile });
        await page.goto({ url, timeout: 45_000 });
        return page.url();
      },
      async evaluer<T>(expression: string) {
        const r = (await envoyer("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })) as { result?: { value?: unknown }; exceptionDetails?: { text?: string } };
        if (r.exceptionDetails) throw new ErreurRendu({ code: "inconnu", reessayable: true, message: `Page : ${r.exceptionDetails.text ?? "erreur"}` });
        return r.result?.value as T;
      },
      async photographier(zone) {
        const r = (await envoyer(
          "Page.captureScreenshot",
          zone ? { format: "jpeg", quality: 90, captureBeyondViewport: true, clip: { x: 0, y: 0, width: zone.largeur, height: zone.hauteur, scale: zone.echelle } } : { format: "jpeg", quality: 90 },
        )) as { data: string };
        return Buffer.from(r.data, "base64");
      },
      async survoler(x, y) {
        await envoyer("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      },
      async taper(texte) {
        await envoyer("Input.insertText", { text: texte });
      },
      async avantChargement(script) {
        await envoyer("Page.addScriptToEvaluateOnNewDocument", { source: script });
      },
      async bloquer(motifs) {
        await envoyer("Network.enable");
        await envoyer("Network.setBlockedURLs", { urls: motifs });
      },
      async fermer() {
        await navigateur.close({ silent: true }).catch(() => undefined);
      },
    };
  } catch (e) {
    await navigateur.close({ silent: true }).catch(() => undefined);
    throw e;
  }
}

/** Préparation de la page : barres de défilement cachées, défilement instantané, flèche dessinée par-dessus. */
const PREPARER = `(async () => {
  const s = document.createElement("style");
  s.textContent = "html{scroll-behavior:auto!important;scrollbar-width:none}::-webkit-scrollbar{display:none}#studio-fleche{position:fixed;left:0;top:0;width:30px;height:30px;z-index:2147483647;pointer-events:none;display:none;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35))}#studio-appui{position:fixed;z-index:2147483646;pointer-events:none;border-radius:50%;border:3px solid rgba(255,122,69,.9);display:none}";
  document.head.appendChild(s);
  const f = document.createElement("div");
  f.id = "studio-fleche";
  f.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 2 L4 19 L8.5 14.8 L11.6 21.6 L14.6 20.2 L11.6 13.6 L17.8 13.6 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const a = document.createElement("div");
  a.id = "studio-appui";
  document.body.append(a, f);
  await (document.fonts ? document.fonts.ready : Promise.resolve());
  // Bandeau des témoins : « Refuser » (rien de plus n'est mesuré, et le bandeau ne cache plus la page).
  const refus = Array.from(document.querySelectorAll("button")).find((b) => /^(tout )?refuser$/i.test((b.textContent || "").trim()));
  if (refus) { refus.click(); await new Promise((r) => setTimeout(r, 500)); }
  const h =() => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  // Les images chargées à la demande : on descend une fois, puis on remonte.
  for (let y = 0; y < Math.min(h(), innerHeight * 4); y += Math.round(innerHeight * 0.8)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 1200));
  return { hauteurPage: h(), titre: document.title };
})()`;

/** Cible du survol (centre, en px CSS dans la page entière) : le lien demandé, sinon une carte d'offre ou de formation. */
function chercherCible(cible?: string): string {
  return `(() => {
  const voulu = ${JSON.stringify((cible ?? "").toLowerCase())};
  const offres = /\\/(formations|audit|interventions|implementation|sites-web-augmentes|tarifs)(\\/|$)/;
  const visibles = Array.from(document.querySelectorAll("a[href], button")).filter((e) => {
    const r = e.getBoundingClientRect();
    const st = getComputedStyle(e);
    return r.width >= 60 && r.height >= 28 && st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity) > 0.2;
  });
  const pos = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + scrollY + r.height / 2), haut: r.top + scrollY }; };
  let choisi = voulu ? visibles.find((e) => (e.textContent || "").toLowerCase().includes(voulu)) : undefined;
  if (!choisi) choisi = visibles.find((e) => e.tagName === "A" && offres.test(new URL(e.href, location.href).pathname) && pos(e).haut > innerHeight * 0.3 && pos(e).haut < innerHeight * 3);
  if (!choisi) choisi = visibles.find((e) => pos(e).haut > innerHeight * 0.3 && pos(e).haut < innerHeight * 2.5);
  return choisi ? pos(choisi) : null;
})()`;
}

/** Pose d'une image : défilement et flèche, puis deux images d'affichage pour que la page soit dessinée. */
function poser(p: PoseImage, fenetre: { largeur: number; hauteur: number }): string {
  const c = p.curseur;
  return `(async () => {
  scrollTo(0, ${p.defilement});
  const f = document.getElementById("studio-fleche"), a = document.getElementById("studio-appui");
  if (f) { f.style.display = ${c ? '"block"' : '"none"'}; ${c ? `f.style.transform = "translate(${c.x - 4}px, ${c.y - 2}px) scale(${1 - c.appui * 0.12})";` : ""} }
  if (a) { a.style.display = ${c && c.appui > 0 ? '"block"' : '"none"'}; ${c && c.appui > 0 ? `const t = ${Math.round(16 + c.appui * 22)}; a.style.width = a.style.height = (t * 2) + "px"; a.style.left = (${c.x} - t) + "px"; a.style.top = (${c.y} - t) + "px"; a.style.opacity = "${(1 - c.appui * 0.6).toFixed(2)}";` : ""} }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return ${fenetre.largeur};
})()`;
}

/** Page entière : on descend jusqu'au plafond pour charger les images à la demande, puis on remonte. */
function chargerPageEntiere(hauteurMaxCss: number): string {
  return `(async () => {
  const h = () => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  for (let y = 0; y < Math.min(h(), ${hauteurMaxCss}); y += Math.round(innerHeight * 0.8)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
  scrollTo(0, 0);
  await new Promise((r) => setTimeout(r, 800));
  return h();
})()`;
}

/**
 * Garde d'envoi, posée avant le chargement de chaque document : tout envoi autre que GET/HEAD/OPTIONS (fetch,
 * XMLHttpRequest, sendBeacon, HTMLFormElement.submit) est refusé, toute soumission de formulaire est annulée ; chaque
 * refus est compté dans `window.__studioEnvoisBloques`. N'utilise que `window` (joué tel quel dans les tests).
 */
export const GARDE_ENVOI = `(() => {
  const w = window;
  const sure = (m) => /^(GET|HEAD|OPTIONS)$/i.test(String(m || "GET"));
  let n = 0;
  const bloque = () => { n++; };
  Object.defineProperty(w, "__studioEnvoisBloques", { get: () => n, configurable: false });
  const f = w.fetch;
  if (f) w.fetch = function (entree, init) {
    const m = (init && init.method) || (entree && typeof entree === "object" && entree.method) || "GET";
    if (!sure(m)) { bloque(); return Promise.reject(new TypeError("Envoi bloqué")); }
    return f.apply(this, arguments);
  };
  const X = w.XMLHttpRequest && w.XMLHttpRequest.prototype;
  if (X) {
    const methodes = new WeakMap();
    const ouvrir = X.open, envoyer = X.send;
    X.open = function (m) { methodes.set(this, m); return ouvrir.apply(this, arguments); };
    X.send = function () { if (!sure(methodes.get(this))) { bloque(); return; } return envoyer.apply(this, arguments); };
  }
  if (w.navigator && w.navigator.sendBeacon) w.navigator.sendBeacon = function () { bloque(); return false; };
  const F = w.HTMLFormElement && w.HTMLFormElement.prototype;
  if (F) {
    const soumettre = F.submit;
    F.submit = function () { if (!sure(this.method)) { bloque(); return; } return soumettre.apply(this, arguments); };
  }
  w.addEventListener("submit", (e) => { e.preventDefault(); e.stopImmediatePropagation(); bloque(); }, true);
})();`;

/** Mesure d'audience coupée : Plausible ignore cette visite. */
export const IGNORER_MESURE = `try { localStorage.setItem("plausible_ignore", "true"); } catch (e) {}`;

/** Motifs bloqués par le navigateur : chaque hôte de mesure et ses sous-domaines. */
export function motifsMesure(): string[] {
  return HOTES_MESURE.flatMap((h) => [`*://${h}/*`, `*://*.${h}/*`]);
}

/**
 * Champ de la frappe (marqueur « studio-champ ») : centre vertical dans la page, défilement courant. Avec `viser`, le
 * champ prend la main sans défiler, et la page ne saute que s'il sort de la bande visible (il est alors posé à 35 %).
 */
function champ(id: string, viser: boolean): string {
  return `(() => {
  /* studio-champ */
  const e = document.getElementById(${JSON.stringify(id)});
  if (!e) return null;
  const r0 = e.getBoundingClientRect();
  if (${viser}) {
    if (r0.top < innerHeight * 0.1 || r0.bottom > innerHeight * 0.85) scrollTo(0, Math.max(0, Math.round(r0.top + scrollY - innerHeight * 0.35)));
    e.focus({ preventScroll: true });
  }
  const r = e.getBoundingClientRect();
  return { y: Math.round(r.top + scrollY + r.height / 2), defilement: Math.round(scrollY) };
})()`;
}

/** Case cochée sans clic (marqueur « studio-case ») : valeur posée par le setter natif, puis `input` et `change`. */
function cocherCase(id: string): string {
  return `(() => {
  /* studio-case */
  const e = document.getElementById(${JSON.stringify(id)});
  if (!e || e.tagName !== "INPUT" || (e.type !== "checkbox" && e.type !== "radio")) return null;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked").set.call(e, true);
  e.dispatchEvent(new Event("input", { bubbles: true }));
  e.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
})()`;
}

/** Bouton à survoler (marqueur « studio-bouton ») : centre dans la fenêtre (px CSS). */
function bouton(id: string): string {
  return `(() => {
  /* studio-bouton */
  const e = document.getElementById(${JSON.stringify(id)});
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
})()`;
}

/** Une image d'affichage, pour que la dernière lettre soit dessinée. */
const DESSINER = "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(0))))";

/** Images numérotées → MP4 H.264, 30 images/s, sans son, lecture rapide sur le web. */
export async function encoderVideo(dossierImages: string, chemin: string, largeur: number, hauteur: number): Promise<void> {
  await executer(FFMPEG, [
    "-hide_banner", "-y", "-framerate", String(IMAGES_PAR_SECONDE), "-i", join(dossierImages, "i%05d.jpg"),
    "-vf", `scale=${largeur}:${hauteur}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", "-an", chemin,
  ]);
}

export interface ResultatCapture {
  chemin: string;
  mime: "image/jpeg" | "video/mp4";
  mesures: Record<string, number>;
}

/**
 * Photographie ou filme une page du site dans `dossier`. `ouvrir` est remplacé dans les tests. La page d'arrivée doit
 * rester sur axion-ia.com (une redirection ailleurs est refusée).
 */
export async function capturerPage(url: string, p: ParametresCapture, dossier: string, options: { ouvrir?: () => Promise<PageCapture>; encoder?: typeof encoderVideo; progression?: (pc: number) => void } = {}): Promise<ResultatCapture> {
  if (!adresseAutorisee(url)) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Seules les pages de axion-ia.com peuvent être photographiées." });
  const fenetre = FENETRES[p.format];
  const largeur = Math.round(fenetre.largeur * fenetre.echelle);
  const hauteur = Math.round(fenetre.hauteur * fenetre.echelle);
  const page = await (options.ouvrir ?? ouvrirNavigateur)();
  try {
    const frappe = p.type === "video" && p.mouvement === "frappe";
    if (frappe || p.sansMesure) await poserGardes(page, frappe, !!p.sansMesure);
    let arrivee: string;
    try {
      arrivee = await page.ouvrir(url, fenetre);
    } catch (e) {
      throw new ErreurRendu({ code: "indisponible", reessayable: true, message: `La page ne s'ouvre pas : ${(e as Error).message}` });
    }
    if (!adresseAutorisee(arrivee)) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "La page renvoie hors du site." });
    const { hauteurPage } = await page.evaluer<{ hauteurPage: number }>(PREPARER);
    options.progression?.(20);

    const mouvement = CODE_MOUVEMENT[p.mouvement];

    if (p.type === "image") {
      const chemin = join(dossier, "capture.jpg");
      await writeFile(chemin, await page.photographier());
      return { chemin, mime: "image/jpeg", mesures: { largeur, hauteur, hauteurPage, mouvement } };
    }

    if (p.type === "page-entiere") {
      // Échelle supplémentaire pour rendre 1080 px de large ; hauteur CSS plafonnée pour rester sous 12 000 px.
      const echelle = PAGE_ENTIERE.largeur / largeur;
      const hauteurMaxCss = Math.floor((PAGE_ENTIERE.hauteurMax * fenetre.largeur) / PAGE_ENTIERE.largeur);
      const totale = Math.max(hauteurPage, Number(await page.evaluer<number>(chargerPageEntiere(hauteurMaxCss))) || 0);
      const zone: ZonePage = { largeur: fenetre.largeur, hauteur: Math.min(totale, hauteurMaxCss), echelle };
      const chemin = join(dossier, "capture.jpg");
      await writeFile(chemin, await page.photographier(zone));
      return { chemin, mime: "image/jpeg", mesures: { largeur: PAGE_ENTIERE.largeur, hauteur: Math.round((zone.hauteur * PAGE_ENTIERE.largeur) / fenetre.largeur), hauteurPage: totale, mouvement } };
    }

    if (p.mouvement === "frappe") {
      const r = await filmerFrappe(page, p, fenetre, hauteurPage, dossier, options.progression);
      const chemin = join(dossier, "capture.mp4");
      await (options.encoder ?? encoderVideo)(r.dossierImages, chemin, largeur, hauteur);
      return { chemin, mime: "video/mp4", mesures: { largeur, hauteur, hauteurPage, ...r.mesures, mouvement } };
    }

    const images = Math.round(p.dureeSec * IMAGES_PAR_SECONDE);
    let poses: PoseImage[] = positionsDefilement(images, distanceDefilement(hauteurPage, fenetre.hauteur)).map((defilement) => ({ defilement }));
    let survol = 0;
    if (p.mouvement === "survol") {
      const cible = await page.evaluer<{ x: number; y: number } | null>(chercherCible(p.cible));
      if (cible) {
        poses = posesSurvol(images, fenetre, cible, hauteurPage);
        survol = 1;
      }
    }
    const dossierImages = join(dossier, "images");
    await mkdir(dossierImages, { recursive: true });
    for (let i = 0; i < poses.length; i++) {
      const pose = poses[i];
      await page.evaluer(poser(pose, fenetre));
      // Survol réel (styles :hover) dès que la flèche a presque atteint sa cible.
      if (pose.curseur && i > 0 && poses[i - 1].curseur && (pose.curseur.appui > 0 || i === poses.length - 1)) await page.survoler(pose.curseur.x, pose.curseur.y);
      await writeFile(join(dossierImages, `i${String(i).padStart(5, "0")}.jpg`), await page.photographier());
      options.progression?.(20 + Math.round((i / poses.length) * 65));
    }
    const chemin = join(dossier, "capture.mp4");
    await (options.encoder ?? encoderVideo)(dossierImages, chemin, largeur, hauteur);
    return { chemin, mime: "video/mp4", mesures: { largeur, hauteur, dureeSec: p.dureeSec, images: poses.length, survol, hauteurPage, mouvement } };
  } finally {
    await page.fermer();
  }
}

/**
 * Gardes posées AVANT d'ouvrir la page. Une page qui ne sait pas les poser (méthodes absentes, commande refusée par le
 * navigateur) : refus non réessayable, la page n'est jamais ouverte (le studio se replie sur un objet redessiné).
 */
async function poserGardes(page: PageCapture, frappe: boolean, sansMesure: boolean): Promise<void> {
  if (!page.bloquer || !page.avantChargement || (frappe && !page.taper)) throw refus("Ce navigateur ne sait pas filmer sans envoi.");
  try {
    await page.bloquer(motifsMesure());
    await page.avantChargement([sansMesure ? IGNORER_MESURE : "", frappe ? GARDE_ENVOI : ""].filter(Boolean).join("\n"));
  } catch (e) {
    throw refus(`Garde d'envoi impossible : ${(e as Error).message}`);
  }
}

/**
 * Frappe : la page descend jusqu'au premier champ, chaque lettre est tapée (2 images), chaque case cochée (6 images),
 * la flèche va se poser sur le bouton (survol réel à l'arrivée, aucun clic), puis une courte tenue.
 */
async function filmerFrappe(
  page: PageCapture,
  p: ParametresCapture,
  fenetre: (typeof FENETRES)[FormatCapture],
  hauteurPage: number,
  dossier: string,
  progression?: (pc: number) => void,
): Promise<{ dossierImages: string; mesures: Record<string, number> }> {
  const taper = page.taper!.bind(page);
  const saisies = p.saisies ?? [];
  const dossierImages = join(dossier, "images");
  await mkdir(dossierImages, { recursive: true });
  let n = 0;
  const prendre = async (fois: number) => {
    const image = await page.photographier();
    for (let k = 0; k < fois; k++) await writeFile(join(dossierImages, `i${String(n++).padStart(5, "0")}.jpg`), image);
  };
  const trouver = async (id: string, viser: boolean) => {
    const c = await page.evaluer<{ y: number; defilement: number } | null>(champ(id, viser));
    if (!c) throw refus(`Champ « ${id} » introuvable.`);
    return c;
  };

  const premier = await trouver(saisies[0].champ, false);
  const arrivee = Math.max(0, Math.min(hauteurPage - fenetre.hauteur, Math.round(premier.y - fenetre.hauteur * 0.35)));
  for (let i = 0; i < FRAPPE.defilement; i++) {
    await page.evaluer(poser({ defilement: Math.round(douceur(i / (FRAPPE.defilement - 1)) * arrivee) }, fenetre));
    await prendre(1);
  }
  progression?.(35);
  let defilement = arrivee;
  for (const s of saisies) {
    defilement = (await trouver(s.champ, true)).defilement;
    for (const lettre of s.texte) {
      await taper(lettre);
      await page.evaluer(DESSINER);
      await prendre(FRAPPE.parLettre);
    }
  }
  progression?.(60);
  for (const id of p.cocher ?? []) {
    if (!(await page.evaluer<boolean | null>(cocherCase(id)))) throw refus(`Case « ${id} » introuvable.`);
    await page.evaluer(DESSINER);
    await prendre(FRAPPE.parCase);
  }
  if (p.survoler) {
    const cible = await page.evaluer<{ x: number; y: number } | null>(bouton(p.survoler));
    if (!cible) throw refus(`Bouton « ${p.survoler} » introuvable.`);
    const depart = { x: fenetre.largeur * 0.82, y: fenetre.hauteur * 0.86 };
    for (let i = 0; i < FRAPPE.trajet; i++) {
      const k = douceur(i / (FRAPPE.trajet - 1));
      const x = Math.round(depart.x + (cible.x - depart.x) * k);
      const y = Math.round(depart.y + (cible.y - depart.y) * k);
      await page.evaluer(poser({ defilement, curseur: { x, y, appui: 0 } }, fenetre));
      if (i === FRAPPE.trajet - 1) await page.survoler(x, y);
      await prendre(1);
    }
  }
  await prendre(FRAPPE.tenue);
  progression?.(85);
  const requetesBloquees = Number(await page.evaluer<number>("window.__studioEnvoisBloques || 0")) || 0;
  return { dossierImages, mesures: { images: n, dureeSec: Math.round((n / IMAGES_PAR_SECONDE) * 100) / 100, saisies: saisies.length, requetesBloquees } };
}

export const captureSite: Operation = async (demande, contexte) => {
  const url = demande.entrees.page;
  if (!url) throw new ErreurRendu({ code: "refuse", reessayable: false, message: "Entrée « page » manquante." });
  const p = lireParametres(demande.parametres);
  const r = await capturerPage(url, p, contexte.dossier, { progression: (pc) => contexte.progression(pc) });
  contexte.progression(90);
  await deposer(demande.sortie.urlDepot, r.chemin, r.mime, contexte.signal);
  return { mesures: r.mesures };
};
