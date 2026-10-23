/**
 * FACE CAMÉRA ANIMÉE v4 — étape « videos » de la chaîne (18/10/2026, vidéo v-60359dd080b1).
 * Le rendu ne reçoit JAMAIS une plaquette à vidéo sans `medias` : l'étape « videos » (entre la mise en scène et le rendu) remplit
 * les `medias` par l'outil du studio ; ce qui reste sans vidéo est retiré du plan (décision de Will du 18/10).
 * Aucun appel réseau : outils doubles.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ElementV4Plan, PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { creerMoteurMontageFacecamAnimee } from "@/moteurs/montage-facecam-animee";
import { avancerChaineV4, ErreurChaineV4, ETAPES_CHAINE_V4, etatInitialV4, lireEtatV4, type EtatChaineV4, type OutilsChaineV4 } from "@/moteurs/montage-facecam-animee/chaine-v4";
import type { MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur";
import { controlerDiversiteV4, estRendableV4 } from "@/moteurs/montage-facecam-animee/realisateur/regles-v4";
import { plaquettesSansVideo, retirerPlaquettesSansVideo } from "@/moteurs/montage-facecam-animee/videos-v4";


const RACINE = join(__dirname, "..", "..");
const REPETITION = join(RACINE, "docs/facecam-animee-v4/repetition-generale");
const TRANS = JSON.parse(readFileSync(join(REPETITION, "transcription.json"), "utf8")) as { dureeMonteeSec: number; gardes: { debutSec: number; finSec: number }[]; motsMontesTexteValide: MotTranscrit[] };
const PLAN_VALIDE = JSON.parse(readFileSync(join(REPETITION, "plan-realisateur.json"), "utf8")) as PlanFacecamAnimee;

const A_VIDEO = new Set(["AvantApres", "MosaiqueVideos", "duel-video"]);
/** Le plan de la répétition, comme l'écrit Opus : `recherches` sans `medias`. */
const sansMedias = (els: readonly ElementV4Plan[]): ElementV4Plan[] =>
  els.map((e) => {
    if (!A_VIDEO.has(e.id)) return { ...e };
    const copie = { ...e };
    delete copie.medias;
    return copie;
  });
const PLAN_OPUS: PlanFacecamAnimee = { ...PLAN_VALIDE, elementsV4: sansMedias(PLAN_VALIDE.elementsV4 ?? []) };
const RANGS_VIDEO = (PLAN_OPUS.elementsV4 ?? []).flatMap((e, i) => (A_VIDEO.has(e.id) ? [i] : []));

const base = (): EtatChaineV4 => ({
  ...etatInitialV4({ videoId: "v-1", versionId: "ver-1", priseCle: "k.mov" }),
  etape: "videos",
  coupes: { gardes: TRANS.gardes, dureeSec: TRANS.dureeMonteeSec, mots: TRANS.motsMontesTexteValide },
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

describe("chaîne v4 · étape « videos »", () => {
  it("« videos » existe, entre la mise en scène et le rendu, sans rien renommer", () => {
    expect(ETAPES_CHAINE_V4).toEqual(["transcription", "coupes", "mise-en-scene", "videos", "rendu", "prete"]);
  });

  it("le plan d'Opus (recherches sans medias) a bien des plaquettes sans vidéo : le cas du plantage de v-60359dd080b1", () => {
    expect(RANGS_VIDEO.length).toBeGreaterThanOrEqual(2);
    expect(plaquettesSansVideo(PLAN_OPUS)).toEqual(RANGS_VIDEO);
  });

  it("la mise en scène mène à « videos », pas au rendu", async () => {
    const etat: EtatChaineV4 = { ...base(), etape: "mise-en-scene", realisation: undefined };
    const motsForts = [...new Set(PLAN_VALIDE.groupes.flatMap((g) => g.mots.filter((m) => m.fort).map((m) => m.w.replace(/[.,;:!?…«»"“”()]/g, ""))))];
    const reponse = { cartes: [], fenetres: [], calques: [], zooms: [], motions: [], elementsV4: PLAN_OPUS.elementsV4, motsForts };
    const { o } = outils({ appelerRealisateur: async () => ({ ok: true, donnees: reponse }) });
    const apres = await avancerChaineV4(etat, o);
    expect(apres.etape).toBe("videos");
    expect(apres.realisation?.plan.elementsV4).toHaveLength(PLAN_OPUS.elementsV4!.length);
  });

  it("l'outil remplit les medias : toutes les plaquettes gardées, les fichiers notés dans l'état, puis le rendu", async () => {
    const videos = outilVideos();
    const { o, rendre } = outils({ videos });
    const apres = await avancerChaineV4(base(), o);
    expect(videos).toHaveBeenCalledTimes(1);
    expect(videos.mock.calls[0][0]).toMatchObject({ videoId: "v-1" });
    expect(videos.mock.calls[0][0].mots.length).toBeGreaterThan(10);
    expect(apres.etape).toBe("rendu");
    expect(plaquettesSansVideo(apres.realisation!.plan)).toEqual([]);
    expect(apres.realisation!.plan.elementsV4).toHaveLength(PLAN_OPUS.elementsV4!.length);
    expect(apres.videos?.retirees).toEqual([]);
    expect(apres.videos?.fichiers.length).toBeGreaterThan(0);
    expect(apres.videos?.depenseUsd).toBe(0.12);
    const fini = await avancerChaineV4(apres, o);
    expect(fini.etape).toBe("prete");
    expect(rendre).toHaveBeenCalledTimes(1);
    // les fichiers préparés sont transmis au rendu pour être envoyés au service
    expect(rendre.mock.calls[0][0].videos?.length).toBe(apres.videos!.fichiers.length);
  });

  it("une plaquette sans vidéo littérale est retirée, jamais remplacée : ici le plan hors règles est donc bloqué, avec le retrait noté pour diagnostic", async () => {
    const { o, rendre } = outils({ videos: outilVideos([RANGS_VIDEO[1]]) });
    const erreur = await avancerChaineV4(base(), o).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurChaineV4);
    expect(erreur.etat.videos.retirees).toHaveLength(1);
    expect(erreur.etat.videos.retirees[0]).toMatchObject({ rang: RANGS_VIDEO[1], id: PLAN_OPUS.elementsV4![RANGS_VIDEO[1]].id });
    expect(erreur.etat.videos.manques).toHaveLength(1);
    expect(erreur.etat.videos.controle.erreurs.length).toBeGreaterThan(0);
    expect(rendre).not.toHaveBeenCalled();
  });

  it("sans outil « videos » : les plaquettes à vidéo sont retirées et, ici, le plan hors règles est bloqué ; rien n'est rendu sans media", async () => {
    const { o, rendre } = outils();
    const erreur = await avancerChaineV4(base(), o).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurChaineV4);
    expect(erreur.etat.videos.retirees.map((r: { rang: number }) => r.rang)).toEqual(RANGS_VIDEO);
    expect(rendre).not.toHaveBeenCalled();
  });

  it("un travail déjà à « rendu » avec un AvantApres sans medias revient à « videos » : rien n'est rendu", async () => {
    const etat: EtatChaineV4 = { ...base(), etape: "rendu" };
    const { o, rendre } = outils({ videos: outilVideos() });
    const apres = await avancerChaineV4(etat, o);
    expect(apres.etape).toBe("videos");
    expect(rendre).not.toHaveBeenCalled();
  });

  it("un plan sans plaquette à vidéo traverse « videos » sans appeler l'outil", async () => {
    const plan: PlanFacecamAnimee = { ...PLAN_OPUS, elementsV4: (PLAN_OPUS.elementsV4 ?? []).filter((e) => !A_VIDEO.has(e.id)) };
    const videos = outilVideos();
    const { o } = outils({ videos });
    const apres = await avancerChaineV4({ ...base(), realisation: { version: "complete", essais: 1, avertissements: 0, plan } }, o);
    expect(videos).not.toHaveBeenCalled();
    expect(apres.etape).toBe("rendu");
    expect(apres.videos?.retirees).toEqual([]);
  });

  it("un ancien état sérialisé (étape « rendu », sans champ videos) se relit toujours", () => {
    const ancien = JSON.parse(JSON.stringify({ ...base(), etape: "rendu" })) as unknown;
    expect(lireEtatV4(ancien)?.etape).toBe("rendu");
    expect(lireEtatV4(JSON.parse(JSON.stringify(base())))?.etape).toBe("videos");
    expect(lireEtatV4({ ...base(), etape: "inconnue" })).toBeNull();
  });

  it("H1/H2 sont BLOQUANTS : un plan hors règles après retrait n'est pas rendu, erreur réessayable en français, état gardé pour diagnostic", async () => {
    const apresRetrait = retirerPlaquettesSansVideo(PLAN_OPUS).plan;
    const hors = !estRendableV4(controlerDiversiteV4(apresRetrait, { mots: TRANS.motsMontesTexteValide }).erreurs);
    expect(hors).toBe(true); // le cas du test : sans les mosaïques et le duel, Will reste seul trop longtemps
    const { o, rendre } = outils();
    const erreur = await avancerChaineV4(base(), o).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurChaineV4);
    expect(erreur.reessayable).toBe(true);
    expect(erreur.message).toMatch(/Je n'ai pas trouvé de vidéo fidèle/);
    expect(erreur.message).toMatch(/Reprendre relance la recherche/);
    expect(rendre).not.toHaveBeenCalled();
    // l'état à sauvegarder garde le plan d'origine (la reprise relance la recherche) et le diagnostic
    expect(erreur.etat?.etape).toBe("videos");
    expect(plaquettesSansVideo(erreur.etat!.realisation!.plan)).toEqual(RANGS_VIDEO);
    expect(erreur.etat?.videos?.retirees.map((r: { rang: number }) => r.rang)).toEqual(RANGS_VIDEO);
    expect(erreur.etat?.videos?.controle?.rendable).toBe(false);
  });

  it("un plan qui n'aurait plus aucune plaquette n'est pas rendu non plus", async () => {
    const plan: PlanFacecamAnimee = { ...PLAN_OPUS, elementsV4: [{ id: "AvantApres", debut: 5, fin: 7.5, recherches: ["homme qui tape"] }] };
    const { o, rendre } = outils();
    const erreur = await avancerChaineV4({ ...base(), realisation: { version: "complete", essais: 1, avertissements: 0, plan } }, o).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurChaineV4);
    expect(erreur.reessayable).toBe(true);
    expect(rendre).not.toHaveBeenCalled();
  });

  it("plan à moitié rempli (reprise) : les fichiers déjà prêts sont fusionnés avec ceux de l'outil, sans doublon de nom", async () => {
    const premier = RANGS_VIDEO[0];
    const deja = PLAN_OPUS.elementsV4![premier];
    const nomsDeja = (deja.recherches ?? []).map((_, k) => `v4-${premier}-${k}.mp4`);
    const elementsV4 = PLAN_OPUS.elementsV4!.map((e, i) => (i === premier ? { ...e, medias: nomsDeja.map((n) => `broll/${n}`) } : e));
    const etat = base();
    etat.realisation = { version: "complete", essais: 1, avertissements: 0, plan: { ...PLAN_OPUS, elementsV4 } };
    etat.videos = { fichiers: [...nomsDeja.map((nom) => ({ nom, cle: `ancien/${nom}` })), { nom: "v4-9-9.mp4", cle: "ancien/v4-9-9.mp4" }], retirees: [], manques: [] };
    // l'outil ne remplit que ce qui manque (comme le vrai) et renvoie SEULEMENT ses fichiers
    const videos = vi.fn(async (d: EntreeVideos) => {
      const fichiers: { nom: string; cle: string }[] = [];
      const els = (d.plan.elementsV4 ?? []).map((e, i) => {
        if (!A_VIDEO.has(e.id) || (e.medias ?? []).length) return e;
        const medias = (e.recherches ?? []).map((_, k) => {
          fichiers.push({ nom: `v4-${i}-${k}.mp4`, cle: `neuf/v4-${i}-${k}.mp4` });
          return `broll/v4-${i}-${k}.mp4`;
        });
        return { ...e, medias };
      });
      return { plan: { ...d.plan, elementsV4: els }, fichiers, manques: [] };
    });
    // un 2e duel déjà complet n'existe pas : seul le 1er est à moitié rempli, les autres sont cherchés
    const { o } = outils({ videos });
    const apres = await avancerChaineV4(etat, o);
    const noms = (apres.videos?.fichiers ?? []).map((f) => f.nom);
    expect(new Set(noms).size).toBe(noms.length);
    for (const n of nomsDeja) expect(noms).toContain(n);
    expect(noms).not.toContain("v4-9-9.mp4"); // inutilisé par le plan : écarté
    expect(plaquettesSansVideo(apres.realisation!.plan)).toEqual([]);
  });

  it("le moteur garde l'état de diagnostic dans le travail quand l'étape est bloquée (échec réessayable, phrase pour Will)", async () => {
    const { o } = outils();
    const m = creerMoteurMontageFacecamAnimee({ outils: async () => o, statutFormat: "masque" });
    const commande = { videoId: "v-1", formatId: "facecam-animee", moteurId: "montage-facecam-animee", ratios: ["9:16"], briques: {}, distribution: [], entrees: { facecamAnimee: { priseCle: "k.mov", fichierId: "f-1", accordEssaiReel: true } } } as never;
    const t = await m.lancer(commande, { travailId: "trav-1", versionId: "ver-1", titre: "Essai" });
    const r = await m.avancer({ ...t, parametres: { ...t.parametres, facecamAnimeeV4: base() } }, commande);
    expect(r.travail.statut).toBe("echec");
    expect(r.travail.erreur).toMatchObject({ reessayable: true });
    expect(r.travail.erreur?.messagePourWill).toMatch(/vidéo fidèle/);
    const garde = r.travail.parametres?.facecamAnimeeV4 as EtatChaineV4;
    expect(garde.etape).toBe("videos");
    expect(garde.videos?.retirees.length).toBeGreaterThan(0);
    expect(plaquettesSansVideo(garde.realisation!.plan)).toEqual(RANGS_VIDEO);
  });

  it("l'état gardé après un échec contient le plan PARTIELLEMENT rempli : la reprise ne cherche que la plaquette manquante", async () => {
    const manquante = RANGS_VIDEO[1];
    const premier = outilVideos([manquante]);
    const erreur = await avancerChaineV4(base(), outils({ videos: premier }).o).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurChaineV4);
    const partiel = erreur.etat as EtatChaineV4;
    expect(plaquettesSansVideo(partiel.realisation!.plan)).toEqual([manquante]);
    expect(partiel.videos?.fichiers.length).toBeGreaterThan(0);
    // reprise : l'outil ne reçoit à remplir QUE la plaquette manquante
    const reprise = outilVideos([manquante]);
    await avancerChaineV4(partiel, outils({ videos: reprise }).o).catch(() => undefined);
    expect(reprise).toHaveBeenCalledTimes(1);
    expect(plaquettesSansVideo(reprise.mock.calls[0][0].plan)).toEqual([manquante]);
  });

  it("le message pour Will n'affiche jamais le texte de Claude (illustre) : seulement le nom lisible de la plaquette et l'instant", async () => {
    const plan: PlanFacecamAnimee = { ...PLAN_OPUS, elementsV4: [{ id: "AvantApres", debut: 12.34, fin: 15, recherches: ["homme qui tape"], illustre: "notre audit Certifexemple à Villeexemple" }] };
    const erreur = await avancerChaineV4({ ...base(), realisation: { version: "complete", essais: 1, avertissements: 0, plan } }, outils().o).catch((e) => e);
    expect(erreur).toBeInstanceOf(ErreurChaineV4);
    expect(erreur.message).not.toMatch(/certifexemple|villeexemple|audit/i);
    expect(erreur.message).toMatch(/Avant \/ après/);
    expect(erreur.message).toMatch(/12,3 s/);
  });
});
