/**
 * Fidélité à la v4 (14/10) : les objets d'un écran du cas concret s'arrêtent AU-DESSUS de la bande des sous-titres
 * (zone utile), pour que rien ne passe sous les sous-titres. Rouge avant `zone-objets.ts`.
 */
import { describe, expect, it } from "vitest";
import { boiteDans, controlerProprietes, disposer, proprietesEcrans, zonesEcran, type EcranCale } from "../../../src/briques/ecrans-motion";
import { BANDE_SOUS_TITRES_CAS_CONCRET, ZONE_PLEINE_IMAGE_CAS_CONCRET } from "../../../src/formats/cas-concret";
import { dessinAuDessusDesSousTitres, proprietesPleineImage } from "../../../src/moteurs/montage-cas-concret/zone-objets";
import { zoneProtegeeCombinee } from "../../../src/reseaux";

const QUATRE = zoneProtegeeCombinee("9:16", ["facebook", "instagram", "tiktok", "linkedin"])!;
const BANDE = 0.08;

/** Un écran de chaque type avec les textes de la vidéo de référence ; l'écran `objet` montre un vrai écran. */
const CONTENUS = [
  { type: "accroche", etiquette: "Recrutement · cas réel", lignes: ["On recrute", "nos collaborateurs", "*en…*"] },
  { type: "chiffre", nombre: 15, unite: "minutes.", pastilles: ["0 CV à trier", "0 relance", "0 papier"], compteur: false },
  { type: "liste-avant", etiquette: "Avant", titre: "C'était *ça.*", taches: ["Trier les candidatures", "Répondre à chacun", "Relancer", "Caler un rendez-vous"], total: { valeur: "+1 H", ligne: "pour chaque personne" } },
  { type: "titre", lignes: ["Alors on a", "tout *automatisé.*"] },
  { type: "etape", numero: 2, nombreEtapes: 6, titre: "L'*inscription*", ligne: "Toute seule. En vingt secondes.", visuel: { capture: { cle: "form" } }, puces: ["Inscrite", "Réservé sans nous"] },
  { type: "objet", titre: "Le *rendez-vous*", ligne: "Elle le choisit elle-même.", visuel: { capture: { cle: "form" } } },
  { type: "preuve", etiquette: "Et les données ?", titre: "Conforme *RGPD.*", puces: ["100 % automatique", "0 intervention manuelle"] },
  { type: "resultat", etiquette: "Résultat", titre: "Des heures *gagnées.*", avant: "+1 H", maintenant: "15 MIN", ligne: "à chaque recrutement" },
  { type: "question", lignes: ["Et dans votre", "*entreprise ?*"], question: "Quelle tâche pourrait tourner toute seule ?" },
  { type: "appel-mot", etiquette: "Pour la recevoir", invite: "Écrivez", mot: "DIAGNOSTIC", suite: "en *commentaire.*" },
  { type: "promesse", invite: "On vous envoie", cadeau: "*toute la structure*", ligne: "de cette automatisation, à mettre en place chez vous" },
  { type: "lien", etiquette: "Ou", titre: "Réservez votre *diagnostic gratuit*", lien: "Lien en premier commentaire", signature: "Axion-*IA*" },
  { type: "chiffre", nombre: 0, unite: "minutes", pastilles: [], compteur: true },
].map((c, i) => ({ id: `e${String(i + 1).padStart(2, "0")}`, fond: "sombre", debutMs: 0, finMs: 3000, evenements: [], ...c }) as EcranCale);
const CAPTURES = { form: { src: "captures/form.png", cle: "form", sorte: "image" as const, largeur: 1080, hauteur: 1920 } };


const props = dessinAuDessusDesSousTitres(proprietesEcrans({ ecrans: CONTENUS, captures: CAPTURES, zoneProtegee: QUATRE, bandeSousTitres: BANDE }));
const bande = zonesEcran(QUATRE, 1080, 1920, BANDE).sousTitres;

describe("objets au-dessus des sous-titres", () => {
  it.each(props.map((p) => [p.id, p.type, p] as const))("%s (%s) : aucun objet, ni fil, ne touche la bande des sous-titres", (_id, _type, p) => {
    const { boites } = disposer(p);
    for (const o of boites.objets) expect(o.boite.y + o.boite.hauteur, `${p.type} · ${o.nom}`).toBeLessThanOrEqual(bande.y + 0.5);
    if (boites.fil) expect(boites.fil.y + boites.fil.hauteur).toBeLessThanOrEqual(bande.y + 0.5);
    for (const o of boites.objets) expect(boiteDans(o.boite, p.dessin ?? p.zone), `${p.type} · ${o.nom}`).toBe(true);
  });

  it("le contrôle des propriétés ne signale rien sur les 14 types", () => {
    for (const p of props) expect(controlerProprietes(p), p.type).toEqual([]);
  });

  it("la fonction ne touche ni la largeur, ni le haut de la zone de dessin, ni un écran sans zone de dessin", () => {
    const brut = proprietesEcrans({ ecrans: CONTENUS, captures: CAPTURES, zoneProtegee: QUATRE, bandeSousTitres: BANDE });
    brut.forEach((b, i) => {
      expect(props[i].dessin!.x).toBe(b.dessin!.x);
      expect(props[i].dessin!.largeur).toBe(b.dessin!.largeur);
      expect(props[i].dessin!.y).toBe(b.dessin!.y);
      expect(props[i].dessin!.y + props[i].dessin!.hauteur).toBeLessThanOrEqual(b.dessin!.y + b.dessin!.hauteur);
    });
    const sans = { ...brut[0], dessin: undefined };
    expect(dessinAuDessusDesSousTitres([sans])[0]).toBe(sans);
  });
});

/**
 * V4-2 (mission D) : la chaîne pose désormais ses écrans dans la zone PLEINE IMAGE (décision de Will, comme la v4).
 * La règle « objets au-dessus des sous-titres » tient toujours (c'est aussi l'ordre de la v4 : objets jusqu'à 82 %,
 * sous-titres à 83 %). Seul change le fil des étapes : il passe SOUS les sous-titres, à 92 % de la hauteur, comme le fil
 * de la v4 (`#fil`, 150 px du bas) ; ce n'est pas un objet et il ne porte aucun texte.
 */
describe("objets au-dessus des sous-titres, zone pleine image (V4-2)", () => {
  const pleines = proprietesPleineImage({ ecrans: CONTENUS, captures: CAPTURES });
  const bandePleine = zonesEcran(ZONE_PLEINE_IMAGE_CAS_CONCRET, 1080, 1920, BANDE_SOUS_TITRES_CAS_CONCRET).sousTitres;

  it.each(pleines.map((p) => [p.id, p.type, p] as const))("%s (%s) : aucun objet ne touche la bande ; le fil passe dessous", (_id, _type, p) => {
    const { boites } = disposer(p);
    for (const o of boites.objets) expect(o.boite.y + o.boite.hauteur, `${p.type} · ${o.nom}`).toBeLessThanOrEqual(bandePleine.y + 0.5);
    if (boites.fil) expect(boites.fil.y, "fil sous les sous-titres").toBeGreaterThanOrEqual(bandePleine.y + bandePleine.hauteur);
  });

  it("le contrôle des propriétés ne signale rien sur les 14 types", () => {
    for (const p of pleines) expect(controlerProprietes(p), p.type).toEqual([]);
  });
});
