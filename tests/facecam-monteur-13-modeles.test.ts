/**
 * Mission L — les 13 modèles d'animation PAR DÉFAUT dans le monteur face caméra (planche 7-13 validée par Will le
 * 09/10) : vocabulaire de `ajouterCarte` et relecture, consigne de Claude, version simple (règles fixes), raccords
 * D → C, habillage 9:16 et déclinaisons, choix automatique des écrans partagés. Le titre plein écran n'est JAMAIS
 * posé tout seul. Aucun réseau, aucun appel.
 */
import { describe, expect, it } from "vitest";
import { planifierEcransPartages } from "@/briques/habillage-facecam";
import { CONVENTION_TEXTES_TOUS, IDS_MODELES_MOTION_ETENDUS, IDS_MODELES_MOTION_TOUS, carteDepuisTextes, carteDepuisTextesTous, carteExempleEtendue, preparerCarte, preparerCarteTous, miseEnPage } from "@/briques/motion";
import type { MotHorodate } from "@/domaine/types";
import { habillageFacecamRatio } from "@/moteurs/montage-facecam/declinaisons";
import { habillageFacecam } from "@/moteurs/montage-facecam/habillage";
import { lireReponseMonteur, operationsParRegles, reglesFixes, resumeOperation, roleMonteurFacecam, type OperationFacecam } from "@/moteurs/montage-facecam/monteur";
import { cartePosee, cartesDesPassages, type CarteMonteur } from "@/moteurs/montage-facecam/raccords";
import type { PassageMonteur } from "@/moteurs/montage-facecam/monteur/appliquer";

const ancre = { debutMot: 3, finMot: 9 };
const regles = (texte: string) => operationsParRegles({ id: "c1", texte, origine: "ecrite", ancre });
const carteDe = (op: OperationFacecam | undefined) => (op?.type === "ajouterCarte" ? op : null);
const monteur = (m: Partial<CarteMonteur>): CarteMonteur => ({ id: "c", debutSec: 2, finSec: 7, disposition: "plein-ecran", modele: null, textes: [], description: "", ...m });

function mots(debut: number, fin: number): MotHorodate[] {
  const m: MotHorodate[] = [];
  for (let t = debut, i = 0; t + 0.3 < fin; t += 0.385, i++) m.push({ mot: i % 5 === 2 ? "devis" : "et", debutSec: +t.toFixed(3), finSec: +(t + 0.3).toFixed(3) });
  return m;
}

describe("vocabulaire du monteur : 13 modèles", () => {
  it("la relecture de la réponse de Claude garde une carte des modèles 7 à 13 (plus de bascule en sur mesure)", () => {
    const brut = {
      reponse: "C'est fait.",
      operations: [
        { type: "ajouterCarte", debutMot: 4, finMot: 12, modele: "graphique", textes: ["Temps perdu", "Administratif : 9 h", "E-mails : 6 h"], html: null, disposition: "plein-ecran", description: "Graphique des heures", animationGardeeId: null },
        { type: "ajouterCarte", debutMot: 20, finMot: 30, modele: "check-list", textes: ["Prêt ?", "Tâches listées", "Fichiers rangés"], html: null, disposition: "ecran-partage", description: "Check-list", animationGardeeId: null },
      ],
      consignes: [{ consigneId: "c1", comprise: true, resume: "Graphique ajouté", operations: [0, 1] }],
    };
    const lu = lireReponseMonteur(brut)!;
    expect(lu.operations.map((o) => (o.type === "ajouterCarte" ? o.modele : o.type))).toEqual(["graphique", "check-list"]);
    expect(lu.ecartees).toHaveLength(0);
  });

  it("la consigne de Claude présente les 13 modèles, leur convention de textes, et le titre plein écran seulement sur demande", () => {
    for (const id of IDS_MODELES_MOTION_TOUS) expect(roleMonteurFacecam.consigne).toContain(`${id} = ${CONVENTION_TEXTES_TOUS[id]}`);
    expect(roleMonteurFacecam.consigne).toMatch(/titre-plein-ecran \(Titre plein écran\) : .*JAMAIS tout seul/);
    expect(roleMonteurFacecam.consigne).toMatch(/Titre plein écran : seulement si Will le demande/);
    expect(roleMonteurFacecam.consigne).not.toMatch(/€/);
  });

  it("résumés lisibles pour les 13 modèles", () => {
    const op = (modele: string) => ({ type: "ajouterCarte", debutMot: 0, finMot: 1, modele, textes: [], html: null, disposition: "plein-ecran", description: "", animationGardeeId: null }) as OperationFacecam;
    expect(resumeOperation(op("liste"))).toBe("Liste animée ajoutée");
    expect(resumeOperation(op("check-list"))).toBe("Carte « Check-list » ajoutée");
    expect(resumeOperation(op("documentaire"))).toBe("Carte « Documentaire » ajoutée");
    for (const id of IDS_MODELES_MOTION_TOUS) expect(resumeOperation(op(id))).toMatch(/ajoutée$/);
  });
});

describe("version simple (règles fixes) : les nouveaux modèles à la demande", () => {
  it("graphique, check-list, problème → solution, documentaire, icône + mot : modèle choisi ET carte remplie", () => {
    const cas: [string, string][] = [
      ["Fais un graphique : administratif 9 h, e-mails 6 h et devis 4 h", "graphique"],
      ["Mets une check-list : tâches listées, fichiers rangés, équipe partante", "check-list"],
      ["Montre le problème puis la solution : je perds 9 h par semaine → l'IA trie mes e-mails", "probleme-solution"],
      ["Façon reportage : à Lyon, en mars 2026, 14 salariés", "documentaire"],
      ["Mets le mot confiance en grand avec une icône", "icone-mot"],
    ];
    for (const [texte, modele] of cas) {
      const op = carteDe(regles(texte)?.[0]);
      expect(op?.modele, texte).toBe(modele);
      const posee = cartePosee(monteur({ modele: op!.modele, textes: op!.textes, description: op!.description }));
      expect(posee?.carte?.modele, texte).toBe(modele);
    }
  });

  it("les données suivent la phrase : séries du graphique (variante demandée), points de la check-list, lieu / date / chiffre", () => {
    const g = carteDe(regles("Fais un graphique en camembert : 9 h d'administratif, 6 h de mails")?.[0])!;
    expect(carteDepuisTextesTous("graphique", g.textes)).toMatchObject({ modele: "graphique", donnees: { variante: "camembert", series: [{ libelle: "administratif", valeur: 9 }, { libelle: "mails", valeur: 6 }] } });
    const c = carteDe(regles("Fais une check-list : tâches listées, fichiers rangés et équipe partante")?.[0])!;
    expect(carteDepuisTextesTous("check-list", c.textes)).toMatchObject({ donnees: { elements: [{ texte: "tâches listées" }, { texte: "fichiers rangés" }, { texte: "équipe partante" }] } });
    const d = carteDe(regles("Fais un documentaire : à Lyon, en mars 2026, 14 salariés")?.[0])!;
    expect(carteDepuisTextesTous("documentaire", d.textes)).toMatchObject({ donnees: { lieu: "Lyon", date: "mars 2026", chiffre: { valeur: 14 } } });
  });

  it("le titre plein écran n'est jamais une carte de la version simple ; la capture (sans image) reste à Claude ; les règles d'avant ne changent pas", () => {
    const titre = regles("Mets un titre plein écran « Reprendre la main »")!;
    expect(titre).toEqual([{ type: "titre", texte: "Reprendre la main", debutMot: null, finMot: null, pleinEcran: true }]);
    expect(regles("Fais une capture annotée de mon tableau de bord")).toBeNull();
    expect(carteDe(regles("Compare les deux offres côte à côte")?.[0])?.modele).toBe("deux-colonnes");
    expect(carteDe(regles("Montre les étapes du processus")?.[0])?.modele).toBe("ligne-de-temps");
    expect(carteDe(regles("Je liste les 3 points")?.[0])?.modele).toBe("liste");
    expect(carteDe(regles("Mets le chiffre 32 %")?.[0])?.modele).toBe("chiffre");
    expect(regles("Zoome quand je dis gratuit")?.[0]?.type).toBe("zoom");
    expect(regles("Divise l'écran en deux quand j'énumère")?.[0]?.type).toBe("ecranPartage");
    const r = reglesFixes([{ id: "c1", texte: "Fais une check-list : a b c, d e f, g h i", origine: "ecrite", ancre }]);
    expect(r.consignes[0]).toMatchObject({ comprise: true, resume: "Carte « Check-list » ajoutée" });
  });
});

describe("raccords D → C et habillage avec les 13 modèles", () => {
  it("chaque modèle 7 à 13 posé avec ses textes devient sa carte (la capture seulement avec une image)", () => {
    const textes: Record<string, string[]> = {
      graphique: ["Temps perdu", "Administratif : 9 h", "E-mails : 6 h", "Devis : 4 h"],
      "icone-mot": ["Confiance", "Ce que l'IA rend"],
      "probleme-solution": ["9 h perdues — chaque semaine", "L'IA trie — vous décidez"],
      "check-list": ["Prêt ?", "Tâches listées", "Fichiers rangés"],
      "capture-annotee": ["cercle : ce bouton"],
      "titre-plein-ecran": ["Reprendre la main sur son *temps*"],
      documentaire: ["Lyon, Rhône", "Mars 2026", "14 salariés — gagnent 6 h"],
    };
    for (const id of IDS_MODELES_MOTION_ETENDUS) {
      const posee = cartePosee(monteur({ modele: id, textes: textes[id], description: "Carte" }));
      if (id === "capture-annotee") expect(posee?.carte?.modele).not.toBe("capture-annotee");
      else expect(posee?.carte?.modele, id).toBe(id);
    }
  });

  it("une carte 7 à 13 qui ne tient pas dans la moitié haute passe en plein écran ; une qui tient reste en écran partagé", () => {
    const longue = ["Prêt pour l'IA ?", "Vos tâches répétitives sont toutes listées dans un document partagé", "Vos fichiers clients sont rangés au même endroit depuis des mois", "Votre équipe a été prévenue et elle est partante pour essayer", "Vous avez fixé un objectif de temps gagné par semaine"];
    expect(cartePosee(monteur({ disposition: "moitie-haute", modele: "check-list", textes: longue }))?.disposition).toBe("plein-ecran");
    expect(cartePosee(monteur({ disposition: "moitie-haute", modele: "check-list", textes: ["Prêt ?", "Tâches", "Fichiers"] }))?.disposition).toBe("moitie-haute");
    expect(cartePosee(monteur({ disposition: "moitie-haute", modele: "liste", textes: ["Un", "Deux"] }))?.disposition).toBe("moitie-haute");
  });

  it("les passages du monteur gardent le modèle 7 à 13 jusqu'à la carte posée", () => {
    const passages = [{ id: "p1", type: "ajouterCarte", debutSec: 3, finSec: 8, operation: { type: "ajouterCarte", debutMot: 0, finMot: 5, modele: "graphique", textes: ["Administratif : 9 h", "E-mails : 6 h"], html: null, disposition: "ecran-partage", description: "Heures", animationGardeeId: null } }] as unknown as PassageMonteur[];
    const [c] = cartesDesPassages(passages);
    expect(c).toMatchObject({ modele: "graphique", disposition: "moitie-haute" });
    expect(cartePosee(c)?.carte?.modele).toBe("graphique");
  });

  it("habillage 9:16 et déclinaisons : la carte 7 à 13 part au rendu dans sa composition, calée sur la parole", () => {
    const carte = carteDepuisTextesTous("check-list", ["Prêt ?", "Tâches listées", "Fichiers rangés"])!;
    const entree = { pisteMonteeCle: "montage.mov", dureeSec: 30, mots: mots(0, 30), prefixeCartes: "cartes", cartes: [{ id: "c1", debutSec: 4, finSec: 9, disposition: "plein-ecran" as const, carte }, { id: "c2", debutSec: 14, finSec: 19, disposition: "moitie-haute" as const, carte: carteExempleEtendue("graphique") }] };
    const h = habillageFacecam(entree);
    expect(h.cartes.map((c) => c.parametres.composition)).toEqual(["MotionCheckList", "MotionGraphique"]);
    expect(h.entree.cartesPleinEcran).toHaveLength(1);
    expect(h.entree.ecransPartages).toHaveLength(1);
    for (const ratio of ["4:5", "1:1", "16:9"] as const) {
      const f = habillageFacecamRatio(entree, ratio);
      expect(f.cartes.map((c) => c.parametres.composition), ratio).toEqual(["MotionCheckList", "MotionGraphique"]);
    }
  });

  it("`preparerCarteTous` rend exactement `preparerCarte` pour les 6 premiers modèles", () => {
    const mp = miseEnPage("9:16", "plein-ecran", 5);
    const liste = carteDepuisTextes("liste", ["Un point", "Un autre"])!;
    expect(preparerCarteTous({ carte: liste }, mp)).toEqual(preparerCarte({ carte: liste }, mp));
    expect(preparerCarteTous({ code: { html: "<div>x</div>", css: "", js: "" }, repli: liste }, mp)).toEqual(preparerCarte({ code: { html: "<div>x</div>", css: "", js: "" }, repli: liste }, mp));
  });
});

describe("choix automatique des écrans partagés parmi les 13 modèles", () => {
  const phrases = [
    { texte: "Bonjour à tous et bienvenue.", debutSec: 0, finSec: 2 },
    { texte: "Un dirigeant passe 9 heures sur l'administratif, 6 heures sur les e-mails et 4 heures sur les devis.", debutSec: 3, finSec: 8 },
    { texte: "On en parle souvent.", debutSec: 8, finSec: 14 },
    { texte: "Avant de commencer, vérifiez trois choses : vos tâches, vos fichiers et votre équipe.", debutSec: 15, finSec: 20 },
    { texte: "Reprendre la main sur son temps.", debutSec: 27, finSec: 31 },
  ];

  it("graphique et check-list choisis d'après la phrase ; jamais de titre ni de titre plein écran", () => {
    const passages = planifierEcransPartages(phrases, 60);
    expect(passages.map((p) => p.carte.modele)).toEqual(["graphique", "check-list"]);
    expect(passages.every((p) => p.carte.modele !== "titre" && p.carte.modele !== "titre-plein-ecran")).toBe(true);
  });

  it("habillage sans cartes du monteur : les écrans partagés d'office partent dans les compositions des nouveaux modèles", () => {
    const m: MotHorodate[] = [];
    for (const p of phrases) {
      const ws = p.texte.split(" ");
      ws.forEach((w, i) => m.push({ mot: w, debutSec: +(p.debutSec + (i * (p.finSec - p.debutSec)) / ws.length).toFixed(3), finSec: +(p.debutSec + ((i + 0.8) * (p.finSec - p.debutSec)) / ws.length).toFixed(3) }));
    }
    const h = habillageFacecam({ pisteMonteeCle: "montage.mov", dureeSec: 60, mots: m, prefixeCartes: "cartes" });
    expect(h.cartes.map((c) => c.parametres.composition)).toContain("MotionGraphique");
    expect(h.cartes.map((c) => c.parametres.composition)).not.toContain("MotionTitrePleinEcran");
  });
});
