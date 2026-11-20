/**
 * T-EXT-52b · Retouche sans tout refaire : un format dont rien ne change est repris tel quel (même fichier, aucune demande de
 * rendu). Moteur réel ; voix, Claude et rendu SIMULÉS (doubles) : aucun appel réel, 0 €. Réglage éteint = comportement d'avant.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { InstantRegard, LectureRegard } from "@/briques/regardeur";
import type { EtatRendu, ServiceRendu } from "@/fournisseurs/types";
import type { PlanValide } from "@/briques/plan-scenes/schema";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { creerMoteurTutorielOutil, type EtatTutoriel, type OutilsTutoriel } from "@/moteurs/montage-tutoriel-outil";
import type { OperationMontage } from "@/moteurs/types";
import { PARAM_RETOUCHE_PARTIELLE_TUTORIEL, retouchePartielleActive } from "@/services/tutoriel-branchements";
import { commandeTutoriel, outilsDoubles, une, type Journal } from "./doubles";

const T0 = Date.UTC(2026, 10, 8, 9);
const journalVide = (): Journal => ({ voix: [], claude: [], rendus: [] });
type Moteur = ReturnType<typeof creerMoteurTutorielOutil>;
const TROIS: CommandeFabrication["ratios"] = ["4:5", "9:16", "1:1"];

async function mener(moteur: Moteur, c: CommandeFabrication, travail: Travail, jusqua = 600) {
  let t = travail;
  for (let i = 1; i <= jusqua; i++) {
    const r = await moteur.avancer(t, c, T0 + i * 1000);
    t = r.travail;
    if (r.resultat || t.statut === "echec") return { travail: t, resultat: r.resultat };
  }
  throw new Error(`pas fini : ${t.statut}`);
}

const outils = (j: Journal, partielle?: boolean, plus: Partial<OutilsTutoriel> = {}): OutilsTutoriel => ({ ...outilsDoubles(j), ...(partielle === undefined ? {} : { retouchePartielle: partielle }), ...plus });
const compositions = (j: Journal) => j.rendus.filter((d) => d.operation === "composition");
const etatDe = (t: Travail) => (t.parametres as { tutoriel: EtatTutoriel }).tutoriel;
type Parent = { versionId: string; projetMontage: Record<string, unknown>; pistes: [] };

async function premiere(partielle?: boolean, plus: Partial<OutilsTutoriel> = {}, commande?: CommandeFabrication) {
  const j = journalVide();
  const moteur = creerMoteurTutorielOutil({ outils: une(outils(j, partielle, plus)) });
  const c = commande ?? commandeTutoriel({ ratios: TROIS });
  const { resultat } = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-v1", versionId: "ver-1", titre: "Tuto", maintenant: T0 }));
  const parent: Parent = { versionId: "ver-1", projetMontage: resultat!.projetMontage as Record<string, unknown>, pistes: [] };
  return { j, resultat: resultat!, parent, c };
}

/** Retouche avec ses propres doubles (journal neuf : on compte ce que la retouche seule demande). */
async function retoucher(parent: Parent, c: CommandeFabrication, partielle: boolean | undefined, operations?: OperationMontage[], plus: Partial<OutilsTutoriel> = {}) {
  const j = journalVide();
  const moteur = creerMoteurTutorielOutil({ outils: une(outils(j, partielle, plus)) });
  const t = await moteur.retoucher({ commande: c, contexte: { travailId: "t-r", versionId: "ver-2", titre: "Retouche", maintenant: T0 }, planIds: [], consigne: "Refaire", parent, ...(operations ? { operations } : {}) } as never);
  const fin = await mener(moteur, c, t);
  return { j, ...fin };
}

const tuto = (p: Record<string, unknown>) => p.tutoriel as { empreintesFormats?: Record<string, string>; sortiesFormats?: Record<string, { fichierCle: string }>; origineFormats?: Record<string, string>; plan: { plan: PlanValide } };

function planModifie(parent: Parent): PlanValide {
  const plan = structuredClone(tuto(parent.projetMontage).plan.plan);
  const s = plan.scenes[0];
  s.parametres = { ...(s.parametres as Record<string, unknown>), titre: "Titre retouché" } as never;
  return plan;
}

describe("tutoriel d'outil : retouche sans tout refaire (52b)", () => {
  it("fabrication complète 4:5 + 9:16 + 1:1 : une empreinte par format dans le résultat", async () => {
    const { resultat } = await premiere(true);
    const t = tuto(resultat.projetMontage as Record<string, unknown>);
    expect(Object.keys(t.empreintesFormats ?? {}).sort()).toEqual(["1:1", "4:5", "9:16"]);
    expect(new Set(Object.values(t.empreintesFormats ?? {})).size).toBe(3);
    expect(Object.values(t.origineFormats ?? {})).toEqual(["rendu", "rendu", "rendu"]);
  });

  it("retouche qui ne change rien : les 3 formats sont repris, même fichier, 0 demande de rendu, voix jamais refaite", async () => {
    const { parent, c } = await premiere(true);
    const r = await retoucher(parent, c, true);
    expect(compositions(r.j)).toHaveLength(0);
    expect(r.j.voix).toHaveLength(0);
    expect(r.j.claude).toHaveLength(0);
    const avant = tuto(parent.projetMontage).sortiesFormats!;
    const apres = tuto(r.resultat!.projetMontage as Record<string, unknown>);
    for (const ratio of TROIS) {
      expect(r.resultat!.sorties.find((s) => s.ratio === ratio)?.fichierCle).toBe(avant[ratio].fichierCle);
      expect(apres.sortiesFormats![ratio].fichierCle).toBe(avant[ratio].fichierCle);
      expect(apres.origineFormats![ratio]).toBe("reprise");
    }
    expect(etatDe(r.travail).rendus.every((x) => x.reprise === true)).toBe(true);
  });

  it("un seul format dont l'empreinte change : lui seul est rendu, les deux autres repris", async () => {
    const { parent, c } = await premiere(true);
    const p = structuredClone(parent);
    tuto(p.projetMontage).empreintesFormats!["9:16"] = "autre";
    const r = await retoucher(p, c, true);
    expect(compositions(r.j).map((d) => d.idRendu)).toEqual(["t-r-9x16-0"]);
    const apres = tuto(r.resultat!.projetMontage as Record<string, unknown>).origineFormats!;
    expect(apres).toMatchObject({ "4:5": "reprise", "9:16": "rendu", "1:1": "reprise" });
    expect(r.j.voix).toHaveLength(0);
  });

  it("retouche qui change une pièce présente dans les trois formats : 3 rendus", async () => {
    const { parent, c } = await premiere(true);
    const r = await retoucher(parent, c, true, [{ type: "planScenes", plan: planModifie(parent) }]);
    expect(compositions(r.j)).toHaveLength(3);
    expect(Object.values(tuto(r.resultat!.projetMontage as Record<string, unknown>).origineFormats!)).toEqual(["rendu", "rendu", "rendu"]);
  });

  it("réglage éteint (absent ou false) : autant de rendus qu'aujourd'hui, rien de nouveau dans l'état ni le résultat", async () => {
    for (const reglage of [undefined, false]) {
      const { resultat, parent, c } = await premiere(reglage);
      expect(Object.keys(tuto(resultat.projetMontage as Record<string, unknown>))).not.toContain("empreintesFormats");
      const r = await retoucher(parent, c, reglage);
      expect(compositions(r.j).map((d) => d.idRendu).sort()).toEqual(["t-r-1x1-0", "t-r-4x5-0", "t-r-9x16-0"]);
      expect(etatDe(r.travail).rendus.some((x) => x.reprise)).toBe(false);
      expect(JSON.stringify(r.resultat!.projetMontage)).not.toContain("empreintesFormats");
    }
  });

  it("réglage éteint : les demandes de rendu ENTIÈRES sont celles du code d'avant (instantané pris sur tdb/T-EXT-45b, sans cette PR)", async () => {
    // Fichier attendu : demandes (triées par idRendu) de la fabrication puis de la retouche, produites par le code de la base, réglage absent.
    const attendu = JSON.parse(readFileSync(new URL("./retouche-sans-tout-refaire.attendu.json", import.meta.url), "utf8")) as { premiere: unknown[]; retouche: unknown[] };
    const tri = (d: { idRendu: string }[]) => [...d].sort((x, y) => x.idRendu.localeCompare(y.idRendu));
    for (const reglage of [undefined, false]) {
      const { j, parent, c } = await premiere(reglage);
      const r = await retoucher(parent, c, reglage);
      expect(JSON.parse(JSON.stringify(tri(j.rendus)))).toEqual(attendu.premiere);
      expect(JSON.parse(JSON.stringify(tri(r.j.rendus)))).toEqual(attendu.retouche);
    }
  });

  it("réglage allumé sur une version d'avant sans empreintes : tout est refait (jamais une reprise devinée)", async () => {
    const { parent, c } = await premiere(undefined);
    const r = await retoucher(parent, c, true);
    expect(compositions(r.j)).toHaveLength(3);
  });

  it("reexporter : inchangé, un seul format", async () => {
    const { parent, c } = await premiere(true);
    const j = journalVide();
    const moteur = creerMoteurTutorielOutil({ outils: une(outils(j, true)) });
    const t = await moteur.reexporter({ commande: c, contexte: { travailId: "t-x", versionId: "ver-3", titre: "Réexport", maintenant: T0 }, cible: { ratio: "9:16" }, parent } as never);
    const fin = await mener(moteur, c, t);
    expect(fin.resultat!.sorties.map((s) => s.ratio)).toEqual(["9:16"]);
    expect(j.voix).toHaveLength(0);
  });
});

/** Double du service de rendu : la mesure du son rend un niveau, comme en vrai. */
const outilsFinitions = (j: Journal): Partial<OutilsTutoriel> => {
  const base = outilsDoubles(j);
  const service: ServiceRendu = {
    soumettre: (d) => base.rendu.service().soumettre(d),
    async etat(id): Promise<EtatRendu> {
      const e = await base.rendu.service().etat(id);
      const d = j.rendus.find((x) => x.idRendu === id);
      return d?.operation === "mesure-son" && e.statut === "termine" ? { ...e, mesures: { lufs: -14.1, creteVraieDbtp: -2.3 } } : e;
    },
  };
  return { rendu: { ...base.rendu, service: () => service }, finitions: { actif: true as const } };
};

const messages = (r: { resultat?: { sorties: { rapportQualite: { alertes: { message: string }[] } }[] } }) => (r.resultat?.sorties ?? []).flatMap((s) => s.rapportQualite.alertes.map((a) => a.message));

describe("52b : finitions allumées (T-EXT-31), un format repris garde ses résultats", () => {
  it("retouche sans changement : aucune demande, mesure et vignette de la version d'avant remises, aucune alerte fausse", async () => {
    const j0 = journalVide();
    const p = await premiere(true, outilsFinitions(j0));
    expect(messages(p).some((m) => m.includes("non mesuré") || m.includes("Vignette non produite"))).toBe(false);
    const avant = p.resultat.sorties.map((s) => ({ ratio: s.ratio, vignetteCle: s.vignetteCle, niveau: s.rapportQualite.niveauSonoreLufs }));
    expect(tuto(p.parent.projetMontage).sortiesFormats!["9:16"]).toMatchObject({ mesure: { lufs: -14.1 }, vignette: { cle: expect.stringMatching(/\.jpg$/) } });
    const j1 = journalVide();
    const r = await retoucher(p.parent, p.c, true, undefined, outilsFinitions(j1));
    expect(j1.rendus.filter((d) => ["composition", "mesure-son", "miniature"].includes(d.operation))).toHaveLength(0);
    expect(etatDe(r.travail).rendus.every((x) => x.reprise === true)).toBe(true);
    expect(r.resultat!.sorties.map((s) => ({ ratio: s.ratio, vignetteCle: s.vignetteCle, niveau: s.rapportQualite.niveauSonoreLufs }))).toEqual(avant);
    expect(messages(r).some((m) => m.includes("non mesuré") || m.includes("Vignette non produite"))).toBe(false);
    // Et la version suivante, reprise d'une reprise, garde encore ces résultats.
    const p2: Parent = { versionId: "ver-2", projetMontage: r.resultat!.projetMontage as Record<string, unknown>, pistes: [] };
    expect(tuto(p2.projetMontage).sortiesFormats!["9:16"]).toMatchObject({ mesure: { lufs: -14.1 }, vignette: { cle: expect.stringMatching(/\.jpg$/) } });
  });
});

describe("52b : le regard payé (T-EXT-27b) n'est jamais lancé sur un format repris", () => {
  const lectureVide = (instants: InstantRegard[]): LectureRegard => ({ images: instants.map((i) => ({ nom: i.nom, textes: [], sousTitre: null, pageVide: false, noire: false, illisible: false })) });

  it("maître repris : 0 appel au regard (double) ; maître refait : 1 appel", async () => {
    const appels: unknown[] = [];
    const regarder: OutilsTutoriel["regarder"] = async (x) => (appels.push(x), lectureVide(x.instants));
    const { parent, c } = await premiere(true, { regarder });
    expect(appels).toHaveLength(1);
    appels.length = 0;
    const r = await retoucher(parent, c, true, undefined, { regarder });
    expect(etatDe(r.travail).rendus.every((x) => x.reprise === true)).toBe(true);
    expect(appels).toHaveLength(0);
    expect(etatDe(r.travail).regard).toBeUndefined();
    expect(r.j.claude).toHaveLength(0);
    const r2 = await retoucher(parent, c, true, [{ type: "planScenes", plan: planModifie(parent) }], { regarder });
    expect(appels).toHaveLength(1);
    expect((appels[0] as { demandeMaitre: { entrees: Record<string, string> } }).demandeMaitre.entrees.audio).toBeDefined();
    expect(etatDe(r2.travail).regard).toBeDefined();
  });
});

function film(videoCle: string) {
  return {
    version: "navigation-filmee.v1",
    videoCle,
    maquette: "tableau",
    largeur: 1080,
    hauteur: 1350,
    debutFilmMs: 400,
    dureeVoixMs: 60000,
    cibles: [{ etapeId: "e1", zonePct: { x: 10, y: 10, largeur: 30, hauteur: 12 }, instantMs: 3000, finMs: 5000 }],
  };
}
const avecFilm = (videoCle: string): CommandeFabrication => commandeTutoriel({ ratios: TROIS, entrees: { tutorielOutil: { scriptColle: true, navigationFilmee: film(videoCle) } } });

describe("52b : le film de navigation", () => {
  it("même film : les 3 formats repris, aucune capture ni rendu demandés, aucune réserve sur le film", async () => {
    const { parent } = await premiere(true, {}, avecFilm("studio/test/film-a.mp4"));
    const r = await retoucher(parent, avecFilm("studio/test/film-a.mp4"), true);
    expect(compositions(r.j)).toHaveLength(0);
    expect(r.j.rendus).toHaveLength(0);
    expect(etatDe(r.travail).reserves.some((x) => x.includes("film de navigation"))).toBe(false);
  });

  it("film changé : les 3 formats sont refaits avec le NOUVEAU film, et la réserve le dit (jamais « celui de la version d'avant »)", async () => {
    const { parent } = await premiere(true, {}, avecFilm("studio/test/film-a.mp4"));
    const r = await retoucher(parent, avecFilm("studio/test/film-b.mp4"), true);
    expect(compositions(r.j)).toHaveLength(3);
    for (const d of compositions(r.j)) expect(d.entrees.filmNavigation).toBe("https://stockage.test/studio/test/film-b.mp4");
    const reserves = etatDe(r.travail).reserves;
    expect(reserves).toContain("Le film de navigation a changé : les formats sont refaits avec le nouveau film.");
    expect(reserves.join(" ")).not.toContain("celui de la version d'avant");
  });
});

describe("52b : retouche d'une retouche", () => {
  it("la version qui reprend tout reste reprenable : 0 rendu à la suivante, mêmes fichiers", async () => {
    const { parent, c } = await premiere(true);
    const r1 = await retoucher(parent, c, true);
    const p2: Parent = { versionId: "ver-2", projetMontage: r1.resultat!.projetMontage as Record<string, unknown>, pistes: [] };
    const r2 = await retoucher(p2, c, true);
    expect(compositions(r2.j)).toHaveLength(0);
    for (const ratio of TROIS) expect(r2.resultat!.sorties.find((s) => s.ratio === ratio)?.fichierCle).toBe(tuto(parent.projetMontage).sortiesFormats![ratio].fichierCle);
  });
});

describe("réglage tutoriel.retouchePartielle", () => {
  it("seul `true` exact allume (absent, \"true\", 1, lecture en échec : éteint)", async () => {
    const lire = (valeur: unknown) => (async <T>(id: string, defaut: T): Promise<T> => (id === PARAM_RETOUCHE_PARTIELLE_TUTORIEL ? (valeur as T) : defaut));
    expect(await retouchePartielleActive(lire(true))).toBe(true);
    for (const v of [undefined, false, "true", 1, null]) expect(await retouchePartielleActive(lire(v))).toBe(false);
    expect(await retouchePartielleActive(async () => Promise.reject(new Error("lecture en échec")))).toBe(false);
  });
});
