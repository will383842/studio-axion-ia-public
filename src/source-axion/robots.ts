/**
 * SOURCE AXION-IA.COM — lecture de `robots.txt` (PUR). Le studio suit les règles du groupe qui le vise (son nom
 * `veille-studio-axion-ia`), sinon celles du groupe `*` : `Disallow` / `Allow` (la règle la plus longue l'emporte,
 * `*` et `$` compris), `Crawl-delay`, et les lignes `Sitemap:`.
 */

export const NOM_ROBOT = "veille-studio-axion-ia";

export interface ReglesRobots {
  interdits: string[];
  autorises: string[];
  /** Pause demandée entre deux lectures, en secondes. */
  delaiSec?: number;
  plans: string[];
}

/** Lit un `robots.txt`. Un fichier vide ou absent : tout est permis. */
export function lireRobots(texte: string, robot = NOM_ROBOT): ReglesRobots {
  type Groupe = { agents: string[]; interdits: string[]; autorises: string[]; delaiSec?: number };
  const groupes: Groupe[] = [];
  const plans: string[] = [];
  let courant: Groupe | null = null;
  let dernierEtaitAgent = false;
  for (const brute of texte.split(/\r?\n/)) {
    const ligne = brute.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(ligne);
    if (!m) continue;
    const cle = m[1].toLowerCase();
    const valeur = m[2].trim();
    if (cle === "sitemap") {
      if (valeur) plans.push(valeur);
      continue;
    }
    if (cle === "user-agent") {
      if (!courant || !dernierEtaitAgent) {
        courant = { agents: [], interdits: [], autorises: [] };
        groupes.push(courant);
      }
      courant.agents.push(valeur.toLowerCase());
      dernierEtaitAgent = true;
      continue;
    }
    dernierEtaitAgent = false;
    if (!courant) continue;
    if (cle === "disallow" && valeur) courant.interdits.push(valeur);
    else if (cle === "allow" && valeur) courant.autorises.push(valeur);
    else if (cle === "crawl-delay" && Number.isFinite(Number(valeur))) courant.delaiSec = Number(valeur);
  }
  const nom = robot.toLowerCase();
  const vise = groupes.find((g) => g.agents.some((a) => a !== "*" && nom.includes(a))) ?? groupes.find((g) => g.agents.includes("*"));
  return { interdits: vise?.interdits ?? [], autorises: vise?.autorises ?? [], ...(vise?.delaiSec !== undefined ? { delaiSec: vise.delaiSec } : {}), plans };
}

/** Motif `robots.txt` → expression régulière (`*` = n'importe quoi, `$` = fin). */
function motif(regle: string): RegExp {
  const echappe = regle.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${echappe.endsWith("\\$") ? echappe.slice(0, -2) + "$" : echappe}`);
}

/** La page peut-elle être lue ? La règle la plus longue l'emporte ; à égalité, « Allow ». */
export function autorise(url: string, r: ReglesRobots): boolean {
  let chemin: string;
  try {
    const u = new URL(url);
    chemin = u.pathname + u.search;
  } catch {
    return false;
  }
  let meilleur = { longueur: -1, permis: true };
  for (const [liste, permis] of [
    [r.interdits, false],
    [r.autorises, true],
  ] as const) {
    for (const regle of liste) {
      if (!motif(regle).test(chemin)) continue;
      if (regle.length > meilleur.longueur || (regle.length === meilleur.longueur && permis)) meilleur = { longueur: regle.length, permis };
    }
  }
  return meilleur.permis;
}

/** Pause entre deux lectures : celle demandée par le site, jamais moins de 1,5 s (rythme poli). */
export function pauseEntreLectures(r: Pick<ReglesRobots, "delaiSec">): number {
  return Math.max(1500, Math.round((r.delaiSec ?? 0) * 1000));
}
