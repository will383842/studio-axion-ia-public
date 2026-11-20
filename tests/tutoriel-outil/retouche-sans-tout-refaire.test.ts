/**
 * T-EXT-52b · Retouche sans tout refaire : un format dont rien ne change est repris tel quel (même fichier, aucune demande de
 * rendu). Moteur réel ; voix, Claude et rendu SIMULÉS (doubles) : aucun appel réel, 0 €. Réglage éteint = comportement d'avant.
 */
import { describe, expect, it } from "vitest";
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

const outils = (j: Journal, partielle?: boolean): OutilsTutoriel => ({ ...outilsDoubles(j), ...(partielle === undefined ? {} : { retouchePartielle: partielle }) });
const compositions = (j: Journal) => j.rendus.filter((d) => d.operation === "composition");
const etatDe = (t: Travail) => (t.parametres as { tutoriel: EtatTutoriel }).tutoriel;
type Parent = { versionId: string; projetMontage: Record<string, unknown>; pistes: [] };

async function premiere(partielle?: boolean) {
  const j = journalVide();
  const moteur = creerMoteurTutorielOutil({ outils: une(outils(j, partielle)) });
  const c = commandeTutoriel({ ratios: TROIS });
  const { resultat } = await mener(moteur, c, await moteur.lancer(c, { travailId: "t-v1", versionId: "ver-1", titre: "Tuto", maintenant: T0 }));
  const parent: Parent = { versionId: "ver-1", projetMontage: resultat!.projetMontage as Record<string, unknown>, pistes: [] };
  return { j, resultat: resultat!, parent, c };
}

/** Retouche avec ses propres doubles (journal neuf : on compte ce que la retouche seule demande). */
async function retoucher(parent: Parent, c: CommandeFabrication, partielle: boolean | undefined, operations?: OperationMontage[]) {
  const j = journalVide();
  const moteur = creerMoteurTutorielOutil({ outils: une(outils(j, partielle)) });
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

describe("réglage tutoriel.retouchePartielle", () => {
  it("seul `true` exact allume (absent, \"true\", 1, lecture en échec : éteint)", async () => {
    const lire = (valeur: unknown) => (async <T>(id: string, defaut: T): Promise<T> => (id === PARAM_RETOUCHE_PARTIELLE_TUTORIEL ? (valeur as T) : defaut));
    expect(await retouchePartielleActive(lire(true))).toBe(true);
    for (const v of [undefined, false, "true", 1, null]) expect(await retouchePartielleActive(lire(v))).toBe(false);
    expect(await retouchePartielleActive(async () => Promise.reject(new Error("lecture en échec")))).toBe(false);
  });
});
