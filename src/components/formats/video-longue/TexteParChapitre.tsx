"use client";

import { useMemo, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { Icone } from "@/components/ui/Icone";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { RemarquesFiche } from "@/components/formats/vitrines/RemarquesFiche";
import { titreDeduit, titreManquant } from "@/moteurs/montage-video-longue/decoupage";
import { dureeSecDuTexte, formaterDuree } from "./PlanChapitres";

/** Une version d'un chapitre : A ou B (écrites pour l'utilisateur), ou « colle » (son propre texte, seule version). */
export interface VersionChapitre {
  cle: "A" | "B" | "colle";
  phrases: string[];
}

export interface ChapitreAvecVersions {
  id: string;
  titre: string;
  versions: VersionChapitre[];
}

/** Ce que l'utilisateur a validé pour un chapitre : sa version, phrase par phrase. Rien d'autre ne sera lu à voix haute. */
export interface ChapitreValide {
  id: string;
  titre: string;
  phrases: string[];
}

/** Au-delà de 90 s, un chapitre peut être long à suivre : une remarque, jamais un blocage. */
export const SEUIL_CHAPITRE_LONG_SEC = 90;

const nomVersion = (cle: VersionChapitre["cle"]) => (cle === "colle" ? "Votre texte" : `Version ${cle}`);

interface EtatChapitre {
  cle?: VersionChapitre["cle"];
  /** `null` = phrase retirée. */
  phrases: (string | null)[];
  modifie: number | null;
  valide: boolean;
}

/** Titre montré : celui de l'utilisateur, sinon déduit du texte (jamais « Chapitre N »). */
const titreAffiche = (c: ChapitreAvecVersions): string => (titreManquant(c.titre) ? titreDeduit((c.versions[0]?.phrases ?? []).join(" ")) || c.titre.trim() : c.titre.trim());

export function remarqueChapitre(phrases: readonly (string | null)[]): string[] {
  const texte = phrases.filter((p): p is string => p !== null).join(" ");
  return dureeSecDuTexte(texte) > SEUIL_CHAPITRE_LONG_SEC ? ["Ce chapitre dépasse 1 min 30 : il sera peut-être long à suivre."] : [];
}

export function TexteParChapitre({
  chapitres,
  onValiderTout,
  onEnregistrer,
  onRetour,
}: {
  chapitres: ChapitreAvecVersions[];
  onValiderTout: (texte: ChapitreValide[]) => void;
  onEnregistrer?: () => void;
  onRetour?: () => void;
}) {
  const depart = useMemo<EtatChapitre[]>(
    () =>
      chapitres.map((c) => {
        const seule = c.versions.length === 1 ? c.versions[0] : undefined;
        return { cle: seule?.cle, phrases: seule ? [...seule.phrases] : [], modifie: null, valide: false };
      }),
    [chapitres],
  );
  const [etats, setEtats] = useState<EtatChapitre[]>(depart);
  const maj = (i: number, f: (e: EtatChapitre) => EtatChapitre) => setEtats((cur) => cur.map((e, k) => (k === i ? f(e) : e)));
  const tousValides = chapitres.length > 0 && etats.length === chapitres.length && etats.every((e) => e.valide);

  return (
    <section className="space-y-5" aria-label="Le texte, chapitre par chapitre">
      <p className="text-base font-semibold text-texte">Aucune voix n&apos;est payée tant que vous n&apos;avez pas validé tous les chapitres.</p>
      <ol aria-label="Sommaire" className="flex flex-wrap gap-2">
        {chapitres.map((c, i) => (
          <li key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-trait bg-surface-1 px-3 py-1.5 text-sm text-texte">
            {etats[i]?.valide && (
              <>
                <Icone nom="coche" size={16} className="text-sauge" aria-hidden="true" />
                <span className="sr-only">Validé : </span>
              </>
            )}
            {i + 1}. {titreAffiche(c)}
          </li>
        ))}
      </ol>
      <ol className="space-y-4">
        {chapitres.map((c, i) => {
          const e = etats[i];
          if (!e) return null;
          const autre = c.versions.find((v) => v.cle !== e.cle && v.cle !== "colle");
          return (
            <li key={c.id}>
              <Carte className="space-y-3">
                <h3 className="text-base font-semibold text-texte">
                  {i + 1}. {titreAffiche(c)}
                </h3>
                {c.versions.length > 1 && (
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Choisir la version">
                    {c.versions.map((v) => (
                      <Bouton
                        key={v.cle}
                        type="button"
                        variante={e.cle === v.cle ? "principal" : "secondaire"}
                        sansDecompte
                        onClick={() => maj(i, () => ({ cle: v.cle, phrases: [...v.phrases], modifie: null, valide: false }))}
                      >
                        {`Choisir la version ${v.cle}`}
                      </Bouton>
                    ))}
                  </div>
                )}
                {e.cle === "colle" && <p className="text-sm text-texte-doux">Votre texte : une seule version, la vôtre.</p>}
                {e.cle && (
                  <ol className="space-y-2">
                    {e.phrases.map((p, k) => (
                      <li key={k} className={`rounded-xl border border-trait p-3 text-sm ${p === null ? "bg-surface-2 text-texte-doux line-through" : "bg-surface-1 text-texte"}`}>
                        {e.modifie === k && p !== null ? (
                          <ZoneTexte libelle={`Phrase ${k + 1}`} libelleMasque value={p} onChange={(ev) => maj(i, (x) => ({ ...x, valide: false, phrases: x.phrases.map((q, m) => (m === k ? ev.target.value : q)) }))} />
                        ) : (
                          <p>{p ?? "Phrase retirée"}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Bouton type="button" variante="secondaire" onClick={() => maj(i, (x) => ({ ...x, modifie: null, valide: false, phrases: x.phrases.map((q, m) => (m === k && q === null ? (c.versions.find((v) => v.cle === x.cle)?.phrases[k] ?? q) : q)) }))}>
                            Garder
                          </Bouton>
                          <Bouton type="button" variante="secondaire" onClick={() => maj(i, (x) => ({ ...x, modifie: k, valide: false }))}>
                            Modifier
                          </Bouton>
                          <Bouton type="button" variante="danger" onClick={() => maj(i, (x) => ({ ...x, modifie: null, valide: false, phrases: x.phrases.map((q, m) => (m === k ? null : q)) }))}>
                            Retirer
                          </Bouton>
                          {autre?.phrases[k] !== undefined && (
                            <Bouton type="button" variante="secondaire" onClick={() => maj(i, (x) => ({ ...x, modifie: null, valide: false, phrases: x.phrases.map((q, m) => (m === k ? (autre.phrases[k] ?? q) : q)) }))}>
                              Prendre la phrase de l&apos;autre version
                            </Bouton>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                {e.cle && <p className="text-sm text-texte-doux">{nomVersion(e.cle)} · ≈ {formaterDuree(dureeSecDuTexte(e.phrases.filter((p): p is string => p !== null).join(" ")))}</p>}
                <RemarquesFiche remarques={remarqueChapitre(e.phrases)} />
                <Bouton type="button" variante="secondaire" disabled={!e.cle} onClick={() => maj(i, (x) => ({ ...x, modifie: null, valide: true }))}>
                  {e.valide ? "Chapitre validé" : "Valider ce chapitre"}
                </Bouton>
              </Carte>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-3">
        {onRetour && (
          <Bouton type="button" variante="secondaire" onClick={onRetour}>
            Revenir aux chapitres
          </Bouton>
        )}
        <Bouton
          type="button"
          disabled={!tousValides}
          onClick={() => onValiderTout(chapitres.map((c, i) => ({ id: c.id, titre: c.titre, phrases: etats[i].phrases.filter((p): p is string => p !== null && p.trim() !== "") })))}
        >
          Valider tout le texte
        </Bouton>
        {onEnregistrer && (
          <Bouton type="button" variante="secondaire" onClick={onEnregistrer}>
            Enregistrer sans lancer
          </Bouton>
        )}
      </div>
    </section>
  );
}
