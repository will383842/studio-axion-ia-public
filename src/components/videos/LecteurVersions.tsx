"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { choisirVersionAction } from "@/app/(studio)/videos/actions";
import { Icone } from "@/components/ui/Icone";
import { LecteurVideo } from "@/components/ui/LecteurVideo";
import { FormeRatio } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import type { Ratio } from "@/domaine/types";
import { cn } from "@/lib/cn";
import { enregistrerAller, publierTemps } from "./tempsLecture";

export interface SortieLecteur {
  id: string;
  ratio: Ratio;
  url: string;
  vignette: string;
}

export interface VersionLecteur {
  id: string;
  numero: number;
  choisie: boolean;
  enCours: boolean;
}

/**
 * Lecteur au ratio réel + pastilles de ratio (une sortie par format d'image)
 * + sélecteur de versions (la version choisie est celle qu'on publie).
 */
/** Événement « lire ce format » (detail : { ratio }) envoyé par les carreaux de formats de « Votre vidéo ». */
export const EVENEMENT_LIRE_FORMAT = "studio:lire-format";

export function LecteurVersions({
  videoId,
  titre,
  sorties,
  affiche,
  sousTitresVtt,
  versions,
  versionCouranteId,
}: {
  videoId: string;
  titre: string;
  sorties: SortieLecteur[];
  affiche?: string | null;
  sousTitresVtt?: string;
  versions: VersionLecteur[];
  versionCouranteId?: string;
}) {
  const router = useRouter();
  const [ratio, setRatio] = useState<Ratio | undefined>(sorties[0]?.ratio);
  const [changement, demarrer] = useTransition();
  const sortie = sorties.find((s) => s.ratio === ratio) ?? sorties[0];
  const racine = useRef<HTMLDivElement>(null);
  // 10/10 : un carreau de format déjà prêt (« Votre vidéo ») ouvre ce format ici, sans confirmation.
  useEffect(() => {
    const ouvrir = (e: Event) => {
      const voulu = (e as CustomEvent<{ ratio?: Ratio }>).detail?.ratio;
      if (!voulu || !sorties.some((s) => s.ratio === voulu)) return;
      setRatio(voulu);
      racine.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener(EVENEMENT_LIRE_FORMAT, ouvrir);
    return () => window.removeEventListener(EVENEMENT_LIRE_FORMAT, ouvrir);
  }, [sorties]);

  return (
    <div ref={racine}>
      {sortie && (
        <LecteurVideo
          key={sortie.id}
          src={sortie.url}
          affiche={sortie.ratio === sorties[0]?.ratio ? (affiche ?? sortie.vignette) : sortie.vignette}
          ratio={sortie.ratio}
          titre={titre}
          sousTitresVtt={sousTitresVtt}
          onTemps={publierTemps}
          onPret={enregistrerAller}
          className={cn("transition-opacity duration-200", changement && "opacity-60")}
        />
      )}

      {(sorties.length > 1 || versions.length > 1) && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {sorties.length > 1 && (
            <div role="radiogroup" aria-label="Format d'image" className="flex rounded-full border border-trait bg-surface-1 p-1">
              {sorties.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={s.ratio === sortie?.ratio}
                  onClick={() => setRatio(s.ratio)}
                  className={cn(
                    "flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold tabular-nums transition-colors",
                    s.ratio === sortie?.ratio ? "bg-texte text-fond" : "text-texte-doux hover:text-texte",
                  )}
                >
                  <FormeRatio ratio={s.ratio} className="scale-75" />
                  {s.ratio}
                </button>
              ))}
            </div>
          )}
          {versions.length > 1 && (
            <div role="radiogroup" aria-label="Version" className="flex rounded-full border border-trait bg-surface-1 p-1">
              {versions.map((v) => {
                const courante = v.id === versionCouranteId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={courante}
                    disabled={v.enCours || changement}
                    title={v.enCours ? "En fabrication" : undefined}
                    onClick={() => {
                      if (courante) return;
                      demarrer(async () => {
                        const r = await choisirVersionAction(videoId, v.id);
                        if (!r.ok) {
                          notifier.erreur(r.message);
                          return;
                        }
                        notifier.succes(`Version ${v.numero} choisie`);
                        router.refresh();
                      });
                    }}
                    className={cn(
                      "flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full px-3 text-xs font-bold transition-colors disabled:opacity-40",
                      courante ? "bg-orange text-sur-orange" : "text-texte-doux hover:text-texte",
                    )}
                  >
                    {v.enCours ? <Icone nom="sablier" size={13} /> : courante && <Icone nom="coche" size={13} strokeWidth={3} />}V{v.numero}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
