/**
 * G4-06-c-v21m : le moteur « tableau de bord » reçoit le port de narration de Claude (injecté, jamais importé).
 * Doubles seulement : aucun appel réel, 0 €. DONNÉE ENTIÈREMENT FICTIVE.
 */
import { describe, expect, it, vi } from "vitest";
import { narrationModele } from "../../../src/briques/donnees-video/narration-modele";
import { lireEntreesDonnees } from "../../../src/moteurs/montage-donnees/entrees";
import { creerMoteurDonnees, ID_MOTEUR_DONNEES, type DependancesDonnees } from "../../../src/moteurs/montage-donnees";
import type { CommandeFabrication, Travail } from "../../../src/domaine/types";
import type { MoteurVideo } from "../../../src/moteurs/types";

const T0 = Date.UTC(2026, 10, 21, 9, 0, 0);
const MARQUE = "Narration par l'IA indisponible : texte modèle.";

const donnee = {
  version: "tableau-de-bord.v1",
  titre: "Tableau exemple",
  periode: { debut: "2026-01-01", fin: "2026-03-31", libelle: "premier trimestre exemple" },
  source: "Outil exemple",
  indicateurs: [
    { id: "ca-fevrier", libelle: "Chiffre d'affaires de février", valeur: 10200, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "ca-mars", libelle: "Chiffre d'affaires de mars", valeur: 12480, unite: "€", precision: 0, sens: "hausse-bonne" },
    { id: "visites", libelle: "Visites du site", valeur: 3450, unite: "visites", precision: 0, sens: "hausse-bonne" },
  ],
  series: [],
  comparaisons: [{ avant: "ca-fevrier", apres: "ca-mars" }],
  alertes: [],
  calculs: [],
};

const commande = (): CommandeFabrication =>
  ({
    formatId: "tableau-de-bord",
    moteurId: ID_MOTEUR_DONNEES,
    ratios: ["16:9"],
    entrees: { montageDonnees: { donnee, muette: true } },
  }) as unknown as CommandeFabrication;

async function mener(moteur: MoteurVideo, c: CommandeFabrication) {
  let t: Travail = await moteur.lancer(c, { travailId: "t-narr", versionId: "v", titre: "Essai", maintenant: T0 });
  let resultat;
  for (let ms = T0; ms < T0 + 60_000; ms += 500) {
    const r = await moteur.avancer(t, c, ms);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") break;
  }
  return { travail: t, resultat };
}

const monter = async () => ({ fichierCle: "essai/donnees/16x9.mp4" });
const messages = (r: Awaited<ReturnType<typeof mener>>["resultat"]) => (r?.noteQualite.alertes ?? []).map((a) => a.message);

describe("G4-06-c · le moteur passe le port narration à la chaîne", () => {
  it("port double : appelé une fois avec la donnée lue, et son texte est celui de la vidéo", async () => {
    const lue = lireEntreesDonnees({ montageDonnees: { donnee, muette: true } });
    expect(lue.ok).toBe(true);
    const narration = vi.fn(async (d: Parameters<typeof narrationModele>[0]) => ({ ...narrationModele(d), remarques: ["narration double reçue"] }));
    const deps: DependancesDonnees = { monter, narration };
    const fin = await mener(creerMoteurDonnees(() => deps), commande());
    expect(fin.travail.statut).toBe("termine");
    expect(narration).toHaveBeenCalledTimes(1);
    expect(narration.mock.calls[0][0].titre).toBe("Tableau exemple");
    expect(messages(fin.resultat)).toContain("narration double reçue");
    expect(messages(fin.resultat)).not.toContain(MARQUE);
  });

  it("port qui rend null : retombe sur la narration gratuite, avec la remarque", async () => {
    const narration = vi.fn(async () => null);
    const fin = await mener(creerMoteurDonnees(() => ({ monter, narration })), commande());
    expect(fin.travail.statut).toBe("termine");
    expect(narration).toHaveBeenCalledTimes(1);
    expect(messages(fin.resultat)).toContain(MARQUE);
  });

  it("port qui échoue : même repli gratuit, la vidéo se fait", async () => {
    const narration = vi.fn(async () => {
      throw new Error("panne");
    });
    const fin = await mener(creerMoteurDonnees(() => ({ monter, narration })), commande());
    expect(fin.travail.statut).toBe("termine");
    expect(messages(fin.resultat)).toContain(MARQUE);
  });

  it("sans port : identique à avant, aucune remarque de narration", async () => {
    const fin = await mener(creerMoteurDonnees(() => ({ monter })), commande());
    expect(fin.travail.statut).toBe("termine");
    expect(messages(fin.resultat)).not.toContain(MARQUE);
  });
});
