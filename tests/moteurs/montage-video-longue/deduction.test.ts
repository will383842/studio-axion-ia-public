import { describe, expect, it } from "vitest";
import type { FormeLongue } from "../../../src/moteurs/montage-video-longue/storyboard-types";
import {
  abreger,
  decouperPhrases,
  deduireScenes,
  estEchelonnee,
  estImperatif,
  formePour,
  indiceCoupe,
  majuscule,
  motCle,
  phraseDe,
  repartirEtapes,
  type ContexteDeduction,
  type PhraseLue,
} from "../../../src/moteurs/montage-video-longue/deduction";

/** Phrase lue à 2,6 mots/s à partir de `debutMs`, fenêtre de 300 ms de respiration comprise. */
function phrase(texte: string, debutMs = 0, duree?: number): PhraseLue {
  const ws = texte.split(/\s+/);
  const d = duree ?? Math.max(2000, (ws.length / 2.6) * 1000);
  const mots = ws.map((mot, k) => ({ mot, debutMs: Math.round(debutMs + (k * d) / ws.length), finMs: Math.round(debutMs + ((k + 1) * d) / ws.length) }));
  return phraseDe(mots, Math.round(debutMs + d + 300));
}
/** Suite de phrases contiguës. */
function suite(...textes: string[]): PhraseLue[] {
  const res: PhraseLue[] = [];
  let t = 1000;
  for (const x of textes) {
    const p = phrase(x, t);
    res.push(p);
    t = p.finMs;
  }
  return res;
}
const ctx = (titre = "", texteChapitre = ""): ContexteDeduction => ({ titre, texteChapitre, etat: { forme: null } });
const un = (texte: string, c = ctx()) => deduireScenes(suite(texte), c).map((x) => x.scene);

describe("impératif", () => {
  it.each([
    "Commencez petit.",
    "Choisissez les vingt articles qui se vendent le plus.",
    "Ensuite, ouvrez les réglages.",
    "D'abord, vérifiez la liste.",
    "Puis cliquez sur Enregistrer.",
    "Enfin, envoyez le message.",
    "N'oubliez pas la sauvegarde.",
    "Ajoutez ensuite le reste du catalogue.",
    "Reliez-le à votre outil.",
    "Allez dans les réglages.",
  ])("« %s » est un impératif", (t) => expect(estImperatif(t)).toBe(true));

  // Jeu de phrases piégées : jamais une étape.
  it.each([
    "Chez nous, tout est simple.",
    "Assez parlé, voyons les chiffres.",
    "Nez à nez avec une rupture.",
    "Vous choisissez les articles.",
    "Vous pouvez commencer petit.",
    "Nous reliez-vous au tableur.",
    "Avez-vous vérifié les chiffres ?",
    "Pouvez-vous nous appeler ?",
    "Rendez-vous lundi matin.",
    "Le rez-de-chaussée est plein.",
    "Les chiffres sont faux dès le lendemain.",
    "Une rupture se découvre quand un client appelle.",
    "On commande alors en urgence, plus cher.",
    "Pour en parler avec nous, prenez rendez-vous.",
    "Beaucoup de dirigeants suivent encore leur stock.",
    "Vous savez avant de manquer.",
    "Ensuite vous cliquez sur le bouton.",
    "Vous verrez, chaque lundi matin, un résumé.",
    "Pourquoi commencez-vous si petit ?",
    "Que choisissez ?",
  ])("« %s » n'est pas un impératif", (t) => expect(estImperatif(t)).toBe(false));
});

describe("étapes", () => {
  it("une seule phrase à l'impératif ne fait pas une scène d'étapes", () => {
    const [s] = un("Commencez petit.");
    expect(s.type).not.toBe("etapes");
  });

  it("repartirEtapes : 3 au plus par scène (texte de 64 px et plus), réparties à égalité", () => {
    expect(repartirEtapes(2)).toEqual([2]);
    expect(repartirEtapes(3)).toEqual([3]);
    expect(repartirEtapes(4)).toEqual([2, 2]);
    expect(repartirEtapes(5)).toEqual([3, 2]);
    expect(repartirEtapes(6)).toEqual([3, 3]);
    expect(repartirEtapes(7)).toEqual([3, 2, 2]);
  });

  it("numéros continus, apparition à la lecture de chaque étape, accent = nombre du texte", () => {
    const ph = suite("Ouvrez le tableur.", "Choisissez dix articles.", "Reliez la caisse.", "Vérifiez les totaux.", "Fermez le fichier.", "Archivez le fichier.");
    const sc = deduireScenes(ph, ctx()).map((x) => x.scene);
    expect(sc.map((s) => s.type)).toEqual(["etapes", "etapes"]);
    if (sc[0].type !== "etapes" || sc[1].type !== "etapes") return;
    expect([sc[0].numeroDepart, sc[1].numeroDepart]).toEqual([1, 4]);
    expect(sc[0].elements.map((e) => e.apparitionMs)).toEqual(ph.slice(0, 3).map((p) => p.debutMs));
    expect(sc[0].elements[1].accent).toBe("dix");
    expect(sc[0].finMs).toBe(sc[1].debutMs);
  });

  it("le texte d'une étape est la phrase entière, jamais abrégée", () => {
    const long = "Ouvrez " + Array.from({ length: 40 }, (_, i) => `mot${i}`).join(" ") + ".";
    const sc = deduireScenes(suite(long, "Fermez tout."), ctx()).map((x) => x.scene);
    if (sc[0].type !== "etapes") throw new Error("type");
    expect(sc[0].elements[0].texte).toBe(long.replace(/\.$/, ""));
  });
});

describe("liste", () => {
  it("« : » + éléments séparés par virgules et « et » ; compte = nombre écrit égal", () => {
    const [s] = un("En haut, trois chiffres : la valeur du stock, les articles bientôt épuisés, et les commandes en attente.");
    expect(s.type).toBe("liste");
    if (s.type !== "liste") return;
    expect(s.titre).toBe("En haut, trois chiffres");
    expect(s.elements).toHaveLength(3);
    expect(s.compte).toBe(3);
  });
  it("compte nul quand le nombre écrit diffère du nombre d'éléments", () => {
    const [s] = un("Il y a quatre points : le prix, le délai et la qualité.");
    if (s.type !== "liste") throw new Error("type");
    expect(s.elements).toHaveLength(3);
    expect(s.compte).toBeNull();
  });
  it("« ou » sépare aussi", () => {
    const [s] = un("Vous pouvez choisir : le mail ou le téléphone.");
    if (s.type !== "liste") throw new Error("type");
    expect(s.elements.map((e) => e.texte)).toEqual(["Le mail", "Le téléphone"]);
  });
  it("sans « : » : au moins 3 éléments de 4 mots au plus", () => {
    const [s] = un("Prix, délai, qualité et service.");
    if (s.type !== "liste") throw new Error("type");
    expect(s.titre).toBeNull();
    expect(s.elements.map((e) => e.texte)).toEqual(["Prix", "Délai", "Qualité", "Service"]);
  });
  it("sans « : » : deux éléments, ou éléments trop longs → pas une liste", () => {
    expect(un("Chaque fin de mois, quelqu'un passe une journée entière à compter les étagères.")[0].type).toBe("phrase-cle");
    expect(un("Juste en dessous, la liste des articles à commander, triée par urgence.")[0].type).toBe("phrase-cle");
  });
  it("plus de 6 éléments ou un élément de plus de 12 mots → pas une liste", () => {
    expect(un("Voici : a, b, c, d, e, f, g et h.")[0].type).not.toBe("liste");
    const long = Array.from({ length: 13 }, (_, i) => `m${i}`).join(" ");
    expect(un(`Voici : ${long}, et autre chose.`)[0].type).not.toBe("liste");
  });
  it("un seul élément après « : » → pas une liste", () => {
    expect(un("Plus besoin de compter : le stock est juste.")[0].type).toBe("avant-apres");
    expect(un("Le message dit une chose : acheter.")[0].type).not.toBe("liste");
  });
});

describe("avant / après", () => {
  it("« plus besoin de X : Y »", () => {
    const [s] = un("Plus besoin de compter : le stock est juste à chaque instant.");
    if (s.type !== "avant-apres") throw new Error("type");
    expect([s.avant, s.apres]).toEqual(["Compter", "Le stock est juste à chaque instant"]);
  });
  it("« plus besoin de X, Y »", () => {
    const [s] = un("Plus besoin de tableur, tout se met à jour seul.");
    if (s.type !== "avant-apres") throw new Error("type");
    expect([s.avant, s.apres]).toEqual(["Tableur", "Tout se met à jour seul"]);
  });
  it("« X, et plus jamais Y » n'est PAS un avant/après (le sens serait retourné) : phrase clé, phrase entière citée telle quelle", () => {
    const [s] = un("Vous savez avant de manquer, et plus jamais par un client mécontent.");
    expect(s.type).toBe("phrase-cle");
    if (s.type === "phrase-cle") expect(s.phrase).toBe("Vous savez avant de manquer, et plus jamais par un client mécontent");
  });
  it("« au lieu de X, Y »", () => {
    const [s] = un("Au lieu de recopier, vous cliquez une fois.");
    if (s.type !== "avant-apres") throw new Error("type");
    expect([s.avant, s.apres]).toEqual(["Recopier", "Vous cliquez une fois"]);
  });
  it("« Avant, X. » puis « Maintenant, Y. » : une scène pour les deux phrases", () => {
    const ph = suite("Avant, on comptait à la main.", "Maintenant, le tableau se met à jour seul.", "Une autre phrase de plus.");
    const r = deduireScenes(ph, ctx());
    const s = r[0].scene;
    if (s.type !== "avant-apres") throw new Error("type");
    expect([s.avant, s.apres]).toEqual(["On comptait à la main", "Le tableau se met à jour seul"]);
    expect(s.debutMs).toBe(ph[0].debutMs);
    expect(s.finMs).toBe(ph[1].finMs);
    expect(s.apparitionApresMs).toBeGreaterThanOrEqual(ph[1].debutMs);
    expect(s.apparitionApresMs).toBeLessThan(s.finMs);
    expect(r).toHaveLength(2);
  });
  it("un côté manque → phrase clé avec « plus besoin » / « plus jamais » en mot clé", () => {
    const [a] = un("Plus besoin.");
    expect(a.type).toBe("phrase-cle");
    if (a.type === "phrase-cle") expect(a.motCle).toBe("Plus besoin");
    const [b] = un("Et plus jamais.");
    if (b.type !== "phrase-cle") throw new Error("type");
    expect(b.motCle).toBe("plus jamais");
  });
  it("« Avant, X. » sans « Maintenant » ensuite n'est pas un avant/après", () => {
    expect(deduireScenes(suite("Avant, on comptait.", "Puis le temps a passé."), ctx())[0].scene.type).toBe("phrase-cle");
  });
});

describe("chiffre", () => {
  it("uniquement quand la phrase contient un nombre écrit", () => {
    expect(un("Un clic sur un article montre son historique sur douze mois.")[0].type).toBe("chiffre");
    expect(un("Une journée entière à compter.")[0].type).toBe("phrase-cle");
    expect(un("Un client appelle.")[0].type).toBe("phrase-cle");
  });
  it("deux chiffres au plus, chacun à son instant de lecture, valeur et affichage fidèles", () => {
    const p = phrase("Le coût passe de 1 200 € à 800 € pour 3 mois et 4 jours.");
    const [s] = deduireScenes([p], ctx()).map((x) => x.scene);
    if (s.type !== "chiffre") throw new Error("type");
    expect(s.chiffres).toHaveLength(2);
    expect(s.chiffres.map((c) => [c.valeur, c.affiche])).toEqual([
      [1200, "1 200 €"],
      [800, "800 €"],
    ]);
    expect(s.chiffres[0].apparitionMs).toBeLessThan(s.chiffres[1].apparitionMs);
    expect(s.contexte).toBe("Le coût passe de 1 200 € à 800 € pour 3 mois et 4 jours");
  });
  it("décimales et pourcentage", () => {
    const [s] = un("Le gain atteint 12,5 % du stock.");
    if (s.type !== "chiffre") throw new Error("type");
    expect(s.chiffres[0]).toMatchObject({ valeur: 12.5, ecrit: "12,5 %", affiche: "12,5 %" });
  });
});

describe("phrase clé", () => {
  it("jamais de fond nu : toute phrase donne une scène avec texte et forme", () => {
    for (const t of ["Bonjour.", "Oui ?", "Voilà pourquoi tout change autour de vous, dès aujourd'hui, pour de bon et sans détour.", "Ah."]) {
      const [s] = un(t);
      if (s.type !== "phrase-cle") continue;
      expect(s.phrase.length).toBeGreaterThan(0);
      expect(s.forme).toBeTruthy();
    }
  });
  it("une phrase de 20 mots au plus s'affiche entière, sans « … »", () => {
    const t = "Chaque matin, quelqu'un ouvre le tableur pour recopier toutes les lignes du stock de la veille.";
    const [a] = un(t, ctx("Le stock", ""));
    if (a.type !== "phrase-cle") throw new Error("type");
    expect(a.phrase).toBe(t.replace(/\.$/, ""));
    const t20 = Array.from({ length: 20 }, (_, i) => `mot${i}`).join(" ");
    const [b] = un(`${t20}.`);
    if (b.type !== "phrase-cle") throw new Error("type");
    expect(b.phrase).toBe(majuscule(t20));
  });
  it.each([
    "Beaucoup de dirigeants suivent encore leur stock dans un tableur rempli à la main.",
    "Chaque fin de mois, quelqu'un passe une journée entière à compter les étagères du dépôt.",
    "Personne ne sait vraiment ce qui dort au fond de l'entrepôt et ce qui manque depuis des semaines.",
  ])("piège : « %s » n'est jamais tronquée", (t) => {
    const sc = un(t);
    for (const s of sc) expect(JSON.stringify(s)).not.toContain("…");
    expect(sc.map((s) => (s.type === "phrase-cle" ? s.phrase : "")).join(" ")).toBe(majuscule(t.replace(/\.$/, "")));
  });
  it.each([
    "Chaque lundi matin, un résumé de toute la semaine précédente arrive dans votre boîte, avec les articles à surveiller et les commandes déjà passées.",
    "Quand le stock passe sous le seuil fixé pour un article, le tableau de bord prévient la personne concernée et propose la quantité à commander ensuite.",
    "Un mot après l'autre sans la moindre virgule jusqu'à la fin de cette très très longue phrase ici présente et encore plus loin que prévu.",
  ])("piège : au-delà de 20 mots, deux scènes complètes sans « … » : « %s »", (t) => {
    const sc = un(t);
    expect(sc.length).toBeGreaterThanOrEqual(2);
    for (const s of sc) {
      if (s.type !== "phrase-cle") throw new Error("type");
      expect(s.phrase).not.toContain("…");
      expect(s.phrase.split(/\s+/).length).toBeLessThanOrEqual(20);
    }
    const ph = sc.map((s) => (s.type === "phrase-cle" ? s.phrase : ""));
    const n = (x: string) => x.toLowerCase().replace(/[\s,;:.]+/g, " ").trim();
    expect(n(ph.join(" "))).toBe(n(t));
  });
  it("mot clé : hors mots vides, favorise le titre du chapitre et les répétitions", () => {
    expect(motCle("Le stock est vraiment très important chaque jour.", { titre: "", texteChapitre: "" })).toBe("important");
    expect(motCle("Le stock est vraiment très important chaque jour.", { titre: "Le stock", texteChapitre: "" })).toBe("stock");
    expect(motCle("Le stock est vraiment très important chaque jour.", { titre: "", texteChapitre: "jour jour jour" })).toBe("jour");
    expect(motCle("Le est la de ça.", { titre: "", texteChapitre: "" })).toBeNull();
  });
  it("le mot clé est une sous-chaîne exacte de la phrase affichée", () => {
    for (const t of ["Le stock est juste à chaque instant.", "Chaque lundi matin, un résumé de la semaine arrive dans votre boîte."]) {
      const [s] = un(t);
      if (s.type !== "phrase-cle") throw new Error("type");
      if (s.motCle) expect(s.phrase).toContain(s.motCle);
    }
  });
  it("formes d'après les mots du texte", () => {
    expect(formePour("Chaque instant compte", null)).toBe("horloge");
    expect(formePour("Chaque lundi matin", null)).toBe("horloge");
    expect(formePour("Toute la semaine", null)).toBe("calendrier");
    expect(formePour("Une rupture arrive", null)).toBe("alerte");
    expect(formePour("Fixez un seuil", null)).toBe("cible");
    expect(formePour("C'est juste", null)).toBe("coche");
    expect(formePour("La valeur du stock", null)).toBe("graphique");
    expect(formePour("Pour commander vite", null)).toBe("liste");
    expect(formePour("On envoie vite", null)).toBe("horloge");
    expect(formePour("Un message part", null)).toBe("cloche");
    expect(formePour("Un tableur rempli à la main", null)).toBe("tableur");
    expect(formePour("Vous savez avant de manquer, et plus jamais par un client", null)).toBe("bouclier");
    expect(formePour("Le stock est juste", null)).toBe("coche");
    expect(formePour("Rien de spécial ici", null)).toBe("horloge");
  });
  it("jamais deux fois la même forme dans un chapitre si une autre convient", () => {
    const deja: FormeLongue[] = [];
    for (let i = 0; i < 4; i++) deja.push(formePour("Le stock du jour", deja[deja.length - 1] ?? null, "", deja));
    expect(new Set(deja).size).toBe(4);
  });
  it("jamais le triangle pour une phrase positive", () => {
    for (const t of ["Vous savez avant de manquer", "Plus jamais de rupture", "Le stock est juste"]) expect(formePour(t, null)).not.toBe("alerte");
  });
  it("jamais deux formes de suite", () => {
    expect(formePour("Le tableau du stock", "graphique")).not.toBe("graphique");
    expect(formePour("Rien de spécial", "horloge")).not.toBe("horloge");
    const c = ctx();
    const sc = deduireScenes(suite("Le stock du tableau est là.", "La valeur du stock monte.", "Les ventes montent."), c).map((x) => x.scene);
    const formes = sc.filter((s) => s.type === "phrase-cle").map((s) => (s.type === "phrase-cle" ? s.forme : ""));
    formes.forEach((f, i) => i > 0 && expect(f).not.toBe(formes[i - 1]));
  });
});

describe("variété et scènes longues", () => {
  it("six phrases clés de suite : jamais 4 du même type, la liste reprend des phrases du texte", () => {
    const ph = suite("Le premier point compte beaucoup.", "Le deuxième point reste simple.", "Le troisième point surprend tout le monde.", "Le quatrième point arrive vite.", "Le cinquième point fait la différence.", "Le sixième point conclut bien.");
    const sc = deduireScenes(ph, ctx());
    const types = sc.map((x) => x.scene.type);
    for (let i = 3; i < types.length; i++) expect(types.slice(i - 3, i + 1).every((t) => t === types[i])).toBe(false);
    expect(types).toContain("liste");
    const l = sc.find((x) => x.scene.type === "liste")!;
    if (l.scene.type !== "liste") return;
    expect(l.scene.titre).toBeNull();
    expect(l.scene.elements.length).toBeGreaterThanOrEqual(2);
    l.scene.elements.forEach((e, i) => expect(e.apparitionMs).toBe(l.sources[i].debutMs));
    // contiguïté
    sc.forEach((x, i) => i + 1 < sc.length && expect(x.scene.finMs).toBe(sc[i + 1].scene.debutMs));
    expect(sc[0].scene.debutMs).toBe(ph[0].debutMs);
    expect(sc[sc.length - 1].scene.finMs).toBe(ph[ph.length - 1].finMs);
  });

  it("une phrase de plus de 8 s sans arrivées échelonnées est coupée en deux scènes contiguës", () => {
    const longue = phrase("Le tableau de bord montre tout ce qui se passe dans l'entrepôt, de la réception des colis jusqu'à la préparation des commandes, sans aucun tableur à recopier.", 0, 11_000);
    const sc = deduireScenes([longue], ctx()).map((x) => x.scene);
    expect(sc.length).toBeGreaterThanOrEqual(2);
    expect(sc[0].debutMs).toBe(longue.debutMs);
    expect(sc[sc.length - 1].finMs).toBe(longue.finMs);
    sc.forEach((s, i) => {
      expect(s.finMs - s.debutMs).toBeLessThanOrEqual(9000);
      if (i + 1 < sc.length) expect(s.finMs).toBe(sc[i + 1].debutMs);
    });
  });

  it("estEchelonnee : scène courte toujours bonne ; longue sans élément qui arrive : mauvaise", () => {
    expect(estEchelonnee({ type: "phrase-cle", debutMs: 0, finMs: 5000, phrase: "x", motCle: null, forme: "cercle" })).toBe(true);
    expect(estEchelonnee({ type: "phrase-cle", debutMs: 0, finMs: 9500, phrase: "x", motCle: null, forme: "cercle" })).toBe(false);
    expect(estEchelonnee({ type: "avant-apres", debutMs: 0, finMs: 12000, avant: "a", apres: "b", apparitionApresMs: 6000 })).toBe(true);
    expect(estEchelonnee({ type: "avant-apres", debutMs: 0, finMs: 12000, avant: "a", apres: "b", apparitionApresMs: 800 })).toBe(false);
  });
});

describe("outils de texte", () => {
  it("abreger (titres) : coupe à la virgule d'abord, au mot sinon, jamais de « … »", () => {
    expect(abreger("Un deux trois.", 5)).toBe("Un deux trois");
    expect(abreger("Un deux trois quatre, cinq six sept huit neuf dix.", 6)).toBe("Un deux trois quatre");
    expect(abreger("a b c d e f g h", 4)).toBe("a b c d");
  });
  it("decouperPhrases : jusqu'à [.!?…], reste sans ponctuation = dernière phrase", () => {
    const m = (mot: string, i: number) => ({ mot, debutMs: i * 100, finMs: i * 100 + 90 });
    const r = decouperPhrases(["Bonjour", "à", "tous.", "Vous", "allez", "bien ?", "Oui"].map(m));
    expect(r.map((g) => g.map((x) => x.mot).join(" "))).toEqual(["Bonjour à tous.", "Vous allez bien ?", "Oui"]);
  });
});

describe("QUALL-7 · listes de phrases sans titre (variété)", () => {
  const phrasesVariete = [
    "Dès que le stock passe sous ce seuil, un message part automatiquement à la bonne personne.",
    "Le message dit quoi commander et en quelle quantité.",
    "Chaque lundi matin, un résumé de la semaine arrive dans votre boîte.",
    "Le tableau garde la trace de chaque mouvement.",
  ];
  it("chaque élément est une phrase entière, jamais un morceau amputé", () => {
    const sc = deduireScenes(suite(...phrasesVariete), ctx("Les alertes", "")).map((x) => x.scene);
    const listes = sc.filter((s) => s.type === "liste");
    expect(listes.length).toBeGreaterThan(0);
    const toutes = phrasesVariete.map((p) => p.replace(/\.$/, ""));
    for (const l of listes) {
      if (l.type !== "liste") continue;
      for (const e of l.elements) expect(toutes.map(majuscule)).toContain(e.texte);
    }
  });
  it.each([
    ["Dès que le stock passe sous ce seuil, un message part automatiquement à la bonne personne."],
    ["Quand une rupture menace, la bonne personne est prévenue sans qu'il faille y penser une seule fois."],
    ["Si le stock baisse trop vite, un message vous le dit avant que le client appelle."],
  ])("piège : une subordonnée en ouverture n'est pas coupée seule (« %s »)", (t) => {
    const p = phrase(t, 0, 11_000);
    const sc = deduireScenes([p], ctx()).map((x) => x.scene);
    expect(indiceCoupe(p.mots, true)).toBeNull();
    expect(sc).toHaveLength(1);
  });
});

describe("QUALL-7 · choix de la forme", () => {
  it.each([
    ["Juste en dessous, la liste des articles à commander, triée par urgence", "liste"],
    ["Un clic montre l'historique des ruptures et des urgences", "liste"],
    ["Le tableau est trié par urgence", "liste"],
  ])("piège : « %s » → %s (avant urgence → alerte)", (t, f) => {
    expect(formePour(t, null)).toBe(f);
  });
  it("sans ces mots, urgence reste alerte", () => {
    expect(formePour("On commande alors en urgence, plus cher", null)).toBe("alerte");
  });
  it.each(["Une rupture est vite arrivée", "L'urgence disparaît", "Plus de problème de stock"])("dans « La solution… », pas d'alerte sans le mot « alerte » : %s", (t) => {
    expect(formePour(t, null, "La solution : un tableau de bord")).not.toBe("alerte");
  });
  it("dans « La solution… », le mot « alerte » écrit donne la cloche (le triangle reste interdit)", () => {
    expect(formePour("Une alerte part tout de suite", null, "La solution : un tableau de bord")).toBe("cloche");
    expect(formePour("Une rupture est une alerte rouge", null, "La solution : un tableau de bord")).toBe("cloche");
  });
  it("jamais la même forme que la précédente, même si le titre ou le texte la désigne", () => {
    expect(formePour("Le tableau du stock", "graphique")).not.toBe("graphique");
    expect(formePour("Rien de spécial ici", "cercle", "Les alertes")).not.toBe("cercle");
  });
  it("deux phrases clés voisines n'ont jamais la même forme", () => {
    const c = ctx("Les alertes", "");
    const sc = deduireScenes(suite("Une rupture arrive.", "Une urgence arrive.", "Un problème arrive.", "Une erreur arrive."), c).map((x) => x.scene);
    for (let i = 1; i < sc.length; i++) {
      const a = sc[i - 1];
      const b = sc[i];
      if (a.type === "phrase-cle" && b.type === "phrase-cle") expect(b.forme).not.toBe(a.forme);
    }
  });
});

describe("QUALL-7 · chiffre « douze mois »", () => {
  it.each([
    ["Un clic sur un article montre son historique sur douze mois.", "mois"],
    ["Le suivi garde l'historique sur 12 mois.", "mois"],
    ["Le tableau couvre vingt articles par famille.", "articles"],
  ])("piège : « %s » → unité et contexte complet", (t, unite) => {
    const [s] = un(t);
    if (s.type !== "chiffre") throw new Error("type");
    expect(s.chiffres[0].unite).toBe(unite);
    expect(s.contexte).toBe(t.replace(/\.$/, ""));
  });
});

describe("QUALL-7 · rythme : jamais plus de 9 s sans nouvel élément", () => {
  it.each([
    "Le tableau de bord montre tout ce qui se passe dans l'entrepôt, de la réception des colis jusqu'à la préparation des commandes.",
    "Un clic sur un article montre son historique sur douze mois et la quantité vendue chaque semaine pour chaque famille.",
    "On commande alors en urgence, plus cher, et personne ne sait ce qui dort au fond de l'entrepôt depuis des mois.",
  ])("piège : phrase lente de 12 s : « %s »", (t) => {
    const p = phrase(t, 0, 12_000);
    for (const s of deduireScenes([p], ctx()).map((x) => x.scene)) expect(estEchelonnee(s)).toBe(true);
  });
});
