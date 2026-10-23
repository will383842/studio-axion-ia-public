/**
 * SCRIPT PERSO, SUITE de #481 (décision de Will du 18/10) : le texte que Will fournit lui-même est pris à l'identique.
 *  1. « Améliorer » un bloc collé : la machine récrit le texte, le bloc n'est plus « à Will » (il perd `colle-`) et est contrôlé ;
 *  2. un bloc ajouté à la main dans un script collé est du texte de Will (`colle-`) ;
 *  3. aucun avis tu/vous sur un texte collé ;
 *  4. tableau animé, « J'ai déjà mon texte » : seules les limites techniques (durée maximale) bloquent, jamais un mot interdit.
 * Les textes du générateur gardent TOUS leurs contrôles. Aucun appel réel.
 */
import { describe, expect, it } from "vitest";
import { fournisseurScriptSimulation, decouperTexte } from "@/fournisseurs/simulation/script";
import { estBlocColle, idBlocAjoute, estScriptColle } from "@/domaine/relecture-script";
import { contexteDesLignes, origineApresChoixWill, texteClaudeDuBrouillon, texteDeWillAccepte, lignesDeDepart, lignesDuTexteTableau, pastillesTexteTableau } from "@/domaine/relecture-tableau";
import { texteDitDe } from "@/domaine/scripts-tableau-controles";
import { exempleV4 } from "./tableau-scripts/exemples-v4";
import { CARACTERES_DITS_MAX_TABLEAU } from "@/domaine/duree-tableau";
import { obtenirFormat } from "@/formats";
import type { BlocScript } from "@/domaine/types";

const recette = obtenirFormat("avocat").recetteScript;
const bloc = (id: string, recetteId: string, ...textes: string[]): BlocScript => ({ id, blocRecette: recetteId, segments: textes.map((t, i) => ({ id: `${id}-${i}`, texte: t })) });

describe("1. un bloc collé récrit par la machine n'est plus du texte de Will", () => {
  it.each(["plus-court", "plus-percutant"] as const)("« %s » : l'id perd `colle-`", async (consigne) => {
    const [colle] = decouperTexte("Voici ce que dit la loi. Vraiment, ton patron ne peut pas.", recette);
    expect(estBlocColle(colle.id)).toBe(true);
    const nouveau = await fournisseurScriptSimulation.ameliorerBloc(colle, consigne, recette, "tu");
    expect(estBlocColle(nouveau.id)).toBe(false);
    expect(nouveau.id).toBe(colle.id.replace(/^colle-/, ""));
  });
  it("un bloc du générateur garde son id", async () => {
    const b = bloc("abc", "explication", "Un.", "Deux.");
    expect((await fournisseurScriptSimulation.ameliorerBloc(b, "plus-court", recette, "vous")).id).toBe("abc");
  });
});

describe("2. bloc ajouté à la main", () => {
  it("script collé (tous `colle-`) : le nouvel id est `colle-`", () => {
    const colles = decouperTexte("Une phrase. Une autre.", recette);
    expect(estBlocColle(idBlocAjoute(colles, "bloc-1"))).toBe(true);
  });
  it("script du générateur, mixte ou vide : le nouvel id reste neutre", () => {
    const colles = decouperTexte("Une phrase.", recette);
    expect(idBlocAjoute([bloc("g", "explication", "x")], "bloc-1")).toBe("bloc-1");
    expect(idBlocAjoute([...colles, bloc("g", "explication", "x")], "bloc-1")).toBe("bloc-1");
    expect(idBlocAjoute([], "bloc-1")).toBe("bloc-1");
  });
});

describe("3. avis tu/vous", () => {
  it("texte collé : aucun avis ; générateur ou mixte : avis conservé", () => {
    expect(estScriptColle(decouperTexte("Tu dois lire. Vous devez lire.", recette))).toBe(true);
    expect(estScriptColle([bloc("g", "explication", "x")])).toBe(false);
    expect(estScriptColle([...decouperTexte("Un.", recette), bloc("g", "explication", "x")])).toBe(false);
    expect(estScriptColle([])).toBe(false);
  });
});

describe("4. tableau animé : texte fourni par Will", () => {
  const interdit = "Contactez-nous dès demain pour un devis gratuit.";
  it("texte libre : un mot interdit ne bloque pas, aucun avis", () => {
    expect(pastillesTexteTableau(lignesDuTexteTableau(interdit))).toEqual([]);
  });
  it("texte libre : le plafond de durée bloque toujours", () => {
    const long = "Voici une phrase assez longue pour remplir le tableau. ".repeat(Math.ceil(CARACTERES_DITS_MAX_TABLEAU / 55) + 2);
    expect(pastillesTexteTableau(lignesDuTexteTableau(long)).map((p) => [p.niveau, p.code])).toEqual([["bloquant", "duree-plafond"]]);
  });

  it("non-régression : un script de Claude retouché (lignes `t…`) garde ses contrôles, mots interdits bloquants compris", () => {
    const { ecriture, demande } = exempleV4("01-formation");
    const retouche = `${texteDitDe(ecriture.script)} Contactez-nous dès demain.`;
    const lignes = lignesDeDepart(retouche, ecriture.script);
    expect(lignes[0].id).toBe("t0");
    const contexte = contexteDesLignes({ ecriture, demande }, lignes);
    // Marqué « retouché » : absent de master, où un texte de Claude retouché perdait son contexte (donc tous ses contrôles).
    expect(contexte?.retouche).toBe(true);
    const p = pastillesTexteTableau(lignes, contexte);
    expect(p.some((x) => x.niveau === "bloquant" && x.code === "mot-interdit")).toBe(true);
  });
  it("sans brouillon généré, le même texte reste pris à l'identique", () => {
    const lignes = lignesDuTexteTableau("Contactez-nous dès demain.");
    expect(contexteDesLignes(null, lignes)).toBeNull();
    expect(pastillesTexteTableau(lignes, null)).toEqual([]);
  });
});

describe("origine du texte au clic sur « J'ai déjà mon texte » (le texte de Claude ne devient pas celui de Will)", () => {
  const claude = "Voici le texte de Claude. Il est sur l'écran.";
  it("le texte affiché est encore celui de Claude (même à l'espacement près) : l'origine reste « generateur »", () => {
    expect(origineApresChoixWill(claude, claude)).toBe("generateur");
    expect(origineApresChoixWill(claude, `  ${claude.replace(" Il", "\n Il")} `)).toBe("generateur");
  });
  it("texte de Claude retouché d'un mot : toujours « generateur » (il garde ses contrôles)", () => {
    expect(origineApresChoixWill(claude, claude.replace("Voici", "Voilà"))).toBe("generateur");
    expect(origineApresChoixWill(claude, "Mon propre texte.")).toBe("generateur");
  });
  it("champ vide, ou aucun texte de Claude dans ce brouillon : « will »", () => {
    expect(origineApresChoixWill(claude, "")).toBe("will");
    expect(origineApresChoixWill(claude, "   ")).toBe("will");
    expect(origineApresChoixWill(null, claude)).toBe("will");
    expect(origineApresChoixWill(null, "")).toBe("will");
  });
});

describe("rechargement : le texte de Claude se retrouve dans le brouillon (l'état de l'écran repart à null)", () => {
  const { ecriture, demande } = exempleV4("01-formation");
  const generation = { demande, issue: { ok: false as const, meilleure: { ecriture } } };
  const dit = texteDitDe(ecriture.script);
  it("écriture + texte de Claude rangé, sans origine ni fiche : c'est le texte de Claude → « generateur »", () => {
    const rangé = texteClaudeDuBrouillon({ generation, donnees: { texte: "Le texte de Claude rangé." } });
    expect(rangé).toBe("Le texte de Claude rangé.");
    expect(origineApresChoixWill(rangé, "Le texte de Claude rangé.")).toBe("generateur");
  });
  it("écriture sans texte rangé : le texte dit de l'écriture de Claude", () => {
    expect(texteClaudeDuBrouillon({ generation, donnees: { texte: "" } })).toBe(dit);
  });
  it("origine « will » déjà rangée, ou aucune écriture : rien à protéger (null)", () => {
    expect(texteClaudeDuBrouillon({ generation, donnees: { texte: "Mon texte.", origine: "will" } })).toBeNull();
    expect(texteClaudeDuBrouillon({ generation: null, donnees: { texte: "Mon texte." } })).toBeNull();
    expect(texteClaudeDuBrouillon(null)).toBeNull();
  });
  it("garde-fou serveur : « will » ignoré si le texte égale le texte dit de Claude ou le texte rangé sans origine « will »", () => {
    expect(texteDeWillAccepte(`  ${dit} `, { generation, donnees: { texte: "" } })).toBe(false);
    expect(texteDeWillAccepte("Le texte rangé.", { generation, donnees: { texte: "Le  texte rangé." } })).toBe(false);
    expect(texteDeWillAccepte("Le texte rangé.", { generation, donnees: { texte: "Le texte rangé.", origine: "will" } })).toBe(true);
    expect(texteDeWillAccepte("Un texte bien à Will.", { generation, donnees: { texte: "Le texte rangé." } })).toBe(true);
    expect(texteDeWillAccepte(dit, { generation: null, donnees: { texte: dit } })).toBe(true);
    expect(texteDeWillAccepte(dit, null)).toBe(true);
  });
});
