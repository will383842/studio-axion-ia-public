"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { Resultat } from "@/services/_commun";
import type { IdeeUsine } from "@/domaine/usine";
import { Icone } from "@/components/ui/Icone";
import { cn } from "@/lib/cn";
import { PictoReseau } from "./PictoReseau";
import { TYPES_CONTENU, heureLisible, nomReseau, styleReseau, type EntreeCarte } from "./CarteEntreeCalendrier";

export interface ProprietesCarteProposition {
  entree: EntreeCarte;
  /** Raison donnée par l'équipe IA ; absente ou vide : la ligne « Pourquoi ici » n'est pas montrée. */
  pourquoi?: string;
  /** Publication proche déjà au calendrier ; absente ou vide : la ligne « Ressemble à » n'est pas montrée. */
  ressembleA?: string;
  /** Lundi de la semaine proposée : avec `cle`, c'est tout ce que le navigateur envoie au serveur pour retenir. Absent : pas de bouton. */
  debut?: string;
  /** Le sujet que l'Usine propose (champ `sujet` de la proposition). Absent : la carte n'a pas de bouton « Retenir ce sujet ». Repris de `entree` s'il y est. */
  sujet?: IdeeUsine;
  /** Action serveur (`debut`, `cle` seulement : le serveur retrouve le sujet, le jour et le réseau) ; par défaut l'action du Studio. Fournie par les tests. */
  retenir?: (debut: string, cle: string) => Promise<Resultat<{ id: string; rappelUsine: boolean }>>;
  className?: string;
}

export const PHRASE_RETENU_SANS_USINE = "Sujet retenu au Studio, mais l'Usine n'a pas pu en être prévenue pour le moment.";
const retenirParDefaut: NonNullable<ProprietesCarteProposition["retenir"]> = async (debut, cle) => {
  const { retenirSujetSemaineAction } = await import("@/app/(studio)/calendrier/retenir-sujet");
  return retenirSujetSemaineAction(debut, cle);
};

const TITRE_REPLI = "Sujet proposé par l'Usine";
const net = (v?: string): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Titre montré sur la carte : `titre` de la ligne, sinon le sujet, sinon la douleur, sinon une phrase fixe. Jamais vide. */
export function titreProposition(entree: Pick<EntreeCarte, "titre">, sujet?: IdeeUsine): string {
  return net(entree.titre) ?? net(sujet?.sujet) ?? net(sujet?.douleur) ?? TITRE_REPLI;
}

/** Ligne courte de contexte : métier, sinon « Actualité » (nouveauté), sinon le cas d'usage. Absente si elle répète le titre. */
function contexteProposition(sujet: IdeeUsine | undefined, titre: string): string | undefined {
  if (!sujet) return undefined;
  const actualite = typeof sujet.parts?.actualite === "string" && sujet.parts.actualite.trim() ? "Actualité" : undefined;
  const cas = net(sujet.casUsage)?.split(" · ")[0]?.slice(0, 120);
  const ligne = net(sujet.metier) ?? actualite ?? cas;
  return ligne && ligne !== titre ? ligne : undefined;
}

/**
 * Proposition de l'équipe IA : carte pointillée avec le libellé « Proposée » (le réseau et le type se lisent aussi par le texte et
 * l'icône, jamais par la couleur seule). Le Studio ne la programme, ne la valide ni ne la refuse : le seul lien, montré une fois le sujet
 * retenu, mène à l'écran « Écrire » du Studio (liste « Vos sujets »). Seul bouton, et seulement si l'Usine a donné le sujet : « Retenir ce sujet » (écrit le sujet, rien d'autre :
 * aucun créneau, aucune fabrication, rien chez le diffuseur).
 */
export function CarteProposition({ entree, pourquoi, ressembleA, debut, sujet: sujetDonne, retenir = retenirParDefaut, className }: ProprietesCarteProposition) {
  const sujet = sujetDonne ?? (entree as { sujet?: IdeeUsine }).sujet;
  const [etat, setEtat] = useState<"libre" | "en-cours" | "retenu">("libre");
  const [message, setMessage] = useState<string | null>(null);
  // Garde synchrone : deux clics rapides arrivent avant que l'état se mette à jour.
  const occupe = useRef(false);
  async function retenirCeSujet() {
    if (!sujet || !debut || occupe.current || etat === "retenu") return;
    occupe.current = true;
    setEtat("en-cours");
    setMessage(null);
    try {
      const r = await retenir(debut, entree.cle);
      if (r.ok) {
        setEtat("retenu");
        if (r.donnees.rappelUsine) setMessage(PHRASE_RETENU_SANS_USINE);
        return;
      }
      setEtat("libre");
      setMessage(r.message);
    } catch {
      setEtat("libre");
      setMessage("Le sujet n'a pas pu être retenu pour le moment. Réessayez dans un instant.");
    } finally {
      occupe.current = false;
    }
  }
  const type = TYPES_CONTENU[entree.type] ?? TYPES_CONTENU.video;
  const heure = heureLisible(entree.heure);
  const raison = pourquoi?.trim();
  const proche = ressembleA?.trim();
  const titre = titreProposition(entree, sujet);
  const contexte = contexteProposition(sujet, titre);
  const libelle = ["Proposée", nomReseau(entree.reseau), type.libelle, heure].filter(Boolean).join(", ");
  return (
    <div data-proposition={entree.cle} data-reseau={entree.reseau} style={styleReseau(entree.reseau)} aria-label={libelle} role="group" className={cn("flex w-full flex-col gap-1 rounded-[9px] border-[1.5px] border-dashed border-trait-fort border-l-[5px] border-l-[color:var(--c)] bg-surface-1 px-1.5 py-1 text-left", className)}>
      <span className="flex items-center gap-1.5">
        <PictoReseau reseau={entree.reseau} taille="sm" className="text-xs font-bold text-texte" />
        {heure && <span className="text-sm font-extrabold tabular-nums text-texte">{heure}</span>}
        <span className="ml-auto rounded-full border border-dashed border-trait-fort px-1.5 text-xs font-bold text-texte">Proposée</span>
      </span>
      <span data-titre-proposition title={titre} className="line-clamp-2 break-words text-sm font-bold text-texte">
        {titre}
      </span>
      {contexte && <span className="text-xs text-texte-doux">{contexte}</span>}
      <span className="flex items-center gap-1 text-xs font-semibold text-texte-doux">
        <Icone nom={type.icone} size={12} />
        {type.libelle}
      </span>
      {raison && (
        <span className="text-xs text-texte-doux">
          <b className="text-texte">Pourquoi ici :</b> {raison}
        </span>
      )}
      {proche && (
        <span className="text-xs text-texte-doux">
          <b className="text-texte">Ressemble à :</b> {proche}
        </span>
      )}
      {sujet && debut && (
        <button type="button" disabled={etat !== "libre"} aria-busy={etat === "en-cours"} onClick={() => void retenirCeSujet()} className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-trait-fort bg-surface-1 px-3 text-sm font-bold text-texte hover:bg-surface-2 disabled:opacity-70">
          {etat === "retenu" ? "Retenu" : etat === "en-cours" ? "Un instant…" : "Retenir ce sujet"}
        </button>
      )}
      {message && (
        <span role={etat === "libre" ? "alert" : "status"} className="text-xs text-texte-doux">
          {message}
        </span>
      )}
      {etat === "retenu" && (
        <Link href="/ecrire" className="inline-flex min-h-[44px] items-center text-xs font-bold text-texte underline hover:text-accent">
          Voir dans « Écrire »
        </Link>
      )}
    </div>
  );
}
