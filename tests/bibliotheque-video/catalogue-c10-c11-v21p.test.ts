/** CATALOGUE-C10-C11-v21p : 5 lignes du chantier 10 et 5 du chantier 11 inscrites au catalogue, jamais permises. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUE_CAPACITES, ID, ligneCapacite } from "@/briques/bibliotheque-video/catalogue";
import { LIGNES_FINITION } from "@/briques/bibliotheque-video/catalogue/finition";
import { LIGNES_COUVERTURE } from "@/briques/bibliotheque-video/catalogue/couverture";
import { PROFILS_DU_CODE, profilNeutre } from "@/briques/bibliotheque-video/profils";
import { porteCapacite } from "@/briques/bibliotheque-video/moteur";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";

const C10 = [
  ["accroche.script", "accrocheScript", "prevu"],
  ["rythme.mesure", "rythmeMesure", "prevu"],
  ["etalonnage.noir-blanc", "etalonnageNoirBlanc", "prevu"],
  ["texte.lueur", "texteLueur", "prevu"],
  ["texte.fond-clair", "texteFondClair", "prevu"],
] as const;
const C11 = [
  ["texte.marques-au-mot", "texteMarquesAuMot", "eteint"],
  ["texte.selectif", "texteSelectif", "prevu"],
  ["texte.mode-carte", "texteModeCarte", "prevu"],
  ["texte.effets", "texteEffets", "prevu"],
  ["texte.accents-role", "texteAccentsRole", "prevu"],
] as const;
const DIX = [...C10, ...C11].map(([id]) => id as IdCapacite);

describe("CATALOGUE-C10-C11-v21p", () => {
  it("5 lignes FINITION (chantier 10) et 5 lignes COUVERTURE (chantier 11), états exacts", () => {
    expect(LIGNES_FINITION.map((l) => [l.id, l.etat, l.chantier])).toEqual(C10.map(([id, , etat]) => [id, etat, "10"]));
    expect(LIGNES_COUVERTURE.map((l) => [l.id, l.etat, l.chantier])).toEqual(C11.map(([id, , etat]) => [id, etat, "11"]));
  });
  it("aucune des 10 n'est prod, demande, coulisse ni absent", () => {
    for (const id of DIX) expect(["prevu", "eteint"]).toContain(ligneCapacite(id)?.etat);
  });
  it("chaque id : une fois dans ID (clé camelCase), une fois au catalogue", () => {
    for (const [id, cle] of [...C10, ...C11]) {
      expect((ID as Record<string, string>)[cle], cle).toBe(id);
      expect(Object.values(ID).filter((v) => v === id), id).toHaveLength(1);
      expect(CATALOGUE_CAPACITES.filter((l) => l.id === id), id).toHaveLength(1);
    }
  });
  it("aucun profil ne les permet ; porteCapacite ne rend jamais permis", () => {
    const profils = [...Object.values(PROFILS_DU_CODE), profilNeutre("podcast")];
    for (const p of profils) for (const id of DIX) expect(p.capacites[id]?.permis === true, `${p.id} ${id}`).toBe(false);
    for (const id of DIX) {
      expect(porteCapacite({}, id)).toEqual({ bibliotheque: false });
      const entree = { bibliothequeVideo: { version: "bibliotheque-video/1", profil: profilNeutre("podcast"), recents: [], graine: "g", figeeLe: "2026-11-16T00:00:00.000Z" } };
      const r = porteCapacite(entree, id);
      expect(r.bibliotheque === true ? r.permis : false).toBe(false);
    }
  });
  it("les 5 lignes du chantier 10 restent prevu (la garde de liaison ne les contrôle pas)", () => {
    for (const l of LIGNES_FINITION) expect(l.etat).toBe("prevu");
  });
  it("docs/bibliotheque-video.md cite les 10 ids", () => {
    const doc = readFileSync(join(process.cwd(), "docs/bibliotheque-video.md"), "utf8");
    for (const id of DIX) expect(doc, id).toContain(`\`${id}\``);
  });
});
