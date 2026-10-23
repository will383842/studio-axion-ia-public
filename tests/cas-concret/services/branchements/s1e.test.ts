/**
 * S1e : trois pièges des raccords réels du « Cas concret MD », fermés avant l'essai réel.
 *  1. Médias publics : une clé « / » passe par `cleLisibleParLeRendu` ; un dossier non permis retire le bruitage.
 *  2. Reprises bornées : les finitions posent `seriesFichierInaccessible`.
 *  3. Boucle jamais tenue : capture, assemblage et mesure des blancs sont « soumettre puis relire » ; un passage de ce
 *     format rend la main en moins de 2 s.
 *  4. Reprise après panne : une étape payée n'est jamais relancée (coût égal au coût sans panne).
 * Base en mémoire, rendu simulé à horloge pilotée, stockage d'essai : aucun appel réseau (`fetch` espionné).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../../../helpers/next-mocks";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { reinitialiserDepots } = await import("@/donnees/memoire");
const { creerServiceRenduSimule } = await import("@/fournisseurs/simulation/rendu");
const { fournisseurVoixSimulation, stockageSimulation } = await import("@/fournisseurs/simulation/autres");
const { creerMoteurMontageCasConcret, RenduEnCours } = await import("@/moteurs/montage-cas-concret");
const { ETAPES_CAS_CONCRET } = await import("@/moteurs/montage-cas-concret/outils");
const b = await import("@/services/cas-concret-branchements");

import type { CommandeFabrication, Travail } from "@/domaine/types";
import type { StockageFichiers } from "@/fournisseurs/types";
import type { DependancesBranchementsCasConcret } from "@/services/cas-concret-branchements";

/** V4-3 : ces essais exercent l'écriture de Claude comme avant (aucun script validé, aucun arrêt « à valider ») ; les deux ont leurs tests (`tests/cas-concret/script-valide/`). */
const SANS_SCRIPT_V4_3 = { scriptValide: async () => null, validationScript: false, numeroVersion: async () => 42 };

const VIDEO = "v-03";

function commande(extra: { simulerEchecEtape?: string; reseaux?: readonly string[] } = {}): CommandeFabrication {
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
    entrees: { casConcret: { casId: "recrutement-apporteurs", porte: "porte-a", mot: "APPORT", avecMot: true, reseaux: [...(extra.reseaux ?? ["facebook", "linkedin"])], essai: false, codeSuivi: "cc-recrutement-apporteurs-abc123" } },
    reglages: {},
    plans: [],
    prononciations: [],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "2026-10-12T09:00:00.000Z",
    ...(extra.simulerEchecEtape ? { simulerEchecEtape: extra.simulerEchecEtape } : {}),
  } as unknown as CommandeFabrication;
}

/** Stockage d'essai relié : signe des adresses, connaît les fichiers déposés (aucun octet, aucun réseau). */
function stockageRelie(fichiers = new Set<string>()): StockageFichiers {
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
      fichiers.add(cle);
      return `https://r2.exemple/depot/${cle}`;
    },
  } as StockageFichiers;
}

/** Rendu simulé dont l'horloge ne bouge que quand le test l'avance. */
function renduPilote() {
  const h = { t: 0 };
  const service = creerServiceRenduSimule(() => h.t);
  return { h, service, rendu: { service, simule: false } };
}

function renduImmediat() {
  let t = 0;
  return { service: creerServiceRenduSimule(() => (t += 60_000)), simule: true };
}

function moteurAvec(dep: DependancesBranchementsCasConcret) {
  return creerMoteurMontageCasConcret({ outils: (c, travailId) => b.outilsCasConcret(c, travailId, { ...SANS_SCRIPT_V4_3, ...dep }) });
}

async function jusquAuBout(moteur: ReturnType<typeof moteurAvec>, c: CommandeFabrication, depart?: Travail, tours = 400) {
  let travail = depart ?? (await moteur.lancer(c, { travailId: "tr-cc", versionId: "ver-cc", titre: "Essai" } as never));
  let resultat: { sorties: { rapportQualite: { alertes: { code: string; message: string }[] } }[] } | undefined;
  for (let i = 0; i < tours && travail.statut !== "termine" && travail.statut !== "echec"; i++) {
    const r = await moteur.avancer(travail, c);
    travail = r.travail;
    if (r.resultat) resultat = r.resultat as never;
  }
  return { travail, resultat };
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

/* ------------------------------------------------------------------ */
/* 1. Médias publics                                                     */
/* ------------------------------------------------------------------ */

describe("S1e · 1. bruitages publics lus par le chemin commun", () => {
  const avecSons = () => {
    const c = commande();
    c.bruitagesDisponibles = [
      { elementId: "son-public", declencheur: "impact", variante: 1, dureeSec: 0.3 },
      { elementId: "son-interdit", declencheur: "document", variante: 1, dureeSec: 0.4 },
      { elementId: "son-stocke", declencheur: "chiffre", variante: 1, dureeSec: 0.2 },
    ];
    c.medias = {
      "son-public": { cle: "/bruitages/impact-1.wav", mime: "audio/wav" },
      "son-interdit": { cle: "/ailleurs/document.wav", mime: "audio/wav" },
      "son-stocke": { cle: "studio/dev/bruitages/c.wav", mime: "audio/wav" },
    } as CommandeFabrication["medias"];
    return c;
  };

  it("les bruitages de la chaîne ont des adresses lisibles par le rendu ; un dossier non permis est retiré avec une phrase", async () => {
    // La copie du fichier public existe déjà dans le stockage : rien n'est redéposé.
    const stockage = stockageRelie(new Set(["studio/dev/public/bruitages/impact-1.wav"]));
    const o = await b.outilsCasConcret(avecSons(), "tr-cc", { rendu: renduPilote().rendu, stockage });
    expect(o.contexte.bruitagesValides.map((s) => [s.elementId, s.cle])).toEqual([
      ["son-public", "studio/dev/public/bruitages/impact-1.wav"],
      ["son-stocke", "studio/dev/bruitages/c.wav"],
    ]);
    expect(o.contexte.bruitagesRetires).toEqual(["Le bruitage « document » ne peut pas être lu par le serveur du studio : la vidéo est fabriquée sans lui."]);
    // Les adresses données au rendu : jamais une clé publique signée telle quelle.
    const { lectures } = await o.montage.signer({ "bruitage-1": "/bruitages/impact-1.wav", "bruitage-2": "studio/dev/bruitages/c.wav" }, []);
    expect(lectures).toEqual({ "bruitage-1": "https://r2.exemple/studio/dev/public/bruitages/impact-1.wav?signe", "bruitage-2": "https://r2.exemple/studio/dev/bruitages/c.wav?signe" });
    await expect(o.montage.signer({ x: "/ailleurs/document.wav" }, [])).rejects.toThrow("Ce fichier ne peut pas être lu par le serveur du studio.");
    expect(espionFetch).not.toHaveBeenCalled();
  });

  it("la vidéo se fabrique sans le bruitage illisible ; l'alerte est au rapport de la sortie", async () => {
    const { travail, resultat } = await jusquAuBout(moteurAvec({ rendu: renduImmediat() }), avecSons());
    expect(travail.erreur?.messagePourWill).toBeUndefined();
    expect(travail.statut).toBe("termine");
    const alertes = resultat!.sorties[0].rapportQualite.alertes.filter((a) => a.code === "bruitage");
    expect(alertes.map((a) => a.message)).toEqual(["Le bruitage « document » ne peut pas être lu par le serveur du studio : la vidéo est fabriquée sans lui."]);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Reprises bornées                                                   */
/* ------------------------------------------------------------------ */

describe("S1e · 2. une entrée absente : une seule série", () => {
  it("le raccord réel pose `seriesFichierInaccessible` à une série", async () => {
    const o = await b.outilsCasConcret(commande(), "tr-cc", { rendu: renduPilote().rendu, stockage: stockageRelie() });
    expect(o.montage.seriesFichierInaccessible).toBe(b.SERIES_FICHIER_INACCESSIBLE_CAS_CONCRET);
    expect(b.SERIES_FICHIER_INACCESSIBLE_CAS_CONCRET).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Soumettre puis relire                                              */
/* ------------------------------------------------------------------ */

describe("S1e · 3. la boucle de fond n'attend jamais un rendu", () => {
  const vite = async <T>(f: () => Promise<T>) => {
    const t0 = Date.now();
    const r = await f().then(
      (v) => ({ ok: true as const, v }),
      (e: unknown) => ({ ok: false as const, e }),
    );
    expect(Date.now() - t0).toBeLessThan(2_000);
    return r;
  };

  it("capture : soumise, puis relue à chaque passage, jamais attendue ; finie, ses mesures sont rendues", async () => {
    const p = renduPilote();
    const o = await b.outilsCasConcret(commande(), "tr-cc", { rendu: p.rendu, stockage: stockageRelie() });
    const demande = { id: "e05", page: "https://axion-ia.com/fr/appel", parametres: { type: "image" as const, format: "9:16" as const, mouvement: "defilement" as const, dureeSec: 6 }, cle: "captures-cas-concret/x.jpg" };
    const id = b.idRenduCasConcret("cc-capture", demande.cle);
    for (let i = 0; i < 2; i++) {
      const r = await vite(() => o.captures.capturer(demande));
      expect(r.ok ? r.v : r.e).toBeInstanceOf(RenduEnCours);
    }
    expect(p.service.soumissions(id)).toBe(1);
    p.h.t += 3_600_000;
    const fini = await vite(() => o.captures.capturer(demande));
    expect(fini.ok && fini.v).toMatchObject({ ok: true, cle: demande.cle });
  });

  it("assemblage et mesure des blancs : soumis, relus, jamais attendus", async () => {
    const p = renduPilote();
    const o = await b.outilsCasConcret(commande(), "tr-cc", { rendu: p.rendu, stockage: stockageRelie() });
    const asm = { id: "asm-1", sortieCle: "studio/dev/audio-maitre/v/asm-1.wav", morceaux: [{ entree: "studio/dev/a.wav", deSec: 0, aSec: 40 }], tempo: 1.08 };
    const pauses = [
      { deSec: 1, aSec: 1.4 },
      { deSec: 5, aSec: 5.5 },
    ];
    for (const appel of [() => o.voix.assembler(asm) as Promise<unknown>, () => o.voix.mesurerPauses("studio/dev/a.wav", pauses) as Promise<unknown>]) {
      const r = await vite(appel);
      expect(r.ok ? r.v : r.e).toBeInstanceOf(RenduEnCours);
    }
    // Les deux blancs sont soumis dès le premier passage.
    for (const x of pauses) expect(p.service.soumissions(b.idRenduCasConcret("cc-pause", "studio/dev/a.wav", x.deSec, x.aSec))).toBe(1);
    p.h.t += 3_600_000;
    const a = await vite(() => o.voix.assembler(asm));
    expect(a.ok && a.v).toMatchObject({ cle: asm.sortieCle });
    const m = await vite(() => o.voix.mesurerPauses("studio/dev/a.wav", pauses));
    expect(m.ok && m.v).toEqual([-90, -90]);
  });

  it("une panne passagère du rendu est soumise à nouveau sous un autre identifiant, au plus deux fois", async () => {
    const soumis: string[] = [];
    const service = {
      async soumettre(d: { idRendu: string }) {
        soumis.push(d.idRendu);
        return { idRendu: d.idRendu };
      },
      async etat(id: string) {
        return soumis.includes(id) ? { statut: "echec" as const, erreur: { code: "indisponible" as const, reessayable: true, message: "occupé" } } : { statut: "inconnu" as const };
      },
    };
    const o = await b.outilsCasConcret(commande(), "tr-cc", { rendu: { service, simule: false }, stockage: stockageRelie() });
    const asm = { id: "asm-2", sortieCle: "studio/dev/audio-maitre/v/asm-2.wav", morceaux: [{ entree: "studio/dev/a.wav", deSec: 0, aSec: 4 }] };
    let fin = 0;
    for (let i = 0; i < 4; i++) {
      const r = await o.voix.assembler(asm).catch((e: unknown) => e);
      if (!(r instanceof RenduEnCours)) {
        fin = i;
        expect(r).toBeInstanceOf(Error);
        break;
      }
    }
    expect(fin).toBeGreaterThan(0);
    const id = b.idRenduCasConcret("cc-asm", asm.id, asm.sortieCle);
    expect([...new Set(soumis)]).toEqual([id, `${id}-e1`, `${id}-e2`]);
  });

  it("de bout en bout, rendu et stockage reliés : chaque passage du format rend la main en moins de 2 s", async () => {
    const p = renduPilote();
    // Lectures d'un rendu pas fini, par opération : le passage a rendu la main au lieu d'attendre.
    const operations = new Map<string, string>();
    const relusPasFinis = new Map<string, number>();
    const service = {
      async soumettre(d: Parameters<typeof p.service.soumettre>[0]) {
        operations.set(d.idRendu, d.operation);
        relusPasFinis.set(d.operation, (relusPasFinis.get(d.operation) ?? 0) + 1);
        return p.service.soumettre(d);
      },
      async etat(id: string) {
        const e = await p.service.etat(id);
        const op = operations.get(id);
        if (op && e.statut !== "termine" && e.statut !== "echec") relusPasFinis.set(op, (relusPasFinis.get(op) ?? 0) + 1);
        return e;
      },
    };
    // X4 : la recette lit le son BRUT de la voix d'essai, un fichier public déjà copié dans le stockage (sans réseau).
    const moteur = moteurAvec({ rendu: { service, simule: false }, stockage: stockageRelie(new Set(["studio/dev/public/demo/essai-voix.mp3"])) });
    const c = commande({ reseaux: ["linkedin"] });
    let travail = await moteur.lancer(c, { travailId: "tr-cc", versionId: "ver-cc", titre: "Essai" } as never);
    let passages = 0;
    let plusLongMs = 0;
    const atteintes = new Set<string>();
    for (; passages < 600 && travail.statut !== "termine" && travail.statut !== "echec"; passages++) {
      const t0 = Date.now();
      travail = (await moteur.avancer(travail, c)).travail;
      plusLongMs = Math.max(plusLongMs, Date.now() - t0);
      const enCours = travail.etapes.find((e) => e.statut === "en_cours");
      if (enCours) atteintes.add(enCours.cle);
      // Le rendu avance de 5 s entre deux passages (le rythme de la boucle de fond).
      p.h.t += 5_000;
    }
    expect(travail.erreur?.messagePourWill).toBeUndefined();
    expect(travail.statut).toBe("termine");
    expect(plusLongMs).toBeLessThan(2_000);
    expect([...atteintes]).toEqual(expect.arrayContaining(["captures", "voix", "montage"]));
    // Captures et recettes de la voix (X4 : `nettoyage-audio`, à la place de l'assemblage) ont été lues pas finies : le
    // passage a rendu la main (la voix d'essai n'a pas de blanc à mesurer ; la mesure des blancs est vérifiée plus haut).
    expect(Object.fromEntries([...relusPasFinis].filter(([op]) => ["capture-site", "nettoyage-audio"].includes(op)).map(([op, n]) => [op, n > 0]))).toEqual({ "capture-site": true, "nettoyage-audio": true });
    expect(espionFetch).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/* 4. Reprise après panne                                                */
/* ------------------------------------------------------------------ */

describe("S1e · 4. une étape payée n'est jamais relancée", () => {
  /** Dépendances qui comptent ce qui se paie : lectures de voix, appels d'écriture, réservations. */
  function compteur(panneReservation?: number) {
    const compte = { lectures: 0, ecritures: 0, reserveCentimes: 0, reservations: 0 };
    const lire = fournisseurVoixSimulation.lire.bind(fournisseurVoixSimulation);
    vi.spyOn(fournisseurVoixSimulation, "lire").mockImplementation(async (d) => {
      compte.lectures++;
      return lire(d);
    });
    const dep: DependancesBranchementsCasConcret = {
      rendu: renduImmediat(),
      claudeActif: async () => true,
      verifierBudget: async () => {},
      executer: async (_v, role, entree) => {
        compte.ecritures++;
        const sortie = role.simuler(entree);
        return { ok: true, simule: true, donnees: typeof sortie === "string" ? undefined : sortie };
      },
      verifierEtReserver: async (e) => {
        if (++compte.reservations === panneReservation) throw new Error("Panne du budget (essai).");
        compte.reserveCentimes += e.total.centimes;
      },
    };
    return { compte, dep };
  }

  async function avecReprise(c: CommandeFabrication, dep: DependancesBranchementsCasConcret) {
    const moteur = moteurAvec(dep);
    const premier = await jusquAuBout(moteur, c);
    if (premier.travail.statut === "termine") return { premier, fin: premier };
    expect(premier.travail.erreur?.reessayable).toBe(true);
    return { premier, fin: await jusquAuBout(moteur, c, await moteur.reessayer(premier.travail)) };
  }

  it("une panne posée à chaque étape, puis « Réessayer » : coût total égal au coût sans panne", async () => {
    const temoin = compteur();
    const t = await jusquAuBout(moteurAvec(temoin.dep), commande());
    expect(t.travail.statut).toBe("termine");
    expect(temoin.compte.lectures).toBeGreaterThan(1);
    expect(temoin.compte.ecritures).toBeGreaterThan(0);
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("Aucun appel réseau dans ces tests.");
    });

    for (const etape of ETAPES_CAS_CONCRET) {
      reinitialiserDepots();
      const essai = compteur();
      const { premier, fin } = await avecReprise(commande({ simulerEchecEtape: etape }), essai.dep);
      expect(premier.travail.etapes.find((e) => e.statut === "echec")?.cle, etape).toBe(etape);
      expect(fin.travail.statut, etape).toBe("termine");
      expect(essai.compte, etape).toEqual(temoin.compte);
      vi.restoreAllMocks();
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        throw new Error("Aucun appel réseau dans ces tests.");
      });
    }
  });

  it("une panne au milieu de la voix (après la lecture du corps) : le corps n'est jamais relu", async () => {
    const temoin = compteur();
    await jusquAuBout(moteurAvec(temoin.dep), commande());
    vi.restoreAllMocks();
    reinitialiserDepots();
    // La deuxième réservation (lecture d'une fin) tombe en panne une fois.
    const essai = compteur(2);
    const { premier, fin } = await avecReprise(commande(), essai.dep);
    expect(premier.travail.statut).toBe("echec");
    expect(premier.travail.etapes.find((e) => e.statut === "echec")?.cle).toBe("voix");
    expect(fin.travail.statut).toBe("termine");
    expect({ ...essai.compte, reservations: 0 }).toEqual({ ...temoin.compte, reservations: 0 });
  });
});
