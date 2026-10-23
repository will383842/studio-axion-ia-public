/**
 * Note de S1d (fiche vidéo) : le projet de montage garde les mesures du fichier de CHAQUE fin, pas seulement celles de
 * la première sortie ; la vue y lit les dimensions réseau par réseau. Doubles seulement (aucun appel réel).
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { MoteurVideo, ResultatFabrication } from "@/moteurs/types";
import { MESURES_CONFORMES } from "../fabriquer/doubles";
import { banc } from "./doubles";

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);

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

describe("M9 · mesures de chaque fin au projet de montage", () => {
  it("chaque fin garde les mesures de son propre fichier", async () => {
    const b = banc();
    const c = b.commande();
    const r = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, { travailId: "t-mesures", versionId: "ver-mesures", titre: "Essai", maintenant: T0 }));
    const fins = (r!.projetMontage.casConcret as { fins: { id: string; dureeSec: number; mesures?: Record<string, number> }[] }).fins;
    expect(fins.length).toBeGreaterThan(1);
    for (const f of fins) {
      expect(f.mesures).toMatchObject({ largeur: MESURES_CONFORMES.largeur, hauteur: MESURES_CONFORMES.hauteur, lufs: MESURES_CONFORMES.lufs });
      expect(typeof f.mesures?.dureeSec).toBe("number");
    }
  });
});
