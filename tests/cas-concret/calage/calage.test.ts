/**
 * M5 · Calage des écrans sur les mots : la vidéo de référence (mots.json, tempo 1,08) redonne les débuts de plans.json.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VERSION_FICHE_ECRANS, type EcranCorps, type EcranFin, type FicheEcrans, type FinPlanifiee } from "@/moteurs/montage-cas-concret/fiche";
import { calerFiche, IMAGE_MS } from "@/moteurs/montage-cas-concret/calage";
import { ECRAN_DUREE_MIN_MS, TENUE_FINALE_MS, manquementsDurees, regleDureeEcransFin } from "@/moteurs/montage-cas-concret/regles";
import type { MotCalage } from "@/briques/motion/calage";

const DOSSIER = join(__dirname, "..", "temoin", "reference");
const lire = <T>(f: string): T => JSON.parse(readFileSync(join(DOSSIER, f), "utf8")) as T;
const REF_MOTS = lire<{ mots: { word: string; start: number; end: number }[] }>("mots.json").mots;
const REF_PLANS = lire<{ tempo: number; duree: number; plans: { id: string; debut: number; fin: number }[] }>("plans.json");
const TEMPO = REF_PLANS.tempo;

/** Mots de la voix au tempo final (divisés par le tempo), comme la voix assemblée les rend. */
const motsDits: MotCalage[] = REF_MOTS.map((m) => ({ mot: m.word, debutSec: m.start / TEMPO, finSec: m.end / TEMPO }));

const net = (s: string) => s.toLowerCase().replace(/[.,?!:;«»"]/g, "").trim();
/** Rang (dans `REF_MOTS`) du n-ième mot « mot », comme la fonction `q` de v8-a.html (mots de durée nulle ignorés). */
function rang(mot: string, n = 1): number {
  let vu = 0;
  for (const [i, m] of REF_MOTS.entries()) if (m.end > m.start && net(m.word) === mot && ++vu === n) return i;
  throw new Error(`mot « ${mot} » absent`);
}

/** Plans de v8-a.html : [id, mot d'ancrage, n-ième, avance en secondes] (recopiés de la ligne `PLANS`). */
const PLANS: [string, string, number, number][] = [
  ["s1", "on", 1, 0], ["s2", "quinze", 1, 0.08], ["s4", "avant", 1, 0.1], ["s6", "alors", 1, 0.1], ["s7", "voit", 1, 0.45], ["s8", "s'inscrit", 1, 0.25],
  ["s9", "reçoit", 1, 0.25], ["s10", "choisit", 1, 0.25], ["s11", "oublie", 1, 0.48], ["s12", "nous", 1, 0.1], ["s13", "c'est", 1, 0.08], ["s14", "derrière", 1, 0.1],
  ["s16", "dossier", 1, 0.28], ["s16b", "conforme", 1, 0.42], ["s17", "résultat", 1, 0.1], ["s18", "dans", 1, 0.18], ["s19", "écrivez", 1, 0.1], ["s20", "on", 4, 0.1], ["s21", "ou", 1, 0.12],
];
const NB_CORPS = 16; // s1 à s18 : 16 plans ; s19, s20, s21 sont la fin

const debuts = PLANS.map(([, mot, n]) => rang(mot, n));
const texteDe = (k: number) => REF_MOTS.slice(debuts[k], k + 1 < PLANS.length ? debuts[k + 1] : REF_MOTS.length).map((m) => m.word).join(" ");

const commun = (k: number) => ({ fond: "sombre" as const, marque: "axion-ia.com", texteDit: texteDe(k), avanceMs: Math.round(PLANS[k][3] * 1000), evenements: [] });
const corps = (): EcranCorps[] =>
  PLANS.slice(0, NB_CORPS).map((_, k) => ({ ...commun(k), id: `e${String(k + 1).padStart(2, "0")}`, type: "titre", lignes: ["Titre"] }) as EcranCorps);
const fiche = (): FicheEcrans => ({
  version: VERSION_FICHE_ECRANS, formatId: "cas-concret", videoId: "video-1", versionId: "version-1", habillage: "charte-duo/1", ratio: "9:16",
  offre: "integration", origine: "porte-a", posture: "chez-nous", casId: "recrutement-apporteurs", empreinteCas: "cas-0123456789abcdef-1a", ecrans: corps(),
});
const fin = (): FinPlanifiee => ({
  id: "fin-facebook", reseaux: ["facebook"], appels: [],
  ecrans: [
    { ...commun(NB_CORPS), id: "f01", type: "appel-mot", fins: ["fin-if-mot"], mot: "IA" },
    { ...commun(NB_CORPS + 1), id: "f02", type: "promesse", fins: ["fin-if-cadeau-automatisation"], cadeau: "Toute la structure" },
    { ...commun(NB_CORPS + 2), id: "f03", type: "lien", fins: ["fin-fb-lien-commentaire"], titre: "Le lien est en commentaire", bulle: "Diagnostic gratuit · lien en commentaire" },
  ] as EcranFin[],
});

const options = { finApresDernierMotSec: 2.1 };
const deuxImages = 2 * IMAGE_MS;

describe("M5 · calage sur la vidéo de référence", () => {
  it("les 19 plans commencent à 2 images près de plans.json, la durée totale aussi", () => {
    const r = calerFiche(fiche(), fin(), motsDits, options);
    if (!r.ok) throw new Error(r.problemes.join("\n"));
    const ecrans = [...r.fiche.ecrans, ...r.fin!.ecrans];
    expect(ecrans).toHaveLength(REF_PLANS.plans.length);
    ecrans.forEach((e, k) => {
      const ref = REF_PLANS.plans[k];
      expect(Math.abs(e.debutMs! - ref.debut * 1000), `${ref.id} début`).toBeLessThanOrEqual(deuxImages);
      expect(Math.abs(e.finMs! - ref.fin * 1000), `${ref.id} fin`).toBeLessThanOrEqual(deuxImages);
    });
    expect(Math.abs(r.dureeMs - REF_PLANS.duree * 1000)).toBeLessThanOrEqual(deuxImages);
    expect(r.fiche.ecrans[0].debutMs).toBe(0);
  });

  it("aucun trou ni recouvrement, heures multiples de 40 ms", () => {
    const r = calerFiche(fiche(), fin(), motsDits, options);
    if (!r.ok) throw new Error(r.problemes.join("\n"));
    const ecrans = [...r.fiche.ecrans, ...r.fin!.ecrans];
    ecrans.forEach((e, k) => {
      expect(e.debutMs! % IMAGE_MS, e.id).toBe(0);
      expect(e.finMs! % IMAGE_MS, e.id).toBe(0);
      expect(e.finMs!, e.id).toBeGreaterThan(e.debutMs!);
      if (k > 0) expect(e.debutMs, e.id).toBe(ecrans[k - 1].finMs);
    });
  });

  it("sans fin : le dernier écran du corps finit 2,1 s après le dernier mot", () => {
    const f = fiche();
    const dernier = REF_MOTS.slice(0, debuts[NB_CORPS]);
    const r = calerFiche(f, null, dernier.map((m) => ({ mot: m.word, debutSec: m.start / TEMPO, finSec: m.end / TEMPO })), options);
    if (!r.ok) throw new Error(r.problemes.join("\n"));
    expect(r.fin).toBeNull();
    const attendu = Math.round((dernier.at(-1)!.end / TEMPO + 2.1) * 1000);
    expect(Math.abs(r.dureeMs - attendu)).toBeLessThanOrEqual(IMAGE_MS / 2);
  });

  it("un mot manquant est refusé, en nommant l'écran et le mot", () => {
    const sans = motsDits.filter((_, i) => i !== debuts[3] + 2);
    const r = calerFiche(fiche(), fin(), sans, options);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemes[0]).toMatch(/Écran e0[34] · .*« .+ »/);
  });

  it("un mot rendu différent du mot écrit est refusé, avec les deux mots", () => {
    const autre = motsDits.map((m, i) => (i === debuts[5] + 1 ? { ...m, mot: "banane" } : m));
    const r = calerFiche(fiche(), fin(), autre, options);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problemes[0]).toContain("Écran e06");
      expect(r.problemes[0]).toContain("banane");
    }
  });

  it("des mots en trop ou en moins en fin de voix sont refusés", () => {
    const trop = [...motsDits, { mot: "encore", debutSec: 60, finSec: 60.4 }];
    const r = calerFiche(fiche(), fin(), trop, options);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemes[0]).toContain("de plus");
    expect(calerFiche(fiche(), fin(), motsDits.slice(0, -3), options).ok).toBe(false);
  });

  it("un événement tombe au début de son mot moins son avance, dans son écran", () => {
    const f = fiche();
    f.ecrans[1] = { ...f.ecrans[1], evenements: [{ cible: "titre-2", surMot: 2, avanceMs: 100 }, { cible: "titre-1", surMot: 0, avanceMs: 100 }] };
    const r = calerFiche(f, fin(), motsDits, options);
    if (!r.ok) throw new Error(r.problemes.join("\n"));
    const e2 = r.fiche.ecrans[1];
    const [l2, l1] = r.evenements.filter((e) => e.ecranId === e2.id);
    const brut = (motsDits[debuts[1] + 2].debutSec * 1000) - 100;
    expect(Math.abs(l2.debutMs - brut)).toBeLessThanOrEqual(IMAGE_MS / 2);
    expect(l2.debutMs % IMAGE_MS).toBe(0);
    expect(l1.debutMs).toBe(e2.debutMs); // l'événement du premier mot ne peut pas précéder son écran
  });

  it("un événement sur un mot absent du texte est refusé avant tout calage", () => {
    const f = fiche();
    f.ecrans[0] = { ...f.ecrans[0], evenements: [{ cible: "ligne-1", surMot: 99, avanceMs: 0 }] };
    const r = calerFiche(f, fin(), motsDits, options);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemes[0]).toContain("Écran e01");
  });

  it("un nombre écrit en chiffres peut être dit en lettres ; une prononciation est tolérée", () => {
    const f = fiche();
    f.ecrans = [{ ...f.ecrans[0], texteDit: "Quinze minutes", avanceMs: 0 }] as EcranCorps[];
    const mots2: MotCalage[] = [{ mot: "quinze", debutSec: 0.1, finSec: 0.4 }, { mot: "minutes", debutSec: 0.5, finSec: 0.9 }];
    expect(calerFiche(f, null, mots2, options).ok).toBe(true);
    f.ecrans = [{ ...f.ecrans[0], texteDit: "Écrivez IA", avanceMs: 0 }] as EcranCorps[];
    const dit: MotCalage[] = [{ mot: "Écrivez", debutSec: 0.1, finSec: 0.4 }, { mot: "I.A.", debutSec: 0.5, finSec: 0.9 }];
    expect(calerFiche(f, null, dit, options).ok).toBe(true);
    const phonetique: MotCalage[] = [{ mot: "Écrivez", debutSec: 0.1, finSec: 0.4 }, { mot: "yaa", debutSec: 0.5, finSec: 0.9 }];
    expect(calerFiche(f, null, phonetique, options).ok).toBe(false);
    expect(calerFiche(f, null, phonetique, { ...options, prononciations: [{ mot: "IA", prononciation: "yaa" }] }).ok).toBe(true);
  });

  it("déterministe : deux calages donnent le même résultat", () => {
    expect(JSON.stringify(calerFiche(fiche(), fin(), motsDits, options))).toBe(JSON.stringify(calerFiche(fiche(), fin(), motsDits, options)));
  });
});

/**
 * X1 · Un écran trop court ne sort jamais du calage : quand le mot-repère d'un écran arrive moins d'une seconde après celui
 * du précédent, l'écran prend du temps au précédent (s'il en a), sinon retarde le suivant ; jamais au-delà de la jonction
 * corps / fin (le corps finit au même instant pour toutes les fins).
 */
describe("X1 · écran trop court", () => {
  /** Mots de la référence où l'écran `k` ne dure plus que `dureeSec` (tous les mots suivants sont avancés d'autant). */
  function serre(k: number, dureeSec: number): MotCalage[] {
    const debut = REF_MOTS[debuts[k]].start / TEMPO;
    const suivant = REF_MOTS[debuts[k + 1]].start / TEMPO;
    const delta = suivant - debut - dureeSec;
    const mots = motsDits.map((m, i) => (i >= debuts[k + 1] ? { ...m, debutSec: m.debutSec - delta, finSec: m.finSec - delta } : { ...m }));
    // Les mots de l'écran serré tiennent dans sa nouvelle durée.
    for (let i = debuts[k]; i < debuts[k + 1]; i++) {
      const r = (x: number) => debut + ((x - debut) * dureeSec) / (suivant - debut);
      mots[i] = { ...mots[i], debutSec: r(mots[i].debutSec), finSec: Math.min(r(mots[i].finSec), debut + dureeSec) };
    }
    return mots;
  }
  const duree = (e: { debutMs?: number; finMs?: number }) => e.finMs! - e.debutMs!;
  const caler = (mots: MotCalage[]) => {
    const r = calerFiche(fiche(), fin(), mots, options);
    if (!r.ok) throw new Error(r.problemes.join("\n"));
    return r;
  };

  it.each([
    ["un écran du corps", 4],
    ["l'avant-dernier écran du corps", NB_CORPS - 2],
    ["le dernier écran du corps", NB_CORPS - 1],
    ["le premier écran de la fin", NB_CORPS],
  ])("%s à 0,5 s : chaque écran dure au moins 1 s, sans trou ni recouvrement", (_, k) => {
    const r = caler(serre(k, 0.5));
    const ecrans = [...r.fiche.ecrans, ...r.fin!.ecrans];
    ecrans.forEach((e, i) => {
      expect(duree(e), e.id).toBeGreaterThanOrEqual(ECRAN_DUREE_MIN_MS);
      expect(e.debutMs! % IMAGE_MS, e.id).toBe(0);
      if (i > 0) expect(e.debutMs, e.id).toBe(ecrans[i - 1].finMs);
    });
    // La référence a un écran de liste de 9 s (au-delà de 5 s) : seuls les écrans trop courts comptent ici.
    const courts = (m: { detail: string }[]) => m.filter((x) => x.detail.includes("au moins"));
    expect(courts(manquementsDurees(r.fiche.ecrans, 3.4))).toEqual([]);
    expect(courts(regleDureeEcransFin(r.fin!, {}))).toEqual([]);
  });

  it("B3-bis · le dernier écran de la fin, dit en moins d'1 s, est étiré : 1 s au moins hors tenue finale", () => {
    const k = debuts.length - 1;
    const debut = motsDits[debuts[k]].debutSec;
    const fin = motsDits[motsDits.length - 1].finSec;
    const mots = motsDits.map((m, i) => (i >= debuts[k] ? { ...m, debutSec: debut + ((m.debutSec - debut) * 0.5) / (fin - debut), finSec: debut + ((m.finSec - debut) * 0.5) / (fin - debut) } : { ...m }));
    const r = caler(mots);
    const dernier = r.fin!.ecrans.at(-1)!;
    expect(duree(dernier) - TENUE_FINALE_MS).toBeGreaterThanOrEqual(ECRAN_DUREE_MIN_MS);
    expect(manquementsDurees(r.fin!.ecrans, 3.4, { finale: true, seulement: "trop-court" })).toEqual([]);
  });

  it("la jonction du corps et de la fin ne bouge pas", () => {
    const sans = caler(motsDits);
    for (const k of [NB_CORPS - 1, NB_CORPS]) {
      const mots = serre(k, 0.5);
      const r = caler(mots);
      const attendu = k === NB_CORPS - 1 ? r.fin!.ecrans[0].debutMs : undefined;
      expect(r.fiche.ecrans[NB_CORPS - 1].finMs).toBe(r.fin!.ecrans[0].debutMs);
      if (attendu !== undefined) expect(r.fin!.ecrans[0].debutMs).toBe(Math.round((mots[debuts[NB_CORPS]].debutSec * 1000 - fin().ecrans[0].avanceMs) / IMAGE_MS) * IMAGE_MS);
    }
    expect(sans.fiche.ecrans[NB_CORPS - 1].finMs).toBe(sans.fin!.ecrans[0].debutMs);
  });

  it("un écran déjà assez long n'est pas touché", () => {
    const sans = caler(motsDits);
    const r = caler(serre(4, 0.5));
    for (const i of [0, 1, 2]) expect(r.fiche.ecrans[i].debutMs, `e${i + 1}`).toBe(sans.fiche.ecrans[i].debutMs);
  });

  it("déterministe", () => {
    expect(caler(serre(4, 0.3))).toEqual(caler(serre(4, 0.3)));
  });
});
