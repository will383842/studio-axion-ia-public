/**
 * Lot A de la variété du cas concret : une maquette L6 n'est jamais reposée deux fois de suite sur un même canal (même type
 * d'écran, même rang), et l'écran d'accroche (ouverture visible) n'est jamais en `v4-centree` quand une autre maquette existe.
 */
import { describe, expect, it } from "vitest";
import type { EcranCale } from "@/briques/ecrans-motion";
import { CODES_L6, MISE_EN_PAGE_V4, misesEnPageEligibles } from "@/briques/ecrans-motion/mises-en-page";
import { ajouterAHistorique, entreeHistorique, estV4, maquettesPrecedentes, mettre, tirer, type EcranAMettre, type EntreeHistorique, type Mise, type Tirage } from "@/moteurs/montage-cas-concret/variete";
import { exemplesEcrans } from "../../../studio-rendu/compositions/cas-concret/exemples";

const CANAUX = [["facebook", "instagram", "tiktok", "linkedin"], ["linkedin"], ["instagram", "tiktok"], ["facebook"]] as const;
const LE = "2026-10-18T12:00:00.000Z";

function cales(): EcranCale[] {
  return exemplesEcrans().map((p) => {
    const { zone: _z, dessin: _d, largeur: _l, hauteur: _h, fps: _f, marque: _m, ...reste } = p;
    void [_z, _d, _l, _h, _f, _m];
    return reste as unknown as EcranCale;
  });
}
/** Une vidéo type de 14 écrans : plusieurs écrans du même type, dont trois étapes. */
function videoType(): EcranAMettre[] {
  const par = Object.fromEntries(cales().map((e) => [e.type, e]));
  const suite: [string, "sombre" | "ivoire"][] = [["accroche", "sombre"], ["chiffre", "sombre"], ["liste-avant", "ivoire"], ["titre", "sombre"], ["etape", "ivoire"], ["etape", "ivoire"], ["etape", "sombre"], ["objet", "sombre"], ["etape", "sombre"], ["titre", "sombre"], ["preuve", "ivoire"], ["chiffre", "ivoire"], ["resultat", "ivoire"], ["question", "sombre"]];
  return suite.map(([type, fond], i) => ({ id: `e${String(i + 1).padStart(2, "0")}`, type: type as EcranAMettre["type"], fond, contenu: { ...par[type]!, fond } as never }));
}

interface Ligne {
  videoId: string;
  canaux: readonly string[];
  mise: Mise;
  /** Historique tel qu'il était AVANT cette vidéo. */
  avant: EntreeHistorique[];
}

/** Série de vidéos tirées l'une après l'autre, avec ou sans les canaux passés à `mettre`. */
function serie(n: number, avecCanaux: boolean, ecrans = videoType()): Ligne[] {
  let historique: EntreeHistorique[] = [];
  const faites: Ligne[] = [];
  for (let i = 0; i < n; i++) {
    const videoId = `v-canal-${i}`;
    const canaux = CANAUX[i % CANAUX.length]!;
    const avant = historique;
    const mise = mettre(tirer({ videoId, canaux, historique }), ecrans, historique, avecCanaux ? canaux : []);
    historique = ajouterAHistorique(historique, entreeHistorique(videoId, canaux, mise.tirage, LE));
    faites.push({ videoId, canaux, mise, avant });
  }
  return faites;
}

/** Codes posés par la vidéo : par type, dans l'ordre des écrans de ce type (tous codes, v4 comprise). */
function codesParType(m: Mise, ecrans: readonly EcranAMettre[]): Map<string, string[]> {
  const sortie = new Map<string, string[]>();
  for (const e of ecrans) sortie.set(e.type, [...(sortie.get(e.type) ?? []), m.ecrans[e.id]!.miseEnPage]);
  return sortie;
}

describe("Lot A · maquettes jamais 2 fois de suite sur un canal", () => {
  const ecrans = videoType();
  const lignes = serie(60, true);
  const sansV4 = (n: number) => Array.from({ length: n }, (_, i) => tirer({ videoId: `v-main-${i}`, canaux: ["linkedin"], historique: [] })).filter((t) => !estV4(t));
  const ligne = (n: number, canaux: string[], misesEnPage: string, base: Tirage): EntreeHistorique => ({ videoId: `v-prec-${n}`, le: LE, canaux, tirage: { ...base, graine: 1_000_000 + n, misesEnPage } });

  it("(a) cas construit à la main : le k-ième code L6 d'un type n'est pas reposé au même rang, sauf s'il ne reste que la v4", () => {
    // Vidéo précédente de linkedin : accroche acc-page-ecrite ; titre tit-mot-objet ; étapes eta-fantome puis eta-schema-feutre.
    const interdits: Record<string, string[]> = { accroche: ["acc-page-ecrite"], titre: ["tit-mot-objet"], etape: ["eta-fantome", "eta-schema-feutre"] };
    const tirages = sansV4(60);
    const base = tirages[0]!;
    const historique = [ligne(1, ["linkedin"], "acc-page-ecrite,v4-centree,v4-centree,tit-mot-objet,eta-fantome,eta-schema-feutre", base)];
    let exercees = 0;
    for (const t of tirages) {
      const mise = mettre(t, ecrans, historique, ["linkedin"]);
      for (const [type, interdit] of Object.entries(interdits)) {
        // Rang compté à la main : on avance d'un cran chaque fois qu'une maquette L6 (pas la v4) est posée sur un écran de ce type.
        let n = 0;
        for (const e of ecrans.filter((x) => x.type === type)) {
          const code = mise.ecrans[e.id]!.miseEnPage;
          if (code === MISE_EN_PAGE_V4) continue;
          const defendu = interdit[n];
          if (defendu) {
            const autres = misesEnPageEligibles(e.contenu!).filter((c) => c !== MISE_EN_PAGE_V4 && c !== defendu);
            if (autres.length) {
              exercees++;
              expect(code, `${t.graine} ${e.id} rang ${n}`).not.toBe(defendu);
            }
          }
          n++;
        }
      }
    }
    expect(exercees).toBeGreaterThan(50);
  });

  it("(a bis) l'interdiction est levée quand elle ne laisserait que la v4 : l'écran garde sa seule maquette", () => {
    const e01 = ecrans[0]!;
    const seule = misesEnPageEligibles(e01.contenu!).filter((c) => c !== MISE_EN_PAGE_V4);
    expect(seule.length).toBeGreaterThan(0);
    const tirages = sansV4(20);
    const historique = [ligne(2, ["linkedin"], seule.join(","), tirages[0]!)];
    // Toutes les maquettes d'accroche sont « interdites » sur linkedin : aucune ne disparaît pour autant.
    for (const t of tirages) expect(seule).toContain(mettre(t, ecrans, historique, ["linkedin"]).ecrans.e01!.miseEnPage);
  });

  it("(b) l'écran d'accroche n'est jamais en v4-centree hors tirage v4", () => {
    let hors = 0;
    for (const l of lignes) {
      if (estV4(l.mise.tirage)) continue;
      hors++;
      expect(l.mise.ecrans.e01!.miseEnPage, l.videoId).not.toBe(MISE_EN_PAGE_V4);
      expect((CODES_L6 as readonly string[]).includes(l.mise.ecrans.e01!.miseEnPage)).toBe(true);
    }
    expect(hors).toBeGreaterThan(30);
  });

  it("(b bis) 4 réseaux dont les maquettes d'accroche sont toutes interdites : l'accroche n'est jamais en v4 (échouait avant le correctif)", () => {
    const reseaux = ["facebook", "instagram", "tiktok", "linkedin"];
    const eligibles = misesEnPageEligibles(ecrans[0]!.contenu!).filter((c) => c !== MISE_EN_PAGE_V4);
    expect(eligibles.length).toBeGreaterThan(0);
    expect(eligibles.length).toBeLessThanOrEqual(reseaux.length);
    const tirages = sansV4(40);
    const historique = eligibles.map((c, i) => ligne(10 + i, [reseaux[i]!], c, tirages[0]!));
    for (const t of tirages) expect(eligibles, `${t.graine}`).toContain(mettre(t, ecrans, historique, reseaux).ecrans.e01!.miseEnPage);
  });

  it("(c) déterministe : même historique, mêmes canaux, même mise", () => {
    const b = serie(60, true);
    expect(b.map((l) => l.mise)).toEqual(lignes.map((l) => l.mise));
  });

  it("(d) sans canaux, aucune interdiction : le résultat est celui d'avant, sans lire l'historique", () => {
    const sans = serie(60, false);
    const sansHistorique = sans.map((l) => mettre(l.mise.tirage, ecrans, []));
    // Les maquettes ne dépendent plus des vidéos précédentes (seule la combinaison déjà vue relance un tirage).
    sans.forEach((l, i) => {
      for (const e of ecrans) expect(Object.keys(l.mise.ecrans)).toContain(e.id);
      expect(sansHistorique[i]!.tirage.graine).toBe(l.mise.tirage.graine);
    });
    expect(maquettesPrecedentes({ graine: 1 }, lignes[5]!.avant, [])).toEqual({});
    // Au moins une pose aurait été interdite avec les canaux : sans eux, elle est permise.
    let interdites = 0;
    sans.forEach((l, i) => {
      if (estV4(l.mise.tirage) || i === 0) return;
      const interdit = maquettesPrecedentes(l.mise.tirage, l.avant, l.canaux);
      for (const [type, codes] of codesParType(l.mise, ecrans)) codes.forEach((c, k) => { if (interdit[type]?.[k]?.has(c)) interdites++; });
    });
    expect(interdites).toBeGreaterThan(0);
  });

  it("(e) une ligne de même graine est ignorée (une vidéo refaite ne s'interdit pas elle-même)", () => {
    const l = lignes[10]!;
    const apres = ajouterAHistorique(l.avant, entreeHistorique(l.videoId, l.canaux, l.mise.tirage, LE));
    expect(maquettesPrecedentes(l.mise.tirage, apres, l.canaux)).toEqual(maquettesPrecedentes(l.mise.tirage, l.avant, l.canaux));
    // Même vidéo remise : même mise qu'avant.
    expect(mettre(l.mise.tirage, ecrans, apres, l.canaux)).toEqual(l.mise);
  });

  it("maquettesPrecedentes : prend la dernière ligne du canal qui a une combinaison, ignore la v4 et les canaux étrangers", () => {
    const base = lignes.find((l) => !estV4(l.mise.tirage))!.mise.tirage;
    const ligne = (videoId: string, canaux: string[], misesEnPage?: string): EntreeHistorique => ({ videoId, le: LE, canaux, tirage: { ...base, graine: videoId.length * 1000 + canaux.length, misesEnPage } });
    const h = [
      ligne("ancienne", ["linkedin"], "acc-detail-recul,v4-centree,eta-fantome+objet,eta-schema-feutre"),
      ligne("recente", ["linkedin"], "acc-page-ecrite,tit-mot-objet,eta-fantome"),
      ligne("autre-canal", ["tiktok"], "acc-duel-tailles"),
      ligne("sans-combinaison", ["linkedin"]),
    ];
    const r = maquettesPrecedentes({ graine: -1 }, h, ["linkedin"]);
    expect([...r.accroche![0]!]).toEqual(["acc-page-ecrite"]);
    expect([...r.titre![0]!]).toEqual(["tit-mot-objet"]);
    expect([...r.etape![0]!]).toEqual(["eta-fantome"]);
    expect(r.etape![1]).toBeUndefined();
    const deux = maquettesPrecedentes({ graine: -1 }, h, ["linkedin", "tiktok"]);
    expect([...deux.accroche![0]!].sort()).toEqual(["acc-duel-tailles", "acc-page-ecrite"]);
  });
});
