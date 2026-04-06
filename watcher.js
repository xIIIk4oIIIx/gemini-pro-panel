
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// Domyślna konfiguracja (fallback)
let CONFIG = {
    watchFolder: './',
    outputFile: 'context_bundle.txt',
    allowedExtensions: ['.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json', '.py', '.md'],
    ignorePatterns: ['node_modules', '.git', 'dist', 'build', 'package-lock.json']
};

try {
    if (fs.existsSync('watcher.config.json')) {
        const userConfig = JSON.parse(fs.readFileSync('watcher.config.json', 'utf8'));
        CONFIG = { ...CONFIG, ...userConfig };
    }
    
    // ZABEZPIECZENIE: Zawsze dodaj plik wyjściowy do ignorowanych
    if (!CONFIG.ignorePatterns.includes(CONFIG.outputFile)) {
        CONFIG.ignorePatterns.push(CONFIG.outputFile);
    }
    
} catch (e) {
    console.warn('⚠️ Nie udało się wczytać configu, używam domyślnego.');
}

let debounceTimer;

const mergeFiles = () => {
    console.log('🔄 Wykryto zmiany. Generowanie kontekstu...');
    let fullContent = `--- PROJECT CONTEXT GENERATED AT ${new Date().toLocaleString()} ---\n\n`;
    
    fullContent += `// --- Configuration used: watcher.config.json ---\n`;
    fullContent += JSON.stringify(CONFIG, null, 2) + '\n\n';

    const walkSync = (dir, filelist = []) => {
        const files = fs.readdirSync(dir);
        files.forEach((file) => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (CONFIG.ignorePatterns.some(pattern => filePath.includes(pattern))) return;

            if (stat.isDirectory()) {
                walkSync(filePath, filelist);
            } else {
                if (CONFIG.allowedExtensions.includes(path.extname(file))) {
                    filelist.push(filePath);
                }
            }
        });
        return filelist;
    };

    try {
        const allFiles = walkSync(CONFIG.watchFolder);
        allFiles.forEach(filePath => {
            const content = fs.readFileSync(filePath, 'utf8');
            const relativePath = path.relative('.', filePath).replace(/\\/g, '/');
            fullContent += `\n// ==========================================\n// --- File: ${relativePath} ---\n// ==========================================\n\n${content}\n`;
        });

        fs.writeFileSync(CONFIG.outputFile, fullContent);
        console.log(`✅ Zaktualizowano: ${CONFIG.outputFile} (${allFiles.length} plików)`);
    } catch (err) {
        console.error('❌ Błąd:', err.message);
    }
};

const watcher = chokidar.watch(CONFIG.watchFolder, {
    ignored: (path) => CONFIG.ignorePatterns.some(s => path.includes(s)),
    persistent: true,
    ignoreInitial: true
});

const handleEvent = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => mergeFiles(), 300);
};

watcher.on('all', handleEvent);

console.log(`👀 Watcher uruchomiony. Obserwuję folder: ${CONFIG.watchFolder}`);
console.log(`📝 Plik wynikowy: ${CONFIG.outputFile}`);
console.log(`💡 Edytuj 'watcher.config.json' aby zmienić ustawienia.`);
mergeFiles();
