/**
 * S2-16-c-v20l : la base de prononciation appliquée aussi au tableau, pour les vidéos NEUVES seulement.
 * Le drapeau `entrees.tableau.prononciations === true` est figé au lancement par `fabriquerVideoTableau` quand le réglage
 * `tableau.prononciations` vaut `true` exact (éteint par défaut) ; le moteur passe alors `commande.prononciations` à la voix.
 * Doubles seulement (voix simulée, rendu « terminé »), dépôts mémoire ; aucun appel réel, 0 €.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";
import { repereFiche, repereTexte } from "@/domaine/relecture-tableau";
import type { CommandeFabrication, Travail } from "../../src/domaine/types";
import type { MoteurVideo, OperationMontage, ResultatFabrication } from "../../src/moteurs/types";
import type { EntreeRole } from "../../src/generateur/roles/types";
import type { FicheTableau } from "../../src/moteurs/montage-tableau/fiche";
import type { OutilsDecoupage } from "../../src/moteurs/montage-tableau/decoupage";
import { fournisseurVoixSimulation } from "../../src/fournisseurs/simulation/autres";
import { auStyleDemande, AUJOURDHUI_EXEMPLES, contexteExemple, copie, ficheErreurCorrigee, ficheQuestionAbonne, texteScriptDe } from "./regles/exemples";
import { banc } from "./moteur/doubles";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => ({ ...mockNavigation, useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }), usePathname: () => "/tableau/nouvelle" }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const commun = await import("@/services/_commun");
const { PARAM_PRONONCIATIONS_TABLEAU, decouperScriptTableau, fabriquerVideoTableau, lireBrouillonTableau, travaillerTachesTableau, cocherDejaVuTableau } = await import("@/services/tableau-creation");

vi.setConfig({ testTimeout: 60_000 }); // création + fabrication complètes, plusieurs fois par test
const T0 = Date.UTC(2026, 9, 11, 9, 0, 0);
const ctx = (travailId: string) => ({ travailId, versionId: `ver-${travailId}`, titre: "Essai", maintenant: T0 });
const BASE = [{ mot: "devis", prononciation: "deu vi" }];

afterEach(() => vi.restoreAllMocks());

async function jusquAuBout(moteur: MoteurVideo, commande: CommandeFabrication, depart: Travail) {
  let t = depart;
  let resultat: ResultatFabrication | undefined;
  for (let n = 0; n < 200; n++) {
    const r = await moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, commande, T0 + n * 1000);
    t = r.travail;
    resultat = r.resultat ?? resultat;
    if (t.statut === "termine" || t.statut === "echec") return { travail: t, resultat };
  }
  throw new Error(`Bloqué (${t.statut}).`);
}

/** Une fabrication complète du tableau « question d'abonné » (il dit « devis ») : textes envoyés à la voix, compositions. */
async function fabriquer(drapeau: unknown, prononciations: { mot: string; prononciation: string }[], outils: Parameters<typeof banc>[1] = {}) {
  const textes: string[] = [];
  const vrai = fournisseurVoixSimulation.lire.bind(fournisseurVoixSimulation);
  vi.spyOn(fournisseurVoixSimulation, "lire").mockImplementation(async (d) => (textes.push(d.texte), vrai(d)));
  const b = banc(ficheQuestionAbonne, outils);
  const base = b.commande(ficheQuestionAbonne);
  const tableau = (base.entrees as { tableau: Record<string, unknown> }).tableau;
  const c: CommandeFabrication = { ...base, prononciations, entrees: { tableau: { ...tableau, ...(drapeau === undefined ? {} : { prononciations: drapeau }) } } };
  const fin = await jusquAuBout(b.moteur, c, await b.moteur.lancer(c, ctx("t-pr")));
  vi.restoreAllMocks();
  return { b, c, fin, textes, compositions: JSON.stringify(b.d.compositionsSoumises().map((d) => d.parametres)) };
}

describe("S2-16-c · moteur du tableau : base de prononciation sous drapeau figé", () => {
  it("(a) drapeau absent : texte lu et compositions identiques à une commande sans base (master), « devis » lu tel quel", async () => {
    const temoin = await fabriquer(undefined, []);
    const avecBase = await fabriquer(undefined, BASE);
    expect(temoin.fin.travail.statut).toBe("termine");
    expect(avecBase.fin.travail.statut).toBe("termine");
    expect(avecBase.textes).toEqual(temoin.textes);
    expect(avecBase.textes.join(" ")).toContain("devis");
    expect(avecBase.compositions).toBe(temoin.compositions);
  });

  it("(b) drapeau true : la voix lit « deu vi », les sous-titres gardent « devis » (graphie d'origine)", async () => {
    const r = await fabriquer(true, BASE);
    expect(r.fin.travail.statut).toBe("termine");
    const lu = r.textes.join(" ");
    expect(lu).toContain("deu vi");
    expect(lu).not.toMatch(/\bdevis\b/);
    expect(r.compositions).toContain("devis");
    expect(r.compositions).not.toContain("deu vi");
  });

  it("(c) drapeau true mais base vide : identique au témoin", async () => {
    const temoin = await fabriquer(undefined, []);
    const r = await fabriquer(true, []);
    expect(r.textes).toEqual(temoin.textes);
    expect(r.compositions).toBe(temoin.compositions);
  });

  it("(d) drapeau autre que true exact (\"true\", 1, false) : éteint, identique au témoin", async () => {
    const temoin = await fabriquer(undefined, BASE);
    for (const v of ["true", 1, false]) {
      const r = await fabriquer(v, BASE);
      expect(r.textes, String(v)).toEqual(temoin.textes);
      expect(r.compositions, String(v)).toBe(temoin.compositions);
    }
  });

  it("(i) des outils qui fournissent DÉJÀ leur liste l'emportent (la commande ne l'écrase pas), même drapeau true", async () => {
    const r = await fabriquer(true, BASE, { prononciations: [{ mot: "devis", prononciation: "dé vice" }] });
    expect(r.fin.travail.statut).toBe("termine");
    expect(r.textes.join(" ")).toContain("dé vice");
    expect(r.textes.join(" ")).not.toContain("deu vi");
  });

  it("(e) retouche d'un tableau ANCIEN (sans drapeau) qui relit la voix : la base n'est pas appliquée", async () => {
    const v1 = await fabriquer(undefined, BASE);
    const textes: string[] = [];
    const vrai = fournisseurVoixSimulation.lire.bind(fournisseurVoixSimulation);
    vi.spyOn(fournisseurVoixSimulation, "lire").mockImplementation(async (d) => (textes.push(d.texte), vrai(d)));
    const parent = { versionId: "ver-t-pr", projetMontage: v1.fin.resultat!.projetMontage, pistes: [] };
    const op = { type: "modifierTexteDit", sceneId: ficheQuestionAbonne.scenes[1].id, texte: "Vos devis restent toujours sans réponse ?" };
    const t = await v1.b.moteur.retoucher!({ commande: v1.c, contexte: ctx("t-r"), planIds: [], consigne: "", parent, operations: [op] as unknown as OperationMontage[] });
    const fin = await jusquAuBout(v1.b.moteur, v1.c, t);
    expect(fin.travail.statut).toBe("termine");
    expect(textes.length).toBeGreaterThan(0);
    expect(textes.join(" ")).toContain("devis");
    expect(textes.join(" ")).not.toContain("deu vi");
  });
});

/* ------------------------------------------------------------------ création : le drapeau figé au lancement ------------------------------------------------------------------ */

const MDP = "tableau-prononciations-v20l";
const fiche = ficheErreurCorrigee;
const donnees = { texte: texteScriptDe(fiche), serieCode: "formation", structure: fiche.structure, douleur: fiche.douleur, gesteMinute: fiche.gesteMinute, finId: "fin-if-abonnement", reseaux: ["verticaux", "linkedin"] };
const balise = (variable: string, nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n</${nom}>`))?.[1] ?? "";
const appeler: OutilsDecoupage["appeler"] = async (_role, entree: EntreeRole) => {
  const f = copie(fiche);
  Object.assign(f, JSON.parse(balise(entree.variable, "fiche_fixe")), { serie: JSON.parse(balise(entree.variable, "serie")) });
  auStyleDemande(f);
  return { ok: true, simule: false, donnees: JSON.stringify(f) };
};

async function brouillonPret(): Promise<string> {
  const relu = repereTexte(donnees.texte);
  const prix = await decouperScriptTableau(donnees, { relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (prix.statut !== "accord-requis") throw new Error("prix attendu");
  const r = await decouperScriptTableau(donnees, { accord: prix.centimes, relu }, { aujourdhui: AUJOURDHUI_EXEMPLES });
  if (r.statut !== "en-cours") throw new Error("découpage non enregistré");
  await travaillerTachesTableau({ appeler, aujourdhui: AUJOURDHUI_EXEMPLES });
  await cocherDejaVuTableau(r.videoId, true, { aujourdhui: AUJOURDHUI_EXEMPLES });
  return r.videoId;
}

/** Lance la fabrication (lancement commun doublé) et rend les entrées du tableau écrites sur la vidéo. */
async function lancer(): Promise<Record<string, unknown>> {
  const videoId = await brouillonPret();
  const relu = repereFiche(lireBrouillonTableau(await depots().videos.obtenir(videoId))!.versions.at(-1)!.fiche as FicheTableau);
  const deps = { aujourdhui: AUJOURDHUI_EXEMPLES, deposerFiche: async () => undefined, lancer: async () => ({ travailId: "trav-pr" }) };
  const prix = await fabriquerVideoTableau(videoId, undefined, deps, relu);
  if (prix.statut !== "accord-requis") throw new Error(`prix attendu : ${JSON.stringify(prix)}`);
  expect(await fabriquerVideoTableau(videoId, prix.centimes, deps, relu)).toMatchObject({ statut: "lancee" });
  return (((await depots().videos.obtenir(videoId))!.entrees as Record<string, unknown>).tableau ?? {}) as Record<string, unknown>;
}

describe("S2-16-c · création : drapeau figé au lancement, réglage éteint par défaut", () => {
  beforeAll(async () => {
    process.env.SESSION_SECRET = "t".repeat(48);
    const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
  });
  beforeEach(async () => {
    reinitialiserDepots();
    reinitialiserRequete();
    await auth.seConnecter(MDP, false);
    const { texteScript: _s, ...regles } = contexteExemple(fiche);
    void _s;
    for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
    for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
  });

  it("(f) réglage absent (défaut) : aucun drapeau dans les entrées du tableau", async () => {
    expect(PARAM_PRONONCIATIONS_TABLEAU).toBe("tableau.prononciations");
    const e = await lancer();
    expect(e.ficheScenesCle).toBeTruthy();
    expect(e).not.toHaveProperty("prononciations");
  });

  it("(g) réglage `true` exact : drapeau `prononciations: true` figé ; \"true\", 1, false : aucun drapeau", async () => {
    await commun.ecrireParametre(PARAM_PRONONCIATIONS_TABLEAU, true);
    expect((await lancer()).prononciations).toBe(true);
    for (const v of ["true", 1, false]) {
      reinitialiserDepots();
      await auth.seConnecter(MDP, false);
      const { texteScript: _s, ...regles } = contexteExemple(fiche);
      void _s;
      for (const p of regles.preuves) await depots().preuves.enregistrer(p as never);
      for (const m of regles.matieres) await depots().matieres.enregistrer(m as never);
      await commun.ecrireParametre(PARAM_PRONONCIATIONS_TABLEAU, v);
      expect(await lancer(), String(v)).not.toHaveProperty("prononciations");
    }
  });

  it("(h) lecture du réglage en échec : éteint (aucun drapeau), le lancement passe", async () => {
    const lire = commun.lireParametre;
    vi.spyOn(commun, "lireParametre").mockImplementation(((id: string, defaut: unknown) => (id === PARAM_PRONONCIATIONS_TABLEAU ? Promise.reject(new Error("base en panne")) : lire(id, defaut))) as typeof lire);
    expect(await lancer()).not.toHaveProperty("prononciations");
  });
});
