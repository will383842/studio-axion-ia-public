/**
 * S1b : raccords réels et simulés du moteur « Cas concret MD » (`src/services/cas-concret-branchements.ts`). Base en
 * mémoire, fournisseurs de simulation, rendu simulé dont l'horloge avance d'elle-même : aucun appel réseau (`fetch`
 * espionné), rien de payé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { fournisseurVoixSimulation } = await import("@/fournisseurs/simulation/autres");
const { creerMoteurMontageCasConcret, servicesCasConcret } = await import("@/moteurs/montage-cas-concret");
const b = await import("@/services/cas-concret-branchements");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DependancesBranchementsCasConcret } from "@/services/cas-concret-branchements";

/** V4-3 : ces essais exercent l'écriture de Claude comme avant (aucun script validé, aucun arrêt « à valider ») ; les deux ont leurs tests (`tests/cas-concret/script-valide/`). */
const SANS_SCRIPT_V4_3 = { scriptValide: async () => null, validationScript: false, numeroVersion: async () => 42 };

const VIDEO = "v-03";
const RESEAUX = ["facebook", "instagram", "tiktok", "linkedin"] as const;

/** Rendu simulé qui finit tout à la lecture suivante (son horloge avance d'une minute à chaque lecture). */
function renduImmediat() {
  let t = 0;
  return { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true };
}

function commande(extra: { voixId?: string | null; mot?: string; reseaux?: readonly string[] } = {}): CommandeFabrication {
  const voixId = extra.voixId === undefined ? "voix-clara" : extra.voixId;
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
    distribution: [{ role: "voix", source: "double", personnageId: "p-clara", fournisseurVoix: "simulation", ...(voixId ? { voixId } : {}) }],
    styles: { sousTitres: null, decor: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { casConcret: { casId: "recrutement-apporteurs", porte: "porte-a", mot: extra.mot ?? "APPORT", avecMot: true, reseaux: [...(extra.reseaux ?? RESEAUX)], essai: false, codeSuivi: "cc-recrutement-apporteurs-abc123" } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "2026-10-12T09:00:00.000Z",
  } as unknown as CommandeFabrication;
}

/** Moteur branché sur les raccords, avec des dépendances remplacées. */
function moteurAvec(dep: DependancesBranchementsCasConcret) {
  return creerMoteurMontageCasConcret({ outils: (c, travailId) => b.outilsCasConcret(c, travailId, { ...SANS_SCRIPT_V4_3, ...dep }) });
}

/** Lance puis fait avancer le travail jusqu'à « terminé » ou « échec » (au plus `tours` tours). */
async function jusquAuBout(moteur: ReturnType<typeof moteurAvec>, c: CommandeFabrication, depart?: Travail, tours = 400) {
  let travail = depart ?? (await moteur.lancer(c, { travailId: "tr-cc", versionId: "ver-cc", titre: "Essai" } as never));
  let resultat: unknown;
  for (let i = 0; i < tours && travail.statut !== "termine" && travail.statut !== "echec"; i++) {
    const r = await moteur.avancer(travail, c);
    travail = r.travail;
    if (r.resultat) resultat = r.resultat;
  }
  return { travail, resultat: resultat as { sorties: unknown[]; projetMontage: { casConcret: { fins: unknown[] } } } | undefined };
}

let espionFetch: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  reinitialiserDepots();
  espionFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("S1b · branchement", () => {
  it("le module se branche sur le moteur par son seul chargement", () => {
    expect(typeof servicesCasConcret().outils).toBe("function");
  });
});

describe("S1b · simulation de bout en bout", () => {
  it("un travail lancé atteint « terminé » sans aucun appel réseau", async () => {
    const { travail, resultat } = await jusquAuBout(moteurAvec({ rendu: renduImmediat(), attendre: async () => {} }), commande());
    expect(travail.erreur?.messagePourWill).toBeUndefined();
    expect(travail.statut).toBe("termine");
    expect(resultat?.sorties).toHaveLength(1);
    expect(resultat?.projetMontage.casConcret.fins.length).toBeGreaterThan(0);
    expect(espionFetch).not.toHaveBeenCalled();
  });

  it("captures : en simulation, l'écran réel prend son dessin de repli (jamais d'échec)", async () => {
    const o = await b.outilsCasConcret(commande(), "tr-cc", { rendu: renduImmediat() });
    const r = await o.captures.capturer({ id: "e05", page: "https://axion-ia.com/fr/appel", parametres: { type: "image", format: "9:16", mouvement: "defilement", dureeSec: 6 }, cle: "captures-cas-concret/x.jpg" });
    expect(r.ok).toBe(false);
    expect(await o.captures.existe("captures-cas-concret/x.jpg")).toBe(false);
  });
});

describe("S1b · la voix désignée", () => {
  it("deux voix prêtes, celle de l'avocat en second : c'est elle qui est lue", async () => {
    const lues: string[] = [];
    const lire = fournisseurVoixSimulation.lire.bind(fournisseurVoixSimulation);
    vi.spyOn(fournisseurVoixSimulation, "lire").mockImplementation(async (d) => {
      lues.push(d.idExterne);
      return lire(d);
    });
    expect((await depots().voix.lister((v) => v.statut === "pret")).map((v) => v.id)).toEqual(["voix-will", "voix-clara"]);
    const idExterne = async (voixId: string) => (await depots().ressourcesFournisseurs.lister((r) => r.entiteId === voixId && !r.remplaceeLe))[0]?.idExterne;
    const clara = await idExterne("voix-clara");
    expect(clara).toBeTruthy();
    expect(clara).not.toBe(await idExterne("voix-will"));
    const o = await b.outilsCasConcret(commande({ voixId: "voix-clara" }), "tr-cc", { rendu: renduImmediat() });
    expect(o.voix.idVoix).toBe(clara);
    const { travail } = await jusquAuBout(moteurAvec({ rendu: renduImmediat(), attendre: async () => {} }), commande({ voixId: "voix-clara" }));
    expect(travail.statut).toBe("termine");
    expect(lues.length).toBeGreaterThan(0);
    expect(new Set(lues)).toEqual(new Set([clara]));
  });

  it("l'horodatage de la voix est gardé (il laisse les hésitations dans un blanc, où la mesure les trouve) ; aligneur sans horodatage", async () => {
    const o = await b.outilsCasConcret(commande(), "tr-cc-cal", { rendu: renduImmediat() });
    const reel = o.voix.aligneur().mode !== "simulation";
    expect(o.voix.caler(false)).toBe(false);
    expect(o.voix.caler(true)).toBe(reel);
  });

  it("voix absente ou pas prête : refus en phrase avant toute dépense", async () => {
    const reserver = vi.fn(async () => {});
    await expect(b.outilsCasConcret(commande({ voixId: null }), "tr-cc", { rendu: renduImmediat(), verifierEtReserver: reserver })).rejects.toThrow(b.VOIX_PAS_PRETE);
    await depots().voix.modifier("voix-clara", { statut: "en_cours" } as never);
    await expect(b.outilsCasConcret(commande(), "tr-cc", { rendu: renduImmediat(), verifierEtReserver: reserver })).rejects.toThrow(b.VOIX_PAS_PRETE);
    const { travail } = await jusquAuBout(moteurAvec({ rendu: renduImmediat(), verifierEtReserver: reserver }), commande(), undefined, 3);
    expect(travail.statut).toBe("echec");
    expect(travail.erreur?.messagePourWill).toContain(b.VOIX_PAS_PRETE);
    expect(reserver).not.toHaveBeenCalled();
  });
});

describe("X1 · voix d'essai au débit de la recette", () => {
  it("en simulation, la voix lit à 3,4 mots par seconde une fois le tempo appliqué (vidéo de référence : 167 mots en 53 s)", async () => {
    const { DEBIT_RECETTE } = await import("@/moteurs/montage-cas-concret/regles");
    const { TEMPO_VOIX } = await import("@/formats/cas-concret");
    const debits: (number | undefined)[] = [];
    const lire = fournisseurVoixSimulation.lire.bind(fournisseurVoixSimulation);
    vi.spyOn(fournisseurVoixSimulation, "lire").mockImplementation(async (d) => {
      debits.push(d.motsParSeconde);
      return lire(d);
    });
    const { travail } = await jusquAuBout(moteurAvec({ rendu: renduImmediat(), attendre: async () => {} }), commande());
    expect(travail.statut).toBe("termine");
    expect(debits.length).toBeGreaterThan(0);
    for (const d of debits) expect(d).toBeCloseTo(DEBIT_RECETTE * TEMPO_VOIX, 3);
  });
});

describe("S1b · production", () => {
  it("stockage non relié en production : refus en phrase, avant toute dépense", async () => {
    const reserver = vi.fn(async () => {});
    const executer = vi.fn();
    const dep: DependancesBranchementsCasConcret = { production: true, rendu: { service: creerServiceRenduSimule(), simule: false }, verifierEtReserver: reserver, executer, claudeActif: async () => true };
    await expect(b.outilsCasConcret(commande(), "tr-cc", dep)).rejects.toThrow(b.STUDIO_NON_RELIE);
    const { travail } = await jusquAuBout(moteurAvec(dep), commande(), undefined, 3);
    expect(travail.statut).toBe("echec");
    expect(travail.erreur?.messagePourWill).toContain(b.STUDIO_NON_RELIE);
    expect(reserver).not.toHaveBeenCalled();
    expect(executer).not.toHaveBeenCalled();
  });
});

describe("S1b · budget", () => {
  it("la réservation de budget précède chaque lecture de voix et chaque appel d'écriture", async () => {
    const ordre: string[] = [];
    const lire = fournisseurVoixSimulation.lire.bind(fournisseurVoixSimulation);
    vi.spyOn(fournisseurVoixSimulation, "lire").mockImplementation(async (d) => {
      ordre.push("lecture");
      return lire(d);
    });
    const dep: DependancesBranchementsCasConcret = {
      rendu: renduImmediat(),
      attendre: async () => {},
      claudeActif: async () => true,
      verifierBudget: async () => {
        ordre.push("prevol-ecriture");
      },
      executer: async (_videoId, role, entree) => {
        ordre.push("appel-ecriture");
        const sortie = role.simuler(entree);
        return { ok: true, simule: true, donnees: typeof sortie === "string" ? undefined : sortie };
      },
      verifierEtReserver: async (_e, _a, _q, demande) => {
        expect(demande).toEqual({ videoId: VIDEO, travailId: "tr-cc" });
        ordre.push("reserve-voix");
      },
    };
    const { travail } = await jusquAuBout(moteurAvec(dep), commande());
    expect(travail.statut).toBe("termine");
    expect(ordre.filter((x) => x === "lecture").length).toBeGreaterThan(1);
    expect(ordre).toContain("appel-ecriture");
    ordre.forEach((x, i) => {
      if (x === "lecture") expect(ordre[i - 1]).toBe("reserve-voix");
      if (x === "appel-ecriture") expect(ordre[i - 1]).toBe("prevol-ecriture");
    });
  });

  it("budget refusé avant l'écriture : aucun appel, phrase rendue", async () => {
    const executer = vi.fn();
    const o = await b.outilsCasConcret(commande(), "tr-cc", {
      rendu: renduImmediat(),
      claudeActif: async () => true,
      executer,
      verifierBudget: async () => {
        throw Object.assign(new Error("Budget dépassé (détail interne)."), { code: "BUDGET_DEPASSE" });
      },
    });
    expect(await o.ecriture.budget.reserver({ appelId: "a", videoId: VIDEO, etape: "Cas concret · écriture", modele: "m", coutEstimeUsd: 0.2 })).toEqual({ ok: false, message: "Budget du mois atteint." });
    expect(executer).not.toHaveBeenCalled();
  });

  it("l'écriture passe par le chemin de dépense de la vidéo, sur le plafond propre du format", async () => {
    const appels: { videoId: string; etape: string; plafond: string }[] = [];
    const o = await b.outilsCasConcret(commande(), "tr-cc", {
      rendu: renduImmediat(),
      executer: async (videoId, _role, _entree, options) => {
        appels.push({ videoId, etape: options.etape, plafond: options.plafondPropre.prefixeEtape });
        return { ok: false, arret: "plafond-video", message: "Plafond de cette vidéo atteint." };
      },
    });
    const { roleEcritureCasConcret, roleReformulationCasConcret } = await import("@/moteurs/montage-cas-concret/ecriture");
    expect(await o.ecriture.appeler(roleEcritureCasConcret, { contexte: {}, variable: "x" })).toEqual({ ok: false, arret: "plafond-video", message: "Plafond de cette vidéo atteint." });
    await o.ecriture.appeler(roleReformulationCasConcret, { contexte: {}, variable: "<phrase>x</phrase>" });
    expect(appels).toEqual([
      { videoId: VIDEO, etape: "Cas concret · écriture", plafond: "Cas concret ·" },
      { videoId: VIDEO, etape: "Cas concret · reformulation", plafond: "Cas concret ·" },
    ]);
  });
});

describe("S1b · pannes d'essai", () => {
  it("mot PANNE en simulation : « Les écrans » échouent une fois, « Réessayer » mène au bout", async () => {
    const moteur = moteurAvec({ rendu: renduImmediat(), attendre: async () => {} });
    const c = commande({ mot: "PANNEM" });
    const premier = await jusquAuBout(moteur, c);
    expect(premier.travail.statut).toBe("echec");
    expect(premier.travail.etapes.find((e) => e.statut === "echec")?.cle).toBe("ecrans");
    expect(premier.travail.erreur?.reessayable).toBe(true);
    const suite = await jusquAuBout(moteur, c, await moteur.reessayer(premier.travail));
    expect(suite.travail.statut).toBe("termine");
  });

  it("mot REFUS en simulation : l'écriture est refusée deux fois, aucune voix lue", async () => {
    const lire = vi.spyOn(fournisseurVoixSimulation, "lire");
    const { travail } = await jusquAuBout(moteurAvec({ rendu: renduImmediat(), attendre: async () => {} }), commande({ mot: "REFUSM" }));
    expect(travail.statut).toBe("echec");
    expect(travail.etapes.find((e) => e.statut === "echec")?.cle).toBe("ecriture");
    expect(travail.erreur?.reessayable).toBe(true);
    expect(lire).not.toHaveBeenCalled();
  });

  it("les pannes d'essai ne se produisent jamais quand le rendu est réel", async () => {
    const reel = { service: creerServiceRenduSimule(), simule: false };
    const panne = await b.outilsCasConcret(commande({ mot: "PANNEM" }), "tr-cc", { rendu: reel });
    expect(panne.contexte.panneDEssai).toBeUndefined();
    const executer = vi.fn(async () => ({ ok: true as const, simule: true, donnees: { fiche: 1 } }));
    const refus = await b.outilsCasConcret(commande({ mot: "REFUSM" }), "tr-cc", { rendu: reel, executer });
    const { roleEcritureCasConcret } = await import("@/moteurs/montage-cas-concret/ecriture");
    expect(await refus.ecriture.appeler(roleEcritureCasConcret, { contexte: {}, variable: "x" })).toEqual({ ok: true, simule: true, donnees: { fiche: 1 } });
    expect(executer).toHaveBeenCalledTimes(1);
    // Tout simulé : la panne est bien posée.
    expect((await b.outilsCasConcret(commande({ mot: "PANNEM" }), "tr-cc", { rendu: renduImmediat() })).contexte.panneDEssai).toBe("ecrans");
  });
});

describe("S1b · contexte", () => {
  it("table des fins du diagnostic ; seuls les sons validés qui ont un fichier", async () => {
    const { TABLE_FINS_DIAGNOSTIC } = await import("@/briques/fins/table-diagnostic");
    const c = commande();
    c.bruitagesDisponibles = [
      { elementId: "son-a", declencheur: "impact", variante: 1, dureeSec: 0.3 },
      { elementId: "son-b", declencheur: "document", variante: 1, dureeSec: 0.4 },
    ];
    c.medias = { "son-a": { cle: "studio/dev/bruitages/a.wav", mime: "audio/wav" } } as CommandeFabrication["medias"];
    const o = await b.outilsCasConcret(c, "tr-cc", { rendu: renduImmediat() });
    expect(o.contexte.tableDesFins).toBe(TABLE_FINS_DIAGNOSTIC);
    expect(o.contexte.bruitagesValides.map((s) => s.elementId)).toEqual(["son-a"]);
    expect(o.contexte.bruitagesValides[0].cle).toBe("studio/dev/bruitages/a.wav");
  });

  it("assemblage simulé : durée des morceaux divisée par le tempo", () => {
    expect(b.dureeAssemblee([{ deSec: 0, aSec: 40 }, { deSec: 0, aSec: 14 }], 1.08)).toBe(50);
  });
});
