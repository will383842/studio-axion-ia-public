# Fabrique un VRAI fichier son de test avec la voix de synthèse de Windows (Hortense, fr-FR), sans aucun service payant,
# avec le début de chaque mot (événement SpeakProgress), comme la synthèse HeyGen renvoie `word_timestamps`.
# Les fins de mots sont calculées ensuite sur le son lui-même (completer-voix-essai.mjs).
#
# Le texte ENVOYÉ porte les prononciations substituées (« PV » -> « pé vé »), comme le fera le moteur :
# le report des horodatages sur le texte VALIDÉ est ainsi testé sur un vrai son (lot M1, B.4, B.5).
#
# Le son est produit à 16 kHz (la position renvoyée par Windows est juste à cette fréquence), puis passé à 48 kHz.
# Usage : powershell -File outils/voix-essai/fabriquer-voix-essai.ps1 [-Sortie tests/fixtures/voix-essai]
param([string]$Sortie = "tests/fixtures/voix-essai")

Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice("Microsoft Hortense Desktop")
$s.Rate = 1

# Blanc de tête (0,45 s), blancs longs entre les phrases : le nettoyage doit les raccourcir.
$ssml = @"
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="fr-FR">
<break time="450ms"/>Vous recevez un pé vé de cent trente-cinq euros ?<break time="700ms"/>
Surtout, ne le payez pas tout de suite.<break time="550ms"/>
Je vous explique pourquoi, en trois points.<break time="400ms"/>
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
