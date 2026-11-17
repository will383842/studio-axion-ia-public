/**
 * COMMENTAIRES · dépôt DURABLE (paramètre `commentaires.depot`). Aucune migration : le paramètre existe déjà comme mécanisme de stockage.
 * RÈGLE : ON GARDE TOUT. Aucune suppression, aucun nettoyage automatique, aucune anonymisation, aucune durée de conservation qui efface ;
 * aucune fonction de ce fichier ne retire ou ne réécrit le texte d'une ligne. Seul un écrivain humain (le fondateur) décide, par écrit.
 * L'auteur est une EMPREINTE (jamais d'adresse e-mail, jamais l'identifiant brut). Une opposition ou une demande d'effacement met
 * la personne à l'écart des envois (registre d'opposition commun `mots.oppositions`, jamais supprimé) et lève une alerte pour le fondateur ; rien n'est supprimé.
 * Jamais de journal du texte d'un commentaire ni d'un identifiant de personne. Aucun envoi, aucune réponse, aucun appel réseau.
 * Non branché : rien n'appelle encore ce dépôt (voir le rapport de la fiche).
 */
import "server-only";
import { candidatsEmpreinte, empreintePersonne, ErreurEmpreinteIndisponible, lireClesEmpreinte } from "@/domaine/guide-reseau/empreinte-personne";
import { empreintesOpposees, enregistrerOppositionParEmpreinte } from "./oppositions-mots";
import { ecrireParametre, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";

export const PARAM_COMMENTAIRES_DEPOT = "commentaires.depot";
export const TYPE_JOURNAL_EFFACEMENT = "commentaire_effacement_demande";

export interface NouveauCommentaire {
  /** Identifiant unique de l'événement (sert au rejeu : un doublon est ignoré). */
  idEvenement: string;
  reseau: string;
  post: string;
  /** Empreinte de l'auteur (`empreinteAuteur`), jamais un identifiant brut ni une adresse. */
  auteur: string;
  texte: string;
  recuLe: string;
}

export interface LigneCommentaire extends NouveauCommentaire {
  /** Personne à l'écart des envois (opposition ou demande d'effacement). La ligne reste lisible. */
  ecarteDesEnvois: boolean;
  demandeEffacementLe?: string;
}

export type PortAlerte = (a: { titre: string; message: string }) => Promise<void>;

export interface OptionsDepotCommentaires {
  maintenant?: () => string;
  alerter?: PortAlerte;
}

export interface DepotCommentaires {
  /** Ajoute une ligne. Un `idEvenement` déjà présent n'est jamais réécrit. */
  enregistrer(c: NouveauCommentaire, formesAuteur: readonly string[]): Promise<"cree" | "deja_present">;
  lire(): Promise<LigneCommentaire[]>;
  /** Lignes dont l'auteur n'est pas à l'écart (ligne ET registre d'opposition `mots.oppositions`) ET écrit sous le secret d'empreinte courant : les seules qu'un envoi futur pourrait viser. Échec fermé si le registre est illisible. */
  listerPourEnvoi(): Promise<LigneCommentaire[]>;
  /** `formesAuteur` OBLIGATOIRE : formes d'empreinte de la même personne (`empreintesAuteur`), qui doivent contenir `auteur` (sinon `auteur_invalide`). Jamais conservées. */
  auteurEcarte(auteur: string, formesAuteur: readonly string[]): Promise<boolean>;
  /** Met l'auteur à l'écart, lève une alerte, écrit une ligne de journal. Ne supprime AUCUNE ligne. */
  demanderEffacement(auteur: string, formesAuteur: readonly string[]): Promise<{ lignesEcartees: number }>;
}

const RE_P1 = /^p1\.([0-9a-f]{8})\.[0-9a-f]{64}$/;
const RE_HERITEE = /^[0-9a-f]{32}$/;

/**
 * Auteur ÉCRIT : uniquement la forme p1 sous un secret connu (courant ou ancien). Une forme héritée (sans secret) ou un kid inconnu
 * est refusé AVANT toute écriture : un kid inconnu bloquerait tout le registre d'opposition (échec fermé).
 */
function exigerAuteur(a: unknown): string {
  const m = typeof a === "string" ? RE_P1.exec(a) : null;
  if (!m) throw new Error("auteur_invalide");
  const cles = lireClesEmpreinte(process.env);
  if (!cles.ok) throw new ErreurEmpreinteIndisponible();
  if (![cles.courante, ...cles.anciennes].some((k) => k.kid === m[1])) throw new Error("auteur_invalide");
  return a as string;
}

/** Forme de RECHERCHE seulement (jamais écrite) : p1 de kid connu, ou héritée en lecture. */
function exigerForme(a: unknown): string {
  if (typeof a === "string" && RE_HERITEE.test(a)) return a;
  return exigerAuteur(a);
}

const chaine = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;
function exigerCommentaire(c: NouveauCommentaire): void {
  if (!chaine(c.idEvenement) || !chaine(c.reseau) || !chaine(c.post) || !chaine(c.texte) || !chaine(c.recuLe) || Number.isNaN(Date.parse(c.recuLe))) throw new Error("commentaire_invalide");
}

/** Empreinte d'un identifiant de contact (même espace que le registre d'opposition). Lève si le secret d'empreinte manque. */
export function empreinteAuteur(idBrut: string): string {
  const cles = lireClesEmpreinte(process.env);
  if (!cles.ok) throw new ErreurEmpreinteIndisponible();
  return empreintePersonne(cles.courante, "zernio-contact", idBrut);
}

/** Toutes les formes d'empreinte reconnues pour un identifiant brut (courante, anciennes, héritée) : à passer en `formesAuteur`. Jamais conservées. */
export function empreintesAuteur(idBrut: string): string[] {
  const cles = lireClesEmpreinte(process.env);
  if (!cles.ok) throw new ErreurEmpreinteIndisponible();
  return candidatsEmpreinte(cles, "zernio-contact", idBrut);
}

/**
 * `formesAuteur` OBLIGATOIRE et doit contenir l'auteur : sans toutes les formes de la personne (rotation du secret), l'opposition
 * ne serait pas retrouvée (échec ouvert). Sinon `auteur_invalide`, avant toute écriture, journal ou alerte.
 */
const formes = (a: string, toutes: unknown): string[] => {
  if (!Array.isArray(toutes) || !toutes.includes(a)) throw new Error("auteur_invalide");
  return [...new Set((toutes as unknown[]).map(exigerForme))];
};

async function lireListe(): Promise<LigneCommentaire[]> {
  const v: unknown = await lireParametre<unknown>(PARAM_COMMENTAIRES_DEPOT, []);
  if (!Array.isArray(v)) throw new Error("commentaires_illisibles");
  return v as LigneCommentaire[];
}

/** Alerte par défaut : la cloche seulement (jamais d'e-mail ni de téléphone), chargée à l'usage. */
const alerteCloche: PortAlerte = async (a) => {
  const { creerNotification } = await import("./notifications");
  await creerNotification({ type: "info", titre: a.titre, message: a.message }, { cloche: true });
};

export function creerDepotCommentaires(o: OptionsDepotCommentaires = {}): DepotCommentaires {
  const horloge = o.maintenant ?? maintenant;
  const alerter = o.alerter ?? alerteCloche;
  return {
    lire: () => sousVerrou(lireListe),
    listerPourEnvoi: async () => {
      const lignes = await sousVerrou(lireListe);
      const cles = lireClesEmpreinte(process.env);
      if (!cles.ok) throw new ErreurEmpreinteIndisponible();
      // Échec fermé : une ligne dont l'auteur n'est pas sous le secret COURANT ne peut pas être rapprochée sûrement du registre
      // (opposition inscrite plus tard sous la seule forme courante) : elle n'est pas proposée à l'envoi. Elle reste lisible.
      const kidCourant = `p1.${cles.courante.kid}.`;
      const candidates = lignes.filter((l) => !l.ecarteDesEnvois && l.auteur.startsWith(kidCourant));
      const verdict = new Map<string, boolean>();
      for (const auteur of new Set(candidates.map((l) => l.auteur))) verdict.set(auteur, await empreintesOpposees([auteur]));
      return candidates.filter((l) => !verdict.get(l.auteur));
    },
    auteurEcarte: async (auteur, formesAuteur) => empreintesOpposees(formes(exigerForme(auteur), formesAuteur)),
    enregistrer: async (c, formesAuteur) => {
      exigerCommentaire(c);
      const auteur = exigerAuteur(c.auteur);
      // Registre d'opposition consulté HORS verrou (lecture seule) : la ligne naît écartée si la personne s'est déjà opposée, sous n'importe quelle forme.
      const ecarte = await empreintesOpposees(formes(auteur, formesAuteur));
      return sousVerrou(async () => {
        const existantes = await lireListe();
        if (existantes.some((l) => l.idEvenement === c.idEvenement)) return "deja_present";
        const ligne: LigneCommentaire = {
          idEvenement: c.idEvenement, reseau: c.reseau, post: c.post, auteur, texte: c.texte, recuLe: c.recuLe,
          ecarteDesEnvois: ecarte,
        };
        await ecrireParametre(PARAM_COMMENTAIRES_DEPOT, [...existantes, ligne]);
        return "cree";
      });
    },
    demanderEffacement: async (auteur, formesAuteur) => {
      const a = exigerAuteur(auteur);
      const toutes = formes(a, formesAuteur);
      // 1) Registre d'opposition commun (HORS verrou : non réentrant) : la personne est écartée de TOUS les envois, d'abord (échec fermé).
      //    Si le registre est illisible, la suite (lignes, journal, alerte) est tout de même faite, puis l'erreur remonte.
      let erreurRegistre: unknown = null;
      try {
        await enregistrerOppositionParEmpreinte(a);
      } catch (e) {
        erreurRegistre = e;
      }
      let ecartees = 0;
      let erreur: unknown = null;
      try {
        ecartees = await sousVerrou(async () => {
          const existantes = await lireListe();
          const le = horloge();
          let n = 0;
          const apres = existantes.map((l) => {
            if (!toutes.includes(l.auteur)) return l;
            n++;
            return { ...l, ecarteDesEnvois: true, demandeEffacementLe: l.demandeEffacementLe ?? le };
          });
          await ecrireParametre(PARAM_COMMENTAIRES_DEPOT, apres);
          return n;
        });
      } catch (e) {
        erreur = e;
      }
      const echec = erreur || erreurRegistre;
      const suite = erreurRegistre
        ? "la mise à l'écart n'a pas pu être enregistrée au registre commun ; aucune ligne n'a été supprimée"
        : erreur
          ? "la personne est à l'écart des envois, mais les lignes n'ont pas pu être mises à jour ; aucune ligne n'a été supprimée"
          : "la personne est à l'écart des envois, aucune ligne n'a été supprimée";
      await journaliser(TYPE_JOURNAL_EFFACEMENT, `Une demande d'effacement ou d'opposition a été reçue : ${suite}.`);
      // Hors verrou : un port d'alerte peut lui-même prendre le verrou.
      await alerter({
        titre: "Demande d'effacement reçue",
        message: `Une personne demande l'effacement de ses commentaires. ${erreurRegistre ? "Sa mise à l'écart n'a pas pu être enregistrée au registre commun ; rien n'a été supprimé" : erreur ? "Elle est à l'écart des envois, mais ses lignes n'ont pas pu être mises à jour ; rien n'a été supprimé" : "Elle est à l'écart des envois et rien n'a été supprimé"} : vous décidez de la suite.`,
      });
      if (echec) throw erreurRegistre ?? erreur;
      return { lignesEcartees: ecartees };
    },
  };
}
