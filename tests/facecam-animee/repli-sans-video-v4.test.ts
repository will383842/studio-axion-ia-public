/**
 * FACE CAMÉRA ANIMÉE v4 — REPLI « SANS VIDÉO » (19/10/2026). Quand aucune vidéo fidèle n'est trouvée pour une plaquette à vidéo ET que le plan
 * sans elle viole H1/H2, la chaîne revient UNE fois à la mise en scène : Opus refait son plan sans plaquette à vidéo (règle D16). Aucune vidéo
 * approximative, aucun contrôle assoupli, jamais le plan minimal. Aucun appel réseau : outils doubles.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { resultatV4 } from "@/moteurs/montage-facecam-animee";
import { ESSAIS_MAX_REALISATEUR } from "@/moteurs/montage-facecam-animee/realisateur";
import { avancerChaineV4, entreeRealisateurV4, ErreurChaineV4, etatInitialV4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import type { MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur";
import { coutEssaiSuivantV4, estimerOpusV4 } from "@/moteurs/montage-facecam-animee/realisateur/cout-v4";
import { controlerDiversiteV4, estRendableV4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";
import { ESSAIS_REPLI_SANS_VIDEO_V4, IDS_PLAQUETTES_A_VIDEO_V4 } from "@/moteurs/montage-facecam-animee/repli-sans-video-v4";

// `realiser` espionné : il fait le vrai travail, sauf quand un test lui dicte sa réponse (R4).
vi.mock("@/moteurs/montage-facecam-animee/realisateur", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/moteurs/montage-facecam-animee/realisateur")>();
  return { ...reel, realiser: vi.fn(reel.realiser) };
});
import { realiser } from "@/moteurs/montage-facecam-animee/realisateur";

const RACINE = join(__dirname, "..", "..");
const REPETITION = join(RACINE, "docs/facecam-animee-v4/repetition-generale");
const TRANS = JSON.parse(readFileSync(join(REPETITION, "transcription.json"), "utf8")) as { dureeMonteeSec: number; gardes: { debutSec: number; finSec: number }[]; motsMontesTexteValide: MotTranscrit[] };
const PLAN_VALIDE = JSON.parse(readFileSync(join(REPETITION, "plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;

const A_VIDEO = new Set(["AvantApres", "MosaiqueVideos", "duel-video"]);
const sansMedias = (els: readonly ElementV4Plan[]): ElementV4Plan[] =>
  els.map((e) => {
    if (!A_VIDEO.has(e.id)) return { ...e };
    const copie = { ...e };
    delete copie.medias;
    return copie;
  });
const PLAN_OPUS: PlanFacecamAnimee = { ...PLAN_VALIDE, elementsV4: sansMedias(PLAN_VALIDE.elementsV4 ?? []) };
const RANGS_VIDEO = (PLAN_OPUS.elementsV4 ?? []).flatMap((e, i) => (A_VIDEO.has(e.id) ? [i] : []));
const MOTS = TRANS.motsMontesTexteValide;

const base = (): EtatChaineV4 => ({
  ...etatInitialV4({ videoId: "v-1", versionId: "ver-1", priseCle: "k.mov" }),
  etape: "videos",
  coupes: { gardes: TRANS.gardes, dureeSec: TRANS.dureeMonteeSec, mots: MOTS },
  realisation: { version: "complete", essais: 1, avertissements: 0, plan: PLAN_OPUS },
});

type EntreeVideos = Parameters<NonNullable<OutilsChaineV4["videos"]>>[0];
/** Outil « videos » double : remplit tous les `medias` des plaquettes à vidéo, sauf celles de `sauf` (rangs). */
function outilVideos(sauf: number[] = []) {
  return vi.fn(async (d: EntreeVideos) => {
    const fichiers: { nom: string; cle: string }[] = [];
    const elementsV4 = (d.plan.elementsV4 ?? []).map((e, i) => {
      if (!A_VIDEO.has(e.id) || sauf.includes(i)) return e;
      const medias = (e.recherches ?? []).map((_, k) => {
        const nom = `v4-${i}-${k}.mp4`;
        fichiers.push({ nom, cle: `studio/dev/facecam-animee/${d.videoId}/videos/${nom}` });
        return `broll/${nom}`;
      });
      return { ...e, medias };
    });
    return { plan: { ...d.plan, elementsV4 }, fichiers, manques: sauf.map((i) => `plaquette ${i} : aucune vidéo littérale`), depenseUsd: 0.12 };
  });
}

function outils(extra: Partial<OutilsChaineV4> = {}) {
  const rendre = vi.fn(async (d: Parameters<OutilsChaineV4["rendre"]>[0]) => ({ cle: "c.mp4", vignetteCle: "c.jpg", dureeSec: d.plan.duree, taille: 1 }));
  const o = { transcrire: vi.fn(), plafondClaudeAtteint: async () => false, rendre, ...extra } as unknown as OutilsChaineV4;
  return { o, rendre };
}

const retireesDe = (rangs: number[]) => rangs.map((rang) => { const e = PLAN_OPUS.elementsV4![rang]; return { rang, id: e.id, debut: e.debut, fin: e.fin, raison: "aucune vidéo fidèle" }; });
/** Plan d'Opus refait SANS plaquette à vidéo (ce que le repli demande). */
const PLAN_SANS_VIDEO: PlanFacecamAnimee = { ...PLAN_OPUS, elementsV4: (PLAN_OPUS.elementsV4 ?? []).filter((e) => !A_VIDEO.has(e.id)) };
const resultatRealiser = (version: "complete" | "simple", plan = PLAN_SANS_VIDEO) => ({ plan, version, essais: 1, avertissements: [], mesures: {} as never, rendable: true, ...(version === "simple" ? { erreurs: ["D16 — encore"] } : {}) });
const etatRepli = (extra: Partial<NonNullable<EtatChaineV4["repliSansVideo"]>> = {}): EtatChaineV4 => ({
  ...base(),
  etape: "mise-en-scene",
  repliSansVideo: { retirees: retireesDe([RANGS_VIDEO[1]]), manques: ["plaquette : aucune vidéo littérale"], elementsPrecedents: PLAN_OPUS.elementsV4 ?? [], ...extra },
});

describe("R1 · règle D16 : plaquettes à vidéo interdites dans le plan du repli", () => {
  it("les identifiants viennent du catalogue (fiches à vidéos > 0), jamais en dur", () => {
    expect([...IDS_PLAQUETTES_A_VIDEO_V4].sort()).toEqual([...A_VIDEO].sort());
  });

  it("une erreur D16 par plaquette à vidéo ; aucune sans `interdites` ; D16 ne rend pas le plan irrendable", () => {
    const avec = controlerDiversiteV4(PLAN_OPUS, { mots: MOTS, interdites: IDS_PLAQUETTES_A_VIDEO_V4 });
    const d16 = avec.erreurs.filter((e) => /^D16 — /.test(e));
    expect(d16).toHaveLength(RANGS_VIDEO.length);
    expect(controlerDiversiteV4(PLAN_OPUS, { mots: MOTS }).erreurs.some((e) => /^D16 — /.test(e))).toBe(false);
    expect(estRendableV4(d16)).toBe(true);
  });
});

describe("R2 · le réalisateur en mode repli", () => {
  it("1er message : plan précédent + D16 + identifiants interdits ; 2 essais au plus, puis version simple", async () => {
    const reel = await vi.importActual<typeof import("@/moteurs/montage-facecam-animee/realisateur")>("@/moteurs/montage-facecam-animee/realisateur");
    const reponse = { cartes: [], fenetres: [], calques: [], zooms: [], motions: [], elementsV4: PLAN_OPUS.elementsV4, motsForts: [] };
    const appeler = vi.fn<(r: { message: string }) => Promise<{ ok: true; donnees: typeof reponse }>>(async () => ({ ok: true, donnees: reponse }));
    const entree = { ...entreeRealisateurV4(base()), repli: { interdites: IDS_PLAQUETTES_A_VIDEO_V4, elementsPrecedents: PLAN_OPUS.elementsV4 ?? [], erreurs: ["D16 — remplacez-la"], essaisMax: ESSAIS_REPLI_SANS_VIDEO_V4 } };
    const r = await reel.realiser(entree, { appeler: appeler as never });
    expect(appeler).toHaveBeenCalledTimes(2);
    const premier = appeler.mock.calls[0][0].message;
    expect(premier).toContain("<plan_precedent>");
    expect(premier).toContain("D16");
    for (const id of IDS_PLAQUETTES_A_VIDEO_V4) expect(premier).toContain(id);
    expect(r.version).toBe("simple");
  });
});

describe("R3 · l'étape « videos » tente le repli", () => {
  it("manque de vidéo + plan hors règles + réalisateur disponible : retour à la mise en scène, rien n'est appelé ni rendu", async () => {
    const appelerRealisateur = vi.fn();
    const { o, rendre } = outils({ videos: outilVideos([RANGS_VIDEO[1]]), appelerRealisateur });
    const apres = await avancerChaineV4(base(), o);
    expect(apres.etape).toBe("mise-en-scene");
    expect(apres.repliSansVideo?.retirees).toHaveLength(1);
    expect(apres.repliSansVideo?.fait).toBeUndefined();
    expect(appelerRealisateur).not.toHaveBeenCalled();
    expect(rendre).not.toHaveBeenCalled();
  });
});

describe("R4 · l'étape « mise-en-scene » en repli", () => {
  it("version complète : plaquettes à vidéo interdites dans l'entrée, étape « videos », repli noté fait, puis rendu sans chercher de vidéo", async () => {
    vi.mocked(realiser).mockResolvedValueOnce(resultatRealiser("complete"));
    const videos = outilVideos();
    const { o } = outils({ appelerRealisateur: vi.fn(), videos });
    const apres = await avancerChaineV4(etatRepli(), o);
    const entree = vi.mocked(realiser).mock.calls.at(-1)![0];
    expect(entree.repli?.interdites).toEqual(IDS_PLAQUETTES_A_VIDEO_V4);
    expect(entree.repli?.erreurs.length).toBeGreaterThan(0);
    expect(apres.etape).toBe("videos");
    expect(apres.repliSansVideo?.fait).toBe(true);
    expect(apres.realisation?.phrase).toMatch(/refaite sans vidéo/);
    const rendu = await avancerChaineV4(apres, o);
    expect(rendu.etape).toBe("rendu");
    const prete = await avancerChaineV4(rendu, o);
    expect(prete.etape).toBe("prete");
    expect(videos).not.toHaveBeenCalled();
  });

  it("version simple : blocage réessayable avec une phrase claire, état gardé à la mise en scène", async () => {
    vi.mocked(realiser).mockResolvedValueOnce(resultatRealiser("simple"));
    const { o } = outils({ appelerRealisateur: vi.fn() });
    const erreur = await avancerChaineV4(etatRepli(), o).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurChaineV4);
    expect(erreur.reessayable).toBe(true);
    expect(erreur.message).toMatch(/sans vidéo n'a pas passé les contrôles/);
    expect(erreur.etat.etape).toBe("mise-en-scene");
    expect(erreur.etat.repliSansVideo).toBeDefined();
  });
});

describe("R5 · un seul repli", () => {
  it("repli déjà fait puis nouveau blocage : l'erreur actuelle, pas de deuxième repli", async () => {
    const appelerRealisateur = vi.fn();
    const etat: EtatChaineV4 = { ...base(), repliSansVideo: { retirees: [], manques: [], elementsPrecedents: [], fait: true, essais: 1 } };
    const { o, rendre } = outils({ videos: outilVideos([RANGS_VIDEO[1]]), appelerRealisateur });
    const erreur = await avancerChaineV4(etat, o).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurChaineV4);
    expect(erreur.message).toMatch(/Reprendre relance la recherche/);
    expect(appelerRealisateur).not.toHaveBeenCalled();
    expect(rendre).not.toHaveBeenCalled();
  });
});

describe("R6 · la phrase d'échec ne montre jamais le texte de Claude", () => {
  const plan: PlanFacecamAnimee = { ...PLAN_OPUS, elementsV4: [{ id: "AvantApres", debut: 12.34, fin: 15, recherches: ["homme qui tape"], illustre: "notre audit Certifexemple à Villeexemple" }] };
  const realisation = { version: "complete" as const, essais: 1, avertissements: 0, plan };

  it("blocage après repli fait : nom de fiche et instant seulement", async () => {
    const etat: EtatChaineV4 = { ...base(), realisation, repliSansVideo: { retirees: [], manques: [], elementsPrecedents: [], fait: true } };
    const erreur = await avancerChaineV4(etat, outils({ appelerRealisateur: vi.fn() }).o).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurChaineV4);
    expect(erreur.message).not.toMatch(/certifexemple|villeexemple|audit/i);
    expect(erreur.message).toMatch(/Avant \/ après/);
    expect(erreur.message).toMatch(/12,3 s/);
  });

  it("repli raté : même règle pour la phrase du repli", async () => {
    vi.mocked(realiser).mockResolvedValueOnce(resultatRealiser("simple"));
    const etat = etatRepli({ retirees: [{ rang: 0, id: "AvantApres", debut: 12.34, fin: 15, raison: "x" }] });
    const erreur = await avancerChaineV4({ ...etat, realisation }, outils({ appelerRealisateur: vi.fn() }).o).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurChaineV4);
    expect(erreur.message).not.toMatch(/certifexemple|villeexemple|audit/i);
    expect(erreur.message).toMatch(/Avant \/ après/);
    expect(erreur.message).toMatch(/12,3 s/);
  });
});

describe("R7 · coût honnête du repli", () => {
  it("le pire cas compte les essais du repli en plus des 3 essais normaux ; essaisMax reste 3", () => {
    const e = estimerOpusV4({ dureeSec: 60, plafondUsd: 4 });
    expect(e.essaisRepliMax).toBe(ESSAIS_REPLI_SANS_VIDEO_V4);
    expect(e.essaisRepliMax).toBe(2);
    expect(e.essaisMax).toBe(3);
    // pireCas = premier + (3 - 1 + repli) × suivant, avec `suivant` chiffré à part (plan refusé et 20 erreurs renvoyés).
    const d = { dureeSec: 60, plafondUsd: 4 };
    const suivant = coutEssaiSuivantV4(d);
    expect(e.pireCasUsd).toBeCloseTo(e.unEssaiUsd + (ESSAIS_MAX_REALISATEUR - 1 + ESSAIS_REPLI_SANS_VIDEO_V4) * suivant, 9);
    expect(e.pireCasUsd - e.unEssaiUsd).toBeGreaterThan(2 * suivant);
  });
});

describe("Repli · cas particuliers", () => {
  it("plafond Claude atteint pendant le repli : phrase dédiée, pas « n'a pas passé les contrôles »", async () => {
    vi.mocked(realiser).mockImplementationOnce(async (entree, dep) => (await vi.importActual<typeof import("@/moteurs/montage-facecam-animee/realisateur")>("@/moteurs/montage-facecam-animee/realisateur")).realiser(entree, dep));
    const erreur = await avancerChaineV4(etatRepli(), outils({ appelerRealisateur: vi.fn(), plafondClaudeAtteint: async () => true }).o).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurChaineV4);
    expect(erreur.message).toMatch(/plafond Claude/i);
    expect(erreur.message).not.toMatch(/pas passé les contrôles/);
    expect(erreur.etat.etape).toBe("mise-en-scene");
  });

  it("Claude en panne pendant le repli : « Claude est indisponible »", async () => {
    vi.mocked(realiser).mockImplementationOnce(async (entree, dep) => (await vi.importActual<typeof import("@/moteurs/montage-facecam-animee/realisateur")>("@/moteurs/montage-facecam-animee/realisateur")).realiser(entree, dep));
    const appelerRealisateur = vi.fn(async () => ({ ok: false as const, message: "panne" }));
    const erreur = await avancerChaineV4(etatRepli(), outils({ appelerRealisateur }).o).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurChaineV4);
    expect(erreur.message).toMatch(/Claude est indisponible/);
  });

  it("état abîmé (repli non fait, plan d'Opus perdu) : la phrase du repli, pas une mise en scène ordinaire", async () => {
    const etat: EtatChaineV4 = { ...etatRepli(), realisation: undefined };
    const erreur = await avancerChaineV4(etat, outils({ appelerRealisateur: vi.fn() }).o).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurChaineV4);
    expect(erreur.message).toMatch(/sans vidéo n'a pas passé les contrôles/);
  });

  it("repli réussi : essais additionnés, et Will est prévenu par une alerte « info »", async () => {
    vi.mocked(realiser).mockResolvedValueOnce({ ...resultatRealiser("complete"), essais: 2 });
    const { o } = outils({ appelerRealisateur: vi.fn() });
    let etat = await avancerChaineV4({ ...etatRepli(), realisation: { version: "complete", essais: 1, avertissements: 0, plan: PLAN_OPUS } }, o);
    expect(etat.realisation?.essais).toBe(3);
    etat = await avancerChaineV4(await avancerChaineV4(etat, o), o);
    etat = { ...etat, rendu: { cle: "c.mp4", vignetteCle: "c.jpg", dureeSec: 10, taille: 1 } };
    const res = resultatV4(etat);
    expect(res.noteQualite.alertes.some((a) => a.gravite === "info" && /sans vidéo/.test(a.message))).toBe(true);
    expect(res.projetMontage).toMatchObject({ essaisClaude: 3 });
  });
});
