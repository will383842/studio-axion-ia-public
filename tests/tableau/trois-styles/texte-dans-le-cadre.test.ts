/**
 * FIX-TEXTE-HORS-CADRE-TABLEAU (17/11/2026) : aucun texte du tableau (3 styles) ne dépasse la largeur utile, et le
 * surligneur couvre exactement ses mots.
 *
 * Cause : depuis le 08/11 (`083d531e`, PR #241) le rendu écrit les trois styles en Manrope, alors que la mise en page
 * mesurait encore Permanent Marker, Kalam et Caveat (jusqu'à +37 % de largeur réelle). Ici la largeur « réelle » est
 * lue INDÉPENDAMMENT dans les fichiers de police (`lireChasses`), jamais par `largeurTableau` : sinon ce test serait
 * aussi aveugle que le contrôle de fabrication. Manrope Medium sert de mesure prudente du 400 dessiné (variable, poids
 * par défaut 200 : pas de fichier Regular), Manrope Bold est exacte pour le 700.
 *
 * Les sources du rendu sont lues en TEXTE (`readFileSync`), jamais importées (PIEGE-REMOTION-TSC.md).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MANROPE_BOLD, MANROPE_MEDIUM } from "../../../src/briques/tableau-scene/trois-styles/metriques";
import { largeurTableau } from "../../../src/briques/tableau-scene/trois-styles/mesure";
import { STYLES_TABLEAU, type PoliceTableau, type StyleTableau } from "../../../src/briques/tableau-scene/trois-styles/styles";
import type { ElementPlace } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { controlerMiseEnPageTableau } from "../../../src/moteurs/montage-tableau/controles-tableau";
import { mettreEnPage, type OptionsMiseEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { IDS_FORMATS_SORTIE, type IdFormatSortie } from "../../../src/moteurs/montage-tableau/formats-sortie";
import { tableDepuis } from "../polices/tables";
import { lireChasses } from "../polices/lire-ttf";
import { fichesBanc } from "../banc/fiches-banc";
import { pagesDuStyle } from "../../../src/moteurs/montage-tableau/densite";
import type { FicheTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { ficheMaquettes, ficheTemoinV667Corrige } from "./fiches";

const MEDIUM = "src/briques/sous-titres/polices/Manrope-Medium.ttf";
const BOLD = "src/briques/sous-titres/polices/Manrope-Bold.ttf";
const REEL = { medium: lireChasses(MEDIUM), bold: lireChasses(BOLD) };

/** Largeur réelle (px) d'un texte dessiné en Manrope au poids du rendu (700 pour `kalam`, 400 sinon), sans crénage. */
function largeurReelle(texte: string, police: PoliceTableau, taille: number): number {
  const p = police === "kalam" ? REEL.bold : REEL.medium;
  let u = 0;
  for (const c of texte) u += p.chasse(c) ?? p.chasse("n")!;
  return (u / p.unitesParEm) * taille;
}

const FICHES = [["maquettes", ficheMaquettes], ["témoin v667", ficheTemoinV667Corrige]] as const;
const FINS: readonly [string, OptionsMiseEnPage["appel"]][] = [
  ["fin de la fiche", undefined],
  ["fin TikTok « Votre réponse en commentaire »", { site: true, phrase: "Votre réponse en commentaire" }],
  ["fin « Le lien est dans mon profil. »", { site: true, phrase: "Le lien est dans mon profil." }],
];

function mise(fiche: (s: StyleTableau) => ReturnType<typeof ficheMaquettes>, style: StyleTableau, format: IdFormatSortie, appel: OptionsMiseEnPage["appel"]) {
  const options: OptionsMiseEnPage = { ...(format === "vertical" ? {} : { format }), ...(appel ? { appel } : {}) };
  return mettreEnPage(fiche(style), options);
}

describe("(a) la police mesurée est la police dessinée", () => {
  it("le rendu écrit les trois styles en Manrope, 700 pour kalam et 400 sinon (lecture du texte des sources)", () => {
    const polices = readFileSync("studio-rendu/compositions/commune/polices-tableau.ts", "utf8");
    expect(polices).toMatch(/FAMILLES_POLICES_TABLEAU\s*=\s*\{\s*marker:\s*FAMILLE_CSS,\s*kalam:\s*FAMILLE_CSS,\s*caveat:\s*FAMILLE_CSS\s*\}/);
    expect(readFileSync("src/briques/charte/axion-2026.ts", "utf8")).toMatch(/FAMILLE_CSS\s*=\s*"Axion Manrope"/);
    const page = readFileSync("studio-rendu/compositions/tableau/trois-styles/PageTableau.tsx", "utf8");
    expect(page).toContain('p === "kalam" ? "700 " : ""');
  });

  const PHRASES = ["en commentaire", "VOTRE RÉPONSE", "le même temps.", "Réservez un appel de diagnostic", "On leur a donné l'outil, pas", "Maintenant", "Une équipe apprend l'IA", "chaque semaine", "de vos tâches", "que cela prend"];
  for (const police of ["marker", "kalam", "caveat"] as const)
    for (const texte of PHRASES)
      it(`${police} · « ${texte} » : largeur mesurée ≥ largeur Manrope dessinée − 1 px (116 px)`, () => {
        expect(largeurTableau(texte, police, 116)).toBeGreaterThanOrEqual(largeurReelle(texte, police, 116) - 1);
      });
});

describe("(b) aucun texte du tableau ne dépasse la largeur utile, ni sa plaque, carte ou post-it", () => {
  for (const style of STYLES_TABLEAU)
    for (const [nomFiche, fiche] of FICHES)
      for (const format of IDS_FORMATS_SORTIE)
        for (const [nomFin, appel] of FINS)
          it(`${style} · ${nomFiche} · ${format} · ${nomFin}`, () => {
            const m = mise(fiche, style, format, appel);
            const zone = m.zoneSure.px;
            const hors: string[] = [];
            for (const p of m.pages)
              for (const e of p.elements) {
                const objets = (e.tableau?.objets ?? []).filter((o) => o.sorte === "plaque" || o.sorte === "carte" || o.sorte === "postit");
                e.lignes.forEach((l, i) => {
                  const t = e.tableau?.lignes[i];
                  if (!t) return;
                  const w = largeurReelle(l.texte, t.police, t.taille);
                  if (l.px.x < zone.x - 1 || l.px.x + w > zone.x + zone.largeur + 1) hors.push(`p${p.page} « ${l.texte} » : x ${Math.round(l.px.x)} à ${Math.round(l.px.x + w)}, zone ${zone.x} à ${zone.x + zone.largeur}`);
                  const cx = l.px.x + l.px.largeur / 2;
                  const cy = l.px.y + l.px.hauteur / 2;
                  const o = objets.find((q) => cx >= q.x && cx <= q.x + q.l && cy >= q.y && cy <= q.y + q.h);
                  if (o && (l.px.x < o.x - 1 || l.px.x + w > o.x + o.l + 1)) hors.push(`p${p.page} « ${l.texte} » sort de sa ${o.sorte} (x ${Math.round(l.px.x)} à ${Math.round(l.px.x + w)}, ${o.sorte} ${Math.round(o.x)} à ${Math.round(o.x + o.l)})`);
                });
              }
            expect(hors).toEqual([]);
          });
});

describe("(c) le contrôle de fabrication voit le débordement", () => {
  it("une ligne élargie à la main au-delà de la zone lève au moins un point « coupe »", () => {
    const m = mise(ficheMaquettes, "paperboard", "vertical", undefined);
    const e = m.pages[0].elements.find((q) => q.tableau && q.lignes.length > 0) as ElementPlace;
    e.lignes[0] = { ...e.lignes[0], texte: `${e.lignes[0].texte} et encore beaucoup de mots pour dépasser largement la zone sûre de l'image` };
    expect(controlerMiseEnPageTableau(m).filter((x) => x.controle === "coupe").length).toBeGreaterThan(0);
  });

  for (const style of STYLES_TABLEAU)
    for (const [nomFiche, fiche] of FICHES)
      for (const format of IDS_FORMATS_SORTIE)
        for (const [nomFin, appel] of FINS)
          it(`0 point « coupe » : ${style} · ${nomFiche} · ${format} · ${nomFin}`, () => {
            expect(controlerMiseEnPageTableau(mise(fiche, style, format, appel)).filter((x) => x.controle === "coupe")).toEqual([]);
          });
});

describe("(d) les tables sont régénérées, pas recopiées", () => {
  it("MANROPE_MEDIUM et MANROPE_BOLD = tableDepuis des deux fichiers de police", () => {
    expect(MANROPE_MEDIUM).toEqual(tableDepuis(MEDIUM));
    expect(MANROPE_BOLD).toEqual(tableDepuis(BOLD));
  });
});

describe("(e) paperboard : le surligneur couvre exactement ses mots", () => {
  for (const [nomFiche, fiche] of FICHES)
    for (const format of IDS_FORMATS_SORTIE)
      it(`${nomFiche} · ${format}`, () => {
        const m = mise(fiche, "paperboard", format, undefined);
        const ecarts: string[] = [];
        let nb = 0;
        for (const p of m.pages)
          for (const e of p.elements) {
            for (const tr of e.tableau?.avant ?? []) {
              if (tr.g !== "s") continue;
              const ys = tr.p.filter((_, j) => j % 2);
              const yc = ys.reduce((a, b) => a + b, 0) / ys.length;
              const i = e.lignes.findIndex((l) => yc >= l.px.y && yc <= l.px.y + l.px.hauteur);
              if (i < 0) {
                ecarts.push(`p${p.page} trait à y ${Math.round(yc)} sans ligne`);
                continue;
              }
              nb++;
              const l = e.lignes[i];
              const t = e.tableau!.lignes[i];
              // Mots de la ligne, avec leur étendue réelle (le blanc est une chasse comme une autre).
              const mots = l.texte.split(" ");
              const spans: { de: number; a: number }[] = [];
              let x = l.px.x;
              for (const mot of mots) {
                const w = largeurReelle(mot, t.police, t.taille);
                spans.push({ de: x, a: x + w });
                x += w + largeurReelle(" ", t.police, t.taille);
              }
              const couvre = e.gabarit?.sorte === "case" ? 0 : Math.max(0, mots.length - 2);
              const depart = tr.p[0];
              const arrivee = tr.p[tr.p.length - 2];
              const premier = spans[couvre];
              const avant = couvre > 0 ? spans[couvre - 1] : null;
              const nom = `p${p.page} « ${l.texte} » (mots ${couvre + 1} à ${mots.length})`;
              if (depart > premier.de + 1) ecarts.push(`${nom} : départ ${Math.round(depart)} > début du premier mot ${Math.round(premier.de)} + 1`);
              if (avant && depart < avant.a - 4) ecarts.push(`${nom} : départ ${Math.round(depart)} < fin du mot d'avant ${Math.round(avant.a)} − 4`);
              const fin = spans[spans.length - 1].a;
              if (arrivee < fin - 1) ecarts.push(`${nom} : arrivée ${Math.round(arrivee)} < fin du dernier mot ${Math.round(fin)} − 1`);
              if (arrivee > fin + 14) ecarts.push(`${nom} : arrivée ${Math.round(arrivee)} > fin du dernier mot ${Math.round(fin)} + 14`);
            }
          }
        expect(nb, "aucun surligneur testé : le cas serait vide").toBeGreaterThan(0);
        expect(ecarts).toEqual([]);
      });
});

// ---- FIX-TEXTE-HORS-CADRE-TABLEAU-2a (18/11/2026) : avec la vraie mesure, chaque page du banc tient. ----

/** Les lignes hors de la zone sûre, de leur plaque, carte ou post-it (même garde que le cas (b), mesure indépendante). */
function lignesHors(m: ReturnType<typeof mettreEnPage>): string[] {
  const zone = m.zoneSure.px;
  const hors: string[] = [];
  for (const p of m.pages)
    for (const e of p.elements) {
      const objets = (e.tableau?.objets ?? []).filter((o) => o.sorte === "plaque" || o.sorte === "carte" || o.sorte === "postit");
      e.lignes.forEach((l, i) => {
        const tl = e.tableau?.lignes[i];
        if (!tl) return;
        const w = largeurReelle(l.texte, tl.police, tl.taille);
        if (l.px.x < zone.x - 1 || l.px.x + w > zone.x + zone.largeur + 1) hors.push(`p${p.page} « ${l.texte} » hors zone sûre : x ${Math.round(l.px.x)} à ${Math.round(l.px.x + w)}`);
        const cx = l.px.x + l.px.largeur / 2;
        const cy = l.px.y + l.px.hauteur / 2;
        const o = objets.find((q) => cx >= q.x && cx <= q.x + q.l && cy >= q.y && cy <= q.y + q.h);
        if (o && (l.px.x < o.x - 1 || l.px.x + w > o.x + o.l + 1)) hors.push(`p${p.page} « ${l.texte} » sort de sa ${o.sorte}`);
      });
    }
  return hors;
}

const luePar = (fiche: FicheTableau, style: StyleTableau) => pagesDuStyle({ ...fiche, styleTableau: style }) as FicheTableau;
const FINS_BANC: readonly OptionsMiseEnPage["appel"][] = [undefined, { site: true, phrase: "Votre réponse en commentaire" }];

describe("(f) toutes les fiches du banc tiennent, lues comme la fabrication, 3 styles × 4 formats × 2 fins", () => {
  for (const f of fichesBanc())
    it(
      `${f.nom} : 24 mises en page sans refus, rien hors cadre`,
      () => {
        const refus: string[] = [];
        const hors: string[] = [];
        for (const style of STYLES_TABLEAU) {
          const lue = luePar(f.fiche, style);
          for (const format of IDS_FORMATS_SORTIE)
            for (const appel of FINS_BANC) {
              const nom = `${style} · ${format} · ${appel ? "TikTok" : "fin de la fiche"}`;
              try {
                const m = mettreEnPage(lue, { ...(format === "vertical" ? {} : { format }), ...(appel ? { appel } : {}) });
                hors.push(...lignesHors(m).map((x) => `${nom} : ${x}`));
              } catch (e) {
                refus.push(`${nom} : ${(e as Error).message.slice(0, 120)}`);
              }
            }
        }
        expect(refus).toEqual([]);
        expect(hors).toEqual([]);
      },
      180_000,
    );
});

describe("(g) une case cochée prend 3 lignes en dernier recours, jamais plus petit", () => {
  const formation = () => fichesBanc().find((f) => f.nom === "fiche-formation-v3-reference-3")!.fiche;
  for (const style of ["paperboard", "ardoise"] as const)
    it(
      `${style} · vertical : « Améliorer le modèle » posée, ≤ 3 lignes, ≥ 54 px, dans la zone sûre`,
      () => {
        const m = mettreEnPage(luePar(formation(), style), {});
        const zone = m.zoneSure.px;
        const e = m.pages.flatMap((p) => p.elements).find((q) => q.lignes.map((l) => l.texte).join(" ").includes("Améliorer le modèle"));
        expect(e, "l'élément « Améliorer le modèle » doit être posé").toBeTruthy();
        expect(e!.lignes.length).toBeLessThanOrEqual(3);
        e!.lignes.forEach((l, i) => {
          const tl = e!.tableau!.lignes[i];
          expect(tl.taille).toBeGreaterThanOrEqual(54);
          const w = largeurReelle(l.texte, tl.police, tl.taille);
          expect(l.px.x).toBeGreaterThanOrEqual(zone.x - 1);
          expect(l.px.x + w).toBeLessThanOrEqual(zone.x + zone.largeur + 1);
        });
      },
      60_000,
    );

  for (const style of STYLES_TABLEAU)
    it(
      `${style} · maquettes vertical : aucune case n'a plus de 2 lignes (le repli ne sert que si 2 ne tiennent pas)`,
      () => {
        const m = mise(ficheMaquettes, style, "vertical", undefined);
        const cases = m.pages.flatMap((p) => p.elements).filter((e) => e.gabarit?.sorte === "case");
        expect(cases.length).toBeGreaterThan(0);
        for (const e of cases) expect(e.lignes.length).toBeLessThanOrEqual(2);
      },
      60_000,
    );
});

describe("(h) la bande libérée des étiquettes n'est prise qu'en repli", () => {
  for (const style of STYLES_TABLEAU)
    for (const format of IDS_FORMATS_SORTIE)
      it(
        `maquettes · ${style} · ${format} : aucun élément au-dessus de la ligne des anciennes étiquettes`,
        () => {
          const m = mise(ficheMaquettes, style, format, undefined);
          const n = m.styleReference!.nomsChapitres!;
          const ligne = n.y + n.hauteur;
          const au_dessus = m.pages.flatMap((p) => p.elements.filter((e) => e.encombrement.px.y < ligne).map((e) => `p${p.page} y ${Math.round(e.encombrement.px.y)} < ${ligne}`));
          expect(au_dessus).toEqual([]);
        },
        60_000,
      );

  it(
    "témoin v667 corrigé · ardoise · carré : la page d'appel tient, un élément monte au-dessus de la ligne, tous restent dans la zone sûre",
    () => {
      const m = mise(ficheTemoinV667Corrige, "ardoise", "carre", undefined);
      const n = m.styleReference!.nomsChapitres!;
      const ligne = n.y + n.hauteur;
      const els = m.pages.flatMap((p) => p.elements);
      expect(els.some((e) => e.encombrement.px.y < ligne)).toBe(true);
      for (const e of els) expect(e.encombrement.px.y).toBeGreaterThanOrEqual(m.zoneSure.px.y);
    },
    60_000,
  );
});
