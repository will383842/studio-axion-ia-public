"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EnTeteSection } from "@/components/ui/EnTetePage";
import { BarreProgression } from "@/components/ui/ProgressionEtapes";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { useTravaux } from "@/hooks/useTravaux";
import { cn } from "@/lib/cn";
import type { VueTravail } from "@/services/vues";
import { reessayerTravailAction } from "../actions";
import { BoutonAnnuler } from "@/components/videos/BoutonAnnuler";
import { avecConfirmationPrix } from "@/components/ui/ConfirmationPrix";

/**
 * « En cours » de l'accueil : tous les travaux en direct, échecs en rouge avec Réessayer (AV2.4-3).
 * Le titre et son compteur suivent la liste (E2E-1 n° 26) ; « Réessayer » répond tout de suite (n° 28).
 */
/** 10/10 : « encore 45 s », ou en minutes au-delà de 90 s (un nouveau format compte 10 à 20 min, pas « 840 s »). */
function resteLisible(sec: number): string {
  return sec > 90 ? `${Math.ceil(sec / 60)} min` : `${sec} s`;
}

export function EnCours({ initial }: { initial: VueTravail[] }) {
  const router = useRouter();
  const [relance, setRelance] = useState<string | null>(null);
  const { travaux } = useTravaux({
    initial,
    onTermine: (t) => {
      notifier.succes("Votre vidéo est prête", t.videoTitre);
      router.refresh();
    },
  });
  // « Réessayer » accepté : « C'est reparti » jusqu'à ce que le suivi en direct voie repartir la fabrication.
  const [repartis, setRepartis] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!repartis.size) return;
    const encore = [...repartis].filter((id) => travaux.some((t) => t.id === id && t.statut === "echec"));
    if (encore.length === repartis.size) return;
    const t = setTimeout(() => setRepartis(new Set(encore)), 0);
    return () => clearTimeout(t);
  }, [travaux, repartis]);
  if (!travaux.length) return null;
  return (
    <section>
      <EnTeteSection titre="En cours" compteur={travaux.length} />
      <ul className="space-y-2">
        {travaux.map((t) => {
          const reparti = repartis.has(t.id);
          const echec = t.statut === "echec" && !reparti;
          const etape = t.etapes.find((e) => e.statut === "en_cours") ?? t.etapes.find((e) => e.statut === "echec");
          return (
            <li key={t.id} className={cn("flex items-center gap-3 rounded-carte border bg-surface-1 p-3", echec ? "border-brique/40" : "border-trait")}>
              {/* Vignette : même lien que le titre juste à côté, donc hors du parcours clavier. */}
              <Link href={t.lien} aria-hidden tabIndex={-1} className="relative aspect-[9/16] w-12 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                {t.vignette && <Image src={t.vignette} alt="" fill sizes="48px" className="object-cover" />}
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={t.lien} className="block truncate text-[15px] font-semibold text-texte">
                  {t.videoTitre ?? t.titre}
                </Link>
                <p className={cn("mb-2 flex items-center gap-1.5 text-sm", echec ? "text-brique" : "text-texte-doux")}>
                  {echec ? <Icone nom="attention" size={14} className="shrink-0" /> : t.statut === "termine" ? <Icone nom="valide" size={14} className="shrink-0 text-sauge" /> : <Icone nom="chargement" size={14} className="shrink-0 animate-spin" />}
                  <span className="min-w-0 truncate">{echec ? `${etape?.nom ?? "Une étape"} n'a pas abouti` : reparti && t.statut === "echec" ? "C'est reparti…" : t.statut === "termine" ? "Prête" : `${etape?.nom ?? "En attente"} · encore ${resteLisible(t.resteSec)}`}</span>
                </p>
                <BarreProgression valeur={t.progression} libelle={`Avancement de « ${t.videoTitre ?? t.titre} »`} ton={echec ? "brique" : t.statut === "termine" ? "sauge" : "orange"} />
              </div>
              {echec ? (
                <>
                <Bouton
                  variante="secondaire"
                  icone="reessayer"
                  aria-label="Reprendre"
                  className="max-sm:px-3"
                  chargement={relance === t.id}
                  onClick={async () => {
                    setRelance(t.id);
                    let r = await reessayerTravailAction(t.id);
                    r = await avecConfirmationPrix(r, (accord) => reessayerTravailAction(t.id, accord));
                    setRelance(null);
                    if (!r.ok) return notifier.erreur(r.message);
                    setRepartis((s) => new Set(s).add(t.id));
                    notifier.succes("C'est reparti");
                    router.refresh();
                  }}
                >
                  <span className="max-sm:sr-only">Reprendre</span>
                </Bouton>
                {t.type === "fabrication" && <BoutonAnnuler videoId={t.cibleId} compact />}
                </>
              ) : (
                <span className="w-16 shrink-0 whitespace-nowrap text-right font-titre text-lg tabular-nums text-texte">{t.progression}&nbsp;%</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
