/**
 * RACCORDS ENTRE LOTS (plan facecam v4, lot E « Intégration ») — PUR, aucun réseau.
 *   - passages posés par l'agent monteur (lot D) → cartes posées de l'habillage (lot C) : `CodeCarte.timeline` →
 *     `CodeSurMesure.js`, disposition `ecran-partage` → `moitie-haute`, textes → données du modèle
 *     (`carteDepuisTextesTous`, les 13 modèles depuis la mission L) ; une carte sur mesure sans code retombe sur le
 *     modèle choisi d'après sa description (`choisirModeleTous`, jamais le titre plein écran) ;
 *   - demande de rendu d'une carte : opération `composition` EXISTANTE, sans mode (aucun contrat nouveau) ;
 *   - livraison de la chaîne → `entrees.facecam` de la vidéo (ce que le service recopie à la fin du travail).
 */
import { lireEntreesFacecam, type ConsigneFacecam, type EntreesFacecam } from "@/domaine/facecam";
import type { DemandeRendu } from "@/fournisseurs/types";
import {
  carteDepuisTextes,
  carteDepuisTextesTous,
  carteDuModeleDepuisPhrase,
  choisirModeleTous,
  choisirStyleMotion,
  estModeleEtendu,
  tientEnMoitieHaute,
  type CarteModeleEtendu,
  type CarteMotionTous,
  type CodeSurMesure,
  type IdModeleMotionTous,
  type IntensiteMotion,
} from "@/briques/motion";
import type { CartePosee, RenduCarte } from "./habillage";
import type { PassageMonteur } from "./monteur/appliquer";
import type { CodeCarte } from "./monteur/operations";

/** Titre posé par le monteur : 3 à 8 s (un titre « fixe » sur toute la vidéo s'affiche au début, puis laisse la place). */
const DUREE_TITRE = { minSec: 3, maxSec: 8 } as const;

/** Ce que la chaîne garde d'une carte posée par le monteur (petit : le code lourd reste sur R2). */
export interface CarteMonteur {
  id: string;
  debutSec: number;
  finSec: number;
  disposition: CartePosee["disposition"];
  /** Modèle de la bibliothèque (l'un des 13 depuis la mission L) ; null : carte sur mesure. */
  modele: IdModeleMotionTous | null;
  textes: string[];
  description: string;
  /** Code de la carte sur mesure (json.gz sur R2, déposé par le monteur). */
  codeCle?: string;
  /** Lot G : Will sur un côté ou en vignette pendant la carte (opération `miseEnPage`). */
  miseEnPage?: CartePosee["miseEnPage"];
}

/**
 * Passages du monteur qui sont des cartes (plein écran ou haut d'un écran partagé), en temps du montage. Lot G :
 * `ecranPartage` (« divise l'écran ») donne aussi sa carte (modèle d'après ses textes) ; `miseEnPage` (« mets-moi à
 * droite », « petite version de moi ») habille la carte qu'elle recouvre, sinon une carte faite de sa description.
 */
export function cartesDesPassages(passages: PassageMonteur[]): CarteMonteur[] {
  const cartes: CarteMonteur[] = [];
  for (const p of passages) {
    const op = p.operation;
    if (!op || !(p.finSec > p.debutSec)) continue;
    if (op.type === "ecranPartage") {
      cartes.push({ id: p.id, debutSec: p.debutSec, finSec: p.finSec, disposition: "moitie-haute", modele: null, textes: op.textes, description: [op.description, ...op.textes].join(" ") });
      continue;
    }
    // V6 « interdit de mentir » : titre et générique sont rendus par une carte du modèle titre.
    if (op.type === "titre" || op.type === "generique") {
      const plein = op.type === "generique" || op.pleinEcran;
      const fin = op.type === "generique" ? p.finSec : Math.min(p.finSec, p.debutSec + DUREE_TITRE.maxSec);
      cartes.push({ id: p.id, debutSec: p.debutSec, finSec: Math.max(fin, p.debutSec + DUREE_TITRE.minSec), disposition: plein ? "plein-ecran" : "moitie-haute", modele: plein ? "titre-plein-ecran" : "titre", textes: [op.texte], description: op.texte });
      continue;
    }
    if (op.type !== "ajouterCarte") continue;
    cartes.push({
      id: p.id,
      debutSec: p.debutSec,
      finSec: p.finSec,
      disposition: op.disposition === "ecran-partage" ? "moitie-haute" : "plein-ecran",
      modele: op.modele,
      textes: op.textes,
      description: op.description,
      ...(p.contenuCle ? { codeCle: p.contenuCle } : {}),
    });
  }
  for (const p of passages) {
    const op = p.operation;
    if (op?.type !== "miseEnPage" || !(p.finSec > p.debutSec)) continue;
    const miseEnPage = { mode: op.mode, cote: op.cote ?? "droite" } as const;
    // La carte qui recouvre le plus ce passage prend la mise en page ; sinon, une carte faite de la description.
    const recouvre = (c: CarteMonteur) => Math.min(c.finSec, p.finSec) - Math.max(c.debutSec, p.debutSec);
    const cible = cartes.filter((c) => !c.miseEnPage && recouvre(c) > 0.5).sort((a, b) => recouvre(b) - recouvre(a))[0];
    if (cible) Object.assign(cible, { miseEnPage, disposition: "plein-ecran" as const });
    else cartes.push({ id: p.id, debutSec: p.debutSec, finSec: p.finSec, disposition: "plein-ecran", modele: null, textes: [], description: op.description, miseEnPage });
  }
  return cartes.sort((a, b) => a.debutSec - b.debutSec);
}

/** Code écrit par Claude (`timeline`) → code de la composition `CarteSurMesure` (`js`). */
export function codeSurMesure(code: CodeCarte | null | undefined): CodeSurMesure | undefined {
  if (!code || typeof code.html !== "string") return undefined;
  return { html: code.html, css: typeof code.css === "string" ? code.css : "", js: typeof code.timeline === "string" ? code.timeline : "" };
}

/**
 * Modèle fixe le plus proche d'une description (repli d'une carte sur mesure sans code ou refusée). Lot G : une carte
 * de mise en page sans modèle reconnu devient un titre animé de sa description (jamais rien de l'autre côté). V6 :
 * pareil pour toute carte (liste de ses textes, sinon titre) — une demande acceptée est toujours rendue.
 */
function repliDe(c: CarteMonteur): CarteMotionTous | undefined {
  const choix = choisirModeleTous([c.description, ...c.textes].join(" "));
  if (choix?.carte) return choix.carte;
  // V6 « interdit de mentir » : une carte acceptée n'est jamais perdue en silence — ses textes en liste, sinon un titre.
  const liste = c.textes.length >= 2 ? carteDepuisTextes("liste", c.textes) : null;
  if (liste) return liste;
  const texte = (c.textes[0] ?? c.description).replace(/^(mets[- ]moi|fais[- ]moi|petite version de moi|monteur)[^:]*:?\s*/i, "").trim().slice(0, 80);
  return texte ? (carteDepuisTextes("titre", [texte]) ?? undefined) : undefined;
}

/**
 * Carte d'un modèle choisi (Claude ou version simple) : ses textes d'abord ; pour un modèle 7 à 13 dont les textes ne
 * suffisent pas, la règle de ce modèle appliquée à la description (mission L). Le titre plein écran ne vient que de
 * ses textes (il n'est posé que sur demande).
 */
function carteDuModele(c: CarteMonteur, modele: IdModeleMotionTous): CarteMotionTous | null {
  const carte = carteDepuisTextesTous(modele, c.textes);
  if (carte || !estModeleEtendu(modele)) return carte;
  const choix = carteDuModeleDepuisPhrase(modele, c.description) ?? carteDuModeleDepuisPhrase(modele, c.textes.join(", "));
  return choix?.carte ?? null;
}

/**
 * Carte posée prête pour `habillageFacecam` (le code sur mesure, s'il existe, a été relu sur R2). Style (lot C2) : la
 * demande de Will lue dans la description (« plus spectaculaire »), sinon l'intensité de la vidéo, sinon Sobre.
 */
export function cartePosee(c: CarteMonteur, code?: CodeCarte | null, intensite?: IntensiteMotion | null): CartePosee | null {
  const carte = c.modele ? (carteDuModele(c, c.modele) ?? undefined) : undefined;
  const surMesure = c.modele ? undefined : codeSurMesure(code);
  const repli = carte ? undefined : repliDe(c);
  if (!carte && !surMesure && !repli) return null;
  const style = choisirStyleMotion({ demande: c.description, intensite });
  // Lot F2 : une carte 7 à 13 qui ne tient pas dans la moitié haute d'un écran partagé passe en plein écran.
  const posee = !surMesure ? (carte ?? repli) : undefined;
  const disposition = c.disposition === "moitie-haute" && posee && estModeleEtendu(posee.modele) && !tientEnMoitieHaute(posee as CarteModeleEtendu) ? "plein-ecran" : c.disposition;
  return { ...(style !== "sobre" ? { style } : {}), ...(c.miseEnPage ? { miseEnPage: c.miseEnPage } : {}), id: c.id, debutSec: c.debutSec, finSec: c.finSec, disposition, ...(carte ? { carte } : {}), ...(surMesure ? { code: surMesure } : {}), ...(!carte && !surMesure && repli ? { carte: repli } : {}), ...(surMesure && repli ? { repli } : {}) };
}

/**
 * Demande de rendu d'une carte : opération `composition` EXISTANTE sans mode (`compositionEssai` de studio-rendu :
 * `parametres = { composition, proprietes }`), dépôt MP4 sur la clé de la carte. File longue (Remotion).
 */
export function demandeRenduCarte(carte: RenduCarte, urlDepot: string, essai = 0): DemandeRendu {
  return {
    idRendu: `${carte.cle.replace(/[^A-Za-z0-9_-]/g, "-").slice(-120)}${essai ? `-e${essai}` : ""}`,
    operation: "composition",
    file: "longue",
    entrees: {},
    sortie: { urlDepot, cle: carte.cle },
    parametres: carte.parametres as unknown as Record<string, unknown>,
  };
}

/**
 * Livraison de la chaîne recopiée dans `entrees.facecam` de la vidéo (fin du travail) : clés R2 et coupes nouvelles ;
 * les coupes rétablies par Will, les passages posés et les consignes ÉCRITES déjà présentes sont gardés ; une consigne
 * dite n'est ajoutée qu'une fois (même texte, même instant).
 */
export function entreesAvecLivraison(entrees: Record<string, unknown> | undefined, livraison: Partial<EntreesFacecam> & { coupes?: EntreesFacecam["coupes"] }): Record<string, unknown> {
  const avant = lireEntreesFacecam(entrees ?? {});
  const brut = ((entrees ?? {}) as { facecam?: Record<string, unknown> }).facecam ?? {};
  const deja = new Set(avant.consignes.map((x) => `${x.texte}|${x.dansPriseSec ?? ""}`));
  const nouvelles = (livraison.consignes ?? []).filter((x: ConsigneFacecam) => !deja.has(`${x.texte}|${x.dansPriseSec ?? ""}`));
  const facecam: Record<string, unknown> = {
    ...brut,
    ...avant,
    ...(livraison.pisteVisageCle ? { pisteVisageCle: livraison.pisteVisageCle } : {}),
    ...(livraison.masquesCle ? { masquesCle: livraison.masquesCle } : {}),
    ...(livraison.transcriptionCle ? { transcriptionCle: livraison.transcriptionCle } : {}),
    coupes: { auto: livraison.coupes?.auto ?? avant.coupes.auto, retablies: avant.coupes.retablies },
    consignes: [...avant.consignes, ...nouvelles],
    // Lot I : passages d'effets livrés (drapeaux « Réessayer ») recopiés sur ceux de même identifiant, rien d'ajouté.
    ...(livraison.passages?.length ? { passages: avant.passages.map((p) => livraison.passages!.find((x) => x.id === p.id) ?? p) } : {}),
    // Vérif V1 : cartes automatiques posées par l'habillage de cette version (le monteur du chat les voit).
    ...(livraison.cartesAuto ? { cartesAuto: livraison.cartesAuto } : {}),
  };
  return { ...(entrees ?? {}), facecam };
}
