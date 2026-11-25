/**
 * ESS-6 : le résultat du tutoriel ne dit que le vrai. Film refusé signalé (montage inchangé), pas de vignette inventée,
 * son sans voix dit honnêtement. Doubles seulement : aucun rendu réel, 0 €.
 */
import { describe, expect, it } from "vitest";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil } from "@/moteurs/montage-tutoriel-outil";
import { messageFilmRefuse } from "@/moteurs/montage-tutoriel-outil/index";
import { lireEntreesTutoriel } from "@/moteurs/montage-tutoriel-outil/entrees";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

const T0 = Date.UTC(2026, 10, 25, 9);

const film = (cibles?: unknown[]) => ({
  version: "navigation-filmee.v1",
  videoCle: "studio/test/film.mp4",
  maquette: "tableau",
  largeur: 1080,
  hauteur: 1350,
  debutFilmMs: 400,
  dureeVoixMs: 60000,
  cibles: cibles ?? [
    { etapeId: "e1", zonePct: { x: 10, y: 10, largeur: 30, hauteur: 12 }, instantMs: 3000, finMs: 5000 },
    { etapeId: "e2", zonePct: { x: 60, y: 50, largeur: 30, hauteur: 12 }, instantMs: 8000, finMs: 10000 },
  ],
});
/** Les deux cibles de l'essai du 25/11 : zone qui dépasse 100 %. */
const horsCadre = () => film([
  { etapeId: "e1", zonePct: { x: 10, y: 10, largeur: 30, hauteur: 12 }, instantMs: 3000, finMs: 5000 },
  { etapeId: "e2", zonePct: { x: 27.96, y: 50, largeur: 81.8, hauteur: 12 }, instantMs: 8000, finMs: 10000 },
]);

const commande = (entrees: Record<string, unknown>): CommandeFabrication => commandeTutoriel({ entrees: { tutorielOutil: { scriptColle: true, ...entrees } } });

async function fabriquer(c: CommandeFabrication) {
  const j: Journal = { voix: [], claude: [], rendus: [] };
  const moteur = creerMoteurTutorielOutil({ outils: une(outilsDoubles(j)) });
  let t: Travail = await moteur.lancer(c, { travailId: "t-ess6", versionId: "ver-1", titre: "Tuto", maintenant: T0 });
  let resultat;
  for (let i = 0; i < 400; i++) {
    const r = await moteur.avancer(t, c, T0 + i * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (["termine", "echec", "annule"].includes(t.statut)) break;
  }
  return { travail: t, resultat: resultat!, compositions: j.rendus.filter((d) => d.operation === "composition") };
}
const alertes = (r: Awaited<ReturnType<typeof fabriquer>>) => r.resultat.noteQualite.alertes;

describe("film de navigation refusé : dit, jamais avalé", () => {
  it("lecture : le refus est exposé (erreurs du lecteur, bornées) et le film reste absent", () => {
    const e = lireEntreesTutoriel({ tutorielOutil: { navigationFilmee: horsCadre() } });
    expect(e.navigationFilmee).toBeUndefined();
    expect(e.navigationRefusee).toEqual(["Cible 2 : zone hors de 0 à 100 %."]);
    const beaucoup = lireEntreesTutoriel({ tutorielOutil: { navigationFilmee: film(Array.from({ length: 8 }, (_, i) => ({ etapeId: `e${i}`, zonePct: { x: 90, y: 0, largeur: 50, hauteur: 5 }, instantMs: 1000 * (i + 1), finMs: 1000 * (i + 1) + 500 }))) } });
    // 3 raisons montrées + 1 gardée pour savoir qu'il y en avait d'autres.
    expect(beaucoup.navigationRefusee!.length).toBe(4);
  });

  it("refusé : alerte « attention » lisible, montage sans film inchangé", async () => {
    const sans = await fabriquer(commande({}));
    const r = await fabriquer(commande({ navigationFilmee: horsCadre() }));
    expect(r.travail.statut).toBe("termine");
    const a = alertes(r).filter((x) => x.message.includes("film refusé"));
    expect(a).toHaveLength(1);
    expect(a[0].gravite).toBe("attention");
    expect(a[0].message).toBe("À vérifier · Navigation : film refusé (Cible 2 : zone hors de 0 à 100 %). La vidéo a été montée sans le film. Refaites la capture, puis déposez de nouveau le film.");
    expect(r.resultat.sorties[0].rapportQualite.alertes.some((x) => x.message.includes("film refusé"))).toBe(true);
    // Le montage est celui d'une vidéo sans film, octet pour octet.
    expect(r.compositions.map((d) => d.entrees)).toEqual(sans.compositions.map((d) => d.entrees));
    expect(r.compositions.map((d) => d.parametres)).toEqual(sans.compositions.map((d) => d.parametres));
    expect(alertes(sans).some((x) => x.message.includes("film refusé"))).toBe(false);
  });

  it("messageFilmRefuse : « … » seulement s'il y a plus de 3 erreurs, aucun code brut", () => {
    const fin = " La vidéo a été montée sans le film. Refaites la capture, puis déposez de nouveau le film.";
    expect(messageFilmRefuse(["A."])).toBe(`À vérifier · Navigation : film refusé (A).${fin}`);
    expect(messageFilmRefuse(["A.", "B.", "C."])).toBe(`À vérifier · Navigation : film refusé (A ; B ; C).${fin}`);
    expect(messageFilmRefuse(["A.", "B.", "C.", "D."])).toBe(`À vérifier · Navigation : film refusé (A ; B ; C…).${fin}`);
    const technique = messageFilmRefuse(["Version inconnue (attendu navigation-filmee.v1).", "La navigation filmée n'est pas un objet.", "La clé du film doit finir par .mp4 ou .webm."]);
    expect(technique).not.toMatch(/navigation-filmee|v1|clé/);
  });

  it("de bout en bout, plus de 3 erreurs : « … » dans l'alerte", async () => {
    const cibles = Array.from({ length: 5 }, (_, i) => ({ etapeId: `e${i}`, zonePct: { x: 90, y: 0, largeur: 50, hauteur: 5 }, instantMs: 1000 * (i + 1), finMs: 1000 * (i + 1) + 500 }));
    const r = await fabriquer(commande({ navigationFilmee: film(cibles) }));
    const a = alertes(r).filter((x) => x.message.includes("film refusé"));
    expect(a).toHaveLength(1);
    expect(a[0].message).toContain("Cible 1 : zone hors de 0 à 100 % ; Cible 2 : zone hors de 0 à 100 % ; Cible 3 : zone hors de 0 à 100 %…)");
  });

  it("valable : aucune alerte de refus", async () => {
    const r = await fabriquer(commande({ navigationFilmee: film() }));
    expect(r.travail.statut).toBe("termine");
    expect(alertes(r).some((x) => x.message.includes("film refusé"))).toBe(false);
    expect(lireEntreesTutoriel({ tutorielOutil: { navigationFilmee: film() } }).navigationRefusee).toBeUndefined();
  });
});

describe("résultat sans mensonge", () => {
  it("sans vignette produite : aucune clé .jpg inventée", async () => {
    const r = await fabriquer(commande({}));
    for (const s of r.resultat.sorties) {
      expect(s.vignetteCle).toBe("");
      expect(s.vignetteCle).not.toMatch(/\.jpg$/);
    }
    expect(alertes(r).some((x) => x.message === "Vignette non produite")).toBe(true);
  });

  it("sans voix : le son n'est pas déclaré vérifié et l'alerte dit que la valeur est la cible", async () => {
    const r = await fabriquer(commande({ modeVoix: "sans-voix" }));
    expect(r.travail.statut).toBe("termine");
    for (const s of r.resultat.sorties) expect(s.rapportQualite.verifie.son).toBe(false);
    expect(alertes(r).map((x) => x.message)).toContain("Son : vidéo sans voix, aucun niveau mesuré (la valeur affichée est la cible)");
  });
});
