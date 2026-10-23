/**
 * Lot F2 — modèles d'animation 7 à 13 de la brique commune `motion` : schémas, choix automatique, catalogue (brique et
 * agent monteur), pont textes → données, calage, demande de rendu. Non-régression : les 6 modèles validés restent
 * strictement inchangés ; mission L : le monteur face caméra a les 13 modèles par défaut (`modelesEtendus: false` rend
 * le catalogue des 6 premiers à l'identique).
 */
import { describe, expect, it } from "vitest";
import { CATALOGUE_MOTION, IDS_MODELES_MOTION } from "@/briques/motion/catalogue";
import { calerCarteEtendue, calerCarteTous } from "@/briques/motion/calage-etendu";
import { CATALOGUE_MOTION_ETENDU, CATALOGUE_MOTION_TOUS, carteExempleEtendue, estModeleEtendu, ficheModeleTous, IDS_MODELES_MOTION_ETENDUS, IDS_MODELES_MOTION_TOUS } from "@/briques/motion/catalogue-etendu";
import { choisirModele } from "@/briques/motion/choix";
import { choisirModeleEtendu, choisirModeleTous, lireDemandeModele, varianteGraphique } from "@/briques/motion/choix-etendu";
import { miseEnPage, parametresCarteModele } from "@/briques/motion/demande";
import { parametresCarteTous } from "@/briques/motion/demande-etendue";
import { tientEnMoitieHaute } from "@/briques/motion/disposition-etendue";
import { CATALOGUE_ACTIF_ETENDU, catalogueActifEtendu } from "@/briques/motion/catalogue-actif-etendu";
import { CATALOGUE_ACTIF, CATALOGUE_ACTIF_BASE, cartesPourFormat } from "@/briques/motion/pourFormat";
import { contientNomOuBandeau } from "@/briques/motion/documentaire";
import { carteExempleAxionEtendue, EXEMPLES_AXION_ETENDUS, EXEMPLES_GRAPHIQUE } from "@/briques/motion/exemples-axion-etendus";
import { schemaCarteModele } from "@/briques/motion/schemas";
import { lireCarteEtendue, lireCarteTous, schemaCarteModeleEtendu, schemaCarteMotionTous, schemaDocumentaire, schemaGraphique } from "@/briques/motion/schemas-etendus";
import { carteDepuisTextesEtendus, CONVENTION_TEXTES_ETENDUS } from "@/briques/motion/textes-etendus";
import type { IdModeleMotionEtendu } from "@/briques/motion/types-etendus";
import { catalogueTexte, exemplesDemandes } from "@/moteurs/montage-facecam/monteur/catalogue";
import { exemplesModelesEtendus, MODELES_CARTE_ETENDUS, MODELES_MONTEUR_ETENDUS, regleModelesEtendus, schemaAjouterCarteEtendue } from "@/moteurs/montage-facecam/monteur/catalogue-motion-etendu";
import { MODELES_CARTE, schemaAjouterCarte } from "@/moteurs/montage-facecam/monteur/operations";

const CAPTURE = { src: "https://r2.exemple/mes-images/tableau.png", origine: "mes-images" as const, largeur: 1440, hauteur: 1800 };

describe("catalogue des modèles 7 à 13", () => {
  it("compte 7 modèles numérotés 7 à 13, chacun avec sa composition, sa phrase d'aide et son exemple valide", () => {
    expect(IDS_MODELES_MOTION_ETENDUS).toEqual(["graphique", "icone-mot", "probleme-solution", "check-list", "capture-annotee", "titre-plein-ecran", "documentaire"]);
    IDS_MODELES_MOTION_ETENDUS.forEach((id, i) => {
      const f = CATALOGUE_MOTION_ETENDU[id];
      expect(f.numero).toBe(7 + i);
      expect(f.composition).toMatch(/^Motion[A-Z]/);
      expect(f.aide.length).toBeGreaterThan(10);
      expect(f.dureeSec[0]).toBeGreaterThanOrEqual(3);
      expect(f.dureeSec[1]).toBeLessThanOrEqual(8);
      expect(schemaCarteModeleEtendu.safeParse(carteExempleEtendue(id)).success).toBe(true);
    });
  });

  it("le titre plein écran n'est JAMAIS automatique ; tous les autres le sont", () => {
    expect(CATALOGUE_MOTION_ETENDU["titre-plein-ecran"].automatique).toBe(false);
    for (const id of IDS_MODELES_MOTION_ETENDUS.filter((x) => x !== "titre-plein-ecran")) expect(CATALOGUE_MOTION_ETENDU[id].automatique).toBe(true);
  });

  it("réunit les 13 modèles sans toucher aux 6 validés", () => {
    expect(IDS_MODELES_MOTION).toEqual(["liste", "chiffre", "avant-apres", "ligne-de-temps", "deux-colonnes", "titre"]);
    expect(IDS_MODELES_MOTION_TOUS).toHaveLength(13);
    expect(new Set(Object.values(CATALOGUE_MOTION_TOUS).map((f) => f.composition)).size).toBe(13);
    expect(ficheModeleTous("liste")).toBe(CATALOGUE_MOTION.liste);
    expect(ficheModeleTous("graphique")?.numero).toBe(7);
    expect(ficheModeleTous("inconnu")).toBeUndefined();
    expect(estModeleEtendu("check-list")).toBe(true);
    expect(estModeleEtendu("liste")).toBe(false);
  });

  it("les exemples Axion sont valides, liés à Axion-IA, et la planche montre les 3 graphiques", () => {
    for (const id of IDS_MODELES_MOTION_ETENDUS) expect(lireCarteEtendue(carteExempleAxionEtendue(id))).not.toBeNull();
    expect(schemaGraphique.safeParse(EXEMPLES_GRAPHIQUE.courbe).success).toBe(true);
    expect(schemaGraphique.safeParse(EXEMPLES_GRAPHIQUE.camembert).success).toBe(true);
    expect(EXEMPLES_GRAPHIQUE.camembert.series.reduce((s, v) => s + v.valeur, 0)).toBe(100);
    const tout = JSON.stringify(EXEMPLES_AXION_ETENDUS).toLowerCase();
    expect(tout).toMatch(/ia|dirigeant|pme|devis/);
    expect(tout).not.toMatch(/fuite d'eau|plomb/);
  });
});

describe("schémas des modèles 7 à 13", () => {
  it("graphique : 2 à 6 valeurs positives, mise en avant dans les bornes", () => {
    const ok = { variante: "barres", series: [{ libelle: "A", valeur: 3 }, { libelle: "B", valeur: 5 }] };
    expect(schemaGraphique.safeParse(ok).success).toBe(true);
    expect(schemaGraphique.safeParse({ ...ok, series: [{ libelle: "A", valeur: 3 }] }).success).toBe(false);
    expect(schemaGraphique.safeParse({ ...ok, series: Array.from({ length: 7 }, (_, i) => ({ libelle: `S${i}`, valeur: i })) }).success).toBe(false);
    expect(schemaGraphique.safeParse({ ...ok, miseEnAvant: 2 }).success).toBe(false);
    expect(schemaGraphique.safeParse({ ...ok, variante: "radar" }).success).toBe(false);
    expect(schemaGraphique.safeParse({ ...ok, series: [{ libelle: "A", valeur: -1 }, { libelle: "B", valeur: 5 }] }).success).toBe(false);
    expect(schemaGraphique.safeParse({ variante: "camembert", series: [{ libelle: "A", valeur: 0 }, { libelle: "B", valeur: 0 }] }).success).toBe(false);
  });

  it("icône + mot : 3 mots au plus, icône connue", () => {
    expect(schemaCarteModeleEtendu.safeParse({ modele: "icone-mot", donnees: { mot: "Déléguer", icone: "robot" } }).success).toBe(true);
    expect(schemaCarteModeleEtendu.safeParse({ modele: "icone-mot", donnees: { mot: "un deux trois quatre", icone: "robot" } }).success).toBe(false);
    expect(schemaCarteModeleEtendu.safeParse({ modele: "icone-mot", donnees: { mot: "Déléguer", icone: "licorne" } }).success).toBe(false);
  });

  it("check-list : 2 à 6 points ; capture : 1 à 4 annotations dans l'image", () => {
    expect(schemaCarteModeleEtendu.safeParse({ modele: "check-list", donnees: { elements: [{ texte: "Un" }] } }).success).toBe(false);
    const annotation = { type: "cercle", x: 0.1, y: 0.1, largeur: 0.3, hauteur: 0.2 };
    expect(schemaCarteModeleEtendu.safeParse({ modele: "capture-annotee", donnees: { image: CAPTURE, annotations: [annotation] } }).success).toBe(true);
    expect(schemaCarteModeleEtendu.safeParse({ modele: "capture-annotee", donnees: { image: CAPTURE, annotations: [] } }).success).toBe(false);
    expect(schemaCarteModeleEtendu.safeParse({ modele: "capture-annotee", donnees: { image: CAPTURE, annotations: [{ ...annotation, x: 0.9, largeur: 0.3 }] } }).success).toBe(false);
    expect(schemaCarteModeleEtendu.safeParse({ modele: "capture-annotee", donnees: { image: { ...CAPTURE, origine: "internet" }, annotations: [annotation] } }).success).toBe(false);
  });

  it("documentaire : au moins un lieu, une date ou un chiffre ; JAMAIS de nom de personne ni de bandeau « nom · Axion-IA »", () => {
    expect(schemaDocumentaire.safeParse({ lieu: "Lyon, Rhône" }).success).toBe(true);
    expect(schemaDocumentaire.safeParse({}).success).toBe(false);
    expect(schemaDocumentaire.safeParse({ lieu: "Lyon", contexte: "Will · Axion-IA" }).success).toBe(false);
    expect(schemaDocumentaire.safeParse({ lieu: "Lyon", contexte: "Fondateur | Axion" }).success).toBe(false);
    expect(schemaDocumentaire.safeParse({ lieu: "Chez M. Dupont" }).success).toBe(false);
    expect(schemaDocumentaire.safeParse({ date: "Mars 2026", chiffre: { valeur: 3, libelle: "Maître Martin a gagné" } }).success).toBe(false);
    expect(contientNomOuBandeau("Une PME de 14 salariés")).toBe(false);
    expect(contientNomOuBandeau("Saint-Étienne, Loire")).toBe(false);
    expect(contientNomOuBandeau("Mme Leroy")).toBe(true);
  });

  it("le schéma des 13 accepte aussi les 6 validés ; celui des 6 refuse les nouveaux (inchangé)", () => {
    expect(schemaCarteMotionTous.safeParse({ modele: "liste", donnees: { elements: [{ texte: "Un point" }, { texte: "Un autre" }] } }).success).toBe(true);
    expect(schemaCarteMotionTous.safeParse(carteExempleEtendue("documentaire")).success).toBe(true);
    expect(schemaCarteModele.safeParse(carteExempleEtendue("graphique")).success).toBe(false);
    expect(lireCarteTous({ modele: "graphique", donnees: { variante: "barres", series: [] } })).toBeNull();
  });
});

describe("choix automatique d'après la phrase", () => {
  const modele = (p: string, ctx = {}) => choisirModeleTous(p, ctx)?.modele ?? null;

  it("graphique : plusieurs valeurs → barres ; parts d'un tout → camembert ; dans le temps → courbe", () => {
    const b = choisirModeleTous("Un dirigeant passe 9 heures sur l'administratif, 6 heures sur les e-mails et 4 heures sur les devis.");
    expect(b?.modele).toBe("graphique");
    expect(b?.carte).toMatchObject({ donnees: { variante: "barres", unite: "h", series: [{ libelle: "Administratif", valeur: 9 }, { libelle: "E-mails", valeur: 6 }, { libelle: "Devis", valeur: 4 }] } });
    const c = choisirModeleTous("Leur semaine se répartit ainsi : 38 % d'administratif, 30 % pour les clients, 20 % pour l'équipe et 12 % de stratégie.");
    expect(c?.carte).toMatchObject({ modele: "graphique", donnees: { variante: "camembert", unite: "%" } });
    const k = choisirModeleTous("En 2023, 20 clients ; en 2024, 45 clients ; en 2025, 80 clients.");
    expect(k?.carte).toMatchObject({ modele: "graphique", donnees: { variante: "courbe", series: [{ libelle: "2023", valeur: 20 }, { libelle: "2024", valeur: 45 }, { libelle: "2025", valeur: 80 }] } });
    expect(varianteGraphique("montre l'évolution")).toBe("courbe");
    expect(varianteGraphique("en camembert")).toBe("camembert");
  });

  it("un seul chiffre reste un « chiffre », « de 12 h à 3 h » reste un avant / après (règles validées prioritaires)", () => {
    expect(modele("Chaque semaine, on vous rend 9 heures de travail.")).toBe("chiffre");
    expect(modele("On passe de 12 heures à 3 heures de paperasse par semaine.")).toBe("avant-apres");
  });

  it("check-list : « vérifiez », « avez-vous… ? », « check-list » → cases à cocher (avant la liste)", () => {
    const c = choisirModeleTous("Avant de vous lancer, vérifiez trois choses : vos tâches sont listées, vos fichiers sont rangés et votre équipe est partante.");
    expect(c?.modele).toBe("check-list");
    expect(c?.carte).toMatchObject({ donnees: { titre: "Avant de vous lancer", elements: [{ texte: "Vos tâches sont listées" }, { texte: "Vos fichiers sont rangés" }, { texte: "Votre équipe est partante" }] } });
    const q = choisirModeleTous("Avez-vous listé vos tâches répétées ? Avez-vous rangé vos fichiers ? Avez-vous choisi un premier outil ?");
    expect(q?.modele).toBe("check-list");
    if (q?.carte.modele === "check-list") expect(q.carte.donnees.elements).toHaveLength(3);
    // Sans indice de vérification, une énumération reste une liste (règle validée).
    expect(modele("Trois questions : où perdez-vous du temps, quelles tâches se répètent, que coûte une erreur ?")).toBe("liste");
  });

  it("problème → solution", () => {
    const c = choisirModeleTous("Le problème, c'est que vos devis prennent deux heures. La solution, c'est de laisser l'IA préparer le brouillon.");
    expect(c?.modele).toBe("probleme-solution");
    expect(c?.carte).toMatchObject({ donnees: { probleme: { titre: "Vos devis prennent deux heures" }, solution: { titre: "Laisser l'IA préparer le brouillon" } } });
    expect(modele("Au lieu de passer vos soirées sur les relances, laissez l'IA les envoyer pour vous.")).toBe("probleme-solution");
  });

  it("documentaire : un lieu et une date (ou un chiffre), sans nom de personne", () => {
    const c = choisirModeleTous("En mars 2026, à Lyon, une PME de 14 salariés a automatisé tous ses devis.");
    expect(c?.modele).toBe("documentaire");
    expect(c?.carte).toMatchObject({ donnees: { lieu: "Lyon", date: "Mars 2026", chiffre: { valeur: 14, unite: "salariés" } } });
    if (c?.carte.modele === "documentaire") expect(schemaDocumentaire.safeParse(c.carte.donnees).success).toBe(true);
    // Une date sans lieu : pas de carte documentaire.
    expect(modele("En 2026, tout le monde parle d'intelligence artificielle.")).not.toBe("documentaire");
  });

  it("icône + mot : « un seul mot : … », « le maître-mot, c'est … »", () => {
    const c = choisirModeleTous("Si je devais résumer en un seul mot : déléguer les tâches répétitives à l'IA.");
    expect(c?.modele).toBe("icone-mot");
    expect(c?.carte).toMatchObject({ donnees: { mot: "Déléguer", surTitre: "Un seul mot", sousTitre: "les tâches répétitives à l'IA", icone: "robot" } });
    expect(choisirModeleTous("Le maître-mot, c'est « confiance ».")?.carte).toMatchObject({ modele: "icone-mot", donnees: { mot: "Confiance" } });
  });

  it("capture annotée : seulement avec une image et quand on la montre", () => {
    const p = "Regardez ici, en haut à droite : ce chiffre, ce sont les heures gagnées.";
    expect(modele(p)).not.toBe("capture-annotee");
    const c = choisirModeleTous(p, { capture: CAPTURE });
    expect(c?.modele).toBe("capture-annotee");
    if (c?.carte.modele === "capture-annotee") {
      expect(c.carte.donnees.image).toBe(CAPTURE);
      expect(c.carte.donnees.annotations[0]).toMatchObject({ type: "cercle", y: 0.12, x: 0.5 });
      expect(schemaCarteModeleEtendu.safeParse(c.carte).success).toBe(true);
    }
    expect(choisirModeleTous("Cliquez sur ce bouton pour lancer l'envoi.", { capture: CAPTURE })?.carte).toMatchObject({ donnees: { annotations: [{ type: "fleche", texte: "Bouton" }] } });
  });

  it("le titre plein écran n'est JAMAIS choisi tout seul, seulement à la demande", () => {
    const phrases = ["Reprendre la main sur son temps", "Chapitre 2 : reprendre la main sur son temps.", "Bienvenue dans ce nouvel épisode sur l'IA pour les dirigeants"];
    for (const p of phrases) {
      expect(choisirModeleTous(p)?.modele).not.toBe("titre-plein-ecran");
      expect(choisirModeleEtendu(p)?.modele).not.toBe("titre-plein-ecran");
    }
    expect(lireDemandeModele("Monteur, mets un titre plein écran « Reprendre la main »")).toBe("titre-plein-ecran");
  });

  it("toutes les cartes choisies d'office passent leur schéma", () => {
    const phrases = [
      "Un dirigeant passe 9 heures sur l'administratif, 6 heures sur les e-mails et 4 heures sur les devis.",
      "Avant de vous lancer, vérifiez trois choses : vos tâches sont listées, vos fichiers sont rangés et votre équipe est partante.",
      "Le problème, c'est que vos devis prennent deux heures. La solution, c'est de laisser l'IA préparer le brouillon.",
      "En mars 2026, à Lyon, une PME de 14 salariés a automatisé tous ses devis.",
      "Si je devais résumer en un seul mot : déléguer les tâches répétitives à l'IA.",
    ];
    for (const p of phrases) {
      const c = choisirModeleTous(p);
      expect(c).not.toBeNull();
      expect(schemaCarteMotionTous.safeParse(c!.carte).success, p).toBe(true);
    }
  });

  it("rien qui mérite une carte → null ; les 6 règles validées ne changent pas", () => {
    expect(choisirModeleTous("Bonjour à tous.")).toBeNull();
    expect(choisirModeleTous("court")).toBeNull();
    const p = "D'abord le diagnostic, ensuite la formation, puis l'automatisation, enfin le suivi.";
    expect(choisirModeleTous(p)).toEqual(choisirModele(p));
  });

  it("lit les demandes explicites des 7 modèles", () => {
    const attendus: [string, IdModeleMotionEtendu][] = [
      ["Fais un graphique en barres du temps perdu", "graphique"],
      ["Montre-le en camembert", "graphique"],
      ["Mets le mot « Déléguer » en grand avec une icône", "icone-mot"],
      ["Montre le problème puis la solution", "probleme-solution"],
      ["Fais une check-list qui se coche", "check-list"],
      ["Entoure le chiffre sur ma capture", "capture-annotee"],
      ["Une carte façon reportage avec le lieu et la date", "documentaire"],
    ];
    for (const [p, id] of attendus) expect(lireDemandeModele(p), p).toBe(id);
    expect(lireDemandeModele("Zoome sur moi")).toBeNull();
    expect(lireDemandeModele(null)).toBeNull();
  });
});

describe("textes de l'opération ajouterCarte → données", () => {
  it("chaque modèle a sa convention et se remplit depuis ses textes", () => {
    for (const id of IDS_MODELES_MOTION_ETENDUS) expect(CONVENTION_TEXTES_ETENDUS[id].length).toBeGreaterThan(10);
    const g = carteDepuisTextesEtendus("graphique", ["Où part le temps", "Administratif : 9 h", "E-mails : 6 h", "barres"]);
    expect(g).toMatchObject({ donnees: { variante: "barres", titre: "Où part le temps", unite: "h", series: [{ libelle: "Administratif", valeur: 9 }, { libelle: "E-mails", valeur: 6 }] } });
    expect(carteDepuisTextesEtendus("graphique", ["Administratif : 38 %", "Clients : 62 %"])).toMatchObject({ donnees: { variante: "camembert" } });
    expect(carteDepuisTextesEtendus("probleme-solution", ["Les devis à la main — 2 heures chacun", "Un devis en 10 min"])).toMatchObject({ donnees: { probleme: { titre: "Les devis à la main", detail: "2 heures chacun" }, solution: { titre: "Un devis en 10 min" } } });
    expect(carteDepuisTextesEtendus("check-list", ["Prêt ?", "Point A", "Point B"])).toMatchObject({ donnees: { titre: "Prêt ?", elements: [{ texte: "Point A" }, { texte: "Point B" }] } });
    expect(carteDepuisTextesEtendus("titre-plein-ecran", ["Reprendre la main"])).toMatchObject({ donnees: { titre: "Reprendre la main" } });
    expect(carteDepuisTextesEtendus("icone-mot", ["Déléguer", "à l'IA"])).toMatchObject({ donnees: { mot: "Déléguer", icone: "robot" } });
    const doc = carteDepuisTextesEtendus("documentaire", ["Lyon, Rhône", "Mars 2026", "14 salariés — une PME", "Will · Axion-IA"]);
    expect(doc).toMatchObject({ donnees: { lieu: "Lyon, Rhône", date: "Mars 2026", chiffre: { valeur: 14, unite: "salariés", libelle: "une PME" } } });
    expect(JSON.stringify(doc)).not.toMatch(/Axion|·/);
  });

  it("la capture annotée exige l'image du passage", () => {
    expect(carteDepuisTextesEtendus("capture-annotee", ["cercle : 9 h"])).toBeNull();
    const c = carteDepuisTextesEtendus("capture-annotee", ["Votre tableau", "cercle : 9 h", "flèche : Un clic"], { capture: CAPTURE });
    expect(c).toMatchObject({ donnees: { titre: "Votre tableau", annotations: [{ type: "cercle", texte: "9 h" }, { type: "fleche", texte: "Un clic" }] } });
    expect(schemaCarteModeleEtendu.safeParse(c).success).toBe(true);
  });

  it("textes insuffisants → null", () => {
    expect(carteDepuisTextesEtendus("graphique", ["Un seul : 3 h"])).toBeNull();
    expect(carteDepuisTextesEtendus("probleme-solution", ["Seul"])).toBeNull();
    expect(carteDepuisTextesEtendus("check-list", ["Seul"])).toBeNull();
    expect(carteDepuisTextesEtendus("documentaire", ["M. Dupont"])).toBeNull();
  });
});

describe("calage sur la parole et demande de rendu", () => {
  const mots = [
    { mot: "d'abord", debutSec: 10.2, finSec: 10.5 },
    { mot: "vos", debutSec: 10.9, finSec: 11.0 },
    { mot: "tâches", debutSec: 11.0, finSec: 11.3 },
    { mot: "ensuite", debutSec: 11.8, finSec: 12.1 },
    { mot: "fichiers", debutSec: 12.4, finSec: 12.8 },
  ];

  it("chaque case de la check-list se coche quand elle est dite", () => {
    const c = calerCarteEtendue({ modele: "check-list", donnees: { elements: [{ texte: "Vos tâches" }, { texte: "Vos fichiers" }] } }, mots, 10, 5);
    expect(c).toMatchObject({ donnees: { elements: [{ aSec: 1.0 }, { aSec: 2.4 }] } });
  });

  it("les 6 modèles validés passent par le calage inchangé", () => {
    const c = calerCarteTous({ modele: "chiffre", donnees: { valeur: 9, libelle: "heures" } }, [], 0, 5);
    expect(c).toMatchObject({ modele: "chiffre", donnees: { aSec: 0.3 } });
  });

  it("la demande de rendu vise la bonne composition, par l'opération composition existante", () => {
    const mp = miseEnPage("9:16", "plein-ecran", 5);
    const p = parametresCarteTous(carteExempleEtendue("graphique"), { ...mp, style: "spectaculaire" });
    expect(p.composition).toBe("MotionGraphique");
    expect(p.proprietes).toMatchObject({ modele: "graphique", style: "spectaculaire", images: 125, fps: 25 });
    expect(parametresCarteTous({ modele: "liste", donnees: { elements: [{ texte: "a b" }, { texte: "c d" }] } }, mp)).toEqual(parametresCarteModele({ modele: "liste", donnees: { elements: [{ texte: "a b" }, { texte: "c d" }] } }, mp));
  });
});

describe("place en moitié haute d'un écran partagé", () => {
  it("une check-list courte tient, une check-list de 4 longs points passe en plein écran", () => {
    expect(tientEnMoitieHaute({ modele: "check-list", donnees: { elements: [{ texte: "Tâches listées" }, { texte: "Fichiers rangés" }, { texte: "Équipe partante" }] } })).toBe(true);
    expect(tientEnMoitieHaute(carteExempleAxionEtendue("check-list"))).toBe(false);
  });

  it("la carte documentaire d'exemple tient (contexte omis) ; les autres modèles tiennent", () => {
    expect(tientEnMoitieHaute(carteExempleAxionEtendue("documentaire"))).toBe(true);
    for (const id of ["graphique", "icone-mot", "probleme-solution", "titre-plein-ecran"] as const) expect(tientEnMoitieHaute(carteExempleAxionEtendue(id)), id).toBe(true);
    const longues = Array.from({ length: 6 }, (_, i) => ({ libelle: `Tâche ${i}`, valeur: i + 1 }));
    expect(tientEnMoitieHaute({ modele: "graphique", donnees: { variante: "barres", series: longues } })).toBe(false);
  });
});

describe("API unique cartesPourFormat (mission H) avec le catalogue à 13 modèles", () => {
  const phrases = [
    { id: "p1", texte: "Un dirigeant passe 9 heures sur l'administratif, 6 heures sur les e-mails et 4 heures sur les devis.", debutSec: 2, finSec: 7 },
    { id: "p2", texte: "Avant de vous lancer, vérifiez trois choses : vos tâches sont listées, vos fichiers sont rangés et votre équipe est partante.", debutSec: 9, finSec: 15 },
    { id: "p3", texte: "Reprendre la main sur son temps", debutSec: 16, finSec: 20 },
    { id: "p4", texte: "Regardez ici, ce chiffre en haut à droite.", debutSec: 22, finSec: 27 },
  ];

  it("catalogue de base : les 6 modèles validés seulement", () => {
    const cartes = cartesPourFormat({ format: "facecam", ratio: "9:16", phrases, catalogue: CATALOGUE_ACTIF_BASE });
    expect(cartes.every((c) => !["graphique", "check-list", "titre-plein-ecran", "capture-annotee"].includes(c.modele))).toBe(true);
    expect(CATALOGUE_ACTIF_BASE.ids()).toHaveLength(6);
  });

  it("intégration Z : le catalogue actif par défaut est celui des 13 modèles (titre plein écran jamais seul)", () => {
    expect(CATALOGUE_ACTIF).toBe(CATALOGUE_ACTIF_ETENDU);
    expect(CATALOGUE_ACTIF.ids()).toHaveLength(13);
    const cartes = cartesPourFormat({ format: "facecam", ratio: "9:16", phrases, intensite: "tres-dynamique" });
    expect(cartes.map((c) => c.modele)).toEqual(["graphique", "check-list"]);
  });

  it("avec le catalogue étendu : graphique et check-list choisis tout seuls, jamais de titre plein écran, capture seulement avec une image", () => {
    const cartes = cartesPourFormat({ format: "facecam", ratio: "9:16", phrases, catalogue: CATALOGUE_ACTIF_ETENDU, intensite: "tres-dynamique" });
    expect(cartes.map((c) => c.modele)).toEqual(["graphique", "check-list"]);
    expect(cartes[0].parametres.composition).toBe("MotionGraphique");
    expect(cartes[0].parametres.proprietes).toMatchObject({ style: "spectaculaire", fps: 25 });
    const avecImage = cartesPourFormat({ format: "facecam", ratio: "9:16", phrases, catalogue: catalogueActifEtendu({ capture: CAPTURE }) });
    expect(avecImage.map((c) => c.modele)).toContain("capture-annotee");
  });

  it("demandé explicitement : le titre plein écran est posé ; en moitié haute, une check-list trop longue n'est pas rendue", () => {
    const demande = cartesPourFormat({ format: "facecam", ratio: "9:16", phrases: [{ id: "t", texte: "Reprendre la main sur son *temps*", debutSec: 0, finSec: 4, modele: "titre-plein-ecran" }], catalogue: CATALOGUE_ACTIF_ETENDU });
    expect(demande[0]).toMatchObject({ modele: "titre-plein-ecran", origine: "demande", parametres: { composition: "MotionTitrePleinEcran" } });
    const moitie = cartesPourFormat({ format: "facecam", ratio: "9:16", disposition: "moitie-haute", phrases: [{ id: "c", texte: "x", debutSec: 0, finSec: 6, modele: "check-list", textes: ["Prêt pour l'IA ?", ...EXEMPLES_AXION_ETENDUS["check-list"].elements.map((e) => e.texte)] }], catalogue: CATALOGUE_ACTIF_ETENDU });
    expect(moitie).toHaveLength(0);
  });
});

describe("catalogue de l'agent monteur", () => {
  it("branché (mission L, planche validée par Will le 09/10) : catalogue, exemples et opération ajouterCarte portent les 13 modèles par défaut", () => {
    // Par défaut = avec les modèles 7 à 13 ; `modelesEtendus: false` rend exactement le texte des 6 premiers.
    expect(catalogueTexte()).toBe(catalogueTexte({ modelesEtendus: true }));
    expect(catalogueTexte()).toMatch(/check-list|capture-annotee|documentaire/);
    expect(catalogueTexte({ modelesEtendus: false })).not.toMatch(/check-list|capture-annotee|documentaire/);
    expect(catalogueTexte()).toBe(catalogueTexte({ modelesEtendus: false }).replace(/(- ajouterCarte \(Carte animée\) : [^\n]*)/, `$1\n${regleModelesEtendus()}`));
    expect(exemplesDemandes()).toEqual(exemplesDemandes(8, { modelesEtendus: true }));
    expect(exemplesDemandes()).toContain(CATALOGUE_MOTION_ETENDU.graphique.aide);
    expect(exemplesDemandes(8, { modelesEtendus: false })).not.toContain(CATALOGUE_MOTION_ETENDU.graphique.aide);
    expect(MODELES_CARTE).toHaveLength(13);
    expect([...MODELES_CARTE]).toEqual(IDS_MODELES_MOTION_TOUS);
    const base = { type: "ajouterCarte", debutMot: 0, finMot: 3, textes: [], html: null, disposition: "plein-ecran", description: "x", animationGardeeId: null };
    for (const id of IDS_MODELES_MOTION_TOUS) expect(schemaAjouterCarte.safeParse({ ...base, modele: id }).success).toBe(true);
    expect(schemaAjouterCarte.safeParse({ ...base, modele: null }).success).toBe(true);
    expect(schemaAjouterCarte.safeParse({ ...base, modele: "inconnu" }).success).toBe(false);
    // Compatibilité lot F2 : les noms « étendus » désignent désormais le même vocabulaire.
    expect(schemaAjouterCarteEtendue).toBe(schemaAjouterCarte);
    expect(schemaAjouterCarteEtendue.safeParse({ ...base, modele: "graphique" }).success).toBe(true);
    expect(schemaAjouterCarteEtendue.safeParse({ ...base, modele: "inconnu" }).success).toBe(false);
  });

  it("avec les modèles étendus : la règle et les exemples « Que puis-je demander ? » les présentent", () => {
    expect(MODELES_CARTE_ETENDUS).toHaveLength(13);
    expect(MODELES_MONTEUR_ETENDUS.map((e) => e.modele)).toEqual(IDS_MODELES_MOTION_ETENDUS);
    const texte = catalogueTexte({ modelesEtendus: true });
    for (const id of IDS_MODELES_MOTION_ETENDUS) expect(texte).toContain(id);
    expect(texte).toContain(regleModelesEtendus());
    expect(regleModelesEtendus()).toMatch(/titre-plein-ecran \(Titre plein écran\) : .*JAMAIS tout seul/);
    expect(regleModelesEtendus()).toMatch(/jamais de nom de personne/);
    const ex = exemplesDemandes(8, { modelesEtendus: true });
    expect(ex).toHaveLength(exemplesDemandes().length);
    expect(ex.slice(2, 5)).toEqual(exemplesModelesEtendus(3));
    expect(exemplesModelesEtendus()).toHaveLength(7);
    // Aucun prix affiché pour facecam.
    expect(`${texte}\n${exemplesModelesEtendus().join("\n")}`).not.toMatch(/€|\bprix\b|co[uû]t/i);
  });
});
