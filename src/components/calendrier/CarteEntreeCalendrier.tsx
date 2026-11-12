import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import type { EntreeCalendrier } from "@/domaine/calendrier";
import type { IdReseau } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { RESEAUX } from "@/reseaux";
import { LIBELLES_ETAT, PastilleStatutPlan, etatDepuisStatut, type EtatCalendrier } from "./PastilleStatutPlan";

export type TypeContenu = "video" | "carrousel" | "infographie" | "image";

/** Le type se lit toujours par une icône ET un libellé, jamais par la couleur. */
export const TYPES_CONTENU: Readonly<Record<TypeContenu, { libelle: string; icone: NomIcone }>> = {
  video: { libelle: "Vidéo", icone: "film" },
  carrousel: { libelle: "Carrousel", icone: "images" },
  infographie: { libelle: "Infographie", icone: "resultats" },
  image: { libelle: "Image", icone: "image" },
};

/** Une carte du calendrier : une publication, sur UN réseau, un jour de Paris. */
export interface EntreeCarte {
  /** Unique dans la vue. */
  cle: string;
  /** Jour de Paris, AAAA-MM-JJ. */
  jour: string;
  reseau: IdReseau;
  type: TypeContenu;
  etat: EtatCalendrier;
  /** Heure de Paris « HH:MM » (déjà convertie par l'appelant) ; absente ou illisible : non affichée. */
  heure?: string;
  /** Début du texte ou titre du média. */
  titre?: string;
  /** Média porté : deux cartes du même média sont le même contenu décliné. */
  mediaId?: string | null;
  /** Repère posé par l'usine sur le créneau (sert à l'alerte de proximité). */
  signatureUsine?: string;
}

const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Vrai si la chaîne est un jour AAAA-MM-JJ qui existe. */
export function jourLisible(jour: string | null | undefined): jour is string {
  if (!jour || !JOUR.test(jour)) return false;
  const d = new Date(`${jour}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === jour;
}

/** « HH:MM » lisible, sinon null. */
export function heureLisible(heure: string | null | undefined): string | null {
  return heure && HEURE.test(heure) ? heure : null;
}

function definition(reseau: string) {
  return RESEAUX.find((r) => r.id === reseau);
}

export function reseauConnu(reseau: string): reseau is IdReseau {
  return definition(reseau) !== undefined;
}

export function nomReseau(reseau: IdReseau): string {
  return definition(reseau)?.nom ?? "Réseau";
}

export function monogrammeReseau(reseau: IdReseau): string {
  return definition(reseau)?.monogramme ?? "?";
}

/**
 * POINT D'EXTENSION des couleurs de réseau : chaque élément lié à un réseau porte `--c`, lue dans le jeton
 * `--res-<réseau>` (ex. `--res-linkedin`). Tant que le jeton n'existe pas, le trait neutre s'applique.
 * Aucune couleur n'est écrite ici : définir les jetons suffit à colorer cartes, pastilles, couloirs et repères.
 */
export function styleReseau(reseau: IdReseau): CSSProperties {
  return { "--c": `var(--res-${reseau}, var(--trait-fort))` } as CSSProperties;
}

/** Picto d'un réseau (monogramme). Décoratif : le nom du réseau est toujours écrit ou dit à côté. */
export function MonogrammeReseau({ reseau, taille = "md", className }: { reseau: IdReseau; taille?: "sm" | "md"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center border-2 border-[color:var(--c)] bg-surface-1 font-bold leading-none text-texte",
        taille === "sm" ? "size-[18px] rounded-[5px] text-[9px]" : "size-[22px] rounded-md text-[11px]",
        className,
      )}
    >
      {monogrammeReseau(reseau)}
    </span>
  );
}

/** Verrou de la maquette : déjà publiée, ou jour passé (comparé au jour de Paris fourni). */
export function estVerrouillee(entree: Pick<EntreeCarte, "etat" | "jour">, aujourdhui: string): boolean {
  if (entree.etat === "publie") return true;
  return jourLisible(entree.jour) && jourLisible(aujourdhui) && entree.jour < aujourdhui;
}

/** Ordre d'affichage : jour, puis heure (sans heure en dernier), puis clé. Ne modifie pas la liste reçue. */
export function trierEntrees<T extends Pick<EntreeCarte, "cle" | "jour" | "heure">>(entrees: readonly T[]): T[] {
  const h = (e: T) => heureLisible(e.heure) ?? "99:99";
  return [...entrees].sort((a, b) => a.jour.localeCompare(b.jour) || h(a).localeCompare(h(b)) || a.cle.localeCompare(b.cle));
}

/**
 * Vue unifiée → cartes : une carte par réseau connu. Une entrée archivée ou sans réseau ne donne aucune carte.
 * L'heure n'est pas dans la vue unifiée : l'appelant l'ajoute s'il la connaît.
 */
export function cartesDepuisEntrees(entrees: readonly EntreeCalendrier[]): EntreeCarte[] {
  return entrees.flatMap((e) => {
    const etat = etatDepuisStatut(e.statut);
    if (!etat) return [];
    return e.reseaux.filter(reseauConnu).map((reseau) => ({ cle: `${e.cle}|${reseau}`, jour: e.jour, reseau, type: e.famille === "carrousel" ? "carrousel" : "video", etat, titre: e.titre, mediaId: e.mediaId }) satisfies EntreeCarte);
  });
}

/** Ce qu'un lecteur d'écran dit de la carte : réseau, type, heure, état. */
export function libelleCarte(entree: EntreeCarte): string {
  return [nomReseau(entree.reseau), TYPES_CONTENU[entree.type]?.libelle, heureLisible(entree.heure), (LIBELLES_ETAT[entree.etat] ?? LIBELLES_ETAT.brouillon).libelle].filter(Boolean).join(", ");
}

export interface ProprietesCarteEntreeCalendrier {
  entree: EntreeCarte;
  /** Ajoute la ligne de titre (vue du jour, réserve). */
  avecTitre?: boolean;
  /** Affiche le cadenas (voir `estVerrouillee`). */
  verrouillee?: boolean;
  /** Affiche le repère « Trop proches » (voir AlerteProximite). */
  tropProche?: boolean;
  /** Rendu serveur : la carte est un lien. */
  href?: string | null;
  /** Rendu client : la carte est un bouton. */
  onOuvrir?: (entree: EntreeCarte) => void;
  className?: string;
}

/**
 * Carte courte d'une publication : picto du réseau et heure, type (icône et libellé), état.
 * Le liseré de gauche prend la couleur du réseau (`--c`) ; l'état d'idée est en pointillé.
 */
export function CarteEntreeCalendrier({ entree, avecTitre, verrouillee, tropProche, href, onOuvrir, className }: ProprietesCarteEntreeCalendrier) {
  const type = TYPES_CONTENU[entree.type] ?? TYPES_CONTENU.video;
  const heure = heureLisible(entree.heure);
  // Le libellé remplace le contenu pour un lecteur d'écran : le verrou et l'alerte y sont donc redits.
  const libelle = [libelleCarte(entree), verrouillee && "verrouillée", tropProche && "trop proche d'une autre publication"].filter(Boolean).join(", ");
  const classes = cn(
    "block w-full rounded-[9px] border border-l-[5px] border-trait border-l-[color:var(--c)] bg-surface-1 px-1.5 py-1 text-left shadow-carte transition-colors",
    entree.etat === "idee" && "border-dashed",
    (href || onOuvrir) && "hover:border-trait-fort hover:border-l-[color:var(--c)]",
    className,
  );
  const commun = { "data-carte": entree.cle, "data-reseau": entree.reseau, "data-etat": entree.etat, style: styleReseau(entree.reseau), className: classes, "aria-label": libelle };
  const contenu: ReactNode = (
    <>
      <span className="flex items-center gap-1.5">
        <MonogrammeReseau reseau={entree.reseau} taille="sm" />
        {heure && <span className="text-sm font-extrabold tabular-nums text-texte">{heure}</span>}
        {verrouillee && (
          <span title="Verrouillée" className="ml-auto text-texte-faible">
            <Icone nom="cadenas" size={12} />
          </span>
        )}
      </span>
      <span className="mb-1 mt-0.5 flex items-center gap-1 text-xs font-semibold text-texte-doux">
        <Icone nom={type.icone} size={12} />
        {type.libelle}
      </span>
      <span className="flex flex-wrap gap-1">
        <PastilleStatutPlan etat={entree.etat} />
        {tropProche && (
          <Pastille ton="ambre" icone="attention">
            Trop proches
          </Pastille>
        )}
      </span>
      {avecTitre && entree.titre && <span className="mt-1 block text-xs text-texte-doux">{entree.titre}</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} {...commun}>
        {contenu}
      </Link>
    );
  }
  if (onOuvrir) {
    return (
      <button type="button" onClick={() => onOuvrir(entree)} {...commun}>
        {contenu}
      </button>
    );
  }
  return (
    <div role="group" {...commun}>
      {contenu}
    </div>
  );
}
