/**
 * L3a · leviers de variété sans risque : sons et fins.
 *  - bruitages : départ de la rotation des variantes (`graine`) ; 0 ou absent : la v4 exacte ;
 *  - fins : rotation de la phrase « diagnostic » parmi les phrases VALIDÉES (`rangPhrase`, non branché) ;
 *  - écran final (`lien`) : 2 compositions × 2 animations lues dans `p.jeu` ; sans jeu, le plan de la v4 à l'identique ;
 *    la marque et la bulle toujours présentes, dans la zone utile.
 */
import { describe, expect, it } from "vitest";
import { controlerProprietes, imagesEcran, type ProprietesEcran } from "@/briques/ecrans-motion";
import { TABLE_FINS_DIAGNOSTIC, type FinTable } from "@/briques/fins";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { FINS_DIAGNOSTIC } from "@/formats/cas-concret";
import { poserBruitages, type EntreeBruitages } from "@/moteurs/montage-cas-concret/bruitages";
import { ficheParGabarit } from "@/moteurs/montage-cas-concret/ecriture";
import { ecransCales } from "@/moteurs/montage-cas-concret/etapes";
import { fabriquerCasConcret } from "@/moteurs/montage-cas-concret/fabriquer";
import type { EcranCorps, FicheEcrans } from "@/moteurs/montage-cas-concret/fiche";
import { phrasesDiagnosticInterchangeables, planDesFins } from "@/moteurs/montage-cas-concret/fins";
import type { BruitageValideCasConcret } from "@/moteurs/montage-cas-concret/outils";
import { mettre, TIRAGE_V4, type Tirage } from "@/moteurs/montage-cas-concret/variete";
import { proprietesPleineImage } from "@/moteurs/montage-cas-concret/zone-objets";
import { exempleEcran } from "../../../studio-rendu/compositions/cas-concret/exemples";
import { MONTEE_BULLE, planLien, varianteFin, type ProprietesLien } from "../../../studio-rendu/compositions/cas-concret/plans/Lien";
import { doubles } from "../fabriquer/doubles";

const FIXE = { videoId: "video-cc", versionId: "v1", habillage: "charte-duo/1", origine: "porte-a" as const };
const fiche = (): FicheEcrans => ficheParGabarit(trouverCas("recrutement-apporteurs")!, FIXE);

/** Trois variantes validées par déclencheur (aucun son nouveau : des doubles de test). */
const SONS: BruitageValideCasConcret[] = (["illustration-forte", "impact", "document", "telephone", "chiffre"] as const).flatMap((declencheur) =>
  [1, 2, 3].map((variante) => ({ elementId: `son-${declencheur}-${variante}`, declencheur, variante, dureeSec: 0.3, cle: `studio/dev/bruitages/${declencheur}-${variante}.wav`, mime: "audio/wav" })),
);

/* ------------------------------------------------------------------ */
/* 1. Bruitages                                                         */
/* ------------------------------------------------------------------ */

describe("L3a · bruitages : départ de la rotation des variantes", () => {
  const f = fiche();
  let debut = 0;
  const corps = f.ecrans.map((e) => ({ ...e, debutMs: debut, finMs: (debut += 2000) })) as EcranCorps[];
  const captures = Object.fromEntries(corps.filter((e) => e.type === "etape" && e.visuel.sorte === "ecran").map((e) => [e.id, { cle: `cap-${e.id}.jpg` }]));
  const entree: EntreeBruitages = { ecrans: corps, cales: ecransCales(corps, [], null, captures), mots: [], dureeSec: debut / 1000 + 2.1, valides: SONS };

  it("graine 0 ou absente : exactement les sons d'avant", () => {
    const sans = poserBruitages(entree);
    expect(sans.length).toBeGreaterThan(5);
    expect(poserBruitages({ ...entree, graine: 0 })).toEqual(sans);
    // Rotation d'origine : la n-ième pose d'un déclencheur prend la variante n (modulo 3).
    const souffles = sans.filter((b) => b.declencheur === "illustration-forte").map((b) => b.elementId);
    expect(souffles.slice(0, 4)).toEqual(["son-illustration-forte-1", "son-illustration-forte-2", "son-illustration-forte-3", "son-illustration-forte-1"]);
  });

  it("graine g : même placement, variantes décalées de g ; déterministe ; jamais deux fois la même de suite", () => {
    const sans = poserBruitages(entree);
    for (const g of [1, 2, 3, 4, 5]) {
      const avec = poserBruitages({ ...entree, graine: g });
      expect(avec).toEqual(poserBruitages({ ...entree, graine: g }));
      const sansSon = (l: typeof sans) => l.map((b) => ({ ...b, elementId: "" }));
      expect(sansSon(avec)).toEqual(sansSon(sans));
      const parDecl = new Map<string, string[]>();
      for (const b of avec) parDecl.set(b.declencheur, [...(parDecl.get(b.declencheur) ?? []), b.elementId]);
      for (const [d, ids] of parDecl) {
        ids.forEach((id, n) => expect(id).toBe(`son-${d}-${((n + g) % 3) + 1}`));
        for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
      }
      // Seuls des sons validés reçus.
      expect(avec.every((b) => SONS.some((s) => s.elementId === b.elementId))).toBe(true);
    }
    expect(poserBruitages({ ...entree, graine: 3 })).toEqual(sans);
    expect(poserBruitages({ ...entree, graine: 1 })).not.toEqual(sans);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Fins : phrases                                                    */
/* ------------------------------------------------------------------ */

describe("L3a · fins : rotation de la phrase « diagnostic » parmi les phrases validées", () => {
  const dits = (reseau: Parameters<typeof phrasesDiagnosticInterchangeables>[0]) => phrasesDiagnosticInterchangeables(reseau, TABLE_FINS_DIAGNOSTIC).map((l) => l.dit);

  it("les phrases interchangeables d'aujourd'hui (la phrase par défaut d'abord)", () => {
    expect(dits("instagram")).toEqual(["Faites votre diagnostic gratuit en quelques minutes.", "Réservez votre diagnostic gratuit."]);
    expect(dits("facebook")).toEqual(["Faites votre diagnostic gratuit en quelques minutes.", "Réservez votre diagnostic gratuit."]);
    expect(dits("tiktok")).toEqual(["Faites votre diagnostic gratuit en quelques minutes.", "Réservez votre diagnostic gratuit."]);
    expect(dits("linkedin")).toEqual(["Faites votre diagnostic gratuit en quelques minutes."]);
    for (const r of ["instagram", "facebook", "tiktok", "linkedin"] as const) {
      const l = phrasesDiagnosticInterchangeables(r, TABLE_FINS_DIAGNOSTIC);
      expect(l[0]!.id).toBe(FINS_DIAGNOSTIC[r][0]);
      expect(l.every((x) => x.type === "rendez-vous" && x.validee && x.groupe === l[0]!.groupe)).toBe(true);
    }
  });

  it("une ligne non validée, d'un autre réseau ou d'un autre type n'entre jamais dans la rotation", () => {
    const table: FinTable[] = [
      ...TABLE_FINS_DIAGNOSTIC,
      { id: "essai-non-validee", groupe: "instagram-facebook", type: "rendez-vous", dit: "Phrase d'essai.", ecran: "Phrase d'essai", validee: false },
      { id: "essai-facebook-seul", groupe: "instagram-facebook", type: "rendez-vous", dit: "Phrase d'essai.", ecran: "Phrase d'essai", reseaux: ["facebook"], validee: true },
    ];
    const ids = (r: "instagram" | "facebook") => phrasesDiagnosticInterchangeables(r, table).map((l) => l.id);
    expect(ids("instagram")).toEqual(["fin-if-diagnostic-gratuit", "fin-if-rdv-seul"]);
    expect(ids("facebook")).toEqual(["fin-if-diagnostic-gratuit", "fin-if-rdv-seul", "essai-facebook-seul"]);
  });

  const demande = { reseaux: ["facebook", "instagram", "tiktok", "linkedin"] as ("facebook" | "instagram" | "tiktok" | "linkedin")[], offre: "integration" as const, nature: "automatisation" as const, mot: "IA", motDit: "I.A.", avecMot: false, table: TABLE_FINS_DIAGNOSTIC };

  it("sans rang (ou rang 0) : le plan des fins est strictement le même", () => {
    const sans = planDesFins(demande);
    expect(planDesFins({ ...demande, rangPhrase: 0 })).toEqual(sans);
    expect(JSON.stringify(planDesFins({ ...demande, rangPhrase: 0 }))).toBe(JSON.stringify(sans));
  });

  it("rang 1 : seule la demande « diagnostic » change ; le lien, le mot et le cadeau restent ; LinkedIn n'a qu'une phrase", () => {
    const sans = planDesFins(demande);
    const avec = planDesFins({ ...demande, rangPhrase: 1 });
    expect(avec.fins.map((f) => f.reseaux)).toEqual(sans.fins.map((f) => f.reseaux));
    for (const [i, f] of avec.fins.entries()) {
      const avant = sans.fins[i]!;
      const diag = f.appels.find((a) => a.type === "rendez-vous")!;
      expect(f.appels.filter((a) => a.type !== "rendez-vous")).toEqual(avant.appels.filter((a) => a.type !== "rendez-vous"));
      if (f.reseaux.includes("linkedin")) expect(f).toEqual(avant);
      else {
        expect(diag.dit).toBe("Réservez votre diagnostic gratuit.");
        const ecranDiag = f.ecrans.find((e) => e.type === "diagnostic")!;
        expect(ecranDiag).toMatchObject({ titre: "Réservez votre diagnostic gratuit", texteDit: "Réservez votre diagnostic gratuit." });
        expect("ligne" in ecranDiag).toBe(false);
        expect(f.ecrans.find((e) => e.type === "lien")).toEqual(avant.ecrans.find((e) => e.type === "lien"));
      }
    }
    // Rang 2 : retour à la phrase par défaut (2 phrases) ; déterministe.
    expect(planDesFins({ ...demande, rangPhrase: 2 })).toEqual(sans);
    expect(planDesFins({ ...demande, rangPhrase: 1 })).toEqual(avec);
  });

  it("la fin au mot ne tourne jamais (X7 d'Instagram : commentaire, cadeau)", () => {
    const auMot = { ...demande, avecMot: true, motSur: ["facebook", "instagram"] as ("facebook" | "instagram")[] };
    const sans = planDesFins(auMot);
    const avec = planDesFins({ ...auMot, rangPhrase: 1 });
    const auMotDe = (p: typeof sans) => p.fins.filter((f) => !f.appels.some((a) => a.type === "rendez-vous"));
    expect(auMotDe(sans).length).toBeGreaterThan(0);
    expect(auMotDe(avec)).toEqual(auMotDe(sans));
  });
});

/* ------------------------------------------------------------------ */
/* 3. Écran final (`lien`)                                              */
/* ------------------------------------------------------------------ */

const COMBINAISONS = [
  { finComposition: 0, finAnimation: 0 },
  { finComposition: 1, finAnimation: 0 },
  { finComposition: 0, finAnimation: 1 },
  { finComposition: 1, finAnimation: 1 },
] as const;

/** L'écran `lien` d'exemple, et le même dans la zone pleine image du format (celle de la fabrication). */
function ecransLien(): ProprietesLien[] {
  const exemple = exempleEcran("lien") as ProprietesLien;
  const { id, fond, debutMs, finMs, evenements, type, titre, lien, signature } = exemple;
  const pleine = proprietesPleineImage({ ecrans: [{ id, fond, debutMs, finMs, evenements, type, titre, lien, signature }], captures: {} })[0] as ProprietesLien;
  const longue = { ...pleine, titre: "Réservez votre diagnostic gratuit", lien: "Diagnostic gratuit · lien dans le profil", evenements: [{ cible: "lien", ms: 1200 }] };
  return [exemple, pleine, longue];
}
const avecJeu = (p: ProprietesLien, jeu: (typeof COMBINAISONS)[number]): ProprietesLien => {
  const j = { ...(jeu.finComposition ? { finComposition: 1 } : {}), ...(jeu.finAnimation ? { finAnimation: 1 } : {}) };
  return Object.keys(j).length ? { ...p, jeu: j } : p;
};
const dans = (b: { x: number; y: number; largeur: number; hauteur: number }, z: { x: number; y: number; largeur: number; hauteur: number }) =>
  b.x >= z.x - 0.01 && b.y >= z.y - 0.01 && b.x + b.largeur <= z.x + z.largeur + 0.01 && b.y + b.hauteur <= z.y + z.hauteur + 0.01;
const images = (p: ProprietesEcran) => {
  const n = imagesEcran(p);
  return [0, 5, 20, 30, Math.floor(n / 2), n - 1];
};

describe("L3a · écran final : 2 compositions × 2 animations", () => {
  it("sans jeu, ou jeu à 0 : le plan est EXACTEMENT celui de la v4, à chaque image", () => {
    for (const p of ecransLien()) {
      for (const i of images(p)) {
        const v4 = planLien(p, i);
        expect("variante" in v4).toBe(false);
        expect(planLien({ ...p, jeu: { finComposition: 0, finAnimation: 0 } }, i)).toEqual(v4);
        expect(planLien({ ...p, jeu: { autreDimension: "x" } }, i)).toEqual(v4);
      }
    }
    expect(varianteFin({})).toEqual({ composition: 0, animation: 0 });
    expect(varianteFin({ jeu: { finComposition: 1, finAnimation: 1 } })).toEqual({ composition: 1, animation: 1 });
  });

  it("chaque combinaison : marque et bulle présentes, dans la zone utile, le texte de la bulle tient ; contrôle des propriétés vide", () => {
    for (const base of ecransLien()) {
      for (const c of COMBINAISONS) {
        const p = avecJeu(base, c);
        expect(controlerProprietes(p)).toEqual([]);
        const n = imagesEcran(p);
        const fin = planLien(p, n - 1);
        expect(fin.textes.marque).toBe("axion-ia.com");
        expect(fin.textes.lien).toBe(p.lien);
        expect(fin.textes.signature).toBe("Axion-IA");
        expect(dans(fin.marque, p.zone)).toBe(true);
        expect(dans(fin.bulle.boite, p.zone)).toBe(true);
        expect(fin.bulle.objet.boite).toEqual(fin.bulle.boite);
        expect(fin.bulle.tient).toBe(true);
        // À la fin : la bulle est posée, entière et visible.
        expect(fin.bulle.progres).toBe(1);
        expect(fin.bulle.entree.opacite).toBe(1);
        expect(Math.abs(fin.bulle.entree.decalageY)).toBeLessThan(1e-9);
        // Les tailles, polices et textes de la charte ne varient jamais : mêmes poses que la v4.
        const v4 = planLien(base, n - 1);
        expect(fin.titre.pose).toEqual(v4.titre.pose);
        expect(fin.signature).toEqual(v4.signature);
        expect(fin.bulle.boite.largeur).toBe(v4.bulle.boite.largeur);
        expect(fin.bulle.boite.y).toBe(v4.bulle.boite.y);
        expect(fin.bulle.objet.tailleTexte).toBe(v4.bulle.objet.tailleTexte);
        if (c.finComposition || c.finAnimation) expect(fin.variante).toEqual({ composition: c.finComposition, animation: c.finAnimation });
      }
    }
  });

  it("composition 1 : la bulle passe dans la marge gauche de la zone utile, sous le titre", () => {
    for (const base of ecransLien()) {
      const p = avecJeu(base, { finComposition: 1, finAnimation: 0 });
      const plan = planLien(p, imagesEcran(p) - 1);
      expect(plan.bulle.boite.x).toBe(p.zone.x);
      expect(plan.bulle.boite.y).toBeGreaterThan(plan.titre.pose.boite.y + plan.titre.pose.boite.hauteur - 0.01);
      // Même animation que la v4.
      for (const i of images(p)) expect(planLien(p, i).bulle.progres).toBe(planLien(base, i).bulle.progres);
    }
  });

  it("animation 1 : la bulle monte depuis le bas, dépasse un peu, puis se pose ; le texte du lien paraît avec elle", () => {
    const base = ecransLien()[0]!;
    const p = avecJeu(base, { finComposition: 0, finAnimation: 1 });
    const fps = p.fps;
    const plan = (s: number) => planLien(p, Math.round(s * fps));
    const debut = 0.9 - 0.1;
    expect(plan(debut - 0.2).bulle.entree.opacite).toBe(0);
    expect(plan(debut - 0.2).textes.lien).toBeUndefined();
    expect(plan(debut + 0.04).bulle.entree.decalageY).toBeGreaterThan(MONTEE_BULLE.px * 0.5);
    expect(plan(debut + 0.04).textes.lien).toBe(p.lien);
    const decalages = Array.from({ length: Math.round(MONTEE_BULLE.dureeS * fps) + 1 }, (_, k) => planLien(p, Math.round(debut * fps) + k).bulle.entree.decalageY);
    // Léger rebond : passe un peu au-dessus de sa place (au plus 15 % de la montée), puis revient à 0.
    expect(Math.min(...decalages)).toBeLessThan(0);
    expect(Math.min(...decalages)).toBeGreaterThan(-0.15 * MONTEE_BULLE.px);
    expect(plan(debut + MONTEE_BULLE.dureeS + 0.1).bulle.entree.decalageY).toBeCloseTo(0, 9);
    // Déterministe.
    expect(plan(1.1)).toEqual(plan(1.1));
  });
});

/* ------------------------------------------------------------------ */
/* 4. Dans la chaîne                                                    */
/* ------------------------------------------------------------------ */

describe("L3a · chaîne : la mise de la vidéo pilote les sons et l'écran final", () => {
  type Soumise = { parametres: unknown; entrees?: Record<string, string> };
  /** Propriétés des écrans soumis, sans les adresses signées des captures (un jeton neuf à chaque signature). */
  const propsEcrans = (s: Soumise[]) => s.map((x) => JSON.parse(JSON.stringify((x.parametres as { proprietes: ProprietesEcran }).proprietes).replace(/"src":"[^"]*"/g, '"src":""')) as ProprietesEcran);
  /** Sons montés par chaque composition, dans l'ordre (« impact-2 »…), lus dans ses entrées (adresses signées). */
  const sonsPoses = (s: Soumise[]) =>
    s.map((x) =>
      Object.entries(x.entrees ?? {})
        .filter(([k]) => k.startsWith("bruitage-"))
        .sort(([a], [b]) => Number(a.slice(9)) - Number(b.slice(9)))
        .map(([, v]) => /bruitages\/([^?]+)\.wav/.exec(v)?.[1] ?? ""),
    );

  async function fabriquer(tirage: Tirage | null) {
    const d = doubles({ bruitages: SONS });
    if (tirage) {
      const f = fiche();
      d.options.entrees = { ...d.options.entrees, ficheCle: "studio/dev/fiches/video-cc.json" };
      d.options.lireFiche = async () => structuredClone({ ...f, mise: mettre(tirage, f.ecrans) });
    } else {
      const f = fiche();
      d.options.entrees = { ...d.options.entrees, ficheCle: "studio/dev/fiches/video-cc.json" };
      d.options.lireFiche = async () => structuredClone(f);
    }
    await fabriquerCasConcret(d.options);
    return { ecrans: propsEcrans(d.ecransSoumis()), sons: sonsPoses(d.compositionsSoumises()) };
  }

  it("tirage v4 (0 partout) : mêmes écrans et mêmes sons que sans mise ; aucun jeu", async () => {
    const sans = await fabriquer(null);
    const v4 = await fabriquer(TIRAGE_V4);
    expect(v4.ecrans).toEqual(sans.ecrans);
    expect(v4.ecrans.some((p) => "jeu" in p)).toBe(false);
    expect(v4.sons).toEqual(sans.sons);
    expect(sans.sons.flat().length).toBeGreaterThan(0);
  });

  it("départ des bruitages ≠ 0 : autres variantes ; fin 1/1 : le jeu sur le DERNIER écran `lien` de chaque fin seulement", async () => {
    const sans = await fabriquer(null);
    const t: Tirage = { ...TIRAGE_V4, bruitages: { depart: 1 }, fin: { phrase: 0, composition: 1, animation: 1 } };
    const avec = await fabriquer(t);
    expect(avec.sons).not.toEqual(sans.sons);
    expect(avec.sons.map((x) => x.length)).toEqual(sans.sons.map((x) => x.length));
    const liens = avec.ecrans.filter((p) => p.type === "lien");
    expect(liens.length).toBeGreaterThan(0);
    for (const p of liens) expect(p.jeu).toEqual({ finComposition: 1, finAnimation: 1 });
    // Les clés de la fin ne vont que sur l'écran `lien` (les écrans du corps peuvent porter d'autres dimensions, ex. L3c).
    expect(avec.ecrans.filter((p) => p.type !== "lien").some((p) => p.jeu && ("finComposition" in p.jeu || "finAnimation" in p.jeu))).toBe(false);
    // Seule l'animation : seule la clé non nulle est posée.
    const seule = await fabriquer({ ...TIRAGE_V4, fin: { phrase: 3, composition: 0, animation: 1 } });
    for (const p of seule.ecrans.filter((x) => x.type === "lien")) expect(p.jeu).toEqual({ finAnimation: 1 });
    // La phrase n'est pas branchée (le plan des fins précède le tirage) : mêmes écrans hors `lien` (leur `jeu` mis à part :
    // d'autres lots, ex. L3c, y posent leurs propres dimensions dès que le tirage n'est plus la v4).
    const sansJeu = (ps: typeof sans.ecrans) => ps.filter((p) => p.type !== "lien").map(({ jeu: _jeu, ...p }) => (void _jeu, p));
    expect(sansJeu(seule.ecrans)).toEqual(sansJeu(sans.ecrans));
  });
});
