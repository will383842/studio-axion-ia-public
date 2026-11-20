/* eslint-disable @typescript-eslint/no-explicit-any -- lecture de l'exemple du catalogue (type large) */
/**
 * C9-37-c-v20b : la chaîne v4 accepte `outils.planScenes.objetsPermis` (facultatif) et le passe à `planPourVideo`.
 * Personne ne remplit encore le champ : absent ou vide = identique. Faux Claude, `rendre` factice : aucun appel réel, aucun euro.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { avancerChaineV4, VERSION_CHAINE_V4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import { CATALOGUE_BRIQUES } from "@/briques/plan-scenes/catalogue";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";

const PLAN_V4 = JSON.parse(readFileSync(join(__dirname, "..", "..", "docs/facecam-animee-v4/repetition-generale/plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const OBJET = "objet-gros-chiffre";
const VALIDES = (CATALOGUE_BRIQUES as unknown as Record<string, any>)[OBJET].exemple;
const PHRASE = "On gagne 42 heures par mois avec cet outil";
const MOTS = PHRASE.split(" ").map((w, i) => ({ w, a: i * 0.4, f: i * 0.4 + 0.35 }));
const demande = { videoId: "v-1", versionId: "ver-1", priseCle: "prises/brute.mp4", titre: "T" };

const etatAuRendu = () =>
  ({
    version: VERSION_CHAINE_V4,
    etape: "rendu",
    demande,
    coupes: { mots: MOTS, gardes: [{ a: 0, f: 4 }], dureeSec: 4 },
    realisation: { version: "complete", essais: 1, avertissements: 0, plan: PLAN_V4 },
    videos: { fichiers: [], retirees: [], manques: [] },
  }) as unknown as EtatChaineV4;

async function planifier(planScenes: NonNullable<OutilsChaineV4["planScenes"]>) {
  const requetes: unknown[] = [];
  const plan = { version: "plan-scenes-1", scenes: [{ id: "a", version: 1, mots: { premier: 3, dernier: 4 }, debutMs: 1200, finMs: 3000, niveau: 1, position: "centre", piece: OBJET, parametres: VALIDES }] };
  const appeler = async (r: unknown) => (requetes.push(r), { texte: JSON.stringify(plan), stopReason: "end_turn" }) as never;
  const outils = {
    transcrire: async () => { throw new Error("jamais appelé"); },
    plafondClaudeAtteint: async () => false,
    rendre: async () => ({ cle: "rendus/a.mp4", vignetteCle: "rendus/a.jpg", dureeSec: 4, taille: 1 }),
    planScenes: { appeler, ...planScenes },
  } as unknown as OutilsChaineV4;
  const apres = await avancerChaineV4(etatAuRendu(), outils);
  return { memo: apres.planScenes!, requetes: JSON.stringify(requetes) };
}

describe("C9-37-c-v20b : objetsPermis dans les outils du plan de scènes", () => {
  it("(a) éteint = identique : absent puis [] → même mémo, même requête", async () => {
    const sans = await planifier({});
    const vide = await planifier({ objetsPermis: [] });
    expect(vide.memo).toEqual(sans.memo);
    expect(vide.memo.entree).toBe(sans.memo.entree);
    expect(vide.requetes).toBe(sans.requetes);
  });

  it("(b) objet permis : scène gardée, entrée du mémo différente", async () => {
    const sans = await planifier({});
    const avec = await planifier({ objetsPermis: [OBJET] });
    expect(avec.memo.entree).not.toBe(sans.memo.entree);
    expect(avec.memo.plan?.scenes.map((s) => s.piece)).toEqual([OBJET]);
  });

  it("(c) garde statique : le service ne remplit pas encore le champ", () => {
    const src = readFileSync(join(process.cwd(), "src/services/facecam-animee.ts"), "utf8");
    expect(src).not.toContain("objetsPermis");
  });
});
