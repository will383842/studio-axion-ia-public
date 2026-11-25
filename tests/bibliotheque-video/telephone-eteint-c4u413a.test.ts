/**
 * C4-U4.13a 19/11 : « téléphone qui joue un extrait » passe de « prévu » à « éteint » (livré, éteint).
 * Aucune vidéo ne change : la permission ne dépend pas de `prevu`/`eteint` (permissions.ts n'écarte que `coulisse` et `absent`).
 */
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

describe("C4-U4.13a · téléphone qui joue un extrait : livré, éteint", () => {
  beforeEach(() => reinitialiserDepots());

  it("(a) le téléphone est « eteint », la mosaïque reste « prevu », le clip v4 reste « prod »", () => {
    expect(etatCapacite(ID.ecranTelephoneExtrait)).toBe("eteint");
    expect(etatCapacite(ID.ecranMosaiqueExtraits)).toBe("eteint"); // C4-U4.13-b-v20j : livrée, éteinte (la mosaïque a suivi)
    expect(etatCapacite(ID.ecranClipV4)).toBe("prod");
  });

  it("(b) la permission ne change pas : avec ou sans la capacité listée, même graine et mêmes récents", async () => {
    const sans = await entree(true);
    const avec = await entree({ capacites: ["ecran.telephone-extrait"] });
    expect(sans.profil.capacites[ID.ecranTelephoneExtrait]?.permis).not.toBe(true);
    expect(avec.profil.capacites[ID.ecranTelephoneExtrait]?.permis).toBe(true);
    expect(avec.graine).toEqual(sans.graine);
    expect(avec.recents).toEqual(sans.recents);
  });

  it("(c) aucune ligne écran n'est « prod » en plus du clip v4", () => {
    const prod = LIGNES_ECRAN.filter((l) => l.etat === "prod").map((l) => l.id);
    expect(prod).toEqual([ID.ecranClipV4]);
  });
});
