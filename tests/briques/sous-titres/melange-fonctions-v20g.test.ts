import { describe, expect, it } from "vitest";
import type { MotHorodate, SegmentSousTitres } from "@/domaine/types";
import { appliquerChoixGroupe, importanceMot, INTENSITES, PLANCHERS_VARIATION, reglagesVaries, reporterVerrouilles } from "@/briques/sous-titres/melange";

const mot = (m: string, enValeur?: boolean): MotHorodate => ({ mot: m, debutSec: 0, finSec: 1, ...(enValeur ? { enValeur } : {}) });
const groupe = (id: string, debutSec: number, mots: string[], extra: Partial<SegmentSousTitres> = {}): SegmentSousTitres => ({
  id,
  debutSec,
  finSec: debutSec + 1,
  mots: mots.map((m) => mot(m)),
  ...extra,
});
const sansTitre = { titre: new Set<string>(), ancre: false };

describe("reglagesVaries", () => {
  const base = INTENSITES.equilibre;
  it("sans variation ou sans réglages : renvoie les réglages de l'intensité tels quels", () => {
    expect(reglagesVaries(base)).toBe(base);
    expect(reglagesVaries(base, {})).toBe(base);
    expect(reglagesVaries(base, { sensPremierImpact: -1 })).toBe(base);
  });
  it("remplace clé par clé, garde le reste et ne modifie pas l'entrée", () => {
    const avant = JSON.stringify(base);
    const r = reglagesVaries(base, { reglages: { impactEcartSec: 9 } });
    expect(r).toEqual({ impactEcartSec: 9, bandeauToutesLesSec: 15, souligneUnSur: 5, mouvement: true });
    expect(JSON.stringify(base)).toBe(avant);
  });
  it("borne par les planchers de « Très dynamique » et garde null (désactivé)", () => {
    const r = reglagesVaries(base, { reglages: { impactEcartSec: 1, bandeauToutesLesSec: 2, souligneUnSur: 1 } });
    expect(r.impactEcartSec).toBe(PLANCHERS_VARIATION.impactEcartSec);
    expect(r.bandeauToutesLesSec).toBe(10);
    expect(r.souligneUnSur).toBe(3);
    expect(reglagesVaries(base, { reglages: { impactEcartSec: null, souligneUnSur: null } })).toEqual({
      impactEcartSec: null,
      bandeauToutesLesSec: 15,
      souligneUnSur: null,
      mouvement: true,
    });
  });
  it("une intensité sobre (null) reste null si la variation ne dit rien", () => {
    expect(reglagesVaries(INTENSITES.sobre, { reglages: { bandeauToutesLesSec: undefined } }).bandeauToutesLesSec).toBeNull();
  });
});

describe("importanceMot", () => {
  it("chiffres et montants : 3", () => {
    expect(importanceMot(mot("67"), sansTitre)).toBe(3);
    expect(importanceMot(mot("2,5€"), sansTitre)).toBe(3);
  });
  it("mot fort ou mis en valeur : 2", () => {
    expect(importanceMot(mot("jamais"), sansTitre)).toBe(2);
    expect(importanceMot(mot("Jamais,"), sansTitre)).toBe(2);
    expect(importanceMot(mot("bref", true), sansTitre)).toBe(2);
  });
  it("mot du titre (4 lettres et plus), ancre ou mot plein long : 1", () => {
    expect(importanceMot(mot("loyer"), { titre: new Set(["loyer"]), ancre: false })).toBe(1);
    expect(importanceMot(mot("bref"), { titre: new Set(["bref"]), ancre: false })).toBe(1);
    expect(importanceMot(mot("zut"), { titre: new Set(["zut"]), ancre: false })).toBe(0);
    expect(importanceMot(mot("zut"), { titre: new Set(), ancre: true })).toBe(1);
    expect(importanceMot(mot("locataire"), sansTitre)).toBe(1);
  });
  it("mot outil, vide ou ponctuation seule : 0 ; un mot fort ne descend pas sous 2 même ancré", () => {
    expect(importanceMot(mot("de"), sansTitre)).toBe(0);
    expect(importanceMot(mot("..."), sansTitre)).toBe(0);
    expect(importanceMot(mot(""), sansTitre)).toBe(0);
    expect(importanceMot(mot("jamais"), { titre: new Set(), ancre: true })).toBe(2);
  });
});

describe("reporterVerrouilles", () => {
  const verrouille = groupe("a", 10, ["Le", "loyer"], { style: "impact", importance: 3, souligne: 1, position: "milieu", inclinaison: -4, verrouille: true });
  it("sans groupe verrouillé : renvoie les nouveaux groupes tels quels", () => {
    const nouveaux = [groupe("n", 10, ["Le", "loyer"])];
    expect(reporterVerrouilles([groupe("a", 10, ["Le", "loyer"])], nouveaux)).toBe(nouveaux);
    expect(reporterVerrouilles([], nouveaux)).toBe(nouveaux);
  });
  it("même texte (casse et ponctuation ignorées) et minutage proche : reporte les choix et verrouille", () => {
    const nouveaux = [groupe("n1", 10.9, ["le", "Loyer."]), groupe("n2", 20, ["autre", "texte"])];
    const avant = JSON.stringify(nouveaux);
    const r = reporterVerrouilles([verrouille], nouveaux);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ id: "n1", style: "impact", importance: 3, souligne: 1, position: "milieu", inclinaison: -4, verrouille: true });
    expect(r[1]).toBe(nouveaux[1]);
    expect(JSON.stringify(nouveaux)).toBe(avant);
  });
  it("minutage trop éloigné (1,5 s ou plus) ou texte différent : rien n'est reporté", () => {
    const loin = groupe("loin", 11.5, ["Le", "loyer"]);
    const autre = groupe("autre", 10, ["Le", "bail"]);
    const r = reporterVerrouilles([verrouille], [loin, autre]);
    expect(r[0]).toBe(loin);
    expect(r[1]).toBe(autre);
    expect(r[0].verrouille).toBeUndefined();
  });
});

describe("appliquerChoixGroupe", () => {
  const g = groupe("g1", 5, ["Le", "loyer", "augmente"], { style: "base", importance: 1, souligne: null, position: "auto", inclinaison: 0 });
  const autre = groupe("g2", 8, ["Fin"]);
  const liste = [g, autre];
  const appliquer = (choix: Parameters<typeof appliquerChoixGroupe>[2], motIndex?: number, source: SegmentSousTitres[] = liste) =>
    appliquerChoixGroupe(source, "g1", choix, motIndex)[0];

  it("id inconnu : mêmes groupes (mêmes références) ; les autres groupes ne changent jamais ; entrée intacte", () => {
    const avant = JSON.stringify(liste);
    const r = appliquerChoixGroupe(liste, "inconnu", "impact");
    expect(r[0]).toBe(g);
    expect(r[1]).toBe(autre);
    expect(appliquerChoixGroupe(liste, "g1", "impact")[1]).toBe(autre);
    expect(JSON.stringify(liste)).toBe(avant);
    expect(appliquerChoixGroupe([], "g1", "impact")).toEqual([]);
  });
  it("impact : style, taille 3, milieu, inclinaison 4 par défaut (gardée si déjà inclinée), verrouillé", () => {
    expect(appliquer("impact")).toMatchObject({ style: "impact", importance: 3, position: "milieu", inclinaison: 4, souligne: null, verrouille: true });
    expect(appliquer("impact", undefined, [{ ...g, inclinaison: -3 }])).toMatchObject({ inclinaison: -3 });
  });
  it("bandeau : haut par défaut, bas gardé, importance au moins 2", () => {
    expect(appliquer("bandeau")).toMatchObject({ style: "bandeau", importance: 2, position: "haut", inclinaison: 0, verrouille: true });
    expect(appliquer("bandeau", undefined, [{ ...g, position: "bas", importance: 3 }])).toMatchObject({ position: "bas", importance: 3 });
  });
  it("base : style base, position auto, inclinaison 0, importance plafonnée à 2", () => {
    expect(appliquer("base", undefined, [{ ...g, style: "impact", importance: 3, inclinaison: 4, position: "milieu" }])).toMatchObject({
      style: "base",
      importance: 2,
      position: "auto",
      inclinaison: 0,
      verrouille: true,
    });
  });
  it("souligner : premier mot non outil par défaut, mot choisi, bascule off, hors limites = null, retire la couleur", () => {
    expect(appliquer("souligner").souligne).toBe(1);
    expect(appliquer("souligner", 2).souligne).toBe(2);
    expect(appliquer("souligner", 9).souligne).toBeNull();
    expect(appliquer("souligner", undefined, [{ ...g, souligne: 1 }]).souligne).toBeNull();
    const colore = { ...g, mots: [mot("Le"), mot("loyer", true), mot("augmente")] };
    const r = appliquer("souligner", 1, [colore]);
    expect(r.mots[1].enValeur).toBe(false);
    expect(colore.mots[1].enValeur).toBe(true);
  });
  it("plus-gros / plus-petit : bornes 3 et 0", () => {
    expect(appliquer("plus-gros").importance).toBe(3);
    expect(appliquer("plus-gros", undefined, [{ ...g, importance: 3 }]).importance).toBe(3);
    expect(appliquer("plus-gros", undefined, [{ ...g, importance: 0 }]).importance).toBe(3);
    expect(appliquer("plus-petit").importance).toBe(0);
    expect(appliquer("plus-petit", undefined, [{ ...g, importance: 0 }]).importance).toBe(0);
    expect(appliquer("plus-petit", undefined, [{ ...g, importance: 3 }]).importance).toBe(2);
  });
  it("monter / descendre : bas, milieu, haut, bornés ; auto compte pour milieu", () => {
    expect(appliquer("monter").position).toBe("haut");
    expect(appliquer("descendre").position).toBe("bas");
    expect(appliquer("monter", undefined, [{ ...g, position: "bas" }]).position).toBe("milieu");
    expect(appliquer("monter", undefined, [{ ...g, position: "haut" }]).position).toBe("haut");
    expect(appliquer("descendre", undefined, [{ ...g, position: "bas" }]).position).toBe("bas");
    expect(appliquer("descendre", undefined, [{ ...g, position: "haut" }]).position).toBe("milieu");
  });
});
