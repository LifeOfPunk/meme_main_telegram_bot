#!/usr/bin/env node
import { readdir } from 'fs/promises';
import { join, extname } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const TARGET_DIRS = ['src', 'scripts', 'test', 'tests', 'utils'];
const ROOT_FILES = ['alltest.js'];

async function getJsFiles(dir) {
    const files = [];
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && entry.name !== '.git') {
                    files.push(...(await getJsFiles(fullPath)));
                }
            } else if (entry.isFile() && (extname(entry.name) === '.js' || extname(entry.name) === '.mjs' || extname(entry.name) === '.cjs')) {
                // Ignore backup files like .js.bak
                if (!entry.name.includes('.bak') && !entry.name.includes('.save')) {
                    files.push(fullPath);
                }
            }
        }
    } catch {
        // Directory may not exist
    }
    return files;
}

async function checkFile(filePath) {
    try {
        await execFileAsync(process.execPath, ['--check', filePath]);
        return { file: filePath, ok: true };
    } catch (err) {
        return { file: filePath, ok: false, error: err.stderr || err.message };
    }
}

async function main() {
    console.log('🔍 Checking JavaScript syntax across codebase...\n');

    let allFiles = [...ROOT_FILES];
    for (const dir of TARGET_DIRS) {
        const dirFiles = await getJsFiles(dir);
        allFiles.push(...dirFiles);
    }

    console.log(`Found ${allFiles.length} JavaScript files to validate.\n`);

    let failed = 0;
    for (const file of allFiles) {
        const result = await checkFile(file);
        if (result.ok) {
            console.log(`  ✅ ${file}`);
        } else {
            console.error(`  ❌ ${file}`);
            console.error(result.error);
            failed++;
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (failed > 0) {
        console.error(`❌ Syntax check FAILED: ${failed} file(s) have syntax errors.`);
        process.exit(1);
    } else {
        console.log(`✅ Syntax check PASSED: all ${allFiles.length} files are syntactically valid.`);
        process.exit(0);
    }
}

main().catch((err) => {
    console.error('Fatal error running syntax check:', err);
    process.exit(1);
});
