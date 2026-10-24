"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { ajouterCasAction, controlerCasAjouteAction } from "@/app/(studio)/cas-concret/actions";
import { Bouton } from "@/components/ui/Bouton";
import { notifier } from "@/components/ui/Toast";
import { LIBELLES_SECTEURS } from "../stock/filtres-stock";
import { champEnFaute, ETAPES_MAX, ETAPES_MIN, etapeVide, LIBELLES_OBJETS, OBJETS_CHOIX, saisieVide, versFormulaire, type EtapeSaisie, type SaisieCas } from "./formulaire-cas";

const CLASSE_CHAMP = "block w-full rounded-champ border border-trait bg-surface-1 px-3.5 py-3 text-base leading-relaxed text-texte hover:border-trait-fort focus:border-orange focus:outline-none aria-[invalid=true]:border-brique";
const AIDE_SCRIPT = "Facultatif. Une ligne = un écran. Étiquettes facultatives en début de ligne : [accroche] [avant] [bascule] [étape] [détail] [humain] [résultat] [question]. Il est dit mot pour mot, sans écriture par l'IA.";

type PropsChamp = { id: string; "aria-describedby": string; "aria-invalid": boolean };

/** Un champ : libellé visible, aide, compteur, aria-describedby et aria-invalid. */
function Champ({ id, libelle, aide, max, valeur, enFaute, children }: { id: string; libelle: string; aide?: string; max?: number; valeur?: string; enFaute?: boolean; children: (p: PropsChamp) => ReactNode }) {
  const idAide = `${id}-aide`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-texte-doux">
        {libelle}
      </label>
      {children({ id, "aria-describedby": idAide, "aria-invalid": !!enFaute })}
      <p id={idAide} className="mt-1.5 text-[13px] text-texte-doux">
        {aide}
        {max ? ` ${(valeur ?? "").length} / ${max} caractères.` : ""}
      </p>
    </div>
  );
}

/**
 * « Ajouter un cas » : Will décrit son cas, le vérifie (gratuit : refus en phrases, cas qui ressemblent), puis l'ajoute. Il
 * apparaît dans « À faire » ; la case « Je valide ce cas » est cochée par défaut (c'est la décision de Will, visible ici).
 */
export function FormulaireCas() {
  const routeur = useRouter();
  const pref = useId();
  const liste = useRef<HTMLDivElement>(null);
  const [s, setS] = useState<SaisieCas>(saisieVide);
  const [refus, setRefus] = useState<string[]>([]);
  const [ressemble, setRessemble] = useState<{ id: string; titre: string }[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [attente, demarrer] = useTransition();
  const maj = <K extends keyof SaisieCas>(k: K, v: SaisieCas[K]) => {
    setS((x) => ({ ...x, [k]: v }));
    setRessemble(null);
  };
  const majEtape = (i: number, plus: Partial<EtapeSaisie>) => {
    setS((x) => ({ ...x, etapes: x.etapes.map((e, j) => (j === i ? { ...e, ...plus } : e)) }));
    setRessemble(null);
  };
  const id = (nom: string) => `${pref}-${nom}`;
  const fautes = new Set(refus.map(champEnFaute).filter((x): x is string => !!x));

  // Après un refus, le curseur va sur le premier champ en faute (sinon sur la liste des refus).
  useEffect(() => {
    if (!refus.length) return;
    const premier = refus.map(champEnFaute).find((x): x is string => !!x);
    const el = premier ? document.getElementById(`${pref}-${premier}`) : null;
    (el ?? liste.current)?.focus();
  }, [refus, pref]);

  function ajouter(confirmeRessemblance: boolean) {
    setErreur(null);
    demarrer(async () => {
      const formulaire = versFormulaire(s);
      const script = s.script.trim() ? s.script : null;
      const verif = await controlerCasAjouteAction(formulaire, script);
      if (!verif.ok) return void setErreur(verif.message);
      if (!verif.donnees.ok) {
        setRefus(verif.donnees.raisons);
        return;
      }
      setRefus([]);
      if (verif.donnees.ressemblances.length && !confirmeRessemblance) {
        setRessemble(verif.donnees.ressemblances);
        return;
      }
      const r = await ajouterCasAction(formulaire, { valider: s.valider, script });
      if (!r.ok) {
        setRefus(r.message.split("\n").filter(Boolean));
        return;
      }
      notifier.succes("Cas ajouté", r.donnees.titre);
      routeur.push("/cas-concret");
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        ajouter(false);
      }}
      noValidate
    >
      <Champ id={id("titre")} libelle="Titre" aide="Ce que la vidéo montre, en une phrase, sans chiffre ni nom propre." max={100} valeur={s.titre} enFaute={fautes.has("titre")}>
        {(p) => <input {...p} type="text" value={s.titre} maxLength={100} onChange={(e) => maj("titre", e.target.value)} className={CLASSE_CHAMP} />}
      </Champ>
      <Champ id={id("theme")} libelle="Thème (1 ou 2 mots)" aide="Il sert de sur-titre sur les écrans. Il doit être différent de celui des autres cas." max={30} valeur={s.theme} enFaute={fautes.has("theme")}>
        {(p) => <input {...p} type="text" value={s.theme} maxLength={30} onChange={(e) => maj("theme", e.target.value)} className={CLASSE_CHAMP} />}
      </Champ>

      <fieldset className="space-y-2">
        <legend className="mb-1.5 text-sm font-semibold text-texte-doux">Offre</legend>
        <div className="flex flex-wrap gap-2">
          {(["integration", "audit", "formation", "coaching"] as const).map((o) => (
            <label key={o} className="inline-flex min-h-11 items-center gap-2 rounded-champ border border-trait px-3 text-[15px] text-texte">
              <input type="radio" name={id("offre")} value={o} checked={s.offre === o} onChange={() => maj("offre", o)} />
              {{ integration: "Intégration", audit: "Audit", formation: "Formation", coaching: "Coaching" }[o]}
            </label>
          ))}
        </div>
      </fieldset>
      {s.offre === "integration" && (
        <Champ id={id("nature")} libelle="Nature de l'intégration" aide="Une automatisation, ou des outils reliés entre eux.">
          {(p) => (
            <select {...p} value={s.nature} onChange={(e) => maj("nature", e.target.value as SaisieCas["nature"])} className={CLASSE_CHAMP}>
              <option value="automatisation">Automatisation</option>
              <option value="outils-relies">Outils reliés</option>
            </select>
          )}
        </Champ>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Champ id={id("secteur")} libelle="Secteur (facultatif)">
          {(p) => (
            <select {...p} value={s.secteur} onChange={(e) => maj("secteur", e.target.value)} className={CLASSE_CHAMP}>
              <option value="">Non précisé</option>
              {Object.entries(LIBELLES_SECTEURS).map(([c, l]) => (
                <option key={c} value={c}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </Champ>
        <Champ id={id("taille")} libelle="Taille de l'entreprise (facultatif)">
          {(p) => (
            <select {...p} value={s.taille} onChange={(e) => maj("taille", e.target.value)} className={CLASSE_CHAMP}>
              <option value="">Non précisée</option>
              {["TPE", "PME", "ETI"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </Champ>
      </div>

      <Champ id={id("cible")} libelle="Pour qui" aide="La personne à qui s'adresse la vidéo." max={160} valeur={s.cible} enFaute={fautes.has("cible")}>
        {(p) => <input {...p} type="text" value={s.cible} maxLength={160} onChange={(e) => maj("cible", e.target.value)} className={CLASSE_CHAMP} />}
      </Champ>
      <Champ id={id("promesse")} libelle="Promesse" aide="8 mots au plus, avec un point final, sans point d'interrogation." max={100} valeur={s.promesse} enFaute={fautes.has("promesse")}>
        {(p) => <input {...p} type="text" value={s.promesse} maxLength={100} onChange={(e) => maj("promesse", e.target.value)} className={CLASSE_CHAMP} />}
      </Champ>
      <Champ id={id("sujet")} libelle="De quoi parle la vidéo" aide="Le sujet en 8 mots au plus : l'accroche le dit." max={100} valeur={s.sujet} enFaute={fautes.has("sujet")}>
        {(p) => <input {...p} type="text" value={s.sujet} maxLength={100} onChange={(e) => maj("sujet", e.target.value)} className={CLASSE_CHAMP} />}
      </Champ>
      <Champ id={id("scene")} libelle="La scène, au présent, sans nom ni chiffre" aide="Ce qui se passe avant : une situation, pas un client réel." max={260} valeur={s.scene} enFaute={fautes.has("scene")}>
        {(p) => <textarea {...p} rows={4} value={s.scene} maxLength={260} onChange={(e) => maj("scene", e.target.value)} className={CLASSE_CHAMP} />}
      </Champ>
      <Champ id={id("exemple")} libelle="L'exemple suivi" aide="La chose que la vidéo suit du début à la fin (« ce devis envoyé… »)." max={80} valeur={s.exemple} enFaute={fautes.has("exemple")}>
        {(p) => <input {...p} type="text" value={s.exemple} maxLength={80} onChange={(e) => maj("exemple", e.target.value)} className={CLASSE_CHAMP} />}
      </Champ>
      <Champ id={id("taches")} libelle="Ce qui se fait à la main aujourd'hui" aide="Une tâche par ligne, de 2 à 6, 6 mots au plus chacune." enFaute={fautes.has("taches")}>
        {(p) => <textarea {...p} rows={4} value={s.taches} onChange={(e) => maj("taches", e.target.value)} className={CLASSE_CHAMP} />}
      </Champ>

      <fieldset className="space-y-4">
        <legend className="mb-1.5 text-sm font-semibold text-texte-doux">
          Les étapes (de {ETAPES_MIN} à {ETAPES_MAX})
        </legend>
        {s.etapes.map((e, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-trait bg-surface-2 p-4">
            <p className="text-[15px] font-semibold text-texte">Étape {i + 1}</p>
            <Champ id={id(`etape-${i}`)} libelle="Ce qui se passe" aide="Une phrase, 12 mots au plus." max={120} valeur={e.ligne} enFaute={fautes.has(`etape-${i}`)}>
              {(p) => <input {...p} type="text" value={e.ligne} maxLength={120} onChange={(x) => majEtape(i, { ligne: x.target.value })} className={CLASSE_CHAMP} />}
            </Champ>
            <Champ id={id(`etape-${i}-titre`)} libelle="Nom court (3 mots, facultatif)" aide="Sinon, les premiers mots de la phrase.">
              {(p) => <input {...p} type="text" value={e.titre} maxLength={60} onChange={(x) => majEtape(i, { titre: x.target.value })} className={CLASSE_CHAMP} />}
            </Champ>
            <Champ id={id(`etape-${i}-objet`)} libelle="À l'écran" aide="Laissez « Choisi pour vous » : l'image est tirée de la phrase.">
              {(p) => (
                <select {...p} value={e.objet} onChange={(x) => majEtape(i, { objet: x.target.value as EtapeSaisie["objet"] })} className={CLASSE_CHAMP}>
                  <option value="">Choisi pour vous</option>
                  {OBJETS_CHOIX.map((o) => (
                    <option key={o} value={o}>
                      {LIBELLES_OBJETS[o]}
                    </option>
                  ))}
                </select>
              )}
            </Champ>
            <Champ id={id(`etape-${i}-detail`)} libelle="Précision (facultatif)" aide="Un peu plus de détail, sans chiffre." max={300} valeur={e.detail}>
              {(p) => <textarea {...p} rows={2} value={e.detail} maxLength={300} onChange={(x) => majEtape(i, { detail: x.target.value })} className={CLASSE_CHAMP} />}
            </Champ>
            {s.etapes.length > ETAPES_MIN && (
              <Bouton variante="fantome" disabled={attente} onClick={() => setS((x) => ({ ...x, etapes: x.etapes.filter((_, j) => j !== i) }))}>
                Retirer l&apos;étape {i + 1}
              </Bouton>
            )}
          </div>
        ))}
        {s.etapes.length < ETAPES_MAX && (
          <Bouton variante="secondaire" disabled={attente} onClick={() => setS((x) => ({ ...x, etapes: [...x.etapes, etapeVide()] }))}>
            Ajouter une étape
          </Bouton>
        )}
      </fieldset>

      <Champ id={id("resteHumain")} libelle="Ce qui reste humain" aide="Ce qui ne s'automatise pas : 11 mots au plus, sans sigle. Dit mot pour mot dans la vidéo." max={200} valeur={s.resteHumain} enFaute={fautes.has("resteHumain")}>
        {(p) => <input {...p} type="text" value={s.resteHumain} maxLength={200} onChange={(e) => maj("resteHumain", e.target.value)} className={CLASSE_CHAMP} />}
      </Champ>
      <Champ id={id("apres")} libelle="…et vient après l'étape numéro" aide={`De 1 à ${s.etapes.length}.`}>
        {(p) => <input {...p} type="number" inputMode="numeric" min={1} max={s.etapes.length} value={s.apres} onChange={(e) => maj("apres", e.target.value)} className={CLASSE_CHAMP} />}
      </Champ>
      <Champ id={id("resultat")} libelle="Résultat" aide="Ce que le client obtient : 13 mots au plus, sans chiffre." max={200} valeur={s.resultat} enFaute={fautes.has("resultat")}>
        {(p) => <input {...p} type="text" value={s.resultat} maxLength={200} onChange={(e) => maj("resultat", e.target.value)} className={CLASSE_CHAMP} />}
      </Champ>
      <Champ id={id("mot")} libelle="Mot à commenter" aide="De 2 à 24 lettres ou chiffres, sans espace. Il doit être différent de celui des autres cas." enFaute={fautes.has("mot")}>
        {(p) => <input {...p} type="text" value={s.mot} maxLength={24} autoCapitalize="characters" onChange={(e) => maj("mot", e.target.value)} className={CLASSE_CHAMP} />}
      </Champ>

      <Champ id={id("script")} libelle="Mon script (facultatif)" aide={AIDE_SCRIPT} max={4000} valeur={s.script} enFaute={fautes.has("script")}>
        {(p) => <textarea {...p} rows={8} maxLength={4000} spellCheck value={s.script} onChange={(e) => maj("script", e.target.value)} className={CLASSE_CHAMP} />}
      </Champ>

      <label className="flex min-h-11 items-center gap-3 text-[15px] text-texte">
        <input type="checkbox" checked={s.valider} onChange={(e) => maj("valider", e.target.checked)} className="size-5" />
        Je valide ce cas (sinon il reste dans « À valider »)
      </label>

      <div ref={liste} tabIndex={-1} className="space-y-3 outline-none">
        {refus.length > 0 && (
          <div role="alert" className="space-y-2 rounded-2xl border border-brique/40 bg-brique-doux px-4 py-3">
            <p className="text-[15px] font-semibold text-texte">Ce cas ne passe pas encore :</p>
            <ul className="space-y-1 p-0">
              {refus.map((r, i) => (
                <li key={i} className="list-none text-[15px] text-texte">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}
        {ressemble && (
          <div role="status" className="space-y-2 rounded-2xl border border-ambre/40 bg-ambre-doux px-4 py-3">
            <p className="text-[15px] font-semibold text-texte">Ce cas ressemble à : {ressemble.map((r) => r.titre).join(" · ")}</p>
            <p className="text-[13px] text-texte-doux">Ce n&apos;est qu&apos;un avertissement : vous pouvez l&apos;ajouter quand même.</p>
            <Bouton chargement={attente} disabled={attente} onClick={() => ajouter(true)}>
              Ajouter quand même
            </Bouton>
          </div>
        )}
      </div>
      {erreur && (
        <p role="alert" className="text-sm text-brique">
          {erreur}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Bouton type="submit" chargement={attente} disabled={attente}>
          Ajouter le cas
        </Bouton>
        <Link href="/cas-concret" className="inline-flex min-h-11 items-center rounded-sm px-3 text-[15px] font-semibold text-texte-doux underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-vif">
          Annuler
        </Link>
      </div>
    </form>
  );
}
