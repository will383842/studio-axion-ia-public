/**
 * CONTRAT GÉNÉRATEUR → DÉCOUPAGE (constat du 12/10, essai réel n° 2 : script accepté 10 sur 10 par le générateur, fiche
 * refusée par le découpage sans que Will puisse rien y faire). Les deux moitiés doivent être d'accord :
 *  - pour chaque réseau principal et chaque série, un script témoin qui passe TOUS les contrôles en code du générateur
 *    donne une entrée de découpage dont les champs fixes respectent les bornes de la fiche ;
 *  - une fiche témoin FIDÈLE à ce script (une scène par moment, les mots à l'écran écrits, la ligne de l'accroche
 *    entourée dès le premier mot) passe « douleur en tête », « geste fort » et la règle de durée.
 * Les règles ne sont pas affaiblies : c'est l'entrée (douleur dite, mots de la douleur, durée) qui est juste. Aucun
 * appel : tout est pur.
 */
import { describe, expect, it, vi } from "vitest";
import { mockHeaders, mockNavigation } from "../helpers/next-mocks";
import { BORNES_FICHE } from "@/briques/fiche-scenes";
import { DOULEUR_MAX_TABLEAU, raccourcirDouleur } from "@/domaine/douleur-tableau";
import { RESEAUX_SCRIPT, SERIES_TABLEAU, normaliserScript, partiesAccordees, phrasesEtape, type DemandeScriptTableau, type EcritureScript, type PhraseScript } from "@/domaine/scripts-tableau";
import { aDesEliminatoires, controlerEcriture, texteDitDe } from "@/domaine/scripts-tableau-controles";
import { variableDecoupage } from "@/moteurs/montage-tableau/decoupage";
import type { ElementTableau, FicheTableau } from "@/moteurs/montage-tableau/fiche";
import { regleDouleurEnTete, regleDureeMaximale, regleGesteFortDouleur, type ContexteTableau } from "@/moteurs/montage-tableau/regles";
import { mots } from "@/domaine/controles-script/texte";
import { angleBorne } from "@/services/tableau-scripts";
import { DEMANDE_MODELE, ecritureModele } from "../tableau-scripts/modele-valide";
import { ANGLE_CAS_REEL, DEMANDE_CAS_REEL, DOULEUR_DECRITE_CAS_REEL, TEXTE_CAS_REEL, ecritureCasReel } from "../tableau-scripts/cas-reel-audit";

vi.mock("next/headers", () => mockHeaders);
vi.mock("next/navigation", () => mockNavigation);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const creation = await import("@/services/tableau-creation");

const CONTROLE: Omit<ContexteTableau, "texteScript"> = { aujourdhui: "2026-10-12", sourcesChiffres: [], preuves: [], matieres: [] };

interface Temoin {
  nom: string;
  demande: DemandeScriptTableau;
  ecriture: () => EcritureScript;
}
const TEMOINS: Temoin[] = [
  { nom: "exemple validé « Formation » (gabarit cadré, 15/10)", demande: DEMANDE_MODELE, ecriture: ecritureModele },
  { nom: "cas réel du 12/10 (Audit)", demande: DEMANDE_CAS_REEL, ecriture: ecritureCasReel },
];

/** Index du premier mot de `phrases[k]` dans le texte dit de la scène (même découpe que l'ancre des règles). */
function ancreDe(phrases: readonly PhraseScript[], k: number): number {
  return phrases.slice(0, k).reduce((n, p) => n + mots(p.dit).length, 0);
}

/**
 * Fiche témoin FIDÈLE au script : une scène par moment (une par étape), le texte dit mot pour mot, une ligne par phrase
 * avec ses mots à l'écran, écrite au premier mot de sa phrase ; la ligne de l'accroche est entourée (geste fort).
 */
function ficheTemoin(e: EcritureScript, d: { douleur: string; gesteMinute: string }): FicheTableau {
  const s = normaliserScript(e.script);
  const groupes: { role: string; phrases: PhraseScript[] }[] = [
    { role: "accroche", phrases: s.accroche },
    { role: "douleur", phrases: s.douleur },
    { role: "idee-recue", phrases: s.promesse },
    ...s.etapes.map((x) => ({ role: "etape", phrases: phrasesEtape(x) })),
    { role: "exemple", phrases: s.exemple.phrases },
    { role: "fin", phrases: [...s.aRetenir, ...s.appel] },
  ];
  let n = 0;
  const scenes = groupes.map((g, i) => ({
    id: `s${String(i + 1).padStart(2, "0")}`,
    role: g.role,
    page: Math.min(6, i + 1),
    texteDit: g.phrases.map((p) => p.dit.trim()).join(" "),
    elements: g.phrases.slice(0, 6).map(
      (p, k): ElementTableau => ({ id: `e${String(++n).padStart(2, "0")}`, type: "ligne", texte: p.ecran, niveau: k === 0 ? "titre" : "texte", role: "regle", ancre: ancreDe(g.phrases, k), ...(i === 0 && k === 0 ? { marque: "entoure" as const } : {}) }) as ElementTableau,
    ),
  }));
  return { version: "fiche-scenes/1", formatId: "tableau-anime", videoId: "v-contrat", versionId: "b1", habillage: "blocs/2", stylo: "crayon/1", ratio: "9:16", structure: "demonstration", serie: { code: "audit", nom: "Audit" }, douleur: d.douleur, gesteMinute: d.gesteMinute, appelId: null, scenes } as unknown as FicheTableau;
}

describe("bornes communes", () => {
  it("la borne de la douleur du générateur est celle de la fiche", () => {
    expect(DOULEUR_MAX_TABLEAU).toBe(BORNES_FICHE.douleurMax);
  });
});

describe("pour chaque réseau principal et chaque série : le script accepté par le générateur passe le découpage", () => {
  for (const reseau of RESEAUX_SCRIPT) {
    for (const serie of SERIES_TABLEAU) {
      it(`${reseau} · ${serie}`, () => {
        let essayes = 0;
        for (const t of TEMOINS) {
          const demande: DemandeScriptTableau = { ...t.demande, reseau, serie };
          const ecriture = t.ecriture();
          // 1. Le témoin passe TOUS les contrôles en code du générateur pour cette demande (sinon il ne serait pas livré).
          if (aDesEliminatoires(controlerEcriture(ecriture, demande))) continue;
          essayes++;

          // 2. Le pont : ce que « Utiliser ce script » remplit, validé comme l'écran le valide, puis l'entrée du découpage.
          const donnees = creation.donneesDepuisScript(demande, { script: ecriture.script, angle: "", motsDouleur: ecriture.motsDouleur }, { douleur: DOULEUR_DECRITE_CAS_REEL });
          const v = creation.validerDonneesScript(donnees);
          expect(v.ok, `${t.nom} : ${v.ok ? "" : v.phrase}`).toBe(true);
          const entree = creation.entreeDecoupage(v.ok ? v.donnees : donnees, "v-contrat", "b1", CONTROLE, []);
          expect(entree.douleur.length).toBeLessThanOrEqual(BORNES_FICHE.douleurMax);
          expect(entree.gesteMinute.length).toBeLessThanOrEqual(BORNES_FICHE.gesteMinuteMax);
          expect(entree.douleur).toBe(donnees.douleur);
          expect(entree.controle.motsDouleur).toEqual(ecriture.motsDouleur);
          // Les parties nommées suivent jusqu'aux données du découpage, et redonnent exactement le texte transmis.
          expect(v.ok && partiesAccordees(v.donnees.parties, entree.texteScript), t.nom).toBe(true);
          expect(variableDecoupage(entree)).toContain(`<mots_douleur>\n${ecriture.motsDouleur.join(", ")}\n</mots_douleur>`);
          // La douleur transmise est DITE : chacun de ses mots est dans le texte.
          expect(texteDitDe(ecriture.script)).toContain(entree.douleur.replace(/…$/, ""));

          // 3. Une fiche fidèle passe les trois règles qui refusaient le cas réel.
          const fiche = ficheTemoin(ecriture, entree);
          const contexte: ContexteTableau = { ...entree.controle, texteScript: entree.texteScript };
          expect(regleDouleurEnTete(fiche, contexte), t.nom).toEqual([]);
          expect(regleGesteFortDouleur(fiche, contexte), t.nom).toEqual([]);
          expect(regleDureeMaximale(fiche, contexte), t.nom).toEqual([]);
        }
        expect(essayes).toBeGreaterThan(0);
      });
    }
  }
});

describe("le cas réel du 12/10", () => {
  it("accepté ce jour-là, il est refusé par les règles en vigueur (« le problème n'est pas… », ni idée ni gain)", () => {
    expect(texteDitDe(ecritureCasReel().script)).toBe(TEXTE_CAS_REEL);
    const codes = controlerEcriture(ecritureCasReel(), DEMANDE_CAS_REEL).filter((d) => d.eliminatoire).map((d) => d.code);
    expect(codes).toEqual(expect.arrayContaining(["libelle-probleme", "gain-absent", "idee-absente"]));
  });

  it("la douleur décrite trop longue est raccourcie à sa première phrase entière, jamais refusée", () => {
    expect(DOULEUR_DECRITE_CAS_REEL.length).toBeGreaterThan(BORNES_FICHE.douleurMax);
    expect(raccourcirDouleur(DOULEUR_DECRITE_CAS_REEL)).toBe("Le dirigeant de petite entreprise sent qu'il perd du temps, mais ne sait pas dire où.");
    expect(angleBorne(ANGLE_CAS_REEL).douleur.length).toBeLessThanOrEqual(BORNES_FICHE.douleurMax);
  });

  it("la douleur transmise est l'accroche dite, avec les mots de la douleur", () => {
    const donnees = creation.donneesDepuisScript(DEMANDE_CAS_REEL, { script: ecritureCasReel().script, angle: "", motsDouleur: ecritureCasReel().motsDouleur }, ANGLE_CAS_REEL);
    expect(donnees.douleur).toBe("Vous finissez à dix-neuf heures sans savoir où est passée la journée.");
    expect(donnees.motsDouleur).toEqual(["dix-neuf heures", "passée", "journée"]);
  });

  it("avec l'ANCIENNE entrée (douleur décrite, sans mots), la même fiche était refusée : les règles n'ont pas bougé", () => {
    const e = ecritureCasReel();
    const fiche = ficheTemoin(e, { douleur: raccourcirDouleur(DOULEUR_DECRITE_CAS_REEL), gesteMinute: DEMANDE_CAS_REEL.sujet });
    const contexte: ContexteTableau = { ...CONTROLE, texteScript: TEXTE_CAS_REEL };
    expect(regleDouleurEnTete(fiche, contexte).map((m) => m.detail)).toEqual([
      expect.stringContaining("aucun mot de la douleur n'est dit dans les 3 premières secondes"),
      expect.stringContaining("aucun mot de la douleur n'est écrit dans la première scène"),
    ]);
    expect(regleGesteFortDouleur(fiche, contexte)).not.toEqual([]);
  });

  it("si le découpage refuse quand même, chaque motif dit quoi faire", () => {
    const e = ecritureCasReel();
    const fiche = ficheTemoin(e, { douleur: "Vous finissez à dix-neuf heures sans savoir où est passée la journée.", gesteMinute: "Une feuille" });
    // Ligne de l'accroche réécrite sans mot de la douleur : les messages proposent les mots à écrire.
    (fiche.scenes[0].elements[0] as { texte: string }).texte = "Le soir venu";
    const contexte: ContexteTableau = { ...CONTROLE, texteScript: TEXTE_CAS_REEL, motsDouleur: e.motsDouleur };
    const [ecrit] = regleDouleurEnTete(fiche, contexte);
    expect(ecrit.detail).toBe("aucun mot de la douleur n'est écrit dans la première scène : écrivez dans une de ses lignes un des mots « dix-neuf heures », « passée », « journée ».");
    expect(regleGesteFortDouleur(fiche, contexte)[0].detail).toContain("entourez ou barrez, au début de la première scène, une ligne qui écrit un des mots « dix-neuf heures », « passée », « journée »");
    // Trop long (estimation à débit injecté plus lent) : le nombre de caractères à retirer.
    const [duree] = regleDureeMaximale(fiche, { ...contexte, caracteresParSeconde: 15 });
    expect(duree.detail).toMatch(/raccourcissez le texte dit d'au moins \d+ caractères \(environ \d+ mots\)\.$/);
  });
});
