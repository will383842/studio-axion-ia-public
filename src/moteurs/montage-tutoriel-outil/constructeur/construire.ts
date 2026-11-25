/**
 * T-EXT-25a · Constructeur de maquette : description (`description-maquette.v1`) → 4 fichiers texte. SANS IA, sans disque,
 * sans réseau, déterministe. Les ressources (charte, écrans neutres de T-EXT-49) sont passées en paramètre.
 * Tout texte de la description est ÉCHAPPÉ avant d'entrer dans le HTML ; aucun script ni police externe, aucun `fetch`.
 * PHRASE-3 : ce code vit sous `src/` (le Studio le lit pour fabriquer l'aperçu et le film d'une maquette créée depuis une phrase ; l'image
 * du Studio n'embarque pas `outils/`, hors quelques fichiers). `outils/maquettes-tableaux-de-bord/constructeur/construire.ts` le ré-exporte.
 */
import type { DescriptionMaquette, DonneeExemple, EcranDecrit, ZoneDecrite } from "../description-maquette";

export const NOMS_FICHIERS = ["index.html", "app.js", "demo-data.js", "styles.css"] as const;
export type NomFichier = (typeof NOMS_FICHIERS)[number];

export interface RessourcesConstructeur {
  /** Contenu de `charte/charte.css`. */
  charteCss: string;
  /** Fragments HTML des écrans neutres (T-EXT-49), par identifiant de modèle ; un modèle absent : écran générique. */
  ecrans: Record<string, string>;
}

export const MENTION_ECRAN = "Démonstration · données exemple";

/** T-EXT-V2-03 : `vivant` ajoute les animations de la maquette (compteurs, barres, lignes). Seul `true` exact l'allume. */
export interface OptionsConstructeur {
  vivant?: boolean;
}

/** Durées (ms) de l'option vivante. Aucune animation ne dépasse 1 s, délai compris (la caméra de T-EXT-44 attendrait trop). */
export const DUREE_COMPTEUR_MS = 900;
export const DUREE_BARRE_MS = 600;
export const DECALAGE_BARRE_MS = 80;
export const DUREE_LIGNE_MS = 250;
export const DECALAGE_LIGNE_MS = 60;
export const DUREE_DOUCE_MS = 300;
export const DUREE_MAX_ANIMATION_MS = 1000;
const DECIMALES_MAX = 3;

const echapper = (t: string): string => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** JSON sûr dans un fichier de script : jamais de `<` ni de séparateur de ligne Unicode. */
const jsonSur = (v: unknown): string => JSON.stringify(v).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, (c) => "\\u" + c.charCodeAt(0).toString(16));

function donneeHtml(d: DonneeExemple): string {
  const etat = d.etat ? ` data-etat="${echapper(d.etat)}"` : "";
  return `<li class="donnee" data-donnee="${echapper(d.id)}"${etat}><span class="donnee-libelle">${echapper(d.libelle)}</span> <span class="donnee-valeur">${echapper(String(d.valeur))}</span></li>`;
}

function zoneHtml(z: ZoneDecrite): string {
  return `<section class="zone zone-${echapper(z.type)}" data-zone="${echapper(z.id)}"><h3>${echapper(z.libelle)}</h3><ul>${z.donnees.map(donneeHtml).join("")}</ul></section>`;
}

function ecranHtml(e: EcranDecrit, ressources: RessourcesConstructeur): string {
  const modele = e.modele !== "tableau-de-bord" && ressources.ecrans[e.modele] ? `<div class="modele-ecran" data-modele="${echapper(e.modele)}">${ressources.ecrans[e.modele]}</div>` : "";
  return `<article class="ecran" id="ecran-${echapper(e.id)}" data-ecran="${echapper(e.id)}" hidden><h2>${echapper(e.titre)}</h2><p class="mention-ecran">${MENTION_ECRAN}</p>${modele}<div class="zones">${e.zones.map(zoneHtml).join("")}</div></article>`;
}

// ───────── Option « vivante » (T-EXT-V2-03) ─────────

const FINE = " ";

/** Donnée chiffrée : nombre fini, positif ou nul (les textes comme « Nouveau » restent des textes). */
const estChiffre = (v: string | number): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

function decimales(v: number): number {
  const m = /\.(\d+)/.exec(String(v));
  return Math.min(m ? m[1]!.length : 0, DECIMALES_MAX);
}

/** Format français : espace fine insécable pour les milliers, virgule décimale, `k` décimales. */
export function formatFrancais(v: number, k: number): string {
  const [entier = "0", frac = ""] = v.toFixed(k).split(".");
  const groupes = entier.replace(/\B(?=(\d{3})+(?!\d))/g, FINE);
  return k > 0 ? `${groupes},${frac}` : groupes;
}

interface LigneVivante {
  donnee: DonneeExemple;
  /** Présent seulement si la donnée existe en « avant » ET en « maintenant » sous le même libellé. */
  de?: number;
  a?: number;
}

/** Fusionne, dans une zone, les paires chiffrées « avant » / « maintenant » de même libellé en une seule ligne. */
function fusionner(donnees: DonneeExemple[]): LigneVivante[] {
  const lignes: LigneVivante[] = [];
  const pris = new Set<number>();
  donnees.forEach((d, i) => {
    if (pris.has(i)) return;
    if (d.etat === "avant" && estChiffre(d.valeur)) {
      const j = donnees.findIndex((x, jj) => jj !== i && !pris.has(jj) && x.etat === "maintenant" && x.libelle === d.libelle && estChiffre(x.valeur));
      if (j >= 0) {
        pris.add(j);
        const arrivee = donnees[j]!;
        const sansEtat: DonneeExemple = { ...arrivee };
        delete sansEtat.etat;
        lignes.push({ donnee: sansEtat, de: d.valeur as number, a: arrivee.valeur as number });
        return;
      }
    }
    lignes.push({ donnee: d });
  });
  return lignes;
}

/**
 * Nombre qui compte : un `--n` (entier enregistré par `@property`) animé par Web Animations ; chaque chiffre est un compteur CSS
 * déduit de `--n`, donc exact à l'image près quand 03b avance l'animation. Les zéros de tête et leurs espaces sont masqués.
 */
function nombreHtml(de: number, a: number): string {
  const k = decimales(a);
  const echelle = 10 ** k;
  const nDe = Math.round(de * echelle);
  const nA = Math.round(a * echelle);
  const total = Math.max(String(Math.max(nDe, nA)).length, k + 1);
  const chiffres: string[] = [];
  for (let i = total - 1; i >= 0; i--) {
    if (i === k - 1) chiffres.push('<span class="v" aria-hidden="true"></span>');
    const classe = i < k || i === k ? "c" : (i - k) % 3 === 2 ? "g" : "t";
    chiffres.push(`<span class="${classe}" style="--p:${10 ** i}" aria-hidden="true"></span>`);
  }
  return `<span class="donnee-valeur nombre" role="img" aria-label="${echapper(formatFrancais(a, k))}" style="--n:${nDe}">${chiffres.join("")}</span>`;
}

const ratio = (v: number, max: number): string => (max > 0 ? String(Number((v / max).toFixed(4))) : "0");

function ligneVivanteHtml(l: LigneVivante, zone: ZoneDecrite, max: number): string {
  const d = l.donnee;
  const etat = d.etat ? ` data-etat="${echapper(d.etat)}"` : "";
  const fusion = l.de !== undefined && l.a !== undefined;
  const k = fusion ? decimales(l.a as number) : 0;
  const attrs = fusion ? ` data-de="${l.de}" data-a="${l.a}" data-k="${k}" data-n-de="${Math.round((l.de as number) * 10 ** k)}" data-n-a="${Math.round((l.a as number) * 10 ** k)}"` : "";
  const libelle = `<span class="donnee-libelle">${echapper(d.libelle)}</span>`;
  const valeur = fusion ? nombreHtml(l.de as number, l.a as number) : `<span class="donnee-valeur">${echapper(String(d.valeur))}</span>`;
  const classes = zone.type === "tableau" ? "donnee ligne" : "donnee";
  let barre = "";
  if (zone.type === "graphique" && (fusion || estChiffre(d.valeur))) {
    const rA = ratio(fusion ? (l.a as number) : (d.valeur as number), max);
    const rDe = fusion ? ratio(l.de as number, max) : rA;
    const suite = fusion ? ` data-r-de="${rDe}" data-r-a="${rA}"` : "";
    barre = ` <span class="barre-piste" aria-hidden="true"><span class="barre"${suite} style="transform: scaleX(${rDe})"></span></span>`;
  }
  return `<li class="${classes}" data-donnee="${echapper(d.id)}"${etat}${attrs}>${libelle} ${valeur}${barre}</li>`;
}

function zoneVivanteHtml(z: ZoneDecrite): string {
  const valeurs = z.donnees.flatMap((d) => (estChiffre(d.valeur) ? [d.valeur] : []));
  const max = valeurs.length ? Math.max(...valeurs) : 0;
  const lignes = fusionner(z.donnees);
  const plusGrande = z.type === "graphique" ? max : 0;
  const corps = lignes.map((l) => ligneVivanteHtml(l, z, plusGrande)).join("");
  return `<section class="zone zone-${echapper(z.type)}" data-zone="${echapper(z.id)}"><h3>${echapper(z.libelle)}</h3><ul>${corps}</ul></section>`;
}

function ecranVivantHtml(e: EcranDecrit, ressources: RessourcesConstructeur): string {
  const modele = e.modele !== "tableau-de-bord" && ressources.ecrans[e.modele] ? `<div class="modele-ecran" data-modele="${echapper(e.modele)}">${ressources.ecrans[e.modele]}</div>` : "";
  return `<article class="ecran" id="ecran-${echapper(e.id)}" data-ecran="${echapper(e.id)}" hidden><h2>${echapper(e.titre)}</h2><p class="mention-ecran">${MENTION_ECRAN}</p>${modele}<div class="zones">${e.zones.map(zoneVivanteHtml).join("")}</div></article>`;
}

const STYLES = `
body { padding-top: 40px; }
.mention-ecran { margin: 0 0 12px; color: var(--texte-secondaire); font-size: 14px; font-weight: 600; }
.maquette { max-width: 1200px; margin: 0 auto; padding: 24px; }
.entete { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid var(--noir); padding-bottom: 12px; }
.entete h1 { margin: 0; font-size: 28px; font-weight: 800; }
.entete .entreprise { color: var(--texte-secondaire); font-weight: 600; }
.etat { margin: 16px 0; padding: 8px 12px; background: var(--gris); font-weight: 700; transition: background-color 400ms ease, color 400ms ease; }
body.etat-maintenant .etat { background: var(--terracotta); color: var(--blanc); }
.ecran[hidden] { display: none; }
.zones { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
.zone { background: var(--blanc); border: 1px solid var(--gris); padding: 16px; transition: opacity 400ms ease, border-color 400ms ease; }
.zone.actif { border-color: var(--terracotta); border-width: 3px; }
.zone h3 { margin: 0 0 8px; font-size: 18px; }
.zone ul { margin: 0; padding: 0; list-style: none; }
.donnee { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--gris); transition: opacity 400ms ease; }
.donnee[hidden] { display: none; }
.donnee-valeur { font-weight: 800; }
`;

const APP = `(function () {
  "use strict";
  var data = window.donneesExemple;
  var ecrans = [].slice.call(document.querySelectorAll(".ecran"));
  var etatCourant = "avant";

  function majEtat(etat) {
    etatCourant = etat;
    document.body.classList.remove("etat-avant", "etat-maintenant");
    document.body.classList.add("etat-" + etat);
    document.getElementById("etat").textContent = data.etats[etat];
    [].forEach.call(document.querySelectorAll("[data-etat]"), function (n) {
      n.hidden = n.getAttribute("data-etat") !== etat;
    });
  }

  function montrer(id) {
    ecrans.forEach(function (e) {
      e.hidden = e.getAttribute("data-ecran") !== id;
    });
  }

  function viderActifs() {
    [].forEach.call(document.querySelectorAll(".zone.actif"), function (z) {
      z.classList.remove("actif");
    });
  }

  window.demoMaquette = {
    aller: function (etapeId) {
      if (etapeId === "avant" || etapeId === "maintenant") {
        majEtat(etapeId);
        return true;
      }
      if (Object.prototype.hasOwnProperty.call(data.ecrans, etapeId)) {
        viderActifs();
        montrer(etapeId);
        return true;
      }
      var zone = document.querySelector('[data-zone="' + etapeId + '"]');
      if (!zone) return false;
      viderActifs();
      montrer(zone.closest(".ecran").getAttribute("data-ecran"));
      zone.classList.add("actif");
      return true;
    },
    reinitialiser: function () {
      viderActifs();
      majEtat("avant");
      montrer(data.premierEcran);
    },
  };

  window.demoMaquette.reinitialiser();
})();
`;

const STYLES_VIVANT = `
@property --n { syntax: "<integer>"; inherits: true; initial-value: 0; }
@counter-style vide { system: cyclic; symbols: ""; }
@counter-style chiffre { system: extends decimal; range: 0 9; fallback: vide; }
@counter-style espace-fine { system: cyclic; symbols: "\\202F"; range: 0 0; fallback: vide; }
.vivant .zone { background: var(--ivoire); }
.vivant .zone.actif { background: var(--blanc); }
.vivant .ecran.cible .zone:not(.actif) { opacity: 0.55; }
.nombre { font-variant-numeric: tabular-nums; white-space: pre; }
.nombre .c { counter-reset: d calc(mod(round(down, var(--n) / var(--p), 1), 10)); }
.nombre .c::after { content: counter(d, chiffre); }
.nombre .t { counter-reset: d calc(mod(round(down, var(--n) / var(--p), 1), 10) + 10 * (1 - min(1, round(down, var(--n) / var(--p), 1)))); }
.nombre .t::after { content: counter(d, chiffre); }
.nombre .g { counter-reset: d calc(mod(round(down, var(--n) / var(--p), 1), 10) + 10 * (1 - min(1, round(down, var(--n) / var(--p), 1)))) s calc(1 - min(1, round(down, var(--n) / (var(--p) * 10), 1))); }
.nombre .g::after { content: counter(s, espace-fine) counter(d, chiffre); }
.nombre .v::after { content: ","; }
.barre-piste { display: block; flex: 1 1 100%; background: var(--gris); }
.barre { display: block; height: 12px; background: var(--terracotta); transform-origin: left center; }
.vivant .zone-graphique .donnee { flex-wrap: wrap; gap: 0 12px; justify-content: flex-start; }
.vivant .zone-graphique .donnee-libelle { flex: 1 1 auto; }
`;

const APP_VIVANT = `(function () {
  "use strict";
  var data = window.donneesExemple;
  var ecrans = [].slice.call(document.querySelectorAll(".ecran"));
  var etatCourant = "avant";
  var ecranCourant = "";

  function toutes(sel, racine) {
    return [].slice.call((racine || document).querySelectorAll(sel));
  }

  function jouer(el, cles, options) {
    if (el && typeof el.animate === "function") el.animate(cles, options);
  }

  function arreterAnimations() {
    if (typeof document.getAnimations !== "function") return;
    document.getAnimations().forEach(function (a) {
      a.cancel();
    });
  }

  function nombre(ligne) {
    return ligne.querySelector(".nombre");
  }

  function poserNombres(cle) {
    toutes("[data-de]").forEach(function (l) {
      nombre(l).style.setProperty("--n", l.getAttribute(cle));
    });
  }

  function poserBarres(cle) {
    toutes(".barre[data-r-de]").forEach(function (b) {
      b.style.transform = "scaleX(" + b.getAttribute(cle) + ")";
    });
  }

  function arrivee() {
    toutes("[data-de]").forEach(function (l) {
      var n = nombre(l);
      var de = l.getAttribute("data-n-de");
      var a = l.getAttribute("data-n-a");
      n.style.setProperty("--n", a);
      jouer(n, [{ "--n": de }, { "--n": a }], { duration: ${DUREE_COMPTEUR_MS}, easing: "ease-out" });
    });
    toutes(".barre[data-r-de]").forEach(function (b, i) {
      var de = b.getAttribute("data-r-de");
      var a = b.getAttribute("data-r-a");
      b.style.transform = "scaleX(" + a + ")";
      jouer(b, [{ transform: "scaleX(" + de + ")" }, { transform: "scaleX(" + a + ")" }], { duration: ${DUREE_BARRE_MS}, delay: Math.min(i * ${DECALAGE_BARRE_MS}, ${DUREE_MAX_ANIMATION_MS - DUREE_BARRE_MS}), easing: "ease-out", fill: "backwards" });
    });
  }

  function majEtat(etat) {
    var change = etat !== etatCourant;
    etatCourant = etat;
    document.body.classList.remove("etat-avant", "etat-maintenant");
    document.body.classList.add("etat-" + etat);
    document.getElementById("etat").textContent = data.etats[etat];
    [].forEach.call(document.querySelectorAll("[data-etat]"), function (n) {
      n.hidden = n.getAttribute("data-etat") !== etat;
    });
    if (!change) return;
    if (etat === "maintenant") {
      arrivee();
    } else {
      arreterAnimations();
      poserNombres("data-n-de");
      poserBarres("data-r-de");
    }
  }

  function entree(ecran) {
    toutes(".zone-tableau .ligne:not([hidden])", ecran).forEach(function (l, i) {
      jouer(l, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: ${DUREE_LIGNE_MS}, delay: Math.min(i * ${DECALAGE_LIGNE_MS}, ${DUREE_MAX_ANIMATION_MS - DUREE_LIGNE_MS}), easing: "ease-out", fill: "backwards" });
    });
    toutes(".zone-graphique .barre", ecran).forEach(function (b, i) {
      var vers = b.style.transform || "scaleX(1)";
      jouer(b, [{ transform: "scaleX(0)" }, { transform: vers }], { duration: ${DUREE_BARRE_MS}, delay: Math.min(i * ${DECALAGE_BARRE_MS}, ${DUREE_MAX_ANIMATION_MS - DUREE_BARRE_MS}), easing: "ease-out", fill: "backwards" });
    });
    toutes(".zone-liste ul, .zone-message ul", ecran).forEach(function (u) {
      jouer(u, [{ opacity: 0 }, { opacity: 1 }], { duration: ${DUREE_DOUCE_MS}, easing: "ease-out", fill: "backwards" });
    });
  }

  function montrer(id, anime) {
    var change = id !== ecranCourant;
    ecranCourant = id;
    ecrans.forEach(function (e) {
      e.hidden = e.getAttribute("data-ecran") !== id;
    });
    if (change && anime) {
      ecrans.forEach(function (e) {
        if (!e.hidden) entree(e);
      });
    }
  }

  function viderActifs() {
    [].forEach.call(document.querySelectorAll(".zone.actif"), function (z) {
      z.classList.remove("actif");
    });
    [].forEach.call(document.querySelectorAll(".ecran.cible"), function (e) {
      e.classList.remove("cible");
    });
  }

  window.demoMaquette = {
    aller: function (etapeId) {
      if (etapeId === "avant" || etapeId === "maintenant") {
        majEtat(etapeId);
        return true;
      }
      if (Object.prototype.hasOwnProperty.call(data.ecrans, etapeId)) {
        viderActifs();
        montrer(etapeId, true);
        return true;
      }
      var zone = document.querySelector('[data-zone="' + etapeId + '"]');
      if (!zone) return false;
      viderActifs();
      var ecran = zone.closest(".ecran");
      montrer(ecran.getAttribute("data-ecran"), true);
      zone.classList.add("actif");
      ecran.classList.add("cible");
      return true;
    },
    reinitialiser: function () {
      arreterAnimations();
      viderActifs();
      etatCourant = "";
      majEtat("avant");
      poserNombres("data-n-de");
      poserBarres("data-r-de");
      ecranCourant = "";
      montrer(data.premierEcran, false);
    },
  };

  window.demoMaquette.reinitialiser();
})();
`;

export function construireMaquette(d: DescriptionMaquette, ressources: RessourcesConstructeur, options: OptionsConstructeur = {}): { fichiers: Record<NomFichier, string> } {
  const vivant = options.vivant === true;
  const ecrans: Record<string, true> = {};
  for (const e of d.ecrans) ecrans[e.id] = true;
  const demoData = `window.donneesExemple = ${jsonSur({ nom: d.nom, entreprise: d.entreprise, etats: d.etats, premierEcran: d.ecrans[0]?.id ?? "", ecrans, zones: d.ecrans.flatMap((e) => e.zones.map((z) => ({ id: z.id, type: z.type, donnees: z.donnees }))) })};\n`;
  const html = [
    "<!doctype html>",
    '<html lang="fr">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${echapper(d.nom)}</title>`,
    '<link rel="stylesheet" href="styles.css">',
    "</head>",
    vivant ? '<body class="vivant">' : "<body>",
    `<div class="mention-demo">${MENTION_ECRAN}</div>`,
    '<main class="maquette">',
    `<header class="entete"><h1>${echapper(d.nom)}</h1><span class="entreprise">${echapper(d.entreprise)}</span></header>`,
    '<p class="etat" id="etat"></p>',
    ...d.ecrans.map((e) => (vivant ? ecranVivantHtml(e, ressources) : ecranHtml(e, ressources))),
    "</main>",
    '<script src="demo-data.js"></script>',
    '<script src="app.js"></script>',
    "</body>",
    "</html>",
    "",
  ].join("\n");
  return { fichiers: { "index.html": html, "app.js": vivant ? APP_VIVANT : APP, "demo-data.js": demoData, "styles.css": `${ressources.charteCss}\n${STYLES}${vivant ? STYLES_VIVANT : ""}` } };
}
