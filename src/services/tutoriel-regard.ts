/**
 * REGARD DU « TUTORIEL D'OUTIL » (T-EXT-27b) : tire au plus 12 images-clés du format maître (opération `image-fixe` du
 * rendu, gratuite), les fait RECOPIER par le regardeur COMMUN (`@/briques/regardeur`) et rend la lecture. Le code juge
 * (`verdictRegardTutoriel`), jamais Claude. ARGENT : un seul appel, par `executerRolePourVideo` (plafond propre `tuto`,
 * limite du mois, pré-vol, réservation, origine), jamais par l'adaptateur de texte (qui ne transmet pas d'images).
 *
 *  - ÉTEINT PAR DÉFAUT : rien n'est construit sans `regardTutorielActif()` (voir `tutoriel-branchements.ts`).
 *  - Rien n'est défini ici (ni texte de rôle, ni schéma, ni rôle) : tout vient de la brique commune.
 *  - Jamais d'exception vers le moteur : tout échec rend `null` (le regard ne fait jamais échouer la fabrication).
 *  - Une réponse simulée, vide ou illisible n'est jamais une lecture : `null`.
 *  - Aucun montant rendu.
 */
import "server-only";
import { imagesPourClaude, roleRegard, schemaLectureRegard, variableRegard } from "@/briques/regardeur";
import type { InstantRegard, LectureRegard } from "@/briques/regardeur";
import type { Id, CommandeFabrication } from "@/domaine/types";
import { executerRendu } from "@/fournisseurs/rendu/attente";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";
import type { executerRolePourVideo } from "./depense-claude-video";
import { ETAPE_REGARD_TUTORIEL, IMAGES_REGARD_TUTORIEL, plafondPropreTutoriel } from "./tutoriel-claude";

export type RegarderTutoriel = (x: { demandeMaitre: DemandeRendu; instants: InstantRegard[] }) => Promise<LectureRegard | null>;

export interface RenduRegard {
  service: () => ServiceRendu;
  signer: (lectures: Record<string, string>, depot: { cle: string; mime: string }) => Promise<{ lectures: Record<string, string>; urlDepot: string }>;
  cle: (nom: string) => string;
}

type ImageTiree = { type: "image/png"; base64: string };

/** Une image PNG au plus de 5 Mo (limite de l'envoi à Claude) ; au-delà, elle est absente. */
const OCTETS_IMAGE_MAX = 5_000_000;
const DELAI_IMAGE_MS = 120_000;

export interface DepsRegard {
  executer?: typeof executerRolePourVideo;
  /** Rend l'image d'UNE demande `image-fixe` ; `null` si elle échoue. */
  tirer?: (demande: DemandeRendu, rendu: RenduRegard) => Promise<ImageTiree | null>;
}

/** Tirage réel d'une image : rendu court, puis lecture de l'adresse signée. Jamais d'exception. */
async function tirerParDefaut(demande: DemandeRendu, rendu: RenduRegard): Promise<ImageTiree | null> {
  try {
    const fait = await executerRendu(rendu.service(), demande, { delaiMs: DELAI_IMAGE_MS, essais: 0 });
    const lecture = await rendu.signer({ image: fait.sortieCle }, { cle: demande.sortie.cle, mime: "image/png" });
    const url = lecture.lectures.image;
    if (!url) return null;
    const reponse = await fetch(url);
    if (!reponse.ok) return null;
    const octets = Buffer.from(await reponse.arrayBuffer());
    if (octets.length === 0 || octets.length > OCTETS_IMAGE_MAX) return null;
    return { type: "image/png", base64: octets.toString("base64") };
  } catch {
    return null;
  }
}

/** La demande `image-fixe` d'un instant : même composition, mêmes propriétés et mêmes entrées signées que le format maître. */
export async function demandeImageClef(maitre: DemandeRendu, instant: InstantRegard, rendu: RenduRegard): Promise<DemandeRendu> {
  const proprietes = maitre.parametres.proprietes as { plan?: { format?: { fps?: number } } } | undefined;
  const fps = proprietes?.plan?.format?.fps ?? 25;
  const cle = rendu.cle(`regard-${instant.nom}.png`);
  const signe = await rendu.signer({}, { cle, mime: "image/png" });
  return {
    idRendu: `${maitre.idRendu}-regard-${instant.nom}`,
    operation: "image-fixe",
    file: "courte",
    entrees: maitre.entrees,
    sortie: { urlDepot: signe.urlDepot, cle },
    parametres: { composition: maitre.parametres.composition, image: Math.round(instant.instantSec * fps), proprietes: maitre.parametres.proprietes },
  };
}

export function creerRegardTutoriel(e: { videoId: Id; origine: CommandeFabrication["origine"]; rendu: RenduRegard }, deps: DepsRegard = {}): RegarderTutoriel {
  return async ({ demandeMaitre, instants }) => {
    try {
      const retenus = instants.slice(0, IMAGES_REGARD_TUTORIEL);
      const tirer = deps.tirer ?? tirerParDefaut;
      const tirees = await Promise.all(
        retenus.map(async (instant) => {
          try {
            const image = await tirer(await demandeImageClef(demandeMaitre, instant, e.rendu), e.rendu);
            return image ? { instant, image } : null;
          } catch {
            return null;
          }
        }),
      );
      const ok = tirees.filter((x): x is { instant: InstantRegard; image: ImageTiree } => x !== null);
      // Aucune image : aucun appel à Claude, rien de payé.
      if (ok.length === 0) return null;
      const executer = deps.executer ?? (await import("./depense-claude-video")).executerRolePourVideo;
      const r = await executer(e.videoId, roleRegard, { contexte: {}, variable: variableRegard(ok.map((x) => x.instant)), images: imagesPourClaude(ok.map((x) => ({ nom: x.instant.nom, ...x.image }))) }, { etape: ETAPE_REGARD_TUTORIEL, plafondPropre: plafondPropreTutoriel(), origine: e.origine });
      if (!r.ok || r.simule) return null;
      const brute = r.donnees ?? lireJson(r.texte);
      const lecture = schemaLectureRegard.safeParse(brute);
      return lecture.success ? lecture.data : null;
    } catch {
      return null;
    }
  };
}

function lireJson(texte: string | undefined): unknown {
  if (!texte?.trim()) return null;
  try {
    return JSON.parse(texte);
  } catch {
    return null;
  }
}
