/**
 * L5-21 · envoi des visuels (carrousel) depuis le créneau : couche FINE au-dessus de `envoyerVisuel` (L5-02).
 * Il n'existe PAS de second chemin d'envoi : pour un créneau validé portant un visuel, on prépare les fichiers du réseau
 * (LinkedIn = 1 PDF ; Instagram et Facebook = N images, chacune avec son texte alternatif) puis on APPELLE `envoyerVisuel`,
 * qui garde la porte, l'anti-double envoi, la validation du créneau et le brouillon.
 *  - Porte fermée = zéro appel : la porte est relue AVANT toute lecture (créneau, visuel, fichier) ; fermée, rien n'est lu ni appelé.
 *  - Fichier absent, vide ou illisible = zéro appel (vérifié avant `envoyerVisuel`).
 *  - Aucun interrupteur ajouté ni changé ; aucune écriture ici : tout est écrit par `envoyerVisuel`.
 */
import type { FournisseurPublication } from "@/fournisseurs/types";
import { creneauEnvoyable } from "@/domaine/plan-editorial/envoyable";
import { depots, ErreurStudio, fournisseur } from "./_commun";
import { envoyerVisuel } from "./publications";
import { RESEAUX_VISUEL_ENVOI, estReseauVisuelEnvoi, type ReseauVisuelEnvoi } from "@/domaine/reseaux-visuel-envoi";
import { porteCalendrierPour } from "./essai-zernio";

const DUREE_LECTURE_SEC = 900;

export interface OptionsEnvoiVisuelDuCreneau {
  /** Réseaux en images : un texte alternatif par page, dans l'ordre. Inutile pour LinkedIn. */
  textesAlternatifs?: string[];
  /** Adresse lisible d'un fichier du stockage ; par défaut, l'adresse signée du stockage (tests : doublure). */
  lireUrl?: (cle: string) => Promise<string>;
  /** Existence d'un fichier ; par défaut, la taille connue du stockage ; taille inconnue, nulle ou invérifiable = absent. Tests : doublure. */
  fichierExiste?: (cle: string) => Promise<boolean>;
}

export interface ResultatReseau {
  reseau: ReseauVisuelEnvoi;
  ok: boolean;
  deja?: boolean;
  publicationId?: string;
  code?: string;
  message?: string;
}

const FERME = () => new ErreurStudio("ENVOI_CALENDRIER_FERME", "L'envoi du calendrier est fermé (réglage à ouvrir, publication éditoriale comprise) : rien n'est parti.");
const ABSENT = () => new ErreurStudio("FICHIER_ABSENT", "Un fichier du visuel est absent ou illisible : rien n'est parti.");

async function lireParDefaut(cle: string): Promise<string> {
  const stockage = await fournisseur("stockage");
  return stockage.urlLectureDuree ? stockage.urlLectureDuree(cle, DUREE_LECTURE_SEC) : stockage.urlLecture(cle);
}

async function existeParDefaut(cle: string): Promise<boolean> {
  const stockage = await fournisseur("stockage");
  // Existence invérifiable = absent : une adresse signée se fabrique même pour un objet qui n'existe pas.
  if (!stockage.tailleObjet) return false;
  const taille = await stockage.tailleObjet(cle);
  return taille !== null && taille > 0;
}

/** Les fichiers du réseau, dans l'ordre d'envoi : 1 PDF (LinkedIn) ou les pages (Instagram, Facebook). Rien de lisible = refus. */
async function verifierFichiers(visuelId: string, reseau: ReseauVisuelEnvoi, o: OptionsEnvoiVisuelDuCreneau): Promise<void> {
  const v = await depots().visuels.obtenir(visuelId);
  const rendu = v?.rendu;
  if (!v || !rendu) throw ABSENT();
  const pages = [...(rendu.pages ?? [])].sort((a, b) => a.index - b.index);
  const cles = reseau === "linkedin" ? [rendu.pdfCle] : pages.map((p) => p.x1Cle);
  if (!cles.length || cles.some((c) => typeof c !== "string" || !c.trim())) throw ABSENT();
  if (reseau !== "linkedin") {
    const alts = o.textesAlternatifs ?? [];
    if (alts.length < cles.length || cles.some((_, i) => !alts[i]?.trim())) {
      throw new ErreurStudio("TEXTE_ALTERNATIF_MANQUANT", "Chaque page a besoin de son texte alternatif : rien n'est parti.");
    }
  }
  const existe = o.fichierExiste ?? existeParDefaut;
  const lire = o.lireUrl ?? lireParDefaut;
  for (const cle of cles) {
    try {
      if (!(await existe(cle))) throw ABSENT();
      const url = await lire(cle);
      if (typeof url !== "string" || !/^https:\/\//.test(url)) throw ABSENT();
    } catch (e) {
      throw e instanceof ErreurStudio ? e : ABSENT();
    }
  }
}

/** Envoie, en brouillon, le visuel d'UN créneau validé sur UN réseau, par `envoyerVisuel` et nulle part ailleurs. */
export async function envoyerVisuelDuCreneau(service: FournisseurPublication, creneauId: string, reseau: ReseauVisuelEnvoi, options: OptionsEnvoiVisuelDuCreneau = {}) {
  // Porte d'abord : fermée, illisible ou absente = rien n'est lu, rien n'est appelé. Générale, ou essai borné de CE créneau.
  if (!(await porteCalendrierPour(creneauId).catch(() => false))) throw FERME();
  if (!estReseauVisuelEnvoi(reseau)) throw new ErreurStudio("RESEAU", "Ce réseau ne reçoit pas de visuel depuis le calendrier.");
  const c = await depots().creneauxEditoriaux.obtenir(creneauId);
  if (!c || !creneauEnvoyable(c) || !c.visuelId || c.videoId) throw new ErreurStudio("CRENEAU_NON_VALIDE", "Ce créneau n'est pas un créneau validé portant un visuel : rien n'est envoyé.");
  await verifierFichiers(c.visuelId, reseau, options);
  return envoyerVisuel(service, creneauId, reseau, { textesAlternatifs: options.textesAlternatifs, lireUrl: options.lireUrl });
}

/**
 * Tous les réseaux visuels programmés dans le créneau, un par un. La porte est relue une fois d'abord (fermée = erreur, zéro appel) ;
 * ensuite un refus sur un réseau n'empêche pas les autres, et chaque réseau a son résultat.
 */
export async function envoyerVisuelDuCreneauSurReseaux(service: FournisseurPublication, creneauId: string, options: OptionsEnvoiVisuelDuCreneau = {}): Promise<ResultatReseau[]> {
  if (!(await porteCalendrierPour(creneauId).catch(() => false))) throw FERME();
  const c = await depots().creneauxEditoriaux.obtenir(creneauId);
  if (!c) throw new ErreurStudio("CRENEAU_NON_VALIDE", "Ce créneau n'est pas un créneau validé portant un visuel : rien n'est envoyé.");
  const reseaux = RESEAUX_VISUEL_ENVOI.filter((r) => c.heuresParReseau?.[r]);
  const sorties: ResultatReseau[] = [];
  for (const reseau of reseaux) {
    try {
      const r = await envoyerVisuelDuCreneau(service, creneauId, reseau, options);
      sorties.push({ reseau, ok: true, deja: r.deja, publicationId: r.publication.id });
    } catch (e) {
      sorties.push({ reseau, ok: false, code: e instanceof ErreurStudio ? e.code : "ERREUR", message: e instanceof ErreurStudio ? e.message : "Envoi refusé : rien n'est parti." });
    }
  }
  return sorties;
}
