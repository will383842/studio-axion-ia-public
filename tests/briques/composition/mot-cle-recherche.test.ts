import { describe, expect, it } from "vitest";
import {
  FENETRE_MOT_CLE_MS,
  MOT_CLE_RECHERCHE_ACTIF,
  motCleDeRecherche,
} from "../../../src/briques/composition/mot-cle-recherche";
import type { MotFait } from "../../../src/briques/faits-script/types";
import { motsHorodates } from "../faits-script/dix-scripts";

const mots = (s: string, pas = 300) => motsHorodates(s, pas);

describe("mot-clé de recherche à l'écran (X1-13)", () => {
  it("est éteint par défaut, fenêtre de 3 s", () => {
    expect(MOT_CLE_RECHERCHE_ACTIF).toBe(false);
    expect(FENETRE_MOT_CLE_MS).toBe(3000);
  });

  it("renvoie un mot dit, horodaté dans les 3 premières secondes, le plus proche du sujet", () => {
    const m = mots("Aujourd'hui je vous montre comment régler votre assistant pour trier vos mails.");
    const r = motCleDeRecherche(m, "assistant mails automatiques");
    expect(r.type).toBe("mot");
    if (r.type !== "mot") return;
    const dit = m.find((x) => x.texte.replace(/[.,;:!?]/g, "") === r.texte);
    expect(dit).toBeDefined();
    expect(dit!.debutMs).toBeLessThanOrEqual(3000);
    expect(r.texte).toBe("assistant");
    expect(r.debutMs).toBe(dit!.debutMs);
  });

  it("ignore un mot proche du sujet dit après 3 s", () => {
    const m = mots("Bonjour à tous et bienvenue sur cette vidéo, aujourd'hui parlons de comptabilité.", 400);
    expect(motCleDeRecherche(m, "comptabilité").type).toBe("rien");
  });

  it("refuse les mots interdits (argent, mots outils, négations)", () => {
    expect(motCleDeRecherche(mots("prix tarif euro gratuit jamais pour avec"), "prix tarif euro gratuit jamais").type).toBe("rien");
    expect(motCleDeRecherche(mots("Le prix du logiciel"), "prix").type).toBe("rien");
  });

  it("refuse les mots interdits à l'envoi, ceux du format et ceux de Will", () => {
    expect(motCleDeRecherche(mots("Qualiopi : trois étapes", 300), "Qualiopi").type).toBe("rien");
    expect(motCleDeRecherche(mots("Certifié : trois étapes", 300), "Certifié").type).toBe("rien");
    expect(motCleDeRecherche(mots("Vos machines tournent", 300), "machines").type).toBe("rien");
    expect(motCleDeRecherche(mots("Votre assistant trie", 300), "assistant").type).toBe("mot");
    expect(motCleDeRecherche(mots("Votre assistant trie", 300), "assistant", ["assistant"]).type).toBe("rien");
  });

  it("ne refuse pas à tort les mots qui contiennent « cout » ou « euro »", () => {
    expect(motCleDeRecherche(mots("Écoutez bien ce conseil sur l'Europe", 300), "europe écoute").type).toBe("mot");
    expect(motCleDeRecherche(mots("Écoutez bien", 300), "écoutez").type).toBe("mot");
    expect(motCleDeRecherche(mots("Vos neurones", 300), "neurones").type).toBe("mot");
    expect(motCleDeRecherche(mots("Le coût du logiciel", 300), "coût").type).toBe("rien");
    expect(motCleDeRecherche(mots("100 € offerts", 300), "offerts").type).toBe("mot");
    expect(motCleDeRecherche(mots("€uros", 300), "€uros").type).toBe("rien");
  });

  it("refuse les nombres", () => {
    expect(motCleDeRecherche(mots("2026 30 % 12"), "2026").type).toBe("rien");
  });

  it("renvoie rien si aucun mot, ou sujet vide, ou aucun mot proche", () => {
    expect(motCleDeRecherche([], "assistant").type).toBe("rien");
    expect(motCleDeRecherche(mots("Bonjour assistant"), "").type).toBe("rien");
    expect(motCleDeRecherche(mots("Bonjour voisin"), "comptabilité").type).toBe("rien");
  });

  it("ne plante pas sur une entrée invalide", () => {
    expect(motCleDeRecherche(undefined as unknown as MotFait[], "x").type).toBe("rien");
  });

  it("même entrée = même mot, sans modifier l'entrée", () => {
    const m = mots("Votre assistant trie vos mails et classe vos factures.");
    const copie = JSON.stringify(m);
    const a = motCleDeRecherche(m, "assistant mails factures");
    const b = motCleDeRecherche(m, "assistant mails factures");
    expect(a).toEqual(b);
    expect(JSON.stringify(m)).toBe(copie);
  });

  it("à égalité, garde le mot dit le plus tôt", () => {
    const r = motCleDeRecherche(mots("mails factures"), "factures mails");
    expect(r.type === "mot" && r.texte).toBe("mails");
  });
});
