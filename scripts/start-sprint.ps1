param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$SprintName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail {
    param([string]$Message)
    Write-Error $Message
    exit 1
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,
        [string]$ErrorMessage = "La commande Git a echoue."
    )

    & git @Args
    if ($LASTEXITCODE -ne 0) {
        Fail "$ErrorMessage (git $($Args -join ' '))"
    }
}

# Validation du nom de sprint
if ([string]::IsNullOrWhiteSpace($SprintName)) {
    Fail "Le nom de sprint est obligatoire et ne peut pas etre vide."
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Fail "Git est introuvable. Installez Git et verifiez qu'il est dans le PATH."
}

# Verification du depot Git
$insideRepo = & git rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -ne 0 -or "$insideRepo".Trim() -ne 'true') {
    Fail "Le repertoire courant n'est pas un depot Git valide."
}

# Verification du working tree
$workingTreeState = (& git status --porcelain)
if ($LASTEXITCODE -ne 0) {
    Fail "Impossible de verifier l'etat du working tree."
}

if (-not [string]::IsNullOrWhiteSpace(($workingTreeState | Out-String))) {
    Fail "Le working tree n'est pas propre. Committez ou stashez vos changements avant de demarrer le sprint."
}

Invoke-Git -Args @('switch', 'main') -ErrorMessage "Impossible de basculer sur main."
Invoke-Git -Args @('pull', '--ff-only', 'origin', 'main') -ErrorMessage "Impossible de mettre a jour main depuis origin/main."

# Construction du nom de branche
$normalized = $SprintName.Trim()
$branchName = if ($normalized.StartsWith('feat/')) { $normalized } else { "feat/$normalized" }

# Verification locale de l'existence de la branche
& git show-ref --verify --quiet "refs/heads/$branchName"
if ($LASTEXITCODE -eq 0) {
    Fail "La branche locale '$branchName' existe deja. Choisissez un autre nom."
}
if ($LASTEXITCODE -ne 1) {
    Fail "Erreur inattendue pendant la verification de la branche locale '$branchName'."
}

# Verification distante si possible
$remoteExistsChecked = $true
& git remote get-url origin 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
    $remoteExistsChecked = $false
    Write-Warning "Remote origin introuvable. Verification distante de la branche ignoree."
}

if ($remoteExistsChecked) {
    & git ls-remote --exit-code --heads origin $branchName 1>$null 2>$null
    if ($LASTEXITCODE -eq 0) {
        Fail "La branche '$branchName' existe deja sur origin. Choisissez un autre nom."
    }
    elseif ($LASTEXITCODE -ne 2) {
        Fail "Impossible de verifier l'existence de '$branchName' sur origin."
    }
}

Invoke-Git -Args @('switch', '-c', $branchName) -ErrorMessage "Impossible de creer la branche '$branchName'."

Write-Host "Branche creee avec succes : $branchName"
