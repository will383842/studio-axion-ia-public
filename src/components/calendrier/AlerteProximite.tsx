import { Icone } from "@/components/ui/Icone";
import { empreinte, type Empreinte } from "@/domaine/proximite/empreinte";
import { scoreProximite } from "@/domaine/proximite/score";
import { cn } from "@/lib/cn";
import { libelleJour } from "./BarreVue";
import { jourLisible, nomReseau, trierEntrees, type EntreeCarte } from "./CarteEntreeCalendrier";

/** Score à partir duquel deux sujets sont jugés voisins (limite comprise). */
export const SEUIL_PROXIMITE = 0.5;
/** Écart maximal, en jours de calendrier, pour parler de proximité (limite comprise). */
export const JOURS_PROXIMITE = 7;

export interface PaireProche {
  /** La plus ancienne des deux. */
  a: EntreeCarte;
  b: EntreeCarte;
  score: number;
  ecartJours: number;
}

export interface OptionsProximite {
  seuil?: number;
  joursMax?: number;
}

const rangJour = (jour: string) => Math.round(Date.parse(`${jour}T12:00:00Z`) / 86_400_000);

/**
 * Paires de publications au sujet voisin et aux dates rapprochées. PUR : même entrée, même résultat.
 * Écartés : jour illisible, sujet vide (aucun axe), même média (le même contenu décliné sur plusieurs réseaux),
 * deux publications déjà parties (plus rien à décider). Tri : les plus ressemblantes, puis les plus rapprochées.
 */
export function pairesTropProches(entrees: readonly EntreeCarte[], { seuil = SEUIL_PROXIMITE, joursMax = JOURS_PROXIMITE }: OptionsProximite = {}): PaireProche[] {
  const lisibles: { entree: EntreeCarte; rang: number; empreinte: Empreinte }[] = trierEntrees(entrees.filter((e) => jourLisible(e.jour))).map((entree) => ({
    entree,
    rang: rangJour(entree.jour),
    empreinte: empreinte({ sujet: entree.titre ?? "", signatureUsine: entree.signatureUsine }),
  }));
  const paires: PaireProche[] = [];
  for (let i = 0; i < lisibles.length; i++) {
    for (let k = i + 1; k < lisibles.length; k++) {
      const x = lisibles[i];
      const y = lisibles[k];
      const ecartJours = y.rang - x.rang;
      if (ecartJours > joursMax) break; // la liste est triée par jour : les suivantes sont plus loin encore
      if (x.entree.cle === y.entree.cle) continue;
      if (x.entree.mediaId && x.entree.mediaId === y.entree.mediaId) continue;
      if (x.entree.etat === "publie" && y.entree.etat === "publie") continue;
      const score = scoreProximite(x.empreinte, y.empreinte);
      if (score > 0 && score >= seuil) paires.push({ a: x.entree, b: y.entree, score, ecartJours });
    }
  }
  // Tri stable : à égalité, l'ordre du calendrier (jour, heure, clé) est conservé.
  return paires.sort((p, q) => q.score - p.score || p.ecartJours - q.ecartJours);
}

/** Clés des cartes concernées par au moins une paire (à passer aux grilles : repère « Trop proches » sur la carte). */
export function clesTropProches(paires: readonly PaireProche[]): Set<string> {
  return new Set(paires.flatMap((p) => [p.a.cle, p.b.cle]));
}

export interface ProprietesAlerteProximite {
  entrees: readonly EntreeCarte[];
  seuil?: number;
  joursMax?: number;
  /** Nombre de paires listées avant « et N autres » (défaut 3). */
  maximum?: number;
  className?: string;
}

const decrire = (e: EntreeCarte) => `${nomReseau(e.reseau)}, ${libelleJour(e.jour)}`;

/** Alerte discrète : des publications au sujet voisin sont trop rapprochées. Rien n'est rendu s'il n'y en a pas. */
export function AlerteProximite({ entrees, seuil, joursMax, maximum = 3, className }: ProprietesAlerteProximite) {
  const paires = pairesTropProches(entrees, { seuil, joursMax });
  if (paires.length === 0) return null;
  const montrees = paires.slice(0, Math.max(1, maximum));
  const reste = paires.length - montrees.length;
  return (
    <div role="status" className={cn("rounded-xl border border-ambre/30 bg-ambre-doux px-3 py-2 text-sm text-texte", className)}>
      <p className="flex items-center gap-1.5 font-bold text-ambre">
        <Icone nom="attention" size={15} />
        Trop proches
      </p>
      <p className="text-xs text-texte-doux">Ces publications parlent d&apos;un sujet voisin à peu de jours d&apos;écart.</p>
      <ul className="mt-1 space-y-0.5 text-xs">
        {montrees.map((p) => (
          <li key={`${p.a.cle}~${p.b.cle}`}>
            {decrire(p.a)} et {decrire(p.b)}
          </li>
        ))}
        {reste > 0 && <li>{reste === 1 ? "et 1 autre paire" : `et ${reste} autres paires`}</li>}
      </ul>
    </div>
  );
}
