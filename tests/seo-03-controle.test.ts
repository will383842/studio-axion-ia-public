/**
 * SEO-03 · Contrôleur SEO et GEO sans IA : vert / orange / rouge, motifs en français simple.
 * PUR et en mémoire : aucun appel réel, aucun réseau (le test échoue si un appel réseau est tenté).
 */
import { describe, expect, it, vi } from "vitest";
import { AUTEUR_PAR_DEFAUT, RELECTEUR_PAR_DEFAUT, type ContenuFiche } from "@/domaine/fiche-de-page";
import { controlerSeo } from "@/domaine/controle-seo";

const t = (n: number, base = "a") => (base + " ").repeat(n).slice(0, n).trim().padEnd(n, "x");
const phrases = (n: number, total: number) => {
  const dispo = total - (n - 1);
  const part = Math.floor(dispo / n);
  return Array.from({ length: n }, (_, i) => {
    const L = i === n - 1 ? dispo - part * (n - 1) : part;
    return `M${"o".repeat(L - 2)}.`;
  }).join(" ");
};

function propre(): ContenuFiche {
  return {
    slug: "relances-clients-automatiques",
    titre: t(55, "Relances"),
    metaDescription: t(150, "meta"),
    h1: t(50, "Gagnez"),
    resume: phrases(2, 260),
    gain: t(100, "gain"),
    pourQui: ["Une petite agence", "Un cabinet de conseil"],
    avantApres: { avant: ["Relances oubliées", "Tableaux à la main"], apres: ["Relances envoyées à temps", "Suivi à jour"] },
    commentCaMarche: { titre: t(40, "Comment"), etapes: ["Vous listez vos clients", "Vous choisissez le rythme", "La relance part seule"] },
    sousTitres: [
      { niveau: 2, texte: t(40, "Partie") },
      { niveau: 3, texte: t(35, "Detail") },
    ],
    questions: [1, 2, 3].map((i) => ({ question: `${t(70, `Question ${"abc"[i - 1]}`)}?`, reponse: phrases(2, 260) })),
    limites: ["Elle ne rédige pas de réponse personnalisée à chaque client."],
    type: "relances-et-suivi",
    besoins: ["ne-rien-oublier"],
    pagesLiees: [
      { texte: "Trier les demandes entrantes", adresse: "trier-demandes-entrantes" },
      { texte: "Comptes rendus automatiques", adresse: "comptes-rendus-automatiques" },
    ],
    appelAction: t(40, "Demandez"),
    transcription: "Bonjour. Voici comment relancer vos clients sans rien oublier.",
    video: { titre: t(50, "Video"), description: t(120, "desc"), dureeSec: 95 },
    images: [{ alt: t(100, "image"), decorative: false }],
    imagePartage: { largeur: 1200, hauteur: 630 },
    auteur: AUTEUR_PAR_DEFAUT,
    relecteur: RELECTEUR_PAR_DEFAUT,
    sources: [],
  };
}

describe("SEO-03 · critères de la fiche", () => {
  it("une fiche complète et propre est verte, sans appel réseau", () => {
    const fetchEspion = vi.spyOn(globalThis, "fetch");
    const r = controlerSeo(propre());
    expect(r).toEqual({ niveau: "vert", motifs: [] });
    expect(fetchEspion).not.toHaveBeenCalled();
    fetchEspion.mockRestore();
  });

  it("deux H1 (un sous-titre de niveau 1) : rouge, motif en français simple", () => {
    const c = propre();
    c.sousTitres = [{ niveau: 1 as unknown as 2, texte: t(40, "Second") }, ...(c.sousTitres ?? [])];
    const r = controlerSeo(c);
    expect(r.niveau).toBe("rouge");
    expect(r.motifs.some((m) => m.champ === "h1" && /un seul/i.test(m.message))).toBe(true);
  });

  it("sans méta-description : rouge, motif nommant la méta-description", () => {
    const c = propre();
    delete c.metaDescription;
    const r = controlerSeo(c);
    expect(r.niveau).toBe("rouge");
    expect(r.motifs.some((m) => m.champ === "metaDescription" && /méta-description/i.test(m.message))).toBe(true);
  });

  it("le mot « certifié » est refusé (rouge), sans recopier le texte contrôlé", () => {
    const c = propre();
    c.gain = `${t(90, "gain")} certifié`;
    const r = controlerSeo(c);
    expect(r.niveau).toBe("rouge");
    expect(r.motifs.some((m) => m.champ === "gain" && /certifi/i.test(m.message))).toBe(true);
    expect(JSON.stringify(r)).not.toContain(c.gain);
  });
});

describe("SEO-03 · niveaux et motifs", () => {
  it("une longueur hors plage est orange (à corriger), pas rouge", () => {
    const c = propre();
    c.titre = t(30, "Court");
    const r = controlerSeo(c);
    expect(r.niveau).toBe("orange");
    expect(r.motifs.every((m) => m.niveau === "orange")).toBe(true);
  });

  it("le niveau global est le plus grave des motifs", () => {
    const c = propre();
    c.titre = t(30, "Court");
    delete c.limites;
    expect(controlerSeo(c).niveau).toBe("rouge");
  });

  it("limites honnêtes absentes : rouge (obligatoires)", () => {
    const c = propre();
    c.limites = [];
    const r = controlerSeo(c);
    expect(r.niveau).toBe("rouge");
    expect(r.motifs.some((m) => m.champ === "limites")).toBe(true);
  });

  it("signature autre que « Équipe Axion-IA » : rouge", () => {
    const c = propre();
    c.auteur = "Une personne";
    const r = controlerSeo(c);
    expect(r.niveau).toBe("rouge");
    expect(r.motifs.some((m) => m.champ === "auteur")).toBe(true);
  });

  it("types et besoins hors liste fermée : rouge", () => {
    const c = propre();
    (c as { type?: string }).type = "autre";
    (c as { besoins?: string[] }).besoins = ["inconnu"];
    const r = controlerSeo(c);
    expect(r.niveau).toBe("rouge");
    expect(r.motifs.filter((m) => m.champ === "type" || m.champ === "besoins")).toHaveLength(2);
  });

  it("hiérarchie H2/H3 avec saut : orange ou plus", () => {
    const c = propre();
    c.sousTitres = [{ niveau: 3, texte: t(40, "Saut") }];
    const r = controlerSeo(c);
    expect(r.motifs.some((m) => m.champ === "sousTitres")).toBe(true);
    expect(r.niveau).not.toBe("vert");
  });

  it("texte alternatif trop court ou absent : motif sur les images", () => {
    const c = propre();
    c.images = [{ alt: "", decorative: false }];
    const r = controlerSeo(c);
    expect(r.motifs.some((m) => m.champ === "images")).toBe(true);
    expect(r.niveau).not.toBe("vert");
  });

  it("résumé citable ou questions absents : rouge", () => {
    const c = propre();
    delete c.resume;
    c.questions = [];
    const r = controlerSeo(c);
    expect(r.niveau).toBe("rouge");
    expect(r.motifs.some((m) => m.champ === "resume")).toBe(true);
    expect(r.motifs.some((m) => m.champ === "questions")).toBe(true);
  });

  it("« Grenoble » (ville du fondateur) en communication : rouge", () => {
    const c = propre();
    c.resume = `${phrases(2, 260)} Grenoble.`;
    const r = controlerSeo(c);
    expect(r.niveau).toBe("rouge");
    expect(r.motifs.some((m) => m.champ === "resume" && /ville/i.test(m.message))).toBe(true);
  });

  it("noms interdits passés en option (prénom du fondateur) : rouge, sans les citer", () => {
    const c = propre();
    c.gain = `${t(80, "gain")} par Zorglub`;
    const r = controlerSeo(c, { nomsInterdits: ["Zorglub"] });
    expect(r.niveau).toBe("rouge");
    expect(JSON.stringify(r)).not.toMatch(/zorglub/i);
  });

  it("chiffre sans source : orange ; avec une source : vert", () => {
    const c = propre();
    c.gain = `${t(90, "gain")} 40 %`;
    expect(controlerSeo(c).niveau).toBe("orange");
    c.sources = [{ intitule: "Étude publique", adresse: "https://exemple.fr/etude", dateConsultation: "2026-11-01" }];
    expect(controlerSeo(c).niveau).toBe("vert");
  });

  it("témoignage ou formule d'avis client : rouge", () => {
    const c = propre();
    c.gain = `${t(80, "gain")} témoignage`;
    expect(controlerSeo(c).niveau).toBe("rouge");
  });

  it("tutoiement : rouge", () => {
    const d = propre();
    d.gain = `${t(90, "gain")} tu gagnes`;
    expect(controlerSeo(d).niveau).toBe("rouge");
  });

  it("résumé avec « ici » ou « notre solution » : orange", () => {
    const c = propre();
    c.resume = `${c.resume} Notre solution relance.`;
    const r = controlerSeo(c);
    expect(r.motifs.some((m) => m.champ === "resume")).toBe(true);
    expect(r.niveau).not.toBe("vert");
  });

  it("titre ou adresse déjà pris par une autre page : orange", () => {
    const c = propre();
    const r = controlerSeo(c, { titresExistants: [c.titre!], adressesExistantes: [c.slug!] });
    expect(r.niveau).toBe("orange");
    expect(r.motifs.map((m) => m.champ).sort()).toEqual(["slug", "titre"]);
  });

  it("brouillon vide : rouge, plusieurs motifs, aucun plantage", () => {
    const r = controlerSeo({});
    expect(r.niveau).toBe("rouge");
    expect(r.motifs.length).toBeGreaterThan(5);
  });
});

describe("SEO-03 · reprise de la relecture (tour 1)", () => {
  const avecGain = (suite: string) => ({ ...propre(), gain: `${t(80, "gain")} ${suite}` });

  it("chiffres en nombre, en lettres ou avec une unité : orange sans source", () => {
    for (const suite of ["5 heures par semaine", "deux fois plus de relances", "trois clients"]) {
      const r = controlerSeo(avecGain(suite));
      expect(r.niveau, suite).toBe("orange");
      expect(r.motifs.some((m) => m.champ === "gain" && /chiffre/i.test(m.message)), suite).toBe(true);
    }
  });

  it("le contrôleur de texte existant est branché : « grenoblois » et « Aucun gain garanti » sont rouges", () => {
    expect(controlerSeo(avecGain("pour les grenoblois")).niveau).toBe("rouge");
    expect(controlerSeo(avecGain("Aucun gain garanti")).niveau).toBe("rouge");
  });

  it("l'adresse publique est contrôlée : slug et adresses des pages liées", () => {
    const c = propre();
    c.slug = "relances-clients-grenoble";
    const r = controlerSeo(c);
    expect(r.niveau).toBe("rouge");
    expect(r.motifs.some((m) => m.champ === "slug")).toBe(true);
    const d = propre();
    d.pagesLiees = [{ texte: "Trier les demandes entrantes", adresse: "trier-demandes-zorglub" }, d.pagesLiees![1]];
    expect(controlerSeo(d, { nomsInterdits: ["Zorglub"] }).motifs.some((m) => m.champ === "pagesLiees")).toBe(true);
    const e = propre();
    e.slug = "relances-zorglub-clients";
    expect(controlerSeo(e, { nomsInterdits: ["Zorglub"] }).niveau).toBe("rouge");
  });

  it("noms interdits : mot entier seulement (« Marc » n'interdit pas « marche » ni « marché »)", () => {
    const c = propre();
    c.gain = `${t(80, "gain")} le marché`;
    c.commentCaMarche = { titre: t(40, "Comment ça marche"), etapes: c.commentCaMarche!.etapes };
    expect(controlerSeo(c, { nomsInterdits: ["Marc"] }).niveau).toBe("vert");
    c.gain = `${t(80, "gain")} par Marc`;
    expect(controlerSeo(c, { nomsInterdits: ["Marc"] }).niveau).toBe("rouge");
  });

  it("superlatifs et classements : orange", () => {
    const r = controlerSeo(avecGain("la meilleure solution du marché, leader du secteur"));
    expect(r.niveau).not.toBe("vert");
    expect(r.motifs.some((m) => m.champ === "gain" && /classement|superlatif/i.test(m.message))).toBe(true);
  });

  it("une source invalide ne valide pas les chiffres", () => {
    const c = avecGain("40 %");
    c.sources = [{ intitule: "Étude", adresse: "pas une url", dateConsultation: "nope" }];
    const r = controlerSeo(c);
    expect(r.motifs.some((m) => m.champ === "gain" && /chiffre/i.test(m.message))).toBe(true);
  });

  it("doublons comparés sans tenir compte de la casse, des accents ni des espaces", () => {
    const c = propre();
    const r = controlerSeo(c, { titresExistants: [`  ${c.titre!.toUpperCase()} `], adressesExistantes: [c.slug!.toUpperCase()] });
    expect(r.motifs.map((m) => m.champ).sort()).toEqual(["slug", "titre"]);
  });

  it("classement fixé : champ vide, mot interdit, hors liste, signature, valeur en double = rouge ; longueur = orange", () => {
    const rouge = (c: ContenuFiche) => controlerSeo(c).niveau === "rouge";
    expect(rouge({ ...propre(), h1: "" })).toBe(true);
    expect(rouge({ ...propre(), gain: `${t(90, "gain")} certifié` })).toBe(true);
    expect(rouge({ ...propre(), type: "x" as never })).toBe(true);
    expect(rouge({ ...propre(), relecteur: "Quelqu'un" })).toBe(true);
    expect(rouge({ ...propre(), besoins: ["ne-rien-oublier", "ne-rien-oublier"] })).toBe(true);
    expect(controlerSeo({ ...propre(), metaDescription: t(100, "meta") }).niveau).toBe("orange");
  });
});
