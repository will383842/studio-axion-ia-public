/**
 * ORG-09 — rendu scène par scène : options `bloquant` et clé par empreinte de `rendu-cartes.ts`. Doubles seulement
 * (service de rendu, dépôt, existence) : aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { cartesPourFormat, type CarteFormat } from "@/briques/motion";
import {
  avancerCartesMotion,
  cartesMotionEcartees,
  cartesMotionFinies,
  cartesPleinEcranDuRatio,
  cleSceneParEmpreinte,
  ErreurSceneRatee,
  etatInitialCartesMotion,
  type EtatCartesMotion,
  type OptionsRenduCartes,
  type OutilsRenduCartes,
} from "@/briques/motion/rendu-cartes";
import type { DemandeRendu, EtatRendu, ServiceRendu } from "@/fournisseurs/types";

const [modele] = cartesPourFormat({ format: "avocat", ratio: "9:16", phrases: [{ id: "p", texte: "On passe de 12 heures à 3 heures.", debutSec: 2, finSec: 6, place: "illustration" }] });
/** Cinq scènes : même modèle, identifiants et instants distincts. */
const scenes: CarteFormat[] = Array.from({ length: 5 }, (_, i) => ({ ...modele, id: `scene-${i + 1}`, debutSec: i * 10, finSec: i * 10 + 8 }));
const cleClassique = (c: CarteFormat) => `motion/${c.id}.mp4`;

/** Double du service : statuts joués par carte (clé de sortie, nouvel essai compris), dernier répété ; journal des appels. */
function doubles(statutsParCle: (cle: string) => EtatRendu["statut"][] = () => ["termine"], deja: Set<string> = new Set()) {
  const journal: string[] = [];
  const recues: DemandeRendu[] = [];
  const tours = new Map<string, number>();
  const cleDe = new Map<string, string>();
  const s: ServiceRendu = {
    async soumettre(d) {
      journal.push(`soumettre ${d.idRendu}`);
      recues.push(d);
      cleDe.set(d.idRendu, d.sortie.cle);
      return { idRendu: d.idRendu };
    },
    async etat(id) {
      journal.push(`etat ${id}`);
      const cle = cleDe.get(id) ?? "";
      const n = tours.get(cle) ?? 0;
      tours.set(cle, n + 1);
      const liste = statutsParCle(cle);
      const st = liste[Math.min(n, liste.length - 1)];
      if (st === "echec") return { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: "le serveur de rendu ne répond pas" } };
      if (st === "termine") {
        deja.add(cle);
        return { statut: "termine", sortieCle: cle };
      }
      return { statut: "en_cours", progression: 50 };
    },
  };
  const outils: OutilsRenduCartes = {
    rendu: () => s,
    depot: async (cle) => {
      journal.push(`depot ${cle}`);
      return `https://r2/${cle}?depot`;
    },
    existe: async (cle) => {
      journal.push(`existe ${cle}`);
      return deja.has(cle);
    },
  };
  return { journal, recues, outils, deja };
}

async function jusquauBout(e: EtatCartesMotion, outils: OutilsRenduCartes, max = 10): Promise<EtatCartesMotion> {
  for (let k = 0; k < max && !cartesMotionFinies(e); k++) e = await avancerCartesMotion(e, outils);
  return e;
}

const parEmpreinte = (empreintes: Record<string, string>): OptionsRenduCartes["parEmpreinte"] => ({ env: "dev", videoId: "v1", empreinte: (c) => empreintes[c.id] });
const empreintesDeBase = Object.fromEntries(scenes.map((c, i) => [c.id, `emp${i + 1}aaaa`]));

describe("ORG-09 — sans option : comportement des cartes d'aujourd'hui (non-régression)", () => {
  it("état initial identique, au caractère près, avec options absentes, vides ou à faux", () => {
    const reference = etatInitialCartesMotion(scenes, cleClassique);
    expect(Object.keys(reference)).toEqual(["version", "cartes"]);
    for (const c of reference.cartes) expect(Object.keys(c)).toEqual(["id", "ratio", "debutSec", "finSec", "modele", "cle", "statut", "essais", "demande"]);
    for (const options of [undefined, {}, { bloquant: false }, { bloquant: undefined, parEmpreinte: undefined }]) {
      expect(JSON.stringify(etatInitialCartesMotion(scenes, cleClassique, options))).toBe(JSON.stringify(reference));
    }
    expect(reference.cartes.map((c) => c.cle)).toEqual(scenes.map(cleClassique));
  });

  it("mêmes appels, même ordre, mêmes clés, mêmes résultats ; une carte ratée est écartée, sans lever ; `existe` jamais lu", async () => {
    // scène 2 : échec, nouvel essai, échec → écartée ; les autres : en cours puis terminées.
    const statuts = (cle: string) => (cle.includes("scene-2") ? (["echec"] as const) : (["en_cours", "termine"] as const)).slice();
    const a = doubles(statuts);
    const b = doubles(statuts);
    const ea = await jusquauBout(etatInitialCartesMotion(scenes, cleClassique), a.outils);
    const eb = await jusquauBout(etatInitialCartesMotion(scenes, cleClassique, {}), b.outils);
    expect(b.journal).toEqual(a.journal);
    expect(JSON.stringify(eb)).toBe(JSON.stringify(ea));
    expect(a.journal.some((l) => l.startsWith("existe"))).toBe(false);
    expect(a.journal.slice(0, 3)).toEqual(["depot motion/scene-1.mp4", "soumettre motion-scene-1-mp4", "depot motion/scene-2.mp4"]);
    expect(a.recues.map((d) => d.sortie.cle)).toEqual([...scenes.map(cleClassique), "motion/scene-2.mp4"]);
    expect(a.recues.every((d) => d.operation === "composition" && d.file === "longue")).toBe(true);
    expect(cartesMotionEcartees(ea)).toBe(1);
    expect(cartesPleinEcranDuRatio(ea, "9:16").map((c) => c.carteCle)).toEqual(scenes.filter((c) => c.id !== "scene-2").map(cleClassique));
  });

  it("une panne répétée du service écarte la carte, sans lever", async () => {
    const { outils } = doubles();
    const enPanne: OutilsRenduCartes = { ...outils, depot: async () => Promise.reject(new Error("stockage absent")) };
    const e = await jusquauBout(etatInitialCartesMotion([scenes[0]], cleClassique), enPanne);
    expect(e.cartes[0].statut).toBe("echec");
  });
});

describe("ORG-09 — option `bloquant`", () => {
  it("une scène ratée fait échouer l'ensemble avec une erreur qui la nomme", async () => {
    const { outils } = doubles((cle) => (cle.includes("scene-3") ? ["echec"] : ["termine"]));
    const e0 = etatInitialCartesMotion(scenes, cleClassique, { bloquant: true });
    expect(e0.bloquant).toBe(true);
    expect(e0.cartes.map((c) => c.cle)).toEqual(scenes.map(cleClassique));
    const essai = jusquauBout(e0, outils);
    await expect(essai).rejects.toBeInstanceOf(ErreurSceneRatee);
    await expect(jusquauBout(e0, doubles((cle) => (cle.includes("scene-3") ? ["echec"] : ["termine"])).outils)).rejects.toThrow(/« scene-3 ».*le serveur de rendu ne répond pas/);
  });

  it("la scène est retentée une fois avant de bloquer (même règle que les cartes)", async () => {
    const { recues, outils } = doubles((cle) => (cle.includes("scene-1") ? ["echec", "termine"] : ["termine"]));
    const e = await jusquauBout(etatInitialCartesMotion(scenes, cleClassique, { bloquant: true }), outils);
    expect(e.cartes.every((c) => c.statut === "faite")).toBe(true);
    expect(recues.filter((d) => d.sortie.cle.includes("scene-1"))).toHaveLength(2);
  });

  it("une panne répétée du stockage bloque aussi, en nommant la scène", async () => {
    const { outils } = doubles();
    const enPanne: OutilsRenduCartes = { ...outils, depot: async () => Promise.reject(new Error("stockage absent")) };
    await expect(jusquauBout(etatInitialCartesMotion([scenes[0]], cleClassique, { bloquant: true }), enPanne)).rejects.toMatchObject({ name: "ErreurSceneRatee", scene: "scene-1" });
  });
});

describe("ORG-09 — clé par empreinte : ne rend que les scènes changées", () => {
  it("clé `studio/<env>/scenes/<videoId>/<empreinte>.mp4` (convention `cleDeDepot`)", () => {
    expect(cleSceneParEmpreinte("dev", "v1", "abc123")).toBe("studio/dev/scenes/v1/abc123.mp4");
    const e = etatInitialCartesMotion(scenes, cleClassique, { parEmpreinte: parEmpreinte(empreintesDeBase) });
    expect(e.cartes.map((c) => c.cle)).toEqual(scenes.map((_, i) => `studio/dev/scenes/v1/emp${i + 1}aaaa.mp4`));
    expect(e.cartes.map((c) => c.demande.sortie.cle)).toEqual(e.cartes.map((c) => c.cle));
    expect(e.bloquant).toBeUndefined();
  });

  it("sans empreinte pour une carte : clé classique, carte rendue", async () => {
    const { recues, outils } = doubles();
    const e = await jusquauBout(etatInitialCartesMotion(scenes.slice(0, 2), cleClassique, { parEmpreinte: parEmpreinte({ "scene-1": "e1" }) }), outils);
    expect(e.cartes.map((c) => c.cle)).toEqual(["studio/dev/scenes/v1/e1.mp4", "motion/scene-2.mp4"]);
    expect(recues).toHaveLength(2);
  });

  it("même empreinte : aucun second rendu", async () => {
    const d = doubles();
    const options = { bloquant: true, parEmpreinte: parEmpreinte(empreintesDeBase) };
    await jusquauBout(etatInitialCartesMotion(scenes, cleClassique, options), d.outils);
    expect(d.recues).toHaveLength(5);
    const e2 = await jusquauBout(etatInitialCartesMotion(scenes, cleClassique, options), d.outils);
    expect(d.recues).toHaveLength(5);
    expect(e2.cartes.every((c) => c.statut === "faite")).toBe(true);
    expect(cartesPleinEcranDuRatio(e2, "9:16")).toHaveLength(5);
  });

  it("une scène changée sur cinq : un seul rendu", async () => {
    const d = doubles();
    await jusquauBout(etatInitialCartesMotion(scenes, cleClassique, { parEmpreinte: parEmpreinte(empreintesDeBase) }), d.outils);
    d.recues.length = 0;
    const changees = { ...empreintesDeBase, "scene-3": "emp3bbbb" };
    const e = await jusquauBout(etatInitialCartesMotion(scenes, cleClassique, { bloquant: true, parEmpreinte: parEmpreinte(changees) }), d.outils);
    expect(d.recues.map((r) => r.sortie.cle)).toEqual(["studio/dev/scenes/v1/emp3bbbb.mp4"]);
    expect(d.recues[0]).toMatchObject({ operation: "composition", file: "longue" });
    expect(e.cartes.every((c) => c.statut === "faite")).toBe(true);
  });

  it("deux lancements de la même liste : mêmes clés, mêmes demandes", () => {
    const options = { parEmpreinte: parEmpreinte(empreintesDeBase) };
    const a = etatInitialCartesMotion(scenes, cleClassique, options);
    const b = etatInitialCartesMotion(scenes, cleClassique, options);
    expect(b.cartes.map((c) => c.cle)).toEqual(a.cartes.map((c) => c.cle));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("sans `existe` injecté : la carte à empreinte est rendue (jamais supposée présente)", async () => {
    const { recues, outils } = doubles(undefined, new Set(["studio/dev/scenes/v1/emp1aaaa.mp4"]));
    const { existe: _ignore, ...sansExiste } = outils;
    void _ignore;
    await jusquauBout(etatInitialCartesMotion([scenes[0]], cleClassique, { parEmpreinte: parEmpreinte(empreintesDeBase) }), sansExiste);
    expect(recues).toHaveLength(1);
  });
});
