"use client";

import Image from "next/image";
import { Icone, Pastille, type NomIcone } from "@/components/ui";
import type { ValeurElement } from "@/domaine/types";
import { cn } from "@/lib/cn";

function Chiffre({ valeur, libelle }: { valeur: string | number; libelle: string }) {
  return (
    // min-w-0 + coupure des mots : un mot long en grande police ne déborde plus de sa case sur petit écran.
    <div className="min-w-0 rounded-2xl bg-surface-2 p-3 text-center">
      <p className="break-words font-titre text-2xl tabular-nums text-texte hyphens-auto">{valeur}</p>
      <p className="text-xs text-texte-faible">{libelle}</p>
    </div>
  );
}

function Barre({ libelle, pct }: { libelle: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-texte-doux">{libelle}</span>
        <span className="tabular-nums text-texte">{Math.round(pct)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-orange" style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

function Drapeau({ actif, libelle, icone }: { actif: boolean; libelle: string; icone: NomIcone }) {
  return (
    <span className={cn("flex min-h-11 items-center gap-2 rounded-2xl px-3 text-sm font-semibold", actif ? "bg-orange-doux text-orange-vif" : "bg-surface-2 text-texte-faible line-through")}>
      <Icone nom={icone} size={16} />
      {libelle}
    </span>
  );
}

const RYTHMES = { calme: 1, rythme: 2, "tres-rythme": 3 } as const;

/** Résumé VISUEL de la valeur d'un élément (couleurs, son, montage, habillage…). */
export function DetailsValeur({ valeur, vignette }: { valeur: ValeurElement; vignette: string | null }) {
  switch (valeur.type) {
    case "couleurs":
      return (
        <div className="grid grid-cols-3 gap-2">
          {valeur.couleurs.map((c) => (
            <div key={c.nom + c.valeur} className="overflow-hidden rounded-2xl border border-trait">
              {/* Couleur de la marque (donnée enregistrée), pas un style de l'interface. */}
              <div className="h-16" style={{ background: c.valeur }} />
              <p className="truncate bg-surface-2 px-2 py-1.5 text-xs font-semibold text-texte">{c.nom}</p>
            </div>
          ))}
        </div>
      );
    case "fond":
      return valeur.teinte ? <div className="h-24 rounded-2xl border border-trait" style={{ background: valeur.teinte }} /> : null;
    case "decor":
      // Décor en teinte : la couleur enregistrée (donnée de la marque, pas un style de l'interface).
      return valeur.mode === "teinte" && valeur.teinte ? <div className="h-24 rounded-2xl border border-trait" style={{ background: valeur.teinte }} /> : null;
    case "logo":
      return vignette ? (
        <div className="grid grid-cols-2 gap-2">
          {["bg-fond", "bg-texte"].map((fond) => (
            <div key={fond} className={cn("relative h-24 rounded-2xl border border-trait", fond)}>
              <Image src={vignette} alt="" fill sizes="200px" className="object-contain p-4" />
            </div>
          ))}
        </div>
      ) : null;
    case "police":
      return (
        <div className="rounded-2xl bg-surface-2 p-4">
          <p className={cn("text-5xl text-texte", valeur.famille === "Archivo Black" ? "font-titre" : "font-texte font-bold")} style={valeur.famille !== "Archivo Black" && valeur.famille !== "Manrope" ? { fontFamily: valeur.famille } : undefined}>
            Aa Bb 123
          </p>
          <p className="mt-2 text-sm text-texte-faible">{valeur.usage === "titre" ? "Pour les titres" : "Pour le texte"}</p>
        </div>
      );
    case "musique":
      return (
        <div className="grid grid-cols-3 gap-2">
          <Chiffre valeur={valeur.tempoBpm} libelle="BPM" />
          <Chiffre valeur={`${valeur.dureeSec} s`} libelle="durée" />
          <Chiffre valeur={valeur.ambiance.replace(/-/g, " ")} libelle="ambiance" />
        </div>
      );
    case "bruitage":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Chiffre valeur={valeur.categorie} libelle="catégorie" />
          <Chiffre valeur={`${valeur.dureeSec} s`} libelle="durée" />
        </div>
      );
    case "habillage":
      return (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Drapeau actif={valeur.intro} libelle="Début" icone="lecture" />
            <Drapeau actif={valeur.fin} libelle="Fin" icone="clap" />
            <Drapeau actif={valeur.logoAnime} libelle="Logo animé" icone="etincelles" />
            <Drapeau actif={valeur.grandTitre} libelle="Grand titre" icone="texte" />
          </div>
          {valeur.carteFinale && (
            <div className="relative isolate overflow-hidden rounded-2xl border border-trait bg-fond p-5 text-center">
              <div aria-hidden className="absolute inset-0 -z-10 lueur-forte" />
              <p className="titre-affiche text-2xl text-texte">{valeur.carteFinale.titre}</p>
              <span className="mt-3 inline-flex min-h-9 items-center rounded-full bg-orange px-4 text-sm font-semibold text-sur-orange">{valeur.carteFinale.appel}</span>
            </div>
          )}
        </div>
      );
    case "style-montage": {
      const n = RYTHMES[valeur.rythme];
      const plans = Array.from({ length: 4 + n * 3 }, (_, i) => 2 + ((i * 7) % 5) / (n + 0.5));
      return (
        <div className="grid gap-3">
          <div role="img" className="flex h-10 gap-1" aria-label={`Plans de ${valeur.dureePlanMoyenneSec} s en moyenne`}>
            {plans.map((p, i) => (
              <span key={i} className={cn("rounded-md", i % 2 ? "bg-orange/70" : "bg-surface-3")} style={{ flexGrow: p }} />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Chiffre valeur={`${valeur.dureePlanMoyenneSec} s`} libelle="par plan" />
            <Chiffre valeur={valeur.zooms} libelle="zooms" />
            <Chiffre valeur={valeur.transitions} libelle="transitions" />
          </div>
          {valeur.bruitagesTransitions && (
            <Pastille ton="orange" icone="volume" taille="md">
              Bruitages aux transitions
            </Pastille>
          )}
        </div>
      );
    }
    case "profil-son":
      return (
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Chiffre valeur={`${valeur.niveauCibleLufs}`} libelle="niveau cible (LUFS)" />
            <Chiffre valeur={`−${valeur.baisseSousVoixDb} dB`} libelle="musique sous la voix" />
          </div>
          <Barre libelle="Volume de la musique" pct={valeur.volumeMusique} />
          <div className="flex flex-wrap gap-1.5">
            <Pastille taille="md" icone="micro">
              Voix {valeur.traitementVoix}
            </Pastille>
            <Pastille taille="md" icone="volume">
              Bruitages : {valeur.densiteBruitages}
            </Pastille>
          </div>
        </div>
      );
    case "decor":
      return (
        <Pastille taille="md" icone="grille">
          Ambiance {valeur.ambiance}
        </Pastille>
      );
    default:
      return null;
  }
}
