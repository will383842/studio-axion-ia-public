/**
 * C4-U4.13-b-v20j : « mosaïque d'extraits » passe de « prévu » à « éteint » (livré, branché, éteint).
 * Aucune vidéo ne change : la permission ne dépend pas de `prevu`/`eteint` (permissions.ts n'écarte que `coulisse` et `absent`).
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { ID, etatCapacite } from "@/briques/bibliotheque-video/catalogue";
import { LIGNES_ECRAN } from "@/briques/bibliotheque-video/catalogue/ecran";
import { reinitialiserDepots } from "@/donnees/memoire";
import { ecrireParametre } from "@/services/_commun";
import { entreeBibliothequeDuLancement } from "@/services/bibliotheque-video";

type Entree = { profil: { capacites: Record<string, { permis?: boolean } | undefined> }; graine: unknown; recents: unknown };

async function entree(reglage: unknown): Promise<Entree> {
  reinitialiserDepots();
  await ecrireParametre("bibliothequeVideo.facecam-animee", reglage);
  const r = await entreeBibliothequeDuLancement({ id: "v-test", formatId: "facecam-animee" });
  return Object.values(r)[0] as Entree;
}

describe("C4-U4.13-b-v20j · mosaïque d'extraits : livrée, branchée, éteinte", () => {
  beforeEach(() => reinitialiserDepots());

  it("(a) la mosaïque est « eteint », le téléphone reste « eteint », le clip v4 reste « prod »", () => {
    expect(etatCapacite(ID.ecranMosaiqueExtraits)).toBe("eteint");
    expect(etatCapacite(ID.ecranTelephoneExtrait)).toBe("eteint");
    expect(etatCapacite(ID.ecranClipV4)).toBe("prod");
  });

  it("(b) la permission ne change pas : avec ou sans la capacité listée, même graine et mêmes récents", async () => {
    const sans = await entree(true);
    const avec = await entree({ capacites: ["ecran.mosaique-extraits"] });
    expect(sans.profil.capacites[ID.ecranMosaiqueExtraits]?.permis).not.toBe(true);
    expect(avec.profil.capacites[ID.ecranMosaiqueExtraits]?.permis).toBe(true);
    expect(avec.graine).toEqual(sans.graine);
    expect(avec.recents).toEqual(sans.recents);
  });

  it("(c) le branchement existe, réglage éteint par défaut, et aucune ligne écran n'est « prod » en plus du clip v4", () => {
    const src = readFileSync("src/services/facecam-animee.ts", "utf8");
    expect(src).toMatch(/lireParametre<unknown>\(PARAM_EXTRAITS_MAISON_FA, false\)\) === true/);
    const prod = LIGNES_ECRAN.filter((l) => l.etat === "prod").map((l) => l.id);
    expect(prod).toEqual([ID.ecranClipV4]);
  });
});
