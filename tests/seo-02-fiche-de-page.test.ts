/**
 * SEO-02 · Fiche de page « une automatisation = une page » : les 27 champs du document SEO-01 (qui fait loi).
 * PUR et en mémoire : aucun appel réel, aucun envoi.
 */
import { describe, expect, it } from "vitest";
import {
  AUTEUR_PAR_DEFAUT,
  RELECTEUR_PAR_DEFAUT,
  BESOINS_ENTREPRISE,
  CHAMPS_REMPLIS_PAR_LE_FONDATEUR,
  STATUTS,
  TYPES_AUTOMATISATION,
  classerParHub,
  controlerFiche,
  genererDonneesStructurees,
  type ContenuFiche,
} from "@/domaine/fiche-de-page";
import { creerDepotMemoire, creerServiceFichesDePage } from "@/services/fiche-de-page";

const t = (n: number, base = "a") => (base + " ").repeat(n).slice(0, n).trim().padEnd(n, "x");
const phrases = (n: number, total: number) => {
  const dispo = total - (n - 1);
  const part = Math.floor(dispo / n);
  return Array.from({ length: n }, (_, i) => {
    const L = i === n - 1 ? dispo - part * (n - 1) : part;
    return `M${"o".repeat(L - 2)}.`;
  }).join(" ");
};

function contenuValide(): ContenuFiche {
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
    questions: [1, 2, 3].map((i) => ({ question: `${t(70, `Question ${i}`)}?`, reponse: phrases(2, 260) })),
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

function serviceEtId() {
  const svc = creerServiceFichesDePage({ depot: creerDepotMemoire(), maintenant: () => "2026-11-20" });
  const r = svc.creer("AUTO-014", "relances-clients-automatiques");
  if (!r.ok) throw new Error(r.erreurs.join());
  // les deux pages liées existent (aucun lien cassé)
  svc.creer("AUTO-020", "trier-demandes-entrantes");
  svc.creer("AUTO-021", "comptes-rendus-automatiques");
  return svc;
}

describe("listes fermées et constantes", () => {
  it("5 types, 4 besoins, 4 statuts, signature Équipe Axion-IA", () => {
    expect(TYPES_AUTOMATISATION).toHaveLength(5);
    expect(BESOINS_ENTREPRISE).toHaveLength(4);
    expect(STATUTS).toEqual(["brouillon", "a_valider", "valide", "publie"]);
    expect(AUTEUR_PAR_DEFAUT).toBe("Équipe Axion-IA");
  });
  it("champs remplis par le fondateur : fond, limites, auteur, sources", () => {
    expect([...CHAMPS_REMPLIS_PAR_LE_FONDATEUR].sort()).toEqual(["auteur", "avantApres", "limites", "pourQui", "relecteur", "sources"]);
  });
});

describe("contrôle des 27 champs", () => {
  it("un contenu conforme n'a aucun défaut", () => {
    expect(controlerFiche(contenuValide())).toEqual([]);
  });
  it("un contenu vide signale chaque champ obligatoire", () => {
    const d = controlerFiche({});
    expect(d.length).toBeGreaterThanOrEqual(20);
    expect(d.some((x) => x.champ === "limites")).toBe(true);
  });
  const cas: Array<[string, (c: ContenuFiche) => void, string]> = [
    ["titre trop court (50 à 60)", (c) => (c.titre = t(49)), "titre"],
    ["titre trop long", (c) => (c.titre = t(61)), "titre"],
    ["méta 139", (c) => (c.metaDescription = t(139)), "metaDescription"],
    ["méta 161", (c) => (c.metaDescription = t(161)), "metaDescription"],
    ["H1 39", (c) => (c.h1 = t(39)), "h1"],
    ["H1 71", (c) => (c.h1 = t(71)), "h1"],
    ["H1 identique au titre", (c) => (c.h1 = c.titre), "h1"],
    ["résumé 199", (c) => (c.resume = phrases(2, 199)), "resume"],
    ["résumé 321", (c) => (c.resume = phrases(2, 321)), "resume"],
    ["résumé d'une seule phrase", (c) => (c.resume = `${t(250)}.`), "resume"],
    ["gain 79", (c) => (c.gain = t(79)), "gain"],
    ["gain 141", (c) => (c.gain = t(141)), "gain"],
    ["pour qui : 1 puce", (c) => (c.pourQui = ["Une agence"]), "pourQui"],
    ["pour qui : 5 puces", (c) => (c.pourQui = ["a", "b", "c", "d", "e"]), "pourQui"],
    ["pour qui : puce de 61", (c) => (c.pourQui = [t(61), "ok"]), "pourQui"],
    ["avant/après : 4 lignes", (c) => (c.avantApres = { avant: ["1", "2", "3", "4"], apres: ["1", "2", "3", "4"] }), "avantApres"],
    ["étapes : 2", (c) => (c.commentCaMarche = { titre: t(40), etapes: ["a", "b"] }), "commentCaMarche"],
    ["étapes : 6", (c) => (c.commentCaMarche = { titre: t(40), etapes: ["a", "b", "c", "d", "e", "f"] }), "commentCaMarche"],
    ["étape de 121", (c) => (c.commentCaMarche = { titre: t(40), etapes: [t(121), "b", "c"] }), "commentCaMarche"],
    ["sous-titre de 29", (c) => (c.sousTitres = [{ niveau: 2, texte: t(29) }]), "sousTitres"],
    ["H3 sans H2 avant (saut de niveau)", (c) => (c.sousTitres = [{ niveau: 3, texte: t(40) }]), "sousTitres"],
    ["2 questions", (c) => (c.questions = c.questions!.slice(0, 2)), "questions"],
    ["7 questions", (c) => (c.questions = Array.from({ length: 7 }, () => c.questions![0]!)), "questions"],
    ["question de 59", (c) => (c.questions![0]!.question = t(59)), "questions"],
    ["question de 111", (c) => (c.questions![0]!.question = t(111)), "questions"],
    ["réponse de 199", (c) => (c.questions![0]!.reponse = phrases(2, 199)), "questions"],
    ["réponse de 401", (c) => (c.questions![0]!.reponse = phrases(2, 401)), "questions"],
    ["aucune limite (obligatoire)", (c) => (c.limites = []), "limites"],
    ["4 limites", (c) => (c.limites = ["a", "b", "c", "d"]), "limites"],
    ["limite de 121", (c) => (c.limites = [t(121)]), "limites"],
    ["pages liées : 1", (c) => (c.pagesLiees = [c.pagesLiees![0]!]), "pagesLiees"],
    ["pages liées : 5", (c) => (c.pagesLiees = Array.from({ length: 5 }, (_, i) => ({ texte: `Page ${i}`, adresse: `page-${i}-liee` }))), "pagesLiees"],
    ["lien « cliquez ici »", (c) => (c.pagesLiees![0]!.texte = "Cliquez ici"), "pagesLiees"],
    ["lien vers soi-même", (c) => (c.pagesLiees![0]!.adresse = c.slug!), "pagesLiees"],
    ["appel à l'action 29", (c) => (c.appelAction = t(29)), "appelAction"],
    ["appel à l'action 61", (c) => (c.appelAction = t(61)), "appelAction"],
    ["transcription vide", (c) => (c.transcription = "  "), "transcription"],
    ["vidéo : titre de 61", (c) => (c.video = { ...c.video!, titre: t(61) }), "video"],
    ["vidéo : description de 161", (c) => (c.video = { ...c.video!, description: t(161) }), "video"],
    ["vidéo : durée nulle", (c) => (c.video = { ...c.video!, dureeSec: 0 }), "video"],
    ["alt de 79", (c) => (c.images = [{ alt: t(79), decorative: false }]), "images"],
    ["alt de 126", (c) => (c.images = [{ alt: t(126), decorative: false }]), "images"],
    ["image décorative avec alt", (c) => (c.images = [{ alt: t(100), decorative: true }]), "images"],
    ["image de partage 1200×600", (c) => (c.imagePartage = { largeur: 1200, hauteur: 600 }), "imagePartage"],
    ["auteur autre que la signature d'équipe", (c) => (c.auteur = "Quelqu'un"), "auteur"],
    ["relecteur autre que la signature d'équipe", (c) => (c.relecteur = "Quelqu'un"), "relecteur"],
    ["6 sources", (c) => (c.sources = Array.from({ length: 6 }, () => ({ intitule: "Source", adresse: "https://exemple.fr/a", dateConsultation: "2026-11-01" }))), "sources"],
    ["source sans https", (c) => (c.sources = [{ intitule: "S", adresse: "ftp://x", dateConsultation: "2026-11-01" }]), "sources"],
    ["source : date de consultation fausse", (c) => (c.sources = [{ intitule: "S", adresse: "https://exemple.fr", dateConsultation: "2026-13-45" }]), "sources"],
    ["slug de 2 mots", (c) => (c.slug = "deux-mots"), "slug"],
    ["slug de 7 mots", (c) => (c.slug = "a-b-c-d-e-f-g"), "slug"],
    ["slug avec majuscule", (c) => (c.slug = "Relances-clients-auto"), "slug"],
    ["slug avec date", (c) => (c.slug = "relances-clients-2026"), "slug"],
    ["2 besoins + 1 = 3", (c) => (c.besoins = ["ne-rien-oublier", "gagner-du-temps", "repondre-plus-vite"]), "besoins"],
    ["besoin hors liste", (c) => (c.besoins = ["inconnu" as never]), "besoins"],
    ["besoin en double", (c) => (c.besoins = ["ne-rien-oublier", "ne-rien-oublier"]), "besoins"],
    ["type hors liste", (c) => (c.type = "inconnu" as never), "type"],
  ];
  const interdits: Array<[string, (c: ContenuFiche, m: string) => void, string]> = [
    ["texte de page liée", (c, m) => (c.pagesLiees![0]!.texte = m), "pagesLiees"],
    ["titre de vidéo", (c, m) => (c.video = { ...c.video!, titre: m }), "video"],
    ["description de vidéo", (c, m) => (c.video = { ...c.video!, description: m }), "video"],
    ["alt d'image", (c, m) => (c.images = [{ alt: `${m} ${t(90)}`, decorative: false }]), "images"],
    ["intitulé de source", (c, m) => (c.sources = [{ intitule: m, adresse: "https://exemple.fr/a", dateConsultation: "2026-11-01" }]), "sources"],
  ];
  it.each(interdits)("mot interdit dans : %s", (_nom, modif, champ) => {
    const c = contenuValide();
    modif(c, "Équipe certifiée Qualiopi");
    expect(controlerFiche(c)).toContainEqual({ champ, message: expect.stringMatching(/mot interdit/) });
  });
  it.each(cas)("%s", (_nom, modif, champ) => {
    const c = contenuValide();
    modif(c);
    expect(controlerFiche(c).map((d) => d.champ)).toContain(champ);
  });
  it.each([
    ["certifié", "Une équipe certifié et fiable."],
    ["Qualiopi", "Un organisme Qualiopi vous suit."],
    ["Aucun gain garanti", "Aucun gain garanti pour vous."],
    ["prix", `Dès ${40 + 9} \u20ac par mois pour vous.`],
    ["tutoiement", "Tu gagnes du temps avec toi."],
  ])("mot interdit : %s", (_nom, texte) => {
    const c = contenuValide();
    c.gain = `${texte} ${t(Math.max(0, 80 - texte.length - 1))}`.slice(0, 140).padEnd(80, "e");
    expect(controlerFiche(c)).toContainEqual({ champ: "gain", message: expect.stringMatching(/mot interdit/) });
  });
  it("la décoration permet un alt vide", () => {
    const c = contenuValide();
    c.images = [{ alt: "", decorative: true }];
    expect(controlerFiche(c)).toEqual([]);
  });
  it("le dernier défaut ne cite jamais le contenu du fondateur", () => {
    const c = contenuValide();
    c.limites = ["SECRET-FOND-123 ".repeat(20)];
    expect(JSON.stringify(controlerFiche(c))).not.toContain("SECRET-FOND-123");
  });
});

describe("service : une fiche, un statut, rien d'exposé avant validation", () => {
  it("crée en brouillon, refuse l'identifiant ou l'adresse déjà pris", () => {
    const svc = serviceEtId();
    expect(svc.lire("AUTO-014")?.statut).toBe("brouillon");
    expect(svc.creer("AUTO-014", "autre-adresse-propre").ok).toBe(false);
    expect(svc.creer("AUTO-015", "relances-clients-automatiques").ok).toBe(false);
    expect(svc.creer("pas-un-id", "adresse-propre-valide").ok).toBe(false);
  });
  it("chaque champ est modifiable à la main ; type et besoins hors liste refusés", () => {
    const svc = serviceEtId();
    const r = svc.modifier("AUTO-014", { titre: t(55), gain: t(100) });
    expect(r.ok && r.fiche.titre).toBe(t(55));
    expect(svc.modifier("AUTO-014", { type: "inconnu" as never }).ok).toBe(false);
    expect(svc.modifier("AUTO-014", { besoins: ["inconnu" as never] }).ok).toBe(false);
    expect(svc.modifier("AUTO-014", { statut: "publie" } as never).ok).toBe(false);
    expect(svc.modifier("AUTO-999", { titre: "x" }).ok).toBe(false);
  });
  it("en brouillon et à valider, les champs du fondateur ne sortent jamais du service", () => {
    const svc = serviceEtId();
    const c = contenuValide();
    c.limites = ["LIMITE-SECRETE ne fait pas le café."];
    c.pourQui = ["POUR-QUI-SECRET un", "POUR-QUI-SECRET deux"];
    c.sources = [{ intitule: "SOURCE-SECRETE", adresse: "https://exemple.fr/a", dateConsultation: "2026-11-01" }];
    const m = svc.modifier("AUTO-014", c);
    expect(JSON.stringify(m)).not.toMatch(/SECRET|LIMITE-/);
    expect(JSON.stringify(svc.lire("AUTO-014"))).not.toMatch(/SECRET|LIMITE-/);
    for (const k of CHAMPS_REMPLIS_PAR_LE_FONDATEUR) expect(svc.lire("AUTO-014")).not.toHaveProperty(k);
    // passage à valider : encore rien d'exposé
    const s = svc.soumettre("AUTO-014");
    expect(s.ok).toBe(true);
    expect(JSON.stringify(s)).not.toMatch(/SECRET|LIMITE-/);
    expect(JSON.stringify(svc.lire("AUTO-014"))).not.toMatch(/SECRET|LIMITE-/);
    expect(JSON.stringify(svc.hub())).not.toMatch(/SECRET|LIMITE-/);
  });
  it("soumettre refuse une fiche incomplète", () => {
    const svc = serviceEtId();
    const r = svc.soumettre("AUTO-014");
    expect(r.ok).toBe(false);
  });
  it("valider exige une validation écrite explicite et l'état à valider", () => {
    const svc = serviceEtId();
    svc.modifier("AUTO-014", contenuValide());
    expect(svc.valider("AUTO-014", { validationEcrite: true }).ok).toBe(false); // encore brouillon
    expect(svc.soumettre("AUTO-014").ok).toBe(true);
    expect(svc.valider("AUTO-014", { validationEcrite: false }).ok).toBe(false);
    const v = svc.valider("AUTO-014", { validationEcrite: true });
    expect(v.ok && v.fiche.statut).toBe("valide");
    const vue = svc.lire("AUTO-014");
    expect(vue?.limites).toEqual(contenuValide().limites);
    expect(vue?.auteur).toBe("Équipe Axion-IA");
  });
  it("une fiche validée expose canonique, langue fr, robots indexable et JSON-LD fidèle", () => {
    const svc = serviceEtId();
    svc.modifier("AUTO-014", contenuValide());
    svc.soumettre("AUTO-014");
    svc.valider("AUTO-014", { validationEcrite: true });
    const vue = svc.lire("AUTO-014")!;
    expect(vue.langue).toBe("fr");
    expect(vue.robots).toBe("index,follow");
    expect(vue.canonique).toContain("relances-clients-automatiques");
    const ld = JSON.stringify(vue.donneesStructurees);
    for (const type of ["WebPage", "BreadcrumbList", "FAQPage", "VideoObject"]) expect(ld).toContain(type);
    expect(ld).toContain(contenuValide().questions![0]!.reponse);
  });
  it("avant validation : noindex, pas de données structurées", () => {
    const svc = serviceEtId();
    svc.modifier("AUTO-014", contenuValide());
    const vue = svc.lire("AUTO-014")!;
    expect(vue.robots).toBe("noindex,nofollow");
    expect(vue.donneesStructurees).toBeUndefined();
  });
  it("modifier une fiche validée la ramène en brouillon (les champs du fondateur se recachent)", () => {
    const svc = serviceEtId();
    svc.modifier("AUTO-014", contenuValide());
    svc.soumettre("AUTO-014");
    svc.valider("AUTO-014", { validationEcrite: true });
    svc.modifier("AUTO-014", { gain: t(110) });
    const vue = svc.lire("AUTO-014")!;
    expect(vue.statut).toBe("brouillon");
    expect(vue).not.toHaveProperty("limites");
  });
  it("la date de mise à jour ne change que si le contenu change réellement", () => {
    let jour = "2026-11-20";
    const svc = creerServiceFichesDePage({ depot: creerDepotMemoire(), maintenant: () => jour });
    svc.creer("AUTO-014", "relances-clients-automatiques");
    svc.modifier("AUTO-014", { gain: t(100) });
    jour = "2026-11-25";
    svc.modifier("AUTO-014", { gain: t(100) });
    expect(svc.lire("AUTO-014")?.dateMiseAJour).toBe("2026-11-20");
    svc.modifier("AUTO-014", { gain: t(101) });
    expect(svc.lire("AUTO-014")?.dateMiseAJour).toBe("2026-11-25");
    expect(svc.lire("AUTO-014")?.datePublication).toBeUndefined();
  });
  it("l'adresse ne change plus après publication", () => {
    const depot = creerDepotMemoire();
    const svc = creerServiceFichesDePage({ depot, maintenant: () => "2026-11-20" });
    svc.creer("AUTO-014", "relances-clients-automatiques");
    const f = depot.lire("AUTO-014")!;
    depot.ecrire({ ...f, statut: "publie" });
    expect(svc.modifier("AUTO-014", { slug: "autre-adresse-propre" }).ok).toBe(false);
  });
  it("l'adresse reste verrouillée après une première publication, même si une modification a ramené en brouillon", () => {
    const depot = creerDepotMemoire();
    const svc = creerServiceFichesDePage({ depot, maintenant: () => "2026-11-20" });
    svc.creer("AUTO-014", "relances-clients-automatiques");
    depot.ecrire({ ...depot.lire("AUTO-014")!, statut: "publie" });
    expect(svc.modifier("AUTO-014", { gain: t(100) }).ok).toBe(true);
    expect(svc.lire("AUTO-014")?.statut).toBe("brouillon");
    expect(svc.modifier("AUTO-014", { slug: "autre-adresse-propre" }).ok).toBe(false);
    expect(svc.lire("AUTO-014")?.slug).toBe("relances-clients-automatiques");
  });
  it("soumettre refuse un titre déjà pris et un lien vers une page inexistante", () => {
    const svc = serviceEtId();
    svc.modifier("AUTO-020", { titre: contenuValide().titre });
    svc.modifier("AUTO-014", contenuValide());
    const r = svc.soumettre("AUTO-014");
    expect(!r.ok && r.erreurs.join(" ")).toMatch(/déjà utilisé/);
    svc.modifier("AUTO-020", { titre: t(52, "Autre") });
    svc.modifier("AUTO-014", { pagesLiees: [{ texte: "Page absente du site", adresse: "page-absente-du-site" }, contenuValide().pagesLiees![1]!] });
    const r2 = svc.soumettre("AUTO-014");
    expect(!r2.ok && r2.erreurs.join(" ")).toMatch(/lien cassé/);
    svc.modifier("AUTO-014", { pagesLiees: contenuValide().pagesLiees });
    expect(svc.soumettre("AUTO-014").ok).toBe(true);
  });
  it("modifier l'adresse vers une adresse déjà prise est refusé", () => {
    const svc = serviceEtId();
    expect(svc.modifier("AUTO-020", { slug: "relances-clients-automatiques" }).ok).toBe(false);
  });
  it("la vue renvoyée est une copie : la modifier ne change pas la fiche stockée", () => {
    const svc = serviceEtId();
    svc.modifier("AUTO-014", contenuValide());
    const vue = svc.lire("AUTO-014")!;
    vue.titre = "piraté";
    expect(svc.lire("AUTO-014")?.titre).not.toBe("piraté");
  });
});

describe("le hub est un classement, pas un champ", () => {
  it("classe les seules fiches validées par type et par besoin", () => {
    const svc = serviceEtId();
    svc.modifier("AUTO-014", contenuValide());
    svc.soumettre("AUTO-014");
    svc.valider("AUTO-014", { validationEcrite: true });
    svc.creer("AUTO-015", "autre-page-en-brouillon"); // brouillon : absent
    const h = svc.hub();
    expect(h.parType["relances-et-suivi"]).toEqual(["AUTO-014"]);
    expect(h.parBesoin["ne-rien-oublier"]).toEqual(["AUTO-014"]);
    expect(Object.keys(h.parType)).toEqual([...TYPES_AUTOMATISATION]);
    expect(Object.keys(h.parBesoin)).toEqual([...BESOINS_ENTREPRISE]);
    expect(JSON.stringify(h)).not.toContain("AUTO-015");
  });
  it("classerParHub ignore brouillon et à valider", () => {
    const h = classerParHub([{ id: "AUTO-001", statut: "a_valider", type: "relances-et-suivi", besoins: ["ne-rien-oublier"] }]);
    expect(h.parType["relances-et-suivi"]).toEqual([]);
  });
  it("genererDonneesStructurees reste pur", () => {
    const ld = genererDonneesStructurees(contenuValide(), "/automatisations/relances-clients-automatiques");
    expect(ld.length).toBeGreaterThanOrEqual(4);
  });
});

describe("aucun champ de la fiche ne contient de mot interdit", () => {
  it("le contenu de test conforme passe le contrôle des mots interdits", () => {
    expect(controlerFiche(contenuValide()).filter((d) => /interdit/i.test(d.message))).toEqual([]);
  });
});
