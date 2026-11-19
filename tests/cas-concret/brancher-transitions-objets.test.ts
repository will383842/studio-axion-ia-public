/**
 * BR-CC-BRANCHER · la vraie `fabriquerCasConcret` pose les transitions dessinées (`habillageTransitions`) et les petits objets
 * (`objetsPermis`, lus par `index.ts` dans l'entrée bibliothèque) dans le plan de scènes. ÉTEINT par défaut : sans eux, rien ne change.
 * Doubles seulement, plan du stock (aucun `appeler`), aucun appel réel, aucun euro.
 */
import { describe, expect, it, vi } from "vitest";
import { ID } from "@/briques/bibliotheque-video/noms";
import { profilNeutre } from "@/briques/bibliotheque-video/profils";
import type { EntreeBibliotheque, ProfilVideo } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import type { AppelClaude } from "@/briques/plan-scenes/generateur";
import { VERSION_PLAN_SCENES } from "@/briques/plan-scenes/schema";
import type { ReponseClaude, RequeteClaude } from "@/fournisseurs/claude/client";
import { piecesPermisesDesEntrees } from "@/briques/plan-scenes-objets/pieces-permises";
import type { PlanHabille } from "@/briques/motion/habillage-commun/types";
import type { CommandeFabrication, Travail } from "@/domaine/types";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import { SCRIPT_V4_RECRUTEMENT } from "@/moteurs/montage-cas-concret/scripts-valides/recrutement-apporteurs";
import { banc } from "./moteur/doubles";
import { doubles } from "./fabriquer/doubles";

const captures: Record<string, unknown>[] = [];
vi.mock("@/moteurs/montage-cas-concret/fabriquer", async (orig) => {
  const m = await orig<typeof import("@/moteurs/montage-cas-concret/fabriquer")>();
  return { ...m, fabriquerCasConcret: (o: Record<string, unknown>) => { captures.push(o); return m.fabriquerCasConcret(o as never); } };
});

const appelsPlan: Record<string, unknown>[] = [];
vi.mock("@/moteurs/montage-cas-concret/plan-scenes", async (orig) => {
  const m = await orig<typeof import("@/moteurs/montage-cas-concret/plan-scenes")>();
  return { ...m, planScenesCasConcret: (o: Record<string, unknown>) => { appelsPlan.push(o); return m.planScenesCasConcret(o as never); } };
});

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0);
const CAPACITES = ["objet.chiffre", "objet.marque"] as const;

function entreeBiblio(capacites: readonly string[], permis = true): { bibliothequeVideo: EntreeBibliotheque } {
  const base = profilNeutre("format-essai");
  const caps = Object.fromEntries(capacites.map((c) => [c, { permis }]));
  const profil: ProfilVideo = { ...base, capacites: caps as ProfilVideo["capacites"], verrous: [] };
  return { bibliothequeVideo: { version: VERSION_BIBLIOTHEQUE, profil, recents: [], graine: "G", figeeLe: "2026-11-16" } };
}

async function optionsRecues(entreesEnPlus?: Record<string, unknown>): Promise<Record<string, unknown>> {
  captures.length = 0;
  const b = banc();
  const c0 = b.commande();
  const c: CommandeFabrication = entreesEnPlus ? { ...c0, entrees: { ...(c0.entrees as object), ...entreesEnPlus } } : c0;
  let t: Travail = await b.moteur.lancer(c, { travailId: "t-brcc", versionId: "ver-brcc", titre: "Essai", maintenant: T0 });
  for (let n = 0; n < 200 && !captures.length && t.statut !== "termine" && t.statut !== "echec"; n++) {
    t = (await b.moteur.avancer(JSON.parse(JSON.stringify(t)) as Travail, c, T0 + n * 1000)).travail;
  }
  expect(captures.length).toBeGreaterThan(0);
  return captures[0];
}

/** Une fabrication complète sur les doubles, plan de scènes du stock (sans Claude). */
async function fabriquer(extra: Record<string, unknown>, texteEnPlus?: string, partout = false) {
  const d = doubles();
  d.options.planScenes = {};
  d.options.scriptValide = { ...SCRIPT_V4_RECRUTEMENT, ecrans: SCRIPT_V4_RECRUTEMENT.ecrans.map((e, i) => ((partout ? i >= 4 : i === 1) && texteEnPlus ? { ...e, texteDit: `${e.texteDit.trim()} ${texteEnPlus}` } : e)) };
  const { entrees: en, ...autres } = extra;
  Object.assign(d.options, autres);
  d.options.entrees = { ...d.options.entrees, ...(en as object | undefined) };
  const r = await fabriquerCasConcret(d.options);
  const props = d.ecransSoumis().map((s) => (s.parametres as { proprietes: { id: string; planScenes?: PlanHabille & { scenes: { piece: string }[] } } }).proprietes);
  return { r, d, props };
}
/** Les liens signés portent un jeton au hasard : seul lui est retiré de la comparaison. */
const figer = (x: unknown) => JSON.stringify(x).replace(/jeton=[^"&]*/g, "jeton=_");
const transitions = (props: Awaited<ReturnType<typeof fabriquer>>["props"]) => props.filter((p) => Object.keys(p.planScenes?.habillageCommun?.transitions ?? {}).length > 0);
/** Faux fournisseur du plan (aucun appel réel, aucun euro) : une scène de 6 à 9 mots, légende de ses 3 derniers mots, mots lus dans le minutage de la requête. */
function appelerSimule(): AppelClaude {
  return async (q: RequeteClaude): Promise<ReponseClaude> => {
    const lignes = String(q.messages[0]!.contenu).split("\n");
    const mots = lignes.slice(lignes.indexOf("Minutage des mots (indice, texte, début ms, fin ms) :") + 1).map((l) => l.split("\t")).filter((c) => c.length === 4 && /^\d+$/.test(c[0]!)).map((c) => ({ texte: c[1]!, debutMs: Number(c[2]), finMs: Number(c[3]) }));
    const liaison = new Set(["de", "du", "des", "d", "à", "au", "aux", "par", "pour", "le", "la", "les", "l", "un", "une", "et", "ou", "en", "sur", "avec", "dans", "que", "qui", "ce", "se", "sans", "sous", "mais", "donc"]);
    const fin = (m: { texte: string }) => !liaison.has(m.texte.toLowerCase().replace(/[.,;:!?…»"”)]+$/, "").replace(/^.*['’]/, ""));
    const scenes = [];
    for (let i = 0, k = 1; i < mots.length; k++) {
      let j = i + 1; // scène de 6 à 9 mots (temps de lecture), légende = ses 3 derniers mots, sans finir par un mot de liaison (sinon l'adaptateur laisse la légende aux sous-titres)
      while (j < mots.length - 1 && (j - i < 5 || !fin(mots[j]!)) && j - i < 8) j++;
      if (!fin(mots[j]!) || j >= mots.length) break;
      scenes.push({ id: `s${k}`, version: 1, mots: { premier: i, dernier: j }, debutMs: mots[i]!.debutMs, finMs: j + 1 < mots.length ? mots[j + 1]!.debutMs : mots[j]!.finMs, niveau: 1, position: "bas", transition: { entree: "fondu", sortie: "fondu", dureeMs: 300 }, piece: "legende", parametres: { texte: mots.slice(j - 2, j + 1).map((m) => m.texte).join(" "), sousTexte: "", style: "bandeau" } });
      i = j + 1;
    }
    const plan = { version: VERSION_PLAN_SCENES, format: q.messages[0]!.contenu.includes("1080") ? { largeur: 1080, hauteur: 1920, fps: 25 } : {}, facecam: false, dureeMs: mots.at(-1)!.finMs, habillage: { fond: "ivoire", accent: "terracotta" }, mots, scenes };
    return { texte: JSON.stringify(plan), modeleDemande: q.modele, modele: q.modele, replis: [], stopReason: "end_turn", jetons: { entree: 1, cacheLu: 0, cacheEcrit: 0, sortie: 1 } };
  };
}
const pieces = (props: Awaited<ReturnType<typeof fabriquer>>["props"]) => props.flatMap((p) => (p.planScenes?.scenes ?? []).map((s) => s.piece));

describe("(a) éteint = identique", () => {
  it("sans `habillageTransitions` ni `objetsPermis` : propriétés des écrans et mémo identiques, aucune transition", async () => {
    const x = await fabriquer({});
    const y = await fabriquer({ objetsPermis: [] });
    expect(transitions(x.props)).toHaveLength(0);
    expect(pieces(x.props).filter((p) => p.startsWith("objet-"))).toHaveLength(0);
    expect(figer(y.props)).toBe(figer(x.props));
    const faux = await fabriquer({ entrees: { habillageTransitions: false } });
    expect(figer(faux.props)).toBe(figer(x.props));
  });
  it("index.ts : aucune clé `objetsPermis` sans entrée bibliothèque, ni capacité objet absente", async () => {
    expect(Object.keys(await optionsRecues())).not.toContain("objetsPermis");
    expect(Object.keys(await optionsRecues(entreeBiblio(["objet.chiffre"], false)))).not.toContain("objetsPermis");
  });
});

describe("(b) `habillageTransitions: true` par fabriquerCasConcret", () => {
  it("le plan de scènes reçoit `habillage` actif (graine = identifiant de la vidéo) ; sinon aucune clé", async () => {
    appelsPlan.length = 0;
    await fabriquer({});
    await fabriquer({ entrees: { habillageTransitions: false } });
    expect(appelsPlan.length).toBeGreaterThan(0);
    for (const a of appelsPlan) expect(Object.keys(a)).not.toContain("habillage");
    appelsPlan.length = 0;
    const x = await fabriquer({ entrees: { habillageTransitions: true } });
    expect(appelsPlan.length).toBeGreaterThan(0);
    for (const a of appelsPlan) expect(a.habillage).toEqual({ actif: true, graine: x.d.options.videoId });
  });
  // Graine fixée (le choix est déterministe) : le plan simulé coupe les scènes sans connaître les écrans, une transition ne tient que si sa scène tient dans un écran.
  it("au moins une tranche porte `habillageCommun.transitions` (plan simulé de ≥ 10 scènes) ; éteint : aucune", async () => {
    const eteint = await fabriquer({ videoId: "v-essai-1", planScenes: { appeler: appelerSimule() } });
    expect(eteint.props.flatMap((p) => p.planScenes?.scenes ?? []).length).toBeGreaterThanOrEqual(10);
    expect(transitions(eteint.props)).toHaveLength(0);
    const allume = await fabriquer({ videoId: "v-essai-1", planScenes: { appeler: appelerSimule() }, entrees: { habillageTransitions: true } });
    expect(allume.props.flatMap((p) => p.planScenes?.scenes ?? []).length).toBeGreaterThanOrEqual(10);
    expect(transitions(allume.props).length).toBeGreaterThan(0);
  });
});

describe("(c) index.ts passe les pièces permises", () => {
  it("capacités objet permises : `objetsPermis` non vide, égal à piecesPermisesDesEntrees", async () => {
    const e = entreeBiblio(CAPACITES);
    const o = await optionsRecues(e);
    expect((o.objetsPermis as string[]).length).toBeGreaterThan(0);
    expect(o.objetsPermis).toEqual([...piecesPermisesDesEntrees(e)]);
  });
});

describe("(d) objets aux mots dits", () => {
  it("gros chiffre (3) et coche, jamais deux objets au même instant", async () => {
    const permis = [...piecesPermisesDesEntrees(entreeBiblio(CAPACITES))];
    expect(permis).toContain("objet-gros-chiffre");
    const x = await fabriquer({ objetsPermis: permis }, "On gagne 3 heures par semaine. C'est fait.");
    const p = pieces(x.props);
    expect(p).toContain("objet-gros-chiffre");
    expect(p).toContain("objet-coche");
    const objets = x.props.flatMap((e) => (e.planScenes?.scenes ?? []) as unknown as { piece: string; debutMs: number; finMs: number }[]).filter((s) => s.piece.startsWith("objet-"));
    for (const a of objets) for (const b of objets) if (a !== b) expect(a.debutMs < b.finMs && b.debutMs < a.finMs).toBe(false);
  });
});
