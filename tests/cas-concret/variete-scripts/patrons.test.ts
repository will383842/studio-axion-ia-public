/** Exemples de rythme et patrons tirés d'une graine : variété de forme d'une vidéo à l'autre. */
import { describe, expect, it } from "vitest";
import { sequencesDe } from "@/domaine/cas-concret-variete";
import { EXEMPLE_TON_V4 } from "@/moteurs/montage-cas-concret/ecriture";
import { EXEMPLES_DE_RYTHME, blocExemplesDeRythme } from "@/moteurs/montage-cas-concret/exemples-ton";
import { PATRONS, ROLES_PATRON, blocPatrons, patronsDeLaVideo, placeDuResteHumain } from "@/moteurs/montage-cas-concret/patrons-ecriture";

describe("exemples de rythme", () => {
  it("3 à 4 exemples, de sujets inventés, sans rien de la v4 ni les uns des autres", () => {
    expect(EXEMPLES_DE_RYTHME.length).toBeGreaterThanOrEqual(3);
    expect(EXEMPLES_DE_RYTHME.length).toBeLessThanOrEqual(4);
    const v4 = new Set(sequencesDe(EXEMPLE_TON_V4, 4));
    const vus = new Set<string>();
    for (const e of EXEMPLES_DE_RYTHME) {
      for (const c of sequencesDe(e.texte, 4)) {
        expect(v4.has(c)).toBe(false);
        expect(vus.has(c)).toBe(false);
        vus.add(c);
      }
      expect(/villeexemple|machine|aucun gain garanti/i.test(e.texte)).toBe(false);
    }
  });

  it("le bloc dit que ce sont des exemples de rythme, sans mots ni faits à reprendre", () => {
    const b = blocExemplesDeRythme();
    expect(b).toMatch(/RYTHME/);
    expect(b).toMatch(/ni leurs mots ni leurs faits/i);
    expect(b).not.toContain(EXEMPLE_TON_V4);
  });
});

describe("patrons", () => {
  it("les patrons illustrés par les exemples existent, et ne sont pas les mêmes d'un exemple à l'autre", () => {
    for (const e of EXEMPLES_DE_RYTHME) for (const r of ROLES_PATRON) expect(PATRONS[r].map((p) => p.id)).toContain(e.patrons[r]);
    expect(new Set(EXEMPLES_DE_RYTHME.map((e) => JSON.stringify(e.patrons))).size).toBe(EXEMPLES_DE_RYTHME.length);
  });

  it("chaque rôle a au moins 4 variantes distinctes, des formes à décrire et non des phrases à recopier", () => {
    for (const r of ROLES_PATRON) {
      expect(PATRONS[r].length).toBeGreaterThanOrEqual(4);
      expect(new Set(PATRONS[r].map((p) => p.id)).size).toBe(PATRONS[r].length);
    }
  });

  it("les patrons d'accroche gardent la promesse (R03)", () => {
    for (const p of PATRONS.accroche) expect(p.forme).toMatch(/promesse/i);
  });

  it("même vidéo, mêmes patrons ; un autre tirage de la même vidéo, d'autres", () => {
    expect(patronsDeLaVideo("video-1")).toEqual(patronsDeLaVideo("video-1"));
    const rejeux = new Set(Array.from({ length: 12 }, (_, sel) => JSON.stringify(patronsDeLaVideo("video-1", sel))));
    expect(rejeux.size).toBeGreaterThan(6);
  });

  it("des vidéos différentes n'ont pas la même forme", () => {
    const ids = Array.from({ length: 30 }, (_, i) => `video-${i}`);
    const formes = ids.map((i) => JSON.stringify(patronsDeLaVideo(i)));
    expect(new Set(formes).size).toBeGreaterThan(25);
    expect(formes[0]).not.toBe(formes[1]);
    // Chaque patron sert au moins une fois sur 30 vidéos.
    for (const r of ROLES_PATRON) expect(new Set(ids.map((i) => patronsDeLaVideo(i)[r].id)).size).toBe(PATRONS[r].length);
  });

  it("le bloc donné à Claude décrit chaque forme", () => {
    const p = patronsDeLaVideo("video-7");
    const b = blocPatrons(p);
    for (const r of ROLES_PATRON) expect(b).toContain(p[r].forme);
    expect(b).toMatch(/FORME|forme/);
  });

  it("la place du reste humain n'est libre que si le cas ne la fixe pas (R23)", () => {
    expect(placeDuResteHumain("video-1", 0, undefined, 5)).not.toBeNull();
    expect(placeDuResteHumain("video-1", 0, 2, 5)).toBeNull();
    const places = new Set(Array.from({ length: 30 }, (_, i) => placeDuResteHumain(`video-${i}`, 0, undefined, 5)));
    expect(places.size).toBe(3);
  });
});

describe("cas sans fait chiffré : le patron « chiffre » du résultat n'est jamais tiré", () => {
  it("200 identifiants", () => {
    for (let i = 0; i < 200; i++) {
      const p = patronsDeLaVideo(`video-${i}`, 0, undefined, undefined, { sansChiffre: true });
      expect([p.resultat.id, p.accroche.id, p.avant.id]).not.toContain("chiffre");
      expect(p.accroche.id).not.toBe("contraste");
      expect(["verbes", "question"]).not.toContain(p.avant.id);
    }
  });
});
