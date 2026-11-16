/** Mot de déclenchement accompagné de politesse (« GUIDE merci ») : liste blanche stricte. Données fictives, aucun réseau. */
import { describe, expect, it } from "vitest";
import { lireEnveloppe, lireEvenementCommentaire, motSeulDe } from "@/domaine/guide-reseau/crochet-zernio";
import { lireCommentaireManuel } from "@/domaine/guide-reseau/commentaire-manuel";
import { motAvecPolitesse, normaliserMot } from "@/domaine/guide-reseau/mot-normalise";
import { classerOpposition, estMotOpposition } from "@/domaine/guide-reseau/opposition";

const REG = ["GUIDE", "ESSAIGPT7"];
const corps = (text: string, extra: Record<string, unknown> = {}, plateforme = "facebook") =>
  lireEnveloppe(JSON.stringify({ id: "e1", event: "comment.received", timestamp: 1_800_000_000, account: { accountId: "cpt", platform: plateforme }, comment: { id: "c1", text, author: { id: "a1" }, ...extra } }))!;

describe("acceptés → forme canonique", () => {
  it.each(["GUIDE merci", "guide svp", "merci GUIDE", "GUIDE s'il vous plaît", "GUIDE s'il vous plait", "GUIDE sil vous plait", "bonjour guide", "#guide", "GUIDE please", "Guidé 🙏", "GUIDE🙏merci", "@ami GUIDE", "GUIDE GUIDE", "GUIDE", "Guide, merci beaucoup !"])("« %s » → GUIDE", (t) => {
    expect(motSeulDe(t, REG)).toBe("GUIDE");
  });
  it("mot d'un registre étendu", () => expect(motSeulDe("ESSAIGPT7 merci", REG)).toBe("ESSAIGPT7"));
  it("le commentaire lu porte la forme canonique, pas le texte brut", () => {
    expect(lireEvenementCommentaire(corps("GUIDE merci"))!.motSeul).toBe("GUIDE");
    expect(lireEvenementCommentaire(corps("ESSAIGPT7 merci"), REG)!.motSeul).toBe("ESSAIGPT7");
    expect(lireCommentaireManuel(corps("guide merci", { author: { id: "a1" } }, "linkedin"))!.motSeul).toBe("GUIDE");
  });
});

describe("refusés → null", () => {
  it.each([
    "GUIDEZ-moi", "je te guide", "je vous guide", "il guide", "I guide you", "le.guide", "s.guide", "le/guide", "guide@exemple.test", "pas de GUIDE", "GUIDE stop",
    "le guide", "pour le guide", "je veux le guide", "je veux le guide merci beaucoup", "oui guide", "GUIDE il", "GUIDE vous", "GUIDE s", "vous guide", "GUIDE s il", "GUIDE.merci", "GUIDES", "MONGUIDE", "G.U.I.D.E", "GUIDE ESSAIGPT7", "pas besoin du guide", "le guide est nul", "ne m'envoyez pas le guide",
    "GUIDE merci merci merci merci merci merci merci merci", "GUІDE", "Ｇ Ｕ Ｉ Ｄ Ｅ", "merci", "", "GUIDE " + "merci ".repeat(40),
  ])("%j → null", (t) => expect(motSeulDe(t, REG)).toBeNull());
  it("plus de 200 caractères", () => expect(motSeulDe("GUIDE" + " ".repeat(200) + "merci", REG)).toBeNull());
  it("« GUIDE ESSAIGPT7 » refusé même avec un registre à un seul mot ? non : le second est inconnu", () => expect(motSeulDe("GUIDE ESSAIGPT7", ["GUIDE"])).toBeNull());
});

describe("opposition et réponses", () => {
  it("« GUIDE stop » → doute, rien n'est gardé", () => {
    expect(classerOpposition("GUIDE stop")).toBe("doute");
    expect(motSeulDe("GUIDE stop", REG)).toBeNull();
  });
  it("« stop merci » → STOP", () => expect(motSeulDe("stop merci", REG)).toBe("STOP"));
  it("une réponse (estReponse) « GUIDE merci » reste marquée réponse (ignorée en aval)", () => {
    expect(lireEvenementCommentaire(corps("GUIDE merci", { isReply: true }))!.estReponse).toBe(true);
  });
  it("notre propre réponse publique contenant GUIDE donne null", () => {
    const e = lireEvenementCommentaire(corps("Voici le GUIDE, merci", { author: { id: "a1", isOwnAccount: true } }))!;
    expect(e.motSeul).toBeNull();
    expect(e.proprio).toBe(true);
  });
  it("la forme canonique reste lisible par normaliserMot (statistiques)", () => expect(normaliserMot(motSeulDe("GUIDE merci", REG))).toBe("GUIDE"));
});

describe("ponctuation AVANT le mot : refus prudent (décision écrite)", () => {
  // Avant #708 ces formes donnaient GUIDE ; refusées depuis, choix prudent retenu (une mention ou une commande n'est pas une demande).
  it.each(["@GUIDE", "@guide merci", "...GUIDE", "…GUIDE", "/guide", "./guide", "\\guide"])("%j → null", (t) => expect(motSeulDe(t, REG)).toBeNull());
  it("appel direct : « stop please » n'est pas un déclencheur", () => expect(motAvecPolitesse("stop please", REG)).toBeNull());
  // Garde `classerOpposition(texte) !== "non"` : « stop please » est classé « opposition », donc l'appel ci-dessus ne distingue pas `!== "non"` de `=== "doute"`
  // (le registre REG ne contient pas STOP : le mot est de toute façon refusé plus loin). Ici le mot d'opposition EST dans le registre :
  // seule la garde `!== "non"` renvoie null ; la mutation `=== "doute"` laisserait passer « OPPOSE ».
  it("appel direct : une opposition dont le mot est au registre → null (garde !== \"non\")", () => {
    expect(classerOpposition("oppose")).toBe("opposition");
    expect(motAvecPolitesse("oppose", ["OPPOSE"])).toBeNull();
  });
});

describe("asymétrie figée : ponctuation APRÈS le mot acceptée", () => {
  it.each(["GUIDE...", "GUIDE…", "GUIDE."])("« %s » → GUIDE", (t) => expect(motSeulDe(t, REG)).toBe("GUIDE"));
});

describe("contrepartie sécurité : un arrêt n'est jamais refusé pour sa ponctuation", () => {
  it.each(["@STOP", "/stop", "...stop"])("« %s » → opposition / STOP", (t) => {
    expect(estMotOpposition(t)).toBe(true);
    expect(motSeulDe(t, REG)).toBe("STOP");
  });
});
