/** C9-40b-a : planche d'attente (outil local) de l'appel à l'action (C9-12a) et de l'anneau (N-08a). Rien n'est allumé. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ENTREES_ATTENTE, FORMATS_ATTENTE, PlancheObjetsAttente } from "../../outils/planche-objets/PlancheObjetsAttente";
import { EXEMPLES_APPEL_ACTION } from "../../src/briques/motion/petits-objets/appel-action";
import { EXEMPLES_ANNEAU } from "../../src/briques/motion/petits-objets/anneau-donnees";
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
  it("sept entrées dans l'ordre fixe : quatre appels à l'action puis trois anneaux", () => {
    expect(ENTREES_ATTENTE.length).toBe(EXEMPLES_APPEL_ACTION.length + EXEMPLES_ANNEAU.length);
    expect(ENTREES_ATTENTE.length).toBe(7);
    expect(ENTREES_ATTENTE.map((e) => e.id)).toEqual([
      "objet-appel-action#1", "objet-appel-action#2", "objet-appel-action#3", "objet-appel-action#4",
      "objet-anneau-donnees#1", "objet-anneau-donnees#2", "objet-anneau-donnees#3",
    ]);
    expect([...FORMATS_ATTENTE]).toEqual(["9x16", "4x5"]);
  });
  for (const fond of FONDS) {
    for (const format of FORMATS_ATTENTE) {
      it(`${fond} ${format} : sept cases, aucune image extérieure`, () => {
        const h = rendre(fond, format);
        expect(h.match(/data-objet=/g)?.length).toBe(7);
        expect(h).not.toMatch(/<img|<image|href=/);
        expect(h).toContain("Manrope");
      });
      it(`${fond} ${format} : chiffre affiché = chiffre fourni, texte de l'appel exact`, () => {
        const h = rendre(fond, format);
        EXEMPLES_APPEL_ACTION.forEach((p, i) => expect(caseDe(h, `objet-appel-action#${i + 1}`)).toContain(p.texte));
        EXEMPLES_ANNEAU.forEach((p, i) => expect(caseDe(h, `objet-anneau-donnees#${i + 1}`)).toContain(ecrireNombreFr(p.valeur, decimales(p.valeur))));
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
