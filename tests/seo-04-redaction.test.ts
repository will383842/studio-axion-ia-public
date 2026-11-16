/**
 * SEO-04 · Aide à la rédaction de la fiche de page : l'écriture est INJECTÉE et simulée, aucun appel réel.
 * Critères : (1) le brouillon est proposé sans être enregistré ; un geste de validation est requis ;
 * (2) aucune donnée de personne dans les textes proposés.
 */
import { describe, expect, it } from "vitest";
import { creerDepotMemoire, creerServiceFichesDePage } from "@/services/fiche-de-page";
import {
  creerRedactionFicheDePage,
  type BrouillonFournisseur,
  type DemandeRedaction,
  type FournisseurEcriture,
} from "@/services/redaction-fiche-de-page";

const t = (n: number, base = "a") => (base + " ").repeat(n).slice(0, n).trim().padEnd(n, "x");
const phrases = (n: number, total: number) => {
  const dispo = total - (n - 1);
  const part = Math.floor(dispo / n);
  return Array.from({ length: n }, (_, i) => {
    const L = i === n - 1 ? dispo - part * (n - 1) : part;
    return `M${"o".repeat(L - 2)}.`;
  }).join(" ");
};

function brouillonValide(): BrouillonFournisseur {
  return {
    resume: phrases(2, 260),
    gain: t(100, "gain"),
    questions: [1, 2, 3].map((i) => ({ question: `${t(70, `Question ${i}`)}?`, reponse: phrases(2, 260) })),
    sousTitres: [
      { niveau: 2, texte: t(40, "Partie") },
      { niveau: 3, texte: t(35, "Detail") },
    ],
    textesAlternatifs: [t(100, "image")],
  };
}

function fournisseurSimule(sortie: BrouillonFournisseur | (() => never) = brouillonValide()) {
  const appels: DemandeRedaction[] = [];
  const f: FournisseurEcriture = {
    async rediger(d) {
      appels.push(structuredClone(d));
      if (typeof sortie === "function") return sortie();
      return structuredClone(sortie);
    },
  };
  return { f, appels };
}

function monter(sortie?: BrouillonFournisseur | (() => never), nomsInterdits: string[] = ["Dominique Exemplaire"]) {
  const depot = creerDepotMemoire();
  const fiches = creerServiceFichesDePage({ depot, maintenant: () => "2026-11-20" });
  fiches.creer("AUTO-014", "relances-clients-automatiques");
  const { f, appels } = fournisseurSimule(sortie);
  let n = 0;
  const redaction = creerRedactionFicheDePage({ fournisseur: f, fiches, nomsInterdits, nouvelId: () => `PROP-${++n}` });
  return { fiches, redaction, appels, depot };
}

const SCRIPT = "Bonjour. Voici comment relancer vos clients sans rien oublier, étape par étape.";

describe("proposition : rien n'est enregistré", () => {
  it("propose un brouillon à relire sans toucher à la fiche", async () => {
    const { fiches, redaction } = monter();
    const avant = JSON.stringify(fiches.lire("AUTO-014"));
    const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.proposition.statut).toBe("a_relire");
    expect(r.proposition.defauts).toEqual([]);
    expect(r.proposition.contenu.questions).toHaveLength(3);
    expect(JSON.stringify(fiches.lire("AUTO-014"))).toBe(avant);
    expect(fiches.lire("AUTO-014")?.resume).toBeUndefined();
  });
  it("fiche inconnue ou script vide : refus, aucun appel au fournisseur", async () => {
    const { redaction, appels } = monter();
    expect((await redaction.proposer("AUTO-999", { script: SCRIPT })).ok).toBe(false);
    expect((await redaction.proposer("AUTO-014", { script: "  " })).ok).toBe(false);
    expect(appels).toHaveLength(0);
  });
  it("une panne du fournisseur devient un refus sans fuite du message", async () => {
    const { redaction, fiches } = monter(() => {
      throw new Error("secret-interne-123");
    });
    const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.join(" ")).not.toContain("secret-interne");
    expect(fiches.lire("AUTO-014")?.resume).toBeUndefined();
  });
});

describe("validation : un geste est requis", () => {
  it("sans validation écrite, rien n'est appliqué", async () => {
    const { redaction, fiches } = monter();
    const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
    if (!r.ok) throw new Error("proposition attendue");
    const v = redaction.valider(r.proposition.id, { validationEcrite: false });
    expect(v.ok).toBe(false);
    expect(fiches.lire("AUTO-014")?.resume).toBeUndefined();
    // @ts-expect-error geste absent
    expect(redaction.valider(r.proposition.id, {}).ok).toBe(false);
  });
  it("avec le geste, les champs sont appliqués mais la fiche reste un brouillon, jamais publiée", async () => {
    const { redaction, fiches } = monter();
    const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
    if (!r.ok) throw new Error("proposition attendue");
    const v = redaction.valider(r.proposition.id, { validationEcrite: true });
    expect(v.ok).toBe(true);
    const fiche = fiches.lire("AUTO-014");
    expect(fiche?.resume).toBe(r.proposition.contenu.resume);
    expect(fiche?.questions).toHaveLength(3);
    expect(fiche?.images?.[0]).toEqual({ alt: r.proposition.contenu.textesAlternatifs[0], decorative: false });
    expect(fiche?.statut).toBe("brouillon");
    expect(fiche?.robots).toBe("noindex,nofollow");
  });
  it("ne touche jamais aux champs du fondateur (fond, limites, auteur, sources)", async () => {
    const { redaction, fiches, depot } = monter();
    const fond = {
      pourQui: ["Une petite agence", "Un cabinet de conseil"],
      limites: ["Elle ne rédige pas de réponse personnalisée."],
      auteur: "Équipe Axion-IA",
      relecteur: "Équipe Axion-IA",
      sources: [{ intitule: "Source datée", adresse: "https://exemple.org/a", dateConsultation: "2026-11-20" }],
    };
    fiches.modifier("AUTO-014", fond);
    const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
    if (!r.ok) throw new Error("proposition attendue");
    expect(redaction.valider(r.proposition.id, { validationEcrite: true }).ok).toBe(true);
    const apres = depot.lire("AUTO-014"); // le service cache ces champs avant validation : on lit le dépôt
    expect(apres?.pourQui).toEqual(fond.pourQui);
    expect(apres?.limites).toEqual(fond.limites);
    expect(apres?.auteur).toBe(fond.auteur);
    expect(apres?.sources).toEqual(fond.sources);
  });
  it("une proposition ne s'applique qu'une fois ; une proposition inconnue est refusée", async () => {
    const { redaction } = monter();
    const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
    if (!r.ok) throw new Error("proposition attendue");
    expect(redaction.valider(r.proposition.id, { validationEcrite: true }).ok).toBe(true);
    const second = redaction.valider(r.proposition.id, { validationEcrite: true });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.erreurs.join(" ")).toContain("déjà été appliquée");
    expect(redaction.valider("PROP-404", { validationEcrite: true }).ok).toBe(false);
  });
  it("une proposition en défaut ne peut pas être validée", async () => {
    const mauvais = { ...brouillonValide(), resume: "Trop court." };
    const { redaction, fiches } = monter(mauvais);
    const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
    if (!r.ok) throw new Error("proposition attendue");
    expect(r.proposition.defauts.some((d) => d.champ === "resume")).toBe(true);
    expect(redaction.valider(r.proposition.id, { validationEcrite: true }).ok).toBe(false);
    expect(fiches.lire("AUTO-014")?.resume).toBeUndefined();
  });
  it("si la fiche a changé depuis la proposition, la validation est refusée", async () => {
    const { redaction, fiches } = monter();
    const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
    if (!r.ok) throw new Error("proposition attendue");
    fiches.modifier("AUTO-014", { gain: t(100, "autre") });
    const v = redaction.valider(r.proposition.id, { validationEcrite: true });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.erreurs.join(" ")).toContain("La fiche a changé");
  });
});

describe("aucune donnée de personne", () => {
  it("le script est masqué avant d'être confié au fournisseur", async () => {
    const { redaction, appels } = monter();
    await redaction.proposer("AUTO-014", { script: "Écrivez à jeanne.dupont@exemple.fr ou appelez le 06 12 34 56 78 pour relancer." });
    expect(appels).toHaveLength(1);
    expect(appels[0].script).not.toMatch(/@exemple|06 12 34/);
  });
  const cas: Array<[string, string]> = [
    ["une adresse e-mail", "Écrivez à marie.martin@exemple.fr pour recevoir le guide complet de la démarche."],
    ["un numéro de téléphone", "Appelez le 06 12 34 56 78 pour recevoir le guide complet de la démarche demain."],
    ["un nom de personne interdit", "Dominique Exemplaire explique le guide complet de la démarche à suivre pas à pas."],
  ];
  for (const [nom, phrase] of cas) {
    it(`refuse un texte proposé contenant ${nom}`, async () => {
      const sortie = { ...brouillonValide(), resume: `${phrase} ${phrases(1, 40)}` };
      const { redaction, fiches } = monter(sortie, ["Dominique Exemplaire"]);
      const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.erreurs.join(" ")).toMatch(/donnée de personne/);
        expect(r.erreurs.join(" ")).not.toMatch(/marie|06 12|Dominique/);
      }
      expect(fiches.lire("AUTO-014")?.resume).toBeUndefined();
    });
  }
  it("le script est aussi masqué des noms interdits (accents, casse) et des pseudonymes", async () => {
    const { redaction, appels } = monter(undefined, ["Dominique Exemplaire"]);
    await redaction.proposer("AUTO-014", { script: "Merci à DOMINIQUE exemplaire et à dominique Éxemplaire, suivez @pseudo_test pour la suite." });
    expect(appels[0].script).not.toMatch(/exemplaire|pseudo_test/i);
    expect(appels[0].script).toContain("[masqué]");
  });
  it("refuse toute proposition sans liste de noms interdits", async () => {
    const { redaction, appels } = monter(undefined, []);
    expect((await redaction.proposer("AUTO-014", { script: SCRIPT })).ok).toBe(false);
    expect(appels).toHaveLength(0);
  });
  const variantes: Array<[string, string]> = [
    ["espaces multiples", "Dominique   Exemplaire"],
    ["retour à la ligne", "Dominique\nExemplaire"],
    ["accent décomposé", "Dominique Exemplaire".replace("p", "p\u0301")],
    ["casse et accents", "DOMINÍQUE éxemplaire"],
  ];
  for (const [nom, v] of variantes) {
    it(`masque le nom du script et refuse un texte proposé : ${nom}`, async () => {
      const g = brouillonValide();
      g.resume = `${v} présente la démarche. ${phrases(1, 150)}`;
      const { redaction, appels } = monter(g, ["Dominique Exemplaire", "Dominique Éxemplaire"]);
      const r = await redaction.proposer("AUTO-014", { script: `Merci à ${v} pour la démonstration.` });
      expect(appels[0].script).toContain("[masqué]");
      expect(appels[0].script).not.toMatch(/exemplaire|p\u0301/i);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erreurs.join(" ")).toMatch(/donnée de personne/);
    });
  }
  it("les propriétés en trop du fournisseur n'entrent ni dans la proposition ni dans la fiche", async () => {
    const b = brouillonValide() as unknown as Record<string, unknown>;
    (b.questions as Array<Record<string, unknown>>)[0].contact = "jeanne.dupont@exemple.fr";
    (b.sousTitres as Array<Record<string, unknown>>)[0].auteur = "Dominique Exemplaire";
    b.extra = "jeanne.dupont@exemple.fr";
    const { redaction, fiches } = monter(b as unknown as BrouillonFournisseur);
    const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
    if (!r.ok) throw new Error("proposition attendue");
    expect(JSON.stringify(r.proposition)).not.toMatch(/exemple\.fr|Exemplaire/);
    redaction.valider(r.proposition.id, { validationEcrite: true });
    expect(JSON.stringify(fiches.lire("AUTO-014"))).not.toMatch(/exemple\.fr|Exemplaire/);
  });
  it("transmet les consignes de la marque au fournisseur", async () => {
    const { redaction, appels } = monter();
    await redaction.proposer("AUTO-014", { script: SCRIPT });
    expect(appels[0].consignes?.join(" ")).toContain("Vouvoyez");
  });
  const champs: Array<[string, (b: BrouillonFournisseur) => void]> = [
    ["une question", (b) => (b.questions[0].question = `${t(50, "Question")} marie@exemple.fr ?`.padEnd(70, "x"))],
    ["une réponse", (b) => (b.questions[1].reponse = `${b.questions[1].reponse} Appelez le 06 12 34 56 78.`)],
    ["un sous-titre", (b) => (b.sousTitres[0].texte = `${t(40, "Partie")} @pseudo`)],
    ["un texte alternatif", (b) => (b.textesAlternatifs = [`${t(90, "image")} contact@exemple.fr`])],
    ["le gain (pseudonyme)", (b) => (b.gain = `${t(90, "gain")} @pseudo_test`)],
  ];
  for (const [nom, alterer] of champs) {
    it(`refuse une donnée de personne dans ${nom}`, async () => {
      const b = brouillonValide();
      alterer(b);
      const { redaction } = monter(b);
      const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erreurs.join(" ")).toMatch(/donnée de personne/);
    });
  }
  it("les limites de mot : « Anne » n'abîme ni « année » ni « annexe »", async () => {
    const g = brouillonValide();
    g.resume = `${phrases(1, 100)} Cette année, l'annexe du guide explique la démarche. ${phrases(1, 100)}`.slice(0, 260);
    const { redaction, appels } = monter(g, ["Anne"]);
    const r = await redaction.proposer("AUTO-014", { script: "Cette année, l'annexe décrit la démarche. Merci à Anne Martin." });
    expect(appels[0].script).toContain("année");
    expect(appels[0].script).toContain("annexe");
    expect(appels[0].script).not.toMatch(/\bAnne\b/);
    expect(r.ok).toBe(true);
  });
  const contournements: Array<[string, string]> = [
    ["trait d'union", "Anne-Martin"],
    ["tiret long", "Anne\u2014Martin"],
    ["trait d'union insécable", "Anne\u2011Martin"],
    ["ordre inversé", "Martin Anne"],
    ["initiale", "A. Martin"],
    ["prénom seul", "Anne"],
    ["nom seul", "MARTIN"],
    ["caractère invisible entre les mots", "Anne\u200BMartin"],
    ["caractère invisible dans un mot", "An\u200Bne"],
  ];
  for (const [nom, v] of contournements) {
    it(`filtre non contournable : ${nom}`, async () => {
      const g = brouillonValide();
      g.resume = `${v} présente la démarche. ${phrases(1, 150)}`;
      const { redaction, appels } = monter(g, ["Anne Martin"]);
      const r = await redaction.proposer("AUTO-014", { script: `Merci à ${v} pour la démonstration.` });
      expect(appels[0].script).toContain("[masqué]");
      expect(appels[0].script).not.toMatch(/martin|anne|an\u200Bne/i);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erreurs.join(" ")).toMatch(/donnée de personne/);
    });
  }
});

describe("champs déjà remplis : rien n'est supprimé sans confirmation", () => {
  it("refuse sans confirmation, liste les champs, et garde les images décoratives après confirmation", async () => {
    const { redaction, fiches } = monter();
    fiches.modifier("AUTO-014", { sousTitres: [{ niveau: 2, texte: t(40, "Main") }], images: [{ alt: "", decorative: true }] });
    const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
    if (!r.ok) throw new Error("proposition attendue");
    expect(r.proposition.champsDejaRemplis).toEqual(["sousTitres", "images"]);
    const refuse = redaction.valider(r.proposition.id, { validationEcrite: true });
    expect(refuse.ok).toBe(false);
    if (!refuse.ok) expect(refuse.erreurs.join(" ")).toContain("sousTitres");
    expect(fiches.lire("AUTO-014")?.sousTitres?.[0].texte).toBe(t(40, "Main"));
    expect(redaction.valider(r.proposition.id, { validationEcrite: true, remplacerExistant: true }).ok).toBe(true);
    const images = fiches.lire("AUTO-014")?.images ?? [];
    expect(images.some((i) => i.decorative && i.alt === "")).toBe(true);
    expect(images.some((i) => !i.decorative)).toBe(true);
  });
});

describe("règles de la marque", () => {
  const interdits: Array<[string, string]> = [
    ["un prix", `Cela coûte ${"4" + "9"} ${String.fromCharCode(8364)} par mois`],
    ["le mot certifié", "Une méthode certifiée pour tous"],
    ["une garantie", "Un gain garanti pour chaque équipe"],
    ["le tutoiement", "Tu gagnes du temps chaque semaine"],
  ];
  for (const [nom, phrase] of interdits) {
    it(`signale ${nom} comme défaut et bloque la validation`, async () => {
      const g = brouillonValide();
      g.gain = `${phrase} ${t(60, "gain")}`.slice(0, 120);
      const { redaction } = monter(g);
      const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
      if (!r.ok) throw new Error("proposition attendue");
      expect(r.proposition.defauts.some((d) => d.champ === "gain" && /mot interdit/.test(d.message))).toBe(true);
      expect(redaction.valider(r.proposition.id, { validationEcrite: true }).ok).toBe(false);
    });
  }
  it("un nombre de questions hors de 3 à 6 est un défaut", async () => {
    const g = brouillonValide();
    g.questions = g.questions.slice(0, 2);
    const { redaction } = monter(g);
    const r = await redaction.proposer("AUTO-014", { script: SCRIPT });
    if (!r.ok) throw new Error("proposition attendue");
    expect(r.proposition.defauts.some((d) => d.champ === "questions")).toBe(true);
  });
});
