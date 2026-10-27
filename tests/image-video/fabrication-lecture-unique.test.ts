/**
 * Lecture unique de la voix (20/10) · la fabrication bout en bout, en simulation (`doubles-fabrication.ts`) : une seule
 * lecture HeyGen et une seule réservation pour toute la vidéo, un état « voix-iv/1 » repris sans AUCUNE relecture payée,
 * prix « au plus » sans terme pour les fins, aucun secours pour une voix lue d'un trait.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CarteImage } from "@/domaine/image-video/carte";
import { motsDits } from "@/domaine/image-video/fiche";
import {
  attendWillIV,
  avancerJusquAArretIV,
  etatInitialIV,
  prixSuiteIV,
  rouvrirScriptIV,
  validerCarteIV,
  validerScriptIV,
  type DecisionCarteIV,
  type DecisionScriptIV,
  type EtatFabricationIV,
  type OutilsFabricationIV,
} from "@/moteurs/montage-image-video/fabrication";
import { planDeSecoursIV } from "@/moteurs/montage-image-video/secours";
import { avancerVoixIV, etatInitialVoixIV, segmentsVoixIV, type EtatVoixIV, type OutilsVoixIV } from "@/moteurs/montage-image-video/voix";
import { carteFixe, demandeEssai, monde, outilsSimules, TARIF_SIMULE } from "./doubles-fabrication";

/** Le drapeau `LECTURE_UNIQUE_IV` peut être remis à `false` pour décrire une voix payée en segments séparés (« voix-iv/1 »). */
const reglageVoix = vi.hoisted(() => ({ lectureUnique: true }));
vi.mock("@/moteurs/montage-image-video/voix", async (importOriginal) => {
  const vrai = await importOriginal<typeof import("@/moteurs/montage-image-video/voix")>();
  return {
    ...vrai,
    get LECTURE_UNIQUE_IV() {
      return reglageVoix.lectureUnique;
    },
  };
});
afterEach(() => {
  reglageVoix.lectureUnique = true;
});

vi.setConfig({ testTimeout: 120_000 });

const decisionCarte = (e: EtatFabricationIV, carte?: CarteImage): DecisionCarteIV => ({ proposition: e.propositionCarte!.empreinte, ...(carte ? { carte } : {}), le: "2026-10-20T08:00:00.000Z" });
const decisionScript = (e: EtatFabricationIV): DecisionScriptIV => ({
  proposition: e.propositionScript!.empreinte,
  choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])),
});

/** Jusqu'à l'arrêt « script à valider » (rien de la voix n'a encore été lu). */
async function auScript(nom: "A" | "C" = "C") {
  const carte = carteFixe(nom);
  const m = monde();
  const o = outilsSimules(carte, m);
  let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte, { plafondCentimes: 5000 })), o);
  if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, decisionCarte(e)), o);
  expect(attendWillIV(e)).toBe("script");
  return { carte, m, o, e };
}

async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  let e = await avancerJusquAArretIV(e0, o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, decisionCarte(e)), o);
    else if (attendWillIV(e) === "script") e = await avancerJusquAArretIV(validerScriptIV(e, decisionScript(e)), o);
    else break;
  }
  return e;
}

const reservationsVoix = (e: EtatFabricationIV) => e.caisse.reservations.filter((r) => r.etape === "voix");

describe("lecture unique · fabrication bout en bout", () => {
  it("4 réseaux : UNE lecture HeyGen d'un trait, UNE réservation, vidéo prête et contrôlée", async () => {
    const { m, o, e } = await auScript();
    const etat = await jusquAuBout(validerScriptIV(e, decisionScript(e)), o);
    expect(etat.refus).toBeUndefined();
    expect(etat.etape).toBe("prete");
    expect(etat.controles?.verdict?.ok).toBe(true);
    expect(etat.livraison?.map((l) => l.reseau)).toEqual(["youtube-shorts", "linkedin", "instagram", "facebook"]);

    // Une seule lecture, celle du corps suivi de la partie commune puis des phrases propres.
    const voix = etat.voix!;
    expect(voix.version).toBe("voix-iv/2");
    expect(voix.segments.fins).toEqual([]);
    expect(voix.voix.fins).toEqual([]);
    expect(m.lus).toEqual([voix.segments.corps]);
    expect(voix.segments.corps.startsWith(etat.script!.fiche.ecrans.map((x) => x.texteDit).join(" "))).toBe(true);
    // Une seule réservation de voix, pour ce texte-là.
    expect(reservationsVoix(etat)).toHaveLength(1);
    expect(reservationsVoix(etat)[0].centimes).toBe(Math.ceil(voix.segments.corps.length * TARIF_SIMULE - 1e-9));
    // Chaque version a été taillée : LinkedIn muet (corps seul), les autres avec leur fin.
    const li = etat.pistes!.find((p) => p.reseaux.includes("linkedin"))!;
    expect(li.mots).toHaveLength(li.motsCorps);
    expect(li.raccordSec).toBeUndefined();
    for (const p of etat.pistes!.filter((x) => !x.reseaux.includes("linkedin"))) expect(p.mots.length).toBeGreaterThan(p.motsCorps);
    // Les mots du corps sont ceux du script, jamais ceux de la fin.
    const motsScript = etat.script!.fiche.ecrans.reduce((n, x) => n + motsDits(x.texteDit).length, 0);
    for (const p of etat.pistes!) expect(p.motsCorps).toBe(motsScript);
  });

  it("une voix payée « voix-iv/1 » est reprise telle quelle : AUCUNE lecture, aucune réservation de plus, vidéo finie à l'ancienne", async () => {
    const { m, o, e } = await auScript();
    const valide = validerScriptIV(e, decisionScript(e));
    // État d'avant le changement : la voix lue en segments séparés (corps, puis une fin par texte), payée et finie.
    const classique = segmentsVoixIV(valide.script!.fiche, valide.plan!);
    expect(classique.fins.length).toBeGreaterThan(0);
    const voixOutils: OutilsVoixIV = { ...o.voix, avantLecture: async () => {} };
    let v: EtatVoixIV = etatInitialVoixIV(classique);
    for (let i = 0; i < 50 && !v.issue; i++) v = JSON.parse(JSON.stringify(await avancerVoixIV(v, voixOutils))) as EtatVoixIV;
    expect(v.issue).toEqual({ statut: "faite" });
    expect(v.version).toBe("voix-iv/1");
    const lusAvant = m.lus.length;
    expect(lusAvant).toBe(classique.fins.length + 1);
    const payees = JSON.stringify(v.voix.payees);

    const repris: EtatFabricationIV = { ...structuredClone(valide), voix: v };
    const etat = await jusquAuBout(repris, o);
    expect(etat.refus).toBeUndefined();
    expect(etat.etape).toBe("prete");
    // LA garde d'argent : la fabrication n'a relu ni payé quoi que ce soit.
    expect(m.lus).toHaveLength(lusAvant);
    expect(reservationsVoix(etat)).toHaveLength(0);
    expect(etat.voix!.version).toBe("voix-iv/1");
    expect(etat.voix!.segments).toEqual(classique);
    expect(JSON.stringify(etat.voix!.voix.payees)).toBe(payees);
    expect(etat.voix!.segments.lecture).toBeUndefined();
  });

  it("prix « au plus » : 6 lectures du texte lu, sans terme pour les fins ; l'ancien état garde l'ancien calcul", async () => {
    const { e } = await auScript();
    const valide = validerScriptIV(e, decisionScript(e));
    const fiche = valide.script!.fiche;
    const plan = valide.plan!;
    const tarif = TARIF_SIMULE;
    const lecture = segmentsVoixIV(fiche, plan, { lectureUnique: true });
    const classique = segmentsVoixIV(fiche, plan);
    const voix = (n: number, k: number) => Math.ceil(n * k * tarif - 1e-9);

    const neuf = prixSuiteIV(valide, fiche, plan, tarif);
    const ancien = prixSuiteIV({ ...valide, voix: { version: "voix-iv/1" } as EtatVoixIV }, fiche, plan, tarif);
    const v2 = prixSuiteIV({ ...valide, voix: { version: "voix-iv/2" } as EtatVoixIV }, fiche, plan, tarif);
    expect(v2).toEqual(neuf);
    // Les contrôles (transcription, relecture) sont les mêmes ; seule la voix change.
    const controles = neuf.habituelCentimes - voix(lecture.corps.length, 1);
    expect(neuf.habituelCentimes).toBe(voix(lecture.corps.length, 1) + controles);
    expect(neuf.auPlusCentimes).toBe(voix(lecture.corps.length, 6) + (ancien.auPlusCentimes - voix(classique.corps.length, 6) - voix(classique.fins.reduce((s, f) => s + f.texte.length, 0), 4)));
    expect(ancien.habituelCentimes).toBe(voix(classique.corps.length, 1) + voix(classique.fins.reduce((s, f) => s + f.texte.length, 0), 1) + controles);
    expect(neuf.auPlusCentimes).toBeLessThan(ancien.auPlusCentimes);
  });

  it("texte lu changé après coup (question modifiée) : la relecture complète est RÉSERVÉE de nouveau, jamais payée sans réservation", async () => {
    const { o, e } = await auScript();
    const etat = await jusquAuBout(validerScriptIV(e, decisionScript(e)), o);
    expect(etat.etape).toBe("prete");
    const avant = reservationsVoix(etat);
    expect(avant).toHaveLength(1);
    const rouvert = rouvrirScriptIV(etat);
    const fiche = structuredClone(etat.script!.fiche);
    fiche.questionCommentaire.texteDit = "Et chez vous, qui répond vraiment à cette heure-là ?";
    const valide = validerScriptIV(rouvert, { ...decisionScript(rouvert), fiche });
    const fin = await jusquAuBout(valide, o);
    const apres = reservationsVoix(fin);
    expect(apres.length).toBe(2);
    expect(new Set(apres.map((r) => r.cle)).size).toBe(2);
    expect(fin.voix!.segments.corps).toContain("vraiment à cette heure-là");
  });

  for (const [nom, lectureUnique] of [
    ["lecture unique (voix-iv/2)", true],
    ["segments séparés (voix-iv/1)", false],
  ] as const) {
    it(`A → B → A, ${nom} : chaque lecture a sa PROPRE réservation, jamais une lecture sans réservation (clé déjà prise)`, async () => {
      reglageVoix.lectureUnique = lectureUnique;
      const { m, o, e } = await auScript();
      const a = await jusquAuBout(validerScriptIV(e, decisionScript(e)), o);
      expect(a.etape).toBe("prete");
      const ficheA = structuredClone(a.script!.fiche);
      const question = (texte: string) => {
        const f = structuredClone(ficheA);
        f.questionCommentaire.texteDit = texte;
        return f;
      };
      const change = async (etat: EtatFabricationIV, fiche: typeof ficheA) => {
        const r = rouvrirScriptIV(etat);
        return jusquAuBout(validerScriptIV(r, { ...decisionScript(r), fiche }), o);
      };
      const b = await change(a, question("Et chez vous, qui répond vraiment à cette heure-là ?"));
      expect(b.etape).toBe("prete");
      const retour = await change(b, ficheA);
      expect(retour.refus?.message).toBeUndefined();
      expect(retour.etape).toBe("prete");

      const res = reservationsVoix(retour);
      // Trois textes lus (A, B, A de nouveau) : trois séries de clés distinctes, aucune clé réutilisée.
      expect(new Set(res.map((r) => r.cle)).size).toBe(res.length);
      expect(res.every((r) => /iv-voix-[a-z-]+-[0-9a-f]{10}-\d+$/.test(r.cle))).toBe(true);
      // Chaque lecture HeyGen est précédée de sa réservation.
      expect(res.length).toBe(m.lus.length);
      let reserves = 0;
      let lues = 0;
      for (const x of m.ordre) {
        if (x.startsWith("réserve ")) reserves++;
        else if (x === "heygen") expect(reserves, "lecture HeyGen sans réservation").toBeGreaterThan(lues++);
      }
      expect(lues).toBe(m.lus.length);
      expect(m.lus.length).toBeGreaterThanOrEqual(3);
    });
  }

  it("aucun secours pour une voix lue d'un trait : `planDeSecoursIV` rend null", async () => {
    const { o, e } = await auScript();
    const etat = await jusquAuBout(validerScriptIV(e, decisionScript(e)), o);
    expect(etat.voix!.version).toBe("voix-iv/2");
    const arrete: Pick<EtatFabricationIV, "refus" | "voix" | "plan"> = {
      refus: { etape: "voix", code: "IV_VOIX", message: "x", reessayable: false },
      voix: etat.voix,
      plan: etat.plan,
    };
    expect(planDeSecoursIV(arrete)).toBeNull();
  });
});
