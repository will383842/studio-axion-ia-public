/**
 * Page « À publier », finitions de l'envoi : la ligne « compte + date » près du bouton, le message après un envoi réussi
 * et la vidéo suivante à traiter. Pure mise en forme : aucune règle d'envoi ici.
 */
import type { LigneAPublier } from "@/services/a-publier";
import { FILTRE_PAR_DEFAUT, TRANCHE, type FiltreListe } from "./liste-a-publier";
import { etatDeLigne, lienDetailReseau, type ReseauListe } from "./liste-par-reseau";

const FORMAT_DATE = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** « lundi 5 octobre, 09:00 », ou rien si la date n'est pas lisible. */
export function dateLisible(valeur: string): string | null {
  const d = new Date(valeur);
  return Number.isNaN(d.getTime()) ? null : FORMAT_DATE.format(d);
}

/** Une ligne lisible : le compte Buffer et la date, visibles sans ouvrir le détail. `noms` : les comptes cochés ou mémorisés ; `aCocher` : l'écran demande de cocher un compte. */
export function ligneCompteEtDate(noms: string[], valeurDate: string, aCocher = false): string {
  const compte = noms.length ? noms.join(", ") : aCocher ? "aucun compte coché" : "Compte lu au premier envoi";
  const date = dateLisible(valeurDate);
  return date ? `Compte : ${compte} · Date : ${date}` : `Compte : ${compte} · Date à choisir`;
}

/** Message affiché après un envoi réussi : on reste sur la vidéo. */
export function messageSucces(mode: "brouillon" | "programmer" | undefined, comptes: number): string {
  const sur = comptes > 1 ? `${comptes} comptes` : "1 compte";
  return mode === "programmer"
    ? `Envoyé : programmée dans Buffer sur ${sur}.`
    : `Envoyé : la vidéo est en brouillon dans Buffer (${sur}). Relisez-la puis programmez-la dans Buffer.`;
}

const CATEGORIE_DU_FILTRE: Record<Exclude<FiltreListe, "toutes">, string> = { "a-envoyer": "a-envoyer", envoyees: "envoyee", publiees: "publiee", problemes: "probleme" };

/** La prochaine vidéo (autre que l'actuelle) du filtre actif, sur le réseau demandé (celui du panneau qui vient d'envoyer) ; son adresse de détail. */
export function videoSuivante(lignes: LigneAPublier[], actuelle: string, reseau: ReseauListe, filtre: FiltreListe = FILTRE_PAR_DEFAUT, affichees = TRANCHE): string | null {
  const suivante = lignes.find(
    (l) =>
      l.videoId !== actuelle &&
      (reseau === "tous" || l.reseau === reseau) &&
      (filtre === "toutes" ? etatDeLigne(l).categorie !== "essai" : etatDeLigne(l).categorie === CATEGORIE_DU_FILTRE[filtre]),
  );
  return suivante ? lienDetailReseau(suivante.videoId, suivante.reseau, filtre, affichees, reseau === "tous") : null;
}
