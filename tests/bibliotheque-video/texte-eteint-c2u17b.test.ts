/**
 * C2-U17b 18/11 : les 7 capacités de texte livrées passent de « prévu » à « éteint » (livrées, éteintes).
 * Aucune vidéo ne change : la permission ne dépend pas de `prevu`/`eteint` (permissions.ts n'écarte que `coulisse` et `absent`).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ID, etatCapacite } from "@/briques/bibliotheque-video/catalogue";
import { reinitialiserDepots } from "@/donnees/memoire";
import { ecrireParametre } from "@/services/_commun";
import { entreeBibliothequeDuLancement } from "@/services/bibliotheque-video";
import type { IdCapacite } from "@/briques/bibliotheque-video/types";

const SEPT = [
  ID.textePave,
  ID.texteNomOutil,
  ID.texteNomOutilAutonome,
  ID.texteBandeauNom,
  ID.texteRepereEpaule,
  ID.texteSortieAnimee,
  ID.texteEscalier,
] as const;

type Entree = { profil: { capacites: Record<string, { permis?: boolean } | undefined> }; graine: unknown; recents: unknown };

async function entreeAvocat(reglage: unknown): Promise<Entree> {
  reinitialiserDepots();
  await ecrireParametre("bibliothequeVideo.avocat", reglage);
  const r = await entreeBibliothequeDuLancement({ id: "v-test", formatId: "avocat" });
  return Object.values(r)[0] as Entree;
}

describe("C2-U17b · 7 capacités de texte livrées : éteintes", () => {
  beforeEach(() => reinitialiserDepots());

  it("(a) les 7 sont « eteint »", () => {
    for (const id of SEPT) expect(etatCapacite(id as IdCapacite), id).toBe("eteint");
  });

  it("(b) la permission ne change pas : avec true aucune des 7, avec la liste exactement les 2 listées, graine et récents identiques", async () => {
    const sans = await entreeAvocat(true);
    const avec = await entreeAvocat({ capacites: ["texte.nom-outil-autonome", "texte.sortie-animee"] });
    const permises = (e: Entree) => SEPT.filter((id) => e.profil.capacites[id]?.permis === true);
    expect(permises(sans)).toEqual([]);
    expect(permises(avec)).toEqual([ID.texteNomOutilAutonome, ID.texteSortieAnimee]);
    expect(avec.graine).toEqual(sans.graine);
    expect(avec.recents).toEqual(sans.recents);
  });

  it("(c) aucune des 7 n'est « prod »", () => {
    for (const id of SEPT) expect(etatCapacite(id as IdCapacite), id).not.toBe("prod");
  });
});
