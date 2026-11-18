/**
 * BR-TELEPHONE-c (18/11/2026) : la chaîne v4 et les contrôles du réalisateur connaissent le téléphone qui joue un extrait.
 * Preuve PAR LE CHEMIN RÉEL : on part de l'étape « mise-en-scene » ; la VRAIE `realiser` et le VRAI `verifierPlan` jugent le plan ; seuls
 * factices : l'appel à Claude (renvoie un plan écrit ici et capte les requêtes), `outils.videos`, `outils.rendre`, les ports de plafond / historique.
 * Aucun appel réseau, aucun euro. Réglage absent = identique (empreinte figée calculée sur master AVANT le changement).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { avancerChaineV4, ErreurChaineV4, etatInitialV4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import type { MotTranscrit, RequeteRealisateur } from "@/moteurs/montage-facecam-animee/realisateur";
import { controlerDiversiteV4, estRendableV4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";
import { plaquettesSansVideo, retirerPlaquettesSansVideo } from "@/moteurs/montage-facecam-animee/videos-v4";
import { erreurRepliTelephone, erreursRepliOuvertesV4, retirerSansVideoOuvertV4, telephonesSansMediaV4 } from "@/moteurs/montage-facecam-animee/repli-telephone-video";
import { erreursRepliV4 } from "@/moteurs/montage-facecam-animee/repli-sans-video-v4";

const RACINE = join(__dirname, "..", "..");
const REPETITION = join(RACINE, "docs/facecam-animee-v4/repetition-generale");
const TRANS = JSON.parse(readFileSync(join(REPETITION, "transcription.json"), "utf8")) as { dureeMonteeSec: number; gardes: { debutSec: number; finSec: number }[]; motsMontesTexteValide: MotTranscrit[] };
const PLAN_VALIDE = JSON.parse(readFileSync(join(REPETITION, "plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const TEL = "telephone-video";
const A_VIDEO = new Set(["AvantApres", "MosaiqueVideos", "duel-video"]);
const motsForts = [...new Set(PLAN_VALIDE.groupes.flatMap((g) => g.mots.filter((m) => m.fort).map((m) => m.w.replace(/[.,;:!?…«»"“”()]/g, ""))))];

/** Le plan de la répétition, comme l'écrit Opus : `recherches` sans `medias` pour les plaquettes de banque. */
const ELEMENTS_BANQUE: ElementV4Plan[] = (PLAN_VALIDE.elementsV4 ?? []).map((e) => {
  const copie = { ...e };
  if (A_VIDEO.has(e.id)) delete copie.medias;
  return copie;
});
const RANGS_BANQUE = ELEMENTS_BANQUE.flatMap((e, i) => (A_VIDEO.has(e.id) ? [i] : []));

const reponseDe = (elementsV4: ElementV4Plan[]) => ({ ok: true as const, donnees: { cartes: [], fenetres: [], calques: [], zooms: [], motions: [], elementsV4, motsForts } });

/** Faux Claude : rend les plans de `plans` dans l'ordre (le dernier se répète) et capte chaque requête. */
function realisateurFaux(plans: ElementV4Plan[][]) {
  const requetes: RequeteRealisateur[] = [];
  let n = 0;
  const appeler = async (r: RequeteRealisateur) => {
    requetes.push(r);
    return reponseDe(plans[Math.min(n++, plans.length - 1)]);
  };
  return { requetes, appeler };
}

type EntreeVideos = Parameters<NonNullable<OutilsChaineV4["videos"]>>[0];
const idsAvecVideo = (ids: ReadonlySet<string>, sauf: number[]) =>
  vi.fn(async (d: EntreeVideos) => {
    const fichiers: { nom: string; cle: string }[] = [];
    const elementsV4 = (d.plan.elementsV4 ?? []).map((e, i) => {
      if (!ids.has(e.id) || sauf.includes(i) || !e.recherches?.length) return e;
      const medias = e.recherches.map((_, k) => {
        const nom = `v4-${i}-${k}.mp4`;
        fichiers.push({ nom, cle: `studio/dev/facecam-animee/${d.videoId}/videos/${nom}` });
        return `broll/${nom}`;
      });
      return { ...e, medias };
    });
    return { plan: { ...d.plan, elementsV4 }, fichiers, manques: sauf.map((i) => `plaquette ${i} : aucun extrait`), depenseUsd: 0 };
  });

const etatMiseEnScene = (): EtatChaineV4 => ({
  ...etatInitialV4({ videoId: "v-1", versionId: "ver-1", priseCle: "k.mov" }),
  etape: "mise-en-scene",
  coupes: { gardes: TRANS.gardes, dureeSec: TRANS.dureeMonteeSec, mots: TRANS.motsMontesTexteValide },
});

function outilsChaine(faux: ReturnType<typeof realisateurFaux>, videos: ReturnType<typeof idsAvecVideo> | undefined, extra: Partial<OutilsChaineV4> = {}) {
  const rendre = vi.fn(async (d: Parameters<OutilsChaineV4["rendre"]>[0]) => ({ cle: "c.mp4", vignetteCle: "c.jpg", dureeSec: d.plan.duree, taille: 1 }));
  const o = { transcrire: vi.fn(), plafondClaudeAtteint: async () => false, historique: async () => [], appelerRealisateur: faux.appeler, ...(videos ? { videos } : {}), rendre, ...extra } as unknown as OutilsChaineV4;
  return { o, rendre };
}

/** Fait avancer la VRAIE chaîne depuis l'état donné jusqu'à « prete » (ou jusqu'à la première erreur, rendue). */
async function jusquAuBout(etat: EtatChaineV4, o: OutilsChaineV4): Promise<{ etats: EtatChaineV4[]; erreur: ErreurChaineV4 | null }> {
  const etats: EtatChaineV4[] = [etat];
  for (let i = 0; i < 8 && etats[etats.length - 1].etape !== "prete"; i++) {
    try {
      etats.push(await avancerChaineV4(etats[etats.length - 1], o));
    } catch (e) {
      if (e instanceof ErreurChaineV4) return { etats, erreur: e };
      throw e;
    }
  }
  return { etats, erreur: null };
}

// ---- Plan « au téléphone » : le SEUL élément à vidéo est le téléphone (à la place de la 1re mosaïque) ----
const RANG_TEL = RANGS_BANQUE[0];
const TELEPHONE: ElementV4Plan = { id: TEL, debut: ELEMENTS_BANQUE[RANG_TEL].debut, fin: ELEMENTS_BANQUE[RANG_TEL].fin, recherches: ["axion:devis signature"], illustre: "les devis signés" };
/** Les deux autres plaquettes de banque sont remplacées, à leur instant, par des plaquettes sans vidéo qui montrent les mêmes mots dits. */
const SANS_VIDEO: Record<string, (e: ElementV4Plan) => ElementV4Plan> = {
  "duel-video": (e) => ({ id: "MotSaute", debut: e.debut, fin: Math.round((e.fin - 0.1) * 100) / 100, mots: ["OUTIL", "EMBAUCHE"], illustre: "un outil de plus, une embauche de plus" }),
  MosaiqueVideos: (e) => ({ id: "CarteCalendrier", debut: e.debut, fin: e.fin, mots: ["NOTRE ÉQUIPE"], instants: [49.6, 50.8], illustre: "en visio avec notre équipe" }),
};
const ELEMENTS_TEL: ElementV4Plan[] = ELEMENTS_BANQUE.map((e, i) => (i === RANG_TEL ? TELEPHONE : SANS_VIDEO[e.id]?.(e) ?? e));
const EMPREINTE_ETEINT_A2 = "b705ffc1c0feb9a452e9aafbae00e8f6c27d8fdcea32a0e1b6e33fa5d675ea7b";
const D0_TEL = "« telephone-video » n'existe pas dans le catalogue v4";
const TEL_RAISON = /^aucun extrait des vidéos de Will trouvé pour « telephone-video »/;
const ALLUME = { telephoneVideo: true } as const;

/** 2e plan d'Opus après le repli : le téléphone est remplacé, à son instant, par une plaquette sans vidéo qui montre les mêmes mots. */
const ELEMENTS_REPLI: ElementV4Plan[] = ELEMENTS_TEL.map((e) => (e.id === TEL ? { id: "CarteCalendrier", debut: e.debut, fin: e.fin, mots: ["À LA MAIN"], instants: [8.6, 9.4], illustre: "les devis, les relances à la main, les chiffres" } : e));
/** Plan (d) : le téléphone ET une mosaïque de banque (rang 23 de la répétition). */
const ELEMENTS_TEL_ET_MOSAIQUE: ElementV4Plan[] = ELEMENTS_TEL.map((e, i) => (i === RANGS_BANQUE[2] ? ELEMENTS_BANQUE[i] : e));

describe("BR-TELEPHONE-c (a) éteint = identique", () => {
  const plan = { elementsV4: [TELEPHONE, ELEMENTS_BANQUE[RANGS_BANQUE[0]], ELEMENTS_BANQUE[0]] };

  it("(a1) réglage absent, false, « true », 1, null : les 3 fonctions rendent exactement la sortie des anciennes", () => {
    for (const opt of [undefined, {}, { telephoneVideo: false }, { telephoneVideo: "true" }, { telephoneVideo: 1 }, { telephoneVideo: null }]) {
      expect(telephonesSansMediaV4(plan, opt)).toEqual([]);
      const nouveau = retirerSansVideoOuvertV4(plan, opt);
      expect(nouveau).toEqual(retirerPlaquettesSansVideo(plan));
      expect(nouveau.retirees.map((r) => r.id)).toEqual(["MosaiqueVideos"]);
      expect(nouveau.plan.elementsV4?.some((e) => e.id === TEL)).toBe(true);
      expect(erreursRepliOuvertesV4(plan, nouveau.retirees, opt)).toEqual(erreursRepliV4(plan, nouveau.retirees));
    }
    const rien = { elementsV4: [ELEMENTS_BANQUE[0]] };
    expect(retirerSansVideoOuvertV4(rien, { telephoneVideo: "oui" }).plan).toBe(rien);
    expect(retirerSansVideoOuvertV4(rien, ALLUME).plan).toBe(rien);
  });

  it("(a1 bis) allumé : seul un téléphone SANS extrait (aucune clé non vide) est compté, retiré, et a sa consigne", () => {
    const servi = { ...TELEPHONE, medias: ["broll/v4-0-0.mp4"] };
    const vide = { ...TELEPHONE, debut: 20, fin: 22, medias: ["", "  "] };
    const p = { elementsV4: [servi, ELEMENTS_BANQUE[0], vide, TELEPHONE] };
    expect(telephonesSansMediaV4(p, ALLUME)).toEqual([2, 3]);
    expect(telephonesSansMediaV4({ elementsV4: [servi] }, ALLUME)).toEqual([]);
    const r = retirerSansVideoOuvertV4(p, ALLUME);
    expect(r.retirees.map((x) => x.rang)).toEqual([2, 3]);
    expect(r.retirees[0].raison).toMatch(TEL_RAISON);
    expect(r.plan.elementsV4).toEqual([servi, ELEMENTS_BANQUE[0]]);
    expect(p.elementsV4).toHaveLength(4); // le plan reçu n'est pas modifié
    expect(erreursRepliOuvertesV4(p, r.retirees, ALLUME)).toEqual([erreurRepliTelephone(2, 20), erreurRepliTelephone(3, TELEPHONE.debut)]);
  });

  it("(a2) chaîne de bout en bout, plaquettes de banque, réglage absent : appels, rendu et requêtes = empreinte figée sur master", async () => {
    const faux = realisateurFaux([ELEMENTS_BANQUE]);
    const videos = idsAvecVideo(A_VIDEO, []);
    const { o, rendre } = outilsChaine(faux, videos);
    const r = await jusquAuBout(etatMiseEnScene(), o);
    expect(r.erreur).toBeNull();
    expect(r.etats.map((e) => e.etape)).toEqual(["mise-en-scene", "videos", "rendu", "prete"]);
    const empreinte = sha(JSON.stringify({ appelsVideos: videos.mock.calls.length, videos: videos.mock.calls.map((c) => c[0]), rendre: rendre.mock.calls.map((c) => c[0]), requetes: faux.requetes }));
    expect(empreinte).toBe(EMPREINTE_ETEINT_A2);
  });

  it("(a3) « plan au téléphone », réglage absent : le plan est refusé par D0 comme aujourd'hui et la requête de correction le dit", async () => {
    const faux = realisateurFaux([ELEMENTS_TEL]);
    const videos = idsAvecVideo(new Set([TEL]), []);
    const { o } = outilsChaine(faux, videos);
    await jusquAuBout(etatMiseEnScene(), o);
    expect(faux.requetes.length).toBeGreaterThanOrEqual(2);
    expect(faux.requetes[1].message).toContain(D0_TEL);
    expect(controlerDiversiteV4({ ...PLAN_VALIDE, elementsV4: ELEMENTS_TEL }, { mots: TRANS.motsMontesTexteValide }).erreurs.some((e) => e.includes(D0_TEL))).toBe(true);
  });
});

describe("BR-TELEPHONE-c : allumé, par le vrai chemin", () => {
  it("le plan au téléphone passe le VRAI verifierPlan avec l'option (aucune erreur bloquante) et pas sans elle", () => {
    const mots = TRANS.motsMontesTexteValide;
    expect(estRendableV4(controlerDiversiteV4({ ...PLAN_VALIDE, elementsV4: ELEMENTS_TEL }, { mots, ...ALLUME }).erreurs)).toBe(true);
    expect(estRendableV4(controlerDiversiteV4({ ...PLAN_VALIDE, elementsV4: ELEMENTS_TEL }, { mots }).erreurs)).toBe(false);
    expect(ELEMENTS_TEL.filter((e) => (e.recherches?.length ?? 0) > 0).map((e) => e.id)).toEqual([TEL]); // le SEUL élément à vidéo
  });

  it("(b) téléphone servi : « videos » appelé 1 fois avec le téléphone, le rendu reçoit l'extrait ET la media dans le plan", async () => {
    const faux = realisateurFaux([ELEMENTS_TEL]);
    const videos = idsAvecVideo(new Set([TEL]), []);
    const { o, rendre } = outilsChaine(faux, videos, ALLUME);
    const r = await jusquAuBout(etatMiseEnScene(), o);
    expect(r.erreur).toBeNull();
    expect(r.etats.map((e) => e.etape)).toEqual(["mise-en-scene", "videos", "rendu", "prete"]);
    // la mise en scène : vraie `realiser`, vrai `verifierPlan` : plan complet, aucune erreur D0
    expect(r.etats[1].realisation?.version).toBe("complete");
    expect((r.etats[1].realisation?.erreurs ?? []).filter((e) => e.startsWith("D0"))).toEqual([]);
    expect(faux.requetes.some((q) => q.message.includes(D0_TEL))).toBe(false);
    // R1 : l'outil « videos » est appelé, avec le téléphone dans le plan (0 appel sur master)
    expect(videos).toHaveBeenCalledTimes(1);
    expect(videos.mock.calls[0][0].plan.elementsV4?.some((e) => e.id === TEL)).toBe(true);
    // le rendu reçoit l'extrait ET le plan avec sa media
    expect(rendre).toHaveBeenCalledTimes(1);
    const arg = rendre.mock.calls[0][0];
    const tel = arg.plan.elementsV4?.find((e) => e.id === TEL);
    expect(tel?.medias).toEqual([`broll/v4-${RANG_TEL}-0.mp4`]);
    expect(arg.videos?.map((f) => f.nom)).toEqual([`v4-${RANG_TEL}-0.mp4`]);
    expect(telephonesSansMediaV4(arg.plan, ALLUME)).toEqual([]);
    expect(r.etats[2].videos?.retirees).toEqual([]);
  });

  it("(c) sans extrait : le téléphone est retiré avec sa raison, le contrôle ne contient aucun D0 du téléphone, Opus refait la mise en scène sans lui", async () => {
    const faux = realisateurFaux([ELEMENTS_TEL, ELEMENTS_TEL, ELEMENTS_REPLI]);
    const videos = idsAvecVideo(new Set([TEL]), [RANG_TEL]); // la recherche ne trouve rien pour le téléphone
    const { o, rendre } = outilsChaine(faux, videos, ALLUME);
    const etat1 = await avancerChaineV4(etatMiseEnScene(), o);
    expect(etat1.etape).toBe("videos");
    const etat2 = await avancerChaineV4(etat1, o);
    expect(videos).toHaveBeenCalledTimes(1);
    // retiré, raison dite, jamais rendu, jamais de D0 du téléphone
    expect(etat2.videos?.retirees.map((x) => x.id)).toEqual([TEL]);
    expect(etat2.videos?.retirees[0].raison).toMatch(TEL_RAISON);
    expect(etat2.videos?.manques).toHaveLength(1);
    expect((etat2.videos?.controle?.erreurs ?? []).some((e) => e.includes("telephone-video"))).toBe(false);
    // CAS PRIS : sans le téléphone, Will reste seul 2,3 s (H2a) : H1/H2 cassent, retour à la mise en scène, une seule fois
    expect(etat2.videos?.controle?.rendable).toBe(false);
    expect(etat2.etape).toBe("mise-en-scene");
    expect(etat2.repliSansVideo?.retirees.map((x) => x.id)).toEqual([TEL]);
    const avant = faux.requetes.length;
    const fin = await jusquAuBout(etat2, o);
    expect(fin.erreur).toBeNull();
    const requeteRepli = faux.requetes[avant];
    expect(requeteRepli.message).toContain("Plaquettes INTERDITES dans ce plan (aucune vidéo fidèle n'a été trouvée) :");
    expect(requeteRepli.message).toMatch(/INTERDITES[^\n]*telephone-video/);
    expect(requeteRepli.message).toContain(erreurRepliTelephone(RANG_TEL, TELEPHONE.debut));
    // le 2e plan (sans téléphone) va jusqu'au rendu : ni téléphone, ni « broll/ » sans nom
    expect(fin.etats[fin.etats.length - 1].etape).toBe("prete");
    expect(rendre).toHaveBeenCalledTimes(1);
    const arg = rendre.mock.calls[0][0];
    expect(arg.plan.elementsV4?.some((e) => e.id === TEL)).toBe(false);
    expect(arg.plan.elementsV4?.flatMap((e) => e.medias ?? []).filter((m) => !/^broll\/.+/.test(m))).toEqual([]);
    expect(plaquettesSansVideo(arg.plan)).toEqual([]);
    // le repli n'a lieu qu'une fois : au plus 2 essais d'Opus, aucun appel de banque de plus
    expect(videos).toHaveBeenCalledTimes(1);
  });

  it("(c bis) sans extrait et sans outil « videos » : même retrait, le téléphone n'est jamais rendu sans media", async () => {
    const faux = realisateurFaux([ELEMENTS_TEL, ELEMENTS_TEL, ELEMENTS_REPLI]);
    const { o, rendre } = outilsChaine(faux, undefined, ALLUME);
    const etat1 = await avancerChaineV4(etatMiseEnScene(), o);
    const etat2 = await avancerChaineV4(etat1, o);
    expect(etat2.videos?.retirees.map((x) => x.id)).toEqual([TEL]);
    expect(etat2.etape).toBe("mise-en-scene");
    const fin = await jusquAuBout(etat2, o);
    expect(fin.erreur).toBeNull();
    expect(rendre.mock.calls[0][0].plan.elementsV4?.some((e) => e.id === TEL)).toBe(false);
  });

  it("un travail déjà à « rendu » avec un téléphone sans media revient à « videos » (allumé) ; éteint, rien ne change", async () => {
    const etat: EtatChaineV4 = { ...etatMiseEnScene(), etape: "rendu", realisation: { version: "complete", essais: 1, avertissements: 0, plan: { ...PLAN_VALIDE, elementsV4: ELEMENTS_TEL } } };
    const allume = outilsChaine(realisateurFaux([ELEMENTS_TEL]), idsAvecVideo(new Set([TEL]), []), ALLUME);
    expect((await avancerChaineV4(etat, allume.o)).etape).toBe("videos");
    expect(allume.rendre).not.toHaveBeenCalled();
    const eteint = outilsChaine(realisateurFaux([ELEMENTS_TEL]), idsAvecVideo(new Set([TEL]), []));
    expect((await avancerChaineV4(etat, eteint.o)).etape).not.toBe("videos");
  });

  it("(d) contrôle après retrait : téléphone servi + mosaïque sans vidéo → aucune erreur « telephone-video n'existe pas »", async () => {
    const faux = realisateurFaux([ELEMENTS_TEL_ET_MOSAIQUE]);
    const videos = idsAvecVideo(new Set([TEL]), []); // sert le téléphone ; la mosaïque n'est pas dans l'ensemble : sans medias
    const { o } = outilsChaine(faux, videos, ALLUME);
    const etat1 = await avancerChaineV4(etatMiseEnScene(), o);
    expect(etat1.realisation?.version).toBe("complete");
    const etat2 = await avancerChaineV4(etat1, o);
    expect(etat2.videos?.retirees.map((x) => x.id)).toEqual(["MosaiqueVideos"]);
    expect(etat2.videos?.controle).toBeDefined();
    expect((etat2.videos?.controle?.erreurs ?? []).some((e) => e.includes(D0_TEL))).toBe(false);
    // le contrôle a bien jugé le plan AVEC le téléphone : il ne reste que la mosaïque retirée (Will seul à son instant), le téléphone servi est gardé
    expect((etat2.videos?.controle?.erreurs ?? []).some((e) => /^H2a — .*49,20 s/.test(e))).toBe(true);
    expect(etat2.videos?.retirees.every((x) => x.id !== TEL)).toBe(true);
    expect(etat2.videos?.fichiers.map((f) => f.nom)).toEqual([`v4-${RANG_TEL}-0.mp4`]);
  });
});
