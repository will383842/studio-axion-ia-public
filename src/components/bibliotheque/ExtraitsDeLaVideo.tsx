import Link from "next/link";
import type { FicheSourceExtraits } from "@/domaine/archive-extraits";
import { LIBELLE_SUJET_EXTRAIT } from "@/briques/note-extraits/sujets";
import { SEUILS_PAR_DEFAUT } from "@/briques/note-extraits/reglage";
import type { SujetExtrait } from "@/briques/note-extraits/types";

/**
 * Ligne « Extraits gardés de cette vidéo » (X4-13a). Lecture seule, reçoit tout en propriétés, monte nulle part pour l'instant.
 * Rend rien si l'archive ou la note n'est pas allumée (seul `true` exact allume) ou si la fiche manque.
 */
const LIBELLE_USAGE: Readonly<Record<string, string>> = {
  telephone: "téléphone",
  ecran: "écran",
  fond: "fond",
  "preuve-chiffree": "preuve chiffrée",
};

/** Les valeurs les plus fréquentes (égalité : ordre d'apparition), en mots. */
function plusFrequents(valeurs: string[], libelle: (v: string) => string | undefined, max: number): string[] {
  const compte = new Map<string, number>();
  for (const v of valeurs) compte.set(v, (compte.get(v) ?? 0) + 1);
  return [...compte.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => libelle(v))
    .filter((m): m is string => !!m)
    .slice(0, max);
}

export function ExtraitsDeLaVideo({
  fiche,
  archiveActive,
  noteActive,
  seuilGarde = SEUILS_PAR_DEFAUT.garde,
  lien,
}: {
  fiche: FicheSourceExtraits | null | undefined;
  archiveActive: boolean;
  noteActive: boolean;
  seuilGarde?: number;
  lien: string;
}) {
  if (archiveActive !== true || noteActive !== true || !fiche) return null;

  const voir = (
    <Link href={lien} className="font-semibold text-texte underline-offset-2 hover:underline">
      Voir
    </Link>
  );

  if (fiche.rienARetenir === true) {
    return (
      <p className="font-sans text-sm text-texte-faible">
        Rien à retenir — {voir}
      </p>
    );
  }

  const gardees = fiche.plages.filter((p) => p.etat !== "ecartee" && typeof p.note === "number" && p.note >= seuilGarde);
  const sujets = plusFrequents(
    gardees.flatMap((p) => (p.sujet ? [p.sujet] : [])),
    (s) => LIBELLE_SUJET_EXTRAIT[s as SujetExtrait],
    2,
  );
  const usages = plusFrequents(gardees.flatMap((p) => p.usages ?? []), (u) => LIBELLE_USAGE[u], 2);
  const detail = [...sujets, ...usages].join(" · ");

  return (
    <p className="font-sans text-sm text-texte-faible">
      Extraits gardés de cette vidéo : <span className="font-semibold text-texte">{gardees.length}</span>
      {gardees.length > 0 && detail ? ` (${detail})` : ""} — {voir}
    </p>
  );
}
