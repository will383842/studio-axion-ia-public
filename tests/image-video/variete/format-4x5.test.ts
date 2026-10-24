/**
 * Variété « Image → vidéo » · LOT F45 : format 4:5 (1080 × 1350) pour LinkedIn et le fil Facebook, Facebook en DEUX
 * fichiers (Reel 9:16 + fil 4:5), une seule voix. Le 9:16 reste identique à avant (empreintes figées sur la branche du
 * socle f3c79ec, avant le lot). Aucun appel payant : doubles de `doubles-fabrication.ts`.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { CADRES_IV } from "@/briques/schema-motion/variete";
import { BANDE_SOUS_TITRES_IV, BAS_ENTETE_IV, ECRAN_IV, formatDeHauteurIV, MISE_EN_PAGE_IV, ZONE_CONTENU_IV, ZONE_UTILE_IV } from "@/briques/schema-motion/types";
import type { CarteImage } from "@/domaine/image-video/carte";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import type { BruitageValideIV } from "@/moteurs/montage-image-video/bruitages";
import { pisteSimulee } from "@/moteurs/montage-image-video/calage";
import { FICHES_SIMULEES } from "@/moteurs/montage-image-video/ecriture.simulation";
import {
  avancerIV,
  avancerJusquAArretIV,
  attendWillIV,
  etatInitialIV,
  FORMAT_4X5_PRET_IV,
  FORMATS_PAR_RESEAU_IV,
  idVersionFormatIV,
  lignesDesVersionsIV,
  livraisonDe,
  prixSuiteIV,
  reseauxParFormatIV,
  validerCarteIV,
  validerScriptIV,
  type EtatFabricationIV,
} from "@/moteurs/montage-image-video/fabrication";
import { planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { mettreEnSceneIV, type LigneDeTempsIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { CONSIGNE_FIL_FACEBOOK, texteFilFacebookIV, type PublicationIV } from "@/moteurs/montage-image-video/publication";
import { bandeSousTitres, controlerSousTitresIV, LIMITES_BAS_SOUS_TITRES_4X5_IV, sousTitresIV } from "@/moteurs/montage-image-video/sous-titres";
import { CENTRE_SOUS_TITRES_IV_4X5_PCT, CENTRE_SOUS_TITRES_IV_PCT, demandeMontageIV, parametresDuBloc, ratioDeLaLigneIV, scenesDeLaLigne } from "@/services/image-video-rendu";
import { cadrageScene, hautCadreDe, masqueToile } from "../../../studio-rendu/compositions/image-video/plan";
import { carteFixe, demandeEssai, monde, outilsSimules } from "../doubles-fabrication";

vi.setConfig({ testTimeout: 120_000 });

const DOSSIER = join(process.cwd(), "tests/image-video/fixtures/cartes");
const carteDe = (nom: string): CarteImage => JSON.parse(readFileSync(join(DOSSIER, `${nom}.json`), "utf8"));
const VALIDES: BruitageValideIV[] = SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur, variante: s.variante, dureeSec: s.dureeSec }));
const IMAGES = { A: "essai-a", B: "essai-b", C: "essai-c", D: "essai-d", E: "essai-e", F: "essai-f" } as const;

/** Lignes de temps 9:16 des 6 cartes × 5 fins (comme le test du socle). */
function lignes916(): LigneDeTempsIV[] {
  return Object.entries(IMAGES).flatMap(([nom, id]) => {
    const carte = carteDe(nom);
    const fiche = FICHES_SIMULEES[id];
    const fins = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins;
    return fins.map((fin) => mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES }).ligne);
  });
}

/** La ligne de temps 4:5 de la carte C, version LinkedIn. */
function ligneC45(): LigneDeTempsIV {
  const carte = carteDe("C");
  const fiche = FICHES_SIMULEES["essai-c"];
  const fin = planDesFinsIV({ reseaux: RESEAUX_IV, offre: carte.offre, questionCommentaire: fiche.questionCommentaire.texteDit }).fins.find((f) => f.reseaux.includes("linkedin"))!;
  return mettreEnSceneIV({ carte, fiche, voix: pisteSimulee(fiche, fin.muet ? null : fin), fin, reseaux: fin.reseaux, bruitagesValides: VALIDES, format: "4:5" }).ligne;
}

/**
 * Empreintes du 9:16 sur la branche du socle (f3c79ec), AVANT le lot : propriétés et clés des scènes de chaque bloc, et
 * demande du montage final de chaque version (6 cartes × 5 fins).
 * Scènes et montages mis à jour au lot F (assemblage) : un bloc `moments` sans repère envoie `repere: null` (correctif du « 1/3 »
 * parasite sous la marque, #298) ; seules les propriétés de ces scènes changent.
 * Intégration (fusion de master : #320 micro-objet, #323 blocs cités dessinés, #340 rythme e-mail / alerte) : les
 * blocs de ces écrans portent ce que master leur a ajouté (champs, déclencheurs, tampon) ; les lignes sont celles de
 * master (voir `socle.test.ts`), donc les propriétés et les clés de ces scènes changent avec elles.
 * Caméra (17/10, bloc entier sur son mot) : seule la toile b06 de la carte F change (la caméra ne quitte plus n09
 * avant son mot : n08 surgit 0,31 s et n10 0,17 s après leur mot, décalage existant ≤ 0,6 s ; trajectoire et bruitage
 * de caméra suivent).
 * Queue de fin (17/10, v-dd3049053f88) : la DERNIÈRE scène de chaque version reçoit sa queue (`queue`, trait de fin) et,
 * si c'est un écran v4, passe par `ImageVideoEcranFin` ; rien d'autre ne change (vérifié en neutralisant la queue).
 */
// 19/10/2026 : TikTok retiré d'Image → vidéo (décision de Will) : version 9:16 de référence = YouTube Shorts ; empreinte recalculée sur master avec YouTube Shorts à la place de TikTok : même valeur.
const EMPREINTE_SCENES_916 = "e9b0118235def6a9f608d05adc7f81b02d9b5a12ca12f32feb0f88a3cd4858d0"; // 24/10/2026 : compositions-iv/8 (écran CHI-E, pile des chiffres), seule la clé de version a bougé ; ancienne 674cc298… ; 24/10/2026 : compositions-iv/7 (liens sans part : plus de pastille « 0 % »), seule la clé de version a bougé ; ancienne 88beba03… ; 23/10/2026 : compositions-iv/6 (feutre APP-B en 0,3 s, vue d'ensemble sans paires dans le tronc) ; // 23/10/2026 : VERSION_COMPOSITIONS_IV (/5) dans la clé des scènes ; les écrans v4 9:16 ont une zone au-dessus de la bande des sous-titres
const EMPREINTE_MONTAGES_916 = "7c7206cad2f1e1700390bcaca80fc6b8592a65d74e3be198fdbfc6ac637fb0ff"; // 24/10/2026 : compositions-iv/8, seule la clé de version a bougé ; ancienne 4bd99a15… ; 24/10/2026 : compositions-iv/7, seule la clé de version a bougé ; ancienne f38513d0… ; 23/10/2026 : clés de scène avec VERSION_COMPOSITIONS_IV (compositions-iv/5), écrans v4 9:16 repositionnés ; // clés des scènes changées (mêmes blocs ; queue de fin) ; 18/10/2026 : clé "scene-iv/2" (fond ivoire des vues d'ensemble, pastille REC-B) — seule la clé a bougé, vérifié : avec "scene-iv/1" les anciennes empreintes repassent

const OUTILS_RENDU = {
  rendu: {} as never,
  env: "dev",
  signerLecture: async (cle: string) => `https://lecture/${cle}`,
  signerDepot: async (cle: string) => `https://depot/${cle}`,
  sons: [],
};

describe("F45 · le 9:16 ne change pas", () => {
  it("mise en page 9:16 = les constantes d'avant ; 4:5 = le cadre du contrat (doc 76)", () => {
    const m = MISE_EN_PAGE_IV["9:16"];
    expect([m.largeur, m.hauteur, m.hauteurTexte]).toEqual([ECRAN_IV.largeur, ECRAN_IV.hauteur, ECRAN_IV.hauteur]);
    expect(m.bandeSousTitres).toBe(BANDE_SOUS_TITRES_IV);
    expect(m.zoneUtile).toBe(ZONE_UTILE_IV);
    expect(m.zoneContenu).toBe(ZONE_CONTENU_IV);
    expect(m.entete.bas).toBe(BAS_ENTETE_IV);
    const q = MISE_EN_PAGE_IV["4:5"];
    const c = CADRES_IV["4:5"];
    expect([q.largeur, q.hauteur]).toEqual([c.largeur, c.hauteur]);
    expect(q.bandeSousTitres.haut * q.hauteur).toBeCloseTo(c.sousTitres.haut, 6);
    expect(q.bandeSousTitres.bas * q.hauteur).toBeCloseTo(c.sousTitres.bas, 6);
    expect(q.zoneUtile.haut * q.hauteur).toBeGreaterThanOrEqual(c.utile.haut);
    expect(q.zoneUtile.bas * q.hauteur).toBeLessThan(c.sousTitres.haut);
    expect(q.hautMarque * q.hauteur).toBeGreaterThanOrEqual(c.utile.haut);
    expect([formatDeHauteurIV(1920), formatDeHauteurIV(1350)]).toEqual(["9:16", "4:5"]);
  });

  it("sous-titres 9:16 : même objet qu'avant (aucun champ `format`), bande inchangée", () => {
    const st = sousTitresIV([{ mot: "Bonjour", debutSec: 0, finSec: 0.4 }, { mot: "à", debutSec: 0.4, finSec: 0.5 }], { reseaux: ["tiktok"] });
    expect(st).not.toHaveProperty("format");
    expect(st.bande).toEqual({ haut: BANDE_SOUS_TITRES_IV.haut, bas: BANDE_SOUS_TITRES_IV.bas });
    expect(controlerSousTitresIV(st)).toEqual([]);
  });

  it("scènes et montage 9:16 : mêmes propriétés, mêmes clés, même demande qu'avant le lot", async () => {
    const scenes = createHash("sha256");
    const montages = createHash("sha256");
    for (const ligne of lignes916()) {
      expect(ratioDeLaLigneIV(ligne)).toBe("9:16");
      const s = scenesDeLaLigne(ligne, { env: "dev", videoId: "v-essai" });
      scenes.update(JSON.stringify(s));
      const piste = { version: ligne.version, reseaux: ligne.reseaux, mots: [], motsCorps: [], dureeSec: ligne.dureeSec, finVoixSec: ligne.finVoixSec, cle: "voix.wav", empreinte: "e" } as never;
      const d = { id: `iv-${ligne.version}`, videoId: "v-essai", version: ligne.version, reseaux: ligne.reseaux, ligne, mixage: { id: "m", voix: { cle: "voix.wav", empreinte: "e" }, bruitages: [] } as never, piste };
      montages.update(JSON.stringify(await demandeMontageIV(d, OUTILS_RENDU)));
    }
    expect(scenes.digest("hex")).toBe(EMPREINTE_SCENES_916);
    expect(montages.digest("hex")).toBe(EMPREINTE_MONTAGES_916);
  });

  it("fabrication sans formats (défaut tant que le correctif hors lot manque) : tout en 9:16, état d'avant", () => {
    expect(FORMAT_4X5_PRET_IV).toBe(false);
    const e = etatInitialIV(demandeEssai(carteFixe("C")));
    expect(e.demande).not.toHaveProperty("formats");
  });
});

describe("F45 · mise en page 4:5", () => {
  it("sous-titres 4:5 : bande y 1042 → 1176, au-dessus des 10 % du bas (LinkedIn, fil Facebook) ; Q22 en 4:5", () => {
    const st = sousTitresIV([{ mot: "Bonjour", debutSec: 0, finSec: 0.4 }, { mot: "à", debutSec: 0.4, finSec: 0.5 }], { reseaux: ["linkedin"], format: "4:5" });
    expect(st.format).toBe("4:5");
    expect(Math.round(st.bande.haut * 1350)).toBe(1042);
    expect(Math.round(st.bande.bas * 1350)).toBe(1176);
    expect(controlerSousTitresIV(st, ["linkedin", "facebook"])).toEqual([]);
    // Fil Facebook sans zones 4:5 au registre : celles de LinkedIn (doc 73) → sous-titres jusqu'à y 1188 au plus.
    expect(Math.round(LIMITES_BAS_SOUS_TITRES_4X5_IV.facebook * 1350)).toBe(1188);
    expect(Math.round(LIMITES_BAS_SOUS_TITRES_4X5_IV.linkedin * 1350)).toBe(1188);
    // La bande 9:16 posée dans un écran 4:5 est refusée (sur le contenu, hors de la bande du format).
    expect(controlerSousTitresIV({ bande: bandeSousTitres("9:16"), taille: st.taille }, ["linkedin"], "4:5").length).toBeGreaterThan(0);
  });

  it("toile 4:5 : nœud parlé posé dans la zone visible (sous l'en-tête resserré, au-dessus des sous-titres)", () => {
    const p = { entetes: [{ debut: 0, fin: 2, etiquette: "Étape", titre: "Le *client* écrit" }], schema: { noeuds: [], liens: [], groupes: [] }, coches: [] };
    expect(JSON.stringify(cadrageScene({ ...p, hauteur: 1920 }))).toBe(JSON.stringify(cadrageScene(p)));
    const c = cadrageScene({ ...p, hauteur: 1350 });
    const q = MISE_EN_PAGE_IV["4:5"];
    // Fractions de l'écran de référence 1920, montré en haut du cadre 1350.
    expect(c.bande!.haut * 1920).toBeGreaterThan(q.entete.bas * 1350);
    expect(c.bande!.bas * 1920).toBeCloseTo(q.zoneUtile.bas * 1350, 6);
    expect(c.bande!.bas * 1920).toBeLessThan(1042);
    expect(c.cadre!.bas * 1920).toBeCloseTo(q.zoneUtile.bas * 1350, 6);
    const sans = cadrageScene({ ...p, entetes: [], hauteur: 1350 });
    expect(sans.bande!.haut * 1920).toBeGreaterThanOrEqual(54);
    expect(sans.bande!.bas * 1920).toBeLessThan(1042);
    // Masque : 9:16 identique ; 4:5 effacé au haut de la bande 4:5.
    expect(masqueToile(1920, true)).toBe(masqueToile(ECRAN_IV.hauteur, true));
    expect(masqueToile(1350, true)).toContain(`transparent ${q.bandeSousTitres.haut * 1350}px`);
    expect(hautCadreDe(1350) * 1350).toBeLessThan(hautCadreDe(1920) * 1920);
  });

  it("rendu 4:5 de la carte C : toiles et écrans en 1080 × 1350, écrans au-dessus de la bande, montage au ratio 4:5", async () => {
    const ligne = ligneC45();
    expect([ligne.largeur, ligne.hauteur]).toEqual([1080, 1350]);
    expect(ratioDeLaLigneIV(ligne)).toBe("4:5");
    for (const b of ligne.blocs) {
      const p = parametresDuBloc(b, ligne).proprietes as { largeur: number; hauteur: number; zone?: { y: number; hauteur: number }; basFil?: number };
      expect([p.largeur, p.hauteur], b.id).toEqual([1080, 1350]);
      if (b.sorte === "ecran") {
        // Aucun texte de l'écran hors de y 54 → 1215, ni dans la bande des sous-titres.
        expect(p.zone!.y).toBeGreaterThanOrEqual(54);
        expect(p.zone!.y + p.zone!.hauteur).toBeLessThanOrEqual(1042);
        expect(p.basFil).toBeLessThanOrEqual(1215);
      }
    }
    const piste = { version: ligne.version, reseaux: ligne.reseaux, mots: [], motsCorps: [], dureeSec: ligne.dureeSec, finVoixSec: ligne.finVoixSec, cle: "voix.wav", empreinte: "e" } as never;
    const d = await demandeMontageIV({ id: "iv-45", videoId: "v-essai", version: "fin-linkedin-4x5", reseaux: ["linkedin"], ligne, mixage: { id: "m", voix: { cle: "voix.wav", empreinte: "e" }, bruitages: [] } as never, piste }, OUTILS_RENDU);
    const texte = JSON.stringify(d);
    expect(texte).toContain('"4:5"');
    expect(texte).toContain(`"milieuPct":${CENTRE_SOUS_TITRES_IV_4X5_PCT}`);
    expect(CENTRE_SOUS_TITRES_IV_4X5_PCT).toBeCloseTo(((1042 + 1176) / 2 / 1350) * 100, 1);
    expect(CENTRE_SOUS_TITRES_IV_4X5_PCT).not.toBe(CENTRE_SOUS_TITRES_IV_PCT);
  });
});

/** Jusqu'à la mise en scène (carte et script validés tels quels) : les pistes voix sont faites. */
async function jusquALaMiseEnScene(formats: boolean, reseaux: EtatFabricationIV["demande"]["reseaux"]) {
  const carte = carteFixe("C");
  const m = monde();
  const o = outilsSimules(carte, m);
  let e = etatInitialIV(demandeEssai(carte, { reseaux, ...(formats ? { formats: FORMATS_PAR_RESEAU_IV } : {}) }));
  for (let i = 0; i < 200 && e.etape !== "mise-en-scene" && e.etape !== "refusee"; i++) {
    if (attendWillIV(e) === "carte") e = validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-16T08:00:00.000Z" });
    else if (attendWillIV(e) === "script") e = validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) });
    else e = JSON.parse(JSON.stringify(await avancerIV(e, o)));
  }
  return { e, m, o };
}

describe("F45 · une version par (groupe de fins × format), une seule voix", () => {
  it("décision de Will : LinkedIn 4:5, Facebook 9:16 + 4:5, les autres 9:16", () => {
    expect(reseauxParFormatIV(["tiktok", "youtube-shorts", "instagram"])).toEqual([{ format: "9:16", reseaux: ["tiktok", "youtube-shorts", "instagram"] }]);
    expect(reseauxParFormatIV(["linkedin"])).toEqual([{ format: "4:5", reseaux: ["linkedin"] }]);
    expect(reseauxParFormatIV(["facebook"])).toEqual([
      { format: "9:16", reseaux: ["facebook"] },
      { format: "4:5", reseaux: ["facebook"] },
    ]);
    expect(reseauxParFormatIV(["facebook"], {})).toEqual([{ format: "9:16", reseaux: ["facebook"] }]);
    expect([idVersionFormatIV("fin-facebook", "9:16"), idVersionFormatIV("fin-facebook", "4:5")]).toEqual(["fin-facebook", "fin-facebook-4x5"]);
  });

  it("carte C, LinkedIn + Facebook : 3 versions (LinkedIn 4:5, Facebook 9:16, Facebook 4:5), UNE voix, une piste par fin", async () => {
    const { e, m } = await jusquALaMiseEnScene(true, ["linkedin", "facebook"]);
    expect(e.etape).toBe("mise-en-scene");
    const v = lignesDesVersionsIV(e);
    expect(v.map((x) => [x.version, x.reseaux, x.format, x.ligne.largeur, x.ligne.hauteur])).toEqual([
      ["fin-linkedin-4x5", ["linkedin"], "4:5", 1080, 1350],
      ["fin-facebook", ["facebook"], "9:16", 1080, 1920],
      ["fin-facebook-4x5", ["facebook"], "4:5", 1080, 1350],
    ]);
    // Une seule voix payée : le corps lu une fois, une lecture par fin dite (LinkedIn muet) ; les deux Facebook ont la même piste.
    expect(m.lus.length).toBe((e.voix?.segments.fins.length ?? 0) + 1);
    expect(e.pistes?.map((p) => p.version)).toEqual(["fin-linkedin", "fin-facebook"]);
    expect(v[1].piste).toBe(v[2].piste);
    // Même voix, mêmes mots, même durée : seule la mise en page change.
    expect(v[2].ligne.dureeSec).toBe(v[1].ligne.dureeSec);
    expect(v[2].ligne.sousTitres.groupes).toEqual(v[1].ligne.sousTitres.groupes);
  });

  it("sans formats (défaut actuel) : la version LinkedIn reste en 1080 × 1920, Facebook n'a qu'un fichier", async () => {
    const { e } = await jusquALaMiseEnScene(false, ["linkedin", "facebook"]);
    expect(lignesDesVersionsIV(e).map((x) => [x.version, x.ligne.hauteur])).toEqual([
      ["fin-linkedin", 1920],
      ["fin-facebook", 1920],
    ]);
  });

  it("prix : la version 4:5 de Facebook ajoute une relecture d'images, pas de transcription (même piste), pas de voix", async () => {
    const { e } = await jusquALaMiseEnScene(true, ["linkedin", "facebook"]);
    const sans = { ...e, demande: { ...e.demande, formats: undefined } };
    const tarif = 0.05;
    const avec45 = prixSuiteIV(e, e.script!.fiche, e.plan!, tarif);
    const avant = prixSuiteIV(sans, e.script!.fiche, e.plan!, tarif);
    // Relecture : 0,25 $ (habituel), 0,50 $ au pire (comptée deux fois au pire), au taux prudent (1 € pour 1 $).
    expect(avec45.habituelCentimes - avant.habituelCentimes).toBe(25);
    expect(avec45.auPlusCentimes - avant.auPlusCentimes).toBe(100);
  });
});

describe("F45 · livraison Facebook en deux fichiers", () => {
  it("Facebook : le Reel 9:16 (`fichierCle`) et le fil 4:5 (`fichierCleFil`), même fin, texte du fil ; LinkedIn : un fichier 4:5", async () => {
    const { e } = await jusquALaMiseEnScene(true, ["linkedin", "facebook"]);
    const etat: EtatFabricationIV = {
      ...e,
      rendus: {
        "fin-linkedin-4x5": { cle: "final/li-45.mp4", dureeSec: 50, demande: "a" },
        "fin-facebook": { cle: "final/fb-916.mp4", dureeSec: 52, demande: "b" },
        "fin-facebook-4x5": { cle: "final/fb-45.mp4", dureeSec: 52, demande: "c" },
      },
    };
    const publication: PublicationIV = { textes: [{ reseau: "facebook", texte: "Texte du Reel.", premierCommentaire: "Le lien : x", ouPoserLeLien: "premier-commentaire", consigneLien: "Poser ce lien." }], manquements: [] };
    const l = livraisonDe(etat, { reseaux: [{ reseau: "linkedin", version: "longue" }, { reseau: "facebook", version: "longue" }] as never }, publication, {});
    expect(l.find((x) => x.reseau === "linkedin")).toMatchObject({ fichierCle: "final/li-45.mp4", format: "4:5" });
    expect(l.find((x) => x.reseau === "linkedin")).not.toHaveProperty("fichierCleFil");
    expect(l.find((x) => x.reseau === "facebook")).toMatchObject({ fichierCle: "final/fb-916.mp4", fichierCleFil: "final/fb-45.mp4", dureeSecFil: 52, texte: "Texte du Reel.", texteFil: "Texte du Reel.", consigneLienFil: CONSIGNE_FIL_FACEBOOK });
    expect(l.find((x) => x.reseau === "facebook")).not.toHaveProperty("format");

    // Le fil manque : rien ne part (« relancez le rendu »).
    const sansFil = l.map((x) => (x.reseau === "facebook" ? { ...x, fichierCleFil: undefined } : x));
    const r = await avancerIV({ ...etat, etape: "livraison", livraison: sansFil }, outilsSimules(carteFixe("C"), monde()));
    expect(r.etape).toBe("refusee");
    expect(r.refus?.message).toMatch(/facebook/);
    const ok = await avancerIV({ ...etat, etape: "livraison", livraison: l }, outilsSimules(carteFixe("C"), monde()));
    expect(ok.etape).toBe("prete");
  });

  it("texte du fil Facebook : celui du Reel, même lien en premier commentaire, consigne du fil", () => {
    expect(texteFilFacebookIV({ textes: [] })).toBeNull();
    expect(texteFilFacebookIV({ textes: [{ reseau: "facebook", texte: "T", premierCommentaire: "L", ouPoserLeLien: "premier-commentaire", consigneLien: "C" }] })).toEqual({ texte: "T", premierCommentaire: "L", consigneLien: CONSIGNE_FIL_FACEBOOK });
  });

  it("boucle complète sans formats : rien de neuf dans la livraison (pas de fil, pas de format)", async () => {
    const carte = carteFixe("C");
    const o = outilsSimules(carte, monde());
    let e = etatInitialIV(demandeEssai(carte, { reseaux: ["linkedin", "facebook"] }));
    for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
      e = await avancerJusquAArretIV(e, o);
      if (attendWillIV(e) === "carte") e = validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-16T08:00:00.000Z" });
      else if (attendWillIV(e) === "script") e = validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) });
    }
    expect(e.etape).toBe("prete");
    for (const l of e.livraison ?? []) {
      expect(l).not.toHaveProperty("fichierCleFil");
      expect(l).not.toHaveProperty("format");
    }
  });
});
