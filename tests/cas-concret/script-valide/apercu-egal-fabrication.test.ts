/**
 * FIX-CC-FIN-NON-CHOISIE · T4 « l'aperçu montre exactement ce que la vidéo dira », par le CHEMIN RÉEL : moteur jusqu'à « à valider »,
 * aperçu du script (service), « Valider ce script », « Réessayer » jusqu'au bout. Même harnais que `a-valider.test.ts` (base en
 * mémoire, simulation : aucun appel réseau, rien de payé). Cas `contact-vers-crm`, mot « CRM » SANS `motDit`, « Avec le mot » coché,
 * branché sur Facebook seulement, 4 réseaux : Facebook garde sa fin au mot, les trois autres n'ont aucune fin.
 */
import { hash } from "@node-rs/argon2";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");
const { creerMoteurMontageCasConcret } = await import("@/moteurs/montage-cas-concret");
const auth = await import("@/services/auth");
const b = await import("@/services/cas-concret-branchements");
const scripts = await import("@/services/cas-concret-scripts");
// L0a : « Valider ce script » réécrit le script de la vidéo (services/videos) : module chargé ici, pas pendant un test.
await import("@/services/videos");
const { CODE_SCRIPT_A_VALIDER } = await import("@/moteurs/montage-cas-concret/script-valide");
const { FIN_AUCUNE } = await import("@/moteurs/montage-cas-concret/fins");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { DependancesBranchementsCasConcret } from "@/services/cas-concret-branchements";

const MDP = "cas-concret-script";
const VIDEO = "v-03";
const CAS = "contact-vers-crm";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"] as const;

const demandesRendu: Array<{ idRendu: string; proprietes?: unknown } & Record<string, unknown>> = [];

function renduImmediat() {
  let t = 0;
  const service = creerServiceRenduSimule(() => (t += 60_000));
  // 18/11 : on garde les demandes de rendu (ce que la vidéo dessine vraiment), sans rien changer au service.
  const soumettre = service.soumettre.bind(service);
  service.soumettre = async (demande) => {
    demandesRendu.push(demande as unknown as (typeof demandesRendu)[number]);
    return soumettre(demande);
  };
  return { service, simule: true };
}

function commande(casId = CAS): CommandeFabrication {
  return {
    versionContrat: 2,
    moteurId: "montage-cas-concret",
    videoId: VIDEO,
    formatId: "cas-concret",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 50,
    ratios: ["9:16"],
    script: { blocs: [], texteComplet: "" },
    distribution: [{ role: "voix", source: "double", personnageId: "p-clara", fournisseurVoix: "simulation", voixId: "voix-clara" }],
    styles: { sousTitres: null, decor: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { casConcret: { casId, porte: "porte-a", mot: "CRM", avecMot: true, motSur: ["facebook"], reseaux: [...RESEAUX], essai: true, codeSuivi: `cc-${casId}-abc123` } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "2026-10-14T09:00:00.000Z",
  } as unknown as CommandeFabrication;
}

/** Écriture simulée comptée (le rôle simule la réponse de Claude). */
function ecritureComptee() {
  const appels: string[] = [];
  const executer: DependancesBranchementsCasConcret["executer"] = async (_v, role: DefinitionRole, entree: EntreeRole) => {
    appels.push(role.id);
    const sortie = role.simuler?.(entree);
    return { ok: true, simule: true, texte: typeof sortie === "string" ? sortie : JSON.stringify(sortie) };
  };
  return { appels, executer };
}

function moteurAvec(dep: DependancesBranchementsCasConcret) {
  return creerMoteurMontageCasConcret({ outils: (c, travailId) => b.outilsCasConcret(c, travailId, { numeroVersion: async () => 42, ...dep }) });
}

async function jusquAuBout(moteur: ReturnType<typeof moteurAvec>, c: CommandeFabrication, depart?: Travail) {
  let travail = depart ?? (await moteur.lancer(c, { travailId: "tr-cc", versionId: "ver-cc", titre: "Essai" } as never));
  for (let i = 0; i < 400 && travail.statut !== "termine" && travail.statut !== "echec"; i++) travail = (await moteur.avancer(travail, c)).travail;
  return travail;
}

/** Range le travail sous la dernière version de la vidéo (comme la fabrication réelle). */
async function rangerTravail(travail: Travail, c: CommandeFabrication) {
  const d = depots();
  const video = (await d.videos.obtenir(VIDEO))!;
  await d.videos.modifier(VIDEO, { formatId: "cas-concret", estDemo: false });
  await d.versions.modifier(video.versionChoisieId!, { commande: c, travailId: travail.id, numero: 99 });
  await d.travaux.enregistrer({ ...travail, cibleId: VIDEO, versionId: video.versionChoisieId! });
}

beforeAll(async () => {
  process.env.SESSION_SECRET = "t".repeat(48);
  const e = await hash(MDP, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  process.env.STUDIO_PASSWORD_HASH_B64 = Buffer.from(e).toString("base64");
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  await auth.seConnecter(MDP, false);
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});


const DIT_FACEBOOK = "Écrivez C.R.M. en commentaire. Je vous envoie la structure complète.";

describe("FIX-CC-FIN-NON-CHOISIE · T4 · aperçu = fabrication (chemin réel)", () => {
  it("l'écran de validation montre la fin de Facebook mot pour mot et « aucune » pour les autres ; la voix lit exactement cela", async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const { executer } = ecritureComptee();
    const moteur = moteurAvec({ rendu: renduImmediat(), attendre: async () => {}, executer, claudeActif: async () => false });
    const c = commande();
    const arrete = await jusquAuBout(moteur, c);
    expect(arrete.erreur).toMatchObject({ code: CODE_SCRIPT_A_VALIDER });
    expect(lire).not.toHaveBeenCalled();
    await rangerTravail(arrete, c);

    const apercu = (await scripts.apercuScriptCasConcret(VIDEO))!;
    demandesRendu.length = 0;
    expect(apercu.fins).toHaveLength(2);
    const fb = apercu.fins.find((f) => f.reseaux === "facebook")!;
    const autres = apercu.fins.find((f) => f.reseaux !== "facebook")!;
    expect(fb.dit).toBe(DIT_FACEBOOK);
    // 18/11 (relecteur A) : l'écrit montré = l'écrit de la ligne de table (invite + mot + suite), pas seulement le mot.
    expect(fb.ecrits).toEqual(["Écrivez CRM en commentaire", "Je vous envoie la structure complète"]);
    expect(autres).toEqual({ reseaux: "instagram-tiktok-linkedin", dit: FIN_AUCUNE, ecrits: [] });

    await scripts.validerScriptCasConcret(VIDEO, { maintenant: Date.UTC(2026, 10, 18) });
    const fini = await jusquAuBout(moteur, c, await moteur.reessayer(arrete));
    expect(fini.erreur?.messagePourWill).toBeUndefined();
    expect(fini.statut).toBe("termine");

    // Les textes lus par la voix : le corps, puis la seule fin non vide, mot pour mot celle de l'aperçu ; rien pour la fin vide.
    const lus = lire.mock.calls.map((x) => String(x[0].texte));
    const dits = apercu.fins.filter((f) => f.dit !== FIN_AUCUNE).map((f) => f.dit);
    expect(dits).toEqual([DIT_FACEBOOK]);
    expect(lus.filter((t) => t.includes("Écrivez"))).toEqual(dits);
    expect(lus).toHaveLength(1 + dits.length);
    expect(lus.join(" ")).not.toMatch(/diagnostic|quelques minutes|lien/i);
    // Les écrits montrés sont ceux des écrans de fin réellement passés au rendu (invite / mot / suite ; invite / cadeau / ligne ; balises `*` retirées).
    const sansBalise = (t: unknown) => String(t ?? "").replace(/\*/g, "").trim();
    const propsFin = demandesRendu
      .map((x) => (x as { parametres?: { proprietes?: Record<string, unknown> } }).parametres?.proprietes)
      .filter((p): p is Record<string, unknown> => !!p && (p.type === "appel-mot" || p.type === "promesse"));
    const dessines = propsFin.map((p) => (p.type === "appel-mot" ? [p.invite, p.mot, p.suite] : [p.invite, p.cadeau, p.ligne]).map(sansBalise).filter(Boolean).join(" "));
    expect(dessines).toEqual(fb.ecrits);

    // Les fichiers fabriqués ont les réseaux des lignes de l'aperçu.
    const fichiers = ((fini.parametres as { casConcret?: { journal?: unknown } }).casConcret ?? {}) as { journal?: { montage?: Record<string, unknown> } };
    const reseauxFabriques = Object.keys(fichiers.journal?.montage ?? {}).sort();
    expect(reseauxFabriques).toEqual(apercu.fins.map((f) => `fin-${f.reseaux}`).sort());
  });
});
