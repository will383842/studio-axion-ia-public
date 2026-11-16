/**
 * G12-05 : le projet de montage garde la clé du master (sans texte) de chaque fin quand le moteur de rendu en a posé une.
 * Doubles seulement (aucun fournisseur réel). Une fin sans `masterCle` garde exactement ses anciennes clés, dans le même ordre.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs/types";
import { banc } from "./doubles";

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);
type Fin = Record<string, unknown> & { id: string; masterCle?: string };

async function jusquAuBout(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail): Promise<ResultatFabrication | undefined> {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  for (let n = 0; n < 200 && t.statut !== "termine" && t.statut !== "echec"; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
  }
  expect(t.statut).toBe("termine");
  return resultat;
}

async function fins(): Promise<Fin[]> {
  const b = banc();
  const c = b.commande();
  const r = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, { travailId: "t-master", versionId: "ver-master", titre: "Essai", maintenant: T0 }));
  return (r!.projetMontage.casConcret as { fins: Fin[] }).fins;
}

describe("G12-05 · masterCle de chaque fin au projet de montage", () => {
  it("la clé du master est gardée dans chaque fin qui en a une", async () => {
    const lesFins = await fins();
    expect(lesFins.length).toBeGreaterThan(0);
    for (const f of lesFins) expect(f.masterCle).toMatch(/master-sans-texte\.mov$/);
  });

  it("les anciennes clés restent, dans le même ordre, et aucune clé vide n'apparaît", async () => {
    for (const f of await fins()) {
      const { masterCle, ...ancien } = f;
      void masterCle;
      expect(Object.keys(ancien)).toEqual(["id", "reseaux", "fichierCle", "dureeSec", "mesures", "sousTitres"]);
      expect(JSON.stringify(f)).not.toContain("undefined");
    }
  });
});
