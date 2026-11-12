"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { lancerVideosEnAttenteAction } from "@/app/(studio)/nouvelle/[format]/actions-credits";
import { JaugeCredit } from "@/components/reglages/Credits";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { texteRestants } from "@/domaine/credits";
import { LIBELLES_NIVEAU, LIBELLES_NIVEAU_FORFAIT, niveauCredit } from "@/domaine/niveau-credit";
import { cn } from "@/lib/cn";
import type { CarteCredit } from "@/services/credits";

/**
 * Carte « Crédits » de l'Accueil (lot « crédits », 02/10) : le niveau de chaque service payant relié (en mots, jamais un montant), sa jauge et
 * « ≈ N vidéos restantes ». Les brouillons « lancer dès que possible » que le crédit permet partent à l'ouverture de l'Accueil.
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
    <Link href="/reglages#credits" className="-m-2 block rounded-xl p-2 hover:bg-surface-2">
      <div>
        <p className="mb-3 text-sm font-semibold text-texte-doux">Crédits</p>
        <ul className="space-y-3">
          {cartes.map((c) => (
            <li key={c.fournisseur}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-texte">{c.nom}</span>
                <span className={cn("font-titre text-base", c.ton === "rouge" ? "text-brique" : c.ton === "orange" ? "text-ambre" : "text-texte")}>{c.cleRefusee ? "Clé refusée" : (c.abonnements ? LIBELLES_NIVEAU_FORFAIT : LIBELLES_NIVEAU)[niveauCredit({ ...c, soldeConnu: c.disponibleTexte !== null })]}</span>
              </div>
              <JaugeCredit pourcentage={c.pourcentage} ton={c.ton} className="mt-1.5" />
              <p className="mt-1 flex items-center gap-1.5 text-xs text-texte-faible">
                {c.enAttente > 0 && <Icone nom="sablier" size={12} className="text-brique" />}
                {c.enAttente > 0 ? `${c.enAttente} en attente · ` : ""}
                {c.videosRestantes !== null ? texteRestants(c.fournisseur, c.videosRestantes) : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Link>
  );
}
