"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Tabs } from "radix-ui";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icone, type NomIcone } from "./Icone";

export interface Onglet {
  valeur: string;
  libelle: string;
  icone?: NomIcone;
  compteur?: number;
  contenu: ReactNode;
}

/** Onglets en pastilles, défilants sur mobile (radix Tabs). Pour des onglets qui changent d'URL : OngletsLiens. */
export function Onglets({
  onglets,
  valeur,
  valeurParDefaut,
  onChange,
  libelle,
  parametreUrl,
  className,
}: {
  onglets: Onglet[];
  valeur?: string;
  valeurParDefaut?: string;
  onChange?: (v: string) => void;
  libelle: string;
  /** Si fourni, l'onglet choisi est reporté dans l'adresse (?<parametreUrl>=valeur) : rechargement et partage rouvrent le bon onglet. */
  parametreUrl?: string;
  className?: string;
}) {
  function changer(v: string) {
    if (parametreUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set(parametreUrl, v);
      window.history.replaceState(window.history.state, "", url);
    }
    onChange?.(v);
  }
  return (
    <Tabs.Root value={valeur} defaultValue={valeurParDefaut ?? onglets[0]?.valeur} onValueChange={changer} className={className}>
      {/* Mobile : rangée qui défile. Grand écran : les onglets passent à la ligne, rien n'est caché. */}
      <Tabs.List aria-label={libelle} className="sans-barre -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:flex-wrap lg:overflow-visible">
        {onglets.map((o) => (
          <Tabs.Trigger
            key={o.valeur}
            value={o.valeur}
            className="group relative flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold text-texte-doux transition-colors hover:text-texte data-[state=active]:text-texte"
          >
            <span className="absolute inset-0 rounded-full bg-surface-2 opacity-0 transition-opacity group-data-[state=active]:opacity-100" />
            <span className="relative flex items-center gap-2">
              {o.icone && <Icone nom={o.icone} size={16} />}
              {o.libelle}
              {o.compteur !== undefined && <span className="rounded-full bg-surface-3 px-1.5 text-[11px] tabular-nums text-texte-doux">{o.compteur}</span>}
            </span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {onglets.map((o) => (
        // Pas d'id imposé : Radix relie lui-même l'onglet (aria-controls) à son panneau.
        <Tabs.Content
          key={o.valeur}
          value={o.valeur}
          className="mt-4 rounded-carte focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-vif"
        >
          {o.contenu}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

export interface OngletLien {
  href: string;
  libelle: string;
  icone?: NomIcone;
  compteur?: number;
  actif: boolean;
}

/** Onglets qui sont des liens (ex. onglets de format dans Mes vidéos). L'onglet actif est calculé par la page. */
export function OngletsLiens({ onglets, libelle, className }: { onglets: OngletLien[]; libelle: string; className?: string }) {
  const id = useId();
  return (
    <nav aria-label={libelle} className={cn("sans-barre -mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:flex-wrap lg:overflow-visible", className)}>
      {onglets.map((o) => (
        <Link
          key={o.href}
          href={o.href}
          aria-current={o.actif ? "page" : undefined}
          className={cn(
            "relative flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors",
            o.actif ? "text-texte" : "text-texte-doux hover:text-texte",
          )}
        >
          {o.actif && <motion.span layoutId={`${id}-actif`} className="absolute inset-0 rounded-full bg-surface-2" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
          <span className="relative flex items-center gap-2">
            {o.icone && <Icone nom={o.icone} size={16} />}
            {o.libelle}
            {o.compteur !== undefined && <span className="rounded-full bg-surface-3 px-1.5 text-[11px] tabular-nums text-texte-doux">{o.compteur}</span>}
          </span>
        </Link>
      ))}
    </nav>
  );
}
