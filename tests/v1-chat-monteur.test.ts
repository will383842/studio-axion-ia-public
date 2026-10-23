/**
 * VÉRIF V1 — « Discuter avec mon monteur » APRÈS que la vidéo a été créée (exigence de Will, 10/10 : « que l'on puisse
 * bien modifier ou rajouter des choses depuis le chat après que la vidéo ait été créée »).
 *
 * Scénarios BOUT EN BOUT sur une vidéo face caméra déjà montée (données réelles IMG_7747 v2) :
 *   service `discuterAvecMonteur` → Claude DOUBLÉ (le vrai client SSE et le vrai chemin de dépense, servis par un faux
 *   `fetch` qui lit la transcription envoyée comme le ferait Claude) → opérations → nouvelle version (retouche partielle)
 *   → état final de la version (entrées, cartes réellement posées par l'habillage, parties refaites).
 * Phrases de Will telles qu'il les tape (fautes comprises). Aucun appel réel : `fetch` global interdit, pas de HeyGen,
 * pas de Higgsfield ; `lancerRetouche` remplacé par une version « en fabrication » (comme la vraie) sans moteur.
 */
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation, reinitialiserRequete } from "./helpers/next-mocks";
import { preparerMotDePasse } from "./helpers/g1a";
import { CLE_ESSAI_CLAUDE, fluxReussi, reponseErreur, reponseFlux } from "./helpers/g0";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);

/** `lancerRetouche` remplacé : une NOUVELLE version en fabrication (entrées données), son travail, sans moteur. */
const retouches: { videoId: string; consigne: string; entrees?: Record<string, unknown>; versionId: string }[] = [];
/** Prochaine retouche refusée (crédit, simulation en production…) : message de l'erreur. */
let refusRetouche: string | null = null;
let classeErreur: (new (code: string, message: string) => Error) | null = null;
vi.mock("@/services/fabrication", async (original) => {
  const vrai = await original<typeof import("@/services/fabrication")>();
  return {
    ...vrai,
    lancerRetouche: async (videoId: string, _plans: string[], consigne: string, options: { entrees?: Record<string, unknown> } = {}) => {
      if (refusRetouche) {
        const message = refusRetouche;
        refusRetouche = null;
        // Classe prise au chargement du test (un redémarrage simulé recharge les modules).
        throw new classeErreur!("CREDIT_INSUFFISANT", message);
      }
      const { depots } = await import("@/donnees/memoire");
      const v = (await depots().videos.obtenir(videoId))!;
      const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
      const n = retouches.length + 1;
      const versionId = `ver-v1-${n}`;
      const travailId = `trav-v1-${n}`;
      retouches.push({ videoId, consigne, entrees: options.entrees, versionId });
      // Comme `creerRetouche` : parent = version choisie, statut « en fabrication », numéro suivant.
      await depots().versions.enregistrer({ ...ver, id: versionId, numero: 100 + n, parentVersionId: ver.id, statut: "en_fabrication", choisie: false, travailId, noteRetouche: consigne, commande: { ...ver.commande, entrees: options.entrees ?? {} } });
      await depots().travaux.enregistrer({ id: travailId, type: "retouche", cibleId: videoId, versionId, titre: "Retouche", etapes: [], statut: "en_cours", progression: 0, tentatives: 0, cleIdempotence: travailId, fournisseurUtilise: "simulation", finEstimee: new Date(Date.now() + 20 * 60_000).toISOString(), creeLe: ver.creeLe, modifieLe: ver.creeLe } as never);
      return { retoucheId: `ret-${n}`, travailId };
    },
  };
});
/**
 * Calcul réel des miniatures (studio-rendu) remplacé : quand il est « relié », l'image refaite est un NOUVEAU fichier
 * (l'ancien reste) ; sinon le vrai service répond (simulation : « … lorsque le calcul des miniatures … est relié »).
 */
let miniaturesReliees = false;
const retitrages: { miniatureId: string; titre: string }[] = [];
vi.mock("@/services/miniatures", async (original) => {
  const vrai = await original<typeof import("@/services/miniatures")>();
  return {
    ...vrai,
    retitrerMiniature: async (m: import("@/domaine/types").Miniature, titre: string) => {
      if (!miniaturesReliees) return vrai.retitrerMiniature(m, titre);
      retitrages.push({ miniatureId: m.id, titre });
      const { depots } = await import("@/donnees/memoire");
      const f = await depots().fichiers.enregistrer({ id: `f-retitree-${retitrages.length}`, cleStockage: `studio/test/videos/${m.videoId}/miniatures/retitree-${retitrages.length}.jpg`, nom: "miniature-retitree.jpg", mime: "image/jpeg", taille: 0, origine: "fabrication", statut: "pret", creeLe: m.creeLe, modifieLe: m.creeLe } as never);
      return f.id;
    },
  };
});
/** Recalque des sous-titres remplacé (la vraie chaîne n'est pas branchée ici) : on garde la demande. */
const recalques: string[] = [];
vi.mock("@/services/recalque", async (original) => {
  const vrai = await original<typeof import("@/services/recalque")>();
  return { ...vrai, appliquerSousTitres: async (videoId: string) => (recalques.push(videoId), { travailId: `trav-st-${recalques.length}`, versionId: `ver-st-${recalques.length}` }) };
});

const { reinitialiserDepots, depots } = await import("@/donnees/memoire");
const auth = await import("@/services/auth");
const credits = await import("@/services/credits");
const gc = await import("@/services/generation-claude");
const { ecrireParametre, ErreurStudio } = await import("@/services/_commun");
classeErreur = ErreurStudio as never;
const { creerLecteurAnthropic } = await import("@/fournisseurs/credits/suivis");
const op = await import("@/services/options-payantes");
const service = await import("@/services/monteur-facecam");
const { discuterAvecMonteur, filMonteur, deposerJsonGz, retirerPassage, vueVotreVideo } = service;
const { corrigerMots, habillageFacecam } = await import("@/moteurs/montage-facecam/habillage");
const { cartesDesPassages, cartePosee } = await import("@/moteurs/montage-facecam/raccords");
const { partiesARefaire, signatureMontage, gardesDepuisCoupes } = await import("@/moteurs/montage-facecam/retouche");
const { coupesActives, dureeMontee, horloge, lireReglagesMonteur, PHRASE_VERSION_SIMPLE_PANNE } = await import("@/moteurs/montage-facecam/monteur");
const { lireEntreesFacecam } = await import("@/domaine/facecam");
const { motsDuMontage } = await import("@/briques/coupes");
import type { MotHorodate } from "@/domaine/types";
import type { PassageMonteur } from "@/moteurs/montage-facecam/monteur";

const MDP = "essai-v1-chat-monteur";
const VIDEO = "v-04";
const CLE_TRANSCRIPTION = "facecam/v-04/transcription.json.gz";

/* ------------------------------------------------------------------ */
/* Vidéo déjà montée : IMG_7747 v2 (prod, 10/10)                       */
/* ------------------------------------------------------------------ */

const reel = JSON.parse(readFileSync("tests/fixtures/img7747-v2-montage-reel.json", "utf-8")) as { mots: MotHorodate[]; coupes: { id: string; type: string; debutSec: number; finSec: number; libelle?: string }[] };
const DUREE_PRISE = 130.732;

/** Fin de la prise telle que Whisper l'a entendue : la reprise de fin (« Quel que soit votre taille… ») dite deux fois. */
function finWhisper(): MotHorodate[] {
  return readFileSync("tests/fixtures/img7747-transcription-whisper.txt", "utf-8")
    .split("\n")
    .flatMap((l) => {
      const m = /^\[\s*([\d.]+)-\s*([\d.]+)\]\s*(.+)$/.exec(l.trim());
      if (!m || Number(m[1]) < 101.7) return [];
      const [d, f] = [Number(m[1]), Number(m[2])];
      const mots = m[3].split(/\s+/).filter(Boolean);
      const pas = (f - d) / mots.length;
      return mots.map((mot, k) => ({ mot, debutSec: +(d + k * pas).toFixed(3), finSec: +(d + (k + 1) * pas - 0.04).toFixed(3) }));
    });
}

/** Transcription de la prise : l'alignement réel jusqu'à « … la bonne fuite. », puis la fin bégayée (Whisper). */
const MOTS: MotHorodate[] = [...reel.mots.filter((m) => m.finSec <= 101.7), ...finWhisper()];
/** Coupes du studio (prod) : début à jeter, blancs, fin à jeter. La reprise de fin n'a PAS été retirée (cas de prod). */
const COUPES = reel.coupes.filter((c) => c.finSec <= 101.7 || c.debutSec >= 118.3);

function motsMontes(entrees: Record<string, unknown>): { mots: MotHorodate[]; dureeSec: number } {
  const fc = lireEntreesFacecam(entrees);
  const coupes = coupesActives(fc, lireReglagesMonteur(entrees).coupesDemandees);
  return { mots: motsDuMontage(MOTS, gardesDepuisCoupes(coupes, DUREE_PRISE)), dureeSec: dureeMontee(DUREE_PRISE, coupes) };
}

/** Ce que l'habillage pose réellement pour ces entrées (cartes du monteur + cartes automatiques gardées). */
function habillage(entrees: Record<string, unknown>) {
  const { dureeSec } = motsMontes(entrees);
  // Comme la chaîne : les mots corrigés depuis le fil sont réappliqués à chaque habillage.
  const mots = corrigerMots(motsMontes(entrees).mots, lireReglagesMonteur(entrees).correctionsSousTitres).mots;
  const fc = lireEntreesFacecam(entrees);
  const cartes = cartesDesPassages(fc.passages as PassageMonteur[]).flatMap((c) => cartePosee(c) ?? []);
  return habillageFacecam({ pisteMonteeCle: "facecam/v-04/montage.mov", dureeSec, mots, ...(cartes.length ? { cartes } : {}), cartesAutoRetirees: lireReglagesMonteur(entrees).cartesAutoRetirees, prefixeCartes: "facecam/v-04/cartes" });
}

/** Entrées de la version 1, telles que la chaîne les a rangées à la fin de la fabrication. */
function entreesVersion1(): Record<string, unknown> {
  const base = { facecam: { transcriptionCle: CLE_TRANSCRIPTION, coupes: { auto: COUPES, retablies: [] }, passages: [], consignes: [], image: { lumiere: "juste", couleurs: "juste", mine: "juste", dents: "juste" } } };
  return { facecam: { ...base.facecam, cartesAuto: habillage(base).cartesAuto } };
}

/* ------------------------------------------------------------------ */
/* Double de Claude : lit la variable envoyée, rend la réponse          */
/* ------------------------------------------------------------------ */

interface Vu {
  variable: string;
  /** [index, seconde montée (null : mot retiré), mot] */
  mots: { index: number; sec: number | null; mot: string }[];
  elements: { id: string; type: string; texte: string; debutSec: number }[];
  coupes: { id: string; etat: string }[];
}
type Cerveau = (vu: Vu) => unknown;

const env = (type: string, p: Record<string, unknown>) => ({ type, parametres: JSON.stringify(p) });
const carte = (debutMot: number, finMot: number, modele: string | null, textes: string[], description: string, disposition = "ecran-partage") => env("ajouterCarte", { debutMot, finMot, modele, textes, html: null, disposition, description, animationGardeeId: null });
const fil = (resume: string, operations: number[], comprise = true) => ({ consigneId: "fil", comprise, resume, operations });

const secondes = (h: string) => (h === "--:--" ? null : Number(h.split(":")[0]) * 60 + Number(h.split(":")[1]));
function lire(variable: string): Vu {
  const bloc = (nom: string) => variable.match(new RegExp(`<${nom}>\\n([\\s\\S]*?)\\n?</${nom}>`))?.[1]?.split("\n").filter(Boolean) ?? [];
  return {
    variable,
    mots: bloc("transcription").map((l) => {
      const m = /^\[(\d+)\] (\S+) (.*)$/.exec(l)!;
      return { index: Number(m[1]), sec: secondes(m[2]), mot: m[3] };
    }),
    elements: bloc("elements").map((l) => {
      const [id, type, temps, ...reste] = l.split(" · ");
      return { id, type: type.split(" ")[0], texte: reste.join(" · "), debutSec: secondes(temps.split("-")[0]) ?? 0 };
    }),
    coupes: bloc("coupes").map((l) => {
      const [id, , etat] = l.split(" · ");
      return { id, etat };
    }),
  };
}
/** Premier mot dit à partir de cette seconde de la vidéo montée. */
const motA = (vu: Vu, sec: number) => vu.mots.find((m) => m.sec !== null && m.sec >= sec)!.index;
/** Index des mots (non retirés) égaux à ce mot (sans ponctuation, sans casse). */
const occurrences = (vu: Vu, mot: string) => vu.mots.filter((m) => m.sec !== null && m.mot.toLowerCase().replace(/[.,;:!?]/g, "") === mot.toLowerCase()).map((m) => m.index);

let cerveaux: Cerveau[] = [];
let vus: Vu[] = [];
let panneClaude = 0;

function brancherClaude() {
  void credits.declarerRecharge("anthropic", 500);
  const f = (async (_u: string | URL | Request, init?: RequestInit) => {
    const corps = JSON.parse(String(init?.body ?? "{}")) as { messages: { content: string }[] };
    const vu = lire(corps.messages.at(-1)!.content);
    vus.push(vu);
    if (panneClaude > 0) {
      panneClaude--;
      return reponseErreur(400, "invalid_request_error", "The compiled grammar is too large, which would cause performance issues.");
    }
    const cerveau = cerveaux.shift();
    if (!cerveau) throw new Error("le double de Claude n'a pas de réponse prévue");
    return reponseFlux(fluxReussi({ texte: JSON.stringify(cerveau(vu)), modele: "claude-opus-5-5" }));
  }) as typeof fetch;
  gc.injecterClaudePourEssai({ cle: CLE_ESSAI_CLAUDE, fetch: f, attenteMs: () => 0 });
}

/* ------------------------------------------------------------------ */
/* Mise en place                                                        */
/* ------------------------------------------------------------------ */

const appelsReseau: string[] = [];

beforeAll(async () => {
  await preparerMotDePasse(MDP);
});

beforeEach(async () => {
  reinitialiserDepots();
  reinitialiserRequete();
  retouches.length = 0;
  refusRetouche = null;
  recalques.length = 0;
  appelsReseau.length = 0;
  cerveaux = [];
  vus = [];
  panneClaude = 0;
  vi.stubGlobal("fetch", (async (u: string | URL | Request) => {
    appelsReseau.push(String(u));
    throw new Error("réseau interdit");
  }) as typeof fetch);
  await auth.seConnecter(MDP, false);
  credits.injecterLecteursPourEssai([creerLecteurAnthropic({ ANTHROPIC_API_KEY: CLE_ESSAI_CLAUDE }, (async () => { throw new Error("réseau interdit"); }) as typeof fetch)], ["anthropic"]);
  await ecrireParametre("fournisseur.texte-reseaux", "claude");
  await ecrireParametre("budget.mensuel", { centimes: 15_000, devise: "EUR" });
  brancherClaude();
  const v = (await depots().videos.obtenir(VIDEO))!;
  const ver = (await depots().versions.obtenir(v.versionChoisieId!))!;
  await deposerJsonGz(CLE_TRANSCRIPTION, { mots: MOTS });
  await depots().videos.modifier(VIDEO, { estDemo: false, formatId: "facecam", titre: "Votre temps fuit" });
  await depots().versions.modifier(ver.id, { commande: { ...ver.commande, formatId: "facecam", entrees: entreesVersion1() }, estDemo: false, statut: "prete" });
  // Sous-titres de la version 1 (ceux de l'habillage), au-dessus de ceux de la démo (la plus haute version fait foi).
  const segments = habillage(entreesVersion1()).segments;
  await depots().sousTitres.enregistrer({ id: "st-v1", videoId: VIDEO, versionId: ver.id, langue: "fr", version: 9, segments, creeLe: ver.creeLe, modifieLe: ver.creeLe } as never);
});
afterEach(() => {
  vi.unstubAllGlobals();
  credits.injecterLecteursPourEssai(null);
  gc.injecterClaudePourEssai(null);
});

async function versionChoisie() {
  const v = (await depots().videos.obtenir(VIDEO))!;
  return (await depots().versions.obtenir(v.versionChoisieId!))!;
}
/** Fin de fabrication d'une version (comme `appliquerResultat`) : prête et choisie. */
async function terminer(versionId: string) {
  for (const v of await depots().versions.lister((x) => x.videoId === VIDEO)) await depots().versions.modifier(v.id, { choisie: v.id === versionId, ...(v.id === versionId ? { statut: "prete" } : {}) });
  await depots().videos.modifier(VIDEO, { versionChoisieId: versionId, statut: "prete" });
}
const derniere = () => retouches.at(-1)!;
const passages = (entrees: Record<string, unknown>) => lireEntreesFacecam(entrees).passages as PassageMonteur[];
const refait = (avant: Record<string, unknown>, apres: Record<string, unknown>) => [...partiesARefaire(signatureMontage(avant), signatureMontage(apres))].sort();
async function dire(texte: string, cerveau?: Cerveau) {
  if (cerveau) cerveaux.push(cerveau);
  return (await discuterAvecMonteur(VIDEO, texte)).monteur;
}
const pasDeSouci = (texte: string) => expect(texte).not.toMatch(/souci/i);

/* ------------------------------------------------------------------ */
/* Scénarios                                                            */
/* ------------------------------------------------------------------ */

describe("V1 · ajouter et modifier des cartes après la création", () => {
  it("le monteur voit la vidéo telle qu'elle est : transcription montée ET cartes automatiques posées", async () => {
    await dire("rien", () => ({ reponse: "Rien à changer.", operations: [], consignes: [fil("Rien", [], false)] }));
    const vu = vus[0];
    expect(vu.mots.length).toBe(MOTS.length);
    const auto = (entreesVersion1().facecam as { cartesAuto: unknown[] }).cartesAuto;
    expect(auto.length).toBeGreaterThanOrEqual(5);
    // Chaque carte automatique est un élément que Will peut nommer (retirer, déplacer, changer le texte).
    expect(vu.elements.filter((e) => e.type === "carte-auto")).toHaveLength(auto.length);
  });

  it("« a 0:32 montre les 3 etapes » → carte des étapes à 0:32, seule l'habillage est refait, les autres cartes restent", async () => {
    const m = await dire("a 0:32 montre les 3 etapes", (vu) => ({
      reponse: "J'ai ajouté les 3 étapes à 0:32.",
      operations: [carte(motA(vu, 32), motA(vu, 32) + 14, "ligne-de-temps", ["Trouver la fuite", "Choisir la priorité", "Automatiser"], "Les 3 étapes")],
      consignes: [fil("Carte des 3 étapes à 0:32", [0])],
    }));
    expect(m.texte).toMatch(/0:32/);
    expect(m.versionId).toBe("ver-v1-1");
    const e = derniere().entrees!;
    const p = passages(e).find((x) => x.modele === "ligne-de-temps")!;
    expect(p.debutSec).toBeGreaterThanOrEqual(31.5);
    expect(p.debutSec).toBeLessThan(33.5);
    expect(refait(entreesVersion1(), e)).toEqual(["habillage"]);
    // Les cartes automatiques qui ne gênent pas la nouvelle sont toujours là (avant : toutes disparaissaient).
    const h = habillage(e);
    const autoAvant = habillage(entreesVersion1()).cartesAuto.length;
    expect(h.cartesAuto.length).toBeGreaterThanOrEqual(autoAvant - 1);
    expect(h.cartes.length).toBe(h.cartesAuto.length + 1);
    expect(h.cartesAuto.every((c) => c.finSec <= p.debutSec || c.debutSec >= p.finSec)).toBe(true);
  });

  it("« rajoute plein d'animations au debut » → plusieurs cartes dans les 20 premières secondes", async () => {
    await dire("rajoute plein d'animations au debut stp", (vu) => ({
      reponse: "Trois animations au début.",
      operations: [
        carte(motA(vu, 0), motA(vu, 3), "titre", ["Votre temps fuit"], "Accroche", "plein-ecran"),
        env("zoom", { debutMot: motA(vu, 4), finMot: motA(vu, 6), style: "punch-in", cible: "visage" }),
        carte(motA(vu, 13), motA(vu, 17), "icone-mot", ["Du temps qui s'échappe"], "Le temps qui fuit"),
      ],
      consignes: [fil("3 animations au début", [0, 1, 2])],
    }));
    const e = derniere().entrees!;
    const debut = passages(e).filter((p) => p.debutSec < 20);
    expect(debut).toHaveLength(3);
    // V6 « interdit de mentir » (#24) : le zoom demandé est réellement rendu (plan serré) → les plans sont refaits aussi.
    expect(refait(entreesVersion1(), e)).toEqual(["habillage", "plans"]);
  });

  it("déplacer une carte : « deplace la carte des etapes a 0:45 » → une seule carte, à 0:45", async () => {
    await dire("a 0:32 montre les 3 etapes", (vu) => ({ reponse: "Fait.", operations: [carte(motA(vu, 32), motA(vu, 32) + 14, "ligne-de-temps", ["A", "B", "C"], "Les 3 étapes")], consignes: [fil("Étapes à 0:32", [0])] }));
    await terminer(derniere().versionId);
    await dire("deplace la carte des etapes a 0:45", (vu) => {
      const etapes = vu.elements.find((x) => x.texte.includes("A · B · C"))!;
      return { reponse: "Déplacée à 0:45.", operations: [env("retirer", { passageId: etapes.id }), carte(motA(vu, 45), motA(vu, 45) + 14, "ligne-de-temps", ["A", "B", "C"], "Les 3 étapes")], consignes: [fil("Carte des étapes déplacée à 0:45", [0, 1])] };
    });
    const etapes = passages(derniere().entrees!).filter((p) => p.modele === "ligne-de-temps");
    expect(etapes).toHaveLength(1);
    expect(Math.round(etapes[0].debutSec)).toBeGreaterThanOrEqual(44);
    expect(Math.round(etapes[0].debutSec)).toBeLessThanOrEqual(46);
  });

  it("« deplace la carte … a 0:45 » n'est JAMAIS pris pour l'effet réaliste en attente de confirmation", async () => {
    await dire("Mets un téléphone dans ma main et jette-le sur l'écran", (vu) => ({
      reponse: "Je le propose quand vous parlez du temps.",
      operations: [env("effetRealisteIA", { consigne: "téléphone jeté sur l'écran", ancre: "bon-endroit", debutMot: motA(vu, 20), instantSec: null, dureeSec: 5, consigneVideo: "A black smartphone appears in the open hand and is thrown toward the lens.", objet: "telephone", imageReference: null, finitSurEcran: true, sonSuggere: "verre", raisonMoment: "Il parle du temps qui s'échappe." })],
      consignes: [fil("Effet préparé", [0])],
    }));
    expect(await op.demandeOuverte("effet-realiste-ia", VIDEO)).toBeTruthy();
    const m = await dire("deplace la carte des 3 etapes plutot a 0:45", (vu) => ({ reponse: "Carte posée à 0:45.", operations: [carte(motA(vu, 45), motA(vu, 45) + 14, "ligne-de-temps", ["A", "B", "C"], "Les 3 étapes")], consignes: [fil("Carte à 0:45", [0])] }));
    expect(m.confirmation).toBeUndefined();
    expect(passages(derniere().entrees!).some((p) => p.modele === "ligne-de-temps")).toBe(true);
  });

  it("retirer une carte AUTO : « enleve la carte sur les relances a la main »", async () => {
    const auto = habillage(entreesVersion1()).cartesAuto;
    const cible = auto.find((c) => /relances/i.test(c.texte))!;
    expect(cible).toBeTruthy();
    const m = await dire("enleve la carte sur les relances a la main", (vu) => {
      const el = vu.elements.find((x) => x.type === "carte-auto" && /relances/i.test(x.texte))!;
      return { reponse: "Carte retirée.", operations: [env("retirer", { passageId: el.id })], consignes: [fil("Carte des relances retirée", [0])] };
    });
    expect(m.versionId).toBeTruthy();
    const e = derniere().entrees!;
    expect(lireReglagesMonteur(e).cartesAutoRetirees).toEqual([cible.id]);
    const h = habillage(e);
    expect(h.cartesAuto.map((c) => c.id)).not.toContain(cible.id);
    expect(h.cartesAuto).toHaveLength(auto.length - 1);
    expect(refait(entreesVersion1(), e)).toEqual(["habillage"]);
  });

  it("retirer une carte AUTO depuis la feuille « Cartes » (sans Claude), et elle y est listée", async () => {
    const vue = await vueVotreVideo(VIDEO);
    const auto = vue!.passages.filter((p) => p.type === "carte-auto");
    expect(auto.length).toBeGreaterThanOrEqual(5);
    await retirerPassage(VIDEO, auto[0].id);
    expect(lireReglagesMonteur(derniere().entrees!).cartesAutoRetirees).toEqual([auto[0].id]);
    expect(vus).toHaveLength(0);
  });

  it("changer le texte d'une carte : « sur la carte du diagnostic ecris plutot 45 min offertes »", async () => {
    const auto = habillage(entreesVersion1()).cartesAuto;
    const diag = auto.find((c) => /45/.test(c.texte))!;
    await dire("sur la carte du diagnostic ecris plutot 45 min offertes", (vu) => {
      const el = vu.elements.find((x) => x.type === "carte-auto" && /45/.test(x.texte))!;
      return { reponse: "Texte changé.", operations: [env("retirer", { passageId: el.id }), carte(motA(vu, el.debutSec), motA(vu, el.debutSec) + 10, "chiffre", ["45 min", "offertes"], "45 min offertes")], consignes: [fil("Carte du diagnostic : « 45 min offertes »", [0, 1])] };
    });
    const e = derniere().entrees!;
    expect(lireReglagesMonteur(e).cartesAutoRetirees).toContain(diag.id);
    const nouvelle = passages(e).find((p) => p.modele === "chiffre")!;
    expect(nouvelle.texte).toBe("45 min · offertes");
    expect(Math.abs(nouvelle.debutSec - diag.debutSec)).toBeLessThan(1.5);
  });
});

/* ------------------------------------------------------------------ */
/* Test réel en prod du 10/10 (master fde7a39) : remettre une carte,   */
/* plus aucune carte automatique effacée en silence                    */
/* ------------------------------------------------------------------ */

describe("Monteur · « remets la carte » et cartes automatiques jamais effacées en silence (prod 10/10)", () => {
  const AXION = "auto-a1b87007";
  const QUESTIONS = "auto-a819c2f7";
  /** Fin de fabrication comme la chaîne : version prête et choisie, cartes automatiques posées rangées dans la version. */
  async function fabriquee() {
    const r = derniere();
    const e = { ...r.entrees!, facecam: { ...(r.entrees!.facecam as Record<string, unknown>), cartesAuto: habillage(r.entrees!).cartesAuto } };
    const ver = (await depots().versions.obtenir(r.versionId))!;
    await depots().versions.modifier(r.versionId, { commande: { ...ver.commande, entrees: e } });
    await terminer(r.versionId);
    return e;
  }
  const autoV1 = () => habillage(entreesVersion1()).cartesAuto;
  /** Chaque carte automatique de la version 1 encore posée, ou nommée « s'efface » dans la réponse du monteur. */
  function aucuneEffaceeEnSilence(e: Record<string, unknown>, texte: string, retirees: string[] = []) {
    const posees = new Set(habillage(e).cartesAuto.map((c) => c.id));
    for (const c of autoV1().filter((x) => !retirees.includes(x.id) && !posees.has(x.id))) expect(texte, `carte « ${c.texte} » effacée sans le dire`).toMatch(new RegExp(`« ${c.texte.split(" · ")[0].replace(/[?()]/g, ".")} »[^.]*s'efface`));
  }
  /** Les opérations RÉELLEMENT renvoyées par Claude en prod au 2e message (le remplacement est pris faute de mieux). */
  const remetsTitreZoom = (vu: Vu) => {
    const retiree = vu.elements.find((x) => x.type === "carte-auto-retiree" && /Chez Axion-IA/.test(x.texte));
    const fuite = occurrences(vu, "fuite").at(-1)!;
    return {
      reponse: "J'ai remis la carte « Chez Axion-IA », ajouté le titre « Une formation pour vos équipes » à 0:59 et posé un zoom sur « la bonne fuite » à 1:15.",
      operations: [
        retiree ? env("remettre", { passageId: retiree.id }) : carte(motA(vu, 16), motA(vu, 16) + 12, "liste", ["Ce qu'on fait", "Former les équipes à l'IA", "Accompagner en one-to-one", "Auditer", "Automatiser"], "Chez Axion-IA : ce qu'on fait"),
        carte(motA(vu, 59), motA(vu, 59) + 6, "titre", ["Une formation pour vos équipes"], "Titre sur la formation"),
        env("zoom", { debutMot: fuite - 2, finMot: fuite, style: "punch-in", cible: "visage" }),
      ],
      consignes: [fil("Carte « Chez Axion-IA » remise, titre sur la formation, zoom sur « la bonne fuite »", [0, 1, 2])],
    };
  };

  it("échange 1 : « Retire la carte « Chez Axion-IA », garde toutes les autres » → elle seule part", async () => {
    await dire("Retire la carte « Chez Axion-IA », garde toutes les autres", (vu) => ({ reponse: "J'ai retiré la carte « Chez Axion-IA ».", operations: [env("retirer", { passageId: vu.elements.find((x) => x.type === "carte-auto" && /Chez Axion-IA/.test(x.texte))!.id })], consignes: [fil("Carte « Chez Axion-IA » retirée", [0])] }));
    const e = derniere().entrees!;
    expect(lireReglagesMonteur(e).cartesAutoRetirees).toEqual([AXION]);
    expect(habillage(e).cartesAuto.map((c) => c.id)).toEqual(autoV1().map((c) => c.id).filter((id) => id !== AXION));
  });

  it("échange 2 : « Remets la carte « Chez Axion-IA »… » → la MÊME carte revient (aucune carte de remplacement), « 3 questions » reste, la réponse dit le vrai instant", async () => {
    await dire("Retire la carte « Chez Axion-IA », garde toutes les autres", (vu) => ({ reponse: "Retirée.", operations: [env("retirer", { passageId: vu.elements.find((x) => x.type === "carte-auto" && /Chez Axion-IA/.test(x.texte))!.id })], consignes: [fil("Retirée", [0])] }));
    const v2 = await fabriquee();
    const m = await dire("Remets la carte « Chez Axion-IA ». Ajoute une carte titre « Une formation pour vos équipes » quand je parle de la formation. Et fais un zoom sur « la bonne fuite » vers la fin.", remetsTitreZoom);
    // Le monteur VOIT la carte retirée (avant : invisible, il en recréait une autre).
    expect(vus.at(-1)!.elements.some((x) => x.type === "carte-auto-retiree" && x.id === AXION)).toBe(true);
    const e = derniere().entrees!;
    // Défaut A : même identifiant, mêmes textes, même instant ; aucune carte du monteur de remplacement.
    expect(lireReglagesMonteur(e).cartesAutoRetirees).toEqual([]);
    expect(passages(e).some((p) => /Ce qu'on fait|Former les équipes/.test(p.texte ?? ""))).toBe(false);
    const axion = habillage(e).cartesAuto.find((c) => c.id === AXION)!;
    expect(axion).toMatchObject(autoV1().find((c) => c.id === AXION)!);
    // Défaut B : la liste « 3 questions » reste ; le titre passe juste après elle (instant approximatif).
    const h = habillage(e);
    expect(h.cartesAuto.map((c) => c.id)).toContain(QUESTIONS);
    const questions = h.cartesAuto.find((c) => c.id === QUESTIONS)!;
    const titre = passages(e).find((p) => p.texte === "Une formation pour vos équipes")!;
    expect(titre.debutSec).toBeGreaterThanOrEqual(questions.finSec + 1 - 1e-6);
    expect(titre.debutSec - questions.finSec).toBeLessThan(1.5);
    // Réponse calculée après la planification réelle : le vrai instant, et toute carte effacée est nommée.
    expect(m.texte).toContain(horloge(titre.debutSec));
    expect(m.texte).not.toMatch(/0:59/);
    aucuneEffaceeEnSilence(e, m.texte);
    // Le zoom est bien rendu (plans refaits) : gardé.
    expect(passages(e).filter((p) => p.type === "zoom")).toHaveLength(1);
    expect(refait(v2, e)).toEqual(["habillage", "plans"]);
  });

  it("instant précis (« à 0:30 ») : la carte reste où Will l'a dit, la carte effacée est NOMMÉE ; « remets-la » la fait revenir sans perdre la nouvelle", async () => {
    const m = await dire("à 0:30 ajoute une carte titre « Le diagnostic »", (vu) => ({ reponse: "Titre « Le diagnostic » ajouté à 0:30.", operations: [carte(motA(vu, 30), motA(vu, 30) + 6, "titre", ["Le diagnostic"], "Titre")], consignes: [fil("Titre à 0:30", [0])] }));
    const e = derniere().entrees!;
    const titre = passages(e).find((p) => p.texte === "Le diagnostic")!;
    expect(Math.round(titre.debutSec)).toBe(30);
    expect(habillage(e).cartesAuto.map((c) => c.id)).not.toContain("auto-038295b7");
    expect(m.texte).toMatch(/« Un outil de plus, une embauche de plus » s'efface/);
    expect(m.texte).toMatch(/remets-la/);
    aucuneEffaceeEnSilence(e, m.texte);
    await fabriquee();
    const m2 = await dire("remets-la", (vu) => {
      const el = vu.elements.find((x) => x.type === "carte-auto-effacee" && /Un outil de plus/.test(x.texte))!;
      return { reponse: "J'ai remis la carte.", operations: [env("remettre", { passageId: el.id })], consignes: [fil("Carte remise", [0])] };
    });
    const e2 = derniere().entrees!;
    const h = habillage(e2);
    expect(h.cartesAuto.map((c) => c.id)).toEqual(autoV1().map((c) => c.id));
    const titre2 = passages(e2).find((p) => p.texte === "Le diagnostic")!;
    expect(titre2).toBeTruthy();
    expect(h.cartes).toHaveLength(h.cartesAuto.length + 1);
    expect(m2.texte).toContain(horloge(titre2.debutSec));
  });

  it("« remets » une carte qui n'a jamais été retirée ni effacée : rien ne change, aucune carte ajoutée", async () => {
    const m = await dire("remets la carte des 3 questions", (vu) => ({ reponse: "Elle est déjà là.", operations: [env("remettre", { passageId: vu.elements.find((x) => /3 questions/.test(x.texte))!.id })], consignes: [fil("Carte déjà là", [0])] }));
    expect(m.texte).not.toMatch(/s'efface/);
    expect(passages(retouches.at(-1)?.entrees ?? entreesVersion1())).toHaveLength(0);
  });

  it("la consigne de Claude propose « remettre » et la préfère à une nouvelle carte", async () => {
    const { roleMonteurFacecam } = await import("@/moteurs/montage-facecam/monteur");
    expect(roleMonteurFacecam.consigne).toMatch(/- remettre : \{/);
    expect(roleMonteurFacecam.consigne).toMatch(/carte-auto-retiree/);
    expect(roleMonteurFacecam.consigne).toMatch(/jamais une nouvelle carte/i);
  });
});

/* ------------------------------------------------------------------ */
/* Test réel en prod du 11/10 (v-25831e5b6596, après #31) : carte de   */
/* fin protégée, réponses sans contradiction, marqueurs `*mot*` cachés */
/* ------------------------------------------------------------------ */

describe("Monteur · carte de fin protégée, réponses sans contradiction (prod 11/10)", () => {
  const FIN = "auto-81584b87";
  const DEBUT = "auto-be44c1c0";
  /** Montage de la vidéo de prod (1:25) : la reprise bégayée et la fin coupées, la carte de fin à 1:20, juste avant la fin. */
  const COUPES_PROD = [...reel.coupes.filter((c) => c.finSec <= 101.7), { id: "reprise-10176", type: "reprise", debutSec: 101.76, finSec: 111.2 }, { id: "fin-11950", type: "fin", debutSec: 119.5, finSec: DUREE_PRISE }];
  function entreesProd(): Record<string, unknown> {
    const base = { facecam: { transcriptionCle: CLE_TRANSCRIPTION, coupes: { auto: COUPES_PROD, retablies: [] }, passages: [], consignes: [], image: { lumiere: "juste", couleurs: "juste", mine: "juste", dents: "juste" } } };
    return { facecam: { ...base.facecam, cartesAuto: habillage(base).cartesAuto } };
  }
  async function fabriquee(entrees?: Record<string, unknown>) {
    const r = derniere();
    const brut = entrees ?? r.entrees!;
    const e = { ...brut, facecam: { ...(brut.facecam as Record<string, unknown>), cartesAuto: habillage(brut).cartesAuto } };
    const ver = (await depots().versions.obtenir(r.versionId))!;
    await depots().versions.modifier(r.versionId, { commande: { ...ver.commande, entrees: e } });
    await terminer(r.versionId);
    return e;
  }
  const autoProd = () => habillage(entreesProd()).cartesAuto;
  beforeEach(async () => {
    const ver = await versionChoisie();
    await depots().versions.modifier(ver.id, { commande: { ...ver.commande, entrees: entreesProd() } });
  });
  /** Le double de Claude de l'échange A : la petite carte titre sur « Quel que soit votre taille » (réponse de prod). */
  const partoutEnFrance = (vu: Vu) => {
    const quel = occurrences(vu, "quel").at(-1)!;
    return {
      reponse: "J'ajoute une petite carte titre « Partout en France » vers 1:16, sur « Quel que soit votre taille », juste avant la carte de fin « Réservez votre appel diagnostic gratuit », que je ne touche pas.",
      operations: [carte(quel, quel + 4, "titre", ["Partout en France"], "Petite carte titre avant la carte de fin", "plein-ecran")],
      consignes: [fil("Carte titre « Partout en France » juste avant la carte de fin", [0])],
    };
  };

  it("la vidéo de test ressemble à celle de prod : carte de fin (appel à l'action) à 1:20, dernière carte, vidéo de 1:25", () => {
    const fin = autoProd().at(-1)!;
    expect(fin.id).toBe(FIN);
    expect(horloge(fin.debutSec)).toBe("1:20");
    expect(horloge(motsMontes(entreesProd()).dureeSec)).toBe("1:25");
  });

  it("A : « … juste avant la carte de fin » → la carte de fin RESTE, la nouvelle carte est avancée/raccourcie avant elle, la réponse ne se contredit pas", async () => {
    const m = await dire("Ajoute une petite carte titre « Partout en France » juste avant la carte de fin.", partoutEnFrance);
    const e = derniere().entrees!;
    const h = habillage(e);
    const fin = h.cartesAuto.find((c) => c.id === FIN);
    expect(fin, "la carte de fin a été effacée").toBeTruthy();
    expect(h.cartesAuto.map((c) => c.id)).toEqual(autoProd().map((c) => c.id));
    const partout = passages(e).find((p) => p.texte === "Partout en France")!;
    expect(partout.finSec).toBeLessThanOrEqual(fin!.debutSec - 1 + 1e-6);
    expect(partout.finSec - partout.debutSec).toBeGreaterThanOrEqual(2 - 1e-6);
    expect(fin!.debutSec - partout.finSec).toBeLessThan(2);
    expect(m.texte).not.toMatch(/s'efface|ne peut pas/);
    expect(m.texte).toContain(horloge(partout.debutSec));
    expect(m.texte.match(/Partout en France/g)).toHaveLength(1);
  });

  it("A, instant précis dans la carte de fin (« à 1:21 ») : rien ne tient → la carte de fin reste, le monteur demande à Will de choisir", async () => {
    const m = await dire("à 1:21 ajoute une petite carte titre « Partout en France »", (vu) => ({ reponse: "J'ajoute la carte « Partout en France » à 1:21.", operations: [carte(motA(vu, 81), motA(vu, 81) + 3, "titre", ["Partout en France"], "Titre", "plein-ecran")], consignes: [fil("Titre à 1:21", [0])] }));
    const e = retouches.at(-1)?.entrees ?? entreesProd();
    expect(habillage(e).cartesAuto.map((c) => c.id)).toContain(FIN);
    expect(passages(e).some((p) => p.texte === "Partout en France")).toBe(false);
    expect(m.texte).not.toMatch(/s'efface|J'ajoute/);
    expect(m.texte).toMatch(/carte de fin/);
    expect(m.texte).toMatch(/dites/i);
    // Rien n'a changé : aucune nouvelle version annoncée.
    expect(retouches).toHaveLength(0);
    expect(m.texte).not.toMatch(/Nouvelle version/);
    expect(JSON.stringify(m.resumes)).not.toMatch(/Titre à 1:21/);
  });

  it("B : « Remets la carte de fin » alors qu'une carte du monteur l'efface (état de prod) → elle revient, la carte du monteur lui laisse la place", async () => {
    await dire("Ajoute une petite carte titre « Partout en France » juste avant la carte de fin.", partoutEnFrance);
    // État de prod après A (code d'avant) : « Partout en France » sur « Quel que soit votre taille », 3 s, la carte de fin effacée.
    const brut = derniere().entrees!;
    const quel = motsMontes(brut).mots.filter((x) => /^quel$/i.test(x.mot)).at(-1)!;
    const quelPrise = MOTS.filter((x) => /^quel$/i.test(x.mot) && x.debutSec >= 111).at(0)!;
    const fc = brut.facecam as { passages: PassageMonteur[] };
    const prod = { ...brut, facecam: { ...fc, passages: fc.passages.map((p) => (p.texte === "Partout en France" ? { ...p, debutSec: quel.debutSec, finSec: quel.debutSec + 3, ancre: { debutPriseSec: quelPrise.debutSec, finPriseSec: quelPrise.debutSec + 3 } } : p)) } };
    await fabriquee(prod);
    expect(habillage(prod).cartesAuto.map((c) => c.id)).not.toContain(FIN);
    const m = await dire("Remets la carte de fin « Réservez votre appel diagnostic gratuit ».", (vu) => {
      const el = vu.elements.find((x) => x.type === "carte-auto-effacee" && /Réservez/.test(x.texte))!;
      return { reponse: "Je remets la carte de fin « Réservez votre appel diagnostic gratuit » à sa place d'origine, avec les mêmes textes, vers 1:19.", operations: [env("remettre", { passageId: el.id })], consignes: [fil("Carte de fin remise", [0])] };
    });
    const e = derniere().entrees!;
    const h = habillage(e);
    const fin = h.cartesAuto.find((c) => c.id === FIN);
    expect(fin, "la carte de fin n'est pas revenue").toBeTruthy();
    const partout = passages(e).find((p) => p.texte === "Partout en France")!;
    expect(partout).toBeTruthy();
    expect(partout.finSec).toBeLessThanOrEqual(fin!.debutSec - 1 + 1e-6);
    expect(partout.finSec - partout.debutSec).toBeGreaterThanOrEqual(2 - 1e-6);
    expect(m.texte).not.toMatch(/ne peut pas revenir|s'efface/);
    expect(m.texte).toContain(`« Partout en France »`);
    expect(m.texte).toContain(horloge(partout.debutSec));
  });

  it("D : « rajoute un titre au tout debut » → le titre est raccourci (2 s au moins) et la carte auto de 0:04 reste", async () => {
    const m = await dire("rajoute un titre au tout debut", (vu) => {
      const premier = vu.mots.find((x) => x.sec !== null)!.index;
      // Comme en prod : le titre court jusqu'à « problème » (0:03), à moins d'1 s de la carte automatique de 0:04.
      return { reponse: "J'ajoute un titre « Le diagnostic fuite » tout au début, de 0:00 à 0:02.", operations: [carte(premier, occurrences(vu, "problème")[0], "titre", ["Le diagnostic fuite"], "Titre d'ouverture", "plein-ecran")], consignes: [fil("Titre au tout début", [0])] };
    });
    const e = derniere().entrees!;
    const h = habillage(e);
    expect(h.cartesAuto.map((c) => c.id)).toContain(DEBUT);
    const titre = passages(e).find((p) => p.texte === "Le diagnostic fuite")!;
    const auto = h.cartesAuto.find((c) => c.id === DEBUT)!;
    expect(titre.debutSec).toBeLessThan(0.5);
    expect(titre.finSec).toBeLessThanOrEqual(auto.debutSec - 1 + 1e-6);
    expect(titre.finSec - titre.debutSec).toBeGreaterThanOrEqual(2 - 1e-6);
    expect(m.texte).not.toMatch(/s'efface/);
  });

  it("une carte auto qui s'efface quand même : UNE seule affirmation (la phrase de Claude qui la dit gardée est retirée)", async () => {
    const m = await dire("à 0:30 ajoute une carte titre « Le diagnostic »", (vu) => ({ reponse: "J'ajoute le titre « Le diagnostic » à 0:30, et la carte « Un outil de plus, une embauche de plus » reste en place.", operations: [carte(motA(vu, 30), motA(vu, 30) + 6, "titre", ["Le diagnostic"], "Titre")], consignes: [fil("Titre à 0:30", [0])] }));
    expect(m.texte).toMatch(/« Un outil de plus, une embauche de plus » s'efface/);
    expect(m.texte).not.toMatch(/reste en place/);
    expect(m.texte).toMatch(/« Le diagnostic »/);
    expect(m.texte).toMatch(/remets-la/);
  });

  it("E : le marqueur `*mot*` n'apparaît jamais à Will (réponse, résumés, fiche Cartes) ; la carte rendue garde le mot en couleur", async () => {
    const m = await dire("ajoute un titre sur la formation", (vu) => ({ reponse: "J'ajoute le titre « Une *formation* pour vos équipes » quand vous parlez de la formation.", operations: [carte(motA(vu, 61), motA(vu, 61) + 6, "titre", ["Une *formation* pour vos équipes"], "Titre sur la formation", "plein-ecran")], consignes: [fil("Titre « Une *formation* pour vos équipes »", [0])] }));
    expect(m.texte).not.toContain("*");
    expect(m.texte).toContain("« Une formation pour vos équipes »");
    expect(JSON.stringify(m.resumes)).not.toContain("*");
    const e = await fabriquee();
    const p = passages(e).find((x) => /formation/.test(x.texte ?? ""))!;
    expect((p.operation as { textes: string[] }).textes).toEqual(["Une *formation* pour vos équipes"]);
    const vue = (await vueVotreVideo(VIDEO))!;
    expect(JSON.stringify(vue.cartes)).not.toContain("*");
    expect(JSON.stringify(vue.passages)).not.toContain("*");
    expect(vue.cartes.find((c) => c.id === p.id)!.textes).toEqual(["Une formation pour vos équipes"]);
    // Will garde le texte tel qu'il le voit dans la fiche : le mot en couleur reste.
    await service.changerTexteCarte(VIDEO, "monteur", p.id, ["Une formation pour vos équipes", "Partout en France"]);
    expect((passages(derniere().entrees!).find((x) => x.id === p.id)!.operation as { textes: string[] }).textes).toEqual(["Une *formation* pour vos équipes", "Partout en France"]);
  });
});

describe("V1 · coupes, hésitations, bégaiements", () => {
  it("rétablir un passage coupé : « remets le debut que tu as coupé » → passage rétabli, les cartes posées SUIVENT", async () => {
    await dire("a 0:32 montre les 3 etapes", (vu) => ({ reponse: "Fait.", operations: [carte(motA(vu, 32), motA(vu, 32) + 14, "ligne-de-temps", ["A", "B", "C"], "Les 3 étapes")], consignes: [fil("Étapes", [0])] }));
    await terminer(derniere().versionId);
    const avant = derniere().entrees!;
    const carteAvant = passages(avant).find((p) => p.modele === "ligne-de-temps")!;
    await dire("remets le debut que tu as coupé", (vu) => ({ reponse: "Début remis.", operations: [env("retablir", { coupeId: vu.coupes.find((c) => c.id === "debut-0")!.id })], consignes: [fil("Début rétabli", [0])] }));
    const e = derniere().entrees!;
    expect(lireEntreesFacecam(e).coupes.retablies).toEqual(["debut-0"]);
    expect(refait(avant, e)).toEqual(["assemblage", "habillage"]);
    // La carte reste sur les mêmes mots : 14,88 s de début remis → elle arrive 14,88 s plus tard dans la vidéo.
    const carteApres = passages(e).find((p) => p.modele === "ligne-de-temps")!;
    expect(carteApres.debutSec - carteAvant.debutSec).toBeCloseTo(14.88, 1);
  });

  it("couper une hésitation : « coupe l'hésitation a 0:41 » → coupe demandée ; cartes d'après recalées", async () => {
    await dire("a 0:50 montre les 3 etapes", (vu) => ({ reponse: "Fait.", operations: [carte(motA(vu, 50), motA(vu, 50) + 12, "ligne-de-temps", ["A", "B", "C"], "Les 3 étapes")], consignes: [fil("Étapes", [0])] }));
    await terminer(derniere().versionId);
    const avant = derniere().entrees!;
    const carteAvant = passages(avant).find((p) => p.modele === "ligne-de-temps")!;
    await dire("coupe l'hésitation a 0:41", (vu) => ({ reponse: "Coupé.", operations: [env("couper", { debutMot: motA(vu, 41), finMot: motA(vu, 41) + 2 })], consignes: [fil("Hésitation coupée à 0:41", [0])] }));
    const e = derniere().entrees!;
    const coupe = lireReglagesMonteur(e).coupesDemandees[0];
    expect(coupe).toBeTruthy();
    expect(refait(avant, e)).toEqual(["assemblage", "habillage"]);
    const carteApres = passages(e).find((p) => p.modele === "ligne-de-temps")!;
    expect(carteAvant.debutSec - carteApres.debutSec).toBeCloseTo(coupe.finSec - coupe.debutSec, 1);
  });

  it("« je bégaie vers la fin, enlève les répétitions » → la première tentative de fin est coupée, la phrase complète reste", async () => {
    const m = await dire("je bégaie vers la fin, enlève les répétitions", (vu) => {
      const quel = occurrences(vu, "Quel");
      return { reponse: "J'ai retiré la phrase dite deux fois à la fin.", operations: [env("couper", { debutMot: quel[0], finMot: quel[1] - 1 })], consignes: [fil("Répétition de la fin retirée", [0])] };
    });
    expect(m.texte).toMatch(/deux fois/);
    const e = derniere().entrees!;
    const { mots } = motsMontes(e);
    const texte = mots.map((x) => x.mot).join(" ");
    expect(texte.match(/Quel que soit/g)).toHaveLength(1);
    expect(texte).toMatch(/Quel que soit votre taille, si vous sentez que du temps vous échappe, réservez/);
    expect(refait(entreesVersion1(), e)).toEqual(["assemblage", "habillage"]);
  });
});

describe("V1 · image, caméra, sous-titres", () => {
  it("« plus de plans de camera stp, ça manque de rythme » → zooms (jamais la multicaméra payante)", async () => {
    const m = await dire("plus de plans de camera stp, ça manque de rythme", (vu) => ({
      reponse: "J'ai ajouté des changements de cadre.",
      operations: [10, 25, 40, 55, 70].map((s) => env("zoom", { debutMot: motA(vu, s), finMot: motA(vu, s) + 6, style: "punch-in", cible: "visage" })),
      consignes: [fil("5 changements de cadre", [0, 1, 2, 3, 4])],
    }));
    expect(m.confirmation).toBeUndefined();
    expect(passages(derniere().entrees!).filter((p) => p.type === "zoom")).toHaveLength(5);
  });

  it("« plus lumineux et bonne mine » → image retouchée, seules l'image et l'habillage sont refaits", async () => {
    await dire("plus lumineux et bonne mine", () => ({ reponse: "Image plus lumineuse.", operations: [env("couleurs", { reglage: "lumiere", cran: "plus", teinte: null }), env("couleurs", { reglage: "mine", cran: "plus", teinte: null })], consignes: [fil("Plus lumineux, meilleure mine", [0, 1])] }));
    const e = derniere().entrees!;
    expect(lireEntreesFacecam(e).image).toMatchObject({ lumiere: "plus", mine: "plus" });
    expect(refait(entreesVersion1(), e)).toEqual(["habillage", "image"]);
  });

  it("changer les sous-titres : « dans les sous titres ecris Certifexemple et pas Calliopi » → mot corrigé, seul l'habillage refait, gardé aux retouches suivantes", async () => {
    const m = await dire("dans les sous titres ecris Certifexemple et pas Calliopi");
    expect(m.texte).toMatch(/Certifexemple/);
    pasDeSouci(m.texte);
    expect(vus).toHaveLength(0);
    expect(retouches).toHaveLength(1);
    const e = derniere().entrees!;
    expect(lireReglagesMonteur(e).correctionsSousTitres).toEqual([{ ancien: "Calliopi", nouveau: "Certifexemple" }]);
    expect(refait(entreesVersion1(), e)).toEqual(["habillage"]);
    const sousTitres = (x: Record<string, unknown>) => habillage(x).segments.flatMap((g) => g.mots.map((w) => w.mot)).join(" ");
    expect(sousTitres(e)).toMatch(/Certifexemple,/);
    expect(sousTitres(e)).not.toMatch(/Calliopi/);
    // Une retouche suivante (« plus lumineux ») ne fait pas revenir l'ancien mot.
    await dire("plus lumineux", () => ({ reponse: "Plus lumineux.", operations: [env("couleurs", { reglage: "lumiere", cran: "plus", teinte: null })], consignes: [fil("Lumière", [0])] }));
    expect(sousTitres(derniere().entrees!)).toMatch(/Certifexemple,/);
    expect(recalques).toHaveLength(0);
  });

  it("sous-titres : un mot absent → réponse claire, aucune version", async () => {
    const m = await dire("corrige Kaliopy par Certifexemple dans les sous-titres");
    expect(m.texte).toMatch(/pas trouvé « Kaliopy »/);
    expect(retouches).toHaveLength(0);
  });

  it("sous-titres : un style hors de portée du chat → réponse claire, aucune carte inventée", async () => {
    const m = await dire("mets les sous titres en jaune");
    pasDeSouci(m.texte);
    expect(m.texte).toMatch(/sous-titres/i);
    expect(retouches).toHaveLength(0);
  });
});

describe("V1 · options payantes : carte de confirmation, Annuler = rien de payé", () => {
  it("« change le decor » : Décor IA retiré (vérif V4) → aucune carte, rien de payé, aucune version", async () => {
    const m = await dire("change le decor, mets un bureau moderne");
    expect(m.confirmation).toBeUndefined();
    expect(m.texte).toMatch(/Décor IA n'est plus proposé/);
    expect(retouches).toHaveLength(0);
    expect(appelsReseau).toHaveLength(0);
  });

  it("« fais-le en 3 caméras » → carte ; Annuler → aucune version, rien de payé", async () => {
    const m = await dire("fais-le en 3 caméras");
    expect(m.confirmation?.optionId).toBe("multicamera-facecam");
    expect(retouches).toHaveLength(0);
    await op.annulerOptionPayante(m.confirmation!.jeton);
    expect(retouches).toHaveLength(0);
    expect((await filMonteur(VIDEO)).at(-1)!.texte).toMatch(/version gratuite/);
    expect(appelsReseau).toHaveLength(0);
  });

  it("effet réaliste (« jette mon telephone sur l'ecran en vrai ») → carte ; Annuler → rien", async () => {
    const m = await dire("jette mon telephone sur l'ecran en vrai", (vu) => ({
      reponse: "Je le propose ici.",
      operations: [env("effetRealisteIA", { consigne: "téléphone jeté", ancre: "bon-endroit", debutMot: motA(vu, 20), instantSec: null, dureeSec: 5, consigneVideo: "A phone is thrown toward the lens.", objet: "telephone", imageReference: null, finitSurEcran: true, sonSuggere: "verre", raisonMoment: "Moment calme." })],
      consignes: [fil("Effet préparé", [0])],
    }));
    expect(m.confirmation?.optionId).toBe("effet-realiste-ia");
    expect(retouches).toHaveLength(0);
    await op.annulerOptionPayante(m.confirmation!.jeton);
    expect(retouches).toHaveLength(0);
  });

  it("demande mêlée : « fais-le en 3 caméras et a 0:32 montre les 3 etapes » → carte payante ET la carte gratuite est faite", async () => {
    const m = await dire("fais-le en 3 caméras et a 0:32 montre les 3 etapes", (vu) => ({ reponse: "Étapes à 0:32.", operations: [carte(motA(vu, 32), motA(vu, 32) + 14, "ligne-de-temps", ["A", "B", "C"], "Les 3 étapes")], consignes: [fil("Étapes à 0:32", [0])] }));
    expect(m.confirmation?.optionId).toBe("multicamera-facecam");
    expect(retouches).toHaveLength(1);
    expect(passages(derniere().entrees!).some((p) => p.modele === "ligne-de-temps")).toBe(true);
    // Claude n'a reçu que la partie gratuite.
    expect(vus[0].variable).not.toMatch(/cam[ée]ras/);
  });
});

describe("V1 · demandes floues, pannes : toujours une réponse claire", () => {
  it("demande incompréhensible → le monteur dit quoi préciser ; aucune version ; jamais « un souci est survenu »", async () => {
    const m = await dire("fais le truc la", () => ({ reponse: "Je n'ai pas compris ce qu'il faut changer : pouvez-vous dire quoi et à quel moment ?", operations: [], consignes: [fil("À préciser : quoi changer, et à quel moment", [], false)] }));
    expect(m.texte).toMatch(/pouvez-vous/);
    pasDeSouci(m.texte);
    expect(retouches).toHaveLength(0);
    expect(m.resumes?.[0]).toMatchObject({ comprise: false });
  });

  it("charabia en version simple (Claude en panne) → « Je n'ai pas compris » avec des exemples, jamais un souci nu", async () => {
    panneClaude = 2;
    const m = await dire("qsdkjqsd");
    pasDeSouci(m.texte);
    expect(m.texte).toMatch(/reformuler|préciser/);
    expect(m.texte).toMatch(/par exemple/i);
  });
});

const MESSAGE_PROD = "IL MAnque pplusierus plan de caméra. ET BEAUCOUP D4ANIMATION AU DEBUT; PUIS VERS LA FIN de la video je bégueille et je reprned des memes phrase. fixe ce probleme";

describe("V1 · la demande longue de Will en prod (« Je n'ai pas compris » le 10/10)", () => {
  it("avec Claude : décomposée en 3 points, tous faits, UNE nouvelle version", async () => {
    const m = await dire(MESSAGE_PROD, (vu) => {
      const quel = occurrences(vu, "Quel");
      return {
        reponse: "J'ai ajouté des changements de cadre, des animations au début et retiré la phrase redite à la fin.",
        operations: [
          ...[10, 30, 50, 70].map((s) => env("zoom", { debutMot: motA(vu, s), finMot: motA(vu, s) + 5, style: "punch-in", cible: "visage" })),
          carte(motA(vu, 0), motA(vu, 3), "titre", ["Votre temps fuit"], "Accroche", "plein-ecran"),
          carte(motA(vu, 13), motA(vu, 16), "icone-mot", ["Le temps s'échappe"], "Temps"),
          env("couper", { debutMot: quel[0], finMot: quel[1] - 1 }),
        ],
        consignes: [fil("Plans de caméra, animations au début, répétition de la fin retirée", [0, 1, 2, 3, 4, 5, 6])],
      };
    });
    expect(vus[0].variable).toContain("bégueille");
    expect(m.texte).not.toMatch(/pas compris/);
    expect(retouches).toHaveLength(1);
    const e = derniere().entrees!;
    expect(passages(e).filter((p) => p.type === "zoom")).toHaveLength(4);
    expect(passages(e).filter((p) => p.type !== "zoom" && p.debutSec < 20)).toHaveLength(2);
    expect(motsMontes(e).mots.map((x) => x.mot).join(" ").match(/Quel que soit/g)).toHaveLength(1);
  });

  it("la consigne de Claude lui dit de traiter CHAQUE point d'un message, fautes comprises", async () => {
    const { roleMonteurFacecam } = await import("@/moteurs/montage-facecam/monteur");
    expect(roleMonteurFacecam.consigne).toMatch(/plusieurs demandes/);
    expect(roleMonteurFacecam.consigne).toMatch(/fautes de frappe/);
    expect(roleMonteurFacecam.consigne).toMatch(/répét/);
    expect(roleMonteurFacecam.consigne).toMatch(/carte-auto/);
  });

  it("SANS Claude (panne, comme le 10/10) : la version simple décompose aussi et fait les 3 points", async () => {
    panneClaude = 2;
    const m = await dire(MESSAGE_PROD);
    expect(m.texte).toContain(PHRASE_VERSION_SIMPLE_PANNE);
    expect(m.texte).not.toMatch(/n'ai pas compris/);
    expect(m.versionSimple).toBe(true);
    const e = derniere().entrees!;
    expect(passages(e).filter((p) => p.type === "zoom").length).toBeGreaterThanOrEqual(3);
    // Début animé : les cartes déjà posées y restent, et des mouvements de cadre s'y ajoutent (jamais 2 sur un mot).
    const debut = passages(e).filter((p) => p.type === "zoom" && p.debutSec < 25);
    expect(debut.length).toBeGreaterThanOrEqual(4);
    expect(new Set(debut.map((p) => p.ancre.debutPriseSec)).size).toBe(debut.length);
    expect(habillage(e).cartesAuto.filter((c) => c.debutSec < 25).length).toBeGreaterThanOrEqual(2);
    const texte = motsMontes(e).mots.map((x) => x.mot).join(" ");
    expect(texte.match(/Quel que soit/g)).toHaveLength(1);
    expect(texte).toMatch(/si vous sentez que du temps vous échappe, réservez/);
  });

  it("version simple : « plus lumineux » est compris", async () => {
    panneClaude = 2;
    await dire("plus lumineux stp");
    expect(lireEntreesFacecam(derniere().entrees!).image.lumiere).toBe("plus");
  });
});

describe("V1 · plusieurs messages à la suite : historique, versions successives, rien de perdu", () => {
  it("3 messages envoyés PENDANT que les versions se fabriquent → la dernière version contient les 3 changements", async () => {
    await dire("a 0:32 montre les 3 etapes", (vu) => ({ reponse: "Fait.", operations: [carte(motA(vu, 32), motA(vu, 32) + 14, "ligne-de-temps", ["A", "B", "C"], "Les 3 étapes")], consignes: [fil("Étapes", [0])] }));
    await dire("plus lumineux", () => ({ reponse: "Plus lumineux.", operations: [env("couleurs", { reglage: "lumiere", cran: "plus", teinte: null })], consignes: [fil("Lumière", [0])] }));
    await dire("ajoute un zoom a 0:10", (vu) => ({ reponse: "Zoom.", operations: [env("zoom", { debutMot: motA(vu, 10), finMot: motA(vu, 10) + 4, style: "punch-in", cible: "visage" })], consignes: [fil("Zoom à 0:10", [0])] }));
    expect(retouches).toHaveLength(3);
    const e = derniere().entrees!;
    expect(passages(e).some((p) => p.modele === "ligne-de-temps")).toBe(true);
    expect(passages(e).some((p) => p.type === "zoom")).toBe(true);
    expect(lireEntreesFacecam(e).image.lumiere).toBe("plus");
    // Le 3e message voit ce que les 2 premiers ont posé, et l'historique du fil.
    expect(vus[2].variable).toMatch(/<fil>[\s\S]*plus lumineux[\s\S]*<\/fil>/);
    expect(vus[2].elements.some((x) => x.texte.includes("A · B · C"))).toBe(true);
    expect(vus[2].variable).toMatch(/lumiere=plus/);
    const filFinal = await filMonteur(VIDEO);
    expect(filFinal.map((x) => x.de)).toEqual(["will", "monteur", "will", "monteur", "will", "monteur"]);
    expect(filFinal.filter((x) => x.versionId).map((x) => x.versionId)).toEqual(["ver-v1-1", "ver-v1-2", "ver-v1-3"]);
  });

  it("versions terminées une à une : chaque message repart de la dernière version, les consignes s'empilent", async () => {
    await dire("a 0:32 montre les 3 etapes", (vu) => ({ reponse: "Fait.", operations: [carte(motA(vu, 32), motA(vu, 32) + 14, "ligne-de-temps", ["A", "B", "C"], "Les 3 étapes")], consignes: [fil("Étapes", [0])] }));
    await terminer(derniere().versionId);
    await dire("plus lumineux", () => ({ reponse: "Plus lumineux.", operations: [env("couleurs", { reglage: "lumiere", cran: "plus", teinte: null })], consignes: [fil("Lumière", [0])] }));
    await terminer(derniere().versionId);
    const v = await versionChoisie();
    expect(v.id).toBe("ver-v1-2");
    expect(lireEntreesFacecam(v.commande.entrees!).consignes.map((c) => c.etat)).toEqual(["appliquee", "appliquee"]);
    expect(passages(v.commande.entrees!).some((p) => p.modele === "ligne-de-temps")).toBe(true);
  });

  it("une version plus ancienne qui finit APRÈS la plus récente ne la remplace pas", async () => {
    const { versionPlusRecentePrete } = await import("@/services/travaux");
    const base = { videoId: VIDEO, choisie: false };
    const versions = [
      { ...base, id: "a", numero: 1, statut: "prete" },
      { ...base, id: "b", numero: 2, statut: "en_fabrication" },
      { ...base, id: "c", numero: 3, statut: "prete", choisie: true },
    ];
    expect(versionPlusRecentePrete(versions as never, "b")?.id).toBe("c");
    expect(versionPlusRecentePrete(versions as never, "c")).toBeNull();
  });

  it("reprise après redémarrage : le fil, la carte payante en attente et la dernière version sont retrouvés", async () => {
    await dire("a 0:32 montre les 3 etapes", (vu) => ({ reponse: "Fait.", operations: [carte(motA(vu, 32), motA(vu, 32) + 14, "ligne-de-temps", ["A", "B", "C"], "Les 3 étapes")], consignes: [fil("Étapes", [0])] }));
    const payante = await dire("fais-le en 3 caméras");
    // Redémarrage : les modules sont rechargés (la base, elle, reste).
    vi.resetModules();
    const apres = await import("@/services/monteur-facecam");
    const opApres = await import("@/services/options-payantes");
    const gcApres = await import("@/services/generation-claude");
    void gcApres;
    expect((await apres.filMonteur(VIDEO)).length).toBe(4);
    expect((await opApres.demandeOuverte("multicamera-facecam", VIDEO))?.jeton).toBe(payante.confirmation!.jeton);
    cerveaux.push(() => ({ reponse: "Plus lumineux.", operations: [env("couleurs", { reglage: "lumiere", cran: "plus", teinte: null })], consignes: [fil("Lumière", [0])] }));
    await apres.discuterAvecMonteur(VIDEO, "plus lumineux");
    const e = derniere().entrees!;
    expect(passages(e).some((p) => p.modele === "ligne-de-temps")).toBe(true);
    expect(lireEntreesFacecam(e).image.lumiere).toBe("plus");
  });

  it("si la nouvelle version ne peut pas partir, le message et la raison restent dans le fil (rien de perdu)", async () => {
    refusRetouche = "Crédit insuffisant pour cette retouche.";
    const m = await dire("plus lumineux", () => ({ reponse: "Plus lumineux.", operations: [env("couleurs", { reglage: "lumiere", cran: "plus", teinte: null })], consignes: [fil("Lumière", [0])] }));
    expect(m.texte).toMatch(/Crédit insuffisant/);
    const f = await filMonteur(VIDEO);
    expect(f.map((x) => x.de)).toEqual(["will", "monteur"]);
    expect(f[0].texte).toBe("plus lumineux");
  });

});

/* ------------------------------------------------------------------ */
/* Test en prod du 11/10 : le monteur connaît la couverture             */
/* ------------------------------------------------------------------ */

describe("11/10 · le monteur connaît la couverture (miniature) et le nom de la vidéo", () => {
  /** Couverture de prod : le code interne écrit EN GROS sur l'image affichée avant la lecture. */
  const COUVERTURE_PROD = "0005-FC-TT-L · LE DIAGNOSTIC FUITE — V5";
  const NOM_PROD = "0005-FC-TT-L · Le diagnostic fuite — v5";
  const MINI = "mini-couv";
  const FICHIER_AVANT = "f-couv-avant";
  /** Carte titre du début, déjà bonne en prod (sans numéro). */
  const titreDebut = { id: "pass-titre", type: "titre", debutSec: 0, finSec: 3, texte: "Le diagnostic fuite", origine: "demande", ancres: { debutPriseSec: 0, finPriseSec: 3 }, operation: { type: "titre", texte: "Le diagnostic fuite", debutMot: null, finMot: null, pleinEcran: false } };

  beforeEach(async () => {
    miniaturesReliees = true;
    retitrages.length = 0;
    const ver = await versionChoisie();
    const entrees = entreesVersion1();
    const fc = entrees.facecam as Record<string, unknown>;
    await depots().versions.modifier(ver.id, { commande: { ...ver.commande, entrees: { ...entrees, facecam: { ...fc, passages: [titreDebut] } } } });
    await depots().videos.modifier(VIDEO, { titre: NOM_PROD, miniatureChoisieId: MINI });
    for (const m of await depots().miniatures.lister((x) => x.videoId === VIDEO)) await depots().miniatures.modifier(m.id, { choisie: false });
    await depots().fichiers.enregistrer({ id: FICHIER_AVANT, cleStockage: "studio/test/videos/v-04/miniatures/miniature-1.jpg", nom: "miniature-1.jpg", mime: "image/jpeg", taille: 0, origine: "fabrication", statut: "pret", creeLe: ver.creeLe, modifieLe: ver.creeLe } as never);
    await depots().miniatures.enregistrer({ id: MINI, videoId: VIDEO, fichierId: FICHIER_AVANT, titre: COUVERTURE_PROD, choisie: true, ratio: "9:16", origine: "rendu", incrustee: true, instantSec: 12, variante: 0, creeLe: ver.creeLe, modifieLe: ver.creeLe } as never);
  });
  afterEach(() => {
    miniaturesReliees = false;
  });

  const miniature = async () => (await depots().miniatures.obtenir(MINI))!;
  /** Prod : la réponse de Claude au 1er message (le numéro dit « invisible à l'écran »). */
  const claudeProd1 = () => ({ reponse: "Le titre affiché dans la vidéo ne contient aucun numéro : « 0005-FC-TT-L … v5 » n'est que le nom du projet, invisible à l'écran, donc je n'ai rien changé.", operations: [], consignes: [fil("Le titre affiché dans la vidéo ne contient aucun numéro : rien à changer.", [], false)] });
  /** Prod : la réponse de Claude au 2e message (il refait la carte titre du début, déjà bonne). */
  const claudeProd2 = (vu: Vu) => {
    const t = vu.elements.find((e) => e.type === "titre");
    return { reponse: "J'ai refait le titre du début sans numéro.", operations: [...(t ? [env("retirer", { passageId: t.id })] : []), env("titre", { texte: "Le diagnostic fuite", debutMot: null, finMot: null, pleinEcran: false })], consignes: [fil("Titre du début refait sans numéro", t ? [0, 1] : [0])] };
  };

  it("contexte : le monteur reçoit le titre de couverture (écrit sur l'image) et le nom de la vidéo dans le studio", async () => {
    await dire("rien", () => ({ reponse: "Rien à changer.", operations: [], consignes: [fil("Rien", [], false)] }));
    const v = vus[0].variable;
    expect(v).toMatch(/<couverture>[\s\S]*0005-FC-TT-L · LE DIAGNOSTIC FUITE — V5[\s\S]*<\/couverture>/);
    expect(v).toMatch(/<couverture>[\s\S]*écrit sur l'image : oui[\s\S]*<\/couverture>/);
    expect(v).toContain(`<titre>${NOM_PROD}</titre>`);
  });

  it("la consigne de Claude : chercher dans la couverture, jamais « invisible à l'écran », demander « sur la couverture ou dans la vidéo ? » en cas de doute", async () => {
    const { roleMonteurFacecam } = await import("@/moteurs/montage-facecam/monteur");
    expect(roleMonteurFacecam.consigne).toMatch(/<couverture>/);
    expect(roleMonteurFacecam.consigne).toMatch(/changerTitreCouverture/);
    expect(roleMonteurFacecam.consigne).toMatch(/invisible/);
    expect(roleMonteurFacecam.consigne).toMatch(/sur la couverture ou dans la vidéo \?/);
  });

  it("échange 1 rejoué : « ENLEVER LE numéro dans le titre de la vidéo » → la COUVERTURE est refaite sans le numéro, aucun montage, jamais « invisible à l'écran »", async () => {
    const m = await dire("ENLEVER LE numéro dans le titre de la vidéo", claudeProd1);
    expect(m.texte).not.toMatch(/invisible|nom du projet|rien changé/i);
    expect(m.texte).toContain("La couverture affiche maintenant « LE DIAGNOSTIC FUITE »");
    const mini = await miniature();
    expect(mini.titre).toBe("LE DIAGNOSTIC FUITE");
    expect(mini.fichierId).not.toBe(FICHIER_AVANT);
    // L'ancienne image reste dans les fichiers (rien n'est effacé).
    expect(await depots().fichiers.obtenir(FICHIER_AVANT)).toBeTruthy();
    // Aucune nouvelle version de la vidéo : réponse immédiate.
    expect(retouches).toHaveLength(0);
    expect(m.versionId).toBeUndefined();
    expect(m.texte).not.toMatch(/Nouvelle version/);
    // Le nom dans le studio garde le code : Will sait comment le changer.
    expect(m.texte).toMatch(/renomme/i);
  });

  it("échange 2 rejoué (fil de prod) : « alors modifier le titre pour que ca ne paraisse plus » → couverture refaite, la carte titre du début n'est PAS refaite", async () => {
    await ecrireParametre(`facecam.fil.${VIDEO}`, [
      { id: "fil-1", le: "2026-10-11T09:00:00.000Z", de: "will", texte: "ENLEVER LE numéro dans le titre de la vidéo" },
      { id: "fil-2", le: "2026-10-11T09:00:05.000Z", de: "monteur", texte: claudeProd1().reponse },
    ]);
    const m = await dire("alors modifier le titre pour que ca ne paraisse plus", claudeProd2);
    expect(retouches).toHaveLength(0);
    expect(m.versionId).toBeUndefined();
    expect(m.texte).toContain("La couverture affiche maintenant « LE DIAGNOSTIC FUITE »");
    expect((await miniature()).titre).toBe("LE DIAGNOSTIC FUITE");
  });

  it("Claude choisit lui-même « changerTitreCouverture » : image refaite, aucune version vidéo, réponse immédiate", async () => {
    const m = await dire("mets « Fuite de temps » sur la couverture", () => ({ reponse: "Couverture changée.", operations: [env("changerTitreCouverture", { texte: "Fuite de temps" })], consignes: [fil("Couverture : « Fuite de temps »", [0])] }));
    expect(retitrages.map((r) => r.titre)).toEqual(["Fuite de temps"]);
    expect((await miniature()).titre).toBe("Fuite de temps");
    expect(retouches).toHaveLength(0);
    expect(m.versionId).toBeUndefined();
    expect(m.texte).toContain("La couverture affiche maintenant « Fuite de temps »");
  });

  it("couverture ET montage dans le même message : la couverture est refaite, la nouvelle version ne porte que le montage", async () => {
    const m = await dire("mets « Fuite de temps » sur la couverture et plus lumineux", () => ({ reponse: "C'est fait.", operations: [env("changerTitreCouverture", { texte: "Fuite de temps" }), env("couleurs", { reglage: "lumiere", cran: "plus", teinte: null })], consignes: [fil("Couverture et lumière", [0, 1])] }));
    expect((await miniature()).titre).toBe("Fuite de temps");
    expect(retouches).toHaveLength(1);
    expect(m.texte).toContain("La couverture affiche maintenant « Fuite de temps »");
  });

  it("calcul réel des miniatures pas relié : réponse honnête, « onglet Miniature », couverture inchangée, aucun montage", async () => {
    miniaturesReliees = false;
    const m = await dire("ENLEVER LE numéro dans le titre de la vidéo", claudeProd1);
    expect(m.texte).not.toMatch(/affiche maintenant/);
    expect(m.texte).toMatch(/onglet Miniature/);
    const mini = await miniature();
    expect(mini.titre).toBe(COUVERTURE_PROD);
    expect(mini.fichierId).toBe(FICHIER_AVANT);
    expect(retouches).toHaveLength(0);
  });

  it("Claude dit qu'un texte est « invisible à l'écran » alors qu'il est sur la couverture → jamais repris ; le monteur demande « sur la couverture ou dans la vidéo ? »", async () => {
    const m = await dire("le titre ne va pas", () => ({ reponse: "Le titre « 0005-FC-TT-L · Le diagnostic fuite — v5 » n'est que le nom du projet, invisible à l'écran.", operations: [], consignes: [fil("Nom du projet invisible à l'écran", [], false)] }));
    expect(m.texte).not.toMatch(/invisible|nom du projet/i);
    expect(JSON.stringify(m.resumes ?? [])).not.toMatch(/invisible|nom du projet/i);
    expect(m.texte).toMatch(/sur la couverture ou dans la vidéo \?/);
    expect(m.texte).toContain(COUVERTURE_PROD);
    expect(retouches).toHaveLength(0);
  });

  it("renommer la vidéo elle-même : « renomme la vidéo en « Le diagnostic fuite » » → nom changé dans le studio, sans montage ni couverture", async () => {
    const m = await dire("renomme la vidéo en « Le diagnostic fuite »");
    expect((await depots().videos.obtenir(VIDEO))!.titre).toBe("Le diagnostic fuite");
    expect(m.texte).toContain("« Le diagnostic fuite »");
    expect(retouches).toHaveLength(0);
    expect(retitrages).toHaveLength(0);
    expect(vus).toHaveLength(0);
  });

  it("renommer sans dire le nouveau nom → le monteur dit simplement où le faire, rien ne change", async () => {
    const m = await dire("je veux changer le nom de la vidéo");
    expect(m.texte).toMatch(/Renommer/);
    expect((await depots().videos.obtenir(VIDEO))!.titre).toBe(NOM_PROD);
    expect(retouches).toHaveLength(0);
    expect(vus).toHaveLength(0);
  });
});
