/**
 * « VOS FICHIERS » DU CAS CONCRET (tâche S1d, plan cas concret § 5 et § 7).
 *
 * `vueCasConcret(videoId)` : ce que la fiche vidéo montre d'une vidéo « Cas concret MD » terminée, lu dans le projet de
 * montage de la version choisie (`projetMontage.casConcret`) : un fichier par réseau (adresse de lecture signée, durée,
 * dimensions lues dans les mesures du fichier), la phrase de la fin et sa raison, le texte de publication, le lien suivi,
 * le premier commentaire, le rapport en phrases, le coût, `essai` et `documentAPreparer`.
 *
 * - La phrase de la fin est retrouvée en rejouant le plan des fins (pur) sur les entrées de la vidéo : le projet de
 *   montage ne garde que les fichiers.
 * - Vidéo d'essai : aucun texte, aucun lien, aucun premier commentaire n'est rendu.
 * - Ce fichier ne publie rien et n'importe ni `publications` ni `buffer`. Aucune exception jusqu'à l'écran : au moindre
 *   doute, une valeur absente.
 * - Ce fichier ne regarde pas le statut du format (l'aiguillage de l'écran s'en charge) : il reconnaît la vidéo à son moteur.
 *
 * `ecritureCasConcret(videoId)` (X9) : pendant ET après la fabrication, le texte réellement écrit (onglet « Sous-titres » :
 * rien tant que l'écriture n'est pas faite) et le détail technique d'une étape en échec (onglet « Historique », pli
 * « Détail technique » : la réponse brute d'une écriture refusée).
 */
import "server-only";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins/table-diagnostic";
import type { Fichier, Id, Travail } from "@/domaine/types";
import type { ReseauCas } from "@/formats/cas-concret";
import { formaterMontant } from "@/lib/montants";
import { casDesEntrees, ID_MOTEUR_CAS_CONCRET, lireEntreesCasConcret } from "@/moteurs/montage-cas-concret";
import { texteDuCorps } from "@/moteurs/montage-cas-concret/fiche";
import { planDesFins, RAISON_SUITE_REDUITE } from "@/moteurs/montage-cas-concret/fins";
import { depots, fournisseur } from "./_commun";
import { exigerSession } from "./auth";
import { reglageAllume, REGLAGES_CAS_CONCRET } from "./cas-concret-reglages";

/* ------------------------------------------------------------------ */
/* Types montrés à l'écran                                               */
/* ------------------------------------------------------------------ */

/** Un fichier, pour un réseau. */
export interface FichierReseauCasConcret {
  reseau: ReseauCas;
  nom: string;
  /** Adresse de lecture signée ; absente : fichier pas encore disponible. */
  url?: string;
  dureeSec: number;
  /** « 1080 × 1920 » ; absente : le fichier n'a pas de mesure. */
  dimensions?: string;
  /** « Fin : mot et envoi » ou « Fin : diagnostic et lien » ; absente : fin inconnue. */
  phraseFin?: string;
  /** Pourquoi la fin est réduite ; absente : la fin est complète. */
  raisonFin?: string;
  /** Absents pour une vidéo d'essai. */
  texte?: string;
  lien?: string;
  premierCommentaire?: string;
  consigneLien?: string;
}

export interface VueCasConcret {
  fichiers: FichierReseauCasConcret[];
  rapport: { verdict: "ok" | "bloque"; resume: string; phrases: string[] } | null;
  /** Coût réel de la vidéo, en centimes d'euro. */
  coutCentimes: number;
  /** « 0,42 € ». */
  cout: string;
  /** Vidéo d'essai : cas à confirmer, ne pas publier. */
  essai: boolean;
  /** Vrai quand la fin d'un réseau promet l'envoi (ligne « cadeau » ou fin au mot) : le document est à préparer avant de publier. */
  documentAPreparer: boolean;
  /** Réglage `casConcret.documentPromis` allumé : le bloc « Document promis » de la fiche porte l'état, la phrase de « Vos fichiers » s'efface. */
  documentOuvert?: boolean;
}

export interface DependancesVueCasConcret {
  /** Adresse de lecture d'un fichier du stockage, par sa clé (par défaut : celle du stockage du studio). */
  urlDeCle?: (cle: string) => Promise<string | null>;
}

/* ------------------------------------------------------------------ */
/* Pièces pures                                                          */
/* ------------------------------------------------------------------ */

const NOM_RESEAU: Readonly<Record<ReseauCas, string>> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn" };
const RESEAUX: readonly ReseauCas[] = ["facebook", "instagram", "tiktok", "linkedin"];
const MOT_DE_LIGNE: Readonly<Record<string, string>> = { commentaire: "mot", cadeau: "envoi", "rendez-vous": "diagnostic", lien: "lien" };
const RAISON_SANS_MOT = "Fin sans le mot à commenter : la vidéo propose le diagnostic.";

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const texteNonVide = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const nombre = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);

/** « diagnostic et lien ». */
function listeFrancaise(t: readonly string[]): string {
  return t.length <= 1 ? (t[0] ?? "") : `${t.slice(0, -1).join(", ")} et ${t[t.length - 1]}`;
}

/** Phrase de la fin d'après les types de lignes de la suite (PUR). */
export function phraseDeFin(types: readonly string[]): string {
  const dans = new Set(types);
  // Une fin au mot promet toujours l'envoi : en ligne à part, ou dans la même phrase (Instagram, X7).
  if (dans.has("commentaire")) dans.add("cadeau");
  const dites = ["commentaire", "cadeau", "rendez-vous", "lien"].filter((t) => dans.has(t)).map((t) => MOT_DE_LIGNE[t]);
  return `Fin : ${listeFrancaise(dites)}`;
}

/** « 1080 × 1920 » d'après des mesures (largeur, hauteur) ; `undefined` si l'une manque (PUR). */
export function dimensionsDe(largeur: unknown, hauteur: unknown): string | undefined {
  const l = nombre(largeur);
  const h = nombre(hauteur);
  return l && h ? `${Math.round(l)} × ${Math.round(h)}` : undefined;
}

interface FinGardee {
  id: string;
  reseaux: ReseauCas[];
  fichierCle: string;
  dureeSec: number;
  mesures?: Record<string, unknown>;
}

function finsGardees(brut: unknown): FinGardee[] {
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((x): FinGardee[] => {
    const f = objet(x);
    if (!f || !texteNonVide(f.id) || !texteNonVide(f.fichierCle) || !Array.isArray(f.reseaux)) return [];
    const mesures = objet(f.mesures);
    return [{ id: f.id, reseaux: f.reseaux.filter((r): r is ReseauCas => RESEAUX.includes(r as ReseauCas)), fichierCle: f.fichierCle, dureeSec: nombre(f.dureeSec) ?? 0, ...(mesures ? { mesures } : {}) }];
  });
}

/* ------------------------------------------------------------------ */
/* Lecture                                                               */
/* ------------------------------------------------------------------ */

async function urlDeCleReelle(cle: string): Promise<string | null> {
  return (await (await fournisseur("stockage")).urlLecture(cle)) || null;
}

/** Fins rejouées : pour chaque réseau, les types de lignes de sa fin et la raison d'une suite réduite. */
function finsRejouees(entrees: ReturnType<typeof lireEntreesCasConcret>): Map<ReseauCas, { types: string[]; raison?: string }> {
  const parReseau = new Map<ReseauCas, { types: string[]; raison?: string }>();
  // P2S : le cas d'une vidéo de la porte B est gardé avec elle (jamais au catalogue).
  const cas = casDesEntrees(entrees);
  if (!cas || !entrees.reseaux.length) return parReseau;
  try {
    const plan = planDesFins({ reseaux: entrees.reseaux, offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot: entrees.mot ?? "", ...(entrees.motDit ? { motDit: entrees.motDit } : {}), avecMot: entrees.avecMot, motSur: entrees.motSur, table: TABLE_FINS_DIAGNOSTIC });
    for (const fin of plan.fins) {
      const reduite = plan.reduites.find((r) => fin.reseaux.some((x) => r.reseaux.includes(x)));
      const raison = reduite ? (reduite.raison || RAISON_SUITE_REDUITE) : !entrees.avecMot ? RAISON_SANS_MOT : undefined;
      for (const reseau of fin.reseaux) parReseau.set(reseau, { types: fin.appels.map((a) => a.type), ...(raison ? { raison } : {}) });
    }
  } catch {
    // Plan impossible à rejouer (cas retiré du catalogue, mot absent) : aucune phrase de fin, jamais une erreur.
  }
  return parReseau;
}

/** Fichiers, textes, liens, rapport et coût d'une vidéo « Cas concret MD » ; `null` hors de ce moteur ou sans résultat. */
export async function vueCasConcret(videoId: Id, dependances: DependancesVueCasConcret = {}): Promise<VueCasConcret | null> {
  await exigerSession();
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const version = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!version || version.commande.moteurId !== ID_MOTEUR_CAS_CONCRET) return null;
  const projet = objet(objet(version.projetMontage)?.casConcret);
  if (!projet) return null;

  const entrees = lireEntreesCasConcret(version.commande.entrees);
  const fins = finsGardees(projet.fins);
  const rejoue = finsRejouees(entrees);
  const liens = objet(projet.liens) ?? {};
  const textes = new Map<string, Record<string, unknown>>();
  if (Array.isArray(projet.publication)) for (const p of projet.publication) { const o = objet(p); if (o && texteNonVide(o.reseau)) textes.set(o.reseau, o); }

  // Dimensions : les mesures gardées avec la fin, sinon la fiche du fichier rangé sous cette clé.
  const cles = new Set(fins.map((f) => f.fichierCle));
  const fichiers: Fichier[] = cles.size ? await d.fichiers.lister((f) => cles.has(f.cleStockage)) : [];
  const urlDeCle = dependances.urlDeCle ?? urlDeCleReelle;
  const urls = new Map<string, string>();
  await Promise.all([...cles].map(async (cle) => {
    try {
      const u = await urlDeCle(cle);
      if (u) urls.set(cle, u);
    } catch {
      // Adresse indisponible : le fichier est « pas encore disponible », sans casser la page.
    }
  }));

  const essai = entrees.essai;
  const ordre = entrees.reseaux.length ? entrees.reseaux : RESEAUX.filter((r) => fins.some((f) => f.reseaux.includes(r)));
  const lignes: FichierReseauCasConcret[] = ordre.flatMap((reseau) => {
    const fin = fins.find((f) => f.reseaux.includes(reseau));
    if (!fin) return [];
    const fiche = fichiers.find((f) => f.cleStockage === fin.fichierCle);
    const dimensions = dimensionsDe(fin.mesures?.largeur, fin.mesures?.hauteur) ?? dimensionsDe(fiche?.largeur, fiche?.hauteur);
    const fait = rejoue.get(reseau);
    const publication = textes.get(reseau);
    const lien = texteNonVide(liens[reseau]) ? (liens[reseau] as string) : undefined;
    const url = urls.get(fin.fichierCle);
    return [{
      reseau,
      nom: NOM_RESEAU[reseau],
      ...(url ? { url } : {}),
      dureeSec: fin.dureeSec,
      ...(dimensions ? { dimensions } : {}),
      ...(fait ? { phraseFin: phraseDeFin(fait.types) } : {}),
      ...(fait?.raison ? { raisonFin: fait.raison } : {}),
      ...(!essai && texteNonVide(publication?.texte) ? { texte: publication.texte } : {}),
      ...(!essai && lien ? { lien } : {}),
      ...(!essai && texteNonVide(publication?.premierCommentaire) ? { premierCommentaire: publication.premierCommentaire } : {}),
      ...(!essai && texteNonVide(publication?.consigneLien) ? { consigneLien: publication.consigneLien } : {}),
    }];
  });

  const r = objet(projet.rapport);
  const rapport: VueCasConcret["rapport"] = r && (r.verdict === "ok" || r.verdict === "bloque") ? { verdict: r.verdict as "ok" | "bloque", resume: typeof r.resume === "string" ? r.resume : "", phrases: Array.isArray(r.phrases) ? r.phrases.filter(texteNonVide) : [] } : null;
  const cout = version.coutReel ?? { centimes: 0, devise: "EUR" as const };

  return {
    fichiers: lignes,
    rapport,
    coutCentimes: cout.centimes,
    cout: formaterMontant(cout),
    essai,
    // Une fin au mot promet toujours l'envoi (ligne « cadeau », ou la phrase d'Instagram qui le dit elle-même, X7).
    documentAPreparer: ordre.some((reseau) => rejoue.get(reseau)?.types.some((t) => t === "cadeau" || t === "commentaire")),
    // Ouvert seulement si le bloc « Document promis » peut s'afficher (réglage allumé ET cas connu) : sinon la phrase reste.
    documentOuvert: (await reglageAllume(REGLAGES_CAS_CONCRET.documentPromis)) && !!casDesEntrees(entrees),
  };
}

/* ------------------------------------------------------------------ */
/* Écriture (X9) : texte écrit et détail technique                       */
/* ------------------------------------------------------------------ */

export interface EcritureCasConcretVue {
  /** Le texte dit du corps, une fois l'écriture faite ; `null` avant (l'onglet dit « Le texte arrive après l'écriture »). */
  texteDit: string | null;
  /** Détail technique de l'étape en échec (raison, puis réponse brute d'une écriture refusée) ; `null` sans échec. */
  detailTechnique: string | null;
}

/** Texte dit d'une fiche gardée (journal ou projet de montage) ; `null` si elle est illisible. */
function texteDeFiche(fiche: unknown): string | null {
  const ecrans = objet(fiche)?.ecrans;
  if (!Array.isArray(ecrans) || !ecrans.every((e) => texteNonVide(objet(e)?.texteDit))) return null;
  const t = texteDuCorps({ ecrans: ecrans as { texteDit: string }[] } as Parameters<typeof texteDuCorps>[0]);
  return t.trim() ? t : null;
}

/** Ce que montrent les onglets d'après le travail et le projet de montage (PUR). */
export function ecritureDuTravail(travail: Pick<Travail, "etapes" | "erreur" | "parametres"> | null, projetMontage?: unknown): EcritureCasConcretVue {
  const journal = objet(objet(travail?.parametres?.casConcret)?.journal);
  const ecrite = objet(objet(objet(journal?.etapes)?.ecriture)?.sortie)?.fiche;
  const texteDit = texteDeFiche(ecrite) ?? texteDeFiche(objet(objet(projetMontage)?.casConcret)?.fiche);
  const enEchec = travail?.etapes.find((e) => e.statut === "echec")?.erreur ?? travail?.erreur;
  return { texteDit, detailTechnique: texteNonVide(enEchec?.detailTechnique) ? enEchec.detailTechnique : null };
}

/** Écriture de la dernière version d'une vidéo « Cas concret MD » ; `null` hors de ce moteur. Jamais d'exception. */
export async function ecritureCasConcret(videoId: Id): Promise<EcritureCasConcretVue | null> {
  await exigerSession();
  const d = depots();
  const versions = await d.versions.lister((v) => v.videoId === videoId && v.commande?.moteurId === ID_MOTEUR_CAS_CONCRET);
  const derniere = versions.sort((a, b) => b.numero - a.numero)[0];
  if (!derniere) return null;
  try {
    const travail = derniere.travailId ? await d.travaux.obtenir(derniere.travailId) : null;
    return ecritureDuTravail(travail ?? null, derniere.projetMontage);
  } catch {
    return { texteDit: null, detailTechnique: null };
  }
}
