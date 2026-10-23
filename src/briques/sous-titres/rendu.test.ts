import { describe, expect, it } from "vitest";
import type { SegmentSousTitres } from "@/domaine/types";
import { briqueSousTitres } from "@/briques";
import { exporterSrt, exporterVtt } from "./export";
import { reporterSurTexteValide } from "./report";
import { couleurAVenir, cssElement, elementDe, largeurElement, sceneAuTemps, type DonneesCalque } from "./scene";
import { couleursDepuisMarque, cssLigne, facteurTaille, gabaritDe, GABARITS } from "./style";
import { controlerSousTitres, donneesCalque, fabriquerSousTitres } from "./index";

const mot = (m: string, d: number, f: number, enValeur?: boolean) => ({ mot: m, debutSec: d, finSec: f, enValeur });
const seg = (x: Partial<SegmentSousTitres> & Pick<SegmentSousTitres, "mots">): SegmentSousTitres => ({
  id: "s",
  debutSec: x.mots[0].debutSec,
  finSec: x.mots[x.mots.length - 1].finSec,
  style: "base",
  importance: 0,
  souligne: null,
  position: "auto",
  inclinaison: 0,
  ...x,
});
const COULEURS = { texte: "#F3EDE4", accent: "#E07040", contour: "#16120F" };
const donnees = (segments: SegmentSousTitres[], base: "karaoke" | "minimal" = "karaoke"): DonneesCalque =>
  donneesCalque({ segments, base, couleurs: COULEURS, reseaux: ["tiktok", "instagram"] });

describe("report de l'horodatage sur le texte validé", () => {
  it("même nombre de mots : report direct, le texte affiché reste celui du script", () => {
    const r = reporterSurTexteValide(["135 €", "net."], [mot("cent-trente-cinq-euros", 0, 0.6), mot("net", 0.6, 0.8)]);
    expect(r.map((x) => x.mot)).toEqual(["135 €", "net."]);
    expect(r[0].finSec).toBe(0.6);
  });

  it("texte substitué ≠ texte affiché : horodatages toujours alignés et croissants", () => {
    const entendus = [mot("le", 0, 0.1), mot("pé", 0.1, 0.25), mot("vé", 0.25, 0.4), mot("est", 0.4, 0.5), mot("nul.", 0.5, 0.8)];
    const r = reporterSurTexteValide(["Le", "PV", "est", "nul."], entendus);
    expect(r.map((x) => x.mot)).toEqual(["Le", "PV", "est", "nul."]);
    expect(r[0].debutSec).toBe(0);
    expect(r[2]).toMatchObject({ debutSec: 0.4, finSec: 0.5 });
    expect(r[1].debutSec).toBeGreaterThanOrEqual(0.1 - 1e-9);
    expect(r[1].finSec).toBeLessThanOrEqual(0.4 + 1e-9);
    for (let i = 1; i < r.length; i++) expect(r[i].debutSec).toBeGreaterThanOrEqual(r[i - 1].debutSec);
    expect(r[3].finSec).toBe(0.8);
  });

  it("mot entendu en trop : le mot validé précédent s'allonge jusqu'à lui", () => {
    const r = reporterSurTexteValide(["bonjour", "Maître."], [mot("bonjour", 0, 0.3), mot("euh", 0.3, 0.5), mot("Maître", 0.5, 0.9)]);
    expect(r[0].finSec).toBe(0.5);
    expect(r[1]).toMatchObject({ debutSec: 0.5, finSec: 0.9 });
  });
});

describe("moteur de rendu unique (scène à l'instant t)", () => {
  const karaoke = seg({ mots: [mot("une", 0, 0.2), mot("personne", 0.2, 0.5, true), mot("à", 0.5, 0.6), mot("temps", 0.6, 0.8), mot("plein.", 0.8, 1.1)] });

  it("karaoké : mots dits crème, mot en cours orange, mots à venir fondus à 45 % (couleur pleine, contour entier)", () => {
    const el = sceneAuTemps(donnees([karaoke]), 0.55)!;
    expect(el.mots[0]).toMatchObject({ couleur: COULEURS.texte, opacite: 1 });
    expect(el.mots[1]).toMatchObject({ couleur: COULEURS.accent, opacite: 1 }); // en valeur, déjà dit
    expect(el.mots[2]).toMatchObject({ couleur: COULEURS.accent, opacite: 1 }); // en cours
    expect(el.mots[3]).toMatchObject({ couleur: couleurAVenir(COULEURS.texte, COULEURS.contour, 0.45), opacite: 1 });
    expect(el.police).toBe("Poppins ExtraBold");
  });

  it("rien pendant un blanc", () => {
    expect(sceneAuTemps(donnees([karaoke]), 1.5)).toBeNull();
  });

  it("Minimal : une seule couleur, fondu de 120 ms", () => {
    const d = donnees([karaoke], "minimal");
    const el = sceneAuTemps(d, 0.06)!;
    expect(el.opacite).toBeCloseTo(0.5, 1);
    expect(el.mots.every((m) => m.couleur === COULEURS.texte)).toBe(true);
    expect(el.police).toBe("Poppins Medium");
  });

  it("Impact : majuscules, rebond 0,9 → 1,05 → 1, incliné, chiffres en orange, très grand (×1,8)", () => {
    const s = seg({ mots: [mot("35", 0, 0.3), mot("HEURES", 0.3, 0.6)], style: "impact", importance: 3, inclinaison: 4, position: "milieu" });
    const d = donnees([s]);
    expect(sceneAuTemps(d, 0)!.echelle).toBeCloseTo(0.9);
    expect(sceneAuTemps(d, 0.12)!.echelle).toBeCloseTo(1.05);
    const el = sceneAuTemps(d, 0.4)!;
    expect(el.echelle).toBe(1);
    expect(el.rotationDeg).toBe(4);
    expect(el.mots[0].couleur).toBe(COULEURS.accent);
    expect(el.mots[1].couleur).toBe(COULEURS.texte);
    // « 35 HEURES » à 126 px dépasserait la zone libre : la taille est ramenée ; un mot seul garde ses 126 px.
    expect(el.taillePx).toBeLessThan(126);
    const seul = seg({ mots: [mot("35", 0, 0.3)], style: "impact", importance: 3 });
    expect(elementDe(donnees([seul]), seul, 0.3).taillePx).toBeCloseTo(70 * 1.8, 0);
    expect(cssElement(el, d, "x").ligne.textTransform).toBe("uppercase");
  });

  it("Bandeau : texte noir sur bandeau crème, mot clé orange, en haut dans la zone libre", () => {
    const s = seg({ mots: [mot("on", 0, 0.2), mot("a", 0.2, 0.3), mot("tout", 0.3, 0.5), mot("supprimé.", 0.5, 0.9, true)], style: "bandeau", position: "haut" });
    const d = donnees([s]);
    const el = sceneAuTemps(d, 0.5)!;
    expect(el.fond?.couleur).toBe(COULEURS.texte);
    expect(el.mots[0].couleur).toBe(COULEURS.contour);
    expect(el.mots[3].couleur).toBe(COULEURS.accent);
    expect(el.yPx).toBeCloseTo((d.positions.hautPct / 100) * 1920);
    expect(el.yPx / 1920).toBeGreaterThan(0.14);
  });

  it("soulignement : trait orange qui se dessine en 150 ms, le mot souligné n'est jamais coloré", () => {
    const s = seg({ mots: [mot("juste", 0, 0.2), mot("pour", 0.2, 0.3), mot("remplir", 0.3, 0.6), mot("Excel", 0.6, 0.9, true)], souligne: 3 });
    const d = donnees([s]);
    expect(sceneAuTemps(d, 0.675)!.mots[3].souligne).toBeCloseTo(0.5, 1);
    const el = sceneAuTemps(d, 0.85)!;
    expect(el.mots[3].souligne).toBe(1);
    expect(el.mots[3].couleur).toBe(COULEURS.texte);
    expect(cssElement(el, d, "x").trait(3).width).toBe("100%");
  });

  it("taille selon l'importance : normal ×1, grand ×1,3, très grand ×1,8", () => {
    expect(facteurTaille({ style: "base", importance: 0 })).toBe(1);
    expect(facteurTaille({ style: "base", importance: 3 })).toBe(1.3);
    expect(facteurTaille({ style: "impact", importance: 3 })).toBe(1.8);
  });

  it("une ligne trop large est rendue plus petite : jamais hors de la zone libre (mesure réelle)", () => {
    const s = seg({ mots: [mot("anticonstitutionnellement", 0, 0.5), mot("désapprouvé", 0.5, 1)], style: "impact", importance: 3 });
    const d = donnees([s]);
    const el = elementDe(d, s, 0.9);
    expect(largeurElement(el)).toBeLessThanOrEqual(d.largeurMaxPx);
    expect(el.taillePx).toBeLessThan(126);
    expect(controlerSousTitres(d)).toEqual([]);
  });

  it("plan poitrine : la ligne « auto » descend à 51 % pour ne pas couvrir la bouche", () => {
    const d = donneesCalque({ segments: [karaoke], base: "karaoke", couleurs: COULEURS, plansPoitrine: [{ debutSec: 0, finSec: 1 }] });
    expect(sceneAuTemps(d, 0.3)!.yPx / 1920).toBeCloseTo(0.51, 2);
  });

  it("CSS commun : contour sous le remplissage, coins arrondis, chiffres alignés à chasse fixe", () => {
    const css = cssLigne(GABARITS.karaoke, 70, COULEURS, "Poppins");
    expect(css.paintOrder).toBe("stroke fill");
    expect(css.strokeLinejoin).toBe("round");
    expect(css.fontVariantNumeric).toBe("lining-nums tabular-nums");
    expect(String(css.WebkitTextStroke)).toContain(COULEURS.contour);
  });
});

describe("styles et couleurs", () => {
  it("l'emphase vient du JETON de la marque (jamais une valeur écrite dans le moteur)", () => {
    const c = couleursDepuisMarque({ couleurs: [{ nom: "Orange vif", jeton: "--orange-vif", valeur: "#123456" }, { nom: "Crème", jeton: "--texte", valeur: "#FFFFFF" }] });
    expect(c.accent).toBe("#123456");
    expect(c.texte).toBe("#FFFFFF");
    expect(couleursDepuisMarque({ couleurs: [{ nom: "O", jeton: "orange", valeur: "#C65A2E" }] }, "orange").accent).toBe("#C65A2E");
  });

  it("styles retenus : Karaoké, Minimal, Impact, Bandeau ; un ancien élément est lu sans être réécrit", () => {
    expect(Object.keys(GABARITS).sort()).toEqual(["bandeau", "impact", "karaoke", "minimal"]);
    expect(gabaritDe({ animation: "surlignage", casse: "normale", position: "bas" })).toBe("karaoke");
    expect(gabaritDe({ animation: "pop", casse: "majuscules", position: "centre" })).toBe("impact");
    expect(gabaritDe({ animation: "aucune", casse: "normale", position: "centre" })).toBe("karaoke");
    expect(gabaritDe({ animation: "aucune", casse: "normale", position: "bas" })).toBe("minimal");
    expect(gabaritDe({ animation: "aucune", casse: "normale", position: "centre", gabarit: "minimal" })).toBe("minimal");
  });
});

describe("exports .srt et .vtt", () => {
  const segments: SegmentSousTitres[] = [
    seg({ id: "a", mots: [mot("Votre", 0, 0.3), mot("patron", 0.3, 0.7)], finSec: 1.2 }),
    seg({ id: "b", mots: [mot("135 €", 1.0, 1.5)], debutSec: 1.0 }),
  ];
  it(".srt : texte validé, sans chevauchement de minutage", () => {
    const srt = exporterSrt(segments);
    expect(srt).toContain("00:00:00,000 --> 00:00:01,000\nVotre patron");
    expect(srt).toContain("2\n00:00:01,000 --> 00:00:01,500\n135 €");
  });
  it(".vtt : en-tête WEBVTT, point décimal, sans numéros", () => {
    const vtt = exporterVtt(segments);
    expect(vtt.startsWith("WEBVTT\n\n00:00:00.000 --> 00:00:01.000")).toBe(true);
    expect(vtt).not.toMatch(/^\d+$/m);
  });
});

describe("brique « sous-titres » (contrat inchangé)", () => {
  it("l'appel du moteur avocat (texte, durée, mots par ligne, prononciations, emphase, mots) fonctionne", async () => {
    const texte = "Axion IA vous aide. Votre patron ne peut pas tout lire.";
    const segments = await briqueSousTitres.executer({ texte, dureeSec: 4, motsParLigne: 4, prononciations: [{ mot: "Axion-IA", prononciation: "axe ion i a" }], emphase: ["patron"] });
    const mots = segments.flatMap((s) => s.mots.map((m) => m.mot));
    expect(mots[0]).toBe("Axion-IA");
    expect(segments.some((s) => s.mots.some((m) => m.mot === "patron" && m.enValeur))).toBe(true);
    for (const s of segments) expect(s.style).toBeDefined();
  });

  it("le texte affiché est TOUJOURS celui du script validé (chiffres en chiffres)", () => {
    const s = fabriquerSousTitres({ texte: "Il touche 2 500 € net.", dureeSec: 2, mots: [mot("il", 0, 0.2), mot("touche", 0.2, 0.5), mot("deux", 0.5, 0.7), mot("mille", 0.7, 0.9), mot("cinq", 0.9, 1.1), mot("cents", 1.1, 1.3), mot("euros", 1.3, 1.5), mot("net", 1.5, 1.8)] });
    expect(s.flatMap((x) => x.mots.map((m) => m.mot)).join(" ")).toBe("Il touche 2 500 € net.");
  });
});
