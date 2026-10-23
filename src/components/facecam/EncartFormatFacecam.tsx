"use client";

/**
 * FORMAT SECONDAIRE EN COURS (constat prod 10/10) : pendant qu'un « Nouveau format » (4:5, carré, 16:9) se fabrique, la
 * vidéo 9:16 est prête : un petit encart « Format Portrait en cours · 40 % » remplace l'attente plein écran, et le fil
 * du monteur comme les panneaux Coupes / Image / Cartes restent disponibles.
 */
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { reessayerTravailAction } from "@/app/(studio)/actions";
import { PASTILLES_FORMATS } from "@/briques/formats-facecam/ratios";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { notifier } from "@/components/ui/Toast";
import { useTravaux } from "@/hooks/useTravaux";
import type { VueTravail } from "@/services/vues";

export function EncartFormatFacecam({ initial }: { initial: VueTravail }) {
  const router = useRouter();
  const { travail } = useTravaux({
    travailId: initial.id,
    initial: [initial],
    onTermine: () => {
      notifier.succes("Le nouveau format est prêt");
      router.refresh();
    },
  });
  const t = travail ?? initial;
  const ratio = t.parametres?.ratio;
  const nom = PASTILLES_FORMATS.find((p) => p.ratio === ratio)?.nom ?? (typeof ratio === "string" ? ratio : "");
  const echec = t.statut === "echec";
  const [enCours, demarrer] = useTransition();

  return (
    <section aria-label="Nouveau format" aria-live="polite" className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-orange-doux text-orange-vif">
        <Icone nom={echec ? "attention" : "chargement"} size={16} className={echec ? undefined : "animate-spin"} />
      </span>
      <p className="min-w-0 flex-1 text-[15px] tabular-nums text-texte">
        {echec ? `Format ${nom} non fait` : `Format ${nom} en cours · ${Math.round(t.progression)} %`}
      </p>
      {echec && (
        <Bouton
          variante="contour"
          icone="reessayer"
          chargement={enCours}
          className="shrink-0"
          onClick={() =>
            demarrer(async () => {
              const r = await reessayerTravailAction(t.id, true);
              if (!r.ok) notifier.erreur(r.message);
              else router.refresh();
            })
          }
        >
          Reprendre
        </Bouton>
      )}
    </section>
  );
}
