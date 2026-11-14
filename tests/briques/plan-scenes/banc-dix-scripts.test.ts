/**
 * GV2-54 — banc d'essai « dix scripts » du plan de scènes : planchers de variété, zéro texte non dit, aucune scène vide.
 * Lit sans les modifier `dix-scripts.ts`, `planPourVideo` et `validerPlan`. Aucun fournisseur réel : un faux déterministe.
 * Tous les seuils sont des PLANCHERS (« au moins »), jamais des valeurs exactes.
 */
import { describe, expect, it } from "vitest";
import { faitsDuScript } from "../../../src/briques/faits-script/extraire";
import type { Fait } from "../../../src/briques/faits-script/types";
import type { AppelClaude } from "../../../src/briques/plan-scenes/generateur";
import type { MotMinute, PlanValide, ScenePlan } from "../../../src/briques/plan-scenes/schema";
import { planDeRepli, type Remarque } from "../../../src/briques/plan-scenes/validateur";
import { devantLeVisage } from "../../../src/briques/plan-scenes/zones";
import { planPourVideo, type MotEnSecondes } from "../../../src/briques/plan-scenes-generateurs/video";
import { DIX_SCRIPTS, motsHorodates } from "../faits-script/dix-scripts";

const FORMAT = { largeur: 1080, hauteur: 1920, fps: 25 as const };
/** Planchers du banc. */
const PIECES_MIN_SANS_MODELE = 5;
const PIECES_MIN_AVEC_MODELE = 8;
const SCENES_MAX_PAR_10_S = 2;
const OCCUPATION_MAX_MS = 6000;
const QUEUE_MAX_MS = 1200;
const NOMBRE_PIEGE = 7531;
const TEXTE_PIEGE = "Une promesse que personne n'a faite";

const enSecondes = (script: string): MotEnSecondes[] => motsHorodates(script).map((m) => ({ texte: m.texte, debutSec: m.debutMs / 1000, finSec: m.finMs / 1000 }));

interface Cas {
  numero: number;
  facecam: boolean;
  plan: PlanValide | null;
  remarques: Remarque[];
}

async function lancer(script: string, facecam: boolean, appeler?: AppelClaude) {
  const mots = enSecondes(script);
  return planPourVideo({ generateur: facecam ? "facecam" : "cas-concret", mots, dureeSec: mots.at(-1)!.finSec + 1, facecam, format: FORMAT, appeler });
}

async function tousLesCas(appeler?: () => AppelClaude): Promise<Cas[]> {
  const cas: Cas[] = [];
  for (const [i, script] of DIX_SCRIPTS.entries()) {
    for (const facecam of [true, false]) {
      const r = await lancer(script, facecam, appeler?.());
      cas.push({ numero: i + 1, facecam, plan: r.plan, remarques: r.remarques });
    }
  }
  return cas;
}

/**
 * Faux fournisseur déterministe (aucun appel réel). Il relit les faits de la REQUÊTE (une ligne par fait : type, mots,
 * valeurs), renvoie pour chacun une scène avec la pièce de données attendue, PLUS une scène piégée posée sur les mots
 * restés libres : un nombre jamais dit et un texte inventé.
 */
function fauxFournisseur(script: string, facecam: boolean): AppelClaude {
  const mots: MotMinute[] = motsHorodates(script);
  return async (requete) => {
    const texte = requete.messages[0]!.contenu as string;
    const bloc = texte.split("Faits du script (type, mots, valeurs) :\n")[1] ?? "";
    const lignes = bloc.split("\n").filter((l) => /^[a-z]+\t\d+-\d+\t\{/.test(l));
    // Les scènes viennent du stock sur les mêmes faits ; on ne retient que les faits listés dans la requête.
    const stock = planDeRepli({ mots, format: FORMAT, facecam, dureeMs: mots.at(-1)!.finMs + 1000 });
    const scenes: unknown[] = [];
    let dernier = -1;
    for (const l of lignes) {
      const [, intervalle] = l.split("\t");
      const [premier] = intervalle!.split("-").map(Number);
      const s = stock.scenes.find((x) => x.mots.premier === premier);
      if (!s) continue;
      // Sans face caméra, le faux compose un passage en barres comparées (pièce voisine d'« avant / après », même valeurs dites).
      const p = s.parametres as { avant?: { valeur: number; surMot: number }; apres?: { valeur: number; surMot: number } };
      const enBarres = !facecam && s.piece === "avant-apres" && p.avant && p.apres;
      const choisie = enBarres
        ? { piece: "barres", parametres: { barres: [{ libelle: "Avant", valeur: p.avant!.valeur, surMot: p.avant!.surMot }, { libelle: "Après", valeur: p.apres!.valeur, surMot: p.apres!.surMot }] } }
        : { piece: s.piece, parametres: s.parametres };
      scenes.push({ ...s, ...choisie, id: `f${scenes.length + 1}` });
      dernier = Math.max(dernier, s.mots.dernier);
    }
    // Scène piégée : sur le dernier mot libre après les scènes de faits (ou le premier mot s'il n'y a aucun fait).
    const libres = scenes.length ? mots.length - 1 - dernier : mots.length;
    if (libres >= 2) {
      const debut = scenes.length ? dernier + 1 : 0;
      const base = { version: 1, niveau: 1, position: facecam ? "bas" : "centre", transition: { entree: "fondu", sortie: "fondu", dureeMs: 400 } };
      scenes.push({ ...base, id: "piege-nombre", mots: { premier: debut, dernier: debut }, debutMs: mots[debut]!.debutMs, finMs: mots[debut]!.finMs + 1000, piece: "compteur", parametres: { valeur: NOMBRE_PIEGE, unite: "%", surMot: debut } });
      if (libres >= 4) scenes.push({ ...base, id: "piege-texte", mots: { premier: debut + 1, dernier: debut + 3 }, debutMs: mots[debut + 1]!.debutMs, finMs: mots[debut + 3]!.finMs, piece: "legende", parametres: { texte: TEXTE_PIEGE, sousTexte: "", style: "bandeau" } });
    }
    const plan = { version: "plan-scenes-1", format: FORMAT, facecam, dureeMs: mots.at(-1)!.finMs + 1000, habillage: { fond: "ivoire", accent: "terracotta" }, mots, scenes };
    return { texte: JSON.stringify(plan), stopReason: "end_turn" } as never;
  };
}

/** Tous les textes affichés par une scène (champs texte des paramètres, hors unités). */
function textesAffiches(p: unknown): string[] {
  if (typeof p === "string") return [p];
  if (Array.isArray(p)) return p.flatMap(textesAffiches);
  if (p && typeof p === "object") return Object.entries(p).filter(([k]) => k !== "unite" && k !== "genre").flatMap(([, v]) => textesAffiches(v));
  return [];
}
const motsDeLaScene = (plan: PlanValide, s: ScenePlan) => plan.mots.slice(s.mots.premier, s.mots.dernier + 1);
const piecesDe = (cas: Cas[]) => new Set(cas.flatMap((c) => c.plan?.scenes.map((s) => s.piece) ?? []));
const nombresAffiches = (p: Record<string, unknown>): number[] => {
  const n: number[] = [];
  if (typeof p.valeur === "number") n.push(p.valeur);
  for (const k of ["avant", "apres"]) if (p[k]) n.push((p[k] as { valeur: number }).valeur);
  for (const b of (p.barres as { valeur: number }[] | undefined) ?? []) n.push(b.valeur);
  return n;
};
const nombresDits = (plan: PlanValide, s: ScenePlan): number[] =>
  faitsDuScript(motsDeLaScene(plan, s)).flatMap((f: Fait) => (f.type === "nombre" ? [f.valeur] : f.type === "passage" ? [f.avant.valeur, f.apres.valeur] : []));

/** Contrôles communs à tout plan, avec ou sans modèle. */
function verifierRegles(cas: Cas[]) {
  for (const c of cas) {
    const nom = `script ${c.numero}${c.facecam ? " (face caméra)" : ""}`;
    const scenes = c.plan?.scenes ?? [];
    scenes.forEach((s, i) => {
      if (i > 0) expect(s.piece, `${nom} : même pièce deux fois de suite`).not.toBe(scenes[i - 1]!.piece);
      if (c.facecam) expect(devantLeVisage(s.position), `${nom} : scène ${s.id} devant le visage`).toBe(false);
      const dernier = c.plan!.mots[s.mots.dernier]!;
      expect(s.finMs - dernier.finMs, `${nom} : scène ${s.id} finit trop longtemps après son dernier mot`).toBeLessThanOrEqual(QUEUE_MAX_MS);
      // Fenêtre de 10 s ouverte au début de chaque scène. Règle du contrôle de densité du produit : plus de 2 scènes n'est
      // toléré que si elles sont courtes (au plus 6 s à l'écran en tout).
      const dansLaFenetre = scenes.filter((x) => x.debutMs >= s.debutMs && x.debutMs < s.debutMs + 10_000);
      if (dansLaFenetre.length > SCENES_MAX_PAR_10_S) {
        const occupation = dansLaFenetre.reduce((t, x) => t + (x.finMs - x.debutMs), 0);
        expect(occupation, `${nom} : ${dansLaFenetre.length} scènes en 10 s, trop longues`).toBeLessThanOrEqual(OCCUPATION_MAX_MS);
      }
    });
  }
}

describe("banc dix scripts : sans modèle (stock seul)", () => {
  it("au moins 5 pièces distinctes sur les dix scripts, avec et sans face caméra", async () => {
    const cas = await tousLesCas();
    const pieces = piecesDe(cas);
    console.info(`[GV2-54] sans modèle : ${pieces.size} pièces distinctes (${[...pieces].join(", ")}) ; scènes par script : ${cas.map((c) => `${c.numero}${c.facecam ? "f" : ""}=${c.plan?.scenes.length ?? 0}`).join(" ")}`);
    expect(pieces.size).toBeGreaterThanOrEqual(PIECES_MIN_SANS_MODELE);
    for (const facecam of [true, false]) expect(piecesDe(cas.filter((c) => c.facecam === facecam)).size).toBeGreaterThanOrEqual(PIECES_MIN_SANS_MODELE);
  });

  it("aucune remarque LITTERALITE, aucune scène vide, aucune légende d'un mot, aucun « 2026 »", async () => {
    for (const c of await tousLesCas()) {
      const nom = `script ${c.numero}${c.facecam ? " (face caméra)" : ""}`;
      expect(c.remarques.map((r) => r.code), nom).not.toContain("LITTERALITE");
      for (const s of c.plan?.scenes ?? []) {
        const p = s.parametres as Record<string, unknown>;
        const vide = textesAffiches(p).every((t) => !t.trim()) && nombresAffiches(p).length === 0;
        expect(vide, `${nom} : scène ${s.id} sans texte ni valeur`).toBe(false);
        if (s.piece === "legende") expect((p.texte as string).trim().split(/\s+/).length, `${nom} : légende d'un mot`).toBeGreaterThan(1);
      }
      expect(JSON.stringify(c.plan?.scenes ?? []), nom).not.toContain("2026");
    }
  });

  it("tout nombre affiché est dit dans la plage de mots de sa scène", async () => {
    for (const c of await tousLesCas()) {
      for (const s of c.plan?.scenes ?? []) {
        const dits = nombresDits(c.plan!, s);
        for (const v of nombresAffiches(s.parametres as Record<string, unknown>)) expect(dits, `script ${c.numero} : ${v} affiché mais non dit`).toContain(v);
      }
    }
  });

  it("jamais deux fois la même pièce de suite, au plus 2 scènes par 10 s, rien devant le visage, queue de 1,2 s au plus", async () => {
    verifierRegles(await tousLesCas());
  });
});

describe("banc dix scripts : avec un faux fournisseur (une scène par fait, plus une scène piégée)", () => {
  async function avecFaux() {
    const cas: Cas[] = [];
    for (const [i, script] of DIX_SCRIPTS.entries()) {
      for (const facecam of [true, false]) {
        const r = await lancer(script, facecam, fauxFournisseur(script, facecam));
        cas.push({ numero: i + 1, facecam, plan: r.plan, remarques: r.remarques });
      }
    }
    return cas;
  }

  it("au moins 8 pièces distinctes sur les dix scripts", async () => {
    const cas = await avecFaux();
    const pieces = piecesDe(cas);
    console.info(`[GV2-54] avec faux fournisseur : ${pieces.size} pièces distinctes (${[...pieces].join(", ")}) ; scènes par script : ${cas.map((c) => `${c.numero}${c.facecam ? "f" : ""}=${c.plan?.scenes.length ?? 0}`).join(" ")}`);
    expect(pieces.size).toBeGreaterThanOrEqual(PIECES_MIN_AVEC_MODELE);
  });

  it("la scène piégée n'est jamais gardée telle quelle (LITTERALITE) et le reste du plan est gardé", async () => {
    const stock = await tousLesCas();
    const cas = await avecFaux();
    let pieges = 0;
    for (const c of cas) {
      const nom = `script ${c.numero}${c.facecam ? " (face caméra)" : ""}`;
      const json = JSON.stringify(c.plan?.scenes ?? []);
      expect(json, nom).not.toContain(String(NOMBRE_PIEGE));
      expect(json, nom).not.toContain("promesse");
      const brut = c.remarques.some((r) => r.sceneId === "piege-nombre" || r.sceneId === "piege-texte");
      if (brut) pieges++;
      if (brut) expect(c.remarques.map((r) => r.code), nom).toContain("LITTERALITE");
      // Le reste du plan est gardé : au moins une scène de fait par fait que le stock retient.
      const attendu = stock.find((x) => x.numero === c.numero && x.facecam === c.facecam)!.plan;
      if (attendu) expect(c.plan?.scenes.length ?? 0, `${nom} : scènes de faits perdues`).toBeGreaterThanOrEqual(attendu.scenes.length);
    }
    expect(pieges).toBeGreaterThan(0);
  });

  it("mêmes règles de variété, de position et de durée que sans modèle", async () => {
    verifierRegles(await avecFaux());
  });
});
