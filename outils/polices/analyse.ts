/**
 * POLICES-P3-b — calcul PUR du relevé de polices d'une composition (aucun navigateur, aucun fichier, aucun réseau).
 * Entrée : pour chaque texte visible, les familles demandées par le style (pile CSS déjà découpée) et les familles
 * réellement CHARGÉES dans le document. Sortie : les écarts (la première famille demandée n'est pas chargée : le navigateur
 * dessine alors un secours) et la liste `policesRendues`, dans la forme attendue par `EntreeVideoFinie`
 * (`src/briques/controle-image/video-finie.ts`) et jugeable par `policesHorsCharte`.
 * Outil local, lancé à la main : ni `src/**` ni `studio-rendu/**` ne l'importent.
 */

export interface ReleveTexte {
  texte: string;
  /** Piles CSS découpées, dans l'ordre (« "Axion Manrope", sans-serif » → ["Axion Manrope", "sans-serif"]). */
  famillesDemandees: string[];
  /** Familles du document dont l'état est « loaded » (jamais `document.fonts.check`, qui répond vrai pour une famille inconnue). */
  chargees: string[];
}

export interface EcartPolice {
  texte: string;
  demandee: string;
  /** « non-chargee » : la police demandée n'est pas chargée ; « aucune » : aucune famille demandée. */
  motif: "non-chargee" | "aucune";
  /** Ce que le navigateur dessine à la place. */
  rendue: string;
}

export interface AnalysePolices {
  ecarts: EcartPolice[];
  /** Une pile par texte, dans l'ordre et sans doublon : la police RÉELLEMENT dessinée (première famille chargée, sinon le repli générique). */
  policesRendues: string[];
}

const GENERIQUES = ["serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif", "ui-serif", "ui-monospace", "ui-rounded", "math", "emoji", "fangsong"];

const nettoyer = (f: string): string => f.trim().replace(/^["']+|["']+$/g, "").trim();
const cle = (f: string): string => nettoyer(f).toLowerCase();
const estGenerique = (f: string): boolean => GENERIQUES.includes(cle(f));

/** Découpe une valeur CSS `font-family` en familles (virgules hors guillemets). */
export function decouperPile(valeur: string): string[] {
  const noms: string[] = [];
  let courant = "";
  let guillemet = "";
  for (const c of String(valeur ?? "")) {
    if (guillemet) {
      if (c === guillemet) guillemet = "";
      courant += c;
    } else if (c === '"' || c === "'") {
      guillemet = c;
      courant += c;
    } else if (c === ",") {
      noms.push(courant);
      courant = "";
    } else courant += c;
  }
  noms.push(courant);
  return noms.map(nettoyer).filter((n) => n.length > 0);
}

/** La police réellement dessinée pour une pile : la première famille chargée ; sinon le repli générique ; sinon « (police du navigateur) ». */
export function policeRendue(demandees: readonly string[], chargees: readonly string[]): string {
  const ok = new Set(chargees.map(cle));
  for (const f of demandees) {
    if (!estGenerique(f) && ok.has(cle(f))) return nettoyer(f);
    if (estGenerique(f)) return cle(f);
  }
  return "(police du navigateur)";
}

export function analyserPolices(releves: readonly ReleveTexte[]): AnalysePolices {
  const ecarts: EcartPolice[] = [];
  const vues = new Set<string>();
  const policesRendues: string[] = [];
  for (const r of releves) {
    const rendue = policeRendue(r.famillesDemandees, r.chargees);
    if (!vues.has(rendue)) {
      vues.add(rendue);
      policesRendues.push(rendue);
    }
    const premiere = r.famillesDemandees[0];
    if (premiere === undefined) {
      ecarts.push({ texte: r.texte, demandee: "", motif: "aucune", rendue });
      continue;
    }
    // Une police demandée en premier qui n'est pas chargée : secours dessiné (un générique en tête n'est jamais « chargé »).
    const chargee = !estGenerique(premiere) && r.chargees.some((c) => cle(c) === cle(premiere));
    if (!chargee) ecarts.push({ texte: r.texte, demandee: nettoyer(premiere), motif: "non-chargee", rendue });
  }
  return { ecarts, policesRendues };
}
