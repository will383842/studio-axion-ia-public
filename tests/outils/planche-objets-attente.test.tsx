/** C9-40b-a : planche d'attente (outil local) de l'appel à l'action (C9-12a) et de l'anneau (N-08a). Rien n'est allumé. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ENTREES_ATTENTE, FORMATS_ATTENTE, PlancheObjetsAttente } from "../../outils/planche-objets/PlancheObjetsAttente";
import { EXEMPLES_APPEL_ACTION } from "../../src/briques/motion/petits-objets/appel-action";
import { EXEMPLES_ANNEAU } from "../../src/briques/motion/petits-objets/anneau-donnees";
import { EXEMPLES_ROULEAU } from "../../src/briques/motion/petits-objets/compteur-rouleau";
import { EXEMPLES_APPEL_RDV } from "../../src/briques/motion/petits-objets/appel-rdv";
import { LIBELLE_APPEL_RDV } from "../../src/briques/motion/habillage-commun/sequence-appel";
import { ecrireNombreFr } from "../../src/briques/motion/petits-objets/gros-chiffre";

const RACINE = join(__dirname, "..", "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const FONDS = ["ivoire", "noir"] as const;
function fichiers(dossier: string): string[] {
  return readdirSync(join(RACINE, dossier)).flatMap((n) => {
    const rel = `${dossier}/${n}`;
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(join(RACINE, rel)).isDirectory() ? fichiers(rel) : /\.(ts|tsx|mts)$/.test(n) ? [rel] : [];
  });
}
const rendre = (fond: (typeof FONDS)[number], format: (typeof FORMATS_ATTENTE)[number]) => renderToStaticMarkup(createElement(PlancheObjetsAttente, { fond, format }));
const decimales = (v: number) => String(v).split(".")[1]?.length ?? 0;
/** Balisage de la case `id` : de son `data-objet` jusqu'au suivant. */
function caseDe(html: string, id: string): string {
  const morceaux = html.split('data-objet="').slice(1);
  const m = morceaux.find((s) => s.startsWith(`${id}"`));
  if (!m) throw new Error(`case absente : ${id}`);
  return m;
}

describe("C9-40b-a planche d'attente", () => {
  // N-08c-a 18/11 : l'attente « 7 » devient 14 (rouleaux et boutons RDV ajoutés ; aucune attente retirée).
  it("quatorze entrées dans l'ordre fixe : 4 appels à l'action, 3 anneaux, 4 rouleaux, 3 boutons RDV", () => {
    expect(ENTREES_ATTENTE.length).toBe(EXEMPLES_APPEL_ACTION.length + EXEMPLES_ANNEAU.length + EXEMPLES_ROULEAU.length + EXEMPLES_APPEL_RDV.length);
    expect(ENTREES_ATTENTE.length).toBe(14);
    expect(ENTREES_ATTENTE.map((e) => e.id)).toEqual([
      "objet-appel-action#1", "objet-appel-action#2", "objet-appel-action#3", "objet-appel-action#4",
      "objet-anneau-donnees#1", "objet-anneau-donnees#2", "objet-anneau-donnees#3",
      "objet-compteur-rouleau#1", "objet-compteur-rouleau#2", "objet-compteur-rouleau#3", "objet-compteur-rouleau#4",
      "objet-appel-rdv#1", "objet-appel-rdv#2", "objet-appel-rdv#3",
    ]);
    expect([...FORMATS_ATTENTE]).toEqual(["9x16", "4x5"]);
  });
  for (const fond of FONDS) {
    for (const format of FORMATS_ATTENTE) {
      it(`${fond} ${format} : quatorze cases, aucune image extérieure`, () => {
        const h = rendre(fond, format);
        expect(h.match(/data-objet=/g)?.length).toBe(14);
        expect(h).not.toMatch(/<img|<image|href=/);
        expect(h).toContain("Manrope");
      });
      it(`${fond} ${format} : chiffre affiché = chiffre fourni, texte de l'appel exact`, () => {
        const h = rendre(fond, format);
        EXEMPLES_APPEL_ACTION.forEach((p, i) => expect(caseDe(h, `objet-appel-action#${i + 1}`)).toContain(p.texte));
        EXEMPLES_ANNEAU.forEach((p, i) => expect(caseDe(h, `objet-anneau-donnees#${i + 1}`)).toContain(ecrireNombreFr(p.valeur, decimales(p.valeur))));
      });
      it(`${fond} ${format} : rouleau posé sur la valeur fournie, bouton RDV lisible`, () => {
        const h = rendre(fond, format);
        EXEMPLES_ROULEAU.forEach((p, i) => {
          const c = caseDe(h, `objet-compteur-rouleau#${i + 1}`);
          const colonnes = [...c.matchAll(/data-role="colonne" data-cible="(\d)" data-decalage="([^"]+)"/g)].map((x) => ({ cible: Number(x[1]), decalage: Number(x[2]) }));
          const attendu = ecrireNombreFr(p.valeur, p.decimales ?? 0);
          expect(colonnes.map((x) => x.cible).join("")).toBe(attendu.replace(/\D/g, ""));
          for (const x of colonnes) expect(x.decalage % 10).toBe(x.cible);
          expect(c).toContain(`aria-label="${p.prefixe ?? ""}${attendu}${p.suffixe ?? ""}"`);
          // préfixe et suffixe sont posés caractère par caractère (colonnes fixes, séparateurs de milliers et virgule écartés)
          const fixes = [...c.matchAll(/data-role="fixe"[^>]*>([^<]*)</g)].map((x) => x[1]).join("").replace(/[\s\u202f\u00a0,]/g, "");
          expect(fixes).toBe(`${p.prefixe ?? ""}${p.suffixe ?? ""}`);
        });
        EXEMPLES_APPEL_RDV.forEach((_p, i) => expect(caseDe(h, `objet-appel-rdv#${i + 1}`)).toContain(LIBELLE_APPEL_RDV));
      });
      it(`${fond} ${format} : deux rouleaux n'ont aucun id de clipPath en commun`, () => {
        const h = rendre(fond, format);
        const ids = EXEMPLES_ROULEAU.map((_p, i) => new Set([...caseDe(h, `objet-compteur-rouleau#${i + 1}`).matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1])));
        ids.forEach((a, i) => {
          expect(a.size).toBeGreaterThan(0);
          ids.slice(i + 1).forEach((b) => expect([...a].filter((x) => b.has(x))).toEqual([]));
        });
      });
      it(`${fond} ${format} : même entrée, même balisage`, () => {
        expect(rendre(fond, format)).toBe(rendre(fond, format));
      });
    }
  }
  it("aucune couleur écrite en dur dans le composant", () => {
    const s = lire("outils/planche-objets/PlancheObjetsAttente.tsx");
    expect(s).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
  it("garde statique : pas de services, de Racine ni de mention IA", () => {
    for (const f of ["outils/planche-objets/PlancheObjetsAttente.tsx", "outils/planche-objets/planche.mts"]) {
      expect(lire(f), f).not.toMatch(/@\/services|src\/services|compositions\/Racine|mention-ia/);
    }
  });
  it("le script supprime son entrée temporaire (finally) et reste local", () => {
    const s = lire("outils/planche-objets/planche.mts");
    expect(s).toMatch(/finally\s*\{[^}]*rmSync/);
    expect(s).toContain(".planche-objets-attente-tmp");
  });
  it("garde : aucun fichier de src/ ni studio-rendu/ n'importe outils/planche-objets", () => {
    for (const f of [...fichiers("src"), ...fichiers("studio-rendu")]) expect(lire(f), f).not.toMatch(/outils\/planche-objets|PlancheObjetsAttente/);
  });
});
