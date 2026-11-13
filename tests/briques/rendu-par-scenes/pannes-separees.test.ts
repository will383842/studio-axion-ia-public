/**
 * GV2-08 — rendu des cartes : une panne (exception du service ou du stockage) n'use plus les essais de rendu. Compteur
 * `pannes` séparé : 5 pannes de suite pour écarter la carte, une réponse lue le remet à zéro. Doubles seulement.
 */
import { describe, expect, it } from "vitest";
import { cartesPourFormat, type CarteFormat } from "@/briques/motion";
import { avancerCartesMotion, etatInitialCartesMotion, type OutilsRenduCartes } from "@/briques/motion/rendu-cartes";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";

const [carte] = cartesPourFormat({ format: "avocat", ratio: "9:16", phrases: [{ id: "p", texte: "On passe de 12 heures à 3 heures.", debutSec: 2, finSec: 6, place: "illustration" }] });
const cartes: CarteFormat[] = [carte];
const cle = (c: CarteFormat) => `motion/${c.id}.mp4`;

/** `pannes` : nombre de soumissions qui lèvent avant de réussir ; `etats` : réponses de lecture jouées dans l'ordre (dernière répétée). */
function doubles(pannes: number, etats: EtatRendu["statut"][]) {
  const recues: DemandeRendu[] = [];
  let aLever = pannes;
  let lectures = 0;
  const s: ServiceRendu = {
    async soumettre(d) {
      if (aLever-- > 0) throw new Error("panne réseau");
      recues.push(d);
      return { idRendu: d.idRendu };
    },
    async etat() {
      const st = etats[Math.min(lectures++, etats.length - 1)];
      if (st === "echec") return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "le serveur de rendu ne répond pas" } };
      if (st === "termine") return { statut: "termine", sortieCle: "x" };
      return { statut: "en_cours", progression: 10 };
    },
  };
  const outils: OutilsRenduCartes = { rendu: () => s, depot: async (k) => `https://r2/${k}?depot` };
  return { outils, recues };
}

describe("GV2-08 — pannes séparées des essais de rendu", () => {
  it("l'état initial n'a pas de clé `pannes`", () => {
    const etat = etatInitialCartesMotion(cartes, cle);
    for (const c of etat.cartes) expect(Object.keys(c)).not.toContain("pannes");
  });

  it("une panne réseau puis un échec de rendu : la carte est RESOUMISE (nouvel essai), pas écartée", async () => {
    const { outils, recues } = doubles(1, ["echec", "en_cours"]);
    let e = etatInitialCartesMotion(cartes, cle);
    e = await avancerCartesMotion(e, outils); // soumission : panne
    expect(e.cartes[0]).toMatchObject({ statut: "a-soumettre", pannes: 1, essais: 0 });
    e = await avancerCartesMotion(e, outils); // soumission réussie
    expect(e.cartes[0].statut).toBe("soumise");
    expect(e.cartes[0].pannes).toBe(1);
    e = await avancerCartesMotion(e, outils); // lecture : échec de rendu → nouvel essai
    expect(e.cartes[0]).toMatchObject({ statut: "soumise", essais: 1 });
    expect(e.cartes[0].pannes).toBeUndefined();
    expect(recues).toHaveLength(2);
    expect(recues[1].idRendu).toMatch(/-e1$/);
  });

  it("4 pannes réseau de suite : la carte est encore en cours ; la 5e l'écarte", async () => {
    const { outils } = doubles(99, ["termine"]);
    let e = etatInitialCartesMotion(cartes, cle);
    for (let k = 1; k <= 4; k++) {
      e = await avancerCartesMotion(e, outils);
      expect(e.cartes[0], `après ${k} pannes`).toMatchObject({ statut: "a-soumettre", pannes: k, essais: 0 });
    }
    e = await avancerCartesMotion(e, outils);
    expect(e.cartes[0].statut).toBe("echec");
  });

  it("une réponse lue remet les pannes à zéro (la clé disparaît)", async () => {
    const { outils } = doubles(2, ["en_cours", "termine"]);
    let e = etatInitialCartesMotion(cartes, cle);
    e = await avancerCartesMotion(e, outils);
    e = await avancerCartesMotion(e, outils);
    expect(e.cartes[0].pannes).toBe(2);
    e = await avancerCartesMotion(e, outils); // soumission réussie
    e = await avancerCartesMotion(e, outils); // réponse lue
    expect(e.cartes[0].pannes).toBeUndefined();
    expect(e.cartes[0].statut).toBe("soumise");
  });
});
