/**
 * T-EXT-24 · LECTURE de l'écran de validation du tutoriel d'outil : une vidéo, son travail, et le dossier que l'écran montre.
 * Même modèle que `vueImageVideo` (`image-video-ecran.ts`). AUCUNE écriture, aucun appel payant : les gestes de Williams
 * passent par les actions de T-EXT-33.
 *
 * Forme lue : `travail.parametres.tutoriel.equipe` (posée par la fiche d'intégration des rôles). Clés lues, toutes tolérantes :
 * `cahier`, `carte`, `fiche`, `propositionScripts`, `verdict` (obligatoires) ; `scriptChoisi`, `parcours`, `registre`,
 * `miniatures` (clés de stockage par étape), `devis` (`{ phrases, empreinte }`), `dureeFinSec` (facultatives). Une pièce
 * obligatoire qui manque : `null`, et la page dit « Rien à valider pour l'instant ».
 */
import "server-only";
import type { Id, Travail } from "@/domaine/types";
import { ID_FORMAT_TUTORIEL_OUTIL } from "@/formats/tutoriel-outil";
import { construireDossierValidation, type DossierValidation, type EntreeDossierValidation } from "@/moteurs/montage-tutoriel-outil/equipe/dossier-validation";
import { depots, fournisseur } from "./_commun";
import { exigerSession } from "./auth";

export interface DependancesVueValidationTutoriel {
  video?: (videoId: Id) => Promise<{ id: Id; formatId: string } | null>;
  travail?: (videoId: Id) => Promise<Travail | null>;
  /** Signe l'adresse d'une miniature ; `null` si elle n'existe pas (encore). */
  url?: (cle: string) => Promise<string | null>;
}

const objet = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

async function travailParDefaut(videoId: Id): Promise<Travail | null> {
  const liste = await depots().travaux.lister((t) => t.cibleId === videoId && t.type === "fabrication");
  return liste.sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0] ?? null;
}

async function urlParDefaut(cle: string): Promise<string | null> {
  try {
    return (await (await fournisseur("stockage")).urlLecture(cle)) || null;
  } catch {
    return null;
  }
}

/** La carte peut être posée telle quelle ou dans son enveloppe `{ carte }` (lecture de l'analyste). */
function carteDe(brut: unknown): EntreeDossierValidation["carte"] | null {
  const o = objet(brut);
  const c = Array.isArray(o.zones) ? o : objet(o.carte);
  return Array.isArray(c.zones) ? (c as unknown as EntreeDossierValidation["carte"]) : null;
}

/** Les clés de stockage des miniatures deviennent des adresses signées ; une miniature illisible est simplement absente. */
async function signer(brutes: unknown, url: (cle: string) => Promise<string | null>): Promise<Record<string, string>> {
  const sortie: Record<string, string> = {};
  for (const [etapeId, cle] of Object.entries(objet(brutes))) {
    if (typeof cle !== "string" || !cle) continue;
    const u = await url(cle).catch(() => null);
    if (u) sortie[etapeId] = u;
  }
  return sortie;
}

/** Le dossier de validation d'une vidéo ; `null` : vidéo inconnue, d'un autre format, ou rien à valider encore. */
export async function vueValidationTutoriel(videoId: Id, dep: DependancesVueValidationTutoriel = {}): Promise<DossierValidation | null> {
  await exigerSession();
  const video = await (dep.video ?? ((id: Id) => depots().videos.obtenir(id)))(videoId);
  if (!video || video.formatId !== ID_FORMAT_TUTORIEL_OUTIL) return null;
  const travail = await (dep.travail ?? travailParDefaut)(videoId);
  const tuto = objet(travail?.parametres?.tutoriel);
  const equipe = objet(tuto.equipe);
  const carte = carteDe(equipe.carte);
  const cahier = objet(equipe.cahier);
  const fiche = objet(equipe.fiche);
  const proposition = objet(equipe.propositionScripts);
  const verdict = objet(equipe.verdict);
  if (!carte || !Object.keys(cahier).length || !Object.keys(fiche).length || !Array.isArray(proposition.versions) || !verdict.verdict) return null;

  const devis = objet(equipe.devis);
  const entree: EntreeDossierValidation = {
    cahier: cahier as unknown as EntreeDossierValidation["cahier"],
    carte,
    fiche: fiche as unknown as EntreeDossierValidation["fiche"],
    proposition: proposition as unknown as EntreeDossierValidation["proposition"],
    verdict: verdict as unknown as EntreeDossierValidation["verdict"],
    ...(equipe.scriptChoisi ? { scriptChoisi: equipe.scriptChoisi as EntreeDossierValidation["scriptChoisi"] } : {}),
    ...(equipe.parcours ? { parcours: equipe.parcours as EntreeDossierValidation["parcours"] } : {}),
    ...(equipe.registre ? { registre: equipe.registre as EntreeDossierValidation["registre"] } : {}),
    ...(typeof equipe.dureeFinSec === "number" ? { dureeFinSec: equipe.dureeFinSec } : {}),
    ...(Array.isArray(devis.phrases) && typeof devis.empreinte === "string" ? { devis: { phrases: devis.phrases.filter((p): p is string => typeof p === "string"), empreinte: devis.empreinte } } : {}),
  };
  const miniatures = await signer(equipe.miniatures, dep.url ?? urlParDefaut);
  if (Object.keys(miniatures).length) entree.miniatures = miniatures;
  return construireDossierValidation(entree);
}
