const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(path.join(__dirname, 'src'));
let modified = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // We want to wrap uses of VITE_API_URL to strip 'undefined' strings safely without breaking the app.
    // Instead of complex AST, we can just prepend a small global sanitizer right before the URL assignment.
    // Actually, string replacement of `(import.meta as any).env?.VITE_API_URL` to `((import.meta as any).env?.VITE_API_URL || '').replace('undefined', '')` 
    // is safe and robust!
    
    content = content.replace(/\(import\.meta( as any)?\)\.env\?\.VITE_API_URL/g, "String((import.meta as any).env?.VITE_API_URL || '').replace('undefined', '')");
    content = content.replace(/import\.meta\.env\.VITE_API_URL/g, "String((import.meta as any).env?.VITE_API_URL || '').replace('undefined', '')");
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        modified++;
        console.log(`Patched ${path.basename(file)}`);
    }
}

console.log(`Successfully patched ${modified} files.`);
