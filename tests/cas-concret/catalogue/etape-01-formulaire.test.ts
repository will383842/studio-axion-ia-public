/** FIX-CC-ETAPE-01-FORMULAIRE : l'étape « Le formulaire » du cas contact-vers-crm montre le haut de la page en grand (page-entiere), pas la page réduite (image). */
import { describe, expect, it } from "vitest";
import { verifierCas } from "../../../src/formats/cas-concret/cas";
import { CATALOGUE, trouverCas } from "../../../src/formats/cas-concret/catalogue";
import { planCaptures } from "../../../src/moteurs/montage-cas-concret/captures";

/** Copie figée des quatre autres étapes, lue sur master avant le changement (17/11). */
const AUTRES_ETAPES_FIGEES = [
  { titre: "L'enregistrement", ligne: "La demande est enregistrée, protégée.", detail: "Anti-robot, limite de fréquence, données personnelles chiffrées.", visuel: { sorte: "objet", objet: "bouclier-coche" } },
  { titre: "La boîte d'envoi", ligne: "Une ligne est posée dans une boîte d'envoi.", detail: "Interne, en attente de transmission.", visuel: { sorte: "objet", objet: "dossier-classe" } },
  { titre: "Le CRM", ligne: "Elle est transmise au CRM en quelques secondes.", detail: "La fiche se crée sans ressaisie.", visuel: { sorte: "objet", objet: "outils-relies" } },
  { titre: "Le balayage", ligne: "Un balayage reprend ce qui n'est pas passé.", detail: "Toutes les 10 minutes, en cas de panne ou de CRM injoignable.", visuel: { sorte: "objet", objet: "chrono" } },
];
/** [cas, mouvement] des écrans réels des sept autres cas de master, lus avant le changement. */
const ECRANS_AUTRES_FIGES = [["recrutement-apporteurs", "frappe"], ["recrutement-apporteurs", "image"], ["rappels-rendez-vous", "image"], ["email-difficile", "image"], ["compte-rendu-dicte", "image"], ["audit-une-journee", "image"], ["articles-blog", "defilement"]];
const IDS_AUTRES = ["recrutement-apporteurs", "rappels-rendez-vous", "email-difficile", "compte-rendu-dicte", "audit-une-journee", "devis-signe-alerte", "articles-blog"];

describe("étape 01 du cas contact-vers-crm", () => {
  const cas = trouverCas("contact-vers-crm")!;

  it("a : « Le formulaire » passe en page-entiere, adresse et repli inchangés ; les quatre autres étapes sont identiques", () => {
    expect(cas.etapes).toHaveLength(5);
    expect(cas.etapes[0]).toMatchObject({
      titre: "Le formulaire",
      ligne: "Un visiteur envoie un formulaire.",
      detail: "Contact, audit, devis ou lettre d'information.",
      visuel: { sorte: "ecran", adresse: "https://axion-ia.com/fr/contact", mouvement: "page-entiere", repli: "e-mail" },
    });
    expect(cas.etapes.slice(1)).toEqual(AUTRES_ETAPES_FIGEES);
  });

  it("b : le cas passe le schéma", () => {
    expect(verifierCas(cas)).toEqual({ ok: true, cas });
  });

  it("c : planCaptures rend page-entiere / defilement pour cet écran", () => {
    const fiche = { ecrans: [{ id: "e01", type: "etape", visuel: { sorte: "ecran", etapeCas: 1 } }] };
    const [demande] = planCaptures(fiche as never, cas);
    expect(demande?.page).toBe("https://axion-ia.com/fr/contact");
    expect(demande?.parametres).toMatchObject({ type: "page-entiere", mouvement: "defilement" });
  });

  it("d : pour les sept autres cas de master, le mouvement de chaque écran est inchangé", () => {
    const ecrans = IDS_AUTRES.flatMap((id) => CATALOGUE.find((x) => x.id === id)!.etapes.flatMap((e) => (e.visuel.sorte === "ecran" ? [[id, e.visuel.mouvement]] : [])));
    expect(ecrans).toEqual(ECRANS_AUTRES_FIGES);
  });
});

