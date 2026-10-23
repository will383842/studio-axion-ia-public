/** Harmonisation H1 : adaptateurs purs du tableau animé (récents, suivi de tâche) et enveloppe des brouillons. */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BrouillonsRecentsTableau } from "@/components/formats/tableau-anime/BrouillonsRecents";
import { versRecentsTableau, versSuiviFabricationTableau, versSuiviTacheTableau } from "@/components/formats/tableau-anime/vues-gabarit";
import type { TravailTableauLu } from "@/components/formats/tableau-anime/EtapesTableau";
import type { VueTacheTableau } from "@/services/tableau-taches";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined, push: () => undefined }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

const { EtapesTableau } = await import("@/components/formats/tableau-anime/EtapesTableau");
const lire = (c: string) => readFileSync(c, "utf8");
const texte = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();

const tache = (p: Partial<VueTacheTableau>): VueTacheTableau => ({ id: "t", type: "ecriture", statut: "en-cours", etape: "ecriture", phrase: "J'écris le script…", appels: 1, coutUsd: 0, depuis: "", majLe: "", motifs: [], boucleArretee: false, ...p });

describe("versRecentsTableau", () => {
  it("brouillon → récent : lien de reprise, état, date, titre « Vos brouillons »", () => {
    const r = versRecentsTableau([{ videoId: "v 1", titre: "Mon script", etat: "Script écrit", date: "2026-10-18T14:05:00" }]);
    expect(r).toEqual([{ id: "v 1", href: "/tableau/nouvelle?brouillon=v%201", titre: "Mon script", etat: "Script écrit", date: "2026-10-18T14:05:00" }]);
  });
});

describe("versSuiviTacheTableau", () => {
  it("écriture en cours : trois étapes, la bonne en cours, la phrase n'est pas un message d'erreur", () => {
    const v = versSuiviTacheTableau(tache({ etape: "ecriture" }));
    expect(v.etat).toBe("en-cours");
    expect(v.etapes.map((e) => e.etat)).toEqual(["faite", "en-cours", "a-venir"]);
    expect(v.message).toBeUndefined();
  });

  it("découpage : une seule étape", () => {
    const v = versSuiviTacheTableau(tache({ type: "decoupage", etape: "decoupage" }));
    expect(v.etapes).toHaveLength(1);
    expect(v.etapes[0].etat).toBe("en-cours");
  });

  it("terminée : prête", () => {
    expect(versSuiviTacheTableau(tache({ statut: "terminee" })).etat).toBe("prete");
  });

  it("erreur / interrompue / refusée : arrêtée, avec la phrase lisible", () => {
    for (const statut of ["erreur", "interrompue", "refusee"] as const) {
      const v = versSuiviTacheTableau(tache({ statut, phrase: "L'écriture s'est arrêtée." }));
      expect(v.etat).toBe("arretee");
      expect(v.message).toBe("L'écriture s'est arrêtée.");
      expect(v.etapes.some((e) => e.etat === "arretee")).toBe(true);
    }
  });

  it("boucle arrêtée sur une tâche en attente : coincée", () => {
    expect(versSuiviTacheTableau(tache({ statut: "en-attente", boucleArretee: true })).etat).toBe("coincee");
  });

  it("aucun montant dans la vue", () => {
    expect(JSON.stringify(versSuiviTacheTableau(tache({ coutUsd: 1.2 })))).not.toMatch(/1\.2|cout/);
  });
});

describe("BrouillonsRecentsTableau (enveloppe de RecentsGenerateur)", () => {
  it("rien si vide, liste sinon avec le courant marqué", () => {
    expect(renderToStaticMarkup(createElement(BrouillonsRecentsTableau, { recents: [] }))).toBe("");
    const html = renderToStaticMarkup(createElement(BrouillonsRecentsTableau, { recents: [{ videoId: "a", titre: "A", etat: "Script écrit", date: "2026-10-18T14:05:00" }], courant: "a" }));
    expect(html).toContain("Vos brouillons");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("/tableau/nouvelle?brouillon=a");
  });
});

const etapeM = (cle: string, statut: TravailTableauLu["etapes"][number]["statut"], erreur?: TravailTableauLu["etapes"][number]["erreur"]) => ({ cle, statut, ...(erreur ? { erreur } : {}) });

describe("versSuiviFabricationTableau (garde les 4 groupes de tableau-anime/vue.ts)", () => {
  const travail = (p: Partial<TravailTableauLu>): TravailTableauLu => ({ statut: "en_cours", etapes: [etapeM("decoupage", "terminee"), etapeM("voix", "terminee"), etapeM("calage", "en_cours"), etapeM("montage", "en_attente")], ...p });

  it("en cours : les 4 groupes, faite / faite / en cours / à venir", () => {
    const v = versSuiviFabricationTableau(travail({}));
    expect(v.etat).toBe("en-cours");
    expect(v.etapes.map((e) => e.libelle)).toEqual(["Le découpage", "La voix", "Les pages", "Les finitions"]);
    expect(v.etapes.map((e) => e.etat)).toEqual(["faite", "faite", "en-cours", "a-venir"]);
  });

  it("en file : la place dans la file passe par le suivi", () => {
    const v = versSuiviFabricationTableau(travail({ statut: "en_file", rang: 3, etapes: [etapeM("fiche", "en_attente")] }));
    expect(v.etat).toBe("en-cours");
    expect(v.suivi).toMatchObject({ rang: 3 });
  });

  it("échec : coincée, l'erreur en clair sur le groupe en échec, réessayable ou non", () => {
    const v = versSuiviFabricationTableau(travail({ statut: "echec", etapes: [etapeM("fiche", "terminee"), etapeM("voix", "echec", { reessayable: true, messagePourWill: "La voix ne répond pas." })] }));
    expect(v.etat).toBe("coincee");
    const fautif = v.etapes.find((e) => e.etat === "arretee");
    expect(fautif).toMatchObject({ libelle: "La voix", erreur: { message: "La voix ne répond pas.", reessayable: true } });
    const sans = versSuiviFabricationTableau(travail({ statut: "echec", erreur: { reessayable: false, messagePourWill: "Fiche refusée." }, etapes: [etapeM("fiche", "echec")] }));
    expect(sans.etapes[0]).toMatchObject({ etat: "arretee", erreur: { message: "Fiche refusée.", reessayable: false } });
  });

  it("annulé : arrêtée par Will, aucune roue qui tourne, pas d'erreur", () => {
    const v = versSuiviFabricationTableau(travail({ statut: "annule" }));
    expect(v.etat).toBe("arretee");
    expect(v.etapes.some((e) => e.etat === "en-cours" || e.erreur)).toBe(false);
  });

  it("terminé : prête ; aucun champ d'argent", () => {
    expect(versSuiviFabricationTableau(travail({ statut: "termine" })).etat).toBe("prete");
    expect(JSON.stringify(versSuiviFabricationTableau(travail({})))).not.toMatch(/depense|centimes|devise/);
  });
});

describe("EtapesTableau · socle des suivis", () => {
  const SOURCE = lire("src/components/formats/tableau-anime/EtapesTableau.tsx");

  it("est écrit avec EnTeteSuivi, ActionsSuivi et SuiviFabrication, plus de liste d'étapes faite main", () => {
    expect(SOURCE).toMatch(/<EnTeteSuivi\b/);
    expect(SOURCE).toMatch(/<ActionsSuivi\b/);
    expect(SOURCE).toMatch(/<SuiviFabrication\b/);
    expect(SOURCE).not.toMatch(/function EtapeLigne/);
    expect(SOURCE).not.toMatch(/se dessine/);
  });

  it("pendant : Passer devant avant Arrêter ; après un arrêt : les actions propres, pas d'Arrêter", () => {
    const t: TravailTableauLu = { statut: "en_file", rang: 2, etapes: [etapeM("fiche", "en_attente")] };
    const pendant = texte(renderToStaticMarkup(createElement(EtapesTableau, { travail: t, passerDevant: createElement("b", null, "PASSER"), action: createElement("b", null, "ARRETER") })));
    expect(pendant.indexOf("PASSER")).toBeGreaterThan(-1);
    expect(pendant.indexOf("PASSER")).toBeLessThan(pendant.indexOf("ARRETER"));
    const apres = texte(renderToStaticMarkup(createElement(EtapesTableau, { travail: { ...t, statut: "echec", etapes: [etapeM("fiche", "echec")] }, passerDevant: createElement("b", null, "PASSER"), action: createElement("b", null, "ARRETER"), actionsArret: createElement("b", null, "PROPRES") })));
    expect(apres).toContain("PROPRES");
    expect(apres).not.toMatch(/PASSER|ARRETER/);
  });

  it("arrêt par Will : « Rien n'est perdu. » et la voix déjà payée gardée", () => {
    const t = texte(renderToStaticMarkup(createElement(EtapesTableau, { travail: { statut: "annule", etapes: [etapeM("voix", "terminee"), etapeM("calage", "en_attente")] } })));
    expect(t).toContain("Vous avez arrêté la fabrication");
    expect(t).toContain("Rien n'est perdu.");
    expect(t).toContain("La voix déjà payée est gardée");
  });

  it("fichiers partiels : prêts avec « Télécharger », ce qui manque", () => {
    const t: TravailTableauLu = { statut: "echec", erreur: { reessayable: true, messagePourWill: "Une sortie a coincé." }, etapes: [etapeM("voix", "terminee"), etapeM("montage", "echec")] };
    const html = renderToStaticMarkup(createElement(EtapesTableau, { travail: t, fichiers: { prets: [{ cle: "v", libelle: "Vertical", url: "/f/v.mp4" }], manquants: ["Carré"] } }));
    expect(texte(html)).toContain("Vertical : prête");
    expect(texte(html)).toContain("Il manque : Carré.");
    expect(html).toContain('href="/f/v.mp4"');
  });
});

describe("SuiviTableau et SuiviTacheTableau", () => {
  it("SuiviTableau ajoute « Passer devant » (même action que le suivi générique), sous la même condition", () => {
    const src = lire("src/components/formats/tableau-anime/SuiviTableau.tsx");
    expect(src).toMatch(/passerDevantAction/);
    expect(src).toMatch(/passerDevant=\{/);
    expect(src).toMatch(/t\.rang && !t\.urgent/);
  });

  it("SuiviTacheTableau branche enfin versSuiviTacheTableau dans SuiviFabrication", () => {
    const src = lire("src/components/formats/tableau-anime/SuiviTacheTableau.tsx");
    expect(src).toMatch(/versSuiviTacheTableau\(/);
    expect(src).toMatch(/<SuiviFabrication\b/);
  });
});
