"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { cn } from "@/lib/cn";
import type { ElementTrouve, ResultatRecherche } from "@/services/vues";

/** Deux caractères, ou un seul chiffre (numéro de sujet, lot G1b). */
function assezLong(q: string): boolean {
  const t = q.trim();
  return t.length >= 2 || /^\d$/.test(t);
}

const GROUPES: { cle: keyof ResultatRecherche; titre: string }[] = [
  { cle: "sujets", titre: "Sujets" },
  { cle: "videos", titre: "Vidéos" },
  { cle: "scripts", titre: "Scripts" },
  { cle: "idees", titre: "Idées" },
  { cle: "personnages", titre: "Personnages" },
  { cle: "bibliotheque", titre: "Bibliothèque" },
];

/** Même seuil que `lg:` de Tailwind (Coquille : champ à partir de 1024 px, loupe en dessous). */
const LARGE = "(min-width: 1024px)";

/** Une seule des deux recherches de la coquille répond au raccourci : le champ sur grand écran, la loupe sinon. */
export function repondAuRaccourci(variante: "icone" | "champ", grandEcran: boolean): boolean {
  return variante === "champ" ? grandEcran : !grandEcran;
}

/**
 * Recherche globale (AV2.1) : loupe dans l'en-tête. Feuille plein écran sur mobile,
 * centrée sur ordinateur. Raccourci clavier « / » ou Ctrl+K.
 */
export function Recherche({ variante = "icone" }: { variante?: "icone" | "champ" }) {
  const [ouverte, setOuverte] = useState(false);
  const [q, setQ] = useState("");
  const [resultats, setRes] = useState<ResultatRecherche | null>(null);
  const [charge, setCharge] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function clavier(e: KeyboardEvent) {
      // La coquille pose DEUX recherches (champ sur ordinateur, loupe sur mobile, l'une cachée) : seule celle qui est
      // visible répond au raccourci, sinon deux fenêtres s'ouvraient l'une sur l'autre (E2E-2 parcours n° 23).
      if (!repondAuRaccourci(variante, window.matchMedia(LARGE).matches)) return;
      const cible = e.target as HTMLElement;
      const saisie = cible.tagName === "INPUT" || cible.tagName === "TEXTAREA" || cible.isContentEditable;
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !saisie)) {
        e.preventDefault();
        setOuverte(true);
      }
    }
    window.addEventListener("keydown", clavier);
    return () => window.removeEventListener("keydown", clavier);
  }, [variante]);

  useEffect(() => {
    if (!ouverte) return;
    // Réouverture : l'ancienne recherche est sélectionnée, la frappe la remplace (au lieu de s'y ajouter).
    const t = setTimeout(() => {
      champ.current?.focus();
      champ.current?.select();
    }, 250);
    return () => clearTimeout(t);
  }, [ouverte]);

  useEffect(() => {
    if (!assezLong(q)) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setCharge(true);
      try {
        const r = await fetch(`/api/recherche?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (r.ok) setRes(await r.json());
      } catch {
        /* annulée */
      } finally {
        setCharge(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const res = !assezLong(q) ? null : resultats;
  const total = res ? GROUPES.reduce((n, g) => n + (res[g.cle]?.length ?? 0), 0) : 0;

  return (
    <>
      {variante === "champ" ? (
        <button
          type="button"
          onClick={() => setOuverte(true)}
          className="flex min-h-11 w-full max-w-md items-center gap-3 rounded-full border border-trait bg-surface-1 px-4 text-sm text-texte-faible transition-colors hover:border-trait-fort"
        >
          <Icone nom="loupe" size={18} />
          <span className="flex-1 text-left">Rechercher</span>
          <kbd className="rounded-md border border-trait px-1.5 py-0.5 text-[11px] font-semibold">Ctrl K</kbd>
        </button>
      ) : (
        <button type="button" onClick={() => setOuverte(true)} aria-label="Rechercher" className="grid size-11 place-items-center rounded-full text-texte-doux hover:bg-surface-2 hover:text-texte">
          <Icone nom="loupe" size={21} />
        </button>
      )}

      <FeuilleBas ouverte={ouverte} onOuverteChange={setOuverte} titre="Rechercher" pleinEcran>
        <label className="sticky top-0 z-10 flex min-h-14 items-center gap-3 rounded-full border border-trait bg-surface-2 px-4 focus-within:border-orange">
          <Icone nom={charge ? "chargement" : "loupe"} size={20} className={cn("text-texte-faible", charge && "animate-spin")} />
          <span className="sr-only">Rechercher</span>
          <input
            ref={champ}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Vidéos, scripts, idées…"
            className="min-w-0 flex-1 bg-transparent text-lg text-texte outline-none placeholder:text-texte-faible"
          />
        </label>
        <div className="mt-5 space-y-6">
          {res && total === 0 && <p className="py-10 text-center text-texte-doux">Rien trouvé pour « {q} ».</p>}
          {res &&
            GROUPES.filter((g) => (res[g.cle]?.length ?? 0)).map((g) => (
              <section key={g.cle}>
                <h3 className="mb-2 font-texte text-xs font-bold uppercase tracking-wider text-texte-faible">{g.titre}</h3>
                <ul className="space-y-1">
                  {res[g.cle].map((e: ElementTrouve) => (
                    <li key={e.id}>
                      <Link href={e.lien} onClick={() => setOuverte(false)} className="flex min-h-14 items-center gap-3 rounded-2xl px-2 hover:bg-surface-2">
                        <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 text-texte-doux">
                          {e.vignette ? <Image src={e.vignette} alt="" fill sizes="44px" className="object-cover" /> : <Icone nom={e.icone} size={18} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-texte">{e.titre}</span>
                          {e.sousTitre && <span className="block truncate text-sm text-texte-faible">{e.sousTitre}</span>}
                        </span>
                        <Icone nom="chevron-droite" size={16} className="text-texte-faible" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          {!res && <p className="py-10 text-center text-sm text-texte-faible">Tapez au moins deux lettres.</p>}
        </div>
      </FeuilleBas>
    </>
  );
}
