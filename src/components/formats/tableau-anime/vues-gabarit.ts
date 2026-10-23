/** Adaptateurs purs du tableau animé vers les composants communs de création (récents, suivi). */
import type { RecentGenerateur } from "@/components/creation/RecentsGenerateur";
import type { EtatEtapeSuivi, VueSuiviFabrication } from "@/components/creation/SuiviFabrication";
import type { TravailTableauLu } from "./EtapesTableau";
import { erreurEnClair, etapesSuivi } from "./vue";
import type { BrouillonRecentTableau } from "@/services/tableau-creation";
import type { VueTacheTableau } from "@/services/tableau-taches";

export function versRecentsTableau(recents: BrouillonRecentTableau[]): RecentGenerateur[] {
  return recents.map((r) => ({ id: r.videoId, href: `/tableau/nouvelle?brouillon=${encodeURIComponent(r.videoId)}`, titre: r.titre, etat: r.etat, date: r.date }));
}

const ETAPES_ECRITURE = [
  { cle: "accroches", libelle: "Les accroches" },
  { cle: "ecriture", libelle: "L'écriture" },
  { cle: "relecture", libelle: "La relecture" },
];

/** Étape du service → étape affichée (la relance fait partie de l'écriture). */
const ETAPE_AFFICHEE = { accroches: "accroches", ecriture: "ecriture", relance: "ecriture", relecture: "relecture", decoupage: "decoupage" } as const;

export function versSuiviTacheTableau(t: VueTacheTableau): VueSuiviFabrication {
  const modele = t.type === "decoupage" ? [{ cle: "decoupage", libelle: "Le découpage en scènes" }] : ETAPES_ECRITURE;
  const courante = Math.max(0, modele.findIndex((e) => e.cle === ETAPE_AFFICHEE[t.etape]));
  const arretee = t.statut === "erreur" || t.statut === "interrompue" || t.statut === "refusee";
  const etapes = modele.map((e, i) => {
    let etat: EtatEtapeSuivi = i < courante ? "faite" : i === courante ? "en-cours" : "a-venir";
    if (t.statut === "terminee") etat = "faite";
    else if (arretee && i === courante) etat = "arretee";
    else if (t.statut === "en-attente" && i === courante) etat = "a-venir";
    return { ...e, etat };
  });
  if (t.statut === "terminee") return { etat: "prete", etapes };
  if (arretee) return { etat: "arretee", etapes, message: t.phrase };
  if (t.statut === "en-attente" && t.boucleArretee) return { etat: "coincee", etapes, message: t.phrase };
  return { etat: "en-cours", etapes };
}

/**
 * Suivi d'une fabrication du tableau : les 4 groupes parlants de `vue.ts` (`etapesSuivi`), l'erreur en clair sur le groupe en échec
 * (réessayable ou non), la place dans la file. Aucun champ d'argent : la voix déjà payée se dit dans le composant.
 */
export function versSuiviFabricationTableau(t: TravailTableauLu): VueSuiviFabrication {
  const echec = t.statut === "echec";
  const annule = t.statut === "annule";
  const erreur = echec ? erreurEnClair(t) : null;
  const etapes = etapesSuivi(t.etapes, { arrete: echec || annule }).map((g) => {
    const etat: EtatEtapeSuivi = g.statut === "echec" ? "arretee" : g.statut;
    return { cle: g.nom, libelle: g.nom, etat, ...(etat === "arretee" && erreur ? { erreur: { message: erreur.message, reessayable: erreur.reessayable } } : {}) };
  });
  const etat = t.statut === "termine" ? "prete" : echec ? "coincee" : annule ? "arretee" : "en-cours";
  return { etat, etapes, ...(t.statut === "en_file" && t.rang ? { suivi: { rang: t.rang } } : {}) };
}
