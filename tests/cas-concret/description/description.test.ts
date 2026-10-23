/**
 * Porte B (P2-01) : du texte libre à un cas, avec la garde d'honnêteté. Double de Claude et double du budget, aucun appel
 * réel. La réponse « de Claude » est le brouillon simulé du rôle, éventuellement abîmé.
 */
import { describe, expect, it } from "vitest";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { OFFRES, verifierCas, type CasConcret } from "@/formats/cas-concret/cas";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import {
  APPELS_DESCRIPTION_MAX,
  brouillonParGabarit,
  casDepuisDescription,
  casDuBrouillon,
  CADEAU_COACHING,
  offreDeduite,
  roleCasDepuisDescription,
  sorteDeduite,
  variableDescription,
  type BrouillonCas,
} from "@/moteurs/montage-cas-concret/description";
import {
  ETIQUETTE_EXEMPLE,
  MESSAGE_DESCRIPTION_COURTE,
  honneteteDeLaFiche,
  nombresDuTexte,
  reglesHonnetete,
  textesDuCas,
  verifierDescription,
} from "@/moteurs/montage-cas-concret/honnetete";
import { ficheParGabarit, REPONSE_COUPEE } from "@/moteurs/montage-cas-concret/ecriture";
import { ecritureDetachee, type AppelSuivi } from "@/moteurs/montage-cas-concret/appels";
import { cadeauDuCas } from "@/moteurs/montage-cas-concret/regles";
import type { DemandeReservationEcriture, OutilsEcriture, ReponseAppelEcriture } from "@/moteurs/montage-cas-concret/outils";

const CABINET = "Un cabinet comptable qui reçoit 200 factures par mois et les saisit à la main";

interface Double extends OutilsEcriture {
  appels: EntreeRole[];
  roles: DefinitionRole[];
  reservations: DemandeReservationEcriture[];
}

/** Double : rend les réponses dans l'ordre ; `"simuler"` rend la sortie simulée du rôle pour l'entrée reçue. */
function double(reponses: ("simuler" | string | object | ReponseAppelEcriture)[], budgetOk = true): Double {
  const d: Double = {
    appels: [],
    roles: [],
    reservations: [],
    async appeler(role, e) {
      d.roles.push(role);
      d.appels.push(e);
      const r = reponses[d.appels.length - 1];
      if (r === undefined) throw new Error("appel de trop");
      if (r === "simuler") return { ok: true, simule: true, donnees: role.simuler(e) };
      if (typeof r === "string") return { ok: true, simule: false, donnees: r };
      if ("ok" in r) return r as ReponseAppelEcriture;
      return { ok: true, simule: false, donnees: JSON.stringify(r) };
    },
    budget: {
      async reserver(demande) {
        d.reservations.push(demande);
        return budgetOk ? { ok: true } : { ok: false, message: "plafond du jour atteint" };
      },
    },
  };
  return d;
}

const brouillon = (texte = CABINET): BrouillonCas => brouillonParGabarit(texte);
const casDe = (b: BrouillonCas, texte = CABINET): CasConcret => {
  const v = verifierCas(casDuBrouillon(b, texte));
  if (!v.ok) throw new Error(v.raisons.join(" ; "));
  return v.cas;
};

describe("Porte B : le cabinet comptable", () => {
  it("rend un cas valide, posture offre, tous les visuels en objet, seul nombre 200, étiquette « Exemple »", async () => {
    const d = double(["simuler"]);
    const r = await casDepuisDescription({ texte: CABINET, videoId: "video-b" }, d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r).toMatchObject({ origine: "porte-b", etiquette: ETIQUETTE_EXEMPLE, appels: 1, relance: false, simule: true });
    expect(verifierCas(r.cas).ok).toBe(true);
    expect(r.cas.posture).toBe("offre");
    expect(r.cas.conformite).toBeUndefined();
    expect(r.cas.valideParWill).toBeUndefined();
    expect(r.cas.enServiceVerifie).toBeUndefined();
    expect(r.cas.etapes.every((e) => e.visuel.sorte === "objet")).toBe(true);
    const nombres = new Set([...textesDuCas(r.cas).flatMap((t) => nombresDuTexte(t.texte)), ...r.cas.faits.flatMap((f) => f.valeurs)]);
    expect([...nombres]).toEqual([200]);
    expect(reglesHonnetete(r.cas, CABINET)).toEqual([]);
    // Un seul appel, du bon rôle, réservé avant, la description entre balises.
    expect(d.roles.map((x) => x.id)).toEqual(["cas-depuis-description"]);
    expect(d.reservations).toHaveLength(1);
    expect(d.reservations[0].coutEstimeUsd).toBeGreaterThan(0);
    expect(d.appels[0].variable).toContain(`<description>${CABINET}</description>`);
  });

  it("l'offre déduite est l'une des quatre, et le document promis est le cadeau de cette offre", async () => {
    const r = await casDepuisDescription({ texte: CABINET, videoId: "video-b" }, double(["simuler"]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(OFFRES).toContain(r.cas.offre);
    const memeOffre = CATALOGUE.find((c) => c.offre === r.cas.offre);
    if (memeOffre) expect(r.cas.documentPromis.finCadeauId).toBe(memeOffre.documentPromis.finCadeauId);
  });

  it("P2R : une automatisation est une intégration de nature « automatisation », avec le cadeau de sa nature", async () => {
    const r = await casDepuisDescription({ texte: CABINET, videoId: "video-b" }, double(["simuler"]));
    if (!r.ok) throw new Error(r.message);
    expect([r.cas.offre, r.cas.nature]).toEqual(["integration", "automatisation"]);
    expect(r.cas.documentPromis.finCadeauId).toBe(cadeauDuCas(r.cas));
    expect(r.cas.documentPromis.finCadeauId).toBe(CATALOGUE.find((c) => c.nature === "automatisation")!.documentPromis.finCadeauId);
  });

  it("la simulation est déterministe : même texte, même cas", async () => {
    const a = await casDepuisDescription({ texte: CABINET, videoId: "v1" }, double(["simuler"]));
    const b = await casDepuisDescription({ texte: CABINET, videoId: "v2" }, double(["simuler"]));
    expect(a).toEqual(b);
  });

  it("le cas de la porte B donne une fiche dont l'accroche, une fois étiquetée « Exemple », passe la garde de la fiche", async () => {
    const r = await casDepuisDescription({ texte: CABINET, videoId: "video-b" }, double(["simuler"]));
    if (!r.ok) throw new Error(r.message);
    const fiche = ficheParGabarit(r.cas, { videoId: "video-b", versionId: "v1", habillage: "charte-duo/1", origine: "porte-b" });
    const refus = honneteteDeLaFiche(fiche);
    // Le gabarit d'écriture porte encore l'étiquette de la posture (raccord à faire dans l'écriture, hors de cette tâche).
    expect(refus.map((x) => x.lieu)).toEqual(["l'écran e01"]);
    const etiquetee = { ...fiche, ecrans: fiche.ecrans.map((e) => (e.type === "accroche" ? { ...e, etiquette: ETIQUETTE_EXEMPLE } : e)) };
    expect(honneteteDeLaFiche(etiquetee)).toEqual([]);
    expect(honneteteDeLaFiche({ ...fiche, origine: "porte-a" })).toEqual([]);
  });
});

describe("Porte B : la description est jugée avant tout appel", () => {
  it("40 caractères : refusé, « Décrivez le cas en deux phrases. », aucun appel ni réservation", async () => {
    const court = "Un cabinet qui saisit ses factures seul.";
    expect(court.length).toBe(40);
    const d = double([]);
    const r = await casDepuisDescription({ texte: court, videoId: "v" }, d);
    expect(r).toMatchObject({ ok: false, motif: "description", message: MESSAGE_DESCRIPTION_COURTE, appels: 0 });
    expect(d.reservations).toHaveLength(0);
    expect(d.appels).toHaveLength(0);
  });

  it("« chez nous » : refusé avant l'appel", async () => {
    const d = double([]);
    const r = await casDepuisDescription({ texte: "Chez nous, chaque facture reçue est saisie à la main dans le logiciel de comptabilité.", videoId: "v" }, d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motif).toBe("description");
    expect(r.message).toContain("chez nous");
    expect(d.appels).toHaveLength(0);
  });

  it("un client raconté : refusé avant l'appel", () => {
    expect(verifierDescription("Mon client reçoit chaque semaine des dizaines de devis et les recopie un par un dans un tableau.")).toHaveLength(1);
  });

  it("le texte du cabinet passe", () => {
    expect(verifierDescription(CABINET)).toEqual([]);
  });
});

describe("Porte B : la garde d'honnêteté sur le cas rendu", () => {
  it("« 3 heures » absent du texte : refusé, relancé une fois, puis échec motivé", async () => {
    const b = brouillon();
    const abime = { ...b, resultat: "Vous gagnez 3 heures par semaine." };
    const d = double([abime, abime]);
    const r = await casDepuisDescription({ texte: CABINET, videoId: "v" }, d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motif).toBe("refusee");
    expect(r.appels).toBe(APPELS_DESCRIPTION_MAX);
    expect(r.refus.join(" ")).toContain("« 3 »");
    // La relance porte les refus exacts.
    expect(d.appels[1].variable).toContain("<refus_cas_precedent>");
    expect(d.appels[1].variable).toContain("« 3 »");
  });

  it("une relance qui corrige le cas est acceptée", async () => {
    const b = brouillon();
    const d = double([{ ...b, resultat: "Vous gagnez 3 heures par semaine." }, b]);
    const r = await casDepuisDescription({ texte: CABINET, videoId: "v" }, d);
    expect(r).toMatchObject({ ok: true, appels: 2, relance: true });
  });

  it("« une heure » est un nombre : refusé s'il n'est pas dans le texte", () => {
    const cas = casDe({ ...brouillon(), resteHumain: "Relire les factures une heure par semaine." });
    expect(reglesHonnetete(cas, CABINET).map((r) => r.lieu)).toEqual(["ce qui reste humain"]);
  });

  it("P2R : un nombre de la description qui n'est la valeur d'aucun fait est refusé", () => {
    const cas = casDe({ ...brouillon(), faits: [], titre: "Exemple : les factures du cabinet" , cible: "Un cabinet comptable qui saisit ses factures à la main." , resultat: "Les 200 factures sont saisies seules." });
    expect(reglesHonnetete(cas, CABINET).map((r) => r.lieu)).toEqual(["le résultat"]);
  });

  it("une valeur de fait absente du texte : refusée", () => {
    const b = brouillon();
    // P2C : les valeurs d'un brouillon sont tirées de l'énoncé par le code ; une valeur inventée par Claude disparaît.
    const tire = casDe({ ...b, faits: [{ enonce: b.faits[0].enonce, valeurs: [200, 12] }] });
    expect(tire.faits[0].valeurs).not.toContain(12);
    expect(reglesHonnetete(tire, CABINET)).toEqual([]);
    // La garde reste entière sur un cas qui porterait quand même une valeur absente du texte.
    const cas = { ...tire, faits: [{ ...tire.faits[0], valeurs: [...tire.faits[0].valeurs, 12] }] };
    expect(reglesHonnetete(cas, CABINET).map((r) => r.lieu)).toEqual(["les valeurs du fait 1"]);
  });

  it("tournures d'usage réel, récit de client, nom propre, avis, mot interdit, tutoiement : chacun refusé", () => {
    const b = brouillon();
    const avec = (champ: Partial<BrouillonCas>) => reglesHonnetete(casDe({ ...b, ...champ }), CABINET);
    expect(avec({ resultat: "Chez nous, les factures sont saisies seules." })).toHaveLength(1);
    expect(avec({ resultat: "Nos clients ne saisissent plus rien." })).toHaveLength(1);
    expect(avec({ resultat: "Notre outil saisit tout." })).toHaveLength(1);
    expect(avec({ resultat: "Mon client ne saisit plus rien." })).toHaveLength(1);
    expect(avec({ cible: "Le cabinet Dupont, qui saisit ses factures." })).toHaveLength(1);
    expect(avec({ resultat: "Un avis unanime : plus de saisie." })).toHaveLength(1);
    expect(avec({ resultat: "La machine saisit tout." })).toHaveLength(1);
    expect(avec({ resultat: "Tu ne saisis plus rien." })).toHaveLength(1);
    // Les noms de la liste blanche passent.
    expect(avec({ resultat: "L'IA saisit les factures, partagées ensuite sur LinkedIn." })).toEqual([]);
  });

  it("promesse qui ne s'adresse pas au public : refusée", () => {
    expect(reglesHonnetete(casDe({ ...brouillon(), promesse: "Les factures se saisissent seules." }), CABINET).map((r) => r.lieu)).toEqual(["la promesse"]);
  });

  it("posture « chez nous », vrai écran, conformité, validation : chacun refusé", () => {
    const base = casDe(brouillon());
    const lieux = (c: CasConcret) => reglesHonnetete(c, CABINET).map((r) => r.lieu);
    expect(lieux({ ...base, posture: "chez-nous", enServiceVerifie: { le: "2026-10-12", source: "essai" } })).toEqual(["la posture", "la vérification"]);
    expect(lieux({ ...base, conformite: { rgpd: { phrase: "Tout est conforme.", source: "will", le: "2026-10-12" } } })).toContain("la conformité");
    expect(lieux({ ...base, valideParWill: { le: "2026-10-12", source: "essai" } })).toEqual(["la validation"]);
    const ecran = { sorte: "ecran" as const, adresse: "https://axion-ia.com/fr", mouvement: "image" as const, repli: "e-mail" as const };
    expect(lieux({ ...base, etapes: base.etapes.map((e, i) => (i === 0 ? { ...e, visuel: ecran } : e)) })).toEqual(["le visuel de l'étape 1"]);
  });

  it("un champ que Claude ne choisit pas (posture, conformité, vrai écran) est refusé à la forme", async () => {
    const b = brouillon();
    const d = double([{ ...b, posture: "chez-nous" }, { ...b, etapes: b.etapes.map((e) => ({ ...e, objet: "capture-du-site" })) }]);
    const r = await casDepuisDescription({ texte: CABINET, videoId: "v" }, d);
    expect(r).toMatchObject({ ok: false, motif: "refusee", appels: 2 });
  });

  it("réponse illisible, budget refusé, appel en échec : échecs motivés", async () => {
    expect(await casDepuisDescription({ texte: CABINET, videoId: "v" }, double(["pas du JSON", "pas du JSON"]))).toMatchObject({ ok: false, motif: "refusee", appels: 2 });
    const sansBudget = double([]);
    expect(await casDepuisDescription({ texte: CABINET, videoId: "v" }, { ...sansBudget, budget: { reserver: async () => ({ ok: false, message: "plafond atteint" }) } })).toMatchObject({ ok: false, motif: "budget", appels: 0 });
    expect(await casDepuisDescription({ texte: CABINET, videoId: "v" }, double([{ ok: false, arret: "panne", message: "Claude ne répond pas" }]))).toMatchObject({ ok: false, motif: "appel", appels: 1 });
  });
});

describe("Porte B (P2R) : la réponse lue par « donnees ?? texte », la réponse coupée refusée", () => {
  it("une réponse en TEXTE seul (rôle sans schéma, production) est lue", async () => {
    const texte = JSON.stringify(brouillon());
    const r = await casDepuisDescription({ texte: CABINET, videoId: "v" }, double([{ ok: true, simule: false, texte, stopReason: "end_turn" }]));
    expect(r).toMatchObject({ ok: true, appels: 1 });
  });

  it("une réponse coupée (« max_tokens ») n'est jamais lue : relance plus courte, puis échec motivé", async () => {
    const coupee: ReponseAppelEcriture = { ok: true, simule: false, texte: JSON.stringify(brouillon()), stopReason: "max_tokens" };
    const d = double([coupee, coupee]);
    const r = await casDepuisDescription({ texte: CABINET, videoId: "v" }, d);
    expect(r).toMatchObject({ ok: false, motif: "refusee", appels: 2, refus: [REPONSE_COUPEE] });
    expect(d.appels[1].variable).toContain("(réponse coupée, non reprise)");
    expect(d.appels[1].variable).not.toContain(CABINET.slice(0, 30) + "\n</reponse_precedente>");
  });

  it("une réponse coupée puis une réponse entière : le cas est accepté à la relance", async () => {
    const d = double([{ ok: true, simule: false, texte: "{\"offre\":", stopReason: "max_tokens" }, "simuler"]);
    expect(await casDepuisDescription({ texte: CABINET, videoId: "v" }, d)).toMatchObject({ ok: true, appels: 2, relance: true });
  });
});

describe("Porte B (P2R) : appels détachés", () => {
  class Attente extends Error {}
  class Expire extends Error {}

  it("le premier passage lance l'appel sans l'attendre ; le suivant relit la réponse ; jamais deux lancements", async () => {
    const d = double(["simuler"]);
    const gardees = new Map<string, ReponseAppelEcriture>();
    const lancements: string[] = [];
    const journal: { appels?: Record<string, AppelSuivi> } = {};
    const detachee = () =>
      ecritureDetachee(
        {
          ...d,
          detache: {
            lancer: async (cle, appel) => {
              lancements.push(cle);
              gardees.set(cle, await appel());
            },
            lire: async (cle) => gardees.get(cle) ?? null,
          },
        },
        { journal, garder: async () => {}, horloge: () => 0, libelle: "La porte B", attente: (l) => new Attente(l), expire: (p) => new Expire(p) },
      );

    await expect(casDepuisDescription({ texte: CABINET, videoId: "v" }, detachee())).rejects.toBeInstanceOf(Attente);
    expect(lancements).toHaveLength(1);
    expect(d.reservations).toHaveLength(1);
    const r = await casDepuisDescription({ texte: CABINET, videoId: "v" }, detachee());
    expect(r).toMatchObject({ ok: true, appels: 1 });
    // Relu, jamais relancé ni re-réservé.
    expect(lancements).toHaveLength(1);
    expect(d.appels).toHaveLength(1);
    expect(d.reservations).toHaveLength(1);
  });

  it("un appel en cours, sans réponse : le passage suivant rend la main sans relancer", async () => {
    const d = double([]);
    const lancements: string[] = [];
    const journal: { appels?: Record<string, AppelSuivi> } = {};
    const detachee = () =>
      ecritureDetachee(
        { ...d, detache: { lancer: (cle) => void lancements.push(cle), lire: async () => null } },
        { journal, garder: async () => {}, horloge: () => 1000, libelle: "La porte B", attente: (l) => new Attente(l), expire: (p) => new Expire(p) },
      );
    await expect(casDepuisDescription({ texte: CABINET, videoId: "v" }, detachee())).rejects.toBeInstanceOf(Attente);
    await expect(casDepuisDescription({ texte: CABINET, videoId: "v" }, detachee())).rejects.toBeInstanceOf(Attente);
    expect(lancements).toHaveLength(1);
    expect(d.reservations).toHaveLength(1);
  });
});

describe("Porte B : l'offre déduite et la simulation", () => {
  const AGENCE = "Une agence qui veut relier son formulaire de contact à son CRM et à son agenda partagé, sans rien recopier.";
  const EQUIPE = "Une équipe de dix personnes qui veut apprendre à se servir de l'IA pour répondre à ses e-mails.";
  const DIRIGEANT = "Un dirigeant qui ne sait pas par où commencer et voudrait un audit de ses tâches répétitives.";
  const COACHING = "Un dirigeant qui voudrait être accompagné, séance après séance, pour confier ses tâches répétitives à l'IA.";

  it.each([
    [CABINET, "integration", "automatisation"],
    [AGENCE, "integration", "outils-relies"],
    [EQUIPE, "formation", "formation"],
    [DIRIGEANT, "audit", "audit"],
    [COACHING, "coaching", "coaching"],
  ])("« %s » → %s (%s)", (texte, offre, sorte) => {
    expect(offreDeduite(texte)).toBe(offre);
    expect(sorteDeduite(texte)).toBe(sorte);
    expect(OFFRES).toContain(offreDeduite(texte));
  });

  it("« automatisation » n'est plus une offre : un brouillon qui la porte est refusé à la forme", async () => {
    const r = await casDepuisDescription({ texte: CABINET, videoId: "v" }, double([{ ...brouillon(), offre: "automatisation" }, { ...brouillon(), offre: "automatisation" }]));
    expect(r).toMatchObject({ ok: false, motif: "refusee", appels: 2 });
    if (!r.ok) expect(r.refus.join(" ")).toContain("offre");
  });

  it("une nature hors intégration est refusée", () => {
    expect(verifierCas(casDuBrouillon({ ...brouillon(EQUIPE), nature: "automatisation" }, EQUIPE)).ok).toBe(false);
  });

  it("chaque offre simulée rend un cas qui passe la garde, avec le cadeau de son offre", () => {
    for (const texte of [CABINET, AGENCE, EQUIPE, DIRIGEANT, COACHING]) {
      const sortie = roleCasDepuisDescription.simuler({ contexte: {}, variable: variableDescription(texte) });
      if (typeof sortie === "string") throw new Error("aucun brouillon simulé");
      const cas = casDe(sortie, texte);
      expect(reglesHonnetete(cas, texte), texte).toEqual([]);
      expect(cas.documentPromis.finCadeauId).toBe(cadeauDuCas(cas) ?? CADEAU_COACHING);
      expect(cas.promesse.split(/\s+/).length).toBeLessThanOrEqual(8);
    }
  });

  it("sans description : la simulation ne rend rien", () => {
    expect(roleCasDepuisDescription.simuler({ contexte: {}, variable: "" })).toBe("");
  });
});
