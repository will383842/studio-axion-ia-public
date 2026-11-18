import { describe, expect, it, vi } from "vitest";
import { MAX_JETONS_PLAN_SCENES } from "@/briques/plan-scenes/generateur";
import { controlerChapitres, estimerJetons, FORMAT_PLAN_VIDEO_LONGUE, planVideoLongue, type ChapitrePourPlan } from "@/moteurs/montage-video-longue/plan";
import {
  dureeMaxPlageSec,
  ErreurRenduChapitres,
  imageDe,
  parametresPlage,
  plagesDesChapitres,
  rendreChapitres,
  DELAI_MAX_PLAGE_MS,
  type DemandePlage,
  type PortRenduPlage,
} from "@/moteurs/montage-video-longue/rendu-chapitres";

const TEXTE_1 = "Cette année, 42 % des entreprises ont gagné 1 500 euros de plus grâce à l'outil.";
const TEXTE_2 = "Ensuite, ouvrez les réglages, puis cliquez sur le bouton Enregistrer.";
const chapitres: ChapitrePourPlan[] = [
  { id: "c1", segments: [{ texte: TEXTE_1, debutMs: 0, finMs: 10_000 }] },
  { id: "c2", segments: [{ texte: TEXTE_2, debutMs: 10_000, finMs: 25_000 }] },
];

describe("plan par chapitre, niveau 1, 1920×1080", () => {
  it("un plan par chapitre, en 1920×1080 à 25 i/s, sous 16 000 jetons, sans aucun fournisseur", async () => {
    const r = await planVideoLongue(chapitres);
    expect(r.valide).toBe(true);
    expect(r.format).toEqual({ largeur: 1920, hauteur: 1080, fps: 25 });
    expect(r.chapitres.map((c) => c.id)).toEqual(["c1", "c2"]);
    for (const c of r.chapitres) {
      expect(c.jetonsEstimes).toBeLessThan(MAX_JETONS_PLAN_SCENES);
      if (c.plan) {
        expect(c.plan.format).toMatchObject({ largeur: 1920, hauteur: 1080 });
        // temps de la vidéo entière : les scènes restent dans le chapitre
        for (const s of c.plan.scenes) {
          expect(s.debutMs).toBeGreaterThanOrEqual(c.debutMs);
          expect(s.finMs).toBeLessThanOrEqual(c.finMs);
        }
      }
    }
    expect(r.chapitres.some((c) => c.plan !== null)).toBe(true);
  });

  it("est déterministe (mêmes entrées, mêmes plans)", async () => {
    expect(await planVideoLongue(chapitres)).toEqual(await planVideoLongue(chapitres));
  });

  it("ne fait aucun appel réseau", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    await planVideoLongue(chapitres);
    vi.unstubAllGlobals();
    expect(f).not.toHaveBeenCalled();
  });

  it("refuse un autre format que 1920×1080", async () => {
    const r = await planVideoLongue(chapitres, { largeur: 1080, hauteur: 1920, fps: 25 });
    expect(r.valide).toBe(false);
    expect(r.problemes.join(" ")).toMatch(/1920×1080/);
  });

  it("signale les chapitres incohérents sans rien planifier", async () => {
    const mauvais: ChapitrePourPlan[] = [
      { id: "a", segments: [{ texte: "Un.", debutMs: 0, finMs: 5000 }] },
      { id: "a", segments: [{ texte: "Deux.", debutMs: 4000, finMs: 6000 }] },
    ];
    const r = await planVideoLongue(mauvais);
    expect(r.valide).toBe(false);
    expect(r.chapitres).toEqual([]);
    expect(controlerChapitres(mauvais).join(" ")).toMatch(/double/);
    expect(controlerChapitres(mauvais).join(" ")).toMatch(/chevauche/);
    expect(controlerChapitres([])).toEqual(["Aucun chapitre."]);
  });

  it("estimerJetons : 0 sans plan, croissant avec le plan", async () => {
    expect(estimerJetons(null)).toBe(0);
    const r = await planVideoLongue(chapitres);
    const p = r.chapitres.find((c) => c.plan)!;
    expect(estimerJetons(p.plan)).toBe(p.jetonsEstimes);
    expect(p.jetonsEstimes).toBeGreaterThan(0);
  });

  it("un format exporté constant", () => {
    expect(FORMAT_PLAN_VIDEO_LONGUE).toEqual({ largeur: 1920, hauteur: 1080, fps: 25 });
  });
});

describe("plages d'images par chapitre", () => {
  it("sans trou ni chevauchement, bornes comprises, chaque plage sous le délai de 20 min", () => {
    const chap = [
      { id: "c1", debutMs: 0, finMs: 10_000 },
      { id: "c2", debutMs: 10_000, finMs: 200_333 },
      { id: "c3", debutMs: 200_333, finMs: 301_000 },
    ];
    const plages = plagesDesChapitres(chap);
    expect(plages[0].debut).toBe(0);
    for (let i = 1; i < plages.length; i++) expect(plages[i].debut).toBe(plages[i - 1].fin + 1);
    expect(plages.at(-1)!.fin).toBe(imageDe(301_000, 25) - 1);
    for (const p of plages) {
      expect(p.fin).toBeGreaterThanOrEqual(p.debut);
      expect(p.dureeSec).toBeLessThanOrEqual(dureeMaxPlageSec());
    }
    expect(dureeMaxPlageSec() * 16_000).toBeLessThanOrEqual(DELAI_MAX_PLAGE_MS);
    // le chapitre de 190 s est coupé en plusieurs plages, les autres restent entiers
    expect(plages.filter((p) => p.chapitreId === "c2").length).toBeGreaterThan(1);
    expect(plages.filter((p) => p.chapitreId === "c1")).toHaveLength(1);
  });

  it("refuse un chapitre vide ou qui chevauche", () => {
    expect(() => plagesDesChapitres([{ id: "x", debutMs: 5, finMs: 5 }])).toThrow(/aucune image/);
    expect(() =>
      plagesDesChapitres([
        { id: "x", debutMs: 0, finMs: 5000 },
        { id: "y", debutMs: 4000, finMs: 8000 },
      ]),
    ).toThrow(/chevauche/);
  });

  it("paramètres du mode « plage » existant", () => {
    const [p] = plagesDesChapitres([{ id: "c1", debutMs: 0, finMs: 4000 }]);
    expect(parametresPlage(p, { composition: "VideoLongue", proprietes: { a: 1 }, crf: 20 })).toEqual({ mode: "plage", composition: "VideoLongue", proprietes: { a: 1 }, debut: 0, fin: 99, dureeSec: 4, crf: 20 });
  });
});

describe("rendu : jamais plus d'une plage en file", () => {
  const options = { idVideo: "v1", composition: "VideoLongue", proprietes: {}, chapitres: [
    { id: "c1", debutMs: 0, finMs: 10_000 },
    { id: "c2", debutMs: 10_000, finMs: 200_000 },
  ] };

  it("envoie les plages une par une, dans l'ordre, la suivante seulement après la fin de la précédente", async () => {
    let enCours = 0;
    let max = 0;
    const ordre: string[] = [];
    const port: PortRenduPlage = {
      async rendre(d: DemandePlage) {
        enCours++;
        max = Math.max(max, enCours);
        expect(d.file).toBe("longue");
        expect(d.parametres.mode).toBe("plage");
        ordre.push(d.idRendu);
        await new Promise((r) => setTimeout(r, 1));
        enCours--;
        return { sortieCle: `cle/${d.idRendu}` };
      },
    };
    const r = await rendreChapitres(options, port);
    expect(max).toBe(1);
    expect(ordre).toEqual(r.map((m) => m.idRendu));
    expect(ordre[0]).toBe("v1-c1-p0");
    expect(r.every((m) => m.sortieCle === `cle/${m.idRendu}`)).toBe(true);
  });

  it("un échec arrête tout : rien d'autre n'est envoyé, ce qui est fait est rapporté", async () => {
    const envoyes: string[] = [];
    const port: PortRenduPlage = {
      async rendre(d) {
        envoyes.push(d.idRendu);
        if (envoyes.length === 2) throw new Error("navigateur fermé");
        return { sortieCle: "k" };
      },
    };
    const e = await rendreChapitres(options, port).catch((x) => x);
    expect(e).toBeInstanceOf(ErreurRenduChapitres);
    expect(e.rendus).toHaveLength(1);
    expect(envoyes).toHaveLength(2);
    expect(e.message).toMatch(/navigateur fermé/);
  });

  it("une plage qui dépasse le délai est arrêtée (signal) et arrête tout", async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const port: PortRenduPlage = { rendre: (d) => ((signal = d.signal), new Promise(() => {})) };
    const p = rendreChapitres({ ...options, delaiMs: 60_000 }, port).catch((x) => x);
    await vi.advanceTimersByTimeAsync(61_000);
    const e = await p;
    vi.useRealTimers();
    expect(e).toBeInstanceOf(ErreurRenduChapitres);
    expect(e.message).toMatch(/délai/);
    expect(signal?.aborted).toBe(true);
  });

  it("une reprise ne refait pas les plages déjà rendues", async () => {
    const vus: string[] = [];
    const port: PortRenduPlage = { rendre: async (d) => (vus.push(d.idRendu), { sortieCle: "neuf" }) };
    const r = await rendreChapitres({ ...options, dejaRendus: { "v1-c1-p0": "ancien" } }, port);
    expect(vus).not.toContain("v1-c1-p0");
    expect(r[0].sortieCle).toBe("ancien");
  });
});
