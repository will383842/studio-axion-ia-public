/**
 * Le socle de Will (charte, style, preuves, ton de la v4 : le générateur du studio) part avec l'écriture du cas concret
 * (demande de Will du 14/10, accord de la session du socle) ; jamais bloquant ; compté dans le prix.
 */
import { describe, expect, it } from "vitest";
import { estimerDepuisCas } from "@/moteurs/montage-cas-concret";
import { contexteDuSocle, ecrireFiche, PRIORITE_REGLES_CAS_CONCRET } from "@/moteurs/montage-cas-concret/ecriture";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { socleUneFois } from "@/services/cas-concret-branchements";
import { parametresGenerateur } from "@/donnees/generateur/parametres-generateur";
import type { EntreeRole } from "@/generateur/roles/types";
import type { OutilsEcriture } from "@/moteurs/montage-cas-concret/outils";

const SOCLE = { contexteAxion: "CHARTE DE WILL : jamais « Aucun gain garanti ».", styleWill: "STYLE", preuves: "PREUVES", gagnants: "TON DE LA V4" };

describe("socle de Will dans l'écriture du cas concret", () => {
  it("contexte : la charte, puis la priorité des règles du format ; le reste tel quel ; absent : rien", () => {
    const c = contexteDuSocle(SOCLE);
    expect(c.contexteAxion).toBe(`${SOCLE.contexteAxion}\n\n${PRIORITE_REGLES_CAS_CONCRET}`);
    expect(c).toMatchObject({ styleWill: "STYLE", preuves: "PREUVES", gagnants: "TON DE LA V4" });
    expect(contexteDuSocle(undefined)).toEqual({});
  });

  it("chaque appel d'écriture reçoit le socle ; un socle illisible n'empêche pas d'écrire", async () => {
    const cas = trouverCas("rappels-rendez-vous")!;
    const vus: EntreeRole["contexte"][] = [];
    const outils = (socle: OutilsEcriture["socle"]): OutilsEcriture => ({
      appeler: async (role, entree) => {
        vus.push(entree.contexte);
        return { ok: true, simule: true, donnees: role.simuler?.(entree) } as never;
      },
      budget: { reserver: async () => ({ ok: true }) },
      ...(socle ? { socle } : {}),
    });
    const entree = { videoId: "v", versionId: "v1", habillage: "charte-duo/1", origine: "A" as const, cas, controle: { motsInterdits: [] } };
    await ecrireFiche(entree as never, outils(async () => SOCLE));
    expect(vus.at(-1)?.contexteAxion).toContain("CHARTE DE WILL");
    await ecrireFiche(entree as never, outils(socleUneFois(async () => Promise.reject(new Error("base injoignable")))));
    expect(vus.at(-1)).toEqual({});
  });

  it("le socle est compté dans le prix de l'écriture ; un cas à script validé ne paie aucune écriture", () => {
    const cas = trouverCas("rappels-rendez-vous")!;
    const sans = estimerDepuisCas(cas, ["facebook"], false);
    const avec = estimerDepuisCas(cas, ["facebook"], false, { socle: { contexteAxion: "x ".repeat(20000) } });
    const ecriture = (e: typeof sans) => e.lignes.find((l) => l.etape === "Écriture")?.total.centimes ?? 0;
    expect(ecriture(avec)).toBeGreaterThan(ecriture(sans));
    const v4 = estimerDepuisCas(trouverCas("recrutement-apporteurs")!, ["facebook"], false, { socle: { contexteAxion: "x ".repeat(20000) } });
    expect(v4.lignes.some((l) => l.etape === "Écriture")).toBe(false);
  });

  it("le générateur du studio connaît le format « cas concret » (modèles de ton)", () => {
    expect(() => parametresGenerateur("cas-concret")).not.toThrow();
  });
});

describe("socle de Will : plus aucune phrase de la v4", () => {
  it("le ton est décrit en mots ; aucune suite de 4 mots de la v4 ne part vers Claude", async () => {
    const { TON_WILL_EN_MOTS } = await import("@/services/cas-concret-socle");
    const { EXTRAITS_WILL } = await import("@/donnees/generateur/modeles-will");
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
    const sortant = norm(TON_WILL_EN_MOTS).join(" ");
    for (const e of EXTRAITS_WILL) {
      const m = norm(e.extrait);
      for (let i = 0; i + 4 <= m.length; i++) expect(sortant).not.toContain(m.slice(i, i + 4).join(" "));
    }
  });

  it("les exemples d'écrans à chiffre ne reprennent pas la v4", async () => {
    const { EXEMPLES_ECRANS_A_CHIFFRE } = await import("@/moteurs/montage-cas-concret/ecriture");
    const texte = JSON.stringify(EXEMPLES_ECRANS_A_CHIFFRE).toLowerCase();
    expect(texte).not.toContain("heures gagnées");
    expect(texte).not.toContain("visio dure");
  });

  it("les lignes de style et de preuves qui reprennent la v4 sont retirées, les autres gardées", async () => {
    const { sansPhrasesV4 } = await import("@/services/cas-concret-socle");
    const bloc = ["Votre équipe répond aux demandes en dix minutes. Oui, dix minutes.", "Le rappel part la veille, sans intervention."].join("\n");
    expect(sansPhrasesV4(bloc)).toBe("Le rappel part la veille, sans intervention.");
    expect(sansPhrasesV4(undefined)).toBeUndefined();
  });

  it("un garde-fou qui cite la v4 pour l'interdire, et les balises, sont gardés", async () => {
    const { sansPhrasesV4 } = await import("@/services/cas-concret-socle");
    const bloc = ["<texte_will>", "Interdit : « Alors nous avons simplifié »", "Alors nous avons simplifié.", "</texte_will>"].join("\n");
    expect(sansPhrasesV4(bloc)).toBe(["<texte_will>", "Interdit : « Alors nous avons simplifié »", "</texte_will>"].join("\n"));
  });

  it("les textes de Will et les preuves écrits sur une seule ligne balisée sont nettoyés ; un carnet avec « jamais » aussi", async () => {
    const { sansPhrasesV4 } = await import("@/services/cas-concret-socle");
    const bloc = [
      '<texte_will id="x">Alors nous avons simplifié.</texte_will>',
      '<preuve id="p">Votre équipe répond aux demandes en dix minutes.</preuve>',
      '<preuve id="q">Le rappel part la veille.</preuve>',
      "Carnet de voix : Jamais seul · Alors nous avons simplifié.",
    ].join("\n");
    expect(sansPhrasesV4(bloc)).toBe('<preuve id="q">Le rappel part la veille.</preuve>');
  });

  it("une preuve qui dit la v4 entre « » puis cite un interdit est retirée ; un « Jamais « … » » est gardé", async () => {
    const { sansPhrasesV4 } = await import("@/services/cas-concret-socle");
    const preuve = '<preuve id="r">Recrutement | se dit : « Votre équipe répond aux demandes en dix minutes » | ne jamais dire : « 100 % »</preuve>';
    const interdit = "- Jamais « Alors nous avons simplifié » ailleurs.";
    expect(sansPhrasesV4([preuve, interdit].join("\n"))).toBe(interdit);
  });

  it("le cas rappels-rendez-vous reçoit, par le vrai branchement, le ton en mots et aucune phrase de la v4", async () => {
    const cas = trouverCas("rappels-rendez-vous")!;
    const { TON_WILL_EN_MOTS } = await import("@/services/cas-concret-socle");
    const { EXTRAITS_WILL } = await import("@/donnees/generateur/modeles-will");
    const vus: EntreeRole["contexte"][] = [];
    const outils: OutilsEcriture = {
      appeler: async (role, entree) => {
        vus.push(entree.contexte);
        return { ok: true, simule: true, donnees: role.simuler?.(entree) } as never;
      },
      budget: { reserver: async () => ({ ok: true }) },
      socle: socleUneFois(),
    };
    const entree = { videoId: "v", versionId: "v1", habillage: "charte-duo/1", origine: "A" as const, cas, controle: { motsInterdits: [] } };
    await ecrireFiche(entree as never, outils);
    const envoye = vus.at(-1) ?? {};
    expect(envoye.gagnants).toBe(TON_WILL_EN_MOTS);
    const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
    const tout = norm(Object.values(envoye).join(" ")).join(" ");
    for (const e of EXTRAITS_WILL) {
      const m = norm(e.extrait);
      for (let i = 0; i + 4 <= m.length; i++) expect(tout).not.toContain(m.slice(i, i + 4).join(" "));
    }
  });
});
