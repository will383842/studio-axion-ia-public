/**
 * L5-09 · reprise après échec (D7-11), FICHE SENSIBLE. Règles :
 *  - le réglage d'envoi du calendrier (éteint par défaut) est lu AVANT tout, même la relecture : éteint = aucun essai ;
 *  - un refus net : UN seul nouvel essai, jamais plus (compté sur la clé de l'envoi, serialisé par clé) ;
 *  - « à vérifier » : relecture seule chez le diffuseur, jamais de renvoi ; en cours ou envoyé : ne repart jamais ;
 *  - le nouvel essai passe par l'envoi normal (`envoyerVisuel`, ou l'envoi de la vidéo) et donc par TOUTES ses gardes ;
 *  - aucune modification d'une publication déjà chez le diffuseur, aucun appel réseau direct, rien n'est supprimé.
 */
import "server-only";
import { outilDe } from "@/domaine/outil-publication";
import type { Publication } from "@/domaine/types";
import type { FournisseurPublication } from "@/fournisseurs/types";
import { depots, ErreurStudio } from "./_commun";
import { reconcilierEnvoi } from "./buffer";
import { ESSAIS_APRES_ECHEC, nombreEssais } from "./calendrier-reprogrammation";
import { envoyerVisuel, type ReseauVisuelEnvoi } from "./publications";
import { publicationEditorialeAutorisee } from "./zernio";

export interface DepsReprise {
  service: FournisseurPublication;
  /** Visuel en images : un texte alternatif par page (jamais mémorisé ailleurs). */
  textesAlternatifs?: string[];
  lireUrl?: (cle: string) => Promise<string>;
  /** Relecture seule d'une publication « à vérifier » (défaut : la relecture de l'envoi normal). */
  relire?: (publicationId: string) => Promise<Publication | null>;
  /** Vidéo : envoi normal d'un réseau (défaut : l'envoi par outil de l'écran « À publier », avec toutes ses gardes). */
  envoyerVideo?: (videoId: string, reseau: Publication["reseau"], dateIso: string, compte: string) => Promise<void>;
}

export type IssueReprise = { action: "envoye"; publication: Publication } | { action: "relu"; publication: Publication | null };

const REPRISE_REFUSEE = (m: string) => new ErreurStudio("REPRISE_REFUSEE", `${m} Rien n'est parti.`);

/** Une reprise à la fois par envoi : le compte des essais est refait une fois la place prise. */
const files = new Map<string, Promise<unknown>>();
async function enFile<T>(cle: string, f: () => Promise<T>): Promise<T> {
  const avant = files.get(cle) ?? Promise.resolve();
  const courant = avant.then(f, f);
  const fin = courant.catch(() => undefined);
  files.set(cle, fin);
  try {
    return await courant;
  } finally {
    if (files.get(cle) === fin) files.delete(cle);
  }
}

export async function reessayerEnvoi(publicationId: string, deps: DepsReprise): Promise<IssueReprise> {
  // 1. La porte AVANT toute lecture : éteint, illisible ou absent = aucun essai, aucune relecture.
  if (!(await publicationEditorialeAutorisee())) throw new ErreurStudio("ENVOI_CALENDRIER_FERME", "L'envoi du calendrier est fermé (réglage à ouvrir, publication éditoriale comprise) : rien n'est parti.");
  const p = await depots().publications.obtenir(publicationId);
  if (!p || outilDe(p) !== "zernio") throw REPRISE_REFUSEE("Cet envoi est introuvable.");
  // 2. « À vérifier » : relecture seule.
  if (p.etatEnvoi === "a-verifier") return { action: "relu", publication: await (deps.relire ?? reconcilierEnvoi)(p.id) };
  if (p.etatEnvoi !== "refuse") throw REPRISE_REFUSEE(p.etatEnvoi === "absent" ? "Rien n'a été reçu chez le diffuseur : vérifiez chez lui avant toute chose." : "Cet envoi est en cours ou déjà parti.");
  const cle = p.cleEnvoi;
  if (!cle) throw REPRISE_REFUSEE("Cet envoi n'a pas d'empreinte.");
  return enFile(cle, async () => {
    // 3. Le compte des essais est fait SOUS la file : un seul nouvel essai, jamais deux en parallèle.
    const groupe = await depots().publications.lister((x) => x.cleEnvoi === cle && outilDe(x) === "zernio");
    if (groupe.some((x) => x.etatEnvoi === "envoye" || x.etatEnvoi === "en-cours" || x.etatEnvoi === "a-verifier")) throw REPRISE_REFUSEE("Cet envoi est en cours, à vérifier ou déjà parti.");
    if (nombreEssais(groupe, cle) > ESSAIS_APRES_ECHEC) throw new ErreurStudio("REPRISE_DEJA_FAITE", "Le nouvel essai a déjà eu lieu : corrigez le contenu ou le créneau. Rien n'est parti.");
    const canal = p.canalId;
    if (!canal) throw REPRISE_REFUSEE("Le compte de destination est inconnu.");
    // 4. Le nouvel essai = l'envoi normal, avec toutes ses gardes.
    if (p.visuelId) {
      const reseau = p.reseau as ReseauVisuelEnvoi;
      const creneaux = await depots().creneauxEditoriaux.lister((c) => c.visuelId === p.visuelId && c.compteCible === canal && c.heuresParReseau?.[reseau] === p.date);
      const creneau = creneaux.find((c) => c.statut === "valide" && !c.refuseLe && !c.retireLe);
      if (!creneau) throw new ErreurStudio("CRENEAU_CHANGE", "Le créneau a changé depuis l'échec : reprogrammez-le dans le calendrier. Rien n'est parti.");
      const r = await envoyerVisuel(deps.service, creneau.id, reseau, { textesAlternatifs: deps.textesAlternatifs, lireUrl: deps.lireUrl });
      return { action: "envoye" as const, publication: r.publication };
    }
    if (!p.videoId) throw REPRISE_REFUSEE("Cet envoi n'a pas de contenu.");
    // Le consentement TikTok n'est jamais mémorisé : une vidéo TikTok ne repart pas d'ici.
    if (p.reseau === "tiktok") throw REPRISE_REFUSEE("TikTok demande votre accord à chaque envoi : refaites l'envoi depuis « À publier ».");
    const envoyerVideo = deps.envoyerVideo ?? envoyerVideoParDefaut;
    await envoyerVideo(p.videoId, p.reseau, p.date, canal);
    const apres = (await depots().publications.lister((x) => x.cleEnvoi === cle && x.etatEnvoi === "envoye"))[0];
    if (!apres) throw new ErreurStudio("ENVOI_REFUSE", "Le nouvel essai n'a pas abouti. Rien d'autre ne partira tout seul.");
    return { action: "envoye" as const, publication: apres };
  });
}

async function envoyerVideoParDefaut(videoId: string, reseau: Publication["reseau"], dateIso: string, compte: string): Promise<void> {
  const { envoyerParOutilAction } = await import("./a-publier-zernio");
  const r = await envoyerParOutilAction(videoId, reseau, dateIso, { outil: "zernio", comptes: [compte] });
  if (!r.ok) throw new ErreurStudio(r.code ?? "ENVOI_REFUSE", r.message);
}
