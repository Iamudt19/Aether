$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting Aether Carbon Local Stack..." -ForegroundColor Cyan

# === Step 1: Launch Hardhat Node in a new window ===
Write-Host "Starting Hardhat Node..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\aether\contracts'; npx hardhat node"

# === Step 2: Wait for Hardhat node to be ready ===
Write-Host "Waiting 8 seconds for Hardhat node to initialize..." -ForegroundColor DarkYellow
Start-Sleep -Seconds 8

# === Step 3: Deploy contracts to local hardhat node ===
Write-Host "Deploying contracts to localhost:8545..." -ForegroundColor Yellow
Push-Location "$root\aether\contracts"
$deployOutput = npx hardhat run scripts/deploy.js --network localhost 2>&1
$deployOutput | Write-Host
Pop-Location

# Extract deployed address
$contractLine = $deployOutput | Select-String "AetherCarbon deployed to:"
if ($contractLine) {
    $contractAddress = ($contractLine -split ": ")[1].Trim()
    Write-Host "[OK] Contract deployed at: $contractAddress" -ForegroundColor Green

    # Update backend .env with new contract address
    $backendEnv = "$root\aether\backend\.env"
    (Get-Content $backendEnv) -replace "CONTRACT_ADDRESS=.*", "CONTRACT_ADDRESS=$contractAddress" | Set-Content $backendEnv
    Write-Host "[OK] Updated backend/.env with CONTRACT_ADDRESS" -ForegroundColor Green

    # Update / create frontend .env.local
    $frontendEnv = "$root\aether\frontend\.env.local"
    $envLines = @(
        "NEXT_PUBLIC_CONTRACT_ADDRESS=$contractAddress",
        "NEXT_PUBLIC_CHAIN_ID=31337",
        "NEXT_PUBLIC_RPC_URL=http://localhost:8545",
        "NEXT_PUBLIC_BACKEND_URL=http://localhost:3001"
    )
    $envLines | Set-Content $frontendEnv
    Write-Host "[OK] Written frontend/.env.local" -ForegroundColor Green
} else {
    Write-Host "[WARN] Could not extract contract address - check deploy output above." -ForegroundColor Red
}

# === Step 4: Start Backend ===
Write-Host "Starting Backend (http://localhost:3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\aether\backend'; npm run dev"

# === Step 5: Start Frontend ===
Write-Host "Starting Frontend (http://localhost:3002)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\aether\frontend'; npm run dev"

Write-Host ""
Write-Host "[OK] All services launched!" -ForegroundColor Green
Write-Host "   Frontend  -> http://localhost:3002" -ForegroundColor Cyan
Write-Host "   Backend   -> http://localhost:3001" -ForegroundColor Cyan
Write-Host "   Hardhat   -> http://localhost:8545" -ForegroundColor Cyan
Write-Host ""
Write-Host "Check the newly opened terminal windows for logs." -ForegroundColor DarkGray
