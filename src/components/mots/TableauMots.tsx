"use client";

// MG-4 — tableau des mots : une ligne par mot. Présentation pure : données et gestes arrivent en propriétés,
// aucun service serveur, aucun appel réseau. Changer la cible passe toujours par une confirmation.
import { useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Carte } from "@/components/ui/Carte";
import { EtatVide } from "@/components/ui/EtatVide";
import { Pastille } from "@/components/ui/Pastille";
import type {
  ElementCatalogue,
  Fenetres,
  LigneTableauMot,
  VueTableauMots,
} from "@/domaine/guide-reseau/cibles-contrat";
import { ChoixCibleMot } from "./ChoixCibleMot";
import { LIBELLES_MOTS as L } from "./tableau-mots-libelles";

export interface ProprietesTableauMots {
  vue: VueTableauMots;
  /** Catalogue des cibles, pour proposer un autre choix. */
  catalogue: readonly ElementCatalogue[];
  /** Appelée seulement après la confirmation de l'opérateur. */
  onChangerCible: (mot: string, codeCible: string) => void;
}

/** Une ligne par mot : les réseaux d'un même mot sont regroupés, la cible est la même pour tous. */
function grouperParMot(
  lignes: readonly LigneTableauMot[],
): { mot: string; principale: LigneTableauMot; reseaux: string[] }[] {
  const groupes = new Map<
    string,
    { mot: string; principale: LigneTableauMot; reseaux: string[] }
  >();
  for (const l of lignes) {
    const g = groupes.get(l.mot) ?? { mot: l.mot, principale: l, reseaux: [] };
    if (!g.reseaux.includes(L.reseau[l.reseau]))
      g.reseaux.push(L.reseau[l.reseau]);
    // Une ligne en alerte l'emporte pour que le problème reste visible.
    if (
      !groupes.has(l.mot) ||
      ((l.cibleIntrouvable || l.divergent) &&
        !(g.principale.cibleIntrouvable || g.principale.divergent))
    )
      g.principale = l;
    groupes.set(l.mot, g);
  }
  return [...groupes.values()];
}

function Chiffres({ f, auMoins }: { f: Fenetres; auMoins?: boolean }) {
  const v = (n: number) => (auMoins ? L.auMoins(n) : String(n));
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-2 text-xs text-texte-doux">
      <dt>{L.fenetres.j7}</dt>
      <dd className="m-0 font-semibold text-texte">{v(f.j7)}</dd>
      <dt>{L.fenetres.j30}</dt>
      <dd className="m-0 font-semibold text-texte">{v(f.j30)}</dd>
      <dt>{L.fenetres.total}</dt>
      <dd className="m-0 font-semibold text-texte">{v(f.total)}</dd>
    </dl>
  );
}

export function TableauMots({
  vue,
  catalogue,
  onChangerCible,
}: ProprietesTableauMots) {
  // Mot en cours de changement, puis (après un choix) la cible à confirmer.
  const [motEnEdition, setMotEnEdition] = useState<string | null>(null);
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);
  const lignes = grouperParMot(vue.lignes);
  const cibleChoisie =
    aConfirmer === null
      ? null
      : (catalogue.find((e) => e.code === aConfirmer) ?? null);

  const fermer = () => {
    setMotEnEdition(null);
    setAConfirmer(null);
  };
  const confirmer = () => {
    if (motEnEdition === null || aConfirmer === null) return;
    onChangerCible(motEnEdition, aConfirmer);
    fermer();
  };

  return (
    <div className="flex flex-col gap-3" data-ecran="tableau-mots">
      <p className="text-sm text-texte-doux">{L.aide}</p>
      {vue.indisponible && (
        <p role="alert" className="text-sm font-semibold text-brique">
          {L.siteSilencieux}
        </p>
      )}
      {vue.ignores > 0 && (
        <p className="text-sm text-texte-doux">
          {L.lignesIgnorees(vue.ignores)}
        </p>
      )}

      {lignes.length === 0 ? (
        <EtatVide
          icone="bouclier"
          titre={L.aucunMot}
          phrase={L.aucunMotAide}
          compact
        />
      ) : (
        <div className="overflow-x-auto">
          <div
            role="table"
            aria-label={L.legendeTableau}
            className="grid min-w-[880px] grid-cols-[110px_minmax(180px,1.4fr)_120px_1fr_1fr_1fr_90px_150px] gap-x-3 gap-y-2"
          >
            <div
              role="row"
              className="contents text-xs font-semibold text-texte-doux"
            >
              <div role="columnheader">{L.colonnes.mot}</div>
              <div role="columnheader">{L.colonnes.cible}</div>
              <div role="columnheader">{L.colonnes.reseaux}</div>
              <div role="columnheader">{L.colonnes.ecrits}</div>
              <div role="columnheader" title={L.aideEnvoyes}>
                {L.colonnes.envoyes}
              </div>
              <div role="columnheader" title={L.aideGagnees}>
                {L.colonnes.gagnees}
              </div>
              <div role="columnheader">{L.colonnes.etat}</div>
              <div role="columnheader">{L.colonnes.action}</div>
            </div>
            {lignes.map(({ mot, principale: l, reseaux }) => (
              <div key={mot} role="row" className="contents" data-mot={mot}>
                <div
                  role="cell"
                  className="text-[15px] font-semibold text-texte"
                >
                  {mot}
                </div>
                <div
                  role="cell"
                  className="flex min-w-0 flex-col gap-1 text-sm text-texte"
                >
                  {l.cible ? (
                    <>
                      <span className="font-semibold">{l.cible.titre}</span>
                      <span className="flex flex-wrap gap-1">
                        <Pastille>{L.typeElement[l.cible.type]}</Pastille>
                        {l.cible.test && (
                          <Pastille ton="ambre">{L.badgeTest}</Pastille>
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="text-texte-doux">{L.sansCible}</span>
                  )}
                  {l.cibleIntrouvable && (
                    <p
                      role="alert"
                      className="text-xs font-semibold text-brique"
                    >
                      {L.alerteIntrouvable}
                    </p>
                  )}
                  {l.divergent && (
                    <p
                      role="alert"
                      className="text-xs font-semibold text-ambre"
                    >
                      {L.alerteDivergent}
                    </p>
                  )}
                </div>
                <div role="cell" className="text-sm text-texte">
                  {reseaux.join(", ")}
                </div>
                {l.stats ? (
                  <>
                    <div role="cell">
                      <Chiffres f={l.stats.ecrits} />
                    </div>
                    <div role="cell">
                      <Chiffres f={l.stats.envoyes} />
                    </div>
                    <div role="cell">
                      <Chiffres f={l.stats.suivent} auMoins />
                    </div>
                  </>
                ) : (
                  <div
                    role="cell"
                    className="text-sm text-texte-doux"
                    style={{ gridColumn: "span 3" }}
                  >
                    {L.pasDeChiffres}
                  </div>
                )}
                <div role="cell">
                  <Pastille ton={l.actif ? "sauge" : "neutre"}>
                    {l.actif ? L.etatActif : L.etatPause}
                  </Pastille>
                </div>
                <div role="cell">
                  <Bouton
                    variante="secondaire"
                    aria-label={L.changerCibleDuMot(mot)}
                    onClick={() => {
                      setMotEnEdition(mot);
                      setAConfirmer(null);
                    }}
                  >
                    {L.changerCible}
                  </Bouton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-xs text-texte-doux">{L.suivreLeCompte}</p>

      {motEnEdition !== null && (
        <Carte data-carte="changer-cible">
          <h3 className="text-base text-texte">
            {L.changerCibleDuMot(motEnEdition)}
          </h3>
          <div className="mt-2">
            <ChoixCibleMot
              catalogue={catalogue}
              valeur={aConfirmer}
              onChoisir={setAConfirmer}
            />
          </div>
          {aConfirmer !== null && (
            <div
              role="group"
              aria-label={L.confirmation.groupe}
              className="mt-3 flex flex-col gap-2"
              data-confirmation
            >
              <p className="text-sm font-semibold text-texte">
                {L.confirmation.titre(
                  motEnEdition,
                  cibleChoisie?.titre ?? aConfirmer,
                )}
              </p>
              <p className="text-sm text-texte-doux">
                {L.confirmation.rassurance}
              </p>
              <div className="flex flex-wrap gap-2">
                <Bouton onClick={confirmer}>{L.confirmation.confirmer}</Bouton>
                <Bouton variante="fantome" onClick={fermer}>
                  {L.confirmation.annuler}
                </Bouton>
              </div>
            </div>
          )}
          {aConfirmer === null && (
            <Bouton className="mt-3" variante="fantome" onClick={fermer}>
              {L.confirmation.annuler}
            </Bouton>
          )}
        </Carte>
      )}
    </div>
  );
}
