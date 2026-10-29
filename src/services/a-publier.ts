/**
 * Page « À publier » (vidéos) : des vidéos validées jusqu'à Buffer, SANS nouvel état ni nouvelle table. Ce fichier ne fait
 * que LIRE et mettre en forme ; les envois passent par `envoyerVersBuffer` et `programmerSujet` (mêmes gardes : « Avant de
 * publier », anti-doublon, brouillon par défaut, vidéos d'exemple et d'essai refusées, rien d'envoyé en simulation).
 * L'interrupteur de la page est éteint par défaut ; seul le booléen exact `true` l'allume.
 */
import "server-only";
import { libellePublication, occupeBuffer } from "@/domaine/buffer";
import type { ComptesReseauEnvoi } from "@/domaine/comptes-envoi";
import type { IdReseau, ModeEnvoiPublication, Publication } from "@/domaine/types";
import type { Tonalite } from "@/domaine/libelles";
import { premierCommentaireTransmissible } from "@/fournisseurs/publication/buffer";
import { depots, ecrireParametre, ErreurStudio, filtreExemples, journaliser, lireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";
import { vueEnvoiBuffer } from "./buffer";
import { premierCommentaireDeVideo } from "./premier-commentaire";
import { casesRequises } from "@/formats";
import { LIBELLES_VERIFICATIONS, listerAPublier, obtenirKit, reseauxParDefaut, texteAEnvoyer, verificationsManquantes } from "./publications";
import { versCarte } from "./presentation";

type CleAvant = keyof typeof LIBELLES_VERIFICATIONS;

export const PARAM_PAGE_A_PUBLIER = "aPublier.page";

/** Durée pendant laquelle une vidéo publiée reste visible dans la page (avec son lien). */
const JOURS_PUBLIEES_VISIBLES = 14;

export async function pageAPublierAllumee(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(PARAM_PAGE_A_PUBLIER, false)) === true;
  } catch {
    return false;
  }
}

export async function definirPageAPublier(valeur: unknown): Promise<boolean> {
  await exigerSession();
  if (valeur !== true && valeur !== false) throw new ErreurStudio("CHOIX_INCONNU", "Ce choix n'existe pas.");
  if ((await lireParametre<unknown>(PARAM_PAGE_A_PUBLIER, null)) !== valeur) {
    await ecrireParametre(PARAM_PAGE_A_PUBLIER, valeur);
    await journaliser("reglages", `Page « À publier » : ${valeur ? "allumée" : "éteinte"}`);
  }
  return valeur;
}

export interface EtatLigneAPublier {
  libelle: string;
  ton: Tonalite;
  /** Adresse de la publication une fois publiée. */
  lien?: string;
  /** Raison d'un échec ou d'un envoi à vérifier. */
  detail?: string;
  /** Plus d'envoi depuis cette page : le réseau (un seul compte) ou TOUS ses comptes à cocher sont déjà pris dans Buffer. */
  envoye: boolean;
  /** Comptes du réseau déjà pris dans Buffer (le serveur raisonne par compte, comme `occupees` de publications.ts). */
  comptesPris: string[];
  /** Un envoi plus ancien sans compte connu occupe le réseau entier. */
  sansCompte: boolean;
}

export interface LigneAPublier {
  famille: "video";
  /** Identifiant stable d'une ligne : vidéo + réseau. */
  cle: string;
  videoId: string;
  titre: string;
  jaquette: string | null;
  /** Lecture sur place (fichier du réseau, sinon vidéo principale). */
  lecture: string | null;
  /** Taille réelle du fichier lu (ex. 1080x1350), quand elle est connue : le lecteur montre la vidéo entière. */
  dimensions?: { largeur: number; hauteur: number };
  /** Type de la vidéo (nom du format), pour la liste. */
  typeVideo?: string;
  /** Date de création de la vidéo, pour trier les plus récentes d'abord. */
  creeLe?: string;
  reseau: IdReseau;
  reseauNom: string;
  /** Texte du post tel que le kit l'écrit (modifiable), sans les mots-dièse. */
  texte: string;
  motsDiese: string[];
  titreReseau?: string;
  /** Ce qui partira vraiment (série, texte, mots-dièse). */
  apercu: string;
  premierCommentaire?: string;
  /** Instagram, Facebook, LinkedIn : transmis par Buffer ; les autres : à poser à la main. */
  commentaireTransmissible: boolean;
  /** Compte Buffer : celui mémorisé, les comptes à cocher, ou ce qui manque. Jamais deviné. */
  compte: ComptesReseauEnvoi;
  /** Vérifications « Avant de publier » encore à cocher. */
  manquantes: { cle: CleAvant; libelle: string }[];
  casesRequises: CleAvant[];
  coches: Record<string, boolean>;
  /** Pourquoi cette ligne ne peut pas partir (essai, exemple, licence, fichier absent…). */
  blocage?: string;
  /** Le blocage vaut pour toute la vidéo (essai, exemple), pas pour ce seul réseau. */
  blocageVideo?: boolean;
  /** Sujet de la version (pour « Programmer »). */
  sujetId?: string;
  etat?: EtatLigneAPublier;
}

export interface VueAPublier {
  /** Aucun envoi réel : le fournisseur est en simulation. */
  envoiSimule: boolean;
  modeBuffer: ModeEnvoiPublication | null;
  lignes: LigneAPublier[];
}

/** « 1080x1350 » -> taille ; rien si la valeur est absente ou illisible. */
export function dimensionsDe(resolution: string | undefined): { largeur: number; hauteur: number } | undefined {
  const m = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(resolution ?? "");
  return m && +m[1] > 0 && +m[2] > 0 ? { largeur: +m[1], hauteur: +m[2] } : undefined;
}

/** `occupees` : les publications de ce réseau qui occupent déjà Buffer (pas seulement la dernière). Le blocage se fait par compte. */
function etatDe(p: Publication | undefined, occupees: Publication[], choix: { id: string }[] = []): EtatLigneAPublier | undefined {
  if (!p) return undefined;
  const { libelle, ton } = libellePublication(p);
  const comptesPris = [...new Set(occupees.flatMap((x) => (x.canalId ? [x.canalId] : [])))];
  const sansCompte = occupees.some((x) => !x.canalId);
  const envoye = occupees.length > 0 && (!choix.length || sansCompte || choix.every((c) => comptesPris.includes(c.id)));
  return { libelle, ton, envoye, comptesPris, sansCompte, ...(p.statut === "publiee" && p.urlPubliee ? { lien: p.urlPubliee } : {}), ...(p.erreur ? { detail: p.erreur } : {}) };
}

/**
 * Une ligne par vidéo validée (ou déjà programmée, ou publiée depuis peu) et par réseau voulu : le réseau de sa version, sinon
 * les réseaux par défaut du studio qui ont un fichier. N'appelle JAMAIS Buffer.
 */
export async function vueAPublier(): Promise<VueAPublier> {
  await exigerSession();
  const d = depots();
  const exemples = await filtreExemples<{ estDemo?: boolean }>();
  const validees = await listerAPublier();
  const limite = new Date(Date.parse(maintenant()) - JOURS_PUBLIEES_VISIBLES * 86_400_000).toISOString();
  const dejaIds = new Set(validees.map((v) => v.id));
  const suivantes = await d.videos.lister((v) => exemples(v) && v.statut === "prete" && !dejaIds.has(v.id) && (v.etapeEditoriale === "programmee" || v.etapeEditoriale === "publiee"));
  const recentes: typeof validees = [];
  for (const v of suivantes) {
    const pubs = await d.publications.lister((p) => p.videoId === v.id && p.date >= limite);
    if (pubs.length) recentes.push({ ...(await versCarte(v)), famille: "video" });
  }
  const envoi = await vueEnvoiBuffer();
  const parDefaut = await reseauxParDefaut();
  const lignes: LigneAPublier[] = [];
  for (const carte of [...validees, ...recentes]) {
    const kit = await obtenirKit(carte.id);
    if (!kit) continue;
    const pubs = await d.publications.lister((p) => p.videoId === carte.id);
    const voulus = kit.variante ? [kit.variante.reseau] : parDefaut;
    const manquantes = verificationsManquantes(kit);
    const video = await d.videos.obtenir(carte.id);
    for (const reseau of voulus) {
      const r = kit.reseaux.find((x) => x.reseau === reseau);
      if (!r) continue;
      const deCeReseau = pubs.filter((p) => p.reseau === reseau);
      const derniere = [...deCeReseau].sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0];
      const commentaire = await premierCommentaireDeVideo(carte.id, reseau, kit.variante);
      let blocage: string | undefined;
      let blocageVideo = false;
      if (kit.videoEssai) [blocage, blocageVideo] = ["Vidéo d'essai : elle ne part pas sur vos réseaux.", true];
      else if (video?.estDemo) [blocage, blocageVideo] = ["Vidéo d'exemple : elle ne part pas sur vos réseaux.", true];
      else if (!r.sortieConseillee) blocage = `Aucun fichier au bon format pour ${r.nom}.`;
      else blocage = r.avertissements.find((a) => a.code === "trop-longue" || a.code === "ratio-absent")?.message;
      lignes.push({
        famille: "video",
        cle: `${carte.id}:${reseau}`,
        videoId: carte.id,
        titre: carte.titre,
        jaquette: carte.vignette,
        lecture: r.sortieConseillee?.url ?? carte.video,
        ...(dimensionsDe(r.sortieConseillee?.resolution) ? { dimensions: dimensionsDe(r.sortieConseillee?.resolution) } : {}),
        typeVideo: carte.format.nom,
        creeLe: carte.creeLe,
        reseau,
        reseauNom: r.nom,
        texte: r.texte,
        motsDiese: r.motsDiese,
        ...(r.titre ? { titreReseau: r.titre } : {}),
        apercu: texteAEnvoyer(r, kit.serie?.entete),
        ...(commentaire ? { premierCommentaire: commentaire } : {}),
        commentaireTransmissible: premierCommentaireTransmissible(reseau),
        compte: envoi?.comptes[reseau] ?? {},
        manquantes: manquantes.map((cle) => ({ cle, libelle: LIBELLES_VERIFICATIONS[cle] })),
        casesRequises: casesRequises(kit.mentionIAActive),
        coches: kit.avantDePublier,
        ...(blocage ? { blocage } : {}),
        ...(blocageVideo ? { blocageVideo } : {}),
        ...(kit.variante?.sujetId ? { sujetId: kit.variante.sujetId } : {}),
        etat: etatDe(derniere, deCeReseau.filter(occupeBuffer), envoi?.comptes[reseau]?.choix),
      });
    }
  }
  return { envoiSimule: envoi === null, modeBuffer: envoi?.mode ?? null, lignes };
}
