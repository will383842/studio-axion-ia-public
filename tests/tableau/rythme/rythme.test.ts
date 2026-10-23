/**
 * RÉPARATION AUTOMATIQUE DU RYTHME (règle 16, `src/moteurs/montage-tableau/rythme.ts`) : la fiche témoin de l'essai
 * réel n° 3 (refusée pour deux trous, scènes s04 et s07) passe après réparation ; des scènes de 6 à 16 s aux éléments
 * mal ancrés passent toutes la règle ; une fiche qui passe n'est jamais touchée ; la réparation est idempotente. Aucun
 * appel : tout est local.
 */
import { describe, expect, it } from "vitest";
import { decouperEnScenes, roleDecoupageTableau, CONSIGNE_DECOUPAGE, type EntreeDecoupage, type OutilsDecoupage } from "../../../src/moteurs/montage-tableau/decoupage";
import { validerFicheTableau, type ElementTableau, type FicheTableau, type SceneTableau } from "../../../src/moteurs/montage-tableau/fiche";
import { ECART_EVENEMENT_MAX_MS, regleEcrans, regleReferencesInternes, regleRythme, trousRythme, type ContexteTableau } from "../../../src/moteurs/montage-tableau/regles";
import { couperScene, reparerRythme } from "../../../src/moteurs/montage-tableau/rythme";
import { debutsDePhrase, mots } from "../../../src/domaine/controles-script/texte";
import { CARACTERES_DITS_MAX_TABLEAU, caracteresDits } from "../../../src/domaine/duree-tableau";
import { contexteFormation, ficheFormation } from "../style-v2/temoin-formation";
import { EXEMPLES, contexteExemple } from "../regles/exemples";
import { SCRIPT_HABITUDE, contexteHabitude, ficheHabitude } from "./temoin-habitude";

const copie = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const lignes = (f: FicheTableau) => f.scenes.flatMap((s) => s.elements.flatMap((e) => (e.type === "ligne" ? [e.texte] : [])));
const texteDe = (f: FicheTableau) => f.scenes.map((s) => s.texteDit).join(" ");

describe("témoin de l'essai réel n° 3 : refusée pour le rythme en s04 et s07, acceptée après réparation", () => {
  it("le témoin est fidèle : environ 90 s dites au débit de 165 mots/min, sous la borne de longueur, 10 scènes", () => {
    // Lot B2b : la fiche d'origine (1 697 caractères, 82 s à 20,5 car/s) dépassait la limite de 1 520 au nouveau débit
    // (voix-tableau/3). Refaite à 1 515 caractères dits (≈ 89,6 s à 16,9 car/s, mesure écrite plus bas) ; s04 et s07 restent ceux de l'essai réel.
    const n = caracteresDits(SCRIPT_HABITUDE.join(" "));
    expect(n).toBe(1515);
    expect(n).toBeGreaterThan(1450);
    expect(n).toBeLessThanOrEqual(CARACTERES_DITS_MAX_TABLEAU);
    expect(ficheHabitude().scenes).toHaveLength(10);
  });

  it("telle que rendue par le modèle : refusée par la seule règle du rythme, scènes s04 et s07, avec quoi faire", () => {
    const v = validerFicheTableau(ficheHabitude(), contexteHabitude());
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(new Set(v.problemes.map((p) => p.sceneId))).toEqual(new Set(["s04", "s07"]));
    for (const p of v.problemes) expect(p.message).toMatch(/règle « du rythme : un événement visuel toutes les 4 secondes » : aucun événement visuel entre/);
    expect(v.problemes.find((p) => p.sceneId === "s04")!.message).toMatch(/Ajoutez une ligne écrite ou un geste dans la scène 4\.$/);
  });

  it("réparée : toutes les règles passent, sans un mot dit ni écrit de changé, sans élément ni scène en plus", () => {
    const avant = ficheHabitude();
    const apres = reparerRythme(avant);
    const v = validerFicheTableau(apres, contexteHabitude());
    expect(v.ok ? [] : v.problemes.map((p) => p.message)).toEqual([]);
    expect(texteDe(apres)).toBe(texteDe(avant));
    expect(lignes(apres)).toEqual(lignes(avant));
    expect(apres.scenes.map((s) => s.elements.map((e) => e.id))).toEqual(avant.scenes.map((s) => s.elements.map((e) => e.id)));
    // Seules les deux scènes refusées changent.
    for (const s of apres.scenes) if (s.id !== "s04" && s.id !== "s07") expect(s).toEqual(avant.scenes.find((x) => x.id === s.id));
  });

  it("chaque ligne reste au mot où ses mots sont dits ; l'ordre d'apparition des lignes est gardé", () => {
    const apres = reparerRythme(ficheHabitude());
    const s04 = apres.scenes.find((s) => s.id === "s04")!;
    const s07 = apres.scenes.find((s) => s.id === "s07")!;
    const ancre = (s: SceneTableau, id: string) => (s.elements.find((e) => e.id === id) as { ancre: number }).ancre;
    const mot = (s: SceneTableau, id: string) => mots(s.texteDit)[ancre(s, id)];
    expect(mot(s04, "e16")).toBe("moment");
    expect(mot(s04, "e18")).toBe("chaque");
    // Mesuré au lot B2b (débit 165 mots/min) : la réparation repose « Avant : comptes rendus tapés le soir » sur « rendus »
    // (à l'ancien débit : « tape ») ; chaque ligne reste sur un mot qu'elle écrit.
    expect(mot(s07, "e31")).toBe("rendus");
    // « Après : dicté… » : mesuré au lot B2b, la réparation la pose sur « à » (le mot juste après « dicté », moins de 0,3 s plus
    // tard à 16,9 car/s) ; à l'ancien débit elle restait sur « dicté ». Jamais plus d'un mot d'écart.
    expect(ancre(s07, "e32") - mots(s07.texteDit).indexOf("dicté")).toBeLessThanOrEqual(1);
    expect(ancre(s07, "e32")).toBeGreaterThanOrEqual(mots(s07.texteDit).indexOf("dicté"));
    expect(mot(s07, "e32")).toBe("à");
    // Le geste suit sa cible.
    expect(ancre(s04, "e20")).toBeGreaterThanOrEqual(ancre(s04, "e19"));
    expect(ancre(s07, "e34")).toBeGreaterThanOrEqual(ancre(s07, "e32"));
    for (const s of [s04, s07]) {
      const l = s.elements.filter((e) => e.type === "ligne").map((e) => (e as { ancre: number }).ancre);
      expect(l).toEqual([...l].sort((a, b) => a - b));
    }
  });

  it("idempotente : la fiche réparée, réparée encore, est rendue telle quelle (même objet)", () => {
    const une = reparerRythme(ficheHabitude());
    expect(reparerRythme(une)).toBe(une);
  });

  it("au découpage : la réponse du modèle est réparée à la lecture et acceptée du premier appel", async () => {
    const { texteScript, ...controle } = contexteHabitude();
    const f = ficheHabitude();
    const entree: EntreeDecoupage = {
      texteScript,
      structure: f.structure,
      serie: f.serie,
      douleur: f.douleur,
      gesteMinute: f.gesteMinute,
      preuves: [{ id: "matiere-demo-agence", resume: "Comptes rendus de visite dictés en sortant." }],
      dessins: [...new Set(f.scenes.flatMap((s) => s.elements.flatMap((e) => (e.type === "dessin" ? [e.dessinId] : []))))].map((id) => ({ id, motsCles: [id] })),
      videoId: f.videoId,
      versionId: f.versionId,
      habillage: f.habillage,
      stylo: f.stylo,
      ratio: f.ratio,
      controle,
    };
    let appels = 0;
    const outils: OutilsDecoupage = {
      appeler: async () => (appels++, { ok: true, simule: false, donnees: JSON.stringify(f) }),
      budget: { reserver: async () => ({ ok: true }) },
    };
    const r = await decouperEnScenes(entree, outils);
    expect(r.ok ? [] : r.refus).toEqual([]);
    expect(r).toMatchObject({ ok: true, appels: 1, relance: false });
    expect(appels).toBe(1);
  });
});

describe("une fiche qui passe n'est jamais touchée", () => {
  it("témoin « Formation » et fiches d'exemple : rendues telles quelles (même objet)", () => {
    const formation = ficheFormation();
    expect(validerFicheTableau(formation, contexteFormation()).ok).toBe(true);
    expect(reparerRythme(formation)).toBe(formation);
    for (const f of Object.values(EXEMPLES)) {
      expect(regleRythme(f, contexteExemple(f))).toEqual([]);
      expect(reparerRythme(f)).toBe(f);
    }
  });

  it("une entrée mal formée est rendue telle quelle", () => {
    for (const x of [null, "texte", { scenes: [{ id: "s01" }] }, { scenes: "non" }]) expect(reparerRythme(x)).toBe(x);
  });
});

/* ------------------------------------------------------------------ */
/* Test général : scènes de 6 à 16 s, 2 à 5 éléments mal ancrés          */
/* ------------------------------------------------------------------ */

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function hasard(graine: number) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PHRASES = [
  "Choisissez une tâche qui revient chaque semaine.",
  "Dictez trois notes en sortant du rendez-vous.",
  "Gardez la même demande pendant cinq jours.",
  "Le déclencheur, c'est le moment, pas la volonté.",
  "Rangez la demande dans une note du téléphone.",
  "Regardez le vendredi ce que vous avez gagné.",
  "Commencez petit, sinon vous arrêterez vite.",
  "Une seule chose change chaque jour.",
];
const DESSINS = ["horloge", "telephone", "crayon", "calendrier", "cible"];

/** Une scène de `duree` secondes dites, avec `n` éléments ancrés au pire (groupés au début, ou au hasard). */
function sceneMalAncree(id: string, duree: number, n: number, x: () => number, page: number, v2: boolean): SceneTableau {
  const phrases: string[] = [];
  while (caracteresDits(phrases.join(" ")) < duree * 20.5) phrases.push(PHRASES[Math.floor(x() * PHRASES.length)]);
  const texteDit = phrases.join(" ");
  const nMots = mots(texteDit).length;
  const groupe = x() < 0.6;
  const ancre = () => (groupe ? Math.floor(x() * Math.min(4, nMots)) : Math.floor(x() * nMots));
  const elements: ElementTableau[] = [];
  for (let k = 0; k < n; k++) {
    const eid = `${id}e${k + 1}`;
    if (k === 0 || x() < 0.5) elements.push({ id: eid, type: "ligne", texte: phrases[Math.floor(x() * phrases.length)].split(" ").slice(0, 4).join(" "), niveau: "texte", role: "regle", ancre: ancre() });
    else elements.push({ id: eid, type: "dessin", dessinId: DESSINS[k % DESSINS.length], cote: "droite", ancre: ancre() });
  }
  return { id, role: "etape", page, texteDit, elements, ...(v2 ? { ecrans: [{ moment: "etape" as const, gabarit: "etape" as const }] } : {}) };
}

function ficheMalAncree(graine: number, v2: boolean): FicheTableau {
  const x = hasard(graine);
  const nScenes = 4 + Math.floor(x() * 4);
  const scenes = Array.from({ length: nScenes }, (_, i) => sceneMalAncree(`s${String(i + 1).padStart(2, "0")}`, 6 + x() * 10, 2 + Math.floor(x() * 4), x, Math.min(6, i + 1), v2));
  return { ...copie(ficheFormation()), habillage: v2 ? "blocs/2" : "charte-video/1", scenes };
}

describe("test général : des scènes de 6 à 16 s, 2 à 5 éléments mal ancrés, passent toutes la règle après réparation", () => {
  const graines = Array.from({ length: 120 }, (_, i) => i + 1);

  it("style « blocs/2 » (celui des nouvelles fiches) : la règle du rythme passe, entière", () => {
    let refusees = 0;
    for (const g of graines) {
      const f = ficheMalAncree(g, true);
      const ctx = { ...contexteFormation(), texteScript: texteDe(f) } as ContexteTableau;
      if (regleRythme(f, ctx).length) refusees++;
      const r = reparerRythme(f);
      expect(regleRythme(r, ctx), `graine ${g}`).toEqual([]);
      // Rien d'inventé, rien de cassé.
      expect(texteDe(r)).toBe(texteDe(f));
      expect(new Set(lignes(r))).toEqual(new Set(lignes(f)));
      expect(regleReferencesInternes(r)).toEqual([]);
      expect(regleEcrans(r)).toEqual([]);
      expect(r.scenes.length).toBeLessThanOrEqual(10);
      for (const s of r.scenes) expect(s.elements.length).toBeLessThanOrEqual(6);
      for (const s of r.scenes) for (const e of s.elements) if (e.type === "geste") expect(["souligner", "entourer"]).toContain(e.geste);
      expect(reparerRythme(r), `graine ${g} : idempotente`).toBe(r);
    }
    // Le jeu d'essai est vraiment mauvais au départ.
    expect(refusees).toBeGreaterThan(graines.length / 2);
  });

  it("style « page écrite » (fiches d'avant le 11/10) : jamais pire, texte intact, une bonne part réparée", () => {
    // Une ligne sans marque n'y est pas un événement et un geste ne vise qu'une ligne déjà écrite : quand aucune ligne
    // n'est dite au début d'une longue scène, rien de sûr ne comble le silence sans inventer de texte. Le motif le dit.
    let reparees = 0;
    let fautives = 0;
    for (const g of graines) {
      const f = ficheMalAncree(g, false);
      const avant = trousRythme(f);
      if (!avant.length) continue;
      fautives++;
      const r = reparerRythme(f);
      const apres = trousRythme(r);
      expect(apres.length, `graine ${g}`).toBeLessThanOrEqual(avant.length);
      expect(texteDe(r)).toBe(texteDe(f));
      if (!apres.length) reparees++;
    }
    // Mesuré le 12/10, à l'ancien débit (20,5 car/s) : 62 sur 120, soit 0,52 (le jeu d'essai n'y pose aucune marque :
    // aucune ligne n'y est un événement). Mesuré au lot B2b, au débit de la voix à 165 mots/min (16,9 car/s, scènes plus
    // longues en secondes donc plus de trous à combler) : 0,3167 (fiches réparées / fiches fautives). Seuil recalé à 0,25, sous la
    // mesure avec une marge ; il ne doit pas redescendre sans nouvelle mesure.
    expect(reparees / fautives).toBeGreaterThan(0.25);
    // 120 fiches réparées : environ 5 s, au bord du délai par défaut (échecs au hasard, déjà sur master le 14/10).
  }, 30_000);

  it("la règle et son seuil ne bougent pas", () => {
    expect(ECART_EVENEMENT_MAX_MS).toBe(4000);
  });
});

/* ------------------------------------------------------------------ */
/* Coupe d'une scène à une fin de phrase                                 */
/* ------------------------------------------------------------------ */

describe("couper une scène en deux à une fin de phrase", () => {
  const base = () => {
    const f = ficheHabitude();
    // 9 scènes : on retire l'avant-dernière pour faire de la place.
    return { ...f, scenes: f.scenes.filter((s) => s.id !== "s09").map((s, i) => ({ ...s, id: `s${String(i + 1).padStart(2, "0")}` })) };
  };

  it("les débuts de phrase de la scène s04 de l'essai", () => {
    const t = SCRIPT_HABITUDE[3];
    expect(debutsDePhrase(t).map((c) => mots(t)[c])).toEqual(["Accrochez-la", "Par", "Le", "Pas"]);
  });

  it("coupe à une phrase : texte partagé mot pour mot, éléments répartis, même page, scènes renumérotées", () => {
    const f = base();
    const i = 3;
    const s = f.scenes[i];
    const c = debutsDePhrase(s.texteDit).find((x) => mots(s.texteDit)[x] === "Le")!;
    const r = couperScene(f, i, c)!;
    expect(r).not.toBeNull();
    expect(r.scenes).toHaveLength(10);
    expect(r.scenes.map((x) => x.id)).toEqual(Array.from({ length: 10 }, (_, j) => `s${String(j + 1).padStart(2, "0")}`));
    expect(texteDe(r)).toBe(texteDe(f));
    expect(r.scenes[i].page).toBe(s.page);
    expect(r.scenes[i + 1].page).toBe(s.page);
    expect([...r.scenes[i].elements, ...r.scenes[i + 1].elements].map((e) => e.id).sort()).toEqual(s.elements.map((e) => e.id).sort());
    // Le geste reste avec sa cible.
    expect(r.scenes[i + 1].elements.map((e) => e.id)).toEqual(expect.arrayContaining(["e19", "e20"]));
    expect(regleReferencesInternes(r)).toEqual([]);
    expect(regleEcrans(r)).toEqual([]);
  });

  it("refusée hors d'un début de phrase, à 10 scènes, ou si une moitié resterait vide", () => {
    const f = base();
    expect(couperScene(f, 3, 2)).toBeNull();
    expect(couperScene(ficheHabitude(), 3, debutsDePhrase(SCRIPT_HABITUDE[3])[0])).toBeNull();
    // Un seul élément écrit : une des deux moitiés resterait vide.
    const pas = debutsDePhrase(f.scenes[3].texteDit).at(-1)!;
    const g = copie(f);
    g.scenes[3].elements = [g.scenes[3].elements[0]];
    expect(couperScene(g, 3, pas)).toBeNull();
  });

  it("une scène trop longue et pleine est coupée par la réparation quand il y a la place", () => {
    const f = base();
    // Scène s04 : un seul élément, une ligne ancrée au premier mot ; 6 éléments permis, mais le reste est muet.
    const s = f.scenes[3];
    const g: FicheTableau = { ...f, scenes: f.scenes.map((x, j) => (j === 3 ? { ...s, elements: [s.elements[0]] } : x)) };
    const r = reparerRythme(g);
    expect(trousRythme(r)).toEqual([]);
    expect(texteDe(r)).toBe(texteDe(g));
  });
});

describe("la consigne du découpage rappelle le rythme ; la version du rôle a monté", () => {
  it("scène de plus de 8 s : coupée, ou un événement toutes les 3 s", () => {
    expect(CONSIGNE_DECOUPAGE).toMatch(/plus de 8 secondes .* coupée en deux à une fin de phrase, ou porte un événement toutes les 3 secondes/);
    expect(CONSIGNE_DECOUPAGE).toContain(`${CARACTERES_DITS_MAX_TABLEAU} caractères dits`);
    expect(roleDecoupageTableau.version).toBeGreaterThanOrEqual(10);
  });
});
