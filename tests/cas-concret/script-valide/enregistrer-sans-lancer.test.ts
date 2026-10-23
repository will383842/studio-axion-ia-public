/**
 * « Enregistrer sans lancer » côté écran « Relire le script » du cas concret (fonctions pures, action simulée, aucun
 * réseau, aucune dépense) : l'enregistrement passe par `modifierScriptValideAction` (nouvelle version validée), dit
 * « Script enregistré (version N) », et la relecture suit la version du cas rendue ensuite par la page.
 */
import { describe, expect, it, vi } from "vitest";
import { casCourant, enregistrerScriptRelu } from "../../../src/components/formats/cas-concret/entree/relire";
import { versVueCas } from "../../../src/components/formats/cas-concret/entree/vue";
import { appliquerSaisie, empreinte, scriptReluDe } from "../../../src/domaine/relecture-script";
import { empreinteCas } from "../../../src/formats/cas-concret/cas";
import { trouverCas } from "../../../src/formats/cas-concret/catalogue";
import { apercuDesEcrans, scriptValideDuCatalogue } from "../../../src/moteurs/montage-cas-concret/script-valide";
import { lignesDesEcrans } from "../../../src/moteurs/montage-cas-concret/relecture";

const cas = trouverCas("recrutement-apporteurs")!;
const ecrans = apercuDesEcrans(scriptValideDuCatalogue(cas.id)!.ecrans);
const avant = lignesDesEcrans(ecrans);
const modifiable = avant.find((l) => !l.verrouille)!;
const apres = appliquerSaisie(avant, modifiable.id, { dit: `${modifiable.dit} Vraiment.` });
const relu = scriptReluDe(avant, apres);

describe("enregistrerScriptRelu", () => {
  it("appelle l'action de modification (jamais le lancement) et dit « Script enregistré (version N) »", async () => {
    const action = vi.fn(async () => ({ ok: true as const, donnees: { empreinte: relu.empreinte, numero: 2, modifie: true } }));
    const r = await enregistrerScriptRelu(cas.id, relu, action);
    expect(r).toEqual({ ok: true, message: "Script enregistré (version 2)" });
    expect(action).toHaveBeenCalledTimes(1);
    const appel = action.mock.calls[0] as unknown[];
    expect(appel[0]).toBe(cas.id);
    expect(appel[1]).toHaveLength(1);
  });

  it("un script refusé : la phrase du refus est rendue telle quelle, rien n'est enregistré", async () => {
    const action = vi.fn(async () => ({ ok: false as const, message: "Le script est refusé : phrase trop longue." }));
    expect(await enregistrerScriptRelu(cas.id, relu, action)).toEqual({ ok: false, message: "Le script est refusé : phrase trop longue." });
  });

  it("rien n'a changé côté serveur (modifie: false) : on ne dit pas « enregistré »", async () => {
    const action = vi.fn(async () => ({ ok: true as const, donnees: { empreinte: relu.empreinte, numero: 2, modifie: false } }));
    const r = await enregistrerScriptRelu(cas.id, relu, action);
    expect(r).toEqual({ ok: true, message: "Aucun changement : le script est déjà enregistré (version 2)" });
    expect(r.message).not.toContain("Script enregistré");
  });

  it("le script gardé n'est pas celui relu : refus en phrase", async () => {
    const action = vi.fn(async () => ({ ok: true as const, donnees: { empreinte: "autre", numero: 3, modifie: true } }));
    const r = await enregistrerScriptRelu(cas.id, relu, action);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Rouvrez le cas");
  });

  it("aucune modification : rien à enregistrer, l'action n'est pas appelée", async () => {
    const action = vi.fn();
    const r = await enregistrerScriptRelu(cas.id, scriptReluDe(avant, avant), action);
    expect(r.ok).toBe(true);
    expect(action).not.toHaveBeenCalled();
    expect(empreinte(avant)).toBe(scriptReluDe(avant, avant).empreinte);
  });
});

describe("casCourant : la carte suit la nouvelle version", () => {
  it("rend le cas rafraîchi par la page (nouvelle phrase), sinon celui de la relecture", () => {
    const ancien = versVueCas(cas, empreinteCas(cas), true, ecrans);
    const neuf = versVueCas(cas, empreinteCas(cas), true, ecrans.map((e, i) => (i === 0 ? { ...e, texteDit: "Nous recrutons autrement." } : e)));
    expect(casCourant([neuf], ancien)).toBe(neuf);
    expect(casCourant([], ancien)).toBe(ancien);
    expect(casCourant([neuf], ancien).script?.[0].texteDit).toBe("Nous recrutons autrement.");
  });
});
