"use client";

// Lot G5 : fabriquer un guide en 5 gestes. Présentation : les services arrivent en propriétés (actions serveur de /mots).
// Même façon de faire que la carte « YouTube Shorts » : boutons désactivés pendant un geste, messages en role="status" / "alert",
// champs étiquetés, tout au clavier. Rien ne part sur un réseau social ; le rattachement n'allume rien.
import { useId, useState, useTransition } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { notifier } from "@/components/ui/Toast";
import { depuisEditable, etapeAtteinte, TEXTES_GUIDES as T, versEditable, type ContenuEditable } from "./guides-logique";
import type { ResultatGeste, VueGuideMot } from "@/services/guides-fabrique";

type Simple = { ok: boolean; phrase: string };
export interface ServicesGuides {
  lire: (mot: string) => Promise<ResultatGeste<{ vue: VueGuideMot }>>;
  rediger: (mot: string) => Promise<Simple>;
  valider: (mot: string, version: number, contenu: unknown, toutLu: boolean) => Promise<Simple>;
  fabriquer: (mot: string) => Promise<Simple>;
  rattacher: (mot: string) => Promise<Simple>;
}

export function EcranGuides({ mots, services, onChange }: { mots: readonly string[]; services: ServicesGuides; onChange?: () => void }) {
  const idMot = useId();
  const idListe = useId();
  const [saisie, setSaisie] = useState("");
  const [mot, setMot] = useState<string | null>(null);
  const [vue, setVue] = useState<VueGuideMot | null>(null);
  const [edition, setEdition] = useState<ContenuEditable | null>(null);
  const [toutLu, setToutLu] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  /** Relit l'état du mot et prépare le texte à relire. */
  async function relire(m: string) {
    const r = await services.lire(m);
    if (!r.ok) {
      setMessage({ ok: false, texte: r.phrase });
      return false;
    }
    setVue(r.vue);
    setEdition(r.vue.derniere && r.vue.derniere.statut !== "Validé" ? versEditable(r.vue.derniere.contenu) : null);
    setToutLu(false);
    return true;
  }

  function geste(action: () => Promise<Simple>, apres?: () => Promise<void>) {
    if (!mot) return;
    demarrer(async () => {
      let r: Simple;
      try {
        r = await action();
      } catch {
        setMessage({ ok: false, texte: T.erreurGeneral });
        notifier.erreur(T.erreurGeneral);
        return;
      }
      setMessage({ ok: r.ok, texte: r.phrase });
      if (r.ok) {
        notifier.succes(r.phrase);
        await relire(mot).catch(() => {});
        await apres?.();
        onChange?.();
      } else notifier.erreur(r.phrase);
    });
  }

  function creer() {
    const m = saisie.trim();
    if (!m) return;
    setMessage(null);
    demarrer(async () => {
      try {
        if (await relire(m)) setMot(m);
      } catch {
        setMessage({ ok: false, texte: T.erreurGeneral });
      }
    });
  }

  const etape = etapeAtteinte(vue);
  const derniere = vue?.derniere ?? null;
  const aRelire = derniere !== null && derniere.statut !== "Validé";
  const fabrique = vue?.fabrique ?? null;
  // L'aperçu du texte et le bouton « Rattacher » n'existent que si la version fabriquée est la dernière (validée) ; sinon le serveur répond « pas_fabrique ». Le message « Rattaché » dit, lui, la version réellement rattachée (même ancienne).
  const fabriqueALaDerniere = fabrique !== null && derniere !== null && fabrique.version === derniere.version;

  function majSection(i: number, champ: "titre" | "paragraphes" | "puces", v: string) {
    setEdition((e) => (e ? { ...e, sections: e.sections.map((s, j) => (j === i ? { ...s, [champ]: v } : s)) } : e));
    setToutLu(false);
  }

  return (
    <div className="flex flex-col gap-5" data-ecran="guides">
      <div>
        <h2 className="text-lg font-semibold text-texte">{T.titre}</h2>
        <p className="text-sm text-texte-doux">{T.intro}</p>
      </div>

      <ol aria-label="Les 5 gestes" className="flex flex-wrap gap-2 text-xs">
        {T.etapes.map((libelle, i) => (
          <li key={libelle} aria-current={mot && i === Math.min(etape, 4) ? "step" : undefined} className={`rounded-full border px-3 py-1 ${mot && i <= etape ? "border-orange text-texte" : "border-trait text-texte-faible"}`}>
            {i + 1}. {libelle}
          </li>
        ))}
      </ol>

      <section aria-labelledby={`${idMot}-t`} className="space-y-2">
        <h3 id={`${idMot}-t`} className="text-sm font-semibold text-texte-doux">
          1. {T.etapes[0]}
        </h3>
        <label htmlFor={idMot} className="mb-1.5 block text-sm font-semibold text-texte-doux">
          {T.choisirMot}
        </label>
        <input
          id={idMot}
          list={idListe}
          value={saisie}
          maxLength={60}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") creer();
          }}
          className="min-h-12 w-full rounded-champ border border-trait bg-surface-1 px-3.5 text-texte"
        />
        <datalist id={idListe}>
          {mots.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <p className="text-xs text-texte-faible">{T.motAide}</p>
        <Bouton type="button" disabled={enCours || !saisie.trim()} onClick={creer}>
          {T.creer}
        </Bouton>
      </section>

      {mot && (
        <section aria-labelledby={`${idMot}-m`} className="space-y-5">
          <h3 id={`${idMot}-m`} className="text-sm font-semibold text-texte">
            Guide du mot « {mot} »
          </h3>

          <div className="space-y-1">
            <Bouton type="button" variante="secondaire" disabled={enCours} onClick={() => geste(() => services.rediger(mot))}>
              2. {T.rediger}
            </Bouton>
            <p className="text-xs text-texte-faible">{T.redigerAide}</p>
            {!derniere && <p className="text-sm text-texte-doux">{T.aucunBrouillon}</p>}
          </div>

          {aRelire && edition && derniere && (
            <div className="space-y-4 border-t border-trait pt-4">
              <p role="status" className="text-sm font-semibold text-ambre">
                Brouillon n° {derniere.version} : à relire, à corriger si besoin, puis à valider.
              </p>
              <ChampTexte libelle="Titre du guide" valeur={edition.titre} onChange={(v) => { setEdition({ ...edition, titre: v }); setToutLu(false); }} />
              {edition.sections.map((s, i) => (
                <fieldset key={i} className="space-y-3 rounded-carte border border-trait p-3">
                  <legend className="px-1 text-sm font-semibold text-texte-doux">Partie {i + 1}</legend>
                  <ChampTexte libelle="Titre de la partie" valeur={s.titre} onChange={(v) => majSection(i, "titre", v)} />
                  <ZoneSimple libelle="Paragraphes (séparés par une ligne vide)" valeur={s.paragraphes} onChange={(v) => majSection(i, "paragraphes", v)} lignes={6} />
                  <ZoneSimple libelle="Puces (une par ligne, facultatif)" valeur={s.puces} onChange={(v) => majSection(i, "puces", v)} lignes={3} />
                </fieldset>
              ))}
              <CaseACocher libelle={T.toutLu} detail={T.toutLuDetail} coche={toutLu} desactive={enCours} onChange={setToutLu} />
              <Bouton type="button" disabled={enCours || !toutLu} onClick={() => geste(() => services.valider(mot, derniere.version, depuisEditable(edition), toutLu))}>
                3. {T.valider}
              </Bouton>
            </div>
          )}

          {derniere?.statut === "Validé" && (
            <div className="space-y-1 border-t border-trait pt-4">
              <p role="status" className="text-sm text-texte">
                Version {derniere.version} validée.
              </p>
              <Bouton type="button" disabled={enCours || (!!fabrique && fabrique.version === derniere.version)} onClick={() => geste(() => services.fabriquer(mot))}>
                4. {T.fabriquer}
              </Bouton>
              <p className="text-xs text-texte-faible">{T.fabriquerAide}</p>
            </div>
          )}

          {fabrique && derniere && (
            <div className="space-y-3 border-t border-trait pt-4">
              <h4 className="text-sm font-semibold text-texte">{T.apercu}</h4>
              <p role="status" className="text-sm text-texte">
                {T.pdfFabrique} {fabrique.pages ? `${fabrique.pages} pages.` : ""} {fabrique.cheminPdf ? `Fichier : ${fabrique.cheminPdf}` : ""}
              </p>
              {fabriqueALaDerniere && (
              <article className="space-y-2 rounded-carte border border-trait bg-surface-2 p-3 text-sm text-texte" aria-label="Texte du guide fabriqué">
                <p className="font-semibold">{derniere.contenu.titre}</p>
                {derniere.contenu.sections.map((s) => (
                  <div key={s.titre}>
                    <p className="font-semibold text-texte-doux">{s.titre}</p>
                    {s.paragraphes.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                    {s.puces.length > 0 && (
                      <ul className="list-disc pl-5">
                        {s.puces.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </article>
              )}
              {fabrique.rattache ? (
                <p role="status" className="text-sm font-semibold text-texte">
                  {T.rattache(fabrique.version)}
                </p>
              ) : fabriqueALaDerniere && derniere.statut === "Validé" ? (
                <div className="space-y-1">
                  <Bouton type="button" disabled={enCours} onClick={() => geste(() => services.rattacher(mot))}>
                    5. {T.rattacher}
                  </Bouton>
                  <p className="text-xs text-texte-faible">{T.rattacherAide}</p>
                </div>
              ) : null}
            </div>
          )}
        </section>
      )}

      <div aria-live="polite" aria-busy={enCours}>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-sm font-semibold ${message.ok ? "text-texte" : "text-brique"}`}>
            {message.texte}
          </p>
        )}
      </div>
    </div>
  );
}

function ChampTexte({ libelle, valeur, onChange }: { libelle: string; valeur: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-texte-doux">
        {libelle}
      </label>
      <input id={id} value={valeur} onChange={(e) => onChange(e.target.value)} className="min-h-12 w-full rounded-champ border border-trait bg-surface-1 px-3.5 text-texte" />
    </div>
  );
}

function ZoneSimple({ libelle, valeur, onChange, lignes }: { libelle: string; valeur: string; onChange: (v: string) => void; lignes: number }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-texte-doux">
        {libelle}
      </label>
      <textarea id={id} rows={lignes} value={valeur} onChange={(e) => onChange(e.target.value)} className="w-full rounded-champ border border-trait bg-surface-1 px-3.5 py-2 text-texte" />
    </div>
  );
}
