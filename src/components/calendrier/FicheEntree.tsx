import Link from "next/link";
import type { ReactNode } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { modePremierCommentaire } from "@/domaine/ecriture-post/commentaire";
import { cn } from "@/lib/cn";
import { controlerProgrammation } from "@/services/controle-programmation";
import { libelleJour } from "./BarreVue";
import { MonogrammeReseau, TYPES_CONTENU, heureLisible, jourLisible, nomReseau, reseauConnu, styleReseau, type EntreeCarte } from "./CarteEntreeCalendrier";
import { ETATS_CALENDRIER, PastilleStatutPlan, type EtatAffiche, type TableLibelles } from "./PastilleStatutPlan";
import { libelleOrigineDate } from "@/domaine/plan-editorial/origine-date";
import { boutonsTiroir } from "@/domaine/plan-editorial/statuts";
import type { OrigineEntree } from "@/domaine/plan-editorial/types";
import type { IdReseau } from "@/domaine/types";

/**
 * Fiche d'une entrée du calendrier : texte, premier commentaire, état.
 * Ni « use client » ni crochet : la fiche sert en rendu serveur (formulaire et liens) comme dans un composant client
 * (gestes `on…`). Elle ne s'ouvre pas toute seule : l'hôte (volet à droite ou feuille en bas) la place et gère le
 * focus. Les règles pures de ce fichier sont aussi celles que l'action serveur applique : une seule garde.
 */

/* ------------------------------------------------------------------ */
/* Clé d'une fiche                                                     */
/* ------------------------------------------------------------------ */

export type OrigineFiche = "publication" | "creneau";

export interface CleFiche {
  /** La clé telle que reçue : « publication:<id>|<réseau> » ou « creneau:<id>|<réseau> » (celle d'une carte). */
  cle: string;
  origine: OrigineFiche;
  id: string;
  reseau: IdReseau;
}

const LONGUEUR_MAX_ID = 200;
const ID = /^[A-Za-z0-9._:-]+$/;

/**
 * Lit la clé d'une carte du calendrier ; `null` si elle est vide, illisible ou d'un réseau inconnu.
 * La clé se coupe au DERNIER « | » (le réseau), puis au premier « : » (l'origine) : l'identifiant peut donc contenir
 * « : » (celui d'une Publication de carrousel programmé : `pub_envoi:<visuel>:<réseau>:v<n>`), jamais « | ».
 */
export function lireCleFiche(cle: unknown): CleFiche | null {
  if (typeof cle !== "string") return null;
  const barre = cle.lastIndexOf("|");
  const deuxPoints = cle.indexOf(":");
  if (barre < 0 || deuxPoints < 0 || deuxPoints > barre) return null;
  const origine = cle.slice(0, deuxPoints);
  const id = cle.slice(deuxPoints + 1, barre);
  const reseau = cle.slice(barre + 1);
  if (origine !== "publication" && origine !== "creneau") return null;
  if (!id || id.length > LONGUEUR_MAX_ID || !ID.test(id)) return null;
  if (!reseauConnu(reseau)) return null;
  return { cle, origine, id, reseau };
}

/** La clé d'une carte, encodée pour une adresse (« : » et « | » ne s'y écrivent pas tels quels). */
export function adresseFiche(cle: string): string {
  return encodeURIComponent(cle);
}

/** Relit une clé reçue dans une adresse : décodée, puis lue comme n'importe quelle clé ; `null` si illisible. */
export function cleDepuisAdresse(valeur: unknown): CleFiche | null {
  if (typeof valeur !== "string") return null;
  let decodee: string;
  try {
    decodee = decodeURIComponent(valeur);
  } catch {
    return null;
  }
  return lireCleFiche(decodee);
}

/* ------------------------------------------------------------------ */
/* Entrée et verrou                                                    */
/* ------------------------------------------------------------------ */

/** Une entrée telle que la fiche la montre : la carte, plus son texte et son premier commentaire. */
export interface EntreeFiche extends EntreeCarte {
  /** Texte de la publication (vide : il reste à écrire). */
  texte: string;
  /** Premier commentaire ; absent : aucun. */
  premierCommentaire?: string;
  /** Vrai dès que l'entrée a été confiée à l'outil de publication : son texte ne se modifie plus ici. */
  confiee?: boolean;
  /** Ce qui manque ou ce que le réseau a répondu, en une phrase. */
  message?: string;
  /** Qui a écrit le texte ; absent : une personne (ajout manuel, jamais bloqué). */
  auteur?: "machine" | "will";
  /** Origine de la date (CAL-01, définie dans types.ts) ; absente : choisie à la main. */
  origineDate?: OrigineEntree;
}

/** Pourquoi une fiche est en lecture seule. */
export type RaisonVerrou = "publiee" | "passee" | "confiee" | "etat" | "illisible";

/** États dont le texte se modifie encore : rien n'est parti. */
export const ETATS_MODIFIABLES: readonly EtatAffiche[] = ["brouillon", "a_valider", "a_corriger", "idee"];

/**
 * Verrou de la fiche, `null` si elle se modifie. Ordre : publiée, date illisible, jour passé (jour de Paris fourni),
 * déjà confiée ou programmée, état hors de la liste des états modifiables. Le jour même reste modifiable.
 */
export function verrouFiche(entree: Pick<EntreeFiche, "etat" | "jour" | "confiee">, aujourdhui: string): RaisonVerrou | null {
  if (entree.etat === "publie") return "publiee";
  if (!jourLisible(entree.jour) || !jourLisible(aujourdhui)) return "illisible";
  if (entree.jour < aujourdhui) return "passee";
  if (entree.confiee || entree.etat === "programme") return "confiee";
  if (!ETATS_MODIFIABLES.includes(entree.etat)) return "etat";
  return null;
}

/** La raison d'un verrou, dite à la personne. */
export const PHRASES_VERROU: Readonly<Record<RaisonVerrou, string>> = {
  publiee: "Déjà publiée. Elle n'est plus modifiable.",
  passee: "Ce jour est passé : cette publication n'est plus modifiable.",
  confiee: "Cette publication est déjà programmée : son texte ne se modifie plus ici.",
  etat: "Dans cet état, cette publication ne se modifie pas ici.",
  illisible: "La date de cette publication est illisible : elle ne se modifie pas ici.",
};

/**
 * Ce que l'état veut dire, en une phrase. « Partira seule » ne s'écrit que si l'envoi est allumé (`envoiAllume`,
 * faux par défaut) : sinon la fiche dit « envoi éteint ».
 */
export function phraseEtat(entree: Pick<EntreeFiche, "etat" | "jour" | "heure">, options: { envoiAllume?: boolean } = {}): string {
  switch (entree.etat) {
    case "programme": {
      if (options.envoiAllume !== true) return "Programmé, envoi éteint : rien ne partira tant que l'envoi n'est pas allumé.";
      const jour = libelleJour(entree.jour);
      const heure = heureLisible(entree.heure);
      return jour ? `Partira seule ${jour}${heure ? ` à ${heure}` : ""}.` : "Partira seule à la date prévue.";
    }
    case "publie":
      return PHRASES_VERROU.publiee;
    case "a_corriger":
      return "Le réseau l'a refusée. Rien n'est parti.";
    case "idee":
      return "Idée de l'IA. Elle ne partira jamais sans vous.";
    case "brouillon":
    case "a_valider":
      return "Ne partira pas tant que vous n'avez pas validé.";
    default:
      return "État à vérifier : rien ne part d'ici.";
  }
}

/* ------------------------------------------------------------------ */
/* Saisie                                                              */
/* ------------------------------------------------------------------ */

/** Bornes techniques de la saisie (la limite propre à chaque réseau est contrôlée ailleurs, avant l'envoi). */
export const LONGUEUR_MAX_TEXTE = 5000;
export const LONGUEUR_MAX_PREMIER_COMMENTAIRE = 2000;

/** Ce que la fiche enregistre. `premierCommentaire` absent : inchangé ; vide : retiré. */
export interface SaisieFiche {
  texte: string;
  premierCommentaire?: string;
}

/** Ce que l'action rend après un enregistrement. */
export interface FicheEnregistree {
  cle: string;
  texte: string;
  premierCommentaire: string | null;
  /** Faux si la saisie était déjà celle enregistrée (rejeu) : rien n'a été écrit. */
  modifie: boolean;
  /** Vrai si l'entrée était validée et repasse « à valider » parce que son contenu a changé. */
  aRevalider: boolean;
}

const nettoyer = (v: string) => v.replace(/\r\n?/g, "\n").trim();

/** Réseaux sans premier commentaire du tout. */
export function sansPremierCommentaire(reseau: string): boolean {
  return reseau === "tiktok";
}

/** Vérifie et nettoie une saisie reçue (jamais de confiance : elle vient du navigateur). */
export function verifierSaisie(saisie: unknown, reseau: IdReseau): { ok: true; saisie: SaisieFiche } | { ok: false; message: string } {
  const illisible = { ok: false as const, message: "Cette saisie est illisible. Rechargez la page, puis réessayez." };
  if (!saisie || typeof saisie !== "object" || Array.isArray(saisie)) return illisible;
  const { texte: texteBrut, premierCommentaire: commentaireBrut } = saisie as Record<string, unknown>;
  if (typeof texteBrut !== "string") return illisible;
  if (commentaireBrut !== undefined && commentaireBrut !== null && typeof commentaireBrut !== "string") return illisible;
  const texte = nettoyer(texteBrut);
  if (texte.length > LONGUEUR_MAX_TEXTE) return { ok: false, message: `Ce texte est trop long : ${LONGUEUR_MAX_TEXTE} caractères au plus.` };
  if (typeof commentaireBrut !== "string") return { ok: true, saisie: { texte } };
  const premierCommentaire = nettoyer(commentaireBrut);
  if (premierCommentaire.length > LONGUEUR_MAX_PREMIER_COMMENTAIRE) return { ok: false, message: `Ce premier commentaire est trop long : ${LONGUEUR_MAX_PREMIER_COMMENTAIRE} caractères au plus.` };
  if (premierCommentaire && sansPremierCommentaire(reseau)) return { ok: false, message: `${nomReseau(reseau)} n'a pas de premier commentaire : retirez-le, puis enregistrez.` };
  return { ok: true, saisie: { texte, premierCommentaire } };
}

/** Lit le formulaire de la fiche (champs `cle`, `texte`, `premierCommentaire`). Rien n'est vérifié ici. */
export function saisieDepuisFormulaire(formulaire: FormData): { cle: string; saisie: SaisieFiche } {
  const lire = (nom: string) => {
    const v = formulaire.get(nom);
    return typeof v === "string" ? v : null;
  };
  const premierCommentaire = lire("premierCommentaire");
  return { cle: lire("cle") ?? "", saisie: { texte: lire("texte") ?? "", ...(premierCommentaire !== null ? { premierCommentaire } : {}) } };
}

/* ------------------------------------------------------------------ */
/* Composant                                                           */
/* ------------------------------------------------------------------ */

const ANNEE = /^\d{4}/;
const TONS_ETAT: Readonly<Record<string, string>> = {
  brouillon: "border-trait bg-surface-2 text-texte",
  a_valider: "border-ambre/30 bg-ambre-doux text-texte",
  programme: "border-sauge/30 bg-sauge-doux text-texte",
  publie: "border-trait-fort bg-transparent text-texte",
  a_corriger: "border-brique/30 bg-brique-doux text-texte",
  idee: "border-dashed border-trait-fort bg-transparent text-texte",
};
const CHAMP = "block w-full resize-y rounded-champ border border-trait bg-surface-1 px-3.5 py-3 text-[15px] leading-relaxed text-texte outline-none transition-colors placeholder:text-texte-faible hover:border-trait-fort focus:border-orange read-only:bg-surface-2 read-only:hover:border-trait";
const NAVIGATION = "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-trait bg-surface-1 px-3 text-sm font-semibold text-texte-doux transition-colors hover:border-trait-fort hover:text-texte";

export interface ProprietesFicheEntree {
  entree: EntreeFiche;
  /** Jour de Paris « AAAA-MM-JJ » : la limite du verrou. */
  aujourdhui: string;
  /** « volet » (à droite, par défaut) ou « feuille » (en bas, sur téléphone). L'hôte gère l'ouverture et le focus. */
  presentation?: "volet" | "feuille";
  /** Action du formulaire (action serveur, ou geste du composant client). Absente : lecture seule. */
  action?: (formulaire: FormData) => void | Promise<void>;
  /** Libellé du bouton qui enregistre ; `null` : pas de bouton (l'hôte fournit le sien dans `children`). */
  boutonPrincipal?: string | null;
  /**
   * Vrai : le bouton principal vient de l'état (table du domaine, CAL-10) et non de `boutonPrincipal`. Publiée ou passée :
   * aucun. Programmée (déjà confiée) : « Modifier le texte » en `type="button"`, le geste est celui de l'hôte.
   */
  selonStatut?: boolean;
  /**
   * Geste de l'hôte pour le bouton principal des états « À valider », « À corriger », « Programmé » et « Idée » (valider, renvoyer,
   * rouvrir, accepter). Ce bouton est en `type="button"` : il n'enregistre jamais le texte. Absent : pas de bouton (jamais un bouton mort).
   */
  surPrincipal?: () => void;
  /** Refus rendu par l'action, à dire à la personne. */
  erreur?: string;
  /** Vrai seulement quand l'envoi est allumé : sinon une entrée programmée dit « envoi éteint ». */
  envoiAllume?: boolean;
  libellesEtat?: TableLibelles;
  lienFermer?: string;
  onFermer?: () => void;
  lienPrecedente?: string;
  onPrecedente?: () => void;
  lienSuivante?: string;
  onSuivante?: () => void;
  /** Emplacement de l'aperçu du contenu (vidéo, carrousel, infographie). */
  visuel?: ReactNode;
  /** Emplacement sous la date (son origine, le geste pour la déplacer). */
  sousDate?: ReactNode;
  /**
   * Emplacement des autres actions (valider, dupliquer, retirer, voir sur le réseau). Gardé même verrouillée.
   * Quand la fiche se modifie, `children` est rendu DANS le `<form>` : jamais de `<form>` à soi (HTML invalide,
   * le navigateur le jette), et des boutons en `type="button"` ou en `formAction` (un `<button>` sans type
   * enregistrerait le texte au lieu de faire son geste).
   */
  children?: ReactNode;
  className?: string;
}

function Navigation({ libelle, lien, geste, children }: { libelle: string; lien?: string; geste?: () => void; children: ReactNode }) {
  if (lien) {
    return (
      <Link href={lien} aria-label={libelle} className={NAVIGATION}>
        {children}
      </Link>
    );
  }
  if (!geste) return null;
  return (
    <button type="button" onClick={geste} aria-label={libelle} className={NAVIGATION}>
      {children}
    </button>
  );
}

/** Fiche d'une entrée : en-tête (réseau, type, date à l'heure de Paris), état, texte, premier commentaire. */
export function FicheEntree({
  entree,
  aujourdhui,
  presentation = "volet",
  action,
  boutonPrincipal: boutonPrincipalDonne = "Enregistrer le texte",
  selonStatut = false,
  surPrincipal,
  erreur,
  envoiAllume,
  libellesEtat,
  lienFermer,
  onFermer,
  lienPrecedente,
  onPrecedente,
  lienSuivante,
  onSuivante,
  visuel,
  sousDate,
  children,
  className,
}: ProprietesFicheEntree) {
  const verrou = verrouFiche(entree, aujourdhui);
  const modifiable = verrou === null && action !== undefined;
  const boutons = selonStatut ? boutonsTiroir(entree.etat, entree.jour, aujourdhui) : null;
  const boutonPrincipal = boutons ? boutons.principal : boutonPrincipalDonne;
  // À valider, À corriger, Programmée, Idée (« Accepter l'idée ») : le bouton principal est un geste de l'hôte, il n'enregistre rien. Sans rappel, pas de bouton.
  const principalEstGeste = boutons !== null && ["a_valider", "a_corriger", "programme", "idee"].includes(entree.etat);
  const boutonGeste = principalEstGeste && surPrincipal !== undefined && action !== undefined && boutonPrincipal !== null;
  const libelleEnregistrer = principalEstGeste && modifiable ? "Enregistrer le texte" : boutonPrincipal;
  const reseau = reseauConnu(entree.reseau) ? entree.reseau : null;
  const nom = reseau ? nomReseau(reseau) : "Réseau à vérifier";
  const type = Object.hasOwn(TYPES_CONTENU, entree.type) ? TYPES_CONTENU[entree.type].libelle : "Publication";
  const heure = heureLisible(entree.heure);
  const jour = libelleJour(entree.jour);
  const quand = jour ? `${jour} ${ANNEE.exec(entree.jour)?.[0] ?? ""}${heure ? ` à ${heure}, heure de Paris` : ""}` : "Date à vérifier";
  const etatConnu = (ETATS_CALENDRIER as readonly string[]).includes(entree.etat);
  const idTitre = `fiche-titre-${entree.cle.replace(/[^A-Za-z0-9_-]/g, "-")}`;
  const idTexte = `${idTitre}-texte`;
  const idCommentaire = `${idTitre}-commentaire`;
  const sansCommentaire = sansPremierCommentaire(entree.reseau);
  const reponsesALaMain = entree.reseau === "linkedin" || entree.reseau === "tiktok";
  // L7-12 : le contrôleur de texte avertit (voyant), il n'empêche jamais d'enregistrer ni de programmer à la main.
  const controle = reseau && entree.texte.trim() ? controlerProgrammation({ reseau, texte: entree.texte, commentaire: entree.premierCommentaire, auteur: entree.auteur ?? "will" }) : null;
  const aNavigation = Boolean(lienPrecedente || onPrecedente || lienSuivante || onSuivante || lienFermer || onFermer);

  const champs = (
    <>
      {modifiable && <input type="hidden" name="cle" value={entree.cle} />}
      <div>
        <label htmlFor={idTexte} className="mb-1.5 block text-sm font-semibold text-texte-doux">
          Texte de la publication
        </label>
        <textarea id={idTexte} name="texte" rows={5} maxLength={LONGUEUR_MAX_TEXTE} defaultValue={entree.texte} readOnly={!modifiable} className={CHAMP} />
        {controle && (
          <div data-voyant-controle={controle.voyant} className="mt-1.5 text-sm">
            <p className={cn("font-semibold", controle.voyant === "vert" ? "text-sauge" : controle.voyant === "orange" ? "text-ambre" : "text-brique")}>
              {controle.voyant === "vert" ? "Contrôle du texte : rien à signaler." : controle.voyant === "orange" ? "Contrôle du texte : à relire." : "Contrôle du texte : le réseau refuserait ce format."}
            </p>
            {controle.avertissements.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-texte-doux">
                {controle.avertissements.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
            {controle.voyant !== "vert" && <p className="mt-1 text-xs text-texte-faible">Ce contrôle avertit seulement : vous pouvez enregistrer quand même.</p>}
          </div>
        )}
        {!entree.texte.trim() && verrou === null && <p className="mt-1.5 text-sm font-semibold text-ambre">Il manque le texte.</p>}
      </div>
      {sansCommentaire ? (
        <p className="text-sm text-texte-doux">Premier commentaire : aucun sur {nom}.</p>
      ) : (
        <div>
          <label htmlFor={idCommentaire} className="mb-1.5 block text-sm font-semibold text-texte-doux">
            Premier commentaire
          </label>
          <textarea id={idCommentaire} name="premierCommentaire" rows={2} maxLength={LONGUEUR_MAX_PREMIER_COMMENTAIRE} defaultValue={entree.premierCommentaire ?? ""} readOnly={!modifiable} aria-describedby={`${idCommentaire}-aide`} className={CHAMP} />
          <p id={`${idCommentaire}-aide`} className="mt-1.5 text-xs text-texte-faible">
            {modePremierCommentaire(entree.reseau).transmettre ? "Enregistré dans le calendrier." : `À poser à la main sur ${nom}, juste après la publication.`}
          </p>
        </div>
      )}
      {reponsesALaMain && <p className="text-xs text-texte-faible">Réponses aux commentaires : toujours à la main sur {nom}.</p>}
      {erreur && (
        <p role="alert" className="rounded-champ border border-brique/30 bg-brique-doux px-3 py-2 text-sm font-semibold text-texte">
          {erreur}
        </p>
      )}
      {((modifiable && libelleEnregistrer) || boutonGeste || children) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {boutonGeste && (
            <Bouton type="button" pleineLargeur data-geste="principal" onClick={surPrincipal}>
              {boutonPrincipal}
            </Bouton>
          )}
          {modifiable && libelleEnregistrer && (
            <Bouton type="submit" variante={boutonGeste ? "secondaire" : "principal"} pleineLargeur>
              {libelleEnregistrer}
            </Bouton>
          )}
          {children}
        </div>
      )}
    </>
  );

  return (
    <section
      aria-labelledby={idTitre}
      data-fiche={entree.cle}
      data-etat={entree.etat}
      data-reseau={entree.reseau}
      data-presentation={presentation}
      data-verrou={verrou ?? undefined}
      style={reseau ? styleReseau(reseau) : undefined}
      className={cn(
        "flex w-full flex-col gap-4 overflow-y-auto border-trait bg-surface-1 p-4",
        presentation === "volet" ? "h-full max-w-[440px] border-l" : "max-h-[90vh] rounded-t-[18px] border-t pb-[calc(1rem+env(safe-area-inset-bottom,0px))]",
        className,
      )}
    >
      {aNavigation && (
        <div className="flex flex-wrap items-center gap-2">
          <Navigation libelle="Publication précédente" lien={lienPrecedente} geste={onPrecedente}>
            <Icone nom="fleche-gauche" size={16} />
            Précédente
          </Navigation>
          <Navigation libelle="Publication suivante" lien={lienSuivante} geste={onSuivante}>
            Suivante
            <Icone nom="fleche-droite" size={16} />
          </Navigation>
          <span className="ml-auto">
            <Navigation libelle="Fermer la fiche" lien={lienFermer} geste={onFermer}>
              Fermer
            </Navigation>
          </span>
        </div>
      )}

      <header>
        <h2 id={idTitre} className="flex items-center gap-2 font-titre text-lg text-texte">
          {reseau && <MonogrammeReseau reseau={reseau} />}
          {`${nom} · ${type}`}
        </h2>
        <p className="mt-0.5 text-xs text-texte-faible">{quand}</p>
        {jour && (
          <p data-origine-date={entree.origineDate === "usine" ? "usine" : "vous"} className="mt-0.5 text-xs text-texte-faible">
            {`Date ${libelleOrigineDate(entree.origineDate)}`}
          </p>
        )}
        {sousDate}
      </header>

      <div className={cn("rounded-champ border px-3 py-2 text-sm font-semibold", (etatConnu && TONS_ETAT[entree.etat]) || TONS_ETAT.brouillon)}>
        <PastilleStatutPlan etat={entree.etat} libelles={libellesEtat} className="mr-2" />
        {phraseEtat(entree, { envoiAllume })}
      </div>
      {verrou && verrou !== "publiee" && (
        <p className="flex items-start gap-1.5 text-sm text-texte-doux">
          <Icone nom="cadenas" size={14} className="mt-0.5 shrink-0" />
          {PHRASES_VERROU[verrou]}
        </p>
      )}
      {entree.message && <p className={cn("rounded-champ border px-3 py-2 text-sm font-semibold", entree.etat === "a_corriger" ? TONS_ETAT.a_corriger : TONS_ETAT.a_valider)}>{entree.message}</p>}

      {visuel}

      {modifiable ? (
        <form action={action} className="flex flex-col gap-4">
          {champs}
        </form>
      ) : (
        <div className="flex flex-col gap-4">{champs}</div>
      )}
    </section>
  );
}
