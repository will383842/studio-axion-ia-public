/**
 * T-SUR-MESURE-MOTION-v20f : tests directs de `couleursDuCode`, `verifierSurMesure` et `documentSurMesure`
 * (`src/briques/motion/sur-mesure.ts`). Aucun navigateur : le document est une chaîne HTML.
 */
import { describe, expect, it } from "vitest";
import {
  couleursDuCode,
  documentSurMesure,
  POLITIQUE_IFRAME,
  TAILLE_MAX_CODE,
  verifierSurMesure,
  type CodeSurMesure,
} from "../../../src/briques/motion/sur-mesure";
import { COULEURS_PERMISES } from "../../../src/briques/motion/jetons";

const PROPRE: CodeSurMesure = {
  html: '<div class="titre">Bonjour</div>',
  css: ".titre{font-family:var(--axion-police);font-size:80px;color:var(--axion-creme)}",
  js: 'const tl = gsap.timeline({ paused: true });\ntl.from(".titre", { opacity: 0, duration: 1 });\nAXION.enregistrer(tl);',
};

const avec = (m: Partial<CodeSurMesure>): CodeSurMesure => ({ ...PROPRE, ...m });

describe("couleursDuCode", () => {
  it("ramène #hex et rgb() en #rrggbb minuscule, sans doublon, dans l'ordre hex puis rgb", () => {
    expect(couleursDuCode("a{color:#ABC;background:#aabbcc;border:#102030} b{color:rgb(255, 0, 16)}")).toEqual(["#aabbcc", "#102030", "#ff0010"]);
  });
  it("accepte rgba (alpha ignoré), plafonne à 255 et ignore le canal alpha d'un hex à 8 ou 4 chiffres", () => {
    expect(couleursDuCode("rgba(1,2,300,0.5)")).toEqual(["#0102ff"]);
    expect(couleursDuCode("#11223344")).toEqual(["#112233"]);
    expect(couleursDuCode("#1234")).toEqual(["#112233"]);
  });
  it("ignore les longueurs sans sens (2, 5 ou 7 chiffres) et le code sans couleur", () => {
    expect(couleursDuCode("#ab #abcde #abcdef0 color:var(--axion-orange)")).toEqual([]);
  });
});

describe("verifierSurMesure", () => {
  it("accepte un code propre de 5 s, sans erreur ni avertissement", () => {
    expect(verifierSurMesure(PROPRE, 5)).toEqual({ ok: true, erreurs: [], avertissements: [] });
  });
  it("accepte les bornes de durée 3 s et 8 s, refuse 2,9 s et 8,1 s avec le message exact", () => {
    expect(verifierSurMesure(PROPRE, 3).ok).toBe(true);
    expect(verifierSurMesure(PROPRE, 8).ok).toBe(true);
    expect(verifierSurMesure(PROPRE, 2.9).erreurs).toEqual(["durée de 3 à 8 s (reçu 2.9 s)"]);
    expect(verifierSurMesure(PROPRE, 8.1).erreurs).toEqual(["durée de 3 à 8 s (reçu 8.1 s)"]);
  });
  it("refuse un code trop long", () => {
    const v = verifierSurMesure(avec({ html: "x".repeat(TAILLE_MAX_CODE) }), 5);
    expect(v.ok).toBe(false);
    expect(v.erreurs[0]).toMatch(/^code trop long \(\d+ caractères, 60000 au plus\)$/);
  });
  it("refuse l'absence de timeline, et avertit (sans refuser) quand elle n'est pas enregistrée", () => {
    expect(verifierSurMesure(avec({ js: "  " }), 5).erreurs).toEqual([
      "aucune timeline : le code doit construire une timeline GSAP en pause et l'enregistrer (AXION.enregistrer(tl))",
    ]);
    const v = verifierSurMesure(avec({ js: 'gsap.to(".titre",{opacity:1});' }), 5);
    expect(v.ok).toBe(true);
    expect(v.avertissements).toEqual(["timeline non enregistrée par AXION.enregistrer(tl) : toutes les animations GSAP seront regroupées d'office"]);
  });
  it.each([
    ["adresse web", { js: PROPRE.js + 'const u = "https://exemple.fr/x";' }, "aucune adresse web (tout est local)"],
    ["accès réseau", { js: PROPRE.js + 'fetch("a");' }, "aucun accès réseau"],
    ["script externe", { html: '<script src="a.js"></script>' }, "aucun chargement de fichier ou de script externe"],
    ["évaluation", { js: PROPRE.js + 'eval("1");' }, "pas d'évaluation de code"],
    ["sortie du cadre", { js: PROPRE.js + "localStorage.x = 1;" }, "la carte ne sort pas de son cadre"],
    ["horloge", { js: PROPRE.js + "setTimeout(() => 1, 5);" }, "rien ne doit dépendre de l'horloge : tout passe par la timeline (tl.seek)"],
    ["hasard", { js: PROPRE.js + "const a = Math.random();" }, "pas de hasard non reproductible : utiliser AXION.hasard(n)"],
    ["lecture", { js: PROPRE.js + "tl.play();" }, "la timeline reste en pause et finie (pas de lecture ni de répétition infinie)"],
    ["animation CSS", { css: PROPRE.css + ".a{animation: x 1s}" }, "pas d'animation CSS : tout passe par la timeline GSAP"],
    ["fichier dans le CSS", { css: PROPRE.css + '.a{background:url("a.png")}' }, "aucun fichier externe dans le CSS"],
    ["style dans le HTML", { html: "<style>a{}</style>" }, "pas de style animé dans le HTML : le CSS va dans le champ CSS"],
    ["gestionnaire d'événement", { html: '<div onclick="x()">a</div>' }, "pas de gestionnaire d'événement dans le HTML"],
    ["police", { css: ".t{font-family: Arial, sans-serif;font-size:80px}" }, "police : Manrope seulement (font-family: var(--axion-police))"],
    ["texte trop petit en px (CSS)", { css: ".t{font-size:20px}" }, "texte trop petit (20 px) : 58 px au moins (3 % de la hauteur)"],
    ["texte trop petit (JS fontSize)", { js: PROPRE.js + 'gsap.set(racine,{fontSize:"30px"});' }, "texte trop petit (30 px) : 58 px au moins (3 % de la hauteur)"],
    ["Three.js sans le demander", { js: PROPRE.js + "const s = new THREE.Scene();" }, "Three.js utilisé sans le demander (troisD: true)"],
  ] as [string, Partial<CodeSurMesure>, string][])("refuse : %s", (_nom, m, raison) => {
    const v = verifierSurMesure(avec(m), 5);
    expect(v.ok).toBe(false);
    expect(v.erreurs).toContain(raison);
  });
  it("refuse une couleur hors charte (nommée, 6 au plus) et accepte une couleur de la charte", () => {
    const v = verifierSurMesure(avec({ css: PROPRE.css + ".a{color:#123456;border-color:rgb(1,2,3)}" }), 5);
    expect(COULEURS_PERMISES).not.toContain("#123456");
    expect(v.erreurs).toEqual(["couleurs hors charte : #123456, #010203 (utiliser var(--axion-orange), var(--axion-creme)…)"]);
    expect(verifierSurMesure(avec({ css: PROPRE.css + `.a{color:${COULEURS_PERMISES[0]}}` }), 5).ok).toBe(true);
  });
  it("le plancher de texte suit la hauteur de la vidéo (3 %)", () => {
    const petit = avec({ css: ".t{font-size:40px}" });
    expect(verifierSurMesure(petit, 5, 1920).erreurs).toEqual(["texte trop petit (40 px) : 58 px au moins (3 % de la hauteur)"]);
    expect(verifierSurMesure(petit, 5, 1080).ok).toBe(true);
  });
  it("3D : refuse l'absence de AXION.surImage, avertit si troisD est demandé sans THREE", () => {
    const sansImage = avec({ js: PROPRE.js + "const s = new THREE.Scene();", troisD: true });
    expect(verifierSurMesure(sansImage, 5).erreurs).toEqual([
      "3D : le rendu de la scène doit passer par AXION.surImage(t => renderer.render(scene, camera))",
    ]);
    const bonne = avec({ js: PROPRE.js + "const s = new THREE.Scene();AXION.surImage(t => 1);", troisD: true });
    expect(verifierSurMesure(bonne, 5)).toEqual({ ok: true, erreurs: [], avertissements: [] });
    expect(verifierSurMesure(avec({ troisD: true }), 5).avertissements).toEqual(["3D demandée mais Three.js n'est pas utilisé"]);
  });
});

describe("documentSurMesure", () => {
  const p = { ...PROPRE, largeur: 1080, hauteur: 1920, hauteurVideo: 1920, ratio: "9:16" as const, dureeSec: 5 };
  const b = { gsap: "/*GSAP_LOCAL*/", troisD: "/*THREE_LOCAL*/", polices: "/*POLICES_LOCALES*/" };

  it("contient les bibliothèques, le code, la politique de sécurité et la zone sûre exacte (9:16)", () => {
    const d = documentSurMesure(p, b);
    expect(d.startsWith("<!doctype html>")).toBe(true);
    expect(d).toContain("<style>/*POLICES_LOCALES*/</style>");
    expect(d).toContain("<script>/*GSAP_LOCAL*/</script>");
    expect(d).toContain(`<div id="carte">${PROPRE.html}</div>`);
    expect(d).toContain(PROPRE.js);
    expect(d).toContain(`<style>${PROPRE.css}</style>`);
    expect(d).toContain(`content="${POLITIQUE_IFRAME}"`);
    // zone : x = 0,07 × 1080 ; y = 0,14 × 1920 ; largeur = 1080 × (1 − 0,07 − 0,16) ; hauteur = 1920 × (1 − 0,3) − 0,14 × 1920
    expect(d).toContain('"zone":{"x":76,"y":269,"largeur":832,"hauteur":1075}');
    expect(d).toContain('"duree":5');
    expect(d).toContain('"tailleMin":58');
  });
  it("n'embarque Three.js et le mode contrôle que sur demande", () => {
    const sans = documentSurMesure(p, b);
    expect(sans).not.toContain("/*THREE_LOCAL*/");
    expect(sans).not.toContain('<div id="controle"></div>');
    const avecTout = documentSurMesure({ ...p, troisD: true, controle: true }, b);
    expect(avecTout).toContain("<script>/*THREE_LOCAL*/</script>");
    expect(avecTout).toContain('<div id="controle"></div>');
  });
  it("échappe </script> et </style> du code pour ne pas fermer le bloc", () => {
    const d = documentSurMesure({ ...p, js: 'const s = "</script>";', css: "/*</style>*/" }, b);
    expect(d).toContain('const s = "<\\/script>";');
    expect(d).toContain("/*<\\/style>*/");
  });
  it("n'ajoute aucune adresse web : la seule adresse du document est celle fournie (aucune par défaut)", () => {
    const d = documentSurMesure(p, b);
    expect(d.match(/\b(?:https?|wss?|ftp):\/\//gi)).toBeNull();
    expect(POLITIQUE_IFRAME).toContain("connect-src 'none'");
    expect(POLITIQUE_IFRAME).toContain("default-src 'none'");
  });
});
