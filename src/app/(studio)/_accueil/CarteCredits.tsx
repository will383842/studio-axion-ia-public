"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { lancerVideosEnAttenteAction } from "@/app/(studio)/nouvelle/[format]/actions-credits";
import { etiquetteSolde, JaugeCredit } from "@/components/reglages/Credits";
import { Carte } from "@/components/ui/Carte";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { texteRestant } from "@/domaine/credits";
import { cn } from "@/lib/cn";
import type { CarteCredit } from "@/services/credits";

/**
 * Carte « Crédits » de l'Accueil (lot « crédits », 02/10) : le solde de chaque service payant relié, sa jauge et
 * « ≈ N vidéos ». Les brouillons « lancer dès que possible » que le crédit permet partent à l'ouverture de l'Accueil.
 */
export function CarteCredits({ cartes, brouillonsPrets }: { cartes: CarteCredit[]; brouillonsPrets: number }) {
  const router = useRouter();
  const lance = useRef(false);

  useEffect(() => {
    if (!brouillonsPrets || lance.current) return;
    lance.current = true;
    void lancerVideosEnAttenteAction().then((r) => {
      if (r.ok && r.donnees.lancees.length) {
        notifier.succes(r.donnees.lancees.length > 1 ? `${r.donnees.lancees.length} vidéos sont parties` : `« ${r.donnees.lancees[0]} » est partie`, "Le crédit le permet de nouveau.");
        router.refresh();
      }
    });
  }, [brouillonsPrets, router]);

  if (!cartes.length) return null;
  return (
    <Link href="/reglages#credits" className="block">
      <Carte interactive>
        <p className="mb-3 text-sm font-semibold text-texte-doux">Crédits</p>
        <ul className="space-y-3">
          {cartes.map((c) => (
            <li key={c.fournisseur}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-texte">{c.nom}</span>
                <span className={cn("font-titre text-lg tabular-nums", c.ton === "rouge" ? "text-brique" : c.ton === "orange" ? "text-ambre" : "text-texte")}>{c.cleRefusee ? "Clé refusée" : (c.disponibleTexte ?? "—")}</span>
              </div>
              <JaugeCredit pourcentage={c.pourcentage} ton={c.ton} className="mt-1.5" />
              <p className="mt-1 flex items-center gap-1.5 text-xs text-texte-faible">
                {c.enAttente > 0 && <Icone nom="sablier" size={12} className="text-brique" />}
                {c.enAttente > 0 ? `${c.enAttente} en attente · ` : ""}
                {c.videosRestantes !== null ? `${texteRestant(c.fournisseur, c.videosRestantes)} · ` : ""}
                {etiquetteSolde(c)}
              </p>
            </li>
          ))}
        </ul>
      </Carte>
    </Link>
  );
}
