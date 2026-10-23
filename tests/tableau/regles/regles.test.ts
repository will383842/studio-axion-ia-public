/**
 * Règles 2 à 17 du tableau animé (TB-01, plan § 6.3) : pour chacune, un cas accepté et un cas refusé, avec un message
 * qui nomme la scène et la règle (critère § 16 point 1).
 */
import { describe, expect, it } from "vitest";
import {
  DUREE_MAX_MS,
  ECART_EVENEMENT_MAX_MS,
  IMMOBILITE_STYLO_MAX_MS,
  PAGE_MOTS_MAX,
  REGLES_TABLEAU,
  regleDouleurEnTete,
  regleDureeMaximale,
  regleGesteFortDouleur,
  regleSansAppel,
  regleSansNumeroEpisode,
  regleTexteMotPourMot,
  tempsScenes,
} from "../../../src/moteurs/montage-tableau/regles";
import { ErreurMiseEnPage } from "../../../src/moteurs/montage-tableau/mise-en-page";
import { contexteExemple, copie, ficheAvantApres, ficheErreurCorrigee, ficheQuestionAbonne, texteScriptDe } from "./exemples";
import { accepte, element, refuse, scene, toutTient } from "./outils";

const nom = (numero: number) => REGLES_TABLEAU.find((r) => r.numero === numero)!.nom;
const base = () => copie(ficheErreurCorrigee);

describe("table des règles", () => {
  it("une règle par numéro, de 2 à 18 (18 : gabarit de page clair, 14/10), plus le complément du schéma ; noms sans sigle", () => {
    expect(REGLES_TABLEAU.map((r) => r.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
    for (const r of REGLES_TABLEAU) expect(r.nom).not.toMatch(/\b[A-Z]{1,3}\d*\b/);
  });
});

describe("règle 2 · texte dit mot pour mot", () => {
  it("accepte le script validé, quels que soient les espaces et retours à la ligne", () => {
    const f = base();
    accepte(f, { texteScript: `  ${texteScriptDe(f).replace(/ /g, "  ").replace(". ", ".\n")} ` });
  });

  it("refuse un mot changé, en nommant la scène", () => {
    const f = base();
    const script = texteScriptDe(f);
    scene(f, "s03").texteDit = "L'erreur : croire qu'une demande courte suffira.";
    const [p] = refuse(f, nom(2), { texteScript: script });
    expect(p.sceneId).toBe("s03");
    expect(p.message).toContain("« suffira. »");
    expect(p.message).toContain("« suffit. »");
  });

  it("refuse une fin de script oubliée, et un texte dit qui dépasse le script", () => {
    const f = base();
    const manque = regleTexteMotPourMot(f, contexteExemple(f, { texteScript: `${texteScriptDe(f)} Et encore ceci.` }));
    expect(manque).toEqual([{ sceneId: "s06", detail: expect.stringContaining("il manque la fin du script validé") }]);
    const trop = regleTexteMotPourMot(f, contexteExemple(f, { texteScript: texteScriptDe(f).replace(" du premier coup.", "") }));
    expect(trop[0].sceneId).toBe("s06");
    expect(trop[0].detail).toContain("dépasse le script validé");
  });
});

describe("règle 3 · accroche courte dès la première image", () => {
  it("accepte une accroche de 8 mots écrite dès le premier mot", () => {
    const f = base();
    element(f, "e01", "ligne").texte = "Vos réponses vagues ont une cause simple ?";
    accepte(f, toutTient);
  });

  it("refuse une accroche de 9 mots", () => {
    const f = base();
    element(f, "e01", "ligne").texte = "Vos réponses vagues ont une cause très simple ici";
    const [p] = refuse(f, nom(3), toutTient);
    expect(p.message).toBe("Scène s01 · règle « accroche courte dès la première image » : l'accroche écrite compte 9 mots ; 8 au plus.");
  });

  it("refuse une accroche qui n'est pas visible dès la première image", () => {
    const f = base();
    element(f, "e01", "ligne").ancre = 1;
    const [p] = refuse(f, nom(3));
    expect(p.sceneId).toBe("s01");
    expect(p.message).toContain("dès la première image");
  });
});

describe("règle 4 · page lisible : 40 mots et 6 lignes au plus", () => {
  const remplir = (n: number) => {
    // Page 3 : 6 mots dans la preuve ; la ligne du résultat porte le reste.
    const f = base();
    element(f, "e10", "ligne").texte = Array.from({ length: n - 6 }, () => "juste").join(" ");
    return f;
  };

  it("accepte 40 mots sur une page (mise en page supposée réussie)", () => {
    accepte(remplir(PAGE_MOTS_MAX), toutTient);
  });

  it("refuse 40 mots qui ne tiennent pas à l'écran, même réduits au plancher : la mise en page réelle tranche", () => {
    const [p] = refuse(remplir(PAGE_MOTS_MAX), nom(4));
    expect(p.message).toBe(
      "Scène s06 · règle « page lisible : 40 mots et 6 lignes au plus » : la page 3 ne tient pas à l'écran au-dessus des sous-titres, même réduite jusqu'à la taille plancher (3 % de la hauteur).",
    );
  });

  it("refuse 41 mots sur une page, en nommant la scène et la règle", () => {
    const [p] = refuse(remplir(41), nom(4), toutTient);
    expect(p.message).toBe("Scène s06 · règle « page lisible : 40 mots et 6 lignes au plus » : la page 3 compte 41 mots écrits ; 40 au plus par page.");
  });

  const ajouterLignes = (n: number) => {
    const f = base();
    for (let i = 0; i < n; i++) scene(f, "s06").elements.push({ id: `x${i}`, type: "ligne", texte: "Juste", niveau: "texte", role: "resultat", ancre: i + 1 });
    return f;
  };

  it("accepte 6 lignes sur une page (2 de preuve, 4 écrites)", () => {
    accepte(ajouterLignes(3));
  });

  it("refuse 7 lignes sur une page", () => {
    const [p] = refuse(ajouterLignes(4), nom(4));
    expect(p.sceneId).toBe("s06");
    expect(p.message).toContain("la page 3 compte 7 lignes ; 6 au plus par page.");
  });

  it("refuse une ligne dont un mot ne tient pas dans la largeur utile, mesuré avec la police ; une ligne longue se coupe", () => {
    const f = base();
    element(f, "e03", "ligne").texte = "Une question beaucoup trop courte";
    accepte(f);
    element(f, "e03", "ligne").texte = "Une question anticonstitutionnellement courte";
    const [p] = refuse(f, nom(4));
    expect(p.sceneId).toBe("s02");
    expect(p.message).toMatch(/le mot « anticonstitutionnellement » ne tient pas dans la largeur utile \(\d+ px pour 793 px\)/);
  });

  it("utilise la mesure injectée, mot par mot", () => {
    const f = base();
    accepte(f, { mesurerLargeur: (t) => t.length * 10 });
    const [p] = refuse(f, nom(4), { mesurerLargeur: (t) => (t === "premier" ? 5000 : 0) });
    expect(p.message).toContain("le mot « premier » ne tient pas dans la largeur utile (5000 px pour 793 px)");
  });

  it("utilise la mise en page injectée", () => {
    const f = base();
    const [p] = refuse(f, nom(4), {
      mettreEnPage: () => {
        throw new ErreurMiseEnPage("pleine", 2);
      },
    });
    expect(p.sceneId).toBe("s04");
    expect(p.message).toContain("la page 2 ne tient pas à l'écran");
  });
});

describe("règle 5 · taille du texte", () => {
  it("accepte un texte à 3 % de la hauteur (58 px en 1920)", () => {
    accepte(base(), { mise: { taillePx: { titre: 69, texte: 58 } } });
  });

  it("refuse un texte plus petit, en nommant la première scène touchée", () => {
    const [p] = refuse(base(), nom(5), { mise: { taillePx: { titre: 69, texte: 50 } } });
    expect(p.message).toBe("Scène s02 · règle « taille du texte » : le texte de niveau « texte » est prévu à 50 px ; 58 px au moins (3 % de la hauteur de l'image).");
  });
});

describe("règle 6 · une forme en plus de la couleur", () => {
  it("accepte les formes par défaut", () => {
    accepte(base());
  });

  it("refuse un rôle distingué par sa seule couleur", () => {
    const formes = { titre: { couleur: "#110A05", forme: { type: "soulignement" as const } }, alerte: { couleur: "#B44F29" } };
    const [p] = refuse(base(), nom(6), { formesParRole: { ...formes, regle: { couleur: "#110A05", forme: { type: "cadre" } }, resultat: { couleur: "#110A05", forme: { type: "pictogramme", nom: "cible" } } } });
    expect(p.sceneId).toBe("s02");
    expect(p.message).toContain("le rôle « alerte » n'a qu'une couleur");
  });

  it("refuse deux rôles qui ont la même forme", () => {
    const meme = { couleur: "#110A05", forme: { type: "cadre" as const } };
    const ps = refuse(base(), nom(6), { formesParRole: { titre: { couleur: "#110A05", forme: { type: "soulignement" } }, alerte: { couleur: "#B44F29", forme: { type: "cadre" } }, regle: meme, resultat: { couleur: "#110A05", forme: { type: "pictogramme", nom: "cible" } } } });
    expect(ps[0].sceneId).toBe("s04");
    expect(ps[0].message).toContain("les rôles « alerte » et « regle » ont la même forme");
  });
});

describe("règle 7 · chiffres sourcés", () => {
  it("accepte un chiffre dont la source est connue", () => {
    accepte(copie(ficheQuestionAbonne));
  });

  it("refuse un chiffre d'une source inconnue", () => {
    const [p] = refuse(copie(ficheQuestionAbonne), nom(7), { sourcesChiffres: [] });
    expect(p.message).toBe("Scène s03 · règle « chiffres sourcés » : le chiffre « 2 » cite la source « source-delai-relance », inconnue.");
  });

  it("refuse un chiffre écrit dans une ligne sans élément chiffre", () => {
    const f = base();
    element(f, "e03", "ligne").texte = "Question de 5 mots";
    const [p] = refuse(f, nom(7));
    expect(p.sceneId).toBe("s02");
    expect(p.message).toContain("« Question de 5 mots » contient un chiffre sans élément chiffre sourcé");
  });
});

describe("règle 8 · exemple illustratif signalé", () => {
  it("accepte un exemple sans chiffre ni prénom, sans mention ; et un exemple chiffré avec la mention", () => {
    accepte(copie(ficheAvantApres));
    accepte(copie(ficheQuestionAbonne));
  });

  it("refuse un exemple chiffré sans la mention", () => {
    const f = copie(ficheQuestionAbonne);
    scene(f, "s04").elements = scene(f, "s04").elements.filter((e) => e.type !== "mention");
    const [p] = refuse(f, nom(8));
    expect(p.message).toBe("Scène s04 · règle « exemple illustratif signalé » : cet exemple porte des chiffres : il lui faut la mention « Exemple illustratif ».");
  });

  it("refuse un exemple avec un prénom sans la mention", () => {
    const f = copie(ficheAvantApres);
    scene(f, "s03").texteDit = "Avant : Camille recopie ses notes, phrase par phrase.";
    const [p] = refuse(f, nom(8));
    expect(p.sceneId).toBe("s03");
    expect(p.message).toContain("un prénom ou un nom");
  });
});

describe("règle 9 · preuve validée à l'écran", () => {
  it("accepte une matière « demonstration » validée et une preuve validée du studio", () => {
    accepte(base());
    accepte(copie(ficheAvantApres));
  });

  const matiere = (x: Record<string, unknown>) => ({ matieres: [{ id: "matiere-demo-questions", type: "demonstration" as const, statut: "validee" as const, ...x }] });

  it("refuse une preuve périmée", () => {
    const [p] = refuse(base(), nom(9), matiere({ perimeLe: "2026-10-01" }));
    expect(p.message).toBe("Scène s05 · règle « preuve validée à l'écran » : la preuve « matiere-demo-questions » est périmée depuis le 2026-10-01 ; seule une preuve validée et non périmée s'affiche.");
  });

  it("refuse une preuve non validée, une matière qui n'est pas une démonstration, une preuve inconnue", () => {
    expect(refuse(base(), nom(9), matiere({ statut: "a-confirmer" }))[0].message).toContain("n'est pas validée");
    expect(refuse(base(), nom(9), matiere({ type: "observation" }))[0].message).toContain("n'est pas une démonstration");
    expect(refuse(base(), nom(9), { matieres: [] })[0].message).toContain("est inconnue");
  });

  it("refuse une fiche sans scène « preuve »", () => {
    const f = base();
    scene(f, "s05").role = "etape";
    const [p] = refuse(f, nom(9));
    expect(p.message).toContain("aucune scène « preuve »");
  });
});

describe("règle 10 · douleur en tête", () => {
  it("accepte une douleur dite dans les 3 premières secondes et écrite dans la première scène", () => {
    accepte(base());
  });

  it("refuse une douleur ni dite ni écrite au début", () => {
    const f = base();
    f.douleur = "Vos textes générés sonnent faux.";
    const ps = refuse(f, nom(10), {}, false);
    expect(ps.map((p) => p.sceneId)).toEqual(["s01", "s01"]);
    expect(ps[0].message).toContain("n'est dit dans les 3 premières secondes");
    expect(ps[1].message).toContain("n'est écrit dans la première scène");
  });

  it("le « dit » se vérifie sur le texte dit de la première scène, dans les 3 premières secondes", () => {
    const f = base();
    // « vague » arrive au 11e mot (≈ 3,5 s à 20,5 caractères par seconde).
    scene(f, "s01").texteDit = "Ce que vous obtenez de l'intelligence artificielle reste trop souvent vague ? Voici pourquoi.";
    f.douleur = "Des réponses vagues.";
    const ps = regleDouleurEnTete(f, contexteExemple(f));
    expect(ps).toEqual([{ sceneId: "s01", detail: expect.stringContaining("n'est dit dans les 3 premières secondes") }]);
  });

  it("refuse un geste de la minute vide", () => {
    const f = base();
    f.gesteMinute = " ";
    expect(regleDouleurEnTete(f, contexteExemple(f))).toEqual([{ sceneId: "s01", detail: "le geste de la minute est absent." }]);
  });
});

describe("règle 11 · dessins de la banque, droits valides", () => {
  it("accepte les dessins de la banque (registre des droits réel, à la date du jour)", () => {
    accepte(base());
  });

  it("refuse un dessin absent de la banque", () => {
    const f = base();
    element(f, "e04", "dessin").dessinId = "licorne";
    const [p] = refuse(f, nom(11));
    expect(p.message).toBe("Scène s02 · règle « dessins de la banque, droits valides » : le dessin « licorne » n'est pas dans la banque ou n'a pas de droit valide au registre.");
  });

  it("utilise la vérification injectée, avec la date du jour", () => {
    const vus: string[] = [];
    const ps = refuse(base(), nom(11), { dessinValide: (id, le) => (vus.push(le), id !== "bulle") });
    expect(ps.map((p) => p.sceneId)).toEqual(["s02"]);
    expect(new Set(vus)).toEqual(new Set(["2026-10-11"]));
  });
});

describe("règle 12 · aucune phrase d'appel", () => {
  it("accepte des scènes sans appel", () => {
    accepte(base());
  });

  it("refuse une phrase d'appel écrite", () => {
    const f = base();
    element(f, "e10", "ligne").texte = "Lien en description";
    const [p] = refuse(f, nom(12));
    expect(p.message).toBe("Scène s06 · règle « aucune phrase d'appel » : phrase d'appel « lien » ; l'appel est une pièce à part, jamais écrite dans les scènes.");
  });

  it("refuse une phrase d'appel dite", () => {
    const f = base();
    scene(f, "s06").texteDit = "Abonnez-vous pour la suite.";
    expect(regleSansAppel(f)).toEqual([{ sceneId: "s06", detail: expect.stringContaining("« abonnez-vous »") }]);
    scene(f, "s06").texteDit = "Commentez si cela vous aide.";
    expect(regleSansAppel(f)[0].detail).toContain("« commentez »");
  });
});

describe("règle 13 · contrôles du script sur les textes écrits et dits", () => {
  it("accepte des textes au vouvoiement ; une ligne de preuve citée mot pour mot n'est pas contrôlée", () => {
    const f = base();
    element(f, "e08", "preuve").lignes = ["Avant : tes conseils", "Après : plan précis"];
    accepte(f);
  });

  it("refuse un tutoiement écrit", () => {
    const f = base();
    element(f, "e06", "ligne").texte = "Teste ta demande";
    const [p] = refuse(f, nom(13));
    expect(p.message).toBe("Scène s04 · règle « contrôles du script sur les textes écrits et dits » : « Teste ta demande » tutoie ; le format vouvoie.");
  });

  it("refuse « demain », un mot interdit, un interdit de Will", () => {
    const f = base();
    element(f, "e10", "ligne").texte = "Testez dès demain";
    expect(refuse(f, nom(13))[0].message).toContain("le mot interdit « demain »");
    const g = base();
    element(g, "e10", "ligne").texte = "Une astuce simple";
    expect(refuse(g, nom(13), { motsInterdits: ["astuce"] })[0].message).toContain("le mot interdit « astuce »");
    const interdits = [{ id: "int-1", texte: "Jamais de promesse de gain", regex: "garanti", origine: "will" }];
    expect(refuse(g, nom(13), { interdits: interdits.map((i) => ({ ...i, regex: "astuce" })) })[0].message).toContain("enfreint un interdit de Will : Jamais de promesse de gain (« astuce »)");
  });
});

describe("règle 14 · durée de 90 secondes au plus", () => {
  const calee = (finMs: number) => {
    const f = base();
    const pas = finMs / f.scenes.length;
    f.scenes.forEach((s, i) => Object.assign(s, { debutMs: Math.round(i * pas), finMs: Math.round((i + 1) * pas) }));
    return f;
  };

  it("accepte une durée estimée sous 90 s, et une fiche calée de 90 s pile", () => {
    accepte(base());
    expect(regleDureeMaximale(calee(DUREE_MAX_MS), contexteExemple(base()))).toEqual([]);
  });

  it("refuse une durée de plus de 90 s, en nommant la scène où elle est dépassée", () => {
    const [p] = regleDureeMaximale(calee(DUREE_MAX_MS + 600), contexteExemple(base()));
    expect(p.sceneId).toBe("s06");
    expect(p.detail).toContain("environ 90,6 s ; 90 s au plus");
  });

  it("refuse par la validation complète (estimation au débit injecté)", () => {
    const ps = refuse(base(), nom(14), { caracteresParSeconde: 3 }, false);
    expect(ps[0].message).toBe("Scène s05 · règle « durée de 90 secondes au plus » : la vidéo durerait environ 110,0 s ; 90 s au plus (dépassé dans cette scène) : raccourcissez le texte dit d'au moins 60 caractères (environ 10 mots).");
  });
});

describe("règle 15 · série sans numéro", () => {
  it("accepte une série et des textes sans numéro", () => {
    accepte(base());
  });

  it("refuse « Partie 2 » écrit dans une scène", () => {
    const f = base();
    element(f, "e10", "ligne").texte = "Partie 2 juste après";
    const ps = refuse(f, nom(15), {}, false);
    expect(ps[0].message).toBe("Scène s06 · règle « série sans numéro » : « Partie 2 juste après » cite un numéro d'épisode ou une suite ; chaque vidéo se suffit à elle-même.");
  });

  it("refuse un numéro dans le nom de la série ou un épisode dit", () => {
    const f = base();
    f.serie.nom = "L'IA au quotidien · épisode 4";
    expect(refuse(f, nom(15))[0].message).toContain("la série « L'IA au quotidien · épisode 4 » porte un numéro");
    const g = base();
    scene(g, "s06").texteDit = "Rendez-vous au prochain épisode.";
    expect(regleSansNumeroEpisode(g)[0].sceneId).toBe("s06");
  });

  it("vidéo v-b2d772d28b97 : le VERBE « part » n'est pas un numéro ; « partie », « tome », « volet » le sont seulement suivis d'un numéro", () => {
    const dit = (t: string) => {
      const f = base();
      scene(f, "s06").texteDit = t;
      return regleSansNumeroEpisode(f).length;
    };
    for (const t of ["Une demi-page part dix minutes plus tard.", "Le compte rendu part trois jours après.", "Le devis part deux heures plus tôt.", "Une partie un peu longue, tapée le soir.", "Le volet un peu fermé.", "Un tome entier de notes.", "La deuxième partie de la page.", "Le premier volet du devis.", "Une saison chargée."]) expect(dit(t), t).toBe(0);
    for (const t of ["Partie 2 juste après.", "On voit ça en partie deux.", "Tome 3 de la série.", "Le volet 2 arrive.", "Volet trois : les relances.", "Chapitre un.", "Saison 2.", "Épisode suivant."]) expect(dit(t), t).toBe(1);
  });
});

describe("règle 16 · du rythme", () => {
  it("accepte les exemples, estimés ou calés", () => {
    const f = base();
    accepte(f);
    for (const t of tempsScenes(f)) Object.assign(t.scene, { debutMs: Math.round(t.debutMs), finMs: Math.round(t.finMs) });
    accepte(f);
  });

  it(`refuse plus de ${ECART_EVENEMENT_MAX_MS / 1000} s sans événement visuel`, () => {
    const f = base();
    delete element(f, "e06", "ligne").marque;
    scene(f, "s04").elements = scene(f, "s04").elements.filter((e) => e.id !== "e07");
    scene(f, "s04").elements.push({ id: "e07", type: "ligne", texte: "D'abord", niveau: "texte", role: "regle", ancre: 6 });
    const [p] = refuse(f, nom(16));
    expect(p.sceneId).toBe("s04");
    // Mesuré au lot B2b : 5,5 s à 11,0 s à l'ancien débit (20,5 car/s), 6,4 s à 12,8 s à 16,9 car/s (× 1,21).
    expect(p.message).toMatch(/aucun événement visuel entre 6,4 s et 12,8 s ; un toutes les 4 s au moins\. /);
    // Le motif dit quoi faire, dans la scène nommée comme à l'écran (« Scène 4 »).
    expect(p.message).toMatch(/Ajoutez une ligne écrite ou un geste dans la scène 4/);
  });

  it(`refuse un stylo immobile plus de ${IMMOBILITE_STYLO_MAX_MS / 1000} s`, () => {
    const f = base();
    scene(f, "s04").elements = scene(f, "s04").elements.filter((e) => e.id !== "e07");
    // Débit injecté plus lent (la règle ne dépend que des temps) : la scène s04 dure assez pour laisser le stylo immobile.
    const [p] = refuse(f, nom(16), { caracteresParSeconde: 17 });
    expect(p.sceneId).toBe("s04");
    expect(p.message).toMatch(/le stylo reste immobile de \d+,\d s à \d+,\d s ; 2 s au plus\.$/);
  });
});

describe("règle 17 · geste fort sur la douleur dès le début", () => {
  it("accepte un geste « barrer » sur la ligne de la douleur à la place de la marque entourée", () => {
    const f = base();
    delete element(f, "e01", "ligne").marque;
    scene(f, "s01").elements.push({ id: "x1", type: "geste", geste: "barrer", cibleId: "e01", ancre: 1 });
    accepte(f);
  });

  it("refuse sans geste fort (un soulignement ne suffit pas)", () => {
    const f = base();
    element(f, "e01", "ligne").marque = "souligne";
    const [p] = refuse(f, nom(17));
    expect(p.message).toBe(
      "Scène s01 · règle « geste fort sur la douleur dès le début » : aucun geste fort (entourer, barrer) sur un mot de la douleur dans les 3 premières secondes : entourez ou barrez, au début de la première scène, une ligne qui écrit un des mots « demandes », « donnent », « réponses », « vagues ».",
    );
  });

  it("refuse un geste fort trop tard, ou sur une ligne sans mot-clé de la douleur", () => {
    const f = base();
    delete element(f, "e01", "ligne").marque;
    scene(f, "s02").elements.push({ id: "x1", type: "geste", geste: "entourer", cibleId: "e03", ancre: 1 });
    expect(regleGesteFortDouleur(f, contexteExemple(f))[0].detail).toContain("aucun geste fort");
  });

  it("le « dit » se vérifie sur le texte dit de la première scène", () => {
    const f = base();
    scene(f, "s01").texteDit = "Ce que vous obtenez de l'intelligence artificielle reste trop souvent vague ? Voici pourquoi.";
    f.douleur = "Des réponses vagues.";
    expect(regleGesteFortDouleur(f, contexteExemple(f))).toEqual([{ sceneId: "s01", detail: expect.stringContaining("n'est dit dans les 3 premières secondes, le geste fort n'a rien à souligner") }]);
  });
});
