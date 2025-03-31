# Enable execution of scripts if not already enabled
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

Write-Host "Starting installation script..." -ForegroundColor Green

# Function to check if a command exists
function Command-Exists {
    param ($cmd)
    return [bool](Get-Command $cmd -ErrorAction SilentlyContinue)
}

# Install Python 3.11.9
Write-Host "Installing Python 3.11.9..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutFile "python-installer.exe"
Start-Process -FilePath "python-installer.exe" -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1" -Wait
Remove-Item "python-installer.exe" -Force
Write-Host "Python 3.11.9 installed successfully!" -ForegroundColor Green

# Upgrade pip
Write-Host "Upgrading pip..." -ForegroundColor Cyan
python -m ensurepip
python -m pip install --upgrade pip

# Install Node.js if not installed
if (-Not (Command-Exists "node")) {
    Write-Host "Node.js is not installed! Installing..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v18.18.2/node-v18.18.2-x64.msi" -OutFile "node-installer.msi"
    Start-Process -FilePath "msiexec.exe" -ArgumentList "/i node-installer.msi /quiet /norestart" -Wait
    Remove-Item "node-installer.msi" -Force
    Write-Host "Node.js installed successfully!" -ForegroundColor Green
} else {
    Write-Host "Node.js is already installed: $(node -v)" -ForegroundColor Green
}

# Install npm dependencies
Write-Host "Installing npm packages..." -ForegroundColor Cyan
npm install

# Install Python dependencies
if (Test-Path "requirements.txt") {
    Write-Host "Installing Python packages from requirements.txt..." -ForegroundColor Cyan
    python -m pip install -r requirements.txt
} else {
    Write-Host "requirements.txt not found. Skipping Python package installation." -ForegroundColor Yellow
}

Write-Host "Installation complete!" -ForegroundColor Green
