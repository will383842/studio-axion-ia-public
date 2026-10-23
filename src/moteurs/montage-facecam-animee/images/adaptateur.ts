/**
 * LES PHOTOS ET LOGOS (lot D) — ADAPTATEUR vers la recherche d'illustrations DÉJÀ EN SERVICE au studio (B-roll du
 * face caméra et cascade du moteur avocat), utilisée par ses fonctions publiques, SANS la modifier :
 *  - Pexels / Pixabay (vidéos verticales, licence enregistrée) : `FournisseurIllustration.chercher` puis
 *    `recopierResultat` (seul le résultat retenu est téléchargé dans notre stockage) — `fournisseurs/illustration/reel.ts` ;
 *  - Mes images et captures du site : éléments de la Bibliothèque filtrés par `utilisableParLeMoteur` (images PRÊTES
 *    seulement, capture 9:16 seulement) et notés par `scoreCorrespondance` / `SEUIL_CORRESPONDANCE`
 *    — `domaine/illustrations.ts`.
 * Les PHOTOS des banques n'existent pas encore au studio (la recherche actuelle ne rend que des vidéos) : elles passent
 * par `chercherPhotos` quand il sera branché ; d'ici là, une fenêtre photo se remplit par Mes images ou une capture.
 * MINI-VIDÉOS : avec `preparation` (ffmpeg, téléchargement, stockage du studio), l'adaptateur rend aussi
 * `preparerMiniVideo` / `abandonner` (`preparation.ts`) : la vidéo retenue est téléchargée, coupée au passage le plus
 * animé, recadrée 4:5, MESURÉE (mouvement visible) puis déposée sous `videos/fenetre-N.mp4`. Sans elle, la vidéo est
 * recopiée telle quelle (`recopierResultat`) et son mouvement n'est pas mesuré.
 * Aucune fabrication (fal.ai) n'est jamais appelée d'ici.
 */
import { scoreCorrespondance, SEUIL_CORRESPONDANCE, utilisableParLeMoteur, type ElementCascade } from "@/domaine/illustrations";
import type { ResultatBanque } from "@/fournisseurs/types";
import type { FournisseurIllustrationEtendu } from "@/fournisseurs/illustration/types";
import type { CandidatImage } from "./choisir";
import type { DemandeRecherche, DependancesImages } from "./index";
import { preparateurMiniVideo, type OutilsPreparation } from "./preparation";

/** Un élément de la Bibliothèque avec ce qu'il faut pour le rendu (clé et dimensions de son fichier). */
export interface ImageBibliotheque {
  element: ElementCascade;
  cle: string;
  vignetteCle?: string;
  largeur: number;
  hauteur: number;
  dureeSec?: number;
}

export interface OptionsAdaptateur {
  /** Le fournisseur d'illustrations du studio (« reel » : Pexels + Pixabay). */
  illustration?: Pick<FournisseurIllustrationEtendu, "chercher" | "recopierResultat">;
  /** Mes images + captures du site (Bibliothèque). */
  listerBibliotheque?: () => Promise<ImageBibliotheque[]>;
  /**
   * Passe 3 : vidéos des banques gratuites lues DIRECTEMENT, page par page, toutes orientations (`banques.ts`,
   * `chercheurVideosBanques`). Prioritaire sur `illustration` (qui ne lit qu'une page de vidéos verticales).
   */
  chercherVideos?: (source: "pexels" | "pixabay", requeteEn: string, page: number) => Promise<CandidatImage[]>;
  /** Photos des banques gratuites (à brancher : API photos Pexels / Pixabay). */
  chercherPhotos?: (source: "pexels" | "pixabay", requeteEn: string) => Promise<CandidatImage[]>;
  /** Recopie d'une photo de banque dans notre stockage ; rend sa clé. */
  recopierPhoto?: (c: CandidatImage) => Promise<string>;
  /** Outils de préparation des mini-vidéos (ffmpeg, téléchargement, dépôt dans le stockage du rendu). */
  preparation?: OutilsPreparation;
}

function depuisBanque(r: ResultatBanque): CandidatImage {
  return {
    source: r.source,
    id: r.idExterne,
    genre: "video",
    cle: r.fichierCle,
    vignette: r.vignetteCle,
    largeur: r.largeur,
    hauteur: r.hauteur,
    dureeSec: r.dureeSec,
    description: r.description,
    licence: { usageCommercial: r.licence.usageCommercial, nom: r.licence.source ?? (r.source === "pexels" ? "Pexels" : "Pixabay Content License"), ...(r.licence.creditObligatoire ? { attribution: r.licence.creditObligatoire } : {}) },
    brut: r,
  };
}

function depuisBibliotheque(i: ImageBibliotheque, source: "mes-images" | "capture-site", score: number): CandidatImage {
  const e = i.element;
  return {
    source,
    id: e.id,
    genre: e.type === "illustration-video" ? "video" : "photo",
    cle: i.cle,
    vignette: i.vignetteCle ?? i.cle,
    largeur: i.largeur,
    hauteur: i.hauteur,
    dureeSec: i.dureeSec,
    description: [e.nom, e.description, ...e.motsCles].filter(Boolean).join(" "),
    score,
    licence: { usageCommercial: e.licence.type !== "a-verifier" },
  };
}

/** Les dépendances `chercher` et `stocker` de `remplirFenetres`, branchées sur l'existant. */
export function adaptateurStudio(o: OptionsAdaptateur): Pick<DependancesImages, "chercher" | "stocker" | "preparerMiniVideo" | "abandonner" | "liberer"> {
  const prep = o.preparation;
  return {
    ...(prep
      ? {
          preparerMiniVideo: preparateurMiniVideo(prep),
          abandonner: async (cle: string) => {
            await prep.retirer?.(cle);
          },
          liberer: async (p: { dossier?: string }) => {
            if (p.dossier) await prep.supprimerDossier?.(p.dossier);
          },
        }
      : {}),
    async chercher(d: DemandeRecherche): Promise<CandidatImage[]> {
      if (d.source === "mes-images" || d.source === "capture-site") {
        const tout = (await o.listerBibliotheque?.()) ?? [];
        const capture = d.source === "capture-site";
        const req = { motsFr: d.motsFr, requeteEn: d.requeteEn };
        return tout
          .filter((i) => utilisableParLeMoteur(i.element) && i.element.licence.type !== "a-verifier")
          .filter((i) => (capture ? !!i.element.sourceSite : i.element.origine === "personnelle" && !i.element.sourceSite))
          .map((i) => ({ i, s: scoreCorrespondance(req, i.element) }))
          .filter((x) => d.repli || x.s >= SEUIL_CORRESPONDANCE)
          .sort((a, b) => b.s - a.s)
          .map((x) => depuisBibliotheque(x.i, d.source as "mes-images" | "capture-site", x.s));
      }
      // Banques gratuites. Wikimedia (repli sans clé) n'est pas branché au studio : seul l'outil d'essai le lit.
      if (d.source === "wikimedia") return [];
      if (d.genre === "video") {
        if (!d.requeteEn.trim()) return [];
        if (o.chercherVideos) return o.chercherVideos(d.source, d.requeteEn, d.page ?? 1);
        // Le fournisseur du studio n'a qu'une page.
        if (!o.illustration || (d.page ?? 1) > 1) return [];
        const r = await o.illustration.chercher({ requete: d.requeteEn, ratio: "9:16", dureeMinSec: Math.ceil(d.dureeMinSec), sources: [d.source] });
        return r.map(depuisBanque);
      }
      return o.chercherPhotos ? o.chercherPhotos(d.source, d.requeteEn) : [];
    },

    async stocker(c: CandidatImage): Promise<string> {
      if (!/^https?:\/\//.test(c.cle)) return c.cle; // déjà chez nous (Mes images, capture, résultat déjà recopié)
      // Une vidéo de banque passe par la préparation (mesurée, recadrée) ; jamais recopiée brute quand elle est branchée.
      if (c.genre === "video" && prep) throw new Error("Une vidéo de banque passe par la préparation des mini-vidéos.");
      if (c.genre === "video" && c.brut && o.illustration?.recopierResultat) return (await o.illustration.recopierResultat(c.brut as ResultatBanque)).fichierCle;
      if (c.genre === "photo" && o.recopierPhoto) return o.recopierPhoto(c);
      throw new Error("Recopie impossible : aucun stockage branché pour ce candidat.");
    },
  };
}
