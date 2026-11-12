/**
 * L3-04 : portée « post » de la liste unique des interdits (texte, légende, premier commentaire).
 * Les mots interdits ne sont jamais écrits en clair : ils sont assemblés. Aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { INTERDITS_POST, interditsDuPost, interditsPost, LISTE_INTERDITS, ZONES_POST } from "@/domaine/qualite-script/regles/interdits";
import { motsInterditsEnvoiZernio } from "@/fournisseurs/publication/mots-interdits-envoi";

const J = (...p: string[]) => p.join("");
const PARTICIPE = J("cert", "ifié");
const LABEL = J("Quali", "opi");
const VILLE = J("Gre", "noble");

const DETECTES = [
  PARTICIPE,
  J("cert", "ifiée"),
  J("CERT", "IFIÉ"),
  J("cert", "ifie"),
  J("cert", "ification"),
  LABEL,
  J("#Formation", "Cert", "ifie"), // collé (mot-dièse)
  J("re", "cert", "ifie"), // préfixe collé
  J("Quali", "Opi"), // camelCase
  J("cert", "​", "ifié"), // invisible
  J("cert", "­", "ifié"),
  J("cert", "⁢", "ifié"),
  J("certi", "ﬁé"), // ligature
  J("cert", " ", "ifié"), // insécable au milieu
  VILLE,
  J("Aucun gain ", "garanti"),
  J("Aucun   gain\n", "garanti"),
  // L3-04 (relecture) : « tous les écrivains » aussi détecté avec invisible, trait d'union conditionnel ou mot collé.
  J("labellisé Cert", "if", "​", "exemple"),
  J("labellisé Cert", "if", "­", "exemple"),
  J("#Labellisé", "Cert", "ifexemple"),
  J("labellisé Cert", "ifexemple"),
];
const AUTORISES = ["certificat", "Un certificat de présence", "des certificats", "le certificateur", "certitude", "incertitude", "certes", "un certain jour", "Trois gestes simples."];

describe("portée « post »", () => {
  it("la liste unique expose la portée « post » et ses zones", () => {
    expect(ZONES_POST).toEqual(["texte", "legende", "premier-commentaire"]);
    expect(INTERDITS_POST.length).toBeGreaterThan(0);
    expect(INTERDITS_POST.every((i) => i.portee === "post")).toBe(true);
  });
  it.each(DETECTES)("%j : détecté", (mot) => {
    expect(interditsPost(`Texte ${mot} fin`).length).toBeGreaterThan(0);
    expect(interditsPost(mot).length).toBeGreaterThan(0);
  });
  it.each(AUTORISES)("%j : autorisé", (t) => {
    expect(interditsPost(t)).toEqual([]);
  });
  it("« certificat » reste autorisé dans chaque zone", () => {
    expect(interditsDuPost({ texte: "certificat", legende: "certificat", premierCommentaire: "certificat" })).toEqual([]);
  });
  it("même verdict que le filtre d'envoi (liste partagée), jamais plus permissif", () => {
    for (const m of [...DETECTES, ...AUTORISES]) {
      const envoi = motsInterditsEnvoiZernio(m).length > 0;
      if (envoi) expect(interditsPost(m).length).toBeGreaterThan(0);
    }
  });
  it("reprend aussi les interdits de tous les écrivains (certification revendiquée)", () => {
    expect(interditsPost("Nous sommes certifiés Certifexemple").length).toBeGreaterThan(0);
  });
  it("la portée « post » est portée par la liste unique, avec les mêmes libellés", () => {
    expect(INTERDITS_POST.every((i) => LISTE_INTERDITS.some((l) => l.libelle === i.libelle))).toBe(true);
    expect(INTERDITS_POST.length).toBeGreaterThan(0);
  });
  it("chaque entrée de la liste unique marquée « post » est lue (Ville exemple, gain garanti, certification revendiquée)", () => {
    expect(interditsPost("x Villeexemple y").length).toBeGreaterThan(0);
    const communs = LISTE_INTERDITS.filter((e) => e.portee.length === 4);
    expect(communs.length).toBeGreaterThan(0);
    expect(communs.every((e) => typeof e.post === "function")).toBe(true);
  });
  it("sans doublon de libellé", () => {
    const l = interditsPost(`${PARTICIPE} ${PARTICIPE} ${LABEL}`);
    expect(new Set(l).size).toBe(l.length);
  });
});

describe("zones du post : texte, légende, premier commentaire (N-28)", () => {
  it("indique la zone de chaque interdit trouvé", () => {
    const r = interditsDuPost({ texte: "Bonjour", legende: `Une ${PARTICIPE} formation`, premierCommentaire: `Voir ${LABEL}` });
    expect(r.map((x) => x.zone)).toEqual(["legende", "premier-commentaire"]);
    expect(r.every((x) => x.libelle.length > 0)).toBe(true);
  });
  it("le texte seul est contrôlé ; légende et commentaire absents ne gênent pas", () => {
    expect(interditsDuPost({ texte: `${PARTICIPE}` }).map((x) => x.zone)).toEqual(["texte"]);
    expect(interditsDuPost({ texte: "Bonjour", legende: null, premierCommentaire: undefined })).toEqual([]);
  });
  it("une légende propre et un commentaire propre : rien", () => {
    expect(interditsDuPost({ texte: "Bonjour", legende: "Trois gestes simples.", premierCommentaire: "Dites-moi en commentaire." })).toEqual([]);
  });
  it("un interdit collé ou invisible dans le premier commentaire est trouvé", () => {
    expect(interditsDuPost({ texte: "ok", premierCommentaire: J("#Cert", "ifie", "​", "Nom") }).map((x) => x.zone)).toEqual(["premier-commentaire"]);
  });
});
