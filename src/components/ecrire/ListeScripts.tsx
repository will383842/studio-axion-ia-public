"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icone } from "@/components/ui/Icone";
import { ListeAvecFiltres } from "@/components/ui/ListeAvecFiltres";
import { Pastille } from "@/components/ui/Pastille";
import type { Script } from "@/domaine/types";
import { libelleDuree, listerFormats, nomCourtFormat, trouverFormat } from "@/formats";
import { cn } from "@/lib/cn";
import { IlYA } from "@/components/ui/IlYA";

export type ScriptListe = Script & { dureeEstimeeSec: number; apercu: string };

/** Mes scripts / Références : recherche, filtre par format, tri ; carte = format, note en gros, sujet, début du texte. */
export function ListeScripts({ scripts, vide }: { scripts: ScriptListe[]; vide: ReactNode }) {
  const formats = listerFormats().filter((f) => scripts.some((s) => s.formatId === f.id));
  return (
    <ListeAvecFiltres
      elements={scripts}
      cle={(s) => s.id}
      disposition="grille"
      colonnes="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      texteRecherche={(s) => `${s.sujet} ${s.apercu}`}
      placeholderRecherche="Chercher un script"
      filtres={
        formats.length > 1
          ? [{ id: "format", libelle: "Format", options: formats.map((f) => ({ valeur: f.id, libelle: nomCourtFormat(f) })), tester: (s, v) => s.formatId === v }]
          : []
      }
      tris={[
        { id: "recents", libelle: "Récents", comparer: (a, b) => b.modifieLe.localeCompare(a.modifieLe) },
        { id: "note", libelle: "Meilleure note", comparer: (a, b) => (b.notes?.globale ?? 0) - (a.notes?.globale ?? 0) },
        { id: "favoris", libelle: "Favoris d'abord", comparer: (a, b) => Number(b.favori) - Number(a.favori) },
      ]}
      vide={vide}
      rendu={(s) => {
        const f = trouverFormat(s.formatId);
        const note = s.notes?.globale;
        return (
          <Link
            href={`/scripts/${s.id}`}
            className="group relative flex h-full flex-col rounded-carte border border-trait bg-surface-1 p-4 transition-[border-color,transform] duration-200 ease-studio hover:-translate-y-0.5 hover:border-trait-fort"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-orange-vif">
                <Icone nom={f?.icone ?? "document"} size={14} />
              </span>
              <span className="text-xs tabular-nums text-texte-faible">{libelleDuree(s.dureeEstimeeSec)}</span>
              {s.favori && <Icone nom="etoile" size={13} className="text-orange-vif" fill="currentColor" />}
              {note !== undefined && (
                <span className={cn("ml-auto font-titre text-2xl tabular-nums leading-none", note >= 75 ? "text-sauge" : note >= 55 ? "text-ambre" : "text-brique")}>{note}</span>
              )}
            </div>
            <p className="line-clamp-2 font-semibold leading-snug text-texte group-hover:text-orange-vif">{s.sujet}</p>
            <p className="mt-1 line-clamp-2 text-sm text-texte-doux">{s.apercu}</p>
            <div className="mt-auto flex items-center gap-1.5 pt-3 text-xs text-texte-faible">
              {s.statutEditorial === "valide" && (
                <Pastille ton="sauge" icone="valide">
                  Validé
                </Pastille>
              )}
              {s.version > 1 && <Pastille>v{s.version}</Pastille>}
              <span className="ml-auto"><IlYA iso={s.modifieLe} /></span>
            </div>
          </Link>
        );
      }}
    />
  );
}
