/**
 * GV2-29 · Point final du texte LU (Image → vidéo). Le texte lu reçoit « . » avant la fin ajoutée seulement pour un état de voix
 * NEUF (« voix-iv/3 ») ; un état « voix-iv/2 » déjà payé garde exactement son texte (aucune relecture). Aucun appel payant.
 */
import { describe, expect, it, vi } from "vitest";
import { motsDits, type FicheImage } from "@/domaine/image-video/fiche";
import { attendWillIV, avancerJusquAArretIV, etatInitialIV, lignesDesVersionsIV, validerCarteIV, validerScriptIV, type EtatFabricationIV, type OutilsFabricationIV } from "@/moteurs/montage-image-video/fabrication";
import { avancerVoixIV, avecPointFinal, etatInitialVoixIV, segmentsVoixIV, type EtatVoixIV, type OutilsVoixIV } from "@/moteurs/montage-image-video/voix";
import { carteFixe, demandeEssai, monde, outilsSimules } from "./doubles-fabrication";

/** Script dont le dernier écran finit sans ponctuation (« … Zéro demande perdue »), fin ajoutée à part. */
const fiche = { ecrans: [{ texteDit: "Vos clients écrivent, on répond." }, { texteDit: "Zéro demande perdue" }] } as unknown as FicheImage;
const fin = (id: string, reseaux: string[]) => ({ id, reseaux, muet: false, question: { dit: "Par où commencer ?", ecran: "Par où commencer ?" }, appels: [{ dit: "Faites votre diagnostic gratuit." }, { dit: "Le lien est dans mon profil." }] });
const plan = (...fins: object[]) => ({ fins }) as unknown as Parameters<typeof segmentsVoixIV>[1];
const LINKEDIN = { id: "fin-linkedin", reseaux: ["linkedin"], muet: true, appels: [] };

describe("avecPointFinal", () => {
  it("ajoute « . » seulement quand il manque", () => {
    expect(avecPointFinal("Zéro demande perdue")).toBe("Zéro demande perdue.");
    for (const t of ["Fini.", "Fini !", "Fini ?", "Fini…", "Il dit « fini. »", "Il dit « fini ? »", "Il dit \"fini.\""]) expect(avecPointFinal(t)).toBe(t);
  });
});

describe("point final avant la fin ajoutée", () => {
  const reseaux = plan(fin("fin-tiktok", ["tiktok"]));
  const sans = segmentsVoixIV(fiche, reseaux, { lectureUnique: true });
  const avec = segmentsVoixIV(fiche, reseaux, { lectureUnique: true, pointFinal: true });

  it("sans l'option : texte d'avant, enchaîné (« perdue Par où »)", () => {
    expect(sans.corps).toContain("perdue Par où");
    expect(sans.corps).not.toContain("perdue.");
    expect(sans.pointFinal).toBeUndefined();
    expect(etatInitialVoixIV(sans).version).toBe("voix-iv/2");
  });

  it("avec l'option : « perdue. » avant la fin, même nombre de mots, état « voix-iv/3 »", () => {
    expect(avec.corps).toContain("perdue. Par où");
    expect(motsDits(avec.corps).length).toBe(motsDits(sans.corps).length);
    expect(avec.lecture).toEqual(sans.lecture);
    expect(etatInitialVoixIV(avec).version).toBe("voix-iv/3");
  });

  it("un corps déjà ponctué ne change pas, même avec l'option", () => {
    const ponctuee: FicheImage = { ...fiche, ecrans: fiche.ecrans.map((e, i, t) => (i === t.length - 1 ? { ...e, texteDit: `${e.texteDit}.` } : e)) };
    expect(segmentsVoixIV(ponctuee, reseaux, { lectureUnique: true, pointFinal: true }).corps).toBe(segmentsVoixIV(ponctuee, reseaux, { lectureUnique: true }).corps);
  });

  it("LinkedIn seul (rien après la phrase-choc) : le texte lu finit par un point avec l'option", () => {
    const li = segmentsVoixIV(fiche, plan(LINKEDIN), { lectureUnique: true, pointFinal: true });
    expect(li.corps.endsWith("perdue.")).toBe(true);
  });

  it("lecture en segments séparés : corps et fins reçoivent le point, nombre de mots identique", () => {
    const a = segmentsVoixIV(fiche, reseaux);
    const b = segmentsVoixIV(fiche, reseaux, { pointFinal: true });
    expect(b.corps.endsWith("perdue.")).toBe(true);
    expect(motsDits(b.corps).length).toBe(motsDits(a.corps).length);
    for (const f of b.fins) expect(/[.!?…]["»”)]*$/u.test(f.texte)).toBe(true);
  });
});

/* Fabrication : le point final n'est posé que pour un état de voix NEUF (« voix-iv/3 »), jamais sur un « voix-iv/2 » payé. */
vi.setConfig({ testTimeout: 120_000 });

async function jusquAuBout(e0: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  let e = await avancerJusquAArretIV(e0, o);
  for (let i = 0; i < 20 && e.etape !== "prete" && e.etape !== "refusee"; i++) {
    if (e.attente) e = await avancerJusquAArretIV(e, o);
    else break;
  }
  return e;
}

/** Script validé dont le dernier écran finit sans ponctuation (« … perdue »). */
async function scriptSansPoint() {
  const carte = carteFixe("C");
  const m = monde();
  const o = outilsSimules(carte, m);
  let e = await avancerJusquAArretIV(etatInitialIV(demandeEssai(carte)), o);
  if (attendWillIV(e) === "carte") e = await avancerJusquAArretIV(validerCarteIV(e, { proposition: e.propositionCarte!.empreinte, le: "2026-10-20T08:00:00.000Z" }), o);
  const valide = validerScriptIV(e, { proposition: e.propositionScript!.empreinte, choixFormules: Object.fromEntries(e.propositionScript!.formules.map((f) => [f.cle, "garder" as const])) });
  const ecrans = valide.script!.fiche.ecrans;
  ecrans[ecrans.length - 1] = { ...ecrans[ecrans.length - 1], texteDit: ecrans[ecrans.length - 1].texteDit.replace(/[.!?…\s]+$/u, "") };
  return { m, o, valide };
}

describe("fabrication : point final seulement pour un état neuf", () => {
  it("vidéo neuve : état « voix-iv/3 », le texte lu porte le point final, sous-titres écrits comme le script", async () => {
    const { m, o, valide } = await scriptSansPoint();
    const sans = segmentsVoixIV(valide.script!.fiche, valide.plan!, { lectureUnique: true });
    const avec = segmentsVoixIV(valide.script!.fiche, valide.plan!, { lectureUnique: true, pointFinal: true });
    expect(avec.corps).not.toBe(sans.corps);
    const etat = await jusquAuBout(valide, o);
    expect(etat.voix!.version).toBe("voix-iv/3");
    expect(etat.voix!.segments.corps).toBe(avec.corps);
    expect(m.lus).toEqual([avec.corps]);
  });

  it("voix « voix-iv/2 » déjà payée : texte d'avant, AUCUNE lecture ni réservation de voix, ligne de temps d'avant", async () => {
    const { m, o, valide } = await scriptSansPoint();
    const ancien = segmentsVoixIV(valide.script!.fiche, valide.plan!, { lectureUnique: true });
    let v: EtatVoixIV = etatInitialVoixIV(ancien);
    const voixOutils: OutilsVoixIV = { ...o.voix, avantLecture: async () => {} };
    for (let i = 0; i < 50 && !v.issue; i++) v = JSON.parse(JSON.stringify(await avancerVoixIV(v, voixOutils))) as EtatVoixIV;
    expect(v.version).toBe("voix-iv/2");
    const lusAvant = m.lus.length;
    const etat = await jusquAuBout({ ...structuredClone(valide), voix: v }, o);
    expect(m.lus).toHaveLength(lusAvant);
    expect(etat.caisse.reservations.filter((r) => r.etape === "voix")).toHaveLength(0);
    expect(etat.voix!.version).toBe("voix-iv/2");
    expect(etat.voix!.segments).toEqual(ancien);
    // Mise en scène d'une vidéo existante : sous-titres des mots de la voix, clôture d'avant (mêmes clés de rendu).
    for (const l of lignesDesVersionsIV(etat)) {
      const cloture = l.ligne.bruitages.find((b) => b.planId === "cloture");
      if (cloture) expect(cloture.debutSec).toBeCloseTo(l.ligne.dureeSec - 1.5, 2);
    }
  });
});
