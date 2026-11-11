/**
 * L3-07 : rôle « publication » des carrousels et infographies. Simulation seulement : aucun appel, aucune clé.
 * Critères : texte sous la longueur max ; mots-dièse dans les bornes ; aucun chiffre absent des pages ;
 * deux sorties invalides = repli déterministe journalisé.
 */
import { describe, expect, it } from "vitest";
import { evaluerPublicationVisuel, entreePublicationVisuel, rolePublicationVisuel, simulerPublicationVisuel, type DonneesPublicationVisuel, type SortiePublicationVisuel } from "@/generateur/roles/publication-visuel";
import { versionsRoles } from "@/generateur/roles";
import { ecrireTextePost, textePostDeterministe } from "@/services/texte-post";
import { obtenirReseau } from "@/reseaux";
import { ecritureReseau } from "@/reseaux/ecriture";
import type { IdReseau, ReseauDeclinaison } from "@/domaine/types";

const PAGES = "Relancer un devis\nTrois relances suffisent\n42 % des devis restent sans réponse\nPrévoyez un message le lendemain";
const RESEAUX: ReseauDeclinaison[] = ["linkedin", "instagram", "facebook", "tiktok", "youtube-shorts"];

const donnees = (reseau: IdReseau, o: Partial<DonneesPublicationVisuel> = {}): DonneesPublicationVisuel => ({ reseau, titre: "Relancer un devis", texteDesPages: PAGES, pages: 4, ...o });
const bonne = (o: Partial<SortiePublicationVisuel> = {}): SortiePublicationVisuel => ({ texte: "Vos devis restent sans réponse ? Trois relances suffisent.", motsDiese: ["#Devis", "#PME"], ...o });

describe("simulation : sortie valide pour chaque réseau", () => {
  for (const r of RESEAUX) {
    it(`${r} : longueur, mots-dièse et chiffres respectés`, () => {
      const d = donnees(r);
      const s = simulerPublicationVisuel(entreePublicationVisuel(d));
      expect(s.texte.length).toBeLessThanOrEqual(obtenirReseau(r).legende.longueurMax);
      const [min, max] = ecritureReseau(r as ReseauDeclinaison).motsDiese.valeur;
      expect(s.motsDiese.length).toBeGreaterThanOrEqual(min);
      expect(s.motsDiese.length).toBeLessThanOrEqual(max);
      expect(evaluerPublicationVisuel(s, d)).toEqual([]);
    });
  }
  it("LinkedIn : le document PDF porte un titre, les autres réseaux n'en demandent pas", () => {
    expect(simulerPublicationVisuel(entreePublicationVisuel(donnees("linkedin"))).titreDocument).toBeTruthy();
    expect(simulerPublicationVisuel(entreePublicationVisuel(donnees("instagram"))).titreDocument).toBeUndefined();
  });
});

describe("évaluations", () => {
  it("texte trop long : refusé", () => {
    const d = donnees("tiktok");
    expect(evaluerPublicationVisuel(bonne({ texte: "x".repeat(obtenirReseau("tiktok").legende.longueurMax + 1) }), d).join(" ")).toContain("PV-01");
  });
  it("mots-dièse hors bornes : refusé", () => {
    expect(evaluerPublicationVisuel(bonne({ motsDiese: Array.from({ length: 31 }, (_, i) => `#Mot${i}`) }), donnees("instagram")).join(" ")).toContain("PV-02");
    expect(evaluerPublicationVisuel(bonne({ motsDiese: ["#fyp"] }), donnees("instagram")).join(" ")).toContain("PV-02");
  });
  it("chiffre absent des pages : refusé ; chiffre des pages : accepté", () => {
    const d = donnees("instagram");
    expect(evaluerPublicationVisuel(bonne({ texte: "87 % de réponses en plus." }), d).join(" ")).toContain("PV-03");
    expect(evaluerPublicationVisuel(bonne({ texte: "42 % des devis restent sans réponse." }), d)).toEqual([]);
  });
  it("tutoiement du texte généré : refusé (charte)", () => {
    expect(evaluerPublicationVisuel(bonne({ texte: "Voici ce que tu peux faire dès demain." }), donnees("instagram")).join(" ")).toContain("PV-04");
  });
  it("LinkedIn sans titre de document : refusé ; titre trop long : refusé", () => {
    expect(evaluerPublicationVisuel(bonne(), donnees("linkedin")).join(" ")).toContain("PV-05");
    expect(evaluerPublicationVisuel(bonne({ titreDocument: "t".repeat(101) }), donnees("linkedin")).join(" ")).toContain("PV-05");
    expect(evaluerPublicationVisuel(bonne({ titreDocument: "Relancer un devis" }), donnees("linkedin"))).toEqual([]);
  });
});

describe("rôle et registre", () => {
  it("le rôle est versionné et déclaré dans le registre", () => {
    expect(rolePublicationVisuel.id).toBe("publication-visuel");
    expect(versionsRoles()["publication-visuel"]).toBe(rolePublicationVisuel.version);
  });
  it("la consigne ne nomme aucun montant", () => {
    expect(rolePublicationVisuel.consigne).not.toMatch(/€|\$|euro/i);
  });
});

describe("service texte-post : 2 essais au plus, repli déterministe journalisé", () => {
  it("première sortie valide : un seul essai, source « claude »", async () => {
    const appels: number[] = [];
    const r = await ecrireTextePost(donnees("instagram"), { appeler: async () => { appels.push(1); return bonne({ texte: "42 % des devis restent sans réponse." }); }, journaliser: () => {} });
    expect(appels.length).toBe(1);
    expect(r.source).toBe("claude");
  });
  it("première sortie invalide, seconde valide : 2 essais, corrections transmises", async () => {
    const vus: (string[] | undefined)[] = [];
    const sorties = [bonne({ texte: "87 % de plus." }), bonne({ texte: "42 % des devis restent sans réponse." })];
    const r = await ecrireTextePost(donnees("instagram"), { appeler: async (_d, corrections) => { vus.push(corrections); return sorties.shift()!; }, journaliser: () => {} });
    expect(vus.length).toBe(2);
    expect(vus[0]).toBeUndefined();
    expect(vus[1]?.length).toBeGreaterThan(0);
    expect(r.source).toBe("claude");
  });
  it("deux sorties invalides : repli déterministe, valide, journalisé, jamais plus de 2 appels", async () => {
    const journal: string[] = [];
    let n = 0;
    const d = donnees("linkedin");
    const r = await ecrireTextePost(d, { appeler: async () => { n++; return bonne({ texte: "99 % de succès." }); }, journaliser: (m) => journal.push(m) });
    expect(n).toBe(2);
    expect(r.source).toBe("repli");
    expect(journal.join(" ")).toMatch(/repli/i);
    expect(evaluerPublicationVisuel({ texte: r.texte, motsDiese: r.motsDiese, titreDocument: r.titreDocument }, d)).toEqual([]);
  });
  it("appel en échec (crédit, quota) : repli journalisé sans nouvel essai", async () => {
    const journal: string[] = [];
    let n = 0;
    const r = await ecrireTextePost(donnees("facebook"), { appeler: async () => { n++; return null; }, journaliser: (m) => journal.push(m) });
    expect(n).toBe(1);
    expect(r.source).toBe("repli");
    expect(journal.length).toBe(1);
  });
  it("sans appeleur (simulation) : texte déterministe", async () => {
    const r = await ecrireTextePost(donnees("tiktok"), { journaliser: () => {} });
    expect(r.source).toBe("repli");
    expect(r.texte).toBe(textePostDeterministe(donnees("tiktok")).texte);
  });
});
