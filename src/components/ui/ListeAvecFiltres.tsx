"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { contient } from "@/lib/textes";
import { Bouton } from "./Bouton";
import { EtatVide } from "./EtatVide";
import { Icone, type NomIcone } from "./Icone";
import { Menu } from "./Menu";

export interface FiltreListe<T> {
  id: string;
  libelle: string;
  options: { valeur: string; libelle: string }[];
  tester: (element: T, valeur: string) => boolean;
}

export interface TriListe<T> {
  id: string;
  libelle: string;
  comparer: (a: T, b: T) => number;
}

export interface ActionSelection {
  libelle: string;
  icone: NomIcone;
  onAction: (ids: string[]) => void;
  danger?: boolean;
  essai?: boolean;
}

/**
 * Liste générique : recherche, filtres en pastilles, tri, sélection multiple avec barre d'actions.
 * ⚠️ Composant CLIENT à fonctions : l'utiliser depuis un composant client de l'écran
 * (les fonctions ne traversent pas la frontière serveur → client).
 */
export function ListeAvecFiltres<T>({
  elements,
  cle,
  rendu,
  texteRecherche,
  placeholderRecherche = "Rechercher",
  filtres = [],
  tris = [],
  actionsSelection,
  disposition = "grille",
  colonnes = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  vide,
  entete,
  className,
}: {
  elements: T[];
  cle: (e: T) => string;
  /** Rendu d'un élément ; `selection` est défini quand le mode sélection est actif. */
  rendu: (e: T, selection?: { choisi: boolean; basculer: () => void }) => ReactNode;
  /** Texte sur lequel porte la recherche (sans recherche si absent). */
  texteRecherche?: (e: T) => string;
  placeholderRecherche?: string;
  filtres?: FiltreListe<T>[];
  tris?: TriListe<T>[];
  actionsSelection?: ActionSelection[];
  disposition?: "grille" | "liste";
  colonnes?: string;
  /** État vide (aucun élément du tout). */
  vide?: ReactNode;
  /** Contenu à droite de la barre d'outils. */
  entete?: ReactNode;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [actifs, setActifs] = useState<Record<string, string>>({});
  const [tri, setTri] = useState(tris[0]?.id);
  const [enSelection, setEnSelection] = useState(false);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());

  const visibles = useMemo(() => {
    let r = elements.filter((e) => (!q || !texteRecherche || contient(texteRecherche(e), q)) && filtres.every((f) => !actifs[f.id] || f.tester(e, actifs[f.id])));
    const t = tris.find((x) => x.id === tri);
    if (t) r = [...r].sort(t.comparer);
    return r;
  }, [elements, q, texteRecherche, filtres, actifs, tris, tri]);

  if (!elements.length && vide) return <>{vide}</>;

  const basculer = (id: string) =>
    setChoisis((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className={className}>
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {texteRecherche && (
            <label className="flex min-h-11 flex-1 items-center gap-2 rounded-full border border-trait bg-surface-1 px-4 focus-within:border-orange">
              <Icone nom="loupe" size={18} className="text-texte-faible" />
              <span className="sr-only">{placeholderRecherche}</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholderRecherche} className="min-w-0 flex-1 bg-transparent text-[15px] text-texte outline-none placeholder:text-texte-faible" />
              {q && (
                <button type="button" onClick={() => setQ("")} aria-label="Effacer" className="-mr-2 grid size-9 place-items-center rounded-full text-texte-faible hover:text-texte">
                  <Icone nom="fermer" size={16} />
                </button>
              )}
            </label>
          )}
          {tris.length > 1 && (
            <Menu
              declencheur={
                <button type="button" aria-label="Trier" className="grid size-11 shrink-0 place-items-center rounded-full border border-trait bg-surface-1 text-texte-doux hover:text-texte">
                  <Icone nom="curseurs" size={18} />
                </button>
              }
              elements={tris.map((t) => ({ libelle: t.libelle, icone: t.id === tri ? "coche" : undefined, onSelect: () => setTri(t.id) }))}
            />
          )}
          {actionsSelection && (
            <Bouton
              variante={enSelection ? "secondaire" : "fantome"}
              onClick={() => {
                setEnSelection((v) => !v);
                setChoisis(new Set());
              }}
            >
              {enSelection ? "Terminer" : "Choisir"}
            </Bouton>
          )}
          {entete}
        </div>
        {filtres.map((f) => (
          <div key={f.id} role="group" aria-label={f.libelle} className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {[{ valeur: "", libelle: "Tous" }, ...f.options].map((o) => {
              const actif = (actifs[f.id] ?? "") === o.valeur;
              return (
                <button
                  key={o.valeur || "tous"}
                  type="button"
                  aria-pressed={actif}
                  onClick={() => setActifs((a) => ({ ...a, [f.id]: o.valeur }))}
                  className={cn(
                    "min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition-colors",
                    actif ? "border-texte bg-texte text-fond" : "border-trait text-texte-doux hover:border-trait-fort hover:text-texte",
                  )}
                >
                  {o.libelle}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {visibles.length ? (
        <ul className={cn(disposition === "grille" ? cn("grid gap-3", colonnes) : "flex flex-col gap-2")}>
          {visibles.map((e) => {
            const id = cle(e);
            return <li key={id}>{rendu(e, enSelection ? { choisi: choisis.has(id), basculer: () => basculer(id) } : undefined)}</li>;
          })}
        </ul>
      ) : (
        <EtatVide compact icone="loupe" titre="Rien ne correspond" phrase="Essayez un autre mot ou retirez un filtre." />
      )}

      <AnimatePresence>
        {enSelection && choisis.size > 0 && actionsSelection && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed inset-x-4 bottom-[calc(var(--hauteur-onglets-bas)+env(safe-area-inset-bottom)+12px)] z-40 mx-auto flex max-w-xl items-center gap-2 rounded-full border border-trait bg-surface-2 p-2 pl-5 shadow-carte lg:bottom-6"
          >
            <span className="flex-1 text-sm font-semibold text-texte">{choisis.size > 1 ? `${choisis.size} choisies` : `${choisis.size} choisie`}</span>
            {actionsSelection.map((a) => (
              <Bouton key={a.libelle} variante={a.danger ? "danger" : "secondaire"} icone={a.icone} essai={a.essai} onClick={() => a.onAction(Array.from(choisis))}>
                {a.libelle}
              </Bouton>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
