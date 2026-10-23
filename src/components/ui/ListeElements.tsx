"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { LICENCES, TYPES_BIBLIOTHEQUE } from "@/domaine/libelles";
import type { EtatLicence, Licence, TypeElement } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { Icone } from "./Icone";
import { ListeAvecFiltres, type ActionSelection, type FiltreListe } from "./ListeAvecFiltres";
import { Pastille } from "./Pastille";

/** Forme minimale d'un élément affichable (compatible avec VueElement des services). */
export interface ElementAffichable {
  id: string;
  type: TypeElement;
  nom: string;
  motsCles: string[];
  vignette: string | null;
  url: string | null;
  etatLicence: EtatLicence;
  licence: Licence;
  formatsParDefaut: string[];
  favori?: boolean;
}

const SONORES: TypeElement[] = ["musique", "bruitage"];

function PastilleLicence({ etat, licence }: { etat: EtatLicence; licence: Licence }) {
  if (etat === "expiree") return <Pastille ton="brique" icone="attention">Expirée</Pastille>;
  if (etat === "a-verifier") return <Pastille ton="ambre" icone="attention">À vérifier</Pastille>;
  if (licence.type === "generee-ia") return <Pastille ton="orange">IA</Pastille>;
  return null;
}

function BoutonEcoute({ src, nom }: { src: string; nom: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [joue, setJoue] = useState(false);
  return (
    <>
      <audio ref={ref} src={src} preload="none" onEnded={() => setJoue(false)} />
      <button
        type="button"
        aria-label={joue ? `Arrêter « ${nom} »` : `Écouter « ${nom} »`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const a = ref.current;
          if (!a) return;
          if (joue) {
            a.pause();
            a.currentTime = 0;
            setJoue(false);
          } else {
            void a.play();
            setJoue(true);
          }
        }}
        className={cn("relative z-10 grid size-11 shrink-0 place-items-center rounded-full transition-colors", joue ? "bg-orange text-sur-orange" : "bg-surface-2 text-texte hover:bg-surface-3")}
      >
        <Icone nom={joue ? "son" : "lecture"} size={18} className={joue ? "animate-pulse" : "translate-x-px"} />
      </button>
    </>
  );
}

/** Carte d'un élément (grille). Exportée pour les onglets spécifiques (LUT, Illustrations). */
export function CarteElement({ element: e, onOuvrir, selection, extra }: { element: ElementAffichable; onOuvrir?: (id: string) => void; selection?: { choisi: boolean; basculer: () => void }; extra?: ReactNode }) {
  const meta = TYPES_BIBLIOTHEQUE.find((t) => t.type === e.type);
  const sonore = SONORES.includes(e.type);
  // Une seule cible interactive par geste : le NOM est le bouton, étiré sur toute la carte (after:inset-0) ;
  // « Écouter » et les compléments passent au-dessus (z-10). Jamais de bouton dans un bouton.
  const action = selection ? { onClick: selection.basculer, "aria-pressed": selection.choisi } : onOuvrir ? { onClick: () => onOuvrir(e.id) } : null;
  const contenu = (
    <>
      <div className={cn("relative w-full overflow-hidden bg-surface-2", sonore ? "aspect-[3/2]" : "aspect-square")}>
        {e.vignette && !sonore ? (
          <Image src={e.vignette} alt="" fill sizes="(max-width: 640px) 50vw, 220px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="absolute inset-0 grid place-items-center lueur">
            <span className="grid size-12 place-items-center rounded-2xl bg-orange-doux text-orange-vif">
              <Icone nom={meta?.icone ?? "image"} size={22} />
            </span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          <PastilleLicence etat={e.etatLicence} licence={e.licence} />
          {e.type === "illustration-video" && <Pastille ton="neutre" icone="film">Vidéo</Pastille>}
        </div>
        {e.formatsParDefaut.length > 0 && (
          <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-orange text-sur-orange" title="Style par défaut d'un format">
            <Icone nom="etoile" size={14} fill="currentColor" />
          </span>
        )}
        {selection && (
          <span className={cn("absolute bottom-2 right-2 grid size-7 place-items-center rounded-full border-2", selection.choisi ? "border-orange bg-orange text-sur-orange" : "border-texte/70 bg-fond/50")}>
            {selection.choisi && <Icone nom="coche" size={14} strokeWidth={3} />}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          {action ? (
            // Le bouton porte le nom ET la ligne du dessous : une cible d'au moins 44 px (E2E-1 n° 25).
            <button type="button" {...action} className="flex min-h-11 w-full flex-col justify-center text-left outline-none after:absolute after:inset-0 after:content-['']">
              <span className="block w-full truncate text-sm font-semibold text-texte">{e.nom}</span>
              <span className="block w-full truncate text-xs font-normal text-texte-faible">{e.motsCles.slice(0, 3).join(" · ") || LICENCES[e.licence.type]}</span>
            </button>
          ) : (
            <>
              <p className="truncate text-sm font-semibold text-texte">{e.nom}</p>
              <p className="truncate text-xs text-texte-faible">{e.motsCles.slice(0, 3).join(" · ") || LICENCES[e.licence.type]}</p>
            </>
          )}
        </div>
        {sonore && e.url && <BoutonEcoute src={e.url} nom={e.nom} />}
        {extra && <div className="relative z-10">{extra}</div>}
      </div>
    </>
  );
  const classes = cn(
    "group relative block w-full overflow-hidden rounded-carte border border-trait bg-surface-1 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-trait-fort",
    action && "cursor-pointer has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-2 has-[button:focus-visible]:outline-orange-vif",
    selection?.choisi && "border-orange",
  );
  return <div className={classes}>{contenu}</div>;
}

/**
 * LISTE GÉNÉRIQUE DE LA BIBLIOTHÈQUE (AV2.5 niveau 2) : recherche par nom et mots-clés,
 * filtre de licence, tri, sélection multiple. Les onglets LUT, Illustrations et Sous-titres
 * peuvent la réutiliser avec `renduCarte` ou composer CarteElement eux-mêmes.
 */
export function ListeElements<T extends ElementAffichable>({
  elements,
  onOuvrir,
  actionsSelection,
  renduCarte,
  filtresSupplementaires = [],
  vide,
  entete,
  colonnes,
}: {
  elements: T[];
  onOuvrir?: (id: string) => void;
  actionsSelection?: ActionSelection[];
  renduCarte?: (e: T, selection?: { choisi: boolean; basculer: () => void }) => ReactNode;
  filtresSupplementaires?: FiltreListe<T>[];
  vide?: ReactNode;
  entete?: ReactNode;
  colonnes?: string;
}) {
  const filtres: FiltreListe<T>[] = [
    ...filtresSupplementaires,
    ...(elements.some((e) => e.etatLicence !== "ok")
      ? [
          {
            id: "licence",
            libelle: "Licence",
            options: [
              { valeur: "ok", libelle: "En règle" },
              { valeur: "probleme", libelle: "À vérifier" },
            ],
            tester: (e: T, v: string) => (v === "ok" ? e.etatLicence === "ok" : e.etatLicence !== "ok"),
          },
        ]
      : []),
  ];
  return (
    <ListeAvecFiltres
      elements={elements}
      cle={(e) => e.id}
      texteRecherche={(e) => `${e.nom} ${e.motsCles.join(" ")}`}
      placeholderRecherche="Nom ou mot-clé"
      filtres={filtres}
      tris={[
        { id: "nom", libelle: "Par nom", comparer: (a, b) => a.nom.localeCompare(b.nom, "fr") },
        { id: "favoris", libelle: "Favoris d'abord", comparer: (a, b) => Number(!!b.favori) - Number(!!a.favori) },
      ]}
      actionsSelection={actionsSelection}
      vide={vide}
      entete={entete}
      colonnes={colonnes}
      rendu={(e, selection) => (renduCarte ? renduCarte(e, selection) : <CarteElement element={e} onOuvrir={onOuvrir} selection={selection} />)}
    />
  );
}
