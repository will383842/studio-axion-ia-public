import { describe, expect, it, vi } from "vitest";
import type { MessageStock } from "@/domaine/stock-messages";
import { ecarterSujetsProches, rangerSignature, signatureDeMessage, signaturesDuStock, type SignatureStock } from "@/services/stock-signatures";

const msg = (id: string, texte: string, etat?: MessageStock["etat"]): MessageStock => ({ id, texte, etat, creeLe: "2026-11-01T10:00:00.000Z" });
const planifie = (id: string, texte: string) => msg(id, texte, "planifie");

const mots = (t: string) => t.trim().split(/\s+/).length;

/** Messages réalistes (RC-34, relecture) : un script complet de 40 à 200 mots, pas un titre. */
const RELANCE_70 =
  "Relancer un client qui ne répond plus, c'est un exercice délicat. Beaucoup de freelances attendent trois semaines, puis envoient un message agacé qui referme la porte. " +
  "Voici ce que je fais à la place. Premier réflexe : je reprends le dernier échange et je cherche ce qui a pu bloquer, le prix, le calendrier ou simplement un oubli. " +
  "Ensuite j'envoie un court message qui propose une seule action facile, par exemple un appel de dix minutes jeudi. " +
  "Enfin je note la date de la prochaine relance dans mon agenda, pour ne plus y penser.";
const FISCALITE_150 =
  "Fiscalité des auto-entrepreneurs : trois idées reçues qui coûtent cher. Première idée reçue : on ne paie rien tant qu'on ne vend rien. C'est vrai pour les cotisations, mais pas pour la cotisation foncière des entreprises, qui arrive après la première année. " +
  "Deuxième idée reçue : le seuil de chiffre d'affaires est un plafond souple. Non, le dépasser deux années de suite vous fait sortir du régime, avec un changement complet de déclarations. " +
  "Troisième idée reçue : on peut tout déduire. Dans ce régime, un abattement forfaitaire remplace vos frais réels, donc inutile de garder chaque ticket de café. " +
  "Mon conseil : posez-vous une alerte à 80 % du seuil et regardez votre simulation avant de signer un gros contrat. " +
  "Et si vous voulez voir comment je tiens ma comptabilité de client à client, répondez-moi en commentaire.";
// Le sujet « statut » n'apparaît qu'au milieu du message : ce n'est pas son thème.
const AUTRE_THEME_60 =
  "Organiser sa semaine de freelance sans s'épuiser : voici ma méthode en quatre temps. Le lundi matin, je liste trois priorités, jamais plus. Le mardi et le mercredi, je protège deux plages de travail profond sans messagerie. " +
  "Le jeudi, je traite les échanges avec mes clients, factures et devis compris, y compris mon statut juridique quand une question de contrat se pose. Le vendredi, je relis ce qui a marché et je prépare la suite.";

describe("RC-34 messages réalistes (40 à 200 mots)", () => {
  it("les messages d'essai ont bien la longueur d'un vrai message", () => {
    for (const t of [RELANCE_70, FISCALITE_150, AUTRE_THEME_60]) {
      expect(mots(t)).toBeGreaterThanOrEqual(40);
      expect(mots(t)).toBeLessThanOrEqual(200);
    }
    expect(mots(FISCALITE_150)).toBeGreaterThan(110);
  });

  it("un message planifié de plus de 60 mots écarte le sujet de l'usine qui reprend son thème", () => {
    const stock = signaturesDuStock([planifie("m1", RELANCE_70)]);
    const r = ecarterSujetsProches([{ id: "s1", sujet: "Relancer un client qui ne répond plus" }], stock);
    expect(r.ecartes.map((s) => s.id)).toEqual(["s1"]);
    expect(r.ecartes[0].proche).toBe("m1");
    expect(r.gardes).toEqual([]);
  });

  it("un message de plus de 110 mots écarte aussi son sujet, formulé autrement", () => {
    const stock = signaturesDuStock([planifie("m2", FISCALITE_150)]);
    const r = ecarterSujetsProches([{ id: "s1", sujet: "Fiscalité des auto-entrepreneurs : les idées reçues" }], stock);
    expect(r.ecartes.map((s) => s.id)).toEqual(["s1"]);
  });

  it("un sujet sans rapport est gardé face à de vrais messages longs", () => {
    const stock = signaturesDuStock([planifie("m1", RELANCE_70), planifie("m2", FISCALITE_150)]);
    const r = ecarterSujetsProches(
      [
        { id: "s1", sujet: "Préparer un devis clair pour une première mission" },
        { id: "s2", sujet: "Choisir le bon statut juridique pour freelance" },
      ],
      stock,
    );
    expect(r.gardes.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(r.ecartes).toEqual([]);
  });

  it("un mot du sujet noyé dans le corps d'un long message ne suffit pas à l'écarter", () => {
    const stock = signaturesDuStock([planifie("m3", AUTRE_THEME_60)]);
    const r = ecarterSujetsProches([{ id: "s1", sujet: "Choisir son statut juridique" }], stock);
    expect(r.gardes.map((s) => s.id)).toEqual(["s1"]);
  });

  it("toujours haché, même pour un long message, et la mémoire reste au-delà de 60 messages", () => {
    const sig = signatureDeMessage(planifie("m1", RELANCE_70));
    const brut = JSON.stringify(sig).toLowerCase();
    for (const mot of ["relanc", "client", "freelance", "calendrier"]) expect(brut).not.toContain(mot);
    const beaucoup = [planifie("m0", RELANCE_70), ...Array.from({ length: 80 }, (_, i) => planifie(`x${i}`, `Thème numéro${i} spécifique${i} ouvert${i}`))];
    const r = ecarterSujetsProches([{ id: "s1", sujet: "Relancer un client qui ne répond plus" }], signaturesDuStock(beaucoup));
    expect(r.ecartes).toHaveLength(1);
  });
});

describe("RC-34 signatures du stock", () => {
  it("écarte un sujet de l'usine proche d'un message planifié", () => {
    const stock = signaturesDuStock([planifie("m1", "Comment relancer un client qui ne répond plus")]);
    const r = ecarterSujetsProches([{ id: "s1", sujet: "Relancer un client qui ne répond plus" }, { id: "s2", sujet: "Fiscalité des auto-entrepreneurs" }], stock);
    expect(r.ecartes.map((s) => s.id)).toEqual(["s1"]);
    expect(r.gardes.map((s) => s.id)).toEqual(["s2"]);
    expect(r.ecartes[0].proche).toBe("m1");
  });

  it("garde l'écart au-delà de 60 messages, sans aucune mémoire centrale", () => {
    const messages = Array.from({ length: 100 }, (_, i) => planifie(`m${i}`, `Sujet numéro${i} unique${i}`));
    messages[0] = planifie("m0", "Relancer un client silencieux");
    const stock = signaturesDuStock(messages);
    expect(stock).toHaveLength(100);
    const r = ecarterSujetsProches([{ id: "s1", sujet: "Relancer un client silencieux" }], stock);
    expect(r.ecartes).toHaveLength(1);
  });

  it("ne stocke que des empreintes hachées", () => {
    const sig = signatureDeMessage(planifie("m1", "Relancer un client silencieux"));
    const brut = JSON.stringify(sig).toLowerCase();
    for (const mot of ["relancer", "relanc", "client", "silenci", "silencieux"]) expect(brut).not.toContain(mot);
    expect(Object.keys(sig).sort()).toEqual(["axes", "id"]);
    expect(sig.axes.every((a) => /^[0-9a-f]{64}$/.test(a))).toBe(true);
  });

  it("hache aussi la signature de l'usine", () => {
    const sig = signatureDeMessage(planifie("m1", "Relancer un client silencieux"), "sig-usine-ABC");
    expect(JSON.stringify(sig)).not.toContain("sig-usine-ABC");
    expect(sig.signature).toMatch(/^[0-9a-f]{64}$/);
    const r = ecarterSujetsProches([{ id: "s1", sujet: "tout autre thème", signatureUsine: "sig-usine-ABC" }], [sig], 0.1);
    expect(r.ecartes).toHaveLength(1);
  });

  it("n'envoie rien : aucun appel réseau", () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const stock = signaturesDuStock([planifie("m1", "Relancer un client silencieux")]);
    ecarterSujetsProches([{ id: "s1", sujet: "Relancer un client silencieux" }], stock);
    vi.unstubAllGlobals();
    expect(f).not.toHaveBeenCalled();
  });

  it("ne retient que les messages planifiés ou publiés, archivés compris", () => {
    const stock = signaturesDuStock([
      msg("a", "Relancer un client"),
      planifie("b", "Facturer un acompte"),
      msg("c", "Rédiger un devis", "publie"),
      { ...planifie("d", "Choisir un statut"), archiveLe: "2026-11-05T08:00:00.000Z" },
    ]);
    expect(stock.map((s) => s.id).sort()).toEqual(["b", "c", "d"]);
  });

  it("cas limites : vide, illisible, sans mot plein", () => {
    expect(ecarterSujetsProches([], [])).toEqual({ gardes: [], ecartes: [] });
    const stock = signaturesDuStock([planifie("m1", "Relancer un client")]);
    const r = ecarterSujetsProches([{ id: "s1", sujet: "" }, { id: "s2", sujet: "le la de" }, { id: "s3", sujet: undefined as unknown as string }], stock);
    expect(r.gardes.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(signaturesDuStock([planifie("x", ""), null as unknown as MessageStock, { id: "y" } as MessageStock])).toEqual([]);
    expect(ecarterSujetsProches([{ id: "s", sujet: "Relancer" }], [{ id: "z", axes: [] }, null as unknown as SignatureStock]).ecartes).toEqual([]);
  });

  it("seuil exact : score égal au seuil écarté, juste en dessous gardé", () => {
    const stock = signaturesDuStock([planifie("m1", "Relancer client")]);
    const s = [{ id: "s1", sujet: "Relancer client facture" }]; // 2 communs / 3 = 0,666…
    expect(ecarterSujetsProches(s, stock, 2 / 3).ecartes).toHaveLength(1);
    expect(ecarterSujetsProches(s, stock, 0.67).ecartes).toHaveLength(0);
  });

  it("rejeu : ranger deux fois le même message ne double rien, rien n'est supprimé", () => {
    const a = signatureDeMessage(planifie("m1", "Relancer un client"));
    const b = signatureDeMessage(planifie("m2", "Facturer un acompte"));
    const liste = rangerSignature(rangerSignature(rangerSignature([], a), b), a);
    expect(liste.map((s) => s.id)).toEqual(["m1", "m2"]);
    const avant = JSON.stringify(liste);
    rangerSignature(liste, signatureDeMessage(planifie("m3", "Autre chose ici")));
    expect(JSON.stringify(liste)).toBe(avant);
  });

  it("n'altère pas les entrées", () => {
    const sujets = [{ id: "s1", sujet: "Relancer un client" }];
    const copie = JSON.stringify(sujets);
    ecarterSujetsProches(sujets, signaturesDuStock([planifie("m1", "Relancer un client")]));
    expect(JSON.stringify(sujets)).toBe(copie);
  });
});
