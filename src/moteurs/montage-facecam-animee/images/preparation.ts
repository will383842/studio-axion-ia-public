/**
 * MINI-VIDÉOS — PRÉPARATION d'une vidéo de banque pour une fenêtre (production ET outil d'approvisionnement).
 *
 *  1. téléchargement de la version retenue (la plus petite ≥ 720 px de côté court) dans un dossier propre au candidat ;
 *  2. profil de mouvement de la source recadrée 4:5 (25 i/s, 180 px, gris) → passage sans coupe dont la médiane des
 *     pixels changés est la plus haute DANS la plage visible 3-35 % (`passageDansLaPlage`) ;
 *  3. extrait de 3 à 4 s recadré 4:5 1080×1350, H.264 25 i/s, SANS SON, ≤ 8 Mo (qualité baissée par paliers) ;
 *  4. mesure du mouvement VISIBLE sur l'extrait lui-même (25 i/s, 360 px, médiane, `mesureMouvement`) : c'est ce que
 *     verra le spectateur ; `raisonEcartMiniVideo` refuse ensuite un extrait figé (< 3 %), un travelling (> 35 %) ou une coupe ;
 *  5. une planche de 3 images de l'extrait (1/6, 1/2, 5/6) pour le contrôle visuel « littéral » ;
 *  6. dépôt sous `videos/fenetre-N.mp4` (clé lue par la mise en page : `media`, `video: true`, `depuisSec: 0`).
 * Les outils (ffmpeg, téléchargement, stockage, verrou du PC) sont injectés : `adaptateur.ts` en production,
 * `scripts/approvisionner-fenetres.ts` en local. Aucune clé n'est lue ni écrite ici.
 */
import { join } from "node:path";
import { IMAGES_PAR_SEC_MESURE, LARGEUR_CONTROLE, mesureMouvement, partsChangees, passageDansLaPlage, type CandidatImage } from "./choisir";
import type { MiniVideoPreparee } from "./index";

/** Durée maximale et minimale de l'extrait (la mise en page le lit en boucle si la fenêtre est plus longue). */
export const EXTRAIT_MAX_SEC = 4;
export const EXTRAIT_MIN_SEC = 3;
export const OCTETS_MAX_EXTRAIT = 8 * 1024 * 1024;
/** Profil de la source (choix du passage) : 180 px, 25 i/s, 40 s au plus ; contrôle de l'extrait : 360 px, 25 i/s. */
export const LARGEUR_MESURE = 180;
export const IMAGES_PAR_SEC_PROFIL = IMAGES_PAR_SEC_MESURE;
export const IMAGES_PAR_SEC_CONTROLE = IMAGES_PAR_SEC_MESURE;
export const PROFIL_MAX_SEC = 40;
export const PREFIXE_CLE_MINI_VIDEO = "videos/fenetre-";

export interface OutilsPreparation {
  /** Lance ffmpeg ou ffprobe ; rend la sortie standard ; lève si le programme échoue. */
  executer(programme: "ffmpeg" | "ffprobe", args: string[]): Promise<Uint8Array>;
  /** Télécharge l'adresse dans le fichier local. */
  telecharger(url: string, fichier: string): Promise<void>;
  /** Crée un dossier de travail VIDE propre au candidat ; rend son chemin. */
  dossierTravail(nom: string): Promise<string>;
  /** Taille d'un fichier local (octets). */
  taille(fichier: string): Promise<number>;
  /** Range l'extrait préparé sous la clé demandée ; rend la clé finale (lue par le rendu). */
  deposer(fichierLocal: string, cle: string): Promise<string>;
  /** Retire un extrait déposé puis refusé. */
  retirer?(cle: string): Promise<void>;
  /** Supprime un fichier local (la source téléchargée, une fois l'extrait fait). */
  supprimer?(fichier: string): Promise<void>;
  /** Supprime le dossier de travail ENTIER d'un candidat (extrait, planche de contrôle, source) : appelé dès que le candidat est jugé ou en erreur. */
  supprimerDossier?(dossier: string): Promise<void>;
  /** Exclusion des commandes lourdes (verrou du PC) autour du téléchargement et de ffmpeg. */
  sousVerrou?<T>(f: () => Promise<T>): Promise<T>;
  /** Préfixe des clés (défaut `videos/fenetre-`). */
  prefixeCle?: string;
}

const texte = (b: Uint8Array) => new TextDecoder().decode(b);

/** Longueur de l'extrait : la fenêtre + 0,5 s, entre 3 et 4 s, jamais plus que la source. */
export function longueurExtrait(dureeFenetreSec: number, dureeSourceSec: number): number {
  return Math.min(EXTRAIT_MAX_SEC, Math.max(EXTRAIT_MIN_SEC, dureeFenetreSec + 0.5), Math.max(1, dureeSourceSec - 0.1));
}

/** Hauteur de mesure (paire) pour une largeur de `largeur` px (défaut `LARGEUR_MESURE`). */
export const hauteurMesure = (w: number, h: number, largeur = LARGEUR_MESURE) => Math.max(2, Math.round((largeur * h) / Math.max(1, w) / 2) * 2);

/** Découpe une sortie « rawvideo gray » en images de `taille` octets. */
export function decouperImages(brut: Uint8Array, taille: number): Uint8Array[] {
  const sortie: Uint8Array[] = [];
  if (taille <= 0) return sortie;
  for (let o = 0; o + taille <= brut.length; o += taille) sortie.push(brut.subarray(o, o + taille));
  return sortie;
}

/** Écarts successifs (écart moyen absolu) d'une suite d'images. */
export function ecartsSuccessifs(images: readonly Uint8Array[]): number[] {
  const e: number[] = [];
  for (let k = 1; k < images.length; k++) {
    const a = images[k - 1];
    const b = images[k];
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    e.push(s / Math.max(1, a.length));
  }
  return e;
}

/** Arguments ffmpeg de l'extrait : recadrage 4:5 centré, 1080×1350, 25 i/s, H.264, sans son. */
export function argumentsEncodage(source: string, sortie: string, debutSec: number, dureeSec: number, crf: number): string[] {
  return [
    "-v", "error", "-y", "-ss", debutSec.toFixed(2), "-i", source, "-t", dureeSec.toFixed(2), "-an", "-sn", "-dn",
    "-vf", "crop='min(iw,ih*4/5)':'min(ih,iw*5/4)',scale=1080:1350:flags=lanczos,fps=25,setsar=1,format=yuv420p",
    "-c:v", "libx264", "-preset", "medium", "-crf", String(crf), "-profile:v", "high", "-movflags", "+faststart", sortie,
  ];
}

/** Arguments ffmpeg d'un profil en niveaux de gris (`largeur` px de large). */
export function argumentsProfil(fichier: string, imagesParSec: number, w: number, h: number, maxSec = PROFIL_MAX_SEC, largeur = LARGEUR_MESURE): string[] {
  // Recadrage 4:5 centré (le même que l'encodage) : on mesure ce qui sera MONTRÉ. Sans effet sur un extrait déjà en 4:5.
  const r = recadrage45(w, h);
  return ["-v", "error", "-t", String(maxSec), "-i", fichier, "-vf", `fps=${imagesParSec},crop=${r.w}:${r.h},scale=${largeur}:${hauteurMesure(r.w, r.h, largeur)},format=gray`, "-f", "rawvideo", "-"];
}

/** Dimensions du cadre 4:5 centré d'une image w×h (paires). */
export function recadrage45(w: number, h: number): { w: number; h: number } {
  const pair = (x: number) => Math.max(2, Math.floor(x / 2) * 2);
  return { w: pair(Math.min(w, (h * 4) / 5)), h: pair(Math.min(h, (w * 5) / 4)) };
}

/** Taille en octets d'une image du profil (`argumentsProfil`) d'une vidéo w×h. */
export const tailleImageProfil = (w: number, h: number, largeur = LARGEUR_MESURE) => {
  const r = recadrage45(w, h);
  return largeur * hauteurMesure(r.w, r.h, largeur);
};

/**
 * Arguments ffmpeg de l'image de CONTRÔLE : trois images de l'extrait (à 1/6, 1/2 et 5/6) côte à côte, 360 px de large
 * chacune — Claude juge ce qui se passe pendant le passage, pas une seule pose.
 */
export function argumentsPlanche(extrait: string, dureeSec: number, sortie: string): string[] {
  const t = [1 / 6, 1 / 2, 5 / 6].map((k) => (dureeSec * k).toFixed(2));
  return [
    "-v", "error", "-y",
    ...t.flatMap((x) => ["-ss", x, "-i", extrait]),
    "-filter_complex", "[0:v]scale=360:-2[a];[1:v]scale=360:-2[b];[2:v]scale=360:-2[c];[a][b][c]hstack=inputs=3",
    "-frames:v", "1", "-q:v", "3", sortie,
  ];
}

async function sonder(o: OutilsPreparation, fichier: string): Promise<{ w: number; h: number; duree: number }> {
  const j = JSON.parse(texte(await o.executer("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", fichier])));
  const w = Number(j.streams?.[0]?.width ?? 0);
  const h = Number(j.streams?.[0]?.height ?? 0);
  const duree = Number(j.format?.duration ?? 0);
  if (!(w > 0 && h > 0 && duree > 0)) throw new Error("vidéo illisible");
  return { w, h, duree };
}

/** La fonction `preparerMiniVideo` de `DependancesImages`, branchée sur des outils. */
export function preparateurMiniVideo(o: OutilsPreparation) {
  const verrou = <T>(f: () => Promise<T>) => (o.sousVerrou ? o.sousVerrou(f) : f());
  return async (c: CandidatImage, d: { fenetre: number; dureeFenetreSec: number }): Promise<MiniVideoPreparee & { source: { largeur: number; hauteur: number; dureeSec: number } }> => {
    if (!/^https?:\/\//.test(c.cle)) throw new Error("pas d'adresse à télécharger");
    const dossier = await o.dossierTravail(`${c.source}-${c.id}`.replace(/[^a-z0-9-]/gi, "_"));
    try {
    const brut = join(dossier, "source.mp4");
    const extrait = join(dossier, "extrait.mp4");
    const image = join(dossier, "controle.jpg");
    const r = await verrou(async () => {
      await o.telecharger(c.cle, brut);
      try {
        const s = await sonder(o, brut);
        // Le profil est mesuré sur l'image RECADRÉE 4:5 (ce qui sera montré), pas sur toute la largeur d'une vidéo paysage.
        const profilImages = decouperImages(await o.executer("ffmpeg", argumentsProfil(brut, IMAGES_PAR_SEC_PROFIL, s.w, s.h)), tailleImageProfil(s.w, s.h));
        const longueur = longueurExtrait(d.dureeFenetreSec, s.duree);
        const parts = partsChangees(profilImages);
        const passage = passageDansLaPlage(parts, IMAGES_PAR_SEC_PROFIL, longueur);
        const ecarts = ecartsSuccessifs(profilImages);
        const k0 = Math.round(passage.debutSec * IMAGES_PAR_SEC_PROFIL);
        const tranche = ecarts.slice(k0, k0 + Math.max(1, Math.round(longueur * IMAGES_PAR_SEC_PROFIL)));
        const mouvementPassage = tranche.length ? tranche.reduce((t, x) => t + x, 0) / tranche.length : 0;
        const debut = Math.max(0, Math.min(passage.debutSec, s.duree - longueur - 0.05));
        let crf = 21;
        await o.executer("ffmpeg", argumentsEncodage(brut, extrait, debut, longueur, crf));
        while ((await o.taille(extrait)) > OCTETS_MAX_EXTRAIT && crf < 33) {
          crf += 4;
          await o.executer("ffmpeg", argumentsEncodage(brut, extrait, debut, longueur, crf));
        }
        const e = await sonder(o, extrait);
        const vu = mesureMouvement(decouperImages(await o.executer("ffmpeg", argumentsProfil(extrait, IMAGES_PAR_SEC_CONTROLE, e.w, e.h, PROFIL_MAX_SEC, LARGEUR_CONTROLE)), tailleImageProfil(e.w, e.h, LARGEUR_CONTROLE)));
        await o.executer("ffmpeg", argumentsPlanche(extrait, e.duree, image));
        return { s, e, passage: { mouvement: mouvementPassage }, debut, vu, octets: await o.taille(extrait) };
      } finally {
        await o.supprimer?.(brut).catch(() => undefined);
      }
    });
    const cle = await o.deposer(extrait, `${o.prefixeCle ?? PREFIXE_CLE_MINI_VIDEO}${d.fenetre + 1}.mp4`);
    const arrondi = (x: number, n = 100) => Math.round(x * n) / n;
    return {
      cle,
      depuisSec: 0,
      mouvement: arrondi(r.passage.mouvement),
      pixelsChanges: arrondi(r.vu.pixelsChanges, 1000),
      pixelsChangesMedian: arrondi(r.vu.mediane, 1000),
      coupes: r.vu.coupes,
      partFigee: arrondi(r.vu.partFigee),
      debutSourceSec: arrondi(r.debut),
      dureeSec: arrondi(r.e.duree),
      octets: r.octets,
      image,
      dossier,
      source: { largeur: r.s.w, hauteur: r.s.h, dureeSec: arrondi(r.s.duree) },
    };
    } catch (e) {
      // Échec (téléchargement, ffmpeg, dépôt) : rien ne reste sur le disque du serveur.
      await o.supprimerDossier?.(dossier).catch(() => undefined);
      throw e;
    }
  };
}
