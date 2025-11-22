# Скрипт для автоматического push на GitHub
# Использование: .\auto-push.ps1

Write-Host "Проверка изменений..." -ForegroundColor Cyan

# Попытка найти git
$gitPath = $null
$possiblePaths = @(
    "git",
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files (x86)\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\GitHubDesktop\resources\app\git\cmd\git.exe"
)

foreach ($path in $possiblePaths) {
    try {
        if ($path -eq "git") {
            $result = Get-Command git -ErrorAction SilentlyContinue
            if ($result) {
                $gitPath = "git"
                break
            }
        } else {
            if (Test-Path $path) {
                $gitPath = $path
                break
            }
        }
    } catch {
        continue
    }
}

if (-not $gitPath) {
    Write-Host "Ошибка: Git не найден. Убедитесь, что Git Desktop установлен." -ForegroundColor Red
    exit 1
}

Write-Host "Git найден: $gitPath" -ForegroundColor Green

# Проверка статуса
& $gitPath status --short | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при проверке статуса git" -ForegroundColor Red
    exit 1
}

# Добавление всех изменений
Write-Host "Добавление изменений..." -ForegroundColor Cyan
& $gitPath add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при добавлении файлов" -ForegroundColor Red
    exit 1
}

# Проверка, есть ли что коммитить
$status = & $gitPath status --porcelain
if ([string]::IsNullOrWhiteSpace($status)) {
    Write-Host "Нет изменений для коммита" -ForegroundColor Yellow
    exit 0
}

# Создание коммита
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$commitMessage = "Auto-commit: $timestamp"
Write-Host "Создание коммита: $commitMessage" -ForegroundColor Cyan
& $gitPath commit -m $commitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Host "Ошибка при создании коммита" -ForegroundColor Red
    exit 1
}

# Push на GitHub
Write-Host "Отправка на GitHub..." -ForegroundColor Cyan
& $gitPath push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "Успешно отправлено на GitHub!" -ForegroundColor Green
} else {
    Write-Host "Ошибка при отправке на GitHub. Возможно, требуется аутентификация." -ForegroundColor Red
    Write-Host "Попробуйте выполнить push через Git Desktop" -ForegroundColor Yellow
    Write-Host "Или проверьте, что токен имеет права 'repo' на https://github.com/settings/tokens" -ForegroundColor Yellow
    exit 1
}

