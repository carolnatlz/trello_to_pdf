#!/usr/bin/env node
/**
 * Uso:
 *   export TRELLO_KEY="xxxx"
 *   export TRELLO_TOKEN="xxxx"
 *   node trello2pdf.js --txt trello-output.txt --out trello-card.pdf --font "Arial" --keep-md
 */

const fs = require('fs'); // lê arquivos do disco
const fsp = require('fs/promises');
const path = require('path'); // manipula caminhos do sistema
const { execFileSync } = require('child_process'); // executa comandos externos
const IMG_LINK_RE = /\[(?<name>[^\]]+\.(?:png|jpg|jpeg|gif|svg))\]\((?<url>[^)]+)\)/ig; // Links de imagem no estilo Markdown

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { txt: null, out: 'output.pdf', keepMd: false, workdir: null, font: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--txt') out.txt = args[++i];
    else if (a === '--out') out.out = args[++i];
    else if (a === '--keep-md') out.keepMd = true;
    else if (a === '--workdir') out.workdir = args[++i];
    else if (a === '--font') out.font = args[++i];
  }
  if (!out.txt) {
    console.error('Usage: node trello-md2pdf.js --txt <file> [--out card.pdf] [--font "TeX Gyre Termes"]');
    process.exit(2);
  }
  return out;
}

async function ensureDir(p) { await fsp.mkdir(p, { recursive: true }); }

function normName(name) {
  let base = String(name).replace(/\s+/g, '_');
  base = path.basename(base);
  base = base.replace(/[^\w\-.]+/g, '_');
  return base;
} // Essa função é usada no script antes de baixar ou salvar imagens do Trello pra garantir que os nomes de arquivo fiquem limpos e não causem erro

function stripWrapQuotes(s) {
  return (s || '').trim().replace(/^["']+|["']+$/g, '');
}

function buildCurlArgs(url, outFile) {
  const key = stripWrapQuotes(process.env.TRELLO_KEY);
  const token = stripWrapQuotes(process.env.TRELLO_TOKEN);
  const args = ['-L', '--fail-with-body', '-sS'];
  if (outFile) args.push('-o', outFile);
  if (key && token) {
    const header = `Authorization: OAuth oauth_consumer_key="${key}", oauth_token="${token}"`;
    args.push('-H', header);
  }
  args.push(url);
  return args;
}

async function downloadAllImages(md, assetsDir) {
  await ensureDir(assetsDir);

  const matches = [...md.matchAll(IMG_LINK_RE)];
  if (!matches.length) return md;

  let out = '';
  let last = 0;
  const seen = new Map();

  for (const m of matches) {
    const full = m[0];
    const name = normName(m.groups.name);
    const url = m.groups.url;
    const key = `${name}\u0000${url}`;

    // filename único se já existir
    let filename = name;
    let outPath = path.join(assetsDir, filename);
    const parsed = path.parse(outPath);
    let i = 1;
    while (fs.existsSync(outPath)) {
      filename = `${parsed.name}_${i}${parsed.ext}`;
      outPath = path.join(assetsDir, filename);
      i++;
    }

    // baixa se necessário
    if (!seen.has(key)) {
      const curlArgs = buildCurlArgs(url, filename);
      console.log(`curl ${curlArgs.map(a => JSON.stringify(a)).join(' ')}`);
      execFileSync('curl', curlArgs, { cwd: assetsDir, stdio: 'inherit' });
      seen.set(key, filename);
    } else {
      filename = seen.get(key);
    }

    // substitui no Markdown com largura controlada e sem float
    out += md.slice(last, m.index) + `![${name}](assets/${filename}){ width=100% }`;
    last = m.index + full.length;
  }

  out += md.slice(last);
  return out;
}

// Header LaTeX mínimo para tratar imagens (sem YAML)
async function writeHeaderTex(dir) {
  const header = [
    '\\usepackage{graphicx}',
    '\\usepackage{xcolor}',
    '\\definecolor{shadecolor}{RGB}{235,235,235}',
    '\\setkeys{Gin}{width=\\linewidth,keepaspectratio}',
    '\\usepackage{fvextra}',            // <-- pacote para controle fino de verbatim/code
    '\\DefineVerbatimEnvironment{Highlighting}{Verbatim}{%',
    '  breaklines,breakanywhere,',
    '  commandchars=\\\\\\{\\},',
    '  breaksymbol={},',          // remove símbolo no fim da linha quebrada
    '  breaksymbolleft={},',      // remove símbolo no início da linha continuada
  // remove símbolo quando quebra "em qualquer lugar"',
    '}',
  ].join('\n');
  const headerPath = path.join(dir, 'header.tex');
  await fsp.writeFile(headerPath, header, 'utf8');
  return headerPath;
}

function runPandoc(mdPath, pdfPath, cwdDir, font, headerPath) {
  const args = [
    mdPath,
    // GFM + features úteis ao Trello
    '--from', 'gfm+attributes+pipe_tables+strikeout+task_lists+raw_html+hard_line_breaks',
    '--pdf-engine', 'xelatex',
    // inclui header.tex com graphicx/keepaspect
    ...(headerPath ? ['--include-in-header', headerPath] : []),
    // margens via variável (sem YAML)
    '--variable', 'geometry:margin=2cm',
    // onde achar imagens
    '--resource-path', '.',
    '--resource-path', 'assets',
    '--syntax-highlighting=tango', //pandoc --list-highlight-styles
    '-o', pdfPath,
  ];
  if (font) args.push('--variable', `mainfont=${font}`);

  console.log('pandoc ' + args.join(' '));
  execFileSync('pandoc', args, { stdio: 'inherit', cwd: cwdDir || path.dirname(mdPath) });
}

(async function main() {
  try {
    const { txt, out, keepMd, workdir, font } = parseArgs();

    // Workdir padrão = diretório do TXT (assets/ ao lado do TXT)
    const baseDir = workdir || path.dirname(path.resolve(txt));
    await ensureDir(baseDir);
    const assets = path.join(baseDir, 'assets');

    // 1) lê o conteúdo
    const src = await fsp.readFile(txt, 'utf8');

    const normalized = src
     .replace(/\r\n/g, '\n')
     .replace(/\\n\\n/g, '\n\n')
     .replace(/\\n/g, '\n')
     .replace(/\\t/g, '\t');

    // 2) baixar imagens e substituir no MD
    let md = await downloadAllImages(normalized, assets);

    // 3) fallback se vazio
    if (!md.trim()) md = '*Documento vazio*';

    // 4) salva MD final ao lado do TXT
    const mdPath = path.join(baseDir, 'card.md');
    md = md.replace(/!!\[/g, '![');
    await fsp.writeFile(mdPath, md, 'utf8');

    // 5) prepara header.tex
    const headerPath = await writeHeaderTex(baseDir);

    // 6) gerar PDF
    const outAbs = path.resolve(out);
    await ensureDir(path.dirname(outAbs));
    runPandoc(mdPath, outAbs, baseDir, font, headerPath);

    if (!keepMd) { try { await fsp.unlink(mdPath); } catch {} }

    console.log('✅ PDF criado:', outAbs);
  } catch (err) {
    console.error('Erro:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
