"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { Tuile } from "@/components/ui/Tuile";
import { cn } from "@/lib/cn";
import { estActif, ONGLETS_BAS, tuilesPlusMobile } from "./navigation";

/** Onglets du bas (mobile < 1024 px) : Accueil · Vidéos · ➕ · Écrire · Plus. */
export function OngletsBas({ actionDeconnexion, surLeSite = false }: { actionDeconnexion: () => Promise<void>; surLeSite?: boolean }) {
  const chemin = usePathname();
  const [plus, setPlus] = useState(false);
  const [creer, setCreer] = useState(false);
  const plusActif = tuilesPlusMobile(surLeSite).some((t) => estActif(chemin, t));

  return (
    <>
      <nav
        aria-label="Navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-trait bg-fond/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
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
                    aria-expanded={creer}
                    className="-mt-6 grid size-[60px] place-items-center rounded-full bg-orange text-sur-orange shadow-orange ring-4 ring-fond transition-transform active:scale-95"
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
            <button type="button" onClick={() => setPlus(true)} aria-expanded={plus} aria-current={plusActif ? "page" : undefined} className="relative flex min-h-14 w-full flex-col items-center justify-center gap-1">
              {plusActif && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-orange" />}
              <Icone nom="grille" size={22} className={plusActif ? "text-texte" : "text-texte-faible"} />
              <span className={cn("text-[11px] font-semibold", plusActif ? "text-texte" : "text-texte-faible")}>Plus</span>
            </button>
          </li>
        </ul>
      </nav>

      <FeuilleBas ouverte={creer} onOuverteChange={setCreer} titre="Créer">
        <div className="grid grid-cols-2 gap-3">
          <Tuile href="/nouvelle" icone="film" libelle="Nouvelle vidéo" onClick={() => setCreer(false)} />
          <Tuile href="/ecrire/atelier" icone="ecrire" libelle="Nouveau sujet" onClick={() => setCreer(false)} />
          <Tuile href="/ecrire/matieres?ajout=matiere" icone="micro" libelle="+ Matière" onClick={() => setCreer(false)} />
          <Tuile href="/ecrire/matieres?ajout=preuve" icone="certifie" libelle="+ Preuve" onClick={() => setCreer(false)} />
        </div>
      </FeuilleBas>

      <FeuilleBas ouverte={plus} onOuverteChange={setPlus} titre="Plus">
        <div className="grid grid-cols-2 gap-3">
          {tuilesPlusMobile(surLeSite).map((t) => (
            <Tuile key={t.href} href={t.href} icone={t.icone} libelle={t.libelle} onClick={() => setPlus(false)} />
          ))}
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
