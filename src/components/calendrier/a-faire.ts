/**
 * « À faire » du calendrier : les tentatives REMPLACÉES sont masquées, les restantes d'un même visuel et d'un même réseau sont
 * regroupées en une ligne. Affichage seulement : aucune donnée n'est écrite, supprimée ni envoyée au diffuseur.
 */
import { obtenirReseau } from "@/reseaux";
import type { IdReseau } from "@/domaine/types";
import { adresseVueJour } from "@/lib/calendrier-plages";
import { debutDeTexte } from "./VueJour";
import { entreeDepuisPublication, etatAffiche, type PublicationApercu } from "./apercu-reseau";
import type { EntreeAFaire } from "./PanneauAFaire";

export type PubAFaire = PublicationApercu & { creeLe?: string; modifieLe?: string };

export const RAISON_ECHEC = "envoi en échec";
export const RAISON_BROUILLON = "brouillon non envoyé";

/** Le contenu : le visuel, sinon la vidéo, sinon le texte (même texte = même contenu). */
function sourceDe(p: PubAFaire): string {
  if (p.visuelId) return `visuel:${p.visuelId}`;
  if (p.videoId) return `video:${p.videoId}`;
  return `texte:${p.texte.trim().replace(/\s+/g, " ")}`;
}

const horodatage = (p: PubAFaire): string => p.creeLe ?? p.modifieLe ?? "";

/** Une tentative à montrer (échec ou brouillon), par opposition à une publication réussie ou programmée. */
function estTentative(p: PubAFaire): boolean {
  return p.via !== "simulation" && (etatAffiche(p) === "a_corriger" || p.statut === "brouillon");
}

/** Publiée, ou programmée chez le diffuseur (envoi ni refusé, ni absent, ni à vérifier). */
function estReussie(p: PubAFaire): boolean {
  if (p.via === "simulation") return false;
  if (p.statut === "publiee") return true;
  return p.statut === "programmee" && (p.etatEnvoi === undefined || p.etatEnvoi === "envoye" || p.etatEnvoi === "en-cours");
}

/** Remplacée : une publication réussie, plus récente, du même contenu sur le même réseau existe. */
export function estRemplacee(p: PubAFaire, toutes: readonly PubAFaire[]): boolean {
  if (!estTentative(p)) return false;
  const source = sourceDe(p);
  return toutes.some((q) => {
    if (q.id === p.id || q.reseau !== p.reseau || !estReussie(q) || sourceDe(q) !== source) return false;
    const a = horodatage(p);
    const b = horodatage(q);
    return !a || !b || b > a;
  });
}

/** Les publications sans les tentatives remplacées (même règle pour la vue jour). */
export function sansRemplacees<T extends PubAFaire>(pubs: readonly T[], toutes: readonly PubAFaire[] = pubs): T[] {
  return pubs.filter((p) => !estRemplacee(p, toutes));
}

/** Entrées du panneau « À faire » : remplacées masquées, tentatives d'un même visuel et réseau regroupées. */
export function entreesAFaire(publications: readonly PubAFaire[]): EntreeAFaire[] {
  const reelles = publications.filter((p) => p.via !== "simulation");
  const restantes = sansRemplacees(reelles, publications);
  const sortie: EntreeAFaire[] = [];
  const groupes = new Map<string, { premiere: PubAFaire; n: number; index: number }>();
  for (const p of restantes) {
    const e = entreeDepuisPublication(p);
    const etat = e.etat === "brouillon_buffer" ? "brouillon" : e.etat;
    const titre = debutDeTexte(p.texte) || e.titre;
    const href = e.lienSource ?? adresseVueJour(e.jour);
    if (etat !== "a_corriger" && etat !== "brouillon") {
      sortie.push({ cle: e.cle, etat, titre, href });
      continue;
    }
    const reseau = obtenirReseau(p.reseau as IdReseau).nom;
    const raison = etat === "a_corriger" ? RAISON_ECHEC : RAISON_BROUILLON;
    const cle = `${etat}|${sourceDe(p)}|${p.reseau}`;
    const g = groupes.get(cle);
    if (g) {
      g.n += 1;
      const ligne = sortie[g.index];
      sortie[g.index] = { ...ligne, tentatives: g.n };
      continue;
    }
    groupes.set(cle, { premiere: p, n: 1, index: sortie.length });
    sortie.push({ cle: e.cle, etat, titre, href, reseau, raison, tentatives: 1 });
  }
  return sortie;
}
