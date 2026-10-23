/**
 * Brique commune `chaine-scenes` (tâche C5). Valeurs attendues produites au commit 2ed2d61 par la chaîne par scènes
 * existante (voir `attendus.ts`) ; ce test n'importe rien de `src/moteurs/`.
 */
import { describe, expect, it } from "vitest";
import { commandeMinimale, creerSuivi, empreinteStable, plansDesScenes, stable, type Journal } from "@/briques/chaine-scenes";
import type { StyleResolu, ValeurDecor, ValeurStyleSousTitres } from "@/domaine/types";
import { ATTENDUS, JEUX, VERSION_ATTENDUE } from "./attendus";

const STYLE: StyleResolu<ValeurStyleSousTitres> = {
  id: "sous-titres-encre",
  nom: "Encre",
  valeur: { type: "style-sous-titres", gabarit: "minimal", police: "Inter Bold", tailleRelative: 1, taillePx: 60, motsParLigne: 6, motsParLigneMin: 3, casse: "normale", animation: "aucune", couleurAccent: "creme", jetonEmphase: "orange-vif", modeEmphase: "mot", position: "centre", contourPx: 0, ombrePx: 0, dureeMinGroupeSec: 0.6, dureeMaxGroupeSec: 1.6, chiffresAlignes: true, encre: { texte: "#110A05", page: "#E9DCC8" } },
};
const DECOR: StyleResolu<ValeurDecor> = { id: "page-charte", nom: "Page de la charte", valeur: { type: "decor", mode: "teinte", teinte: "#E9DCC8", profondeurFlou: 0, directionLumiere: "face", positionSujet: 0.5, clair: true } };

describe("plans, commande et empreinte : mêmes valeurs que la chaîne existante (3 jeux de scènes)", () => {
  JEUX.forEach((j, i) => {
    it(j.nom, () => {
      expect(plansDesScenes(j.scenes)).toEqual(ATTENDUS[i].plans);
      const c = commandeMinimale({
        moteurId: "montage-tableau",
        formatId: "tableau-anime",
        versionFormat: 1,
        videoId: j.videoId,
        texteScript: j.texteScript,
        dureeSec: j.dureeSec,
        scenes: j.scenes,
        styleSousTitres: { ...STYLE, valeur: { ...STYLE.valeur!, positionPct: j.centre } },
        decor: DECOR,
        personnageId: "personnageId" in j ? j.personnageId : undefined,
        prononciations: "prononciations" in j ? j.prononciations : undefined,
      });
      expect(JSON.parse(JSON.stringify(c))).toEqual(ATTENDUS[i].commande);
      expect(empreinteStable(VERSION_ATTENDUE, "scenes", "dev", j.videoId, { scenes: j.scenes, f: () => 1, absent: undefined, z: 1, a: [null, undefined] })).toBe(ATTENDUS[i].empreinte);
    });
  });

  it("stable : clés triées, fonctions et absents ignorés", () => {
    expect(stable({ b: 1, a: [undefined, () => 2, "x"], c: undefined })).toBe('{"a":[null,null,"x"],"b":1}');
    expect(empreinteStable("v/1", { a: 1, b: 2 })).toBe(empreinteStable("v/1", { b: 2, a: 1 }));
    expect(empreinteStable("v/1", 1)).not.toBe(empreinteStable("v/2", 1));
    expect(empreinteStable("v/1", 1)).toMatch(/^[0-9a-f]{32}$/);
  });
});

class ErreurEssai extends Error {
  constructor(
    readonly etape: string,
    readonly raisons: readonly string[],
  ) {
    super(`${etape} : ${raisons.join(" ")}`);
  }
}

type Etape = "a" | "b";

function magasin(lu: Journal<Etape> | null = null) {
  const ecrits: Journal<Etape>[] = [];
  return { lu, ecrits, ecrire: async (j: Journal<Etape>) => void ecrits.push(structuredClone(j)) };
}

describe("creerSuivi · etape", () => {
  it("fait l'étape, l'écrit au journal, puis la reprend quand l'empreinte est égale", async () => {
    const m1 = magasin();
    let t = 0;
    const s1 = creerSuivi<Etape>({ version: "v/1", journal: m1, horloge: () => (t += 5), erreur: ErreurEssai });
    let appels = 0;
    expect(await s1.etape("a", "k1", async () => ++appels)).toBe(1);
    expect(s1.etapes).toEqual([{ etape: "a", statut: "faite", dureeMs: 5 }]);
    expect(m1.ecrits.at(-1)).toEqual({ version: "v/1", etapes: { a: { empreinte: "k1", dureeMs: 5, sortie: 1 } } });

    const s2 = creerSuivi<Etape>({ version: "v/1", journal: magasin(m1.ecrits.at(-1)), erreur: ErreurEssai });
    expect(await s2.etape("a", "k1", async () => ++appels)).toBe(1);
    expect(appels).toBe(1);
    expect(s2.etapes).toEqual([{ etape: "a", statut: "reprise", dureeMs: 0 }]);
  });

  it("refait l'étape quand l'empreinte diffère, et tout quand la version diffère", async () => {
    const lu: Journal<Etape> = { version: "v/1", etapes: { a: { empreinte: "k1", dureeMs: 1, sortie: "ancien" } } };
    const s = creerSuivi<Etape>({ version: "v/1", journal: magasin(structuredClone(lu)), erreur: ErreurEssai });
    expect(await s.etape("a", "k2", async () => "neuf")).toBe("neuf");
    expect(s.journal.etapes.a?.empreinte).toBe("k2");

    const autre = creerSuivi<Etape>({ version: "v/2", journal: magasin(structuredClone(lu)), erreur: ErreurEssai });
    expect(autre.journal).toEqual({ version: "v/2", etapes: {} });
    expect(await autre.etape("a", "k1", async () => "refait")).toBe("refait");
  });

  it("enveloppe une erreur quelconque dans l'erreur de la chaîne, laisse passer la sienne", async () => {
    const m = magasin();
    const s = creerSuivi<Etape>({ version: "v/1", journal: m, erreur: ErreurEssai });
    const e = await s.etape("a", "k", async () => Promise.reject(new Error("panne"))).catch((x) => x);
    expect(e).toBeInstanceOf(ErreurEssai);
    expect(e).toMatchObject({ etape: "a", raisons: ["panne"] });
    const propre = new ErreurEssai("b", ["déjà dite"]);
    await expect(s.etape("a", "k", async () => Promise.reject(propre))).rejects.toBe(propre);
    expect(m.ecrits).toEqual([]);
  });
});

describe("creerSuivi · suivre", () => {
  it("tourne jusqu'à la fin en gardant l'état, attend quand rien ne change", async () => {
    let attentes = 0;
    const gardes: number[] = [];
    const s = creerSuivi<Etape>({ version: "v/1", journal: magasin(), attendre: async () => void attentes++, erreur: ErreurEssai });
    const etats = [1, 1, 2, 3];
    const fin = await s.suivre("b", 0, async () => etats.shift()!, (e) => e >= 3, async (e) => void gardes.push(e));
    expect(fin).toBe(3);
    expect(gardes).toEqual([1, 1, 2, 3]);
    expect(attentes).toBe(1);
  });

  it("abandonne après toursMax tours", async () => {
    let tours = 0;
    const s = creerSuivi<Etape>({ version: "v/1", journal: magasin(), toursMax: 3, erreur: ErreurEssai });
    const e = await s.suivre("b", 0, async (n) => (tours++, n + 1), () => false, async () => undefined).catch((x) => x);
    expect(tours).toBe(3);
    expect(e).toBeInstanceOf(ErreurEssai);
    expect(e).toMatchObject({ etape: "b", raisons: ["L'étape ne s'est pas terminée après 3 tours."] });
  });
});
