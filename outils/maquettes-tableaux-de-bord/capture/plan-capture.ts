// T-EXT-03 : plan de la capture filmée. Pur, déterministe, ne lève jamais : aucun disque, aucun navigateur, aucune horloge.
// La voix est DÉJÀ fabriquée et mesurée (T-EXT-02) : ici on en lit seulement la forme, sans importer son code.
import { createHash } from "node:crypto";
import type { ScenarioMaquette } from "../../../src/moteurs/montage-tutoriel-outil/scenario-maquette";

/** Avance du geste sur le début de la phrase : le curseur (T-EXT-38) a le temps d'arriver. Valeur de départ, revue au pilote. */
export const AVANCE_GESTE_MS = 600;
export const DUREE_ETAPE_MIN_MS = 400;
export const MARGE_FIN_GESTE_MS = 200;
export const VERSION_NAVIGATION = "navigation-filmee.v1";

export interface CalageEtape {
  id: string;
  debutMs: number;
  finMs: number;
}
export interface Calage {
  dureeVoixMs: number;
  etapes: CalageEtape[];
}
export type LectureCalage = { ok: true; calage: Calage } | { ok: false; erreurs: string[] };

export interface ActionFilm {
  etapeId: string;
  aller: string;
  cible?: string;
  gesteMs: number;
  finMs: number;
  fichierPng: string;
}
export interface ActionCapture {
  etapeId: string;
  aller: string;
  cible?: string;
  fichierPng: string;
}
export type PlanFilm = { ok: true; actions: ActionFilm[] } | { ok: false; erreurs: string[] };

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Lit la sortie de T-EXT-02 ; les champs en plus sont ignorés. */
export function lireCalage(brut: unknown): LectureCalage {
  const erreurs: string[] = [];
  try {
    if (!estObjet(brut)) return { ok: false, erreurs: ["Le calage doit être un objet."] };
    if (!nombre(brut.dureeVoixMs) || brut.dureeVoixMs <= 0) erreurs.push("« dureeVoixMs » doit être un nombre fini > 0.");
    const etapes: CalageEtape[] = [];
    if (!Array.isArray(brut.etapes) || brut.etapes.length === 0) erreurs.push("Le calage doit contenir au moins une étape.");
    else {
      brut.etapes.forEach((e, i) => {
        const lieu = `Étape ${i + 1} du calage`;
        if (!estObjet(e)) return void erreurs.push(`${lieu} : doit être un objet.`);
        const bon =
          typeof e.id === "string" && e.id.trim().length > 0 && nombre(e.debutMs) && nombre(e.finMs) && e.debutMs >= 0 && e.finMs > e.debutMs;
        if (!bon) return void erreurs.push(`${lieu} : « id », « debutMs » et « finMs » doivent être valides (0 ≤ début < fin).`);
        etapes.push({ id: e.id as string, debutMs: e.debutMs as number, finMs: e.finMs as number });
      });
    }
    if (erreurs.length > 0) return { ok: false, erreurs };
    return { ok: true, calage: { dureeVoixMs: brut.dureeVoixMs as number, etapes } };
  } catch {
    return { ok: false, erreurs: ["Calage illisible."] };
  }
}

function nomPng(rang: number, id: string): string {
  const sain = id.replace(/[^A-Za-z0-9_-]+/g, "-");
  return `${String(rang + 1).padStart(2, "0")}-${sain}.png`;
}

/** Mode sans voix (maquettes) : une capture par étape, dans l'ordre du scénario. */
export function planCaptures(scenario: ScenarioMaquette): ActionCapture[] {
  return scenario.etapes.map((e, i) => {
    const a: ActionCapture = { etapeId: e.id, aller: e.aller, fichierPng: nomPng(i, e.id) };
    if (e.cible !== undefined) a.cible = e.cible;
    return a;
  });
}

/** Une action par étape, dans l'ordre du scénario, calée sur la voix mesurée. */
export function planFilm(scenario: ScenarioMaquette, calage: Calage): PlanFilm {
  const erreurs: string[] = [];
  const parId = new Map(calage.etapes.map((e) => [e.id, e] as const));
  const idsScenario = new Set(scenario.etapes.map((e) => e.id));
  for (const e of scenario.etapes) if (!parId.has(e.id)) erreurs.push(`Étape ${e.id} absente du calage.`);
  for (const c of calage.etapes) if (!idsScenario.has(c.id)) erreurs.push(`Étape ${c.id} du calage absente du scénario.`);
  if (erreurs.length > 0) return { ok: false, erreurs };

  const actions: ActionFilm[] = [];
  let precedent: CalageEtape | undefined;
  scenario.etapes.forEach((e, i) => {
    const c = parId.get(e.id)!;
    if (precedent && c.debutMs <= precedent.debutMs) erreurs.push(`Étape ${e.id} : les débuts ne sont pas croissants.`);
    if (c.finMs - c.debutMs < DUREE_ETAPE_MIN_MS) erreurs.push(`Étape ${e.id} : trop courte pour un geste (moins de ${DUREE_ETAPE_MIN_MS} ms).`);
    precedent = c;
    const geste = Math.min(c.debutMs + AVANCE_GESTE_MS, c.finMs - MARGE_FIN_GESTE_MS);
    const a: ActionFilm = { etapeId: e.id, aller: e.aller, gesteMs: geste, finMs: c.finMs, fichierPng: nomPng(i, e.id) };
    if (e.cible !== undefined) a.cible = e.cible;
    actions.push(a);
  });
  const derniere = Math.max(...calage.etapes.map((c) => c.finMs));
  if (calage.dureeVoixMs < derniere) erreurs.push("La durée de la voix est inférieure à la fin de la dernière étape.");
  if (erreurs.length > 0) return { ok: false, erreurs };
  return { ok: true, actions };
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (estObjet(v)) {
    return `{${Object.keys(v)
      .sort()
      .filter((k) => v[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** sha256 (hex) d'une valeur JSON, clés triées : jamais l'horloge. */
export function empreinte(valeur: unknown): string {
  return createHash("sha256").update(stable(valeur)).digest("hex");
}

/** Empreinte du scénario ET du calage (le calage absent compte : mode sans voix). */
export function empreinteCapture(scenario: ScenarioMaquette, calage?: Calage): string {
  return empreinte({ scenario, calage: calage ?? null });
}

export function nomDossierSortie(maquette: string, empreinteCapt: string): string {
  const sain = maquette.replace(/[^A-Za-z0-9_-]+/g, "-");
  return `${sain}-${empreinteCapt.slice(0, 12)}`;
}

export interface IntervalleFige {
  debutMs: number;
  finMs: number;
}

/** Lit les lignes `freeze_start` / `freeze_end` de FFmpeg (secondes) et les ramène sur l'horloge de la voix. */
export function lireFreezedetect(texteStderr: string, debutFilmMs: number): IntervalleFige[] {
  if (!texteStderr) return [];
  const versVoix = (s: string) => Math.max(0, Math.round(Number(s) * 1000) - Math.round(debutFilmMs));
  const duree = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(texteStderr);
  let finFilmMs: number | undefined;
  if (duree) finFilmMs = versVoix(String(Number(duree[1]) * 3600 + Number(duree[2]) * 60 + Number(duree[3])));
  else {
    const temps = [...texteStderr.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)].pop();
    if (temps) finFilmMs = versVoix(String(Number(temps[1]) * 3600 + Number(temps[2]) * 60 + Number(temps[3])));
  }
  const sortie: IntervalleFige[] = [];
  let debut: number | undefined;
  for (const ligne of texteStderr.split(/\r?\n/)) {
    const d = /freeze_start:\s*(-?[\d.]+)/.exec(ligne);
    const f = /freeze_end:\s*(-?[\d.]+)/.exec(ligne);
    if (d) {
      if (debut !== undefined && finFilmMs !== undefined) sortie.push({ debutMs: debut, finMs: Math.max(debut, finFilmMs) });
      debut = versVoix(d[1]!);
    } else if (f && debut !== undefined) {
      sortie.push({ debutMs: debut, finMs: Math.max(debut, versVoix(f[1]!)) });
      debut = undefined;
    }
  }
  if (debut !== undefined && finFilmMs !== undefined) sortie.push({ debutMs: debut, finMs: Math.max(debut, finFilmMs) });
  return sortie;
}

export interface RectPx {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}
export interface MesureEtape {
  etapeId: string;
  /** Rectangle mesuré (px CSS), absent si l'étape n'a pas de cible. */
  rectPx?: RectPx;
  /** Clic MESURÉ, horloge de la voix. */
  instantMs: number;
  finMs: number;
}
export interface CibleNavigation {
  etapeId: string;
  zonePct?: RectPx;
  instantMs: number;
  finMs: number;
}
export interface NavigationFilmee {
  version: typeof VERSION_NAVIGATION;
  maquette: string;
  largeur: number;
  hauteur: number;
  debutFilmMs: number;
  dureeVoixMs: number;
  cibles: CibleNavigation[];
  figees?: IntervalleFige[];
}

const ms = (n: number) => Math.round(n);
const pct = (n: number) => Math.round(n * 100) / 100;

export function zonePctDepuisRect(r: RectPx, largeur: number, hauteur: number): RectPx {
  return {
    x: pct((r.x / largeur) * 100),
    y: pct((r.y / hauteur) * 100),
    largeur: pct((r.largeur / largeur) * 100),
    hauteur: pct((r.hauteur / hauteur) * 100),
  };
}

/**
 * POSTE-7 : zone en % RAMENÉE DANS L'IMAGE filmée (intersection du rectangle et de la fenêtre 0-100 %), au centième,
 * telle que `lireNavigationFilmee` l'accepte (x, y, largeur, hauteur dans 0-100, largeur et hauteur > 0, x + largeur ≤ 100
 * et y + hauteur ≤ 100 en nombres flottants). Zone entièrement hors image (ou réduite à moins de 0,01 %) : `undefined`
 * (la cible garde alors son clic, sans `zonePct`, ce que le lecteur accepte). Pure, ne lève jamais.
 */
export function zoneDansImage(r: RectPx, largeur: number, hauteur: number): RectPx | undefined {
  if (![r.x, r.y, r.largeur, r.hauteur, largeur, hauteur].every(Number.isFinite) || largeur <= 0 || hauteur <= 0) return undefined;
  // Calcul en centièmes de % entiers : aucune dérive d'arrondi aux bornes.
  const borne = (debut: number, longueur: number, total: number): { d: number; l: number } | undefined => {
    const a = Math.min(10000, Math.max(0, Math.round((debut / total) * 10000)));
    const b = Math.min(10000, Math.max(0, Math.round(((debut + longueur) / total) * 10000)));
    return b > a ? { d: a, l: b - a } : undefined;
  };
  const bx = borne(r.x, r.largeur, largeur);
  const by = borne(r.y, r.hauteur, hauteur);
  if (!bx || !by) return undefined;
  const somme = (d: number, l: number) => d / 100 + l / 100;
  let lx = bx.l;
  while (lx > 0 && somme(bx.d, lx) > 100) lx -= 1;
  let ly = by.l;
  while (ly > 0 && somme(by.d, ly) > 100) ly -= 1;
  if (lx <= 0 || ly <= 0) return undefined;
  return { x: bx.d / 100, y: by.d / 100, largeur: lx / 100, hauteur: ly / 100 };
}

/** Construit `navigation.json` : millisecondes entières, zones à 0,01 % ramenées dans l'image (POSTE-7) ; `figees` absent quand non mesuré. */
export function navigationJson(p: {
  maquette: string;
  largeur: number;
  hauteur: number;
  debutFilmMs: number;
  dureeVoixMs: number;
  mesures: MesureEtape[];
  figees?: IntervalleFige[];
}): NavigationFilmee {
  const cibles: CibleNavigation[] = p.mesures.map((m) => {
    const c: CibleNavigation = { etapeId: m.etapeId, instantMs: ms(m.instantMs), finMs: ms(m.finMs) };
    const zone = m.rectPx ? zoneDansImage(m.rectPx, p.largeur, p.hauteur) : undefined;
    if (zone) c.zonePct = zone;
    return c;
  });
  const n: NavigationFilmee = {
    version: VERSION_NAVIGATION,
    maquette: p.maquette,
    largeur: p.largeur,
    hauteur: p.hauteur,
    debutFilmMs: ms(p.debutFilmMs),
    dureeVoixMs: ms(p.dureeVoixMs),
    cibles,
  };
  if (p.figees) n.figees = p.figees.map((f) => ({ debutMs: ms(f.debutMs), finMs: ms(f.finMs) }));
  return n;
}
