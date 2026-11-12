"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { Tuile } from "@/components/ui/Tuile";
import { cn } from "@/lib/cn";
import { estActif, ONGLETS_BAS, sectionsPlusMobile, tuilesPlusMobile, formatsCreer, type FormatNavigation } from "./navigation";

/** Onglets du bas (mobile < 1024 px) : Accueil · Vidéos · ➕ · Écrire · Plus. */
export function OngletsBas({ formats = [], actionDeconnexion, surLeSite = false, aPublier = false }: { formats?: FormatNavigation[]; actionDeconnexion: () => Promise<void>; surLeSite?: boolean; aPublier?: boolean }) {
  const chemin = usePathname();
  const [plus, setPlus] = useState(false);
  const [creer, setCreer] = useState(false);
  // Feuille « Créer » : les formats actifs (hors essais réservés), chacun vers son écran de création.
  const formatsActifs = formatsCreer(formats);
  const plusActif = tuilesPlusMobile(surLeSite, aPublier).some((t) => estActif(chemin, t));

  return (
    <>
      <nav
        aria-label="Menu principal (mobile)"
        className="theme-barre fixed inset-x-0 bottom-0 z-40 border-t border-trait bg-fond/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid h-[var(--hauteur-onglets-bas)] max-w-xl grid-cols-5 items-center px-2">
          {ONGLETS_BAS.map((o) => {
            const actif = estActif(chemin, o);
            if (o.central) {
              return (
                <li key={o.href} className="flex justify-center">
                  {/* Générateur (G1b) : le « + » ouvre une feuille : Nouvelle vidéo, Nouveau sujet, + Matière. */}
                  <button
                    type="button"
                    onClick={() => setCreer(true)}
                    aria-label="Créer"
                    aria-haspopup="dialog"
                    aria-expanded={creer}
                    className="-mt-6 grid size-[60px] place-items-center rounded-full bg-orange text-sur-orange shadow-orange ring-4 ring-barre-fond transition-transform active:scale-95"
                  >
                    <Icone nom="plus" size={28} strokeWidth={2.4} />
                  </button>
                </li>
              );
            }
            return (
              <li key={o.href}>
                <Link href={o.href} aria-current={actif ? "page" : undefined} className="relative flex min-h-14 flex-col items-center justify-center gap-1">
                  {actif && <motion.span layoutId="onglet-actif" className="absolute top-0 h-0.5 w-8 rounded-full bg-orange" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                  <Icone nom={o.icone} size={22} className={actif ? "text-texte" : "text-texte-faible"} />
                  <span className={cn("text-[11px] font-semibold", actif ? "text-texte" : "text-texte-faible")}>{o.libelle}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setPlus(true)} aria-haspopup="dialog" aria-expanded={plus} className="relative flex min-h-14 w-full flex-col items-center justify-center gap-1">
              {plusActif && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-orange" />}
              <Icone nom="grille" size={22} className={plusActif ? "text-texte" : "text-texte-faible"} />
              <span className={cn("text-[11px] font-semibold", plusActif ? "text-texte" : "text-texte-faible")}>Plus</span>
              {plusActif && <span className="sr-only">, contient la page en cours</span>}
            </button>
          </li>
        </ul>
      </nav>

      <FeuilleBas ouverte={creer} onOuverteChange={setCreer} titre="Créer">
        <div className="grid grid-cols-2 gap-3">
          <Tuile href="/nouvelle" icone="clap" libelle="Nouvelle vidéo" onClick={() => setCreer(false)} />
          {formatsActifs.map((f) => (
            <Tuile key={f.id} href={f.href} icone={f.icone} libelle={f.nom} onClick={() => setCreer(false)} />
          ))}
          <Tuile href="/ecrire/atelier" icone="ecrire" libelle="Nouveau sujet" onClick={() => setCreer(false)} />
          <Tuile href="/ecrire/matieres?ajout=matiere" icone="micro" libelle="+ Matière" onClick={() => setCreer(false)} />
          <Tuile href="/ecrire/matieres?ajout=preuve" icone="certifie" libelle="+ Preuve" onClick={() => setCreer(false)} />
        </div>
      </FeuilleBas>

      <FeuilleBas ouverte={plus} onOuverteChange={setPlus} titre="Plus">
        {/* Mêmes sections que la barre latérale (08/11), moins ce qui est déjà dans les onglets du bas. */}
        <div className="space-y-5">
          {sectionsPlusMobile(surLeSite, aPublier).map((s) => (
            <section key={s.titre ?? "tete"}>
              {s.titre && <h3 className="mb-2 text-xs font-semibold text-texte-faible">{s.titre}</h3>}
              <div className="grid grid-cols-2 gap-3">
                {s.entrees.map((t) => (
                  <Tuile key={t.href} href={t.href} icone={t.icone} libelle={t.libelle} onClick={() => setPlus(false)} />
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <form action={actionDeconnexion}>
            <button type="submit" className="flex min-h-24 w-full flex-col justify-between gap-3 rounded-carte border border-trait bg-surface-1 p-4 text-left hover:bg-surface-2">
              <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-texte-doux">
                <Icone nom="deconnexion" size={20} />
              </span>
              <span className="text-[15px] font-semibold text-texte-doux">Me déconnecter</span>
            </button>
          </form>
        </div>
      </FeuilleBas>
    </>
  );
}
