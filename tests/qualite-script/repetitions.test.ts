import { describe, expect, it } from "vitest";
import { evaluerQualite } from "@/domaine/qualite-script";
import { alertesRepetitions, garderSansNouvelleRepetition, trouverRepetitions } from "@/domaine/qualite-script/repetitions";
import { BON, RECETTE_ESSAI, script } from "./aide";

const genres = (t: string[], appel?: string) => trouverRepetitions(t, appel).map((r) => r.genre);

describe("RP-01 · répétitions dans un script (observation)", () => {
  it("détecte une phrase dite deux fois mot pour mot (banc 17/10)", () => {
    const p = "Chaque version est recopiée à la main depuis les mêmes fichiers. Donc un chiffre corrigé dans l'une ne l'est pas dans les autres.";
    expect(genres(["Une PME envoie quatre versions de son offre.", p, "Voici ce qui change chez elle.", p])).toContain("identique");
  });

  it("détecte la phrase redite après « Mais non. »", () => {
    const p = "Nous mettons en place pour votre équipe la lecture automatique des commandes : elles arrivent dans le logiciel, une personne vérifie et valide.";
    expect(genres([p, "Vous croyez que c'est compliqué ?", "Mais non.", p])).toContain("identique");
  });

  it("détecte « Une personne contrôle et valide. » juste après la même idée", () => {
    const g = genres(["Les commandes arrivent dans le logiciel, une personne vérifie et valide.", "Une personne contrôle et valide."]);
    expect(g).toContain("proche");
  });

  it("détecte « Ils ont arrêté de ressaisir leurs factures » deux fois dans le paragraphe", () => {
    const g = genres(["Ils ont arrêté de ressaisir leurs factures. Le service compta respire. Ils ont arrêté de ressaisir leurs factures !"]);
    expect(g).toContain("identique");
  });

  it("détecte « Chez cette PME de négoce, c'est fait » redit", () => {
    const g = genres(["Chez cette PME de négoce, la lecture des factures est automatique.", "Chez cette PME de négoce, la lecture des factures se fait seule."]);
    expect(g).toContain("proche");
  });

  it("signale la même idée sous 3 phrases, mais tolère 2 retours", () => {
    const trois = ["Nous relisons chaque devis client avant envoi.", "Ensuite nous relisons chaque devis client le lendemain.", "Et nous relisons chaque devis client le soir."];
    expect(genres(trois)).toContain("idee");
    expect(genres(trois.slice(0, 2))).not.toContain("idee");
  });

  it("n'impose aucune limite aux mots fonctionnels", () => {
    const t = ["Nous avons trois clients à Lyon.", "Nous avons quatre salariés à Nantes.", "Nous avons cinq machines neuves.", "Nous avons six camions."];
    expect(genres(t)).toEqual([]);
  });

  it("refuse le remplissage seul au-delà de 20 %, le tolère en dessous", () => {
    const long = "Votre assistante recopie les mêmes lignes à la main.";
    expect(genres([long, "Mais non.", "C'est tout."])).toContain("remplissage");
    expect(genres([long, long.replace("assistante", "comptable"), "Votre équipe garde la relation avec chaque client important du mois.", "Mais non."])).not.toContain("remplissage");
  });

  it("un texte varié sans répétition ne signale rien", () => {
    expect(trouverRepetitions(BON.filter(([p]) => p !== "appel").map(([, t]) => t))).toEqual([]);
    const rapport = evaluerQualite(script(BON), RECETTE_ESSAI);
    expect(rapport.resultats.find((r) => r.code === "RP-01")?.statut).toBe("ok");
  });

  it("l'appel final n'est jamais compté comme répétition d'une phrase du corps", () => {
    const appel = "Écrivez DEVIS en commentaire pour recevoir la méthode.";
    expect(genres(["Le devis part seul.", appel], appel)).toEqual([]);
    const rapport = evaluerQualite(script([...BON.filter(([p]) => p !== "appel"), ["appel", appel], ["corps", "Merci."]]), RECETTE_ESSAI);
    expect(rapport.resultats.find((r) => r.code === "RP-01")?.statut).toBe("ok");
    expect(genres([appel, "Autre phrase bien différente ici."], appel)).toEqual([]);
  });

  it("le socle signale la répétition en observation (info, rien ne bloque)", () => {
    const r = evaluerQualite(script([...BON, ["corps", "Le prix reste une décision humaine."]]), RECETTE_ESSAI);
    const rp = r.resultats.find((x) => x.code === "RP-01");
    expect(rp?.statut).toBe("ecart");
    expect(r.mode).toBe("observation");
    expect(r.pastilles.every((p) => p.niveau === "info")).toBe(true);
  });

  it("le relevé pour le relecteur porte la consigne", () => {
    const a = alertesRepetitions(["Une phrase unique ici. Une phrase unique ici."]);
    expect(a[0]).toContain("supprime la répétition, ne réécris pas le reste");
  });

  it("refuse une correction du relecteur qui ajoute une répétition, garde les autres", () => {
    const segs = [{ texte: "Le devis part tout seul depuis la fiche du client." }, { texte: "La relance part le lendemain sans personne." }, { texte: "Votre équipe garde la relation." }];
    const { gardees, refusees } = garderSansNouvelleRepetition("Ce devis vous coûte trois heures.", segs, [
      { segmentIndex: 1, texte: "Le devis part tout seul depuis la fiche du client." },
      { segmentIndex: 2, texte: "Votre équipe garde la main sur la relation." },
    ]);
    expect(gardees.map((g) => g.segmentIndex)).toEqual([2]);
    expect(refusees[0]).toContain("REPETITION");
  });

  it("garde une correction qui supprime la répétition", () => {
    const p = "Ils ont arrêté de ressaisir leurs factures.";
    const { gardees } = garderSansNouvelleRepetition("Accroche", [{ texte: p }, { texte: p }], [{ segmentIndex: 1, texte: "" }]);
    expect(gardees).toHaveLength(1);
  });
});

describe("quasi-répétition à deux ou trois mots près (calibrage du 18/10/2026)", () => {
  const corps = ["Vos devis partent trop tard.", "Le devis se prépare tout seul à partir de la demande du client.", "La relance part le lendemain, sans que personne y pense.", "Dans une PME du bâtiment, le délai d'envoi passe de trois jours à une demi-journée.", "Votre équipe retrouve du temps pour les chantiers."];
  it("voit une phrase reprise en fin de script avec 2 ou 3 mots changés (même loin de l'originale)", () => {
    expect(genres([...corps, "La relance part le surlendemain, sans que personne n'y pense."])).toContain("proche");
    expect(genres([...corps, "Dans une PME du bâtiment, le délai d'envoi passe de trois jours à quelques heures."])).toContain("proche");
    expect(genres([...corps, "Le devis se prépare tout seul à partir de la demande de votre client."])).toContain("proche");
  });
  it("ne signale pas deux phrases de même gabarit mais de fond différent, ni un refrain court", () => {
    expect(genres([...corps, "Votre assistante retrouve du temps pour les rendez-vous et les appels."])).toEqual([]);
    expect(genres(["Première étape : ouvrez le fichier du client et relisez-le.", "Deuxième étape : copiez la ligne du devis dans le tableau de suivi.", "Quinze minutes.", "Quinze minutes, pas plus."])).toEqual([]);
  });
});
