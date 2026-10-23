/**
 * Lot G4 · contrôles ajoutés (addendum du 02/10 : §2 bis problème douloureux, §2 ter récit du cas client, §2 quinquies
 * le spectateur se reconnaît, §2 sexies diversité et ruptures ; ordre de Will du 03/10 : jamais de faux cas client).
 */
import { describe, expect, it } from "vitest";
import {
  c80SerieDouleur,
  consignesDiversite,
  controlerDiversite,
  controlerVersion,
  elementDiversite,
  problemeAbstrait,
  typeFin,
  typeOuverture,
  type ElementDiversite,
} from "@/domaine/controles-script";
import { choisirCombinaison } from "@/generateur/choix-combinaison";
import { entreeChoix } from "./helpers/g3-choix";
import { temoin } from "./helpers/g3";

const codes = (e: Parameters<typeof controlerVersion>[0]) => controlerVersion(e).violations.map((v) => v.controle);

describe("G4 · §2 bis : un problème douloureux, son coût avant 5 s, une issue", () => {
  it("C77 : problème absent, outil en sujet ou abstrait → bloquant ; concret → passe", () => {
    expect(problemeAbstrait(undefined)).toMatch(/absent/);
    expect(problemeAbstrait("L'IA générative")).toMatch(/outil/);
    expect(problemeAbstrait("L'optimisation de la performance")).toMatch(/abstrait/);
    expect(problemeAbstrait("Votre équipe relance chaque devis à la main le vendredi soir")).toBeNull();
    const e = temoin((x) => (x.maitre!.angle = { ...x.maitre!.angle!, probleme: "La transformation digitale" }));
    expect(controlerVersion(e).violations.some((v) => v.controle === "C77" && v.bloquant)).toBe(true);
  });

  it("C78 : coût jamais dit, ou dit après 5 s → information (étalonnage v4 : jamais bloquant)", () => {
    const sans = temoin((x) => (x.ouverture[0].segments[0].marqueurs = ["ancrage"]));
    const v = controlerVersion(sans).violations.find((x) => x.controle === "C78");
    expect(v?.niveau).toBe("info");
    expect(codes(temoin())).not.toContain("C78");
  });

  it("C79 : aucune issue (ni solution, ni geste, ni verdict) → bloquant", () => {
    const e = temoin((x) => {
      for (const b of x.corps) for (const s of b.segments) s.marqueurs = (s.marqueurs ?? []).filter((m) => !["solution", "resultat", "methode", "livraison"].includes(m));
    });
    expect(controlerVersion(e).violations.some((v) => v.controle === "C79" && v.bloquant)).toBe(true);
  });

  it("C80 : trois sujets « douleur » d'affilée → alerte de série ; gain ou curiosité → rien", () => {
    expect(c80SerieDouleur(["douleur", "douleur"], "douleur")[0]?.controle).toBe("C80");
    expect(c80SerieDouleur(["douleur", "douleur"], "curiosite")).toEqual([]);
    expect(c80SerieDouleur(["gain", "douleur"], "douleur")).toEqual([]);
  });
});

describe("G4 · §2 ter et ordre du 03/10 : le récit d'un VRAI cas client, jamais un faux", () => {
  it("C83 : « est venu nous voir » sans preuve cas client avec accord → bloquant pour la machine, alerte pour Will", () => {
    const sansPreuve = temoin((x) => {
      x.corps[0].segments[0] = { id: "c1", texte: "Un dirigeant est venu nous voir avec ses fichiers.", nature: "fait", marqueurs: ["ancrage"] };
      x.preuves = x.preuves.map((p) => ({ ...p, type: "chiffre-interne" as const }));
      x.maitre!.appuiPrincipal = {};
    });
    expect(controlerVersion(sansPreuve).violations.some((v) => v.controle === "C83" && v.bloquant)).toBe(true);
    expect(controlerVersion({ ...sansPreuve, auteur: "will" }).violations.find((v) => v.controle === "C83")?.niveau).toBe("alerte");
  });

  it("C81 : un vrai cas client raconté sans « venu nous voir » / « nous avons » → à revoir", () => {
    const e = temoin();
    expect(controlerVersion(e).violations.find((v) => v.controle === "C81")?.niveau).toBe("alerte");
    const raconte = temoin((x) => {
      x.corps[0].segments.unshift({ id: "c0", texte: "Un dirigeant de PME est venu nous voir avec ses tableurs.", nature: "fait", preuveIds: ["P1"] });
      x.corps[0].segments[2] = { ...x.corps[0].segments[2], texte: "Nous avons supprimé tous ses fichiers." };
    });
    expect(codes(raconte)).not.toContain("C81");
  });

  it("C82 : cas client sans cible située avant 5 s, ou sans geste du quotidien → à revoir", () => {
    const e = temoin();
    expect(controlerVersion(e).violations.some((v) => v.controle === "C82")).toBe(true);
    const situe = temoin((x) => {
      x.ouverture[0].segments[0].texte = "Un dirigeant de PME de 40 salariés recopiait ses tableurs chaque soir.";
    });
    expect(controlerVersion(situe).violations.filter((v) => v.controle === "C82" && v.niveau === "alerte")).toEqual([]);
  });
});

describe("G4 · §2 sexies : diversité et ruptures", () => {
  it("lit la manière d'ouvrir et de finir", () => {
    expect(typeOuverture("On m'a demandé : faut-il garder Excel ?")).toBe("question-recue");
    expect(typeOuverture("Les gens pensent que l'IA invente tout.")).toBe("idee-recue-dementie");
    expect(typeOuverture("Il ne faut jamais confier vos devis à un tableur.")).toBe("avis-tranche");
    expect(typeOuverture("Votre équipe recopie encore ses factures.")).toBe("vous-direct");
    expect(typeFin("Écrivez-nous.", "", "")).toEqual({ fin: "appel", ecrivezNous: true });
    expect(typeFin("", "", "Et ça, ça peut tout changer.").fin).toBe("fin-sur-le-fait");
    expect(typeFin("Combien d'heures chez vous ?", "", "").fin).toBe("question-ouverte");
  });

  it("consignes : même ouverture interdite 2 fois d'affilée, « Un dirigeant… » 1 sur 4, récit 1 sur 3, rupture vers 1 sur 5", () => {
    const e = (o: Partial<ElementDiversite>): ElementDiversite => ({ ouverture: "situation", unDirigeant: false, fin: "appel", ecrivezNous: false, recit: false, expressions: [], ...o });
    const c = consignesDiversite([e({ ouverture: "chiffre" }), e({ ouverture: "chiffre", unDirigeant: true, recit: true, ecrivezNous: true, intensite: "douleur" }), e({ intensite: "douleur", expressions: ["sauf que"] })]);
    expect(c.ouverturesInterdites).toContain("situation");
    expect(c.ouverturesInterdites).toContain("chiffre");
    expect(c.unDirigeantInterdit).toBe(true);
    expect(c.recitInterdit).toBe(true);
    expect(c.ecrivezNousInterdit).toBe(true);
    expect(c.douleurInterdite).toBe(true);
    expect(c.expressionsInterdites).toEqual(["sauf que"]);
    expect(consignesDiversite([e({}), e({}), e({}), e({})]).rupture).toBeDefined();
  });

  it("contrôles de série C84 à C88 : alertes, jamais bloquants", () => {
    const serie = [elementDiversite({ accroche: "Votre équipe recopie ses factures.", appel: "Écrivez-nous.", boucle: "", derniereInfo: "", texte: "Sauf que", recit: true })];
    const v = controlerDiversite(serie, elementDiversite({ accroche: "Vous perdez des heures.", appel: "Écrivez-nous.", boucle: "", derniereInfo: "", texte: "Sauf que ça coûte.", recit: true }));
    expect(v.map((x) => x.controle).sort()).toEqual(["C84", "C85", "C86", "C87"]);
    expect(v.every((x) => !x.bloquant)).toBe(true);
  });

  it("série simulée de 30 sujets avec ces règles : ouvertures et fins qui tournent, récit ≤ 1/3, ruptures ≈ 1 sur 5", () => {
    const serie: ElementDiversite[] = [];
    const ouvertures = ["resultat-dabord", "question-recue", "chiffre", "idee-recue-dementie", "avis-tranche", "vous-direct", "scene-present", "situation"] as const;
    const fins = ["appel", "fin-sur-le-fait", "question-ouverte", "boucle", "defi"] as const;
    for (let i = 0; i < 30; i++) {
      const c = consignesDiversite(serie);
      // Le rédacteur suit les consignes : la 1re ouverture et la 1re fin permises, en commençant à un rang qui tourne.
      const o = [...ouvertures.slice(i % ouvertures.length), ...ouvertures.slice(0, i % ouvertures.length)].find((x) => !c.ouverturesInterdites.includes(x))!;
      const f = [...fins.slice(i % fins.length), ...fins.slice(0, i % fins.length)].find((x) => !c.finsInterdites.includes(x))!;
      serie.push({ ouverture: o, unDirigeant: !c.unDirigeantInterdit && i % 2 === 0, fin: f, ecrivezNous: !c.ecrivezNousInterdit && f === "appel", recit: !c.recitInterdit, intensite: c.douleurInterdite ? "gain" : "douleur", rupture: c.rupture, expressions: [] });
    }
    for (let i = 1; i < 30; i++) expect(serie[i].ouverture, `sujet ${i}`).not.toBe(serie[i - 1].ouverture);
    for (let i = 4; i < 30; i++) expect(serie.slice(i - 4, i + 1).filter((x) => x.ouverture === serie[i].ouverture).length).toBeLessThanOrEqual(2);
    for (let i = 3; i < 30; i++) expect(serie.slice(i - 3, i + 1).filter((x) => x.unDirigeant).length).toBeLessThanOrEqual(1);
    for (let i = 2; i < 30; i++) expect(serie.slice(i - 2, i + 1).filter((x) => x.recit).length).toBeLessThanOrEqual(1);
    for (let i = 2; i < 30; i++) expect(new Set(serie.slice(i - 2, i + 1).map((x) => x.fin)).size).toBeGreaterThan(1);
    for (let i = 2; i < 30; i++) expect(serie.slice(i - 2, i + 1).filter((x) => x.intensite === "douleur").length).toBeLessThanOrEqual(2);
    const ruptures = serie.filter((x) => x.rupture).length;
    expect(ruptures).toBeGreaterThanOrEqual(4);
    expect(ruptures).toBeLessThanOrEqual(8);
  });

  it("le choix conjoint pénalise le récit de cas client quand la série en a déjà un (§2 sexies, en ajout)", () => {
    const sansSerie = choisirCombinaison(entreeChoix());
    const avecRecit = choisirCombinaison(entreeChoix({ diversite: { serie: [{ ouverture: "resultat-dabord", unDirigeant: false, fin: "appel", ecrivezNous: false, recit: true, expressions: [] }] } }));
    expect(sansSerie.ok && avecRecit.ok).toBe(true);
    if (sansSerie.ok && avecRecit.ok) {
      expect(avecRecit.diversite?.recitInterdit).toBe(true);
      const cas = (r: typeof sansSerie) => (r.ok ? r.details.findIndex((d) => d.ancrage.type === "cas-client") : -1);
      expect(cas(avecRecit) === -1 || cas(avecRecit) >= cas(sansSerie)).toBe(true);
    }
  });
});
