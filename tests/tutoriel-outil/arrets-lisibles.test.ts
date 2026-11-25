/**
 * PHRASE-2 · chaque arrêt du tutoriel dit sa cause et propose le bon bouton. Fonctions pures, aucun appel, 0 €.
 * L'état du premier test est celui du serveur lors de l'essai réel du pilote (vidéo v-ccf49e9fc34d, sans voix).
 */
import { describe, expect, it } from "vitest";
import { arretLisible, estEnPause, lienDeSuivi, PHRASE_EQUIPE_BLOQUEE, vueRoles, type TravailPourVue } from "@/moteurs/montage-tutoriel-outil/vue-roles";

const VIDEO = "v-ccf49e9fc34d";
const le = "2026-11-25T09:00:00.000Z";
const MESSAGE_MOTEUR = "Une étape de préparation n'a pas abouti : réessayez ou collez votre script.";
const REMARQUES = ["Écran 1, zone 1 : champ inconnu « titre »", "Écran 1, zone 2 : champ inconnu « sous-titre »", "Écran 2, zone 1 : champ inconnu « legende »", "Écran 2, zone 2 : champ inconnu « a »", "Écran 3, zone 1 : champ inconnu « b »", "Écran 3, zone 2 : champ inconnu « c »"];

const etape = (cle: string, statut: "en_cours" | "en_attente", progression = 0) => ({ cle, nom: cle, icone: "film", dependDe: [], statut, progression, sortieFichierIds: [] }) as never;

/** Le travail du pilote : script en cours à 50 %, maquettiste « à revoir », aucune pièce proposée. */
function etatPilote(over: { pieceCreee?: unknown; roles?: unknown[]; pause?: unknown } = {}): TravailPourVue {
  return {
    statut: "en_cours",
    etapes: [etape("script", "en_cours", 50), etape("voix", "en_attente"), etape("calage", "en_attente"), etape("montage", "en_attente")],
    parametres: {
      pause: over.pause ?? { code: "TO_EQUIPE_BLOQUEE", message: MESSAGE_MOTEUR },
      tutoriel: {
        roles: over.roles ?? [
          { role: "chef-de-projet", etat: "en-cours", le },
          { role: "chef-de-projet", etat: "fait", le },
          { role: "maquettiste", etat: "en-cours", le },
          { role: "maquettiste", etat: "a-revoir", le },
        ],
        equipe: { remarques: { maquettiste: REMARQUES }, appels: { maquettiste: 1 }, ...(over.pieceCreee ? { pieceCreee: over.pieceCreee } : {}) },
      },
    },
  };
}
const avecPause = (code: string, message?: string, extra: { pieceCreee?: unknown } = {}): TravailPourVue => etatPilote({ pause: { code, ...(message ? { message } : {}) }, roles: [], ...extra });

describe("l'arrêt du pilote (maquettiste a rendu une maquette de forme incorrecte)", () => {
  const t = etatPilote();

  it("dit la cause du maquettiste en une phrase simple, sans « réessayez »", () => {
    const a = arretLisible(t, VIDEO)!;
    expect(a.cause).toContain("La maquette proposée n'avait pas la forme attendue : rien d'autre n'a été dépensé.");
    expect(a.cause).not.toMatch(/réessay/i);
    expect(a.cause).not.toMatch(/json|€|\$/i);
    expect(PHRASE_EQUIPE_BLOQUEE).not.toMatch(/réessay/i);
  });

  it("montre au plus 3 remarques, coupées à 120 caractères", () => {
    const longue = etatPilote();
    (longue.parametres as { tutoriel: { equipe: { remarques: { maquettiste: string[] } } } }).tutoriel.equipe.remarques.maquettiste = ["x".repeat(300), "b", "c", "d"];
    const a = arretLisible(longue, VIDEO)!;
    expect(a.releves).toHaveLength(3);
    expect(a.releves[0]).toHaveLength(120);
    expect(arretLisible(t, VIDEO)!.releves).toEqual(REMARQUES.slice(0, 3));
  });

  it("sans pièce : « Coller mon script » seulement, ni « Voir la maquette » ni « Réessayer »", () => {
    const a = arretLisible(t, VIDEO)!;
    expect(a.boutons.map((b) => b.genre)).toEqual(["coller-script"]);
    expect(a.boutons.some((b) => /réessay/i.test(b.libelle))).toBe(false);
  });

  it("avec une pièce proposée : « Voir la maquette » en premier", () => {
    const a = arretLisible(etatPilote({ pieceCreee: { proposition: 1 } }), VIDEO)!;
    expect(a.boutons.map((b) => b.genre)).toEqual(["voir-maquette", "coller-script"]);
    expect(a.boutons[0]!.href).toBe(`/tutoriel-outil/maquette/${VIDEO}`);
  });

  it("le lien de suivi ne mène pas à une maquette introuvable quand il n'y a pas de pièce", () => {
    expect(lienDeSuivi(t, VIDEO)).toBeUndefined();
    expect(lienDeSuivi(etatPilote({ pieceCreee: { proposition: 1 } }), VIDEO)).toBe(`/tutoriel-outil/maquette/${VIDEO}`);
  });

  it("la phrase se lit sur la ligne du maquettiste, pas sur celle du chef de projet", () => {
    const l = vueRoles(t);
    expect(l.find((x) => x.role === "maquettiste")!.phrase).toContain("La maquette proposée n'avait pas la forme attendue");
    expect(l.find((x) => x.role === "chef-de-projet")!.etat).toBe("fait");
  });

  it("la barre dit « En pause » (pas de temps restant)", () => {
    expect(estEnPause(t)).toBe(true);
  });
});

describe("autres rôles arrêtés", () => {
  const roleArrete = (role: string) => etatPilote({ roles: [{ role, etat: "a-revoir", le }] });
  it.each([
    ["chef-de-projet", /classement de votre demande/],
    ["analyste", /étude de votre demande/],
    ["stratege", /ce que la vidéo vous apporte/],
    ["scenariste", /script proposé/],
  ])("%s a sa phrase", (role, motif) => {
    const a = arretLisible(roleArrete(role), VIDEO)!;
    expect(a.cause).toMatch(motif);
    expect(a.cause).not.toMatch(/réessay/i);
  });

  it("réalisateur : la raison entre parenthèses du moteur est reprise", () => {
    const t = etatPilote({ roles: [{ role: "scenariste", etat: "fait", le }], pause: { code: "TO_EQUIPE_BLOQUEE", message: `${MESSAGE_MOTEUR} (Le tableau n'a aucune ligne à montrer.)` } });
    const a = arretLisible(t, VIDEO)!;
    expect(a.cause).toContain("Le découpage de la vidéo en scènes n'a pas pu se faire.");
    expect(a.cause).toContain("Le tableau n'a aucune ligne à montrer.");
    // La cause est sur la ligne « Réalisateur » ; le chef de projet reste « Terminé ».
    const l = vueRoles(etatPilote({ roles: [{ role: "chef-de-projet", etat: "fait", le }, { role: "scenariste", etat: "fait", le }], pause: { code: "TO_EQUIPE_BLOQUEE", message: `${MESSAGE_MOTEUR} (Le tableau n'a aucune ligne à montrer.)` } }));
    expect(l.find((x) => x.role === "realisateur")).toMatchObject({ etat: "a-revoir", phrase: expect.stringContaining("Le tableau n'a aucune ligne à montrer.") });
    expect(l.find((x) => x.role === "chef-de-projet")!.etat).toBe("fait");
    expect(l.find((x) => x.role === "chef-de-projet")!.phrase).not.toContain("découpage");
  });

  it("rôle inconnu : phrase de repli, jamais « réessayez »", () => {
    expect(arretLisible(etatPilote({ roles: [] }), VIDEO)!.cause).toBe(PHRASE_EQUIPE_BLOQUEE);
  });
});

describe("toutes les autres pauses : une phrase simple et le bon bouton", () => {
  const cas: [string, string | undefined, { genre: string; href: string } | null, boolean][] = [
    ["TO_PIECE_A_VALIDER", undefined, { genre: "voir-maquette", href: `/tutoriel-outil/maquette/${VIDEO}` }, true],
    ["TO_PIECE_A_REVOIR", undefined, { genre: "voir-maquette", href: `/tutoriel-outil/maquette/${VIDEO}` }, true],
    ["TO_PIECE_A_CONSTRUIRE", undefined, null, false],
    ["TO_FILM_A_CAPTURER", undefined, { genre: "voir-et-valider", href: `/tutoriel-outil/${VIDEO}` }, true],
    ["TO_SCRIPT_A_VALIDER", "Relisez les deux scripts, puis validez.", { genre: "voir-et-valider", href: `/tutoriel-outil/${VIDEO}` }, true],
    ["TO_SCRIPT_ABSENT", undefined, { genre: "coller-script", href: "/tutoriel-outil" }, true],
    ["TO_SCRIPT_NON_ECRIT", undefined, { genre: "coller-script", href: "/tutoriel-outil" }, true],
    ["TO_DEVIS_A_ACCEPTER", undefined, { genre: "voir-et-valider", href: `/tutoriel-outil/${VIDEO}` }, true],
    ["TO_DEVIS_ATTEINT", undefined, { genre: "voir-et-valider", href: `/tutoriel-outil/${VIDEO}` }, true],
    ["TO_DOSSIER_INCOMPLET", "Votre dossier n'a pas pu être lu pour l'instant. Rien n'a échoué.", null, true],
    ["TO_DEMANDE_VIDE", undefined, { genre: "refaire-demande", href: "/tutoriel-outil" }, true],
    ["TO_DEMANDE_ARRETEE", undefined, null, true],
    ["TO_OUTILS_NON_RELIES", undefined, null, true],
    ["TO_CAS_V2", "Cette demande demande votre décision.", null, true],
    ["TO_CODE_INCONNU", "Un message du moteur.", null, true],
  ];
  it.each(cas)("%s", (code, message, bouton, enPause) => {
    const a = arretLisible(avecPause(code, message), VIDEO)!;
    expect(a.cause.length).toBeGreaterThan(10);
    expect(a.cause).not.toMatch(/réessay|json|€|\$/i);
    expect(a.enPause).toBe(enPause);
    if (bouton) expect(a.boutons.find((b) => b.genre === bouton.genre)?.href).toBe(bouton.href);
    else expect(a.boutons).toEqual([]);
    expect(a.boutons.some((b) => /réessay/i.test(b.libelle))).toBe(false);
  });

  it("aucune pause : rien à dire", () => {
    expect(arretLisible({ statut: "en_cours", etapes: [], parametres: {} }, VIDEO)).toBeNull();
    expect(estEnPause({ statut: "en_cours", etapes: [], parametres: {} })).toBe(false);
  });
});

describe("boutons honnêtes : un bouton vers le formulaire ne promet jamais une reprise", () => {
  it.each(["TO_SCRIPT_ABSENT", "TO_SCRIPT_NON_ECRIT", "TO_DEMANDE_VIDE", "TO_EQUIPE_BLOQUEE"])("%s : « nouvelle demande », ni « reprend » ni « démarre »", (code) => {
    const a = arretLisible(avecPause(code), VIDEO)!;
    expect(a.boutons.some((b) => b.href === "/tutoriel-outil")).toBe(true);
    expect(a.cause).toMatch(/nouvelle demande/);
    expect(a.cause).not.toMatch(/reprend|démarre|repart dès/i);
  });
});

describe("remarques : jamais de montant", () => {
  it.each(["Coût 6 centimes dépassé", "Prix : 12 cts", "5 ct de trop", "Total 1,11", "3 euros", "2 USD", "7 dollars", "4 €", "$5"])("« %s » est écarté", (r) => {
    const t = etatPilote({ roles: [{ role: "maquettiste", etat: "a-revoir", le }] });
    (t.parametres as { tutoriel: { equipe: { remarques: Record<string, string[]> } } }).tutoriel.equipe.remarques.maquettiste = [r, "Écran 1, zone 1 : champ inconnu « titre »"];
    expect(arretLisible(t, VIDEO)!.releves).toEqual(["Écran 1, zone 1 : champ inconnu « titre »"]);
  });
});
