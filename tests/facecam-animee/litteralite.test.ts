/**
 * FACE CAMÉRA ANIMÉE — LITTÉRALITÉ (passe 2, revue finale du 14/10, priorité 3) : « chaque animation représente ce que
 * la personne dit ». Contrôles purs du plan (métaphores, personne / action nommées, recherche qui reprend un mot dit,
 * recopie sur TOUS les types de cartes, mot de la carte dit avant son entrée), consigne du réalisateur (10 exemples),
 * contrôle visuel sur une IMAGE EXTRAITE de la mini-vidéo. Rejoue aussi les contrôles sur le vrai plan de la vidéo 2
 * quand il est présent sur ce poste. AUCUN appel réseau, aucun rendu.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { VERSION_PLAN_FACECAM_ANIMEE, type CartePlan, type PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import { consigneRealisateur } from "@/moteurs/montage-facecam-animee/realisateur/consignes";
import { copieCarte, defautsVignettes, exigencesScene, metaphoresDe, motCleAvantEntree, sceneDe, verifierPlan } from "@/moteurs/montage-facecam-animee/realisateur/regles";
import type { MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur/mots";
import { CONTROLE_VISUEL_SUR_LES_REPLIS, consigneVerification, consigneVerificationMiniVideo, imageDeControle, instantsDeControle, phraseDite } from "@/moteurs/montage-facecam-animee/images/verification";

/* Mêmes mots synthétiques que realisateur.test.ts : un mot toutes les 0,5 s. */
const VOCABULAIRE = [
  "Vos", "devis", "partent", "le", "soir", "relances", "factures", "agenda", "clients", "bureau",
  "45", "minutes", "atelier", "chantier", "camion", "livraison", "téléphone", "clavier", "réunion", "équipe",
  "dossier", "contrat", "signature", "carnet", "commandes", "stock", "planning", "semaine", "tableau", "écran",
  "rendez-vous", "visio", "courrier", "colis", "entrepôt", "comptable", "banque", "caisse", "boutique", "devis.",
];
const MOTS: MotTranscrit[] = VOCABULAIRE.map((w, i) => ({ w, a: i * 0.5, f: i * 0.5 + 0.4 }));

/** Plan minimal (les contrôles de rythme rouges ne gênent pas : on cherche les messages de littéralité). */
function plan(): PlanFacecamAnimee {
  return {
    version: VERSION_PLAN_FACECAM_ANIMEE,
    charte: "interface-claire/1",
    duree: 22,
    fps: 25,
    largeur: 1080,
    hauteur: 1920,
    prise: { src: "prise.mp4", finSec: 20 },
    groupes: [],
    zooms: [],
    mouvements: [],
    cartes: [
      {
        debut: 1.85, fin: 6.0, titre: "Bureau du soir", illustre: "soir relances factures agenda clients", icone: "document", entree: "chute",
        contenu: { type: "liste", lignes: [{ texte: "Soir", icone: "horloge", a: 2.0 }, { texte: "Relances", icone: "mail", a: 2.5 }, { texte: "Factures", icone: "euro", a: 3.0 }, { texte: "Clients", icone: "utilisateurs", a: 4.0 }], cocheA: 5.0, badge: { texte: "Trop tard", icone: "horloge", a: 5.5 } },
      },
      {
        debut: 10.85, fin: 15.5, titre: "Carnet de commandes", illustre: "signature carnet commandes stock planning", icone: "dossier", entree: "glisse",
        contenu: { type: "frise", etapes: [{ texte: "Signature", icone: "document", a: 11.0 }, { texte: "Commandes", icone: "dossier", a: 12.0 }, { texte: "Planning", icone: "calendrier", a: 13.0 }], cocheA: 14.0, badge: { texte: "Bouclé", a: 15.0 } },
      },
    ],
    fenetres: [
      { debut: 6.1, fin: 7.6, media: "fenetre-1", recherche: "artisan qui charge un camion sur un chantier", illustre: "chantier camion", video: true },
      { debut: 15.6, fin: 17.5, media: "fenetre-2", recherche: "livreur qui dépose un colis dans un entrepôt", illustre: "courrier colis entrepôt", video: true },
    ],
    calques: [],
    fin: { debut: 20, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: ["loupe"] },
    sons: [],
  };
}
const avec = (m: (p: PlanFacecamAnimee) => void) => {
  const p = plan();
  m(p);
  return verifierPlan(p, MOTS);
};
const LITTERAL = /illustre|recherche|MÉTAPHORE|PERSONNE|CETTE action|recopie|sans qu'aucun de ses mots|titre/;
const contient = (liste: string[], morceau: string) => expect(liste.some((e) => e.includes(morceau)), `attendu « ${morceau} » dans :\n${liste.join("\n")}`).toBe(true);

describe("littéralité · contrôles du plan", () => {
  it("le plan littéral n'a aucune erreur de littéralité", () => {
    expect(verifierPlan(plan(), MOTS).erreurs.filter((e) => LITTERAL.test(e))).toEqual([]);
  });

  it("une recherche qui ne reprend aucun mot dit est REFUSÉE (plus un simple avertissement)", () => {
    const r = avec((p) => (p.fenetres[0].recherche = "agenda ouvert sur un bureau avec un rendez-vous noté"));
    contient(r.erreurs, "Fenêtre 1 : la recherche « agenda ouvert sur un bureau avec un rendez-vous noté » ne reprend aucun mot de ce qu'elle illustre (« chantier camion ») : montrez la chose, le lieu ou l'action NOMMÉS");
  });

  it("une fenêtre ne montre pas une métaphore (horloge, sablier, goutte…) sauf si le mot est dit", () => {
    const r = avec((p) => (p.fenetres[0].recherche = "horloge murale qui tourne sur un chantier"));
    contient(r.erreurs, "Fenêtre 1 : la recherche « horloge murale qui tourne sur un chantier » montre une MÉTAPHORE (horloge) que Will ne dit pas");
    expect(metaphoresDe("sablier qui s'écoule sur un bureau", ["temps", "echappe"])).toEqual(["sablier"]);
    expect(metaphoresDe("goutte d'eau qui tombe d'une fuite dans un bureau", ["veut", "colmater"])).toEqual(["goutte ou robinet"]);
    expect(metaphoresDe("ampoule qui s'allume au-dessus d'un bureau", ["idee"])).toEqual(["ampoule"]);
    // Le mot est dit : la chose est nommée, ce n'est plus une métaphore.
    expect(metaphoresDe("robinet qui fuit goutte à goutte dans une cuisine", ["trouver", "la", "fuite"])).toEqual([]);
    expect(metaphoresDe("réveil qui sonne sur une table de nuit", ["reveil", "sonne"])).toEqual([]);
    // « montre » (verbe) n'est pas une horloge.
    expect(metaphoresDe("écran qui montre un tableau de bord", [])).toEqual([]);
  });

  it("quand la phrase nomme une personne ou une action, la fenêtre la montre", () => {
    // Diagnostic du 14/10 : « un dirigeant qui voulait recruter » illustré sans recrutement.
    expect(exigencesScene("un dirigeant qui voulait recruter pour absorber", "dirigeant qui travaille à son bureau")).toEqual([{ quoi: "recruter", mot: "recruter", exemple: "dirigeant qui fait passer un entretien d'embauche" }]);
    expect(exigencesScene("un dirigeant qui voulait recruter", "lunettes posées sur un agenda ouvert").map((x) => x.quoi)).toEqual(["personne", "recruter"]);
    expect(exigencesScene("un dirigeant qui voulait recruter", "dirigeant qui fait passer un entretien d'embauche")).toEqual([]);
    expect(exigencesScene("on forme les équipes à l'IA", "équipe en formation autour d'une table de réunion")).toEqual([]);
    expect(exigencesScene("le soir, vous tapez encore les devis", "mains qui tapent un devis sur un ordinateur le soir")).toEqual([]);
    // Une autre chose nommée suffit (l'outil) ; plusieurs actions : une suffit.
    expect(exigencesScene("un outil de plus, une embauche de plus", "écran d'ordinateur rempli d'outils logiciels au bureau")).toEqual([]);
    expect(exigencesScene("on audite des entreprises et on automatise", "écran d'un logiciel qui automatise des tâches")).toEqual([]);
    // Sans personne ni action nommée : aucune exigence.
    expect(exigencesScene("chantier camion", "artisan qui charge un camion sur un chantier")).toEqual([]);
    const s = avec((p) => {
      p.fenetres[1].illustre = "comptable banque";
      p.fenetres[1].recherche = "façade d'une banque en centre-ville";
    });
    contient(s.erreurs, "Fenêtre 2 : la phrase parle de « comptable » ; la recherche « façade d'une banque en centre-ville » doit montrer une PERSONNE");
    const t = avec((p) => {
      p.fenetres[1].illustre = "comptable banque";
      p.fenetres[1].recherche = "comptable qui reçoit un client à la banque";
    });
    expect(t.erreurs.some((e) => e.includes("Fenêtre 2 : la phrase"))).toBe(false);
  });

  it("la recopie de plus de 50 % est contrôlée sur TOUS les types de cartes (demande d'un chat exclue)", () => {
    const statuts = avec((p) => {
      p.cartes[1].contenu = { type: "statuts", avant: { texte: "À faire" }, apres: { texte: "Fait" }, lignes: [{ nom: "Signature du carnet", a: 11.0 }, { nom: "Commandes en stock", a: 12.0 }, { nom: "Planning de la semaine", a: 13.0 }] };
    });
    contient(statuts.erreurs, "Carte 2 (statuts) : recopie 60 % des mots dits pendant qu'elle est à l'écran (6 sur 10, dans des bouts de phrase de 3 mots ou plus)");
    const grille = avec((p) => {
      p.cartes[1].contenu = { type: "grille", vignettes: [{ a: 11.0, legende: "Signature du carnet", contenu: { type: "image" } }, { a: 12.0, legende: "Commandes en stock", contenu: { type: "image" } }, { a: 13.0, legende: "Planning de la semaine", contenu: { type: "image" } }] };
    });
    contient(grille.erreurs, "Carte 2 (grille) : recopie 60 %");
    const chat: CartePlan = { ...plan().cartes[1], contenu: { type: "chat", message: { texte: "Signature, carnet, commandes, stock, planning", a: 11.0 }, reponse: { a: 12.0 }, puces: [{ texte: "Tableau de la semaine", icone: "document", a: 14.0 }] } };
    expect(copieCarte(chat, MOTS)).toMatchObject({ copies: 2, dits: 10 });
  });

  it("un NOM par chose dite (1 ou 2 mots) n'est jamais une recopie : seule la phrase réécrite l'est (exemple 4 de la référence)", () => {
    // « Claude nous aide à écrire les scripts, les emails, les pages de vente » → une puce par chose : c'est le modèle.
    const unNomParChose = avec((p) => {
      p.cartes[1].contenu = { type: "statuts", avant: { texte: "À faire" }, apres: { texte: "Fait" }, lignes: [{ nom: "Signature", a: 11.0 }, { nom: "Carnet", a: 11.5 }, { nom: "Commandes", a: 12.0 }, { nom: "Stock", a: 12.5 }, { nom: "Planning", detail: "Semaine", a: 13.0 }] };
    });
    expect(unNomParChose.erreurs.filter((e) => e.includes("recopie"))).toEqual([]);
    const puces: CartePlan = { ...plan().cartes[1], contenu: { type: "chat", message: { texte: "Rédige le contrat", a: 11.0 }, reponse: { a: 12.0 }, puces: [{ texte: "Carnet", icone: "document", a: 11.5 }, { texte: "Commandes", icone: "dossier", a: 12.0 }, { texte: "Bon stock", icone: "coche", a: 12.5 }] } };
    expect(copieCarte(puces, MOTS)).toMatchObject({ copies: 0 });
    // La carte « Bilan du dirigeant » de la vidéo 2 (un nom par ligne), jugée littérale par l'architecte, passe.
    const bilan: MotTranscrit[] = "Pas de recrutement, ses équipes ont retrouvé leur après-midi et lui, son week-end.".split(" ").map((w, i) => ({ w, a: 46 + i * 0.3, f: 46 + i * 0.3 + 0.25 }));
    const carteBilan: CartePlan = { debut: 46, fin: 50.8, titre: "Bilan du dirigeant", icone: "utilisateurs", entree: "glisse", contenu: { type: "statuts", avant: { texte: "Perdu" }, apres: { texte: "Retrouvé" }, lignes: [{ nom: "Recrutement", a: 46.3, apres: { texte: "Pas besoin" } }, { nom: "Équipes", detail: "Leur après-midi", a: 46.9 }, { nom: "Week-end", detail: "Le dirigeant", a: 49.3 }] } };
    expect(copieCarte(carteBilan, bilan)?.part).toBe(0);
  });

  it("un mot de la carte est dit dans la seconde qui précède son entrée", () => {
    const r = avec((p) => {
      p.cartes[0].titre = "Boîte mail";
      if (p.cartes[0].contenu.type === "liste") p.cartes[0].contenu.lignes[0].texte = "Agenda";
    });
    contient(r.erreurs, "Carte 1 (liste) : entre à 1,85 s sans qu'aucun de ses mots soit dit entre 0,85 s et 2,25 s (mots dits : « partent », « le », « soir »)");
    expect(motCleAvantEntree(plan().cartes[0], MOTS)).toBe("soir");
    // Énumération numérotée : la liste entre sur « Un : ».
    const numerotes: MotTranscrit[] = [{ w: "Un :", a: 1.9, f: 2.0 }, { w: "où", a: 2.1, f: 2.2 }];
    expect(motCleAvantEntree({ ...plan().cartes[0], titre: "Questions" }, numerotes)).toBe("Un");
  });

  it("vrai plan de la vidéo 2 : les défauts relevés par l'architecte sont refusés (s'il est présent sur ce poste)", () => {
    const chemin = "<dossier utilisateur>/AppData/Local/Temp/claude/<projet-local>-Documents-Projets-Axion-IA/55133bef-9581-493b-a484-fae7fb25910a/scratchpad/realisateur-essai-2/plan-rendu.json";
    const fixture = fileURLToPath(new URL("./fixtures/mots-img7747.json", import.meta.url));
    if (!existsSync(chemin)) return;
    const r = verifierPlan(JSON.parse(readFileSync(chemin, "utf8")), JSON.parse(readFileSync(fixture, "utf8")));
    contient(r.erreurs, "« horloge murale qui tourne dans un bureau vide le soir » montre une MÉTAPHORE (horloge)");
    contient(r.erreurs, "« goutte d'eau qui tombe d'une fuite dans un bureau » montre une MÉTAPHORE");
    contient(r.erreurs, "« sablier qui s'écoule sur un bureau » montre une MÉTAPHORE (sablier)");
    contient(r.erreurs, "la phrase dit « recruter » (action « recruter »)");
    contient(r.erreurs, "« agenda ouvert sur un bureau avec un rendez-vous noté » ne reprend aucun mot");
    contient(r.erreurs, "Carte 3 (grille) : entre à 27,45 s sans qu'aucun de ses mots soit dit");
    // Le robinet de « trouver la fuite » : le mot est dit, ce n'est pas refusé comme métaphore.
    expect(r.erreurs.some((e) => e.includes("« robinet qui fuit goutte à goutte dans une cuisine » montre une MÉTAPHORE"))).toBe(false);
  });
});

describe("littéralité · passe 3 (revue du 15/10) : la chose ou l'action DITE", () => {
  it("« trouver la fuite » : il faut voir quelqu'un qui CHERCHE (action stricte), jamais un clavier ni un tableau blanc", () => {
    const phrase = "la vraie première étape, c'est de trouver la fuite";
    expect(exigencesScene(phrase, "mains qui tapent sur un clavier au bureau").map((x) => x.quoi)).toContain("chercher");
    // Vidéo 3 : la « première étape » reprise ne suffit plus (une autre chose de la phrase, pas l'action).
    expect(exigencesScene(phrase, "consultante qui note la première étape sur un tableau blanc").map((x) => x.quoi)).toContain("chercher");
    expect(exigencesScene(phrase, "consultant qui examine les comptes avec le dirigeant au bureau")).toEqual([]);
  });

  it("« leur après-midi », « son week-end » : des gens qui partent ou profitent, jamais des mains et des cartes", () => {
    const apresMidi = "ses équipes ont retrouvé leur après-midi";
    expect(exigencesScene(apresMidi, "mains qui jouent aux cartes sur une table de bureau").map((x) => x.quoi)).toContain("profiter de son temps libre");
    expect(exigencesScene(apresMidi, "équipe qui travaille au bureau l'après-midi").map((x) => x.quoi)).toContain("profiter de son temps libre");
    expect(exigencesScene(apresMidi, "équipes de salariés qui quittent le bureau l'après-midi")).toEqual([]);
    expect(exigencesScene("et lui, son week-end", "dirigeant qui profite de son week-end en famille au parc")).toEqual([]);
    expect(exigencesScene("et lui, son week-end", "dirigeant qui lit des dossiers chez lui le week-end").map((x) => x.quoi)).toContain("profiter de son temps libre");
  });

  it("« un dirigeant qui voulait recruter » : un dirigeant EN ENTRETIEN D'EMBAUCHE (pas un homme qui lit)", () => {
    expect(exigencesScene("un dirigeant qui voulait recruter", "homme qui lit un document près de la fenêtre").map((x) => x.quoi)).toContain("recruter");
    expect(exigencesScene("un dirigeant qui voulait recruter", "dirigeant qui fait passer un entretien d'embauche")).toEqual([]);
  });

  it("la recherche dit QUI fait QUOI (une action qui se filme) et OÙ", () => {
    expect(sceneDe("artisan qui charge un camion sur un chantier")).toMatchObject({ action: "charge", invisible: null });
    expect(sceneDe("artisan qui charge un camion sur un chantier").lieu).not.toBeNull();
    expect(sceneDe("équipe en formation autour d'une table de réunion").action).toBe("en formation");
    expect(sceneDe("dirigeant qui sent le temps lui échapper au bureau le soir").invisible).toBe("sent");
    expect(sceneDe("gérante qui pense à ses factures dans sa cuisine").invisible).toBe("pense");
    expect(sceneDe("dirigeant qui se lève tôt dans sa cuisine")).toMatchObject({ action: "leve", invisible: null });
    expect(sceneDe("bureau vide et silencieux le soir").action).toBeNull();
    expect(sceneDe("dirigeant qui fait passer un entretien d'embauche").lieu).toBeNull();
    const invisible = avec((p) => (p.fenetres[0].recherche = "artisan qui pense à son camion sur un chantier"));
    contient(invisible.erreurs, "Fenêtre 1 : la recherche « artisan qui pense à son camion sur un chantier » décrit une action qui ne se FILME pas (« pense »)");
    const rien = avec((p) => (p.fenetres[0].recherche = "camion rouge garé sur un chantier"));
    contient(rien.erreurs, "Fenêtre 1 : la recherche « camion rouge garé sur un chantier » ne dit pas ce qui SE PASSE à l'image");
    const sansLieu = avec((p) => (p.fenetres[0].recherche = "artisan qui charge un camion de chantier"));
    expect(sansLieu.erreurs.some((e) => e.includes("Fenêtre 1 : la recherche « artisan qui charge"))).toBe(false);
    // Le plan modèle reste propre.
    expect(verifierPlan(plan(), MOTS).erreurs.filter((e) => /SE PASSE|se FILME|vignette/.test(e))).toEqual([]);
  });

  it("GRILLE : chaque vignette surgit sur sa chose dite et la MONTRE (jamais vide, jamais générique)", () => {
    const grille = (vignettes: Extract<CartePlan["contenu"], { type: "grille" }>["vignettes"]): CartePlan => ({ ...plan().cartes[1], titre: "Carnet de commandes", contenu: { type: "grille", vignettes } });
    // Bonne grille : une fiche avec l'icône de la chose, posée sur son mot.
    const bonne = grille([
      { a: 11.0, legende: "Signature", contenu: { type: "fiche", lignes: 3, icone: "document", iconeA: 11.0 } },
      { a: 12.0, legende: "Commandes", contenu: { type: "texte", titre: "Commandes" } },
      { a: 13.0, legende: "Planning", contenu: { type: "fiche", icone: "calendrier", iconeA: 13.0 } },
    ]);
    expect(defautsVignettes(bonne, MOTS)).toEqual([]);
    // « Accompagnement IA » de la vidéo 3 : fiches sans icône, pictogrammes génériques, légende non dite.
    const mauvaise = grille([
      { a: 11.0, legende: "Signature", contenu: { type: "fiche", lignes: 3 } },
      { a: 12.0, legende: "Commandes", contenu: { type: "image" } },
      { a: 13.0, legende: "Planning", contenu: { type: "ecran" } },
      { a: 14.0, legende: "Rentabilité", contenu: { type: "texte", titre: "Rentabilité" } },
    ]);
    const d = defautsVignettes(mauvaise, MOTS);
    contient(d, "vignette 1 « Signature » : fiche sans icône");
    contient(d, "vignette 2 « Commandes » : pictogramme « image » générique");
    contient(d, "vignette 3 « Planning » : maquette d'écran générique");
    contient(d, "vignette 4 « Rentabilité » surgit à 14,00 s sans que sa chose soit dite");
    // « image » et « ecran » restent permis pour des images ou des écrans DITS.
    expect(defautsVignettes(grille([{ a: 14.5, legende: "Écran", contenu: { type: "ecran" } }, { a: 11.0, legende: "Signature", contenu: { type: "fiche", icone: "document" } }]), MOTS)).toEqual([]);
    // Et le contrôle du plan les refuse.
    const r = avec((p) => (p.cartes[1] = mauvaise));
    contient(r.erreurs, "Carte 2 (grille) : vignette 1 « Signature » : fiche sans icône");
  });

  it("vrai plan de la vidéo 3 : « trouver la fuite », « sent le temps », grille sans chose dite sont refusés (s'il est présent)", () => {
    const base = "<dossier utilisateur>/AppData/Local/Temp/claude/<projet-local>-Documents-Projets-Axion-IA/55133bef-9581-493b-a484-fae7fb25910a/scratchpad";
    const chemin = `${base}/realisateur-essai-3/plan-rendu.json`;
    const fixture = fileURLToPath(new URL("./fixtures/mots-img7747.json", import.meta.url));
    if (!existsSync(chemin)) return;
    const r = verifierPlan(JSON.parse(readFileSync(chemin, "utf8")), JSON.parse(readFileSync(fixture, "utf8")));
    contient(r.erreurs, "la phrase dit « trouver » (action « chercher »)");
    contient(r.erreurs, "« dirigeant qui sent le temps lui échapper au bureau le soir » décrit une action qui ne se FILME pas (« sent »)");
  });
});

describe("littéralité · consigne du réalisateur", () => {
  it("donne 10 exemples « phrase → ce qu'on montre » et les refus (métaphore, personne, action, recopie, mot avant l'entrée)", () => {
    const c = consigneRealisateur();
    const bloc = c.slice(c.indexOf("10 exemples"));
    for (let k = 1; k <= 10; k++) expect(bloc).toContain(`\n${k}. « `);
    expect(c).toMatch(/horloge, sablier, goutte, ampoule/);
    expect(c).toMatch(/une PERSONNE/);
    expect(c).toMatch(/TOUS les types de cartes/);
    expect(c).toMatch(/dans la seconde qui précède/);
    // Aucun exemple ne recopie la prise de Will (IMG_7747).
    for (const phrase of ["temps qui s'échappe", "voulait recruter", "trouver la fuite", "pas de miracle", "soirées sur les devis"]) expect(c).not.toContain(phrase);
  });
});

describe("littéralité · contrôle visuel sur une IMAGE EXTRAITE de la mini-vidéo", () => {
  it("la mini-vidéo est jugée sur une image extraite du passage préparé, jamais sur la vignette de la banque", () => {
    expect(imageDeControle({ image: "images/fenetre-1-controle.jpg" })).toBe("images/fenetre-1-controle.jpg");
    expect(imageDeControle({ images: ["a.jpg", "b.jpg"] })).toBe("b.jpg");
    expect(imageDeControle(undefined)).toBeNull();
    expect(imageDeControle({})).toBeNull();
    // Une vignette de banque n'est jamais acceptée comme image de contrôle.
    expect(imageDeControle({ image: "https://images.pexels.com/videos/123/preview.jpg" })).toBeNull();
  });

  it("instants à extraire : au milieu du passage montré (et au tiers / deux tiers), dans la source", () => {
    expect(instantsDeControle(2, 1.5)).toEqual([2.5, 2.75, 3]);
    expect(instantsDeControle(0, 3)).toEqual([1, 1.5, 2]);
  });

  it("photos et mini-vidéos : la consigne donne les mots dits et refuse la métaphore", () => {
    const p = consigneVerification("horloge murale dans un bureau", "le temps qui passe");
    expect(p).toContain("« le temps qui passe »");
    expect(p).toMatch(/métaphore|symbole/i);
    expect(consigneVerification("devis papier")).toContain("« devis papier »");
    const v = consigneVerificationMiniVideo("dirigeant qui fait passer un entretien d'embauche", "un dirigeant qui voulait embaucher");
    expect(v).toMatch(/image EXTRAITE/);
    expect(v).toMatch(/personne/);
  });

  it("passe 3 : le juge est la PHRASE DITE, la recherche n'est qu'une piste", () => {
    const v = consigneVerificationMiniVideo("consultante qui note sur un tableau blanc", "chercher la perte", "La première chose, c'est de chercher la perte.");
    expect(v).toContain("Phrase dite à ce moment : « La première chose, c'est de chercher la perte. »");
    expect(v).toContain("« chercher la perte »");
    expect(v).toContain("Piste de recherche (indicative) : « consultante qui note sur un tableau blanc »");
    expect(v).toMatch(/JUGE L'IMAGE CONTRE LA PHRASE DITE, JAMAIS CONTRE LA PISTE/);
    expect(consigneVerification("bureau", "leur soirée", "Ils ont retrouvé leur soirée.")).toMatch(/JUGE L'IMAGE CONTRE LA PHRASE DITE/);
    // Sans phrase : les mots montrés servent de phrase (compatibilité).
    expect(consigneVerificationMiniVideo("artisan au téléphone", "appeler les clients")).toContain("Phrase dite à ce moment : « appeler les clients »");
    expect(consigneVerification("devis papier")).toContain("Phrase dite à ce moment : « devis papier »");
    expect(CONTROLE_VISUEL_SUR_LES_REPLIS).toBe(true);
  });

  it("phraseDite : la phrase entière autour de la fenêtre, coupée aux points", () => {
    const m = "Avant tout. La vraie étape, c'est de chercher la perte. Ensuite on agit.".split(" ").map((w, i) => ({ w, a: i * 0.4 }));
    // « chercher » à 2,8 s, « perte. » à 3,6 s, « agit. » à 4,8 s.
    expect(phraseDite(m, 2.8, 4.0)).toBe("La vraie étape, c'est de chercher la perte. Ensuite on agit.");
    expect(phraseDite(m, 2.8, 3.3)).toBe("La vraie étape, c'est de chercher la perte.");
  });
});
