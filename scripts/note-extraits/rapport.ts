// RAPPORT « MESURE SEULE » DES EXTRAITS (X4-16a). Lecture seule : aucune écriture, aucun appel payant, rien d'allumé.
//
// Pour les `n` dernières vidéos prêtes, calcule les moments (fonctions de `src/briques/note-extraits`), appelle le tri
// REÇU EN PARAMÈTRE sans rien enregistrer, et rend un tableau Markdown. Le tri par défaut est `trierVideo` (X4-16b) ;
// lancé à la main seulement, par la session qui déploie, sur accord de Williams.
// Rien n'importe ce script. Patron : scripts/variete-commune/rapport.ts (X2-09).
import {
  SEUILS_PAR_DEFAUT, momentsCaptures, momentsDepuisScenes, momentsEcranDemo, sujetDuMoment, usagesDe,
  type ContexteNote, type Moment, type ResultatTri, type SeuilsNoteInteret,
} from "../../src/briques/note-extraits";
import { trierVideo } from "../../src/briques/archive-extraits/tri-video";
import { videoEligible } from "../../src/briques/archive-extraits/inscription";
import type { TypeAutomatisation } from "../../src/domaine/ciblage/types";
import type { Video } from "../../src/domaine/types";
import type { EtatCaptures } from "../../src/moteurs/montage-cas-concret/captures";
import type { EntreesDemo } from "../../src/moteurs/montage-demo-facecam/entrees";

export type TriExtraits = (moments: Moment[], contexte: ContexteNote, seuils: SeuilsNoteInteret) => ResultatTri | Promise<ResultatTri>;

/** Tri par défaut : `trierVideo`, usages étiquetés ; chiffres réels jamais supposés (E4-3). */
export const trierParDefaut: TriExtraits = (m, c, s) => trierVideo(m, c, s, { etiqueter: (x) => usagesDe(x, { chiffresReels: false }) });

/** Une vidéo lue (lecture seule) : tout ce qu'il faut pour les règles d'éligibilité et pour les moments. */
export interface VideoLue {
  id: string;
  titre: string;
  generateur: string;
  creeLe?: string;
  video: Pick<Video, "estDemo" | "statut" | "corbeilleLe" | "etapeEditoriale">;
  versionEnEssai: boolean;
  sortieDemo: boolean;
  aSousTitres: boolean;
  avecVisage: boolean;
  typeAutomatisation?: TypeAutomatisation;
  plan?: unknown;
  entreesDemo?: EntreesDemo;
  decalageSec?: number;
  captures?: EtatCaptures;
}

export type ListerVideos = (n: number) => Promise<VideoLue[]>;

const RIEN = "—";
const cellule = (s: string) => s.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

function momentsDe(v: VideoLue): Moment[] {
  const moments: Moment[] = [];
  if (v.entreesDemo) moments.push(...momentsEcranDemo(v.entreesDemo, v.plan, v.decalageSec).moments);
  else moments.push(...momentsDepuisScenes(v.plan, { avecVisage: v.avecVisage }));
  if (v.captures) moments.push(...momentsCaptures(v.captures));
  return moments;
}

const uniques = (xs: string[]) => [...new Set(xs)].sort();

export async function rapportExtraits(p: { n: number; trier: TriExtraits; lister: ListerVideos }): Promise<string> {
  const lues = await p.lister(p.n);
  const retenues = lues
    .filter((v) => videoEligible(v.video, { politique: "pretes", versionEnEssai: v.versionEnEssai, sortieDemo: v.sortieDemo, aSousTitres: v.aSousTitres }).eligible)
    .sort((a, b) => (b.creeLe ?? "").localeCompare(a.creeLe ?? "") || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, p.n));

  const lignes = [
    "| Vidéo | Générateur | Gardés | Peut-être | Ignorés | Sujets | Usages | Rien à retenir |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const v of retenues) {
    const moments = momentsDe(v);
    const sujet = sujetDuMoment({ video: { typeAutomatisation: v.typeAutomatisation }, texte: v.titre });
    const r = await p.trier(moments, { sujet }, { ...SEUILS_PAR_DEFAUT });
    const retenus = [...r.gardes, ...r.peutEtre];
    const sujets = uniques(retenus.flatMap((m) => (m.sujet ? [m.sujet] : [])));
    const usages = uniques(retenus.flatMap((m) => m.usages));
    lignes.push(
      `| ${cellule(v.titre)} | ${cellule(v.generateur)} | ${r.gardes.length} | ${r.peutEtre.length} | ${r.ignores.nombre} | ${sujets.join(", ") || RIEN} | ${usages.join(", ") || RIEN} | ${r.rienARetenir ? "oui" : "non"} |`,
    );
  }
  return lignes.join("\n") + "\n";
}

/** Lecture réelle, SEULE lecture (`lister`), jamais d'écriture. Chargée seulement au lancement réel. */
async function listerReel(n: number): Promise<VideoLue[]> {
  const { depots } = await import("../../src/donnees/memoire");
  const d = depots();
  const videos = await d.videos.lister((v) => v.statut === "prete" && !v.corbeilleLe && !v.estDemo);
  const versions = await d.versions.lister();
  return videos
    .sort((a, b) => (b.creeLe ?? "").localeCompare(a.creeLe ?? ""))
    .slice(0, n * 3)
    .map((video) => {
      const v = versions.filter((x) => x.videoId === video.id && x.statut === "prete").sort((a, b) => (b.creeLe ?? "").localeCompare(a.creeLe ?? ""))[0];
      const projet = v?.projetMontage as { plan?: unknown } | undefined;
      return {
        id: video.id, titre: video.titre, generateur: v?.commande?.moteurId ?? "inconnu", creeLe: video.creeLe,
        video, versionEnEssai: false, sortieDemo: false, aSousTitres: true, avecVisage: true,
        ...(video.typeAutomatisation ? { typeAutomatisation: video.typeAutomatisation } : {}),
        ...(projet?.plan ? { plan: projet.plan } : {}),
      };
    });
}

export async function main(o: { trier?: TriExtraits; lister?: ListerVideos; n?: number; ecrire?: (s: string) => void } = {}): Promise<number> {
  const ecrire = o.ecrire ?? ((s: string) => void process.stdout.write(s));
  ecrire(await rapportExtraits({ n: o.n ?? 10, trier: o.trier ?? trierParDefaut, lister: o.lister ?? listerReel }));
  return 0;
}
