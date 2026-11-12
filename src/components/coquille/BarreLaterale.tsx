"use client";

import { useEcranAUnBoutonPrincipal, varianteNouvelleVideo } from "@/lib/ecran-principal";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icone } from "@/components/ui/Icone";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import { ACTION_CREER, cibleRubrique, estPliable, hrefCourant, NAV_PIED, rubriqueDeLaPage, rubriquesLaterales, type EntreeNavigation, type FormatNavigation, type RubriqueNavigation } from "./navigation";

const CLE = "studio.barreRepliee";
const EVENEMENT = "studio:barre";
/** Rubriques ouvertes ou fermées à la main : {"contenus": true, "publier": false}. */
const CLE_RUBRIQUES = "studio.rubriquesOuvertes";

function lireRepliee(): boolean {
  try {
    return localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}

function lireRubriques(): string {
  try {
    return localStorage.getItem(CLE_RUBRIQUES) ?? "{}";
  } catch {
    return "{}";
  }
}

/** Lit l'état gardé ; toute valeur qui n'est pas un objet simple (tableau, nombre, texte illisible…) compte pour {}. */
function analyserRubriques(brut: string): Record<string, boolean> {
  try {
    const v: unknown = JSON.parse(brut);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function ecrireRubriques(valeur: Record<string, boolean>) {
  try {
    localStorage.setItem(CLE_RUBRIQUES, JSON.stringify(valeur));
  } catch {
    /* stockage indisponible : l'état ne sera pas mémorisé */
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

function abonner(rappel: () => void) {
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener("storage", rappel);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener("storage", rappel);
  };
}

const CLASSE_LIGNE = "group relative flex items-center gap-2 rounded-lg px-2 py-1.5 font-medium transition-colors";
const classeEtat = (actif: boolean) => (actif ? "bg-surface-2 text-texte" : "text-texte-doux hover:bg-surface-2/70 hover:text-texte");

/** Barre orange à gauche de l'entrée de la page en cours. */
function Repere() {
  return <span aria-hidden className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-orange" />;
}

/**
 * Une entrée simple (14 px, graisse 500, y compris l'entrée active). `petit` = pied (12 px).
 * Barre repliée : l'icône avec un petit mot dessous.
 */
function LigneEntree({ e, libelle = e.libelle, icone = e.icone, court, actif, repliee, petit = false }: { e: EntreeNavigation; libelle?: string; icone?: EntreeNavigation["icone"]; court?: string; actif: boolean; repliee: boolean; petit?: boolean }) {
  return (
    <Link
      href={e.href}
      aria-label={repliee ? libelle : undefined}
      aria-current={actif ? "page" : undefined}
      className={cn(CLASSE_LIGNE, petit ? "text-xs leading-4" : "text-sm leading-5", repliee && "flex-col justify-center gap-0.5 px-0", classeEtat(actif))}
    >
      {actif && <Repere />}
      <Icone nom={icone} size={petit ? 16 : 18} className="shrink-0" />
      {repliee ? <span aria-hidden className="max-w-full truncate text-[10px] font-semibold leading-3">{court ?? libelle}</span> : <span className="truncate">{libelle}</span>}
    </Link>
  );
}

/** Sous-rubrique d'une rubrique pliable (barre dépliée ou petit menu flottant). */
function LigneSousRubrique({ e, courant, apresClic }: { e: EntreeNavigation; courant: string | null; apresClic?: () => void }) {
  const actif = e.href === courant;
  return (
    <Link
      href={e.href}
      onClick={apresClic}
      aria-current={actif ? "page" : undefined}
      className={cn(CLASSE_LIGNE, "py-1.5 pl-9 text-sm leading-5", classeEtat(actif))}
    >
      {actif && <Repere />}
      <span className="truncate">{e.libelle}</span>
    </Link>
  );
}

/**
 * Rubrique pliable, barre dépliée. Le lien (icône + libellé) mène toujours à la première sous-rubrique et ouvre la rubrique ;
 * seul le bouton du chevron (zone de 44 × 44 px) plie et déplie.
 */
function RubriquePliable({ r, courant, ouverte, bascule }: { r: RubriqueNavigation; courant: string | null; ouverte: boolean; bascule: (ouvrir: boolean) => void }) {
  const idListe = `${useId()}-sous`;
  const dedans = !ouverte && r.enfants!.some((e) => e.href === courant);
  return (
    <>
      <div className={cn("relative flex items-center rounded-lg transition-colors", classeEtat(dedans))}>
        {dedans && <Repere />}
        <Link
          href={cibleRubrique(r).href}
          onClick={(ev) => {
            // Clic avec une touche (nouvel onglet, etc.) : le navigateur fait son travail, on ne touche à rien.
            if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
            if (!ouverte) bascule(true);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium leading-5"
        >
          <Icone nom={r.icone} size={18} className="shrink-0" />
          <span className="truncate">{r.libelle}</span>
        </Link>
        <button
          type="button"
          aria-expanded={ouverte}
          aria-controls={idListe}
          aria-label={`${ouverte ? "Fermer" : "Ouvrir"} ${r.libelle}`}
          onClick={() => bascule(!ouverte)}
          className="-my-2 grid size-11 shrink-0 place-items-center rounded-lg hover:bg-surface-2"
        >
          <Icone nom="chevron-droite" size={14} className={cn("transition-transform", ouverte && "rotate-90")} />
        </button>
      </div>
      <ul id={idListe} hidden={!ouverte} className="mt-0.5 space-y-0.5">
        {r.enfants!.map((e) => (
          <li key={e.href}>
            <LigneSousRubrique e={e} courant={courant} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Rubrique pliable, barre repliée : un clic ouvre un petit menu flottant à droite de la barre (Échap ou clic à côté le ferme). */
function RubriqueFlottante({ r, courant, ouverte, ouvrir, fermer }: { r: RubriqueNavigation; courant: string | null; ouverte: boolean; ouvrir: () => void; fermer: () => void }) {
  const idListe = `${useId()}-flottant`;
  const [haut, setHaut] = useState(8);
  const bouton = useRef<HTMLButtonElement>(null);
  const dedans = r.enfants!.some((e) => e.href === courant);
  const page = r.enfants!.find((e) => e.href === courant);
  return (
    <div
      onKeyDown={(ev) => {
        // Échap referme le petit menu et rend le focus au bouton de la rubrique.
        if (ev.key === "Escape" && ouverte) {
          ev.stopPropagation();
          fermer();
          bouton.current?.focus();
        }
      }}
      onBlur={(ev) => {
        // Le focus quitte la rubrique (bouton + petit menu) : on referme.
        if (ouverte && !ev.currentTarget.contains(ev.relatedTarget as Node | null)) fermer();
      }}
    >
      <button
        ref={bouton}
        type="button"
        data-bouton-flottant
        aria-label={page ? `${r.libelle} (page en cours : ${page.libelle})` : r.libelle}
        aria-expanded={ouverte}
        aria-controls={idListe}
        onClick={(ev) => {
          if (ouverte) return fermer();
          setHaut(Math.max(8, Math.min(ev.currentTarget.getBoundingClientRect().top, window.innerHeight - 230)));
          ouvrir();
        }}
        className={cn(CLASSE_LIGNE, "w-full flex-col justify-center gap-0.5 px-0 text-sm leading-5", classeEtat(dedans || ouverte))}
      >
        {dedans && <Repere />}
        <Icone nom={r.icone} size={18} className="shrink-0" />
        <span aria-hidden className="max-w-full truncate text-[10px] font-semibold leading-3">
          {r.court ?? r.libelle}
        </span>
      </button>
      {ouverte && (
        <ul id={idListe} data-flottant style={{ top: haut }} className="fixed left-[calc(var(--largeur-barre-repliee)+4px)] z-50 min-w-48 space-y-0.5 rounded-lg border border-trait bg-fond p-2 shadow-lg">
          <li aria-hidden className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-texte-faible">
            {r.libelle}
          </li>
          {r.enfants!.map((e) => (
            <li key={e.href}>
              <LigneSousRubrique e={e} courant={courant} apresClic={fermer} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Barre latérale (ordinateur ≥ 1024 px) : 264 px, repliable à 72 px. Sept rubriques dont trois pliables ; le pied (réglages) ne défile pas. */
export function BarreLaterale({ actionDeconnexion, surLeSite = false, aPublier = false }: { formats?: FormatNavigation[]; actionDeconnexion: () => Promise<void>; surLeSite?: boolean; aPublier?: boolean }) {
  const chemin = usePathname();
  const idBase = useId();
  const idNav = `${idBase}-menu`;
  const repliee = useSyncExternalStore(abonner, lireRepliee, () => false);
  const brut = useSyncExternalStore(abonner, lireRubriques, () => "{}");
  const gardees = useMemo(() => analyserRubriques(brut), [brut]);
  const [flotteBrute, setFlotteBrute] = useState<{ id: string; chemin: string; repliee: boolean } | null>(null);
  // Le petit menu flottant se vide quand la page ou l'état de la barre change : il ne vaut que pour le couple (page, repli) où il s'est ouvert.
  // (Calculé plutôt que remis à zéro dans un effet, que la règle react-hooks/set-state-in-effect interdit.)
  const flotte = repliee && flotteBrute?.chemin === chemin && flotteBrute.repliee === repliee ? flotteBrute.id : null;
  const setFlotte = (id: string | null) => setFlotteBrute(id ? { id, chemin, repliee } : null);

  const courant = hrefCourant(chemin, surLeSite, aPublier);
  const rubriqueDeLaPageId = rubriqueDeLaPage(chemin, surLeSite, aPublier);

  useEffect(() => {
    document.documentElement.style.setProperty("--largeur-barre-courante", repliee ? "var(--largeur-barre-repliee)" : "var(--largeur-barre)");
  }, [repliee]);

  // Une rubrique s'ouvre toute seule quand on arrive sur l'une de ses pages (et c'est gardé).
  useEffect(() => {
    if (rubriqueDeLaPageId) {
      const actuel = analyserRubriques(lireRubriques());
      if (actuel[rubriqueDeLaPageId] !== true) ecrireRubriques({ ...actuel, [rubriqueDeLaPageId]: true });
    }
  }, [rubriqueDeLaPageId, chemin]);

  // Clic à côté : ferme le petit menu.
  useEffect(() => {
    if (!flotte) return;
    const surClic = (ev: MouseEvent) => {
      if (!(ev.target instanceof Element) || !ev.target.closest("[data-bouton-flottant], [data-flottant]")) setFlotteBrute(null);
    };
    document.addEventListener("mousedown", surClic);
    return () => document.removeEventListener("mousedown", surClic);
  }, [flotte]);

  function basculer() {
    try {
      localStorage.setItem(CLE, repliee ? "0" : "1");
    } catch {
      /* stockage indisponible : l'état ne sera pas mémorisé */
    }
    window.dispatchEvent(new Event(EVENEMENT));
  }

  const rubriques = rubriquesLaterales(surLeSite, aPublier);
  const creerActif = courant === ACTION_CREER.href;
  const ecranAPrincipal = useEcranAUnBoutonPrincipal();
  const libelleRepli = repliee ? "Déplier le menu" : "Replier le menu";

  return (
    <div
      className={cn(
        "theme-barre fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-trait bg-fond transition-[width] duration-300 ease-studio lg:flex",
        repliee ? "w-[var(--largeur-barre-repliee)]" : "w-[var(--largeur-barre)]",
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center", repliee ? "justify-center" : "justify-between pl-5 pr-2")}>
        <Link href="/" aria-label="Accueil">
          <Logo replie={repliee} />
        </Link>
        {!repliee && (
          <button type="button" onClick={basculer} aria-label={libelleRepli} aria-expanded={!repliee} aria-controls={idNav} className="grid size-11 place-items-center rounded-full text-texte-faible hover:bg-surface-2 hover:text-texte">
            <Icone nom="barre-replier" size={18} />
          </button>
        )}
      </div>
      {repliee && (
        <button type="button" onClick={basculer} aria-label={libelleRepli} aria-expanded={!repliee} aria-controls={idNav} className="mx-auto mb-2 grid size-11 place-items-center rounded-full text-texte-faible hover:bg-surface-2 hover:text-texte">
          <Icone nom="barre-deplier" size={18} />
        </button>
      )}

      {/* Action principale sous le logo, hors du menu. Règle « un seul orange plein » : en contour dès que l'écran a son propre bouton principal. */}
      <div className="shrink-0 px-3 pb-2">
        <Link
          href={ACTION_CREER.href}
          aria-label={repliee ? ACTION_CREER.libelle : undefined}
          aria-current={creerActif ? "page" : undefined}
          className={cn(
            "group relative flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium leading-5 transition-colors",
            varianteNouvelleVideo(ecranAPrincipal) === "plein"
              ? "bg-orange text-sur-orange shadow-orange hover:bg-orange-vif"
              : "border-2 border-orange bg-barre-bouton-fond text-orange-vif hover:border-orange-vif",
            repliee && "flex-col justify-center gap-0.5 px-0",
          )}
        >
          <Icone nom={ACTION_CREER.icone} size={18} className="shrink-0" />
          {repliee ? (
            <span aria-hidden className="text-[10px] font-semibold leading-3">
              Créer
            </span>
          ) : (
            <span className="truncate">{ACTION_CREER.libelle}</span>
          )}
        </Link>
      </div>

      <nav id={idNav} aria-label="Menu principal" className="flex min-h-0 flex-1 flex-col">
        <div className="sans-barre flex-1 overflow-y-auto px-3 pb-4">
          <ul className="space-y-0.5">
            {rubriques.map((r) => {
              if (!estPliable(r)) {
                const cible = cibleRubrique(r);
                return (
                  <li key={r.id}>
                    <LigneEntree e={cible} libelle={r.libelle} icone={r.icone} court={r.court} actif={cible.href === courant} repliee={repliee} />
                  </li>
                );
              }
              const ouverte = gardees[r.id] ?? rubriqueDeLaPageId === r.id;
              return (
                <li key={r.id} data-rubrique={r.id}>
                  {repliee ? (
                    <RubriqueFlottante r={r} courant={courant} ouverte={flotte === r.id} ouvrir={() => setFlotte(r.id)} fermer={() => setFlotte(null)} />
                  ) : (
                    <RubriquePliable r={r} courant={courant} ouverte={ouverte} bascule={(ouvrir) => ecrireRubriques({ ...gardees, [r.id]: ouvrir })} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="shrink-0 border-t border-trait px-3 py-2">
          <h2 id={`${idBase}-compte`} className="sr-only">
            Compte
          </h2>
          <ul className="space-y-0.5" aria-labelledby={`${idBase}-compte`}>
            {NAV_PIED.map((e) => (
              <li key={e.href}>
                <LigneEntree e={e} actif={e.href === courant} repliee={repliee} petit />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <form action={actionDeconnexion} className={cn("border-t border-trait px-3 py-2", repliee && "flex justify-center")}>
        <button
          type="submit"
          aria-label={repliee ? "Me déconnecter" : undefined}
          className={cn("group relative flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium leading-4 text-texte-faible hover:bg-surface-2/70 hover:text-texte", repliee && "flex-col justify-center gap-0.5 px-0")}
        >
          <Icone nom="deconnexion" size={16} />
          {repliee ? (
            <span aria-hidden className="text-[10px] font-semibold leading-3">
              Sortir
            </span>
          ) : (
            "Me déconnecter"
          )}
        </button>
      </form>
    </div>
  );
}
