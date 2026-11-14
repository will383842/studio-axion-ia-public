/**
 * RC-14 : registre d'alertes unique, sans IA. UNE seule fonction de seuil pour tout le registre ; une alerte qui ne
 * peut pas être évaluée s'affiche « non évalué » (jamais un faux vert). Jamais de push. Horloge injectée.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { evaluerSeuil } from "@/domaine/alertes/seuil";
import { LIBELLE_NIVEAU, REGISTRE, evaluerRegistre, type Sources } from "@/domaine/alertes/registre";
import { alertesAnotifier, evaluerAlertes, signalerParCloche } from "@/services/alertes";

// Mercredi 11 novembre 2026, 10 h à Paris.
const MAINTENANT = new Date("2026-11-11T09:00:00Z");
const horloge = () => MAINTENANT;
const jourPlus = (n: number) => new Date(Date.UTC(2026, 10, 11 + n)).toISOString().slice(0, 10);

/** Sources saines : un post chaque jour de J à J+8, visuel présent, quota bas, santé ok, sauvegarde récente. */
function saines(): Sources {
  return {
    calendrier: Array.from({ length: 9 }, (_, i) => ({ jour: jourPlus(i), aVisuel: true })),
    quotaPourcent: () => 10,
    jetons: () => "ok",
    echeances: [{ libelle: "Accès fictif", jour: jourPlus(200) }],
    santeOk: true,
    ageSauvegardeHeures: 2,
  };
}
const niveau = (s: Sources, id: string) => evaluerRegistre(s, horloge).find((r) => r.id === id)?.niveau;

describe("RC-14 : une seule fonction de seuil", () => {
  it("au-moins : alerte dès le seuil atteint (79 / 80 / 81)", () => {
    const regle = { seuil: 80, sens: "au-moins" } as const;
    expect(evaluerSeuil(79, regle)).toBe("ok");
    expect(evaluerSeuil(80, regle)).toBe("alerte");
    expect(evaluerSeuil(81, regle)).toBe("alerte");
  });
  it("au-plus : alerte tant que la valeur est sous le seuil ou égale", () => {
    const regle = { seuil: 7, sens: "au-plus" } as const;
    expect(evaluerSeuil(8, regle)).toBe("ok");
    expect(evaluerSeuil(7, regle)).toBe("alerte");
    expect(evaluerSeuil(2, regle)).toBe("alerte");
  });
  it("valeur absente ou non finie : « non évalué », jamais ok", () => {
    for (const v of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(evaluerSeuil(v, { seuil: 80, sens: "au-moins" })).toBe("non-evalue");
    }
  });
  it("le registre ne compare aucun seuil lui-même : tout passe par evaluerSeuil", () => {
    const src = readFileSync(join(process.cwd(), "src/domaine/alertes/registre.ts"), "utf8");
    expect(src).not.toMatch(/[<>]=?\s*\d/);
    expect(src).toMatch(/evaluerSeuil/);
  });
});

describe("RC-14 : quota à 80 %", () => {
  it.each([[79, "ok"], [80, "alerte"], [81, "alerte"]] as const)("quota %i %% : %s", (p, attendu) => {
    expect(niveau({ ...saines(), quotaPourcent: () => p }, "quota")).toBe(attendu);
  });
  it("lecture absente ou fonction qui échoue : non évalué", () => {
    expect(niveau({ ...saines(), quotaPourcent: () => null }, "quota")).toBe("non-evalue");
    expect(niveau({ ...saines(), quotaPourcent: undefined }, "quota")).toBe("non-evalue");
    expect(niveau({ ...saines(), quotaPourcent: () => { throw new Error("hors service"); } }, "quota")).toBe("non-evalue");
  });
  it("jetons : on ne lit que le résultat injecté", () => {
    expect(niveau({ ...saines(), jetons: () => "alerte" }, "jetons")).toBe("alerte");
    expect(niveau({ ...saines(), jetons: () => "ok" }, "jetons")).toBe("ok");
    expect(niveau({ ...saines(), jetons: undefined }, "jetons")).toBe("non-evalue");
    expect(niveau({ ...saines(), jetons: () => "n'importe quoi" as never }, "jetons")).toBe("non-evalue");
  });
});

describe("RC-14 : trous du calendrier J+7 et J+2", () => {
  it("calendrier plein : aucun trou", () => {
    expect(niveau(saines(), "trou-j7")).toBe("ok");
    expect(niveau(saines(), "trou-j2")).toBe("ok");
  });
  it("jour J+7 vide : trou à J+7 seulement ; une publication à J+8 ne le comble pas", () => {
    const s = saines();
    s.calendrier = s.calendrier!.filter((e) => e.jour !== jourPlus(7));
    expect(niveau(s, "trou-j7")).toBe("alerte");
    expect(niveau(s, "trou-j2")).toBe("ok");
  });
  it("jour J+2 vide : trou à J+2 ; une publication à J+1 ou J+3 ne le comble pas", () => {
    const s = saines();
    s.calendrier = s.calendrier!.filter((e) => e.jour !== jourPlus(2));
    expect(niveau(s, "trou-j2")).toBe("alerte");
    expect(niveau(s, "trou-j7")).toBe("ok");
  });
  it("calendrier non fourni : non évalué (pas de faux vert)", () => {
    expect(niveau({ ...saines(), calendrier: null }, "trou-j7")).toBe("non-evalue");
    expect(niveau({ ...saines(), calendrier: null }, "trou-j2")).toBe("non-evalue");
  });
  it("le jour se lit à Paris : 23 h 30 UTC le 11 est déjà le 12 à Paris", () => {
    const tard = () => new Date("2026-11-11T23:30:00Z");
    const s = saines();
    s.calendrier = [{ jour: jourPlus(2), aVisuel: true }]; // 13 novembre : J+1 à Paris, pas J+2
    // à Paris on est le 12 : J+2 = 14 novembre, vide ; J+7 = 19 novembre, vide
    const r = evaluerRegistre(s, tard);
    expect(r.find((x) => x.id === "trou-j2")?.niveau).toBe("alerte");
  });
});

describe("RC-14 : date illisible dans le calendrier", () => {
  const illisible = { jour: "13/11/2026", aVisuel: false as boolean | null };
  it("visuel manquant : date illisible + entrées valides avec visuel : non évalué (jamais ok)", () => {
    const s = saines();
    s.calendrier = [illisible, ...s.calendrier!];
    expect(niveau(s, "visuel-manquant")).toBe("non-evalue");
  });
  it("visuel manquant : date illisible + une entrée certaine sans visuel : alerte", () => {
    const s = saines();
    s.calendrier = [illisible, { jour: jourPlus(3), aVisuel: false }, ...s.calendrier!];
    expect(niveau(s, "visuel-manquant")).toBe("alerte");
  });
  it("visuel manquant : toutes les dates valides avec visuel : ok", () => {
    expect(niveau(saines(), "visuel-manquant")).toBe("ok");
  });
  it("trous J+7 / J+2 : date illisible : non évalué (jamais ok)", () => {
    const s = saines();
    s.calendrier = [illisible, ...s.calendrier!];
    expect(niveau(s, "trou-j7")).toBe("non-evalue");
    expect(niveau(s, "trou-j2")).toBe("non-evalue");
  });
  it("trous : un jour vide certain sans date illisible reste une alerte ; tout rempli reste ok", () => {
    const s = saines();
    s.calendrier = s.calendrier!.filter((e) => e.jour !== jourPlus(7));
    expect(niveau(s, "trou-j7")).toBe("alerte");
    expect(niveau(saines(), "trou-j7")).toBe("ok");
  });
});

describe("RC-14 : visuel manquant", () => {
  it("visuel présent partout : ok", () => expect(niveau(saines(), "visuel-manquant")).toBe("ok"));
  it("une publication des 7 prochains jours sans visuel : alerte", () => {
    const s = saines();
    s.calendrier![3] = { jour: jourPlus(3), aVisuel: false };
    expect(niveau(s, "visuel-manquant")).toBe("alerte");
  });
  it("sans visuel à J+8 (hors fenêtre) : ok", () => {
    const s = saines();
    s.calendrier![8] = { jour: jourPlus(8), aVisuel: false };
    expect(niveau(s, "visuel-manquant")).toBe("ok");
  });
  it("information de visuel inconnue : non évalué ; un manque certain reste une alerte", () => {
    const s = saines();
    s.calendrier![3] = { jour: jourPlus(3), aVisuel: null };
    expect(niveau(s, "visuel-manquant")).toBe("non-evalue");
    s.calendrier![4] = { jour: jourPlus(4), aVisuel: false };
    expect(niveau(s, "visuel-manquant")).toBe("alerte");
  });
});

describe("RC-14 : échéances d'accès", () => {
  it("lointaine : ok ; à 14 jours : alerte ; passée : alerte", () => {
    const e = (jour: string | null) => ({ ...saines(), echeances: [{ libelle: "Accès fictif", jour }] });
    expect(niveau(e(jourPlus(15)), "echeances")).toBe("ok");
    expect(niveau(e(jourPlus(14)), "echeances")).toBe("alerte");
    expect(niveau(e(jourPlus(-1)), "echeances")).toBe("alerte");
  });
  it("date inconnue ou liste non fournie : non évalué ; liste vide : ok", () => {
    expect(niveau({ ...saines(), echeances: [{ libelle: "Accès fictif", jour: null }] }, "echeances")).toBe("non-evalue");
    expect(niveau({ ...saines(), echeances: null }, "echeances")).toBe("non-evalue");
    expect(niveau({ ...saines(), echeances: [] }, "echeances")).toBe("ok");
  });
});

describe("RC-14 : santé et sauvegarde (alerte externe L5-08)", () => {
  it("santé", () => {
    expect(niveau({ ...saines(), santeOk: true }, "sante")).toBe("ok");
    expect(niveau({ ...saines(), santeOk: false }, "sante")).toBe("alerte");
    expect(niveau({ ...saines(), santeOk: null }, "sante")).toBe("non-evalue");
  });
  it("âge de la sauvegarde : seuil 36 h comme surveiller.sh (35 / 36 / 37)", () => {
    expect(niveau({ ...saines(), ageSauvegardeHeures: 35 }, "sauvegarde")).toBe("ok");
    expect(niveau({ ...saines(), ageSauvegardeHeures: 36 }, "sauvegarde")).toBe("alerte");
    expect(niveau({ ...saines(), ageSauvegardeHeures: 37 }, "sauvegarde")).toBe("alerte");
    expect(niveau({ ...saines(), ageSauvegardeHeures: null }, "sauvegarde")).toBe("non-evalue");
  });
});

describe("RC-14 : « non évalué » n'est jamais vert", () => {
  it("aucune source : tout le registre est non évalué, rien n'est ok", () => {
    const r = evaluerRegistre({}, horloge);
    expect(r).toHaveLength(REGISTRE.length);
    for (const x of r) expect(x.niveau, x.id).toBe("non-evalue");
    expect(LIBELLE_NIVEAU["non-evalue"]).toBe("non évalué");
    expect(r.every((x) => x.libelle.length > 0 && x.detail.length > 0)).toBe(true);
  });
  it("sources saines : tout est ok", () => {
    for (const x of evaluerRegistre(saines(), horloge)) expect(x.niveau, x.id).toBe("ok");
  });
  it("les identifiants du registre sont uniques", () => {
    expect(new Set(REGISTRE.map((r) => r.id)).size).toBe(REGISTRE.length);
  });
});

describe("RC-14 : service, cloche seulement, jamais de push", () => {
  it("evaluerAlertes lit l'horloge injectée et rend le même résultat que le registre", async () => {
    const r = await evaluerAlertes(saines(), horloge);
    expect(r).toEqual(evaluerRegistre(saines(), horloge));
  });
  it("seules les alertes non encore signalées partent à la cloche ; non évalué ne notifie pas", () => {
    const r = evaluerRegistre({ ...saines(), quotaPourcent: () => 85, santeOk: null }, horloge);
    expect(alertesAnotifier(r, new Set()).map((x) => x.id)).toEqual(["quota"]);
    expect(alertesAnotifier(r, new Set(["quota"]))).toEqual([]);
  });
  it("signalerParCloche : une notification « cloche seulement » par alerte, sans push", async () => {
    const creer = vi.fn(async () => undefined);
    const r = evaluerRegistre({ ...saines(), quotaPourcent: () => 85 }, horloge);
    const faits = await signalerParCloche(r, new Set(), creer);
    expect(faits).toEqual(["quota"]);
    expect(creer).toHaveBeenCalledTimes(1);
    const [n, options] = creer.mock.calls[0] as unknown as [{ titre: string; message: string }, { cloche?: boolean; sansPush?: boolean; email?: boolean }];
    expect(options.cloche).toBe(true);
    expect(options.email).toBeFalsy();
    expect(n.titre).toMatch(/quota/i);
  });
  it("aucun fichier du lot n'importe ni n'appelle push", () => {
    for (const f of ["src/domaine/alertes/seuil.ts", "src/domaine/alertes/registre.ts", "src/services/alertes.ts"]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/notification\/push|envoyerPush|abonnementValide|ConfigPush|\bpush\.ts\b|sansPush/i);
      expect(src, f).not.toMatch(/Date\.now|new Date\(\)/);
    }
  });
});
