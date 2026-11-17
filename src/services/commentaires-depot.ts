/**
 * COMMENTAIRES · dépôt DURABLE (paramètre `commentaires.depot`). Aucune migration : le paramètre existe déjà comme mécanisme de stockage.
 * RÈGLE : ON GARDE TOUT. Aucune suppression, aucune purge, aucune anonymisation, aucune durée de conservation qui efface ;
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
  enregistrer(c: NouveauCommentaire, formesAuteur?: readonly string[]): Promise<"cree" | "deja_present">;
  lire(): Promise<LigneCommentaire[]>;
  /** Lignes dont l'auteur n'est pas à l'écart (ligne ET registre d'opposition `mots.oppositions`) : les seules qu'un envoi futur pourrait viser. Échec fermé si le registre est illisible. */
  listerPourEnvoi(): Promise<LigneCommentaire[]>;
  /** `formesAuteur` : formes d'empreinte de la même personne (`empreintesAuteur`), utiles après rotation du secret. Jamais conservées. */
  auteurEcarte(auteur: string, formesAuteur?: readonly string[]): Promise<boolean>;
  /** Met l'auteur à l'écart, lève une alerte, écrit une ligne de journal. Ne supprime AUCUNE ligne. */
  demanderEffacement(auteur: string, formesAuteur?: readonly string[]): Promise<{ lignesEcartees: number }>;
}

const RE_AUTEUR = /^(p1\.[0-9a-f]{8}\.[0-9a-f]{64}|[0-9a-f]{32})$/;

function exigerAuteur(a: unknown): string {
  if (typeof a !== "string" || !RE_AUTEUR.test(a)) throw new Error("auteur_invalide");
  return a;
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

const formes = (a: string, autres?: readonly string[]): string[] => [...new Set([a, ...(autres ?? []).map(exigerAuteur)])];

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
      const verdict = new Map<string, boolean>();
      for (const auteur of new Set(lignes.filter((l) => !l.ecarteDesEnvois).map((l) => l.auteur))) verdict.set(auteur, await empreintesOpposees([auteur]));
      return lignes.filter((l) => !l.ecarteDesEnvois && !verdict.get(l.auteur));
    },
    auteurEcarte: async (auteur, formesAuteur) => empreintesOpposees(formes(exigerAuteur(auteur), formesAuteur)),
    enregistrer: async (c, formesAuteur) => {
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
      await enregistrerOppositionParEmpreinte(a);
      // 2) Lignes de ce dépôt : écartées, jamais supprimées.
      const ecartees = await sousVerrou(async () => {
        const existantes = await lireListe();
        const le = horloge();
        let n = 0;
        const apres = existantes.map((l) => {
          if (!toutes.includes(l.auteur)) return l;
          n++;
          return { ...l, ecarteDesEnvois: true, demandeEffacementLe: l.demandeEffacementLe ?? le };
        });
        await ecrireParametre(PARAM_COMMENTAIRES_DEPOT, apres);
        await journaliser(TYPE_JOURNAL_EFFACEMENT, "Une demande d'effacement ou d'opposition a été reçue : la personne est à l'écart des envois, aucune ligne n'a été supprimée.");
        return n;
      });
      // 3) Hors verrou : un port d'alerte peut lui-même prendre le verrou.
      await alerter({
        titre: "Demande d'effacement reçue",
        message: "Une personne demande l'effacement de ses commentaires. Elle est à l'écart des envois et rien n'a été supprimé : vous décidez de la suite.",
      });
      return { lignesEcartees: ecartees };
    },
  };
}
