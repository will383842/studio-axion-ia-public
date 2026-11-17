/**
 * FIX-CC-ESTIMATION (essai réel du 17/11, vidéo v-fe27e3b8e5ba) · une reprise remet l'horloge à zéro.
 *
 * « Valider ce script » relance le MÊME travail (`reessayer`). Avant : `debuteLe` et `finEstimee` restaient ceux du
 * premier lancement, donc l'écran affichait « encore 135 min » pour quelques minutes de travail. Attendu : à la
 * reprise, `debuteLe` = maintenant et `finEstimee` = maintenant + durées des seules étapes non terminées.
 * Doubles seulement, aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import type { Travail } from "@/domaine/types";
import { minutesRestantes } from "@/domaine/suivi";
import { etapesCasConcret } from "@/moteurs/montage-cas-concret";
import { banc } from "./doubles";

const T0 = Date.UTC(2026, 10, 17, 15, 37, 0);
const H = 3_600_000;
const MIN = 60_000;
const ctx = { travailId: "t-horloge", versionId: "ver-horloge", titre: "Essai", maintenant: T0 };

async function creerEnEchec(terminees: string[], enEchec: string) {
  const b = banc();
  const c = b.commande();
  const lance = await b.moteur.lancer(c, ctx);
  const t: Travail = {
    ...lance,
    statut: "echec",
    etapes: lance.etapes.map((e) => (terminees.includes(e.cle) ? { ...e, statut: "terminee" as const, progression: 100 } : e.cle === enEchec ? { ...e, statut: "echec" as const } : e)),
  };
  const defs = etapesCasConcret(c);
  const somme = (cles: string[]) => defs.filter((d) => cles.includes(d.cle)).reduce((s, d) => s + d.dureeEstimeeSec, 0) * 1000;
  return { b, t, defs, somme };
}

describe("FIX-CC-ESTIMATION · reprise = horloge à zéro", () => {
  it("a) debuteLe = reprise ; finEstimee après la reprise, au plus la somme de toutes les étapes", async () => {
    const { b, t, defs, somme } = await creerEnEchec([], "ecriture");
    expect(t.debuteLe).toBe(new Date(T0).toISOString());
    const reprise = T0 + 4 * H;
    const repris = await b.moteur.reessayer(t, reprise);
    expect(repris.debuteLe).toBe(new Date(reprise).toISOString());
    const fin = new Date(repris.finEstimee as string).getTime();
    expect(fin).toBeGreaterThan(reprise);
    expect(fin).toBeLessThanOrEqual(reprise + somme(defs.map((d) => d.cle)));
  });

  it("b) 5 min après la reprise, à 64 % : « encore » ≤ 15 min (avant : plus de 130)", async () => {
    const { b, t } = await creerEnEchec([], "ecriture");
    const reprise = T0 + 4 * H;
    const repris = await b.moteur.reessayer(t, reprise);
    const affiche: Travail = { ...repris, statut: "en_cours", progression: 64 };
    expect(minutesRestantes(affiche, reprise + 5 * MIN)).toBeLessThanOrEqual(15);
  });

  it("c) les étapes déjà terminées ne comptent pas dans finEstimee", async () => {
    const faites = ["ecriture", "fiche", "captures", "voix", "calage"];
    const { b, t, defs, somme } = await creerEnEchec(faites, "ecrans");
    const toutes = await creerEnEchec([], "ecriture");
    const reprise = T0 + 4 * H;
    const repris = await b.moteur.reessayer(t, reprise);
    const complet = await toutes.b.moteur.reessayer(toutes.t, reprise);
    const reste = new Date(repris.finEstimee as string).getTime() - reprise;
    expect(reste).toBeGreaterThan(0);
    expect(reste).toBeLessThanOrEqual(somme(defs.map((d) => d.cle).filter((k) => !faites.includes(k))));
    expect(reste).toBeLessThan(new Date(complet.finEstimee as string).getTime() - reprise);
  });

  it("seule l'horloge change : aucun autre champ du travail rendu", async () => {
    const { b, t } = await creerEnEchec([], "ecriture");
    const reprise = T0 + 4 * H;
    const repris = await b.moteur.reessayer(t, reprise);
    const { debuteLe, finEstimee, ...autres } = repris;
    void debuteLe;
    void finEstimee;
    expect(autres.statut).toBe("en_cours");
    expect(autres.tentatives).toBe(t.tentatives + 1);
    expect(autres.modifieLe).toBe(new Date(reprise).toISOString());
    expect(autres.creeLe).toBe(t.creeLe);
  });
});
