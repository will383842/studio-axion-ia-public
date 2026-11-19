/**
 * T-EXT-27b : le pas « regarder » dans la chaîne du tutoriel. Doubles seulement : aucun appel à Claude, aucun rendu réel, 0 €.
 * Sans `outils.regarder` : état et demandes comme avant. Avec : UN regard, après le rendu du 4:5, jamais ailleurs.
 */
import { describe, expect, it } from "vitest";
import type { InstantRegard, LectureRegard } from "@/briques/regardeur";
import { avancerEtape, etatInitial, ETAPES_TUTORIEL, type CleEtapeTutoriel, type EtatTutoriel, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil/chaine";
import type { DemandeRendu } from "@/fournisseurs/types";
import { commandeTutoriel, outilsDoubles, type Journal } from "./doubles";

const RESERVE = "À vérifier · Les images n'ont pas pu être relues.";
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });

/** Avance l'étape `cle` jusqu'à « faite » (au plus 50 pas), sans jamais dépasser. */
async function faire(cle: CleEtapeTutoriel, etat: EtatTutoriel, o: OutilsTutoriel) {
  const c = commandeTutoriel();
  let e = etat;
  for (let i = 0; i < 50; i++) {
    const r = await avancerEtape(cle, e, c, o, "t-regard");
    e = r.etat;
    if (r.statut === "faite") return { etat: e, pas: i + 1 };
  }
  throw new Error(`l'étape ${cle} ne finit pas`);
}

async function jusquaMontage(o: OutilsTutoriel, avecRegard: boolean) {
  let e = etatInitial(commandeTutoriel());
  for (const cle of ETAPES_TUTORIEL) {
    e = (await faire(cle, e, o)).etat;
    if (cle === "montage") break;
  }
  void avecRegard;
  return e;
}

/** Lecture sans défaut : chaque image rendue « lue » avec les textes que le plan permet (rien d'écrit à l'écran). */
const lectureSansDefaut = (instants: InstantRegard[]): LectureRegard => ({ images: instants.map((i) => ({ nom: i.nom, textes: [], sousTitre: null, pageVide: false, noire: false, illisible: false })) });

describe("T-EXT-27b : chaîne, sans regard (éteint)", () => {
  it("sans `outils.regarder` : aucun regard dans l'état, mêmes demandes qu'avec un regard absent", async () => {
    const j = journalVide();
    const e = await jusquaMontage(outilsDoubles(j), false);
    expect(e.regard).toBeUndefined();
    expect(e.grille).toBeUndefined();
    expect(e.appelsClaude?.regard).toBeUndefined();
    expect(e.reserves).not.toContain(RESERVE);
    expect(j.rendus.filter((d) => d.operation === "image-fixe")).toEqual([]);
    expect(Object.keys(e)).not.toContain("regard");
  });
});

describe("T-EXT-27b : le regard n'ajoute que sa part", () => {
  it("hors `regard` et son compteur, l'état et les demandes de rendu sont ceux d'aujourd'hui", async () => {
    const sans = journalVide();
    const avec = journalVide();
    const eSans = await jusquaMontage(outilsDoubles(sans), false);
    const eAvec = await jusquaMontage({ ...outilsDoubles(avec), regarder: async (x) => lectureSansDefaut(x.instants) }, true);
    const { regard: _r, ...reste } = eAvec;
    void _r;
    const prive = { ...reste, appelsClaude: { ...reste.appelsClaude!, regard: undefined } };
    expect(JSON.parse(JSON.stringify(prive))).toEqual(JSON.parse(JSON.stringify(eSans)));
    expect(avec.rendus).toEqual(sans.rendus);
  });
});

describe("T-EXT-27b : chaîne, avec regard", () => {
  it("UN regard après le rendu du 4:5 ; jamais à l'étape « exports » ni sur une reprise", async () => {
    const j = journalVide();
    const appels: { demandeMaitre: DemandeRendu; instants: InstantRegard[] }[] = [];
    const o: OutilsTutoriel = { ...outilsDoubles(j), regarder: async (x) => (appels.push(x), lectureSansDefaut(x.instants)) };
    let e = await jusquaMontage(o, true);
    expect(appels).toHaveLength(1);
    expect(appels[0].demandeMaitre.operation).toBe("composition");
    expect(appels[0].demandeMaitre.idRendu).toContain("4x5");
    expect(appels[0].instants.length).toBeGreaterThan(0);
    expect(appels[0].instants.length).toBeLessThanOrEqual(12);
    expect(e.regard?.instants).toBe(appels[0].instants.length);
    expect(e.regard?.relues).toBe(appels[0].instants.length);
    expect(e.appelsClaude?.regard).toBe(1);
    // Reprise du montage (« Réessayer ») : le regard n'est jamais rappelé.
    e = (await faire("montage", e, o)).etat;
    expect(appels).toHaveLength(1);
    // Étape « exports » : jamais de regard.
    e = (await faire("exports", e, o)).etat;
    expect(appels).toHaveLength(1);
    expect(e.appelsClaude?.regard).toBe(1);
  });

  it("lecture sans défaut : aucun défaut bloquant dans le verdict", async () => {
    const o: OutilsTutoriel = { ...outilsDoubles(journalVide()), regarder: async (x) => lectureSansDefaut(x.instants) };
    const e = await jusquaMontage(o, true);
    expect(e.regard!.verdict.defauts.filter((d) => d.bloquantSiSur && d.code !== "fin-absente" && d.code !== "page-vide")).toEqual([]);
    expect(e.regard!.verdict.nonRelues).toBe(0);
    expect(e.reserves).not.toContain(RESERVE);
  });

  it.each([["lecture nulle", async () => null], ["exception", async () => { throw new Error("panne du regard"); }]])("%s : réserve « À vérifier », fabrication terminée normalement, rien compté", async (_nom, regarder) => {
    const o: OutilsTutoriel = { ...outilsDoubles(journalVide()), regarder: regarder as OutilsTutoriel["regarder"] };
    const e = await jusquaMontage(o, true);
    expect(e.reserves.filter((r) => r === RESERVE)).toHaveLength(1);
    expect(e.rendus[0].sortie).toBeDefined();
    expect(e.regard?.relues).toBe(0);
    expect(e.regard!.verdict.nonRelues).toBe(e.regard!.instants);
    expect(e.appelsClaude?.regard).toBeUndefined();
    // Une fois par version : rejouer le montage ne ré-appelle pas et n'ajoute pas la réserve.
    const e2 = (await faire("montage", e, o)).etat;
    expect(e2.reserves.filter((r) => r === RESERVE)).toHaveLength(1);
  });

  it("grille : présente quand le verdict du contrôleur et le contrôle de l'image sont dans l'état, absente sinon", async () => {
    const o: OutilsTutoriel = { ...outilsDoubles(journalVide()), regarder: async (x) => lectureSansDefaut(x.instants) };
    // Sans : pas de grille.
    expect((await jusquaMontage(o, true)).grille).toBeUndefined();
    // Avec : l'état porte déjà les deux verdicts avant le montage.
    let e = etatInitial(commandeTutoriel()) as EtatTutoriel & Record<string, unknown>;
    for (const cle of ["script", "voix", "calage", "plan"] as const) e = (await faire(cle, e, o)).etat as typeof e;
    e = { ...e, controleImage: { controles: [] }, controleur: { verdict: "ok", resultats: [] } } as typeof e;
    e = (await faire("montage", e, o)).etat as typeof e;
    expect(e.grille).toBeDefined();
    expect(e.grille!.criteres.length).toBeGreaterThan(0);
    expect(typeof e.grille!.note).toBe("number");
  });
});
