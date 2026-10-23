/**
 * X10 · délai de garde commun branché sur le « Cas concret MD », et reprise après un redémarrage.
 *  1. Écrans et finitions posent `garde` (`delaiSansNouvelleMs`).
 *  2. Un rendu relu sans état gardé (raccord de la voix, capture) figé : `-e1`, puis `-e2`, puis un échec clair, sans boucle.
 *  3. De bout en bout : un écran, une composition, le traitement de la voix figés → l'étape s'arrête en échec lisible,
 *     jamais « en cours » sans fin.
 *  4. Le serveur de rendu redémarre (il oublie tout) au milieu des écrans puis des finitions : la fabrication reprend et
 *     finit ; « Réessayer » relit sous un autre identifiant (pas l'échec gardé).
 * Base en mémoire, rendu simulé à horloge pilotée, stockage d'essai : aucun appel réseau (`fetch` espionné).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { stockageSimulation } = await import("@/fournisseurs/simulation/autres");
const { delaiSansNouvelleMs } = await import("@/fournisseurs/rendu/garde");
const { creerMoteurMontageCasConcret, RenduEnCours } = await import("@/moteurs/montage-cas-concret");
const b = await import("@/services/cas-concret-branchements");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { DemandeRendu, EtatRendu, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import type { DependancesBranchementsCasConcret } from "@/services/cas-concret-branchements";

const MIN = 60_000;

function commande(reseaux: readonly string[] = ["facebook", "linkedin"]): CommandeFabrication {
  return {
    versionContrat: 2,
    moteurId: "montage-cas-concret",
    videoId: "v-x10",
    formatId: "cas-concret",
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: 50,
    ratios: ["9:16"],
    script: { blocs: [], texteComplet: "" },
    distribution: [{ role: "voix", source: "double", personnageId: "p-clara", fournisseurVoix: "simulation", voixId: "voix-clara" }],
    styles: { sousTitres: null, decor: null, lut: null, musique: null },
    briques: { "sous-titres": true, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: { casConcret: { casId: "recrutement-apporteurs", porte: "porte-a", mot: "APPORT", avecMot: true, reseaux: [...reseaux], essai: false, codeSuivi: "cc-recrutement-apporteurs-abc123" } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "2026-10-12T09:00:00.000Z",
  } as unknown as CommandeFabrication;
}

/** Stockage d'essai relié : signe des adresses, connaît les fichiers déposés (aucun octet, aucun réseau). */
function stockageRelie(fichiers = new Set<string>(["studio/dev/public/demo/essai-voix.mp3"])): StockageFichiers {
  return {
    ...stockageSimulation,
    mode: "reel",
    async confirmerDepot(cle: string) {
      return { ok: fichiers.has(cle) };
    },
    async urlLecture(cle: string) {
      return `https://r2.exemple/${cle}`;
    },
    async urlLectureDuree(cle: string) {
      return `https://r2.exemple/${cle}?signe`;
    },
    async urlDepotDuree(cle: string) {
      return `https://r2.exemple/depot/${cle}`;
    },
  } as StockageFichiers;
}

const estEcran = (d: DemandeRendu) => d.operation === "composition" && (d.parametres as { mode?: string }).mode === undefined;
const estComplet = (d: DemandeRendu) => d.operation === "composition" && (d.parametres as { mode?: string }).mode === "complet";

/**
 * Serveur de rendu simulé à horloge pilotée ; `figer(d)` : la demande reste « en cours » à 40 % pour toujours (le
 * navigateur du rendu ne répond plus). Comme `studio-rendu` : une demande ratée soumise de nouveau repart.
 */
function serveur(figer: (d: DemandeRendu) => boolean = () => false) {
  const h = { t: Date.UTC(2026, 9, 12, 9, 0, 0) };
  const simule = creerServiceRenduSimule(() => h.t);
  const figees = new Set<string>();
  const soumises: DemandeRendu[] = [];
  const panne = { figer };
  const service: ServiceRendu & { oublierTout: () => void } = {
    async soumettre(d) {
      soumises.push(d);
      if (panne.figer(d)) figees.add(d.idRendu);
      return simule.soumettre(d);
    },
    async etat(id): Promise<EtatRendu> {
      const e = await simule.etat(id);
      if (figees.has(id) && e.statut !== "inconnu") return { statut: "en_cours", progression: 40 };
      return e;
    },
    oublierTout: () => simule.oublierTout(),
  };
  return { h, service, soumises, panne, ids: (f: (d: DemandeRendu) => boolean) => soumises.filter(f).map((d) => d.idRendu) };
}

/** Écriture simulée (le gabarit du rôle), sans le chemin de dépense du studio. */
const ecritureSimulee: DependancesBranchementsCasConcret["executer"] = async (_v, role, entree) => {
  const sortie = role.simuler(entree);
  return typeof sortie === "string" ? { ok: true, simule: true, texte: sortie } : { ok: true, simule: true, donnees: sortie };
};

function moteurAvec(s: ReturnType<typeof serveur>, extra: DependancesBranchementsCasConcret = {}) {
  return creerMoteurMontageCasConcret({ outils: (c, travailId, o) => b.outilsCasConcret(c, travailId, { rendu: { service: s.service, simule: false }, stockage: stockageRelie(), horloge: () => s.h.t, relance: o?.relance ?? 0, executer: ecritureSimulee, scriptValide: async () => null, validationScript: false, numeroVersion: async () => 42, ...extra }) });
}

/** Passages de la boucle de fond (aller-retour JSON), une minute de rendu entre deux ; `avant(n)` : avant chaque passage. */
async function passages(moteur: ReturnType<typeof moteurAvec>, s: ReturnType<typeof serveur>, c: CommandeFabrication, depart?: Travail, avant: (n: number, t: Travail) => void = () => undefined, max = 600) {
  let travail = depart ?? (await moteur.lancer(c, { travailId: "tr-x10", versionId: "ver-x10", titre: "Essai" } as never));
  let n = 0;
  for (; n < max && travail.statut !== "termine" && travail.statut !== "echec"; n++) {
    avant(n, travail);
    travail = (await moteur.avancer(JSON.parse(JSON.stringify(travail)) as Travail, c, s.h.t)).travail;
    s.h.t += MIN;
  }
  return { travail, passages: n };
}

/** Échec clair : une seule étape en échec, aucune en cours, phrase lisible. */
function echecClair(t: Travail, cle: string) {
  if (t.etapes.find((e) => e.statut === "echec")?.cle !== cle) throw new Error(`${t.erreur?.messagePourWill} / ${t.erreur?.detailTechnique}`);
  expect(t.statut).toBe("echec");
  expect(t.etapes.filter((e) => e.statut === "echec").map((e) => e.cle)).toEqual([cle]);
  expect(t.etapes.filter((e) => e.statut === "en_cours")).toEqual([]);
  expect(t.erreur?.reessayable).toBe(true);
  expect(t.erreur?.messagePourWill).toMatch(/n'a pas abouti\. Le serveur de rendu n'a plus donné de nouvelle\. Vous pouvez réessayer cette étape seule\.$/);
  expect(t.erreur?.messagePourWill).not.toMatch(/\b[0-9a-f]{12,}\b|\bcc-|https?:/);
}

let espionFetch: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  reinitialiserDepots();
  espionFetch = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Aucun appel réseau dans ces tests.");
  });
});

afterEach(() => {
  expect(espionFetch).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe("X10 · 1. le délai de garde commun est posé", () => {
  it("écrans et finitions : `garde` au délai sans nouvelle de l'environnement", async () => {
    const o = await b.outilsCasConcret(commande(), "tr-x10", { rendu: { service: serveur().service, simule: false }, stockage: stockageRelie() });
    expect(o.scenes.garde?.delaiMs).toBe(delaiSansNouvelleMs());
    expect(o.montage.garde?.delaiMs).toBe(delaiSansNouvelleMs());
    expect(delaiSansNouvelleMs()).toBe(15 * MIN);
  });
});

describe("X10 · 2. un rendu relu sans état, figé : -e1, puis -e2, puis l'échec clair", () => {
  it("raccord de la voix : la garde déclenche `-e1` puis `-e2`, puis un échec qui ne boucle pas", async () => {
    const s = serveur(() => true);
    const o = await b.outilsCasConcret(commande(), "tr-x10", { rendu: { service: s.service, simule: false }, stockage: stockageRelie(), horloge: () => s.h.t });
    const asm = { id: "asm-fige", sortieCle: "studio/dev/audio-maitre/v/asm-fige.wav", morceaux: [{ entree: "studio/dev/a.wav", deSec: 0, aSec: 4 }] };
    const id = b.idRenduCasConcret("cc-asm", asm.id, asm.sortieCle);
    let erreur: unknown;
    let n = 0;
    for (; n < 120 && !erreur; n++) {
      const r = await o.voix.assembler(asm).catch((e: unknown) => e);
      if (!(r instanceof RenduEnCours)) erreur = r;
      s.h.t += MIN;
    }
    expect(erreur).toBeInstanceOf(Error);
    expect((erreur as Error).message).toMatch(/sans nouvelle depuis 15 min/);
    expect((erreur as { erreur: { reessayable: boolean } }).erreur.reessayable).toBe(true);
    expect([...new Set(s.ids(() => true))]).toEqual([id, `${id}-e1`, `${id}-e2`]);
    // ≈ 3 délais de garde, pas plus : chaque essai figé est abandonné au bout de 15 min.
    expect(n).toBeGreaterThanOrEqual(45);
    expect(n).toBeLessThanOrEqual(50);
    // Pas de boucle : relu de nouveau, le même échec, sans aucune nouvelle demande.
    const soumises = s.soumises.length;
    await expect(o.voix.assembler(asm)).rejects.toThrow(/sans nouvelle/);
    expect(s.soumises).toHaveLength(soumises);
  });

  it("capture du site figée : après `-e2`, l'écran prend son dessin de repli (jamais d'attente sans fin)", async () => {
    const s = serveur(() => true);
    const o = await b.outilsCasConcret(commande(), "tr-x10", { rendu: { service: s.service, simule: false }, stockage: stockageRelie(), horloge: () => s.h.t });
    const demande = { id: "e05", page: "https://axion-ia.com/fr/appel", parametres: { type: "image" as const, format: "9:16" as const, mouvement: "defilement" as const, dureeSec: 6 }, cle: "captures-cas-concret/fige.jpg" };
    let r: unknown;
    for (let n = 0; n < 120; n++) {
      r = await o.captures.capturer(demande).catch((e: unknown) => e);
      if (!(r instanceof RenduEnCours)) break;
      s.h.t += MIN;
    }
    expect(r).toEqual({ ok: false, raison: "la capture a échoué", reessayable: true });
  });

  it("après « Réessayer », les rendus relus changent d'identifiant (le serveur ne rend plus l'échec gardé)", async () => {
    const s = serveur();
    const o = await b.outilsCasConcret(commande(), "tr-x10", { rendu: { service: s.service, simule: false }, stockage: stockageRelie(), relance: 2 });
    const asm = { id: "asm-r", sortieCle: "studio/dev/audio-maitre/v/asm-r.wav", morceaux: [{ entree: "studio/dev/a.wav", deSec: 0, aSec: 4 }] };
    await o.voix.assembler(asm).catch(() => undefined);
    expect(s.ids(() => true)).toEqual([`${b.idRenduCasConcret("cc-asm", asm.id, asm.sortieCle)}-r2`]);
  });
});

describe("X10 · 3. de bout en bout : un rendu figé arrête son étape, en clair", () => {
  it("un écran de la deuxième fin figé : `-e1`, puis « Les écrans » en échec ; « Réessayer » ne rend que lui et finit", async () => {
    // Une vidéo témoin (mêmes entrées : mêmes identifiants) désigne le dernier écran, celui de la dernière fin.
    const temoin = serveur();
    expect((await passages(moteurAvec(temoin), temoin, commande())).travail.statut).toBe("termine");
    const cible = temoin.ids(estEcran).at(-1)!;
    reinitialiserDepots();
    const s = serveur((d) => estEcran(d) && d.idRendu.replace(/-e\d+$/, "") === cible);
    const moteur = moteurAvec(s);
    const c = commande();
    const { travail, passages: n } = await passages(moteur, s, c);
    echecClair(travail, "ecrans");
    expect(travail.erreur?.messagePourWill).toMatch(/^L'étape « Les écrans » n'a pas abouti\. Le rendu d'un écran de la fin pour/);
    expect(s.ids((d) => estEcran(d) && d.idRendu.startsWith(cible))).toEqual([cible, `${cible}-e1`]);
    expect(n).toBeLessThan(200);
    // Le serveur va mieux : « Réessayer » ne soumet que l'écran figé, puis la vidéo est faite.
    s.panne.figer = () => false;
    const ecrans = s.ids(estEcran).length;
    const fin = await passages(moteur, s, c, await moteur.reessayer(travail));
    expect(fin.travail.statut).toBe("termine");
    // Sous un autre identifiant : le rendu figé, que le serveur ne relance pas, n'est plus attendu.
    expect(s.ids(estEcran).slice(ecrans)).toEqual([`${cible}-r1`]);
  });

  it("la composition de la deuxième fin figée : `-e1`, puis « Les finitions » en échec ; « Réessayer » ne recompose qu'elle", async () => {
    const s = serveur();
    let compositions = 0;
    s.panne.figer = (d) => estComplet(d) && (d.idRendu.endsWith("-e1") || ++compositions === 2);
    const moteur = moteurAvec(s);
    const { travail } = await passages(moteur, s, commande());
    echecClair(travail, "montage");
    expect(travail.erreur?.messagePourWill).toMatch(/Le montage de la fin pour (Facebook|LinkedIn) n'a pas abouti\./);
    const ids = s.ids(estComplet);
    expect(ids).toHaveLength(3);
    expect(ids[2]).toBe(`${ids[1]}-e1`);
    // « Réessayer » : la fin figée repart sous l'identifiant suivant (le serveur ne relance pas un rendu figé), la
    // première n'est jamais recomposée.
    s.panne.figer = () => false;
    const fin = await passages(moteur, s, commande(), await moteur.reessayer(travail));
    expect(fin.travail.statut).toBe("termine");
    expect(s.ids(estComplet).slice(3)).toEqual([`${ids[1]}-e2`]);
  });

  it("le traitement de la voix figé : « La voix » en échec clair après ses nouveaux essais, jamais en cours sans fin", async () => {
    const s = serveur((d) => d.operation === "nettoyage-audio");
    const moteur = moteurAvec(s);
    const { travail, passages: n } = await passages(moteur, s, commande(["linkedin"]));
    echecClair(travail, "voix");
    expect(travail.erreur?.messagePourWill).toMatch(/Le (traitement|raccord) de la voix/);
    expect(n).toBeLessThan(200);
  });
});

describe("X10 · 4. le serveur de rendu redémarre pendant la fabrication", () => {
  it("il oublie tout pendant les écrans, puis pendant les finitions : la fabrication reprend et finit, sans relire la voix", async () => {
    const s = serveur();
    const moteur = moteurAvec(s);
    const c = commande();
    const oublis = new Set<string>();
    const { travail } = await passages(moteur, s, c, undefined, (_n, t) => {
      const enCours = t.etapes.find((e) => e.statut === "en_cours")?.cle;
      if ((enCours === "ecrans" || enCours === "montage") && !oublis.has(enCours) && s.soumises.some((d) => (enCours === "ecrans" ? estEcran(d) : estComplet(d)))) {
        oublis.add(enCours);
        s.service.oublierTout();
      }
    });
    expect([...oublis]).toEqual(["ecrans", "montage"]);
    expect(travail.erreur?.messagePourWill).toBeUndefined();
    expect(travail.statut).toBe("termine");
    // Les demandes que le serveur ne connaissait plus sont reparties sous un autre identifiant (délai de garde).
    expect(s.ids(estComplet).some((id) => id.endsWith("-e1"))).toBe(true);
  });
});
