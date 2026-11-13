/**
 * GV2-23 : un travail du serveur de montage « en cours » qui n'avance plus est relancé (autre identifiant), puis échoue
 * avec son message. Horloge simulée ; on se fonde sur l'absence de PROGRÈS, jamais sur la durée totale.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication } from "@/domaine/types";
import { creerFacecamSimule } from "@/fournisseurs/facecam";
import type { EtatTravailFacecam, RouteFacecam } from "@/fournisseurs/facecam/client";
import { avancerChaine, etatChaineInitial, type DependancesChaine, type EtatChaine } from "@/moteurs/montage-facecam/chaine";
import { delaiSansProgresMs, veilleProgres } from "@/moteurs/montage-facecam/reprise";

const MIN = 60_000;
const commande = {
  videoId: "v-fc",
  formatId: "facecam",
  moteurId: "montage-facecam",
  ratios: ["9:16"],
  dureeCibleSec: 60,
  script: { blocs: [], texteComplet: "Bonjour, je vous parle de la formation. C'est faux." },
  distribution: [{ role: "Face caméra", source: "rush" }],
  prises: [{ id: "p1", partie: "version", cle: "studio/prod/rush/v-fc/prise-1.mov", mime: "video/quicktime", dureeSec: 60, segmentIds: [] }],
  briques: { etalonnage: true, "sous-titres": true, "mention-ia": false },
  styles: { lut: null },
  entrees: {},
  reglages: {},
  plans: [],
  prononciations: [],
} as unknown as CommandeFabrication;

/** La transcription répond ce que dit `reponse()` ; le reste est le double habituel. */
function monter(reponse: () => EtatTravailFacecam, laRoute: RouteFacecam = "transcrire") {
  const facecam = creerFacecamSimule();
  let horloge = 0;
  const deps: DependancesChaine = {
    facecam: { ...facecam, suivre: async (route: RouteFacecam, id: string) => (route === laRoute ? reponse() : facecam.suivre(route, id)) } as typeof facecam,
    maintenant: () => horloge,
  };
  const tour = async (etat: EtatChaine, avanceMs: number) => {
    horloge += avanceMs;
    return avancerChaine(etat, commande, { travailId: "t-1", versionId: "ver-1" }, deps);
  };
  const identifiants = () => facecam.soumises.filter((s) => s.route === "transcrire").map((s) => s.demande.idTravail);
  return { tour, identifiants };
}

describe("GV2-23 · décision pure « figé depuis N min ? »", () => {
  const t = { id: "a", statut: "soumis" as const, essais: 0 };
  it("première lecture, ou progression qui bouge : jamais figé", () => {
    const a = veilleProgres(t, 62, 0, 20 * MIN);
    expect(a.fige).toBe(false);
    expect(veilleProgres(a.suivi, 63, 30 * MIN, 20 * MIN).fige).toBe(false);
  });
  it("même progression depuis 20 min : figé ; avant : non", () => {
    const a = veilleProgres(t, 62, 0, 20 * MIN);
    expect(veilleProgres(a.suivi, 62, 19 * MIN, 20 * MIN).fige).toBe(false);
    expect(veilleProgres(a.suivi, 62, 20 * MIN, 20 * MIN)).toMatchObject({ fige: true, depuisMin: 20 });
  });
  it("délai réglable par variable d'environnement, 20 min par défaut", () => {
    expect(delaiSansProgresMs({})).toBe(20 * MIN);
    expect(delaiSansProgresMs({ STUDIO_FACECAM_SANS_PROGRES_MIN: "5" })).toBe(5 * MIN);
    expect(delaiSansProgresMs({ STUDIO_FACECAM_SANS_PROGRES_MIN: "0" })).toBe(20 * MIN);
  });
});

describe("GV2-23 · la chaîne face caméra relance un travail figé", () => {
  it("à 62 % pendant 25 min : nouvelle soumission sous un autre identifiant ; encore figé : échec de la brique avec message", async () => {
    const { tour, identifiants } = monter(() => ({ statut: "en_cours", progression: 62 }));
    let etat = etatChaineInitial();
    etat = await tour(etat, 0);
    expect(identifiants()).toHaveLength(1);
    const premier = identifiants()[0];
    for (let i = 0; i < 5; i++) etat = await tour(etat, 5 * MIN); // 25 min à 62 %
    const ids = identifiants();
    expect(ids.length).toBe(2);
    expect(ids[1]).not.toBe(premier);
    expect(etat.echec).toBeUndefined();
    // Même règle que tout échec réessayable de la chaîne : ESSAIS_MAX (2) relances au plus, soit 3 soumissions en tout.
    for (let i = 0; i < 12; i++) etat = await tour(etat, 5 * MIN);
    expect(identifiants()).toHaveLength(3);
    expect(new Set(identifiants()).size).toBe(3);
    // L'échec habituel de la brique (la transcription manquante devient un saut « Les coupes »), avec le message du délai.
    expect(etat.travaux.transcrire).toMatchObject({ statut: "echec", erreur: { reessayable: false, message: expect.stringMatching(/n'a pas avancé depuis/) } });
    expect(etat.sauts.map((x) => x.brique)).toContain("Les coupes");
  });

  it("le son figé échoue pour de bon avec son message (une vidéo sans son n'est pas livrable)", async () => {
    const { tour } = monter(() => ({ statut: "en_cours", progression: 30 }), "son");
    let etat = etatChaineInitial();
    for (let i = 0; i < 40 && !etat.echec; i++) etat = await tour(etat, 5 * MIN);
    expect(etat.echec?.brique).toBe("son");
    expect(etat.echec?.message).toMatch(/n'a pas avancé depuis/);
  });

  it("progression qui bouge : rien n'est relancé", async () => {
    let p = 10;
    const { tour, identifiants } = monter(() => ({ statut: "en_cours", progression: (p += 1) }));
    let etat = etatChaineInitial();
    for (let i = 0; i < 12; i++) etat = await tour(etat, 5 * MIN); // 1 h
    expect(identifiants()).toHaveLength(1);
    expect(etat.echec).toBeUndefined();
  });

  it("« en_file » pendant 2 h : rien n'est relancé, et le décompte repart à zéro quand le travail démarre", async () => {
    let etatServeur: EtatTravailFacecam = { statut: "en_file" };
    const { tour, identifiants } = monter(() => etatServeur);
    let etat = etatChaineInitial();
    for (let i = 0; i < 24; i++) etat = await tour(etat, 5 * MIN); // 2 h
    expect(identifiants()).toHaveLength(1);
    expect(etat.echec).toBeUndefined();
    etatServeur = { statut: "en_cours", progression: 5 };
    for (let i = 0; i < 3; i++) etat = await tour(etat, 5 * MIN); // 15 min seulement depuis le départ
    expect(identifiants()).toHaveLength(1);
  });

  it("le premier identifiant du travail ne change pas (clés de cache intactes)", async () => {
    const { tour, identifiants } = monter(() => ({ statut: "en_cours", progression: 62 }));
    await tour(etatChaineInitial(), 0);
    expect(identifiants()[0]).toBe("t-1-transcrire");
  });
});
