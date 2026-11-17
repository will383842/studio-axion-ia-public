/** X1-00 : 10 lignes `prevu` « tendances 2027 » : jamais permises, catalogue existant inchangé. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGUE_CAPACITES, ID } from "@/briques/bibliotheque-video/catalogue";
import { LIGNES_TENDANCES_2027 } from "@/briques/bibliotheque-video/catalogue/tendances-2027";
import { PROFILS_DU_CODE, profilNeutre } from "@/briques/bibliotheque-video/profils";
import { porteCapacite } from "@/briques/bibliotheque-video/moteur";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";

const DIX = [
  "texte.poids-variable", "texte.minimal-dynamique", "ecran.fenetre-inclinee", "fond.verre-depoli",
  "transition.zoom-mot", "transition.raccord-forme", "accroche.apercu-fin", "accroche.mot-cle",
  "mention.ia", "rythme.boucle",
] as IdCapacite[];

/** Instantané du catalogue de master (avant X1-00), pris ici en dur : id|etat|chantier. */
const nb = (l: { id: string }) => DIX.includes(l.id as IdCapacite);

describe("X1-00 · tendances 2027", () => {
  it("chaque identifiant : une fois dans ID, une fois au catalogue, prevu, chantier X1", () => {
    for (const id of DIX) {
      expect(Object.values(ID).filter((v) => v === id), id).toHaveLength(1);
      const l = CATALOGUE_CAPACITES.filter((x) => x.id === id);
      expect(l, id).toHaveLength(1);
      expect(l[0].etat).toBe("prevu");
      expect(l[0].chantier).toBe("X1");
    }
    expect(LIGNES_TENDANCES_2027).toHaveLength(10);
  });
  it("aucune ligne permise, aucune chaîne objet.", () => {
    for (const l of LIGNES_TENDANCES_2027) {
      expect("permis" in l).toBe(false);
      expect(l.id.startsWith("objet.")).toBe(false);
    }
    const src = readFileSync(join(process.cwd(), "src/briques/bibliotheque-video/catalogue/tendances-2027.ts"), "utf8");
    expect(src.includes("objet.")).toBe(false);
  });
  it("aucun profil ne permet l'un des 10 ; porteCapacite ne donne jamais permis", () => {
    const profils = [...Object.values(PROFILS_DU_CODE), profilNeutre("podcast")];
    for (const p of profils) for (const id of DIX) expect(p.capacites[id]?.permis === true, `${p.id} ${id}`).toBe(false);
    for (const id of DIX) {
      expect(porteCapacite({}, id)).toEqual({ bibliotheque: false });
      const entree = { bibliothequeVideo: { version: "bibliotheque-video/1", profil: profilNeutre("podcast"), recents: [], graine: "g", figeeLe: "2026-11-16T00:00:00.000Z" } };
      const r = porteCapacite(entree, id);
      expect(r.bibliotheque === true ? r.permis : false).toBe(false);
    }
  });
  it("éteint = identique : sans les 10 lignes, le catalogue est celui de master (instantané)", () => {
    const hors = CATALOGUE_CAPACITES.filter((l) => !nb(l));
    expect(hors.length).toBe(CATALOGUE_CAPACITES.length - 10);
    // les 10 lignes sont en fin de catalogue : le reste est le préfixe exact
    expect(CATALOGUE_CAPACITES.slice(0, hors.length)).toEqual(hors);
    expect(CATALOGUE_CAPACITES.slice(hors.length)).toEqual(LIGNES_TENDANCES_2027);
    expect(hors.map((l) => `${l.id}|${l.etat}`)).not.toContain("mention.ia|prevu");
  });
});
