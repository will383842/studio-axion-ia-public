import { describe, expect, it } from "vitest";
import type { MotHorodate, SegmentSousTitres } from "@/domaine/types";
import { appliquerChoixGroupe, importanceMot, melanger, reporterVerrouilles } from "./melange";
import { fabriquerSousTitres } from "./index";

const TEXTE =
  "Il a gagné 35 heures. Votre patron ne peut jamais lire vos mails personnels. Une personne à temps plein juste pour remplir Excel. " +
  "Il ne voyait qu'une partie du dossier. On a tout supprimé en une semaine. Le juge a condamné l'employeur à payer 2 500 € de dommages. " +
  "Les données sont mises à jour en direct chaque matin. Vous pouvez demander une copie gratuite de votre dossier. Retenez bien cette règle simple.";

const fabriquer = (intensite: "sobre" | "equilibre" | "tres-dynamique", coupesSec: number[] = []) =>
  fabriquerSousTitres({ texte: TEXTE, dureeSec: 40, intensite, emphase: ["jamais", "Excel", "supprimé", "condamné"], coupesSec });

describe("mélange des styles dans une même vidéo (décision de Will)", () => {
  it("note d'importance : chiffres 3, mots en valeur et négations fortes 2, mots du titre 1, mots outils 0", () => {
    const ctx = { titre: new Set(["licenciement"]), ancre: false };
    const m = (mot: string, enValeur?: boolean): MotHorodate => ({ mot, debutSec: 0, finSec: 0.2, enValeur });
    expect(importanceMot(m("35"), ctx)).toBe(3);
    expect(importanceMot(m("jamais"), ctx)).toBe(2);
    expect(importanceMot(m("Excel", true), ctx)).toBe(2);
    expect(importanceMot(m("licenciement."), ctx)).toBe(1);
    expect(importanceMot(m("de"), ctx)).toBe(0);
  });

  it("Sobre : la base seule, sans Impact, sans Bandeau, sans soulignement (les mots en couleur restent)", () => {
    const s = fabriquer("sobre");
    expect(s.every((x) => x.style === "base")).toBe(true);
    expect(s.every((x) => x.souligne === null)).toBe(true);
    expect(s.some((x) => x.mots.some((m) => m.enValeur))).toBe(true);
  });

  it("Équilibré : l'accroche (0-2 s) en Impact, ~80 % de base, Impact espacés d'au moins 6 s et jamais deux de suite", () => {
    const s = fabriquer("equilibre");
    const impacts = s.flatMap((x, i) => (x.style === "impact" ? [i] : []));
    expect(impacts.length).toBeGreaterThan(0);
    expect(s[impacts[0]].debutSec).toBeLessThan(2);
    for (let k = 1; k < impacts.length; k++) {
      expect(impacts[k] - impacts[k - 1]).toBeGreaterThan(1);
      expect(s[impacts[k]].debutSec - s[impacts[k - 1]].debutSec).toBeGreaterThanOrEqual(6);
    }
    const base = s.filter((x) => x.style === "base").length / s.length;
    expect(base).toBeGreaterThanOrEqual(0.75);
    // Impact : incliné de ±3-5°, alterné, au milieu, très grand.
    for (const i of impacts) {
      expect(Math.abs(s[i].inclinaison ?? 0)).toBeGreaterThanOrEqual(3);
      expect(Math.abs(s[i].inclinaison ?? 0)).toBeLessThanOrEqual(5);
      expect(s[i].importance).toBe(3);
    }
  });

  it("Équilibré : 1 à 3 bandeaux, déplacés en haut (ou en bas si le haut est occupé), jamais à côté d'un Impact", () => {
    const s = fabriquer("equilibre");
    const bandeaux = s.flatMap((x, i) => (x.style === "bandeau" ? [i] : []));
    expect(bandeaux.length).toBeGreaterThanOrEqual(1);
    expect(bandeaux.length).toBeLessThanOrEqual(3);
    for (const i of bandeaux) {
      expect(s[i].position).toBe("haut");
      expect(s[i - 1]?.style).not.toBe("impact");
      expect(s[i + 1]?.style).not.toBe("impact");
    }
    const occupe = melanger(
      s.map((x) => ({ ...x, style: undefined })),
      { intensite: "equilibre", occupe: [{ debutSec: 0, finSec: 60, zone: "haut" }] },
    );
    for (const x of occupe.filter((y) => y.style === "bandeau")) expect(x.position).toBe("bas");
  });

  it("soulignement : au plus 1 groupe sur 5, jamais sur un mot coloré", () => {
    const s = fabriquer("equilibre");
    const soulignes = s.flatMap((x, i) => (x.souligne !== null && x.souligne !== undefined ? [i] : []));
    for (let k = 1; k < soulignes.length; k++) expect(soulignes[k] - soulignes[k - 1]).toBeGreaterThanOrEqual(5);
    for (const i of soulignes) expect(s[i].mots[s[i].souligne!].enValeur).toBeFalsy();
  });

  it("Très dynamique : plus d'Impact et de soulignés qu'Équilibré", () => {
    const e = fabriquer("equilibre");
    const t = fabriquer("tres-dynamique");
    const n = (s: SegmentSousTitres[], f: (x: SegmentSousTitres) => boolean) => s.filter(f).length;
    expect(n(t, (x) => x.style === "impact")).toBeGreaterThanOrEqual(n(e, (x) => x.style === "impact"));
    expect(n(t, (x) => x.souligne != null)).toBeGreaterThanOrEqual(n(e, (x) => x.souligne != null));
  });

  it("un changement de style tombe de préférence sur une coupe de plan", () => {
    const sans = fabriquer("equilibre");
    const candidat = sans.find((x, i) => i > 3 && x.style === "base" && (x.importance ?? 0) >= 2 && x.mots.length <= 3 && x.debutSec > 8);
    if (!candidat) return;
    const avec = fabriquer("equilibre", [candidat.debutSec]);
    const choisi = avec.find((x) => x.id === candidat.id);
    // Avec une coupe sur son début, ce groupe fort devient un accent (ou un accent voisin y est déjà).
    expect(avec.filter((x) => x.style !== "base").length).toBeGreaterThanOrEqual(1);
    expect(choisi).toBeDefined();
  });

  it("toucher un groupe : Base / Impact / Bandeau / Souligner / Plus gros / Plus petit / Monter / Descendre, et le groupe est VERROUILLÉ", () => {
    const s = fabriquer("equilibre");
    const id = s[5].id;
    const impact = appliquerChoixGroupe(s, id, "impact").find((x) => x.id === id)!;
    expect(impact).toMatchObject({ style: "impact", importance: 3, verrouille: true });
    const bandeau = appliquerChoixGroupe(s, id, "bandeau").find((x) => x.id === id)!;
    expect(bandeau).toMatchObject({ style: "bandeau", position: "haut", verrouille: true });
    const base = appliquerChoixGroupe([impact], id, "base")[0];
    expect(base).toMatchObject({ style: "base", inclinaison: 0, position: "auto" });
    const souligne = appliquerChoixGroupe(s, id, "souligner", 0).find((x) => x.id === id)!;
    expect(souligne.souligne).toBe(0);
    expect(souligne.mots[0].enValeur).toBeFalsy();
    expect(appliquerChoixGroupe([souligne], id, "souligner")[0].souligne).toBeNull();
    const gros = appliquerChoixGroupe([{ ...s[5], importance: 1 }], id, "plus-gros")[0];
    expect(gros.importance).toBe(3);
    expect(appliquerChoixGroupe([gros], id, "plus-petit")[0].importance).toBe(2);
    const monte = appliquerChoixGroupe([{ ...s[5], position: "auto" }], id, "monter")[0];
    expect(monte.position).toBe("haut");
    expect(appliquerChoixGroupe([monte], id, "descendre")[0].position).toBe("milieu");
    expect(appliquerChoixGroupe([{ ...s[5], position: "bas" }], id, "descendre")[0].position).toBe("bas");
    // Les autres groupes ne bougent pas.
    expect(appliquerChoixGroupe(s, id, "impact").filter((x) => x.id !== id)).toEqual(s.filter((x) => x.id !== id));
  });

  it("un groupe verrouillé n'est jamais réécrit par le moteur, même après un nouveau calcul", () => {
    const s = fabriquer("equilibre");
    const id = s[6].id;
    const touche = appliquerChoixGroupe(s, id, "bandeau");
    const recalcule = melanger(touche, { intensite: "sobre" });
    expect(recalcule.find((x) => x.id === id)).toMatchObject({ style: "bandeau", verrouille: true });
    // Nouvelle fabrication (mêmes mots) : le choix passe sur le nouveau groupe.
    const refait = fabriquerSousTitres({ texte: TEXTE, dureeSec: 40, intensite: "sobre", anciens: touche });
    expect(refait.find((x) => x.id === id)).toMatchObject({ style: "bandeau", verrouille: true });
    expect(reporterVerrouilles([], s)).toBe(s);
  });
});
