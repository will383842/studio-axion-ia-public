/** Catalogue (F2) : sept cas, quatre offres ; rien qui ne soit écrit sur le site ou dans le code ; seul le cas de la vidéo validée porte la validation de Will. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { empreinteCas, OFFRES, verifierCas } from "../../../src/formats/cas-concret/cas";
import { CATALOGUE, estCasStock, trouverCas } from "../../../src/formats/cas-concret/catalogue";
import { CATALOGUE_TS } from "../../../src/formats/cas-concret/catalogue/base";
import { CAS_STOCK } from "../../../src/formats/cas-concret/stock-metiers";
import { nombresDe, sansPointsDeSigle } from "../../../src/moteurs/montage-cas-concret/regles";

const IDS_MASTER = ["recrutement-apporteurs", "rappels-rendez-vous", "email-difficile", "compte-rendu-dicte", "audit-une-journee", "contact-vers-crm", "devis-signe-alerte", "articles-blog"];
/** Portage phase 2 (P2) : les cas de #167 dans l'ordre du brouillon, SANS `article-publie` (décision D1 : `articles-blog` de master reste le seul cas « articles »). */
const IDS_P2 = [
  "cycle-de-formation", "programme-par-ia", "audit-departement", "diagnostic-gratuit", "dossier-laisse-relance", "documents-formation", "autofacture-formateurs",
  "devis-relances", "cv-tries", "alerte-courte", "outils-branches", "crm-qui-note", "compte-rendu-visio", "rendez-vous-classes",
];
const IDS = [...IDS_MASTER, ...IDS_P2];
/** Cas du lot vendus comme « automatisation » : des intégrations de nature « automatisation ». */
const IDS_AUTOMATISATION = ["dossier-laisse-relance", "documents-formation", "autofacture-formateurs", "devis-relances", "cv-tries", "compte-rendu-visio"];
/** Postures « offre » du lot : interrupteur non attesté ou offre vendue. */
const IDS_OFFRE_P2 = ["audit-departement", "diagnostic-gratuit", "devis-relances", "cv-tries", "outils-branches", "crm-qui-note", "compte-rendu-visio"];
const MOTS_INTERDITS = /\b(machines?|villeexemple|aucun gain garanti|avis|témoignages?|client satisfait)\b/i;
const norme = (t: string): string => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();

describe("catalogue", () => {
  it("vingt-deux cas (les huit de master, puis quatorze de la phase 2), dans l'ordre, retrouvés par identifiant", () => {
    expect(CATALOGUE_TS.map((c) => c.id)).toEqual(IDS);
    expect(CATALOGUE.slice(0, 22)).toEqual([...CATALOGUE_TS]);
    expect(CATALOGUE.filter((c) => !estCasStock(c.id)).map((c) => c.id)).toEqual(IDS);
    expect(CATALOGUE).toHaveLength(22 + CAS_STOCK.length);
    for (const c of CATALOGUE) expect(trouverCas(c.id)).toBe(c);
  });

  it("chaque cas passe verifierCas", () => {
    for (const c of CATALOGUE) {
      const r = verifierCas(JSON.parse(JSON.stringify(c)));
      expect(r.ok, `${c.id} : ${r.ok ? "" : r.raisons.join(" | ")}`).toBe(true);
    }
  });

  it("identifiants, mots et empreintes uniques ; formation, audit et intégration représentées (coaching : aucun cas)", () => {
    expect(new Set(CATALOGUE.map((c) => c.id)).size).toBe(CATALOGUE.length);
    expect(new Set(CATALOGUE.map((c) => c.mot.toUpperCase())).size).toBe(CATALOGUE.length);
    expect(new Set(CATALOGUE.map(empreinteCas)).size).toBe(CATALOGUE.length);
    // Les offres sont vérifiées sur les 22 cas d'avant le stock ; le stock, lui, ne casse que l'unicité (ci-dessus).
    expect(new Set(CATALOGUE_TS.map((c) => c.offre))).toEqual(new Set(OFFRES.filter((o) => o !== "coaching")));
  });

  it("aucun mot interdit, aucun prix, aucun pourcentage", () => {
    for (const c of CATALOGUE) {
      const t = JSON.stringify(c);
      expect(t, c.id).not.toMatch(MOTS_INTERDITS);
      expect(t, c.id).not.toMatch(/€|\beuros?\b|\bHT\b|%/i);
    }
  });

  it("seul recrutement-apporteurs porte valideParWill et une estimation ; aucun cas « chez nous » sans enServiceVerifie", () => {
    expect(CATALOGUE.filter((c) => c.valideParWill).map((c) => c.id)).toEqual(["recrutement-apporteurs"]);
    expect(CATALOGUE.filter((c) => c.faits.some((f) => f.source === "estimation")).map((c) => c.id)).toEqual(["recrutement-apporteurs"]);
    for (const c of CATALOGUE.filter((x) => x.posture === "chez-nous")) expect(c.enServiceVerifie, c.id).toBeDefined();
  });

  it("les cas 16 et 17 sont de posture « offre », sans tournure d'usage réel", () => {
    for (const id of ["contact-vers-crm", "devis-signe-alerte"]) expect(trouverCas(id)?.posture).toBe("offre");
    for (const c of CATALOGUE.filter((x) => x.posture === "offre")) expect(JSON.stringify(c), c.id).not.toMatch(/chez nous|on a automatisé|nos clients|notre outil/i);
  });

  it("toute promesse tient 8 mots et tout fait porte une source", () => {
    for (const c of CATALOGUE) {
      expect(c.promesse.split(/\s+/).length, c.id).toBeLessThanOrEqual(8);
      for (const f of c.faits) expect(f.preuve.length, `${c.id}/${f.id}`).toBeGreaterThan(0);
    }
  });
});

describe("catalogue · quatorze cas de la phase 2 (portage P2)", () => {
  const lot = IDS_P2.map((id) => trouverCas(id)!);
  const montre = (c: (typeof lot)[number]): string => [c.promesse, ...c.avant.taches, c.resteHumain, c.resultat, ...c.etapes.flatMap((e) => [e.titre, e.ligne, e.detail])].join(" ");

  it("quatorze cas, formation, audit et intégration représentées, aucun ne porte valideParWill ni estimation", () => {
    expect(lot).toHaveLength(14);
    expect(new Set(lot.map((c) => c.offre))).toEqual(new Set(OFFRES.filter((o) => o !== "coaching")));
    for (const c of lot) {
      expect(c.valideParWill, c.id).toBeUndefined();
      expect(c.faits.filter((f) => f.source === "estimation"), c.id).toEqual([]);
    }
  });

  it("`article-publie` est écarté (D1) : master garde `articles-blog`", () => {
    expect(trouverCas("article-publie")).toBeUndefined();
    expect(trouverCas("articles-blog")).toBeDefined();
  });

  it("une automatisation est une intégration de nature « automatisation » ; toute intégration du lot porte sa nature, et son cadeau en découle", () => {
    expect(lot.filter((c) => c.nature === "automatisation").map((c) => c.id)).toEqual(IDS_AUTOMATISATION);
    for (const c of lot.filter((x) => x.offre === "integration")) {
      expect(c.nature, c.id).toBeDefined();
      expect(c.documentPromis.finCadeauId, c.id).toBe(c.nature === "automatisation" ? "fin-if-cadeau-automatisation" : "fin-if-cadeau-integration");
    }
  });

  it("promesse de 8 mots au plus, sigles écrits sans points ; faits tous sourcés", () => {
    for (const c of lot) {
      expect(c.promesse.split(/\s+/).length, c.id).toBeLessThanOrEqual(8);
      expect(c.promesse, c.id).not.toMatch(/(?:\p{Lu}\.){2,}/u);
      for (const f of c.faits) expect(f.preuve.length, `${c.id}/${f.id}`).toBeGreaterThan(10);
    }
  });

  it("aucun mot de conformité, de prix ni de client dans ce qui est montré", () => {
    for (const c of lot) expect(montre(c), c.id).not.toMatch(/\b(rgpd|conforme|conformité|certifexemple|certifi\w+|tva|déductible|légal\w*)\b/i);
  });

  it("cas 15 : la vigilance « décision humaine » ; cas 12 : aucune affirmation fiscale", () => {
    expect(trouverCas("cv-tries")!.vigilance.join(" ")).toMatch(/décision humaine/i);
    expect(trouverCas("cv-tries")!.resteHumain).toMatch(/décision/);
    const c12 = trouverCas("autofacture-formateurs")!;
    expect(c12.vigilance.join(" ")).toMatch(/Aucune affirmation fiscale/);
    expect(montre(c12)).not.toMatch(/\b(tva|fiscal\w*|déductible|régulier|légal\w*|comptab\w*)\b/i);
  });

  it("les cas « offre » du lot sont ceux attendus ; les cas « chez nous » du lot disent comment le service a été vérifié", () => {
    expect(lot.filter((x) => x.posture === "offre").map((x) => x.id).sort()).toEqual([...IDS_OFFRE_P2].sort());
    for (const c of lot.filter((x) => x.posture === "chez-nous")) expect(c.enServiceVerifie?.source, c.id).toMatch(/Mise en service non constatée/);
  });
});

describe("catalogue · nombres", () => {
  it("aucune tâche, étape ou promesse ne porte un nombre (chiffres ou lettres) absent des faits du cas", () => {
    for (const c of CATALOGUE) {
      const permis = new Set(c.faits.flatMap((f) => f.valeurs));
      if (c.conformite?.rgpd) for (const n of nombresDe(sansPointsDeSigle(c.conformite.rgpd.phrase))) permis.add(n);
      const textes = [c.promesse, ...c.avant.taches, ...c.etapes.flatMap((e) => [e.titre, e.ligne, e.detail])];
      for (const t of textes) {
        const libres = nombresDe(sansPointsDeSigle(t)).filter((n) => !permis.has(n));
        expect(libres, `${c.id} : « ${t} »`).toEqual([]);
      }
    }
  });
  it("les trois tâches réécrites sans nombre tiennent 6 mots au plus", () => {
    const taches = [...trouverCas("audit-une-journee")!.avant.taches, ...trouverCas("compte-rendu-dicte")!.avant.taches, ...trouverCas("contact-vers-crm")!.avant.taches];
    const reecrites = taches.filter((t) => /outils|rendez-vous (?:au|en)|contact (?:entre|en)/.test(t) && /Hésiter|Préparer|Perdre/.test(t));
    expect(reecrites).toHaveLength(3);
    for (const t of reecrites) expect(t.split(/\s+/).length, t).toBeLessThanOrEqual(6);
  });
});

describe("recrutement-apporteurs : le cas de la vidéo validée", () => {
  const cas = trouverCas("recrutement-apporteurs")!;
  const video = norme(readFileSync(join(__dirname, "../temoin/reference/texte.txt"), "utf8"));

  it("ses phrases sont celles de la vidéo", () => {
    expect(video).toContain(norme("On recrute nos collaborateurs en quinze minutes"));
    expect(video).toContain(norme(cas.faits.find((f) => f.id === "inscription-vingt-secondes")!.enonce));
    expect(video).toContain(norme(cas.faits.find((f) => f.id === "plus-d-une-heure")!.enonce));
    expect(video).toContain(norme(cas.conformite!.rgpd!.phrase));
    expect(video).toContain(norme(cas.resteHumain));
  });

  it("mot IA lu « I.A. », six étapes, deux écrans réels avec repli, frappe sans clic d'envoi", () => {
    expect(cas.mot).toBe("IA");
    expect(cas.motDit).toBe("I.A.");
    expect(cas.valideParWill).toEqual({ le: "2026-10-11", source: "texte de la vidéo de référence v10, validé par Will" });
    expect(cas.etapes).toHaveLength(6);
    const ecrans = cas.etapes.flatMap((e) => (e.visuel.sorte === "ecran" ? [e.visuel] : []));
    expect(ecrans.map((e) => [e.adresse, e.mouvement, e.repli])).toEqual([
      ["https://axion-ia.com/fr/apporteur-affaires/video", "frappe", "telephone-notification"],
      ["https://axion-ia.com/fr/appel", "image", "calendrier"],
    ]);
    expect(ecrans[0]?.saisies).toEqual([{ champ: "vsl-prenom", texte: "Camille" }, { champ: "vsl-email", texte: "camille@exemple.fr" }]);
    expect(ecrans[0]?.cocher).toEqual(["vsl-consent"]);
    expect(cas.faits.find((f) => f.id === "inscription-vingt-secondes")).toMatchObject({ valeurs: [20], source: "site" });
    expect(cas.faits.find((f) => f.id === "plus-d-une-heure")?.source).toBe("estimation");
    expect(cas.conformite?.rgpd).toMatchObject({ source: "will", le: "2026-10-11" });
  });
});

describe("catalogue · réglage `casConcret.catalogueEtendu` (portage P2)", () => {
  it("éteint : la page ne montre que les huit cas de master, dans leur ordre ; allumé : les vingt-deux", async () => {
    const { casVisibles, estCasPhase2 } = await import("../../../src/formats/cas-concret/catalogue");
    const liste = CATALOGUE.map((cas) => ({ cas }));
    expect(casVisibles(liste, { catalogueEtendu: false }).map((x) => x.cas.id)).toEqual(IDS_MASTER);
    expect(casVisibles(liste, { catalogueEtendu: true }).map((x) => x.cas.id)).toEqual(IDS);
    expect(IDS_P2.every(estCasPhase2)).toBe(true);
    expect(IDS_MASTER.some(estCasPhase2)).toBe(false);
  });

  it("la page `/cas-concret` filtre avec le réglage (éteint par défaut), et CATALOGUE garde les vingt-deux d'avant le stock, suivis du stock", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(studio)/cas-concret/page.tsx"), "utf8");
    expect(page).toContain("casVisibles(");
    expect(page).toContain("REGLAGES_CAS_CONCRET.catalogueEtendu");
    expect(CATALOGUE_TS).toHaveLength(22);
    expect(CATALOGUE).toHaveLength(22 + CAS_STOCK.length);
    expect(CATALOGUE.slice(0, 22)).toEqual([...CATALOGUE_TS]);
  });

  it("réglage `stockMetiers` éteint (défaut) : aucun cas du stock n'est visible, allumé : tous", async () => {
    const { casVisibles } = await import("../../../src/formats/cas-concret/catalogue");
    const liste = CATALOGUE.map((cas) => ({ cas }));
    expect(casVisibles(liste, { catalogueEtendu: true }).map((x) => x.cas.id)).toEqual(IDS);
    expect(casVisibles(liste, { catalogueEtendu: true, stockMetiers: false }).some((x) => estCasStock(x.cas.id))).toBe(false);
    expect(casVisibles(liste, { catalogueEtendu: true, stockMetiers: true })).toHaveLength(CATALOGUE.length);
  });
});
