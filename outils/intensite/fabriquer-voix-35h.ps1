# Voix du TEST D'ÉCOUTE « 35 heures dans Excel » (lot intensité · bruitages, 02/10) : voix de synthèse de Windows
# (Hortense, fr-FR), aucun service payant, début de chaque mot (événement SpeakProgress) comme `word_timestamps`.
# Extrait du script (accroche, promesse, relance, solution, début de la preuve), ≈ 45 s.
# Usage : powershell -File outils/intensite/fabriquer-voix-35h.ps1
param([string]$Sortie = "outils/intensite/voix-35h")

Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice("Microsoft Hortense Desktop")
$s.Rate = 2

$ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">
Une personne à temps plein.<break time="200ms"/> Trente-cinq heures par semaine.<break time="200ms"/> Juste pour remplir des tableaux Excel.<break time="300ms"/>
Je vais vous raconter comment un de nos clients est passé de trente-cinq heures à zéro.<break time="200ms"/> En moins d'un mois.<break time="300ms"/>
Chaque jour, la même routine : exporter, copier, coller, vérifier, et recommencer.<break time="200ms"/> Une seule erreur de formule, et tous les chiffres sont faux.<break time="300ms"/>
Sauf qu'on ne s'est pas arrêtés là.<break time="300ms"/>
On lui a livré une console complète, avec un tableau de bord de toutes ses données.<break time="200ms"/>
Et s'il y a un problème ?<break time="150ms"/> Une alerte arrive directement sur son téléphone.<break time="300ms"/>
Avant : trente-cinq heures par semaine.<break time="200ms"/> Aujourd'hui : zéro heure.<break time="200ms"/> Et cent pour cent des données, en temps réel.
</speak>
"@

$mots = New-Object System.Collections.ArrayList
$s.add_SpeakProgress({ param($o, $e) [void]$mots.Add([pscustomobject]@{ mot = $e.Text; debutSec = [math]::Round($e.AudioPosition.TotalSeconds, 3) }) })

$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile("$Sortie.16k.wav", $format)
$s.SpeakSsml($ssml)
$s.SetOutputToNull()
$s.Dispose()

& ffmpeg -y -loglevel error -i "$Sortie.16k.wav" -ar 48000 -ac 1 -c:a pcm_s16le "$Sortie.wav"
Remove-Item "$Sortie.16k.wav"
$mots | ConvertTo-Json | Out-File -Encoding utf8 "$Sortie.debuts.json"
Write-Output "Son : $Sortie.wav ; débuts des mots : $Sortie.debuts.json ($($mots.Count) mots)"
