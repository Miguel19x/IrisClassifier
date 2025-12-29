#!/usr/bin/env pwsh

# Script para reemplazar motion.div con div en Login.tsx y ListsManager.tsx

$files = @(
    "src\pages\Login.tsx",
    "src\pages\ListsManager.tsx"
)

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    
    # Reemplazar motion.div con div
    $content = $content -replace '<motion\.div', '<div'
    $content = $content -replace '</motion\.div>', '</div>'
    
    # Reemplazar motion.button con button
    $content = $content -replace '<motion\.button', '<button'
    $content = $content -replace '</motion\.button>', '</button>'
    
    # Eliminar AnimatePresence
    $content = $content -replace '<AnimatePresence[^>]*>', ''
    $content = $content -replace '</AnimatePresence>', ''
    
    # Eliminar props de Framer Motion (initial, animate, transition, etc.)
    $content = $content -replace '\s+initial=\{[^\}]+\}', ''
    $content = $content -replace '\s+animate=\{[^\}]+\}', ''
    $content = $content -replace '\s+transition=\{[^\}]+\}', ''
    $content = $content -replace '\s+exit=\{[^\}]+\}', ''
    $content = $content -replace '\s+whileHover=\{[^\}]+\}', ''
    $content = $content -replace '\s+whileTap=\{[^\}]+\}', ''
    $content = $content -replace '\s+layoutId="[^"]*"', ''
    
    Set-Content $file $content -NoNewline
}

Write-Host "Reemplazo completado en Login.tsx y ListsManager.tsx"
