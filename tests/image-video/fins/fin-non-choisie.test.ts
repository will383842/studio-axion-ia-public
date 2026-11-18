/**
 * 17/11/2026 (D4) · Image → vidéo : sans choix de l'utilisateur, aucune fin ajoutée (accroche, « Réservez un appel… »,
 * phrase du lien). Cas a à h de CONCEPTION-IV-FIN-NON-CHOISIE.md § 9.2, par le chemin réel de fabrication
 * (`validerScriptIV` → plan gardé dans l'état → `prixSuiteIV`, `segmentsVoixIV`), pas par une valeur posée à la main.
 * Déterministe, aucun appel payant (doubles de `doubles-fabrication.ts`).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { controlerVersionIV } from "@/moteurs/montage-image-video/controles";
import { mettreEnSceneIV } from "@/moteurs/montage-image-video/mise-en-scene";
import { RESEAUX_IV } from "@/domaine/image-video/plafonds";
import { liensSuivisIV, planDesFinsIV } from "@/moteurs/montage-image-video/fins";
import { appelDeLaBanque } from "@/moteurs/montage-image-video/emprunts";
import {
  attendWillIV,
  avancerJusquAArretIV,
  etatInitialIV,
  lignesDesVersionsIV,
  prixSuiteIV,
  validerCarteIV,
  validerScriptIV,
  type EtatFabricationIV,
} from "@/moteurs/montage-image-video/fabrication";
import { textesDePublicationIV } from "@/moteurs/montage-image-video/publication";
import { FIN_AUCUNE_IV, texteDeFinIV } from "@/moteurs/montage-image-video/texte-fin";
import { segmentsVoixIV } from "@/moteurs/montage-image-video/voix";
import { FIN_AUCUNE_CHOISIE } from "@/moteurs/montage-tableau/relecture";
import { carteFixe, demandeEssai, monde, outilsSimules } from "../doubles-fabrication";

/** Enregistre ce que la porte de contrôle envoie à `controlerVersionIV` (chemin réel), pour rejouer les gardes sur une version modifiée. */
const vu = vi.hoisted(() => ({ appels: [] as unknown[][] }));
vi.mock("@/moteurs/montage-image-video/controles", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/moteurs/montage-image-video/controles")>();
  return { ...vrai, controlerVersionIV: (...a: Parameters<typeof vrai.controlerVersionIV>) => (vu.appels.push(a), vrai.controlerVersionIV(...a)) };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/image-video" }));
vi.setConfig({ testTimeout: 120_000 });

const base = { reseaux: RESEAUX_IV, offre: "integration" as const, numeroVersion: 1 };
const PHRASES_BANQUE = ["Réservez un appel", "Le lien est", "automatiser, mais pas par où"];

async function auScript(plus: Parameters<typeof demandeEssai>[1] = {}) {
  const carte = carteFixe("C");
  const o = outilsSimules(carte, monde());
  let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { plafondCentimes: 5000, ...plus })), o);
  if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-11-17T08:00:00.000Z" }), o);
  expect(attendWillIV(e)).toBe("script");
  return e;
}
const valide = (e: EtatFabricationIV) =>
  validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) });

describe("(a) plan sans fin choisie", () => {
  it("avec finVide : fins vides, rien de la banque dit ou écrit, un seul regroupement ; sans le drapeau : fin tirée comme avant", () => {
    const p = planDesFinsIV({ ...base, finVide: true });
    expect(p.sansFin).toEqual([]);
    expect(p.fins).toHaveLength(1);
    expect(p.fins[0].reseaux.sort()).toEqual([...RESEAUX_IV].sort());
    for (const f of p.fins) {
      expect(f).toMatchObject({ vide: true, muet: false, appels: [] });
      expect(f.question).toBeUndefined();
      expect(texteDeFinIV(f)).toBe("");
      for (const mot of PHRASES_BANQUE) expect(JSON.stringify(f)).not.toContain(mot);
    }
    const avant = planDesFinsIV(base);
    expect(avant.fins.every((f) => !f.vide && f.appels.length === 3)).toBe(true);
    expect(planDesFinsIV({ ...base })).toEqual(avant);
  });
});

describe("(b) fin au mot complète", () => {
  it("identique mot pour mot avec ou sans le drapeau, sans `vide` (la comparaison a bien lieu : une fin au mot validée existe)", () => {
    const d = { ...base, mot: "AUDIT", motSur: ["facebook", "instagram"] as const, cadeauReel: true };
    const sans = planDesFinsIV({ ...d, motSur: [...d.motSur] });
    const avec = planDesFinsIV({ ...d, motSur: [...d.motSur], finVide: true });
    const auMot = (p: typeof sans, r: string) => p.fins.find((x) => x.reseaux.includes(r as never))!;
    // Garde contre un test creux : la fin au mot est bien posée sur Facebook et Instagram (aucune sortie sans comparer).
    for (const r of ["facebook", "instagram"]) expect(auMot(sans, r).appels.some((a) => a.id.includes("mot"))).toBe(true);
    for (const r of ["facebook", "instagram"]) {
      expect(auMot(avec, r).appels).toEqual(auMot(sans, r).appels);
      expect(auMot(avec, r).vide).toBeUndefined();
    }
    // Les réseaux sans fin au mot reçoivent, eux, la fin vide.
    for (const r of ["youtube-shorts", "linkedin"]) expect(auMot(avec, r)).toMatchObject({ vide: true, appels: [] });
  });
});

describe("(c)(h) fabrication réelle : plan gardé, voix, prix", () => {
  it("le script validé garde un plan à fins vides ; aucune voix de fin ; prix ≤ avant, plafond et engagé égaux", async () => {
    const e = await auScript();
    const apres = await valide(e);
    expect(apres.plan!.fins.length).toBeGreaterThan(0);
    expect(apres.plan!.fins.every((f) => f.vide === true && f.appels.length === 0)).toBe(true);
    const seg = segmentsVoixIV(apres.script!.fiche, apres.plan!);
    expect(seg.fins).toEqual([]);

    const planAvant = planDesFinsIV({ reseaux: e.demande.reseaux, offre: e.carte!.carte.offre, appelCommentaire: e.demande.appelCommentaire });
    expect(planAvant.fins.some((f) => f.appels.length > 0)).toBe(true);
    const tarif = 0.05;
    const pAvant = prixSuiteIV(apres, apres.script!.fiche, planAvant, tarif);
    const pApres = prixSuiteIV(apres, apres.script!.fiche, apres.plan!, tarif);
    expect(pApres.habituelCentimes).toBeLessThanOrEqual(pAvant.habituelCentimes);
    expect(pApres.auPlusCentimes).toBeLessThanOrEqual(pAvant.auPlusCentimes);
    expect(pApres.plafondCentimes).toBe(pAvant.plafondCentimes);
    expect(pApres.engageCentimes).toBe(pAvant.engageCentimes);
  });
});

describe("(g) publication", () => {
  it("un texte par réseau, haut seul, aucun lien ni phrase « rdv-texte » pour LinkedIn", () => {
    const plan = planDesFinsIV({ ...base, finVide: true });
    const contenu = { accroche: "Vos clients écrivent à 23 h 14 et personne ne répond.", resultat: "Réponse en 4 secondes, 24 h/24." };
    const pub = textesDePublicationIV(contenu, plan, liensSuivisIV(RESEAUX_IV, 42));
    expect(pub.manquements).toEqual([]);
    expect(pub.textes.map((t) => t.reseau).sort()).toEqual([...RESEAUX_IV].sort());
    const rdv = appelDeLaBanque("fin-li-rdv-texte")?.legende;
    for (const t of pub.textes) {
      expect(t.ouPoserLeLien).toBe("aucun");
      expect(t.premierCommentaire).toBeUndefined();
      expect(t.texte).toContain("Réponse en 4 secondes");
      if (rdv) expect(t.texte).not.toContain(rdv);
    }
  });
});

describe("(e) écran", () => {
  it("la phrase est celle du Tableau", () => {
    expect(FIN_AUCUNE_IV).toBe(FIN_AUCUNE_CHOISIE);
    expect(FIN_AUCUNE_IV).toContain("Fin : aucune (votre choix)");
  });
  it("les deux écrans du script la montrent, avec ou sans question", async () => {
    const e = await auScript();
    const { ScriptEcrans } = await import("@/components/formats/image-video/ScriptEcrans");
    const { ScriptRelireIV } = await import("@/components/formats/image-video/ScriptRelireIV");
    const p = e.propositionScript!;
    const texte = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
    for (const Ecran of [ScriptEcrans, ScriptRelireIV]) {
      for (const avecQuestion of [false, true]) {
        const html = renderToStaticMarkup(createElement(Ecran, { videoId: "v-1", fiche: p.fiche, formules: p.formules, aTrancher: [], prix: p.prix, avecQuestion }));
        expect(texte(html)).toContain(FIN_AUCUNE_IV);
      }
    }
  });
});

describe("(d) contrôles par le chemin réel", () => {
  it("la vidéo fabriquée sans fin passe tous les contrôles : prête, verdict ok, aucune remarque « fin »", async () => {
    const e = await auScript();
    const o = outilsSimules(carteFixe("C"), monde());
    let etat = await avancerJusquAArretIV(valide(e), o);
    for (let i = 0; i < 20 && etat.etape !== "prete" && etat.etape !== "refusee" && etat.attente; i++) etat = await avancerJusquAArretIV(etat, o);
    expect(etat.refus).toBeUndefined();
    expect(etat.etape).toBe("prete");
    expect(etat.controles?.verdict?.ok).toBe(true);
    expect(etat.voix!.segments.fins).toEqual([]);
    expect(JSON.stringify(etat.controles)).not.toMatch(/la fin de .* ne dit rien|aucune fin pour/);
    // Aucune fin de la banque n'est entrée dans les versions fabriquées.
    for (const mot of PHRASES_BANQUE) expect(JSON.stringify(etat.pistes)).not.toContain(mot);
  });
});

describe("(f) question-puis-fin + fin vide", () => {
  it("la fin porte la question seule, sans appel", () => {
    const q = "Et chez vous, combien de messages attendent jusqu'au lendemain ?";
    const p = planDesFinsIV({ ...base, finVide: true, appelCommentaire: "question-puis-fin", questionCommentaire: q });
    for (const f of p.fins) {
      expect(f.appels).toEqual([]);
      expect(f.muet).toBe(false);
      expect(f.vide).toBe(true);
      expect(texteDeFinIV(f)).toBe(q);
    }
  });
});

async function jusquAPrete(plus: Parameters<typeof demandeEssai>[1] = {}) {
  const e = await auScript(plus);
  const propositionScript = e.propositionScript!;
  const o = outilsSimules(carteFixe("C"), monde());
  let etat = await avancerJusquAArretIV(valide(e), o);
  for (let i = 0; i < 20 && etat.etape !== "prete" && etat.etape !== "refusee"; i++) etat = await avancerJusquAArretIV(etat, o);
  expect(etat.etape).toBe("prete");
  return Object.assign(etat, { propositionAvantValidation: propositionScript });
}
const norme = (t: string) => t.replace(/\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();

describe("(f) question-puis-fin par le chemin réel : ce que la vidéo écrit de la fin = ce que l'écran de validation montre", () => {
  it("la question choisie est écrite, aucune ligne d'écran de la banque (« Votre réponse en commentaire »), rien hors question", async () => {
    const etat = await jusquAPrete({ appelCommentaire: "question-puis-fin" });
    const q = etat.script!.fiche.questionCommentaire;
    expect(etat.plan!.fins).toHaveLength(1);
    expect(etat.plan!.fins[0]).toMatchObject({ vide: true, appels: [], question: { dit: q.texteDit, ecran: "", origine: "image" } });
    // Montré à l'écran de validation : la question dite (champ) et son texte d'écran (ligne « Écrit à l'écran avec la question »).
    const montres = [norme(q.texteDit), norme(q.texteEcran)];
    const { ScriptEcrans } = await import("@/components/formats/image-video/ScriptEcrans");
    const p = etat.propositionAvantValidation;
    const html = renderToStaticMarkup(createElement(ScriptEcrans, { videoId: "v-1", fiche: etat.script!.fiche, formules: p.formules, aTrancher: [], prix: p.prix, avecQuestion: true }));
    expect(html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ")).toContain(q.texteEcran);
    const versions = lignesDesVersionsIV(etat);
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) {
      const ecrits = (v.ligne.evenements as { ecran?: string; texte?: string }[]).filter((x) => /^f\d/.test(x.ecran ?? "") && x.texte).map((x) => norme(x.texte!));
      expect(ecrits.length).toBeGreaterThan(0);
      // Chaque texte écrit de la fin est (un morceau de) ce qui est montré à l'écran de validation.
      for (const t of ecrits) expect(montres.some((m) => m.includes(t))).toBe(true);
      for (const mot of [...PHRASES_BANQUE, "votre réponse en commentaire"]) expect(ecrits.join(" | ")).not.toContain(norme(mot));
    }
  });
});

describe("(d bis) gardes rejouées sur le chemin réel de la porte", () => {
  it("fin vide : aucune remarque « fin » ; fin muette visant Instagram : toujours refusée ; fin non vide sans phrase : remarque", async () => {
    vu.appels.length = 0;
    const etat = await jusquAPrete();
    expect(vu.appels.length).toBeGreaterThan(0);
    const [v, ctx, m] = vu.appels[0] as Parameters<typeof controlerVersionIV>;
    const q08 = (x: typeof v) => controlerVersionIV(x, ctx, m).find((l) => l.code === "Q08bis")!;
    expect(v.fin).toMatchObject({ vide: true, muet: false });
    expect(q08(v).details.join(" ")).not.toMatch(/fin/);
    // Garde de scène : une fin `muet` sur une version qui vise Instagram reste refusée (non affaiblie).
    const cherche = (fin: typeof v.scene.fin) => mettreEnSceneIV({ ...v.scene, reseaux: ["instagram"], fin }).rapport.lignes.find((x) => x.code === "FIN")!;
    expect(cherche(v.scene.fin).details.join(" ")).not.toMatch(/sans fin vise/);
    expect(cherche(null).details.join(" ")).toMatch(/une version sans fin vise instagram/);
    // Une fin non vide qui ne dit rien (ni question ni appel) n'est jamais une fin voulue : remarque non bloquante.
    const aMoitie = { ...v, fin: { ...v.fin!, vide: undefined } } as typeof v;
    const l = q08(aMoitie);
    expect(l.details.join(" ")).toMatch(/ne dit rien et n'est pas une fin vide voulue/);
    expect(l.bloquant).toBe(false);
  });
});
