/**
 * X2-11b-c · le refus commun de variété est branché dans la fabrication du cas concret (éteint par défaut).
 * Vraie fabrication (doubles, dépôts mémoire, aucun réseau), vrai `outilsVarieteDuStudio()`, vrai lecteur de réglage.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { creerMoteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");
const auth = await import("@/services/auth");
const b = await import("@/services/cas-concret-branchements");
await import("@/services/videos");
const { outilsVarieteDuStudio } = await import("@/services/cas-concret-variete");
const { ecrireParametre } = await import("@/services/_commun");
const { mettre, tirer } = await import("@/moteurs/montage-cas-concret/variete");
const { fabriquerCasConcret } = await import("@/moteurs/montage-cas-concret/fabriquer");
const { ficheParGabarit } = await import("@/moteurs/montage-cas-concret/ecriture");
const { trouverCas } = await import("@/formats/cas-concret/catalogue");
const { doubles } = await import("./fabriquer/doubles");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { OutilsVariete } from "@/moteurs/montage-cas-concret/outils";
import type { Tirage } from "@/moteurs/montage-cas-concret/variete";

const MDP = "refus-commun-branche";
const CAS = "recrutement-apporteurs";
const RESEAUX = ["linkedin"];

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

async function monde(): Promise<void> {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  const d = depots();
  const base = (await d.voix.obtenir("voix-will"))!;
  await d.voix.enregistrer({ ...base, id: "voix-avocat-test", nom: "Voix avocat", statut: "pret" });
  await d.personnages.modifier("p-will", { voixParDefautId: "voix-will", voixParFormat: { avocat: "voix-avocat-test" } });
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
}
beforeEach(monde);
afterEach(() => vi.restoreAllMocks());

function commande(videoId: string): CommandeFabrication {
  return {
    versionContrat: 2, moteurId: "montage-cas-concret", videoId, formatId: "cas-concret", versionFormat: 1, profilRenduVersion: 1, dureeCibleSec: 50, ratios: ["9:16"],
    script: { blocs: [], texteComplet: "" },
    distribution: [{ role: "voix", source: "double", personnageId: "p-clara", fournisseurVoix: "simulation", voixId: "voix-clara" }],
    styles: { sousTitres: null, decor: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { casConcret: { casId: CAS, porte: "porte-a", mot: "IA", avecMot: false, reseaux: RESEAUX, essai: true, codeSuivi: `cc-${CAS}-abc123` } },
    reglages: {}, plans: [], prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" }, construiteLe: "2026-10-15T09:00:00.000Z",
  } as unknown as CommandeFabrication;
}

async function jouer(videoId: string, variete: OutilsVariete): Promise<Tirage | undefined> {
  const c = commande(videoId);
  let t = 0;
  const moteur = creerMoteurMontageCasConcret({
    outils: (cmd, id) =>
      b.outilsCasConcret(cmd, id, {
        numeroVersion: async () => 42,
        rendu: { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true },
        attendre: async () => {}, claudeActif: async () => true, verifierBudget: async () => {}, verifierEtReserver: async () => {},
        scriptsAnterieurs: async () => [], variete,
        executer: async (_v, role, entree) => {
          const sortie = role.simuler(entree);
          return { ok: true, simule: false, texte: typeof sortie === "string" ? sortie : JSON.stringify(sortie), stopReason: "end_turn", coutUsd: 0.2 };
        },
      }),
  });
  let travail: Travail = await moteur.lancer(c, { travailId: `tr-${videoId}`, versionId: `ver-${videoId}`, titre: "Essai" } as never);
  for (let i = 0; i < 400 && travail.statut !== "termine" && travail.statut !== "echec"; i++) travail = (await moteur.avancer(travail, c)).travail;
  return (travail.parametres as { casConcret?: { journal?: { tirage?: { tirage: Tirage } } } }).casConcret?.journal?.tirage?.tirage;
}

const IDS = Array.from({ length: 10 }, (_, i) => `v-rcb-${i}`);

/** Une voisine LinkedIn publiée (version cas concret prête) dont la mise porte le tirage donné. */
async function poserVoisine(t: Tirage): Promise<void> {
  const d = depots();
  await d.publications.enregistrer({ id: "p-voisine", videoId: "v-voisine", reseau: "linkedin", statut: "publiee", via: "buffer", date: "2026-11-15T10:00:00Z" } as never);
  await d.versions.enregistrer({ id: "ver-voisine", videoId: "v-voisine", statut: "prete", numero: 1, creeLe: "2026-11-15T09:00:00Z", commande: { moteurId: "montage-cas-concret", formatId: "cas-concret" }, projetMontage: { casConcret: { fiche: { mise: mettre(t, []) } } } } as never);
}

const sansRefus = (): OutilsVariete => {
  const { refusCommun: _r, ...reste } = outilsVarieteDuStudio();
  void _r;
  return reste;
};

describe("X2-11b-c · refus commun branché dans le cas concret", { timeout: 120_000 }, () => {
  it("(a) réglage éteint (false, \"true\", {}, lecture qui lève) : tirages identiques à ceux sans refus ; refusCommun rend undefined", async () => {
    const voisin = tirer({ videoId: IDS[0], canaux: RESEAUX, historique: [] });
    /** Un monde neuf (même historique de départ) par vidéo : le tirage ne dépend que du refus. */
    const tirageDe = async (id: string, valeur: unknown, outils: () => OutilsVariete): Promise<Tirage | undefined> => {
      await monde();
      await poserVoisine(voisin);
      await ecrireParametre("varieteCommune", valeur);
      return jouer(id, outils());
    };
    const lecturePanne = (): OutilsVariete => ({ ...outilsVarieteDuStudio(), refusCommun: async () => { throw new Error("lecture en panne"); } });
    for (const id of IDS) {
      const attendu = await tirageDe(id, false, sansRefus);
      expect(attendu).toBeDefined();
      for (const valeur of [false, "true", {}]) expect(await tirageDe(id, valeur, outilsVarieteDuStudio)).toEqual(attendu);
      expect(await tirageDe(id, true, lecturePanne)).toEqual(attendu);
    }
    for (const valeur of [false, "true", {}]) {
      await ecrireParametre("varieteCommune", valeur);
      expect(await outilsVarieteDuStudio().refusCommun!({ videoId: IDS[0], reseaux: RESEAUX })).toBeUndefined();
    }
  });

  it("(b) allumé, une voisine LinkedIn : le refus commun est consulté et une raison existe pour le tirage de la voisine", async () => {
    const voisin = tirer({ videoId: "v-voisine", canaux: RESEAUX, historique: [] });
    await poserVoisine(voisin);
    await ecrireParametre("varieteCommune", true);
    const refus = await outilsVarieteDuStudio().refusCommun!({ videoId: IDS[0], reseaux: RESEAUX });
    expect(typeof refus).toBe("function");
    expect(refus!(voisin)).toEqual(expect.any(String));
  });

  it("(b') allumé, voisine LinkedIn : sur 10 vidéos, aucune n'ouvre comme la voisine (rouge sans le branchement)", async () => {
    const voisin = tirer({ videoId: "v-voisine", canaux: RESEAUX, historique: [] });
    const ouverturesSans: string[] = [];
    const ouverturesAvec: string[] = [];
    for (const id of IDS) {
      await monde();
      await poserVoisine(voisin);
      ouverturesSans.push((await jouer(id, sansRefus()))!.ouverture);
      await monde();
      await poserVoisine(voisin);
      await ecrireParametre("varieteCommune", true);
      ouverturesAvec.push((await jouer(id, outilsVarieteDuStudio()))!.ouverture);
    }
    // Précondition : sans refus commun, au moins une vidéo ouvrait comme la voisine (sinon le test ne prouverait rien).
    expect(ouverturesSans).toContain(voisin.ouverture);
    expect(ouverturesAvec).not.toContain(voisin.ouverture);
  }, 120_000);

  it("(c) tout refusé : un tirage sort quand même, aucune erreur", async () => {
    const tout = { ...sansRefus(), refusCommun: async () => () => "trop proche" } as OutilsVariete;
    for (const id of IDS.slice(0, 3)) expect(await jouer(id, tout)).toBeDefined();
  });

  /** Chemin « fiche fournie » (`entrees.ficheCle`) : `tirageAvantEcriture` est sauté, le tirage se fait dans `miseDeLaVideo`. */
  async function fabriquerSurFicheFournie(videoId: string, variete: OutilsVariete) {
    const fiche = ficheParGabarit(trouverCas(CAS)!, { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const });
    const d = doubles({ reseaux: ["linkedin"] });
    d.options.videoId = videoId;
    d.options.entrees = { ...d.options.entrees, ficheCle: "studio/dev/fiches/video-cc.json" };
    d.options.lireFiche = async () => structuredClone(fiche);
    d.options.outils.variete = variete;
    return (await fabriquerCasConcret(d.options)).fiche.mise;
  }

  it("(b'') fiche fournie, allumé, voisine LinkedIn : sur 10 vidéos, aucune n'ouvre comme la voisine (rouge sans le branchement de miseDeLaVideo)", async () => {
    const voisin = tirer({ videoId: "v-voisine", canaux: RESEAUX, historique: [] });
    const sans: string[] = [];
    const avec: string[] = [];
    for (const id of IDS) {
      await monde();
      await poserVoisine(voisin);
      sans.push((await fabriquerSurFicheFournie(id, sansRefus()))!.tirage.ouverture);
      await monde();
      await poserVoisine(voisin);
      await ecrireParametre("varieteCommune", true);
      avec.push((await fabriquerSurFicheFournie(id, outilsVarieteDuStudio()))!.tirage.ouverture);
    }
    expect(sans).toContain(voisin.ouverture);
    expect(avec).not.toContain(voisin.ouverture);
  }, 120_000);

  it("(c'') fiche fournie : refusCommun qui LÈVE ⇒ un tirage sort, aucune erreur (sansPanne)", async () => {
    await poserVoisine(tirer({ videoId: "v-voisine", canaux: RESEAUX, historique: [] }));
    await ecrireParametre("varieteCommune", true);
    const panne = { ...outilsVarieteDuStudio(), refusCommun: async () => { throw new Error("lecture en panne"); } } as OutilsVariete;
    expect((await fabriquerSurFicheFournie(IDS[0], panne))?.tirage).toBeDefined();
  });

  it("(d) tirage déjà au journal ou hérité : inchangé, refusCommun jamais appelé", async () => {
    const espion = vi.fn(async () => () => "refus");
    const base = sansRefus();
    const herite = tirer({ videoId: IDS[1], canaux: RESEAUX, historique: [] });
    const outils = { ...base, miseHeritee: async () => mettre(herite, []), refusCommun: espion } as OutilsVariete;
    const t = await jouer(IDS[1], outils);
    expect(espion).not.toHaveBeenCalled();
    expect(t?.ouverture).toBe(herite.ouverture);
  });
});
