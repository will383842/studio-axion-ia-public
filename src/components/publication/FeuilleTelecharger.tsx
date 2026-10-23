"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { reexporterAction } from "@/app/(studio)/videos/actions";
import { Bouton } from "@/components/ui/Bouton";
import { FeuilleBas } from "@/components/ui/FeuilleBas";
import { Icone } from "@/components/ui/Icone";
import { FormeRatio } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import type { Ratio } from "@/domaine/types";
import { nomFichier } from "@/domaine/derivations-generateur";
import { cn } from "@/lib/cn";
import { centimes, formaterMontant } from "@/lib/montants";
import { useVideo } from "./ContexteVideo";
import { avecConfirmationPrix } from "@/components/ui/ConfirmationPrix";
import { formateurNombre } from "@/lib/intl";

const ASPECT: Record<Ratio, string> = { "9:16": "aspect-[9/16]", "1:1": "aspect-square", "4:5": "aspect-[4/5]", "16:9": "aspect-video" };
const USAGE: Record<Ratio, string> = { "9:16": "TikTok, Reels, Shorts", "1:1": "LinkedIn, Facebook", "4:5": "Instagram", "16:9": "YouTube" };

function taille(octets: number): string {
  return `${formateurNombre("fr-FR", { maximumFractionDigits: 1 }).format(octets / 1_000_000)} Mo`;
}

function nomLibre(titre: string, ratio: string, ext: string) {
  return `${titre.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-${ratio.replace(":", "x")}.${ext}`;
}

/** Feuille « Télécharger » : une ligne par format d'image, les sous-titres, et l'ajout d'un format manquant. */
export function FeuilleTelecharger() {
  const router = useRouter();
  const { feuille, ouvrir, sorties, sousTitres, titre, videoId, ratiosFormat, coutsFormats, fabricationSimulee, kit } = useVideo();
  // Générateur (G1b, B.6.10) : une vidéo issue d'une version porte son code (« 0042-AV-TT-donnees-chatgpt-9x16.mp4 »).
  const v = kit?.variante;
  const nom = (ratio: Ratio | undefined, ext: string) => (v ? nomFichier({ code: v.code, titre: v.titre, ratio, extension: ext, version: v.version }) : nomLibre(titre, ratio ?? "", ext));
  const [enCours, setEnCours] = useState<Ratio | null>(null);
  const manquants = ratiosFormat.filter((r) => !sorties.some((s) => s.ratio === r));

  return (
    <FeuilleBas ouverte={feuille === "telecharger"} onOuverteChange={(o) => ouvrir(o ? "telecharger" : null)} titre="Télécharger">
      <ul className="space-y-2">
        {sorties.map((s) => (
          <li key={s.id}>
            <a
              href={s.url}
              download={nom(s.ratio, "mp4")}
              className="group flex min-h-20 items-center gap-4 rounded-2xl border border-trait bg-surface-2 p-3 pr-4 transition-colors hover:border-orange"
            >
              <span className={cn("relative w-12 shrink-0 overflow-hidden rounded-lg border border-trait-fort bg-fond", ASPECT[s.ratio])}>
                {s.vignette && <Image src={s.vignette} alt="" fill sizes="48px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-titre text-lg text-texte">{s.ratio}</span>
                <span className="block truncate text-xs text-texte-faible">
                  {USAGE[s.ratio]} · {s.resolution} · {taille(s.taille)}
                </span>
              </span>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-orange text-sur-orange shadow-orange transition-transform group-hover:scale-105">
                <Icone nom="telecharger" size={19} />
              </span>
            </a>
          </li>
        ))}
      </ul>

      {sousTitres && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-texte-faible">Sous-titres</p>
          <div className="grid grid-cols-2 gap-2">
            {(["srt", "vtt"] as const).map((f) => (
              <a key={f} href={sousTitres[f]} download={v ? nom(undefined, f) : true} className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-trait bg-surface-2 text-sm font-semibold text-texte hover:border-trait-fort">
                <Icone nom="sous-titres" size={17} />.{f}
              </a>
            ))}
          </div>
        </div>
      )}

      {manquants.length > 0 && (
        <div className="mt-5">
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-texte-faible">Ajouter un format</p>
          <p className="mb-2 text-xs text-texte-faible">Seul le nouveau format est payé. La vidéo garde son étape et sa note.</p>
          <div className="flex flex-wrap gap-2">
            {manquants.map((r) => (
              <Bouton
                key={r}
                variante="contour"
                essai={fabricationSimulee}
                chargement={enCours === r}
                onClick={async () => {
                  setEnCours(r);
                  let res = await reexporterAction(videoId, r);
                  res = await avecConfirmationPrix(res, (accord) => reexporterAction(videoId, r, accord));
                  setEnCours(null);
                  if (!res.ok) {
                    notifier.erreur(res.message);
                    return;
                  }
                  if (fabricationSimulee) notifier.essai(`le ${r} est préparé avec la vidéo de démonstration`);
                  else notifier.succes(`Le ${r} est en préparation`);
                  ouvrir(null);
                  router.refresh();
                }}
              >
                <FormeRatio ratio={r} />
                {r}
                {coutsFormats[r] !== undefined && <span className="font-normal text-texte-doux">{coutsFormats[r] === 0 ? "gratuit" : `≈ ${formaterMontant(centimes(coutsFormats[r]))}`}</span>}
              </Bouton>
            ))}
          </div>
        </div>
      )}
    </FeuilleBas>
  );
}
