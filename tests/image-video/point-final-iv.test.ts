/**
 * GV2-29 · Point final du texte LU (Image → vidéo). Le texte lu reçoit « . » avant la fin ajoutée seulement pour un état de voix
 * NEUF (« voix-iv/3 ») ; un état « voix-iv/2 » déjà payé garde exactement son texte (aucune relecture). Aucun appel payant.
 */
import { describe, expect, it } from "vitest";
import { motsDits, type FicheImage } from "@/domaine/image-video/fiche";
import { avecPointFinal, etatInitialVoixIV, segmentsVoixIV } from "@/moteurs/montage-image-video/voix";

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
