const COMMANDS = [
  ['section', 'Section heading'],
  ['subsection', 'Subsection heading'],
  ['subsubsection', 'Subsubsection heading'],
  ['paragraph', 'Run-in paragraph heading'],
  ['chapter', 'Chapter heading'],
  ['textbf', 'Bold text'],
  ['textit', 'Italic text'],
  ['texttt', 'Monospace text'],
  ['textsc', 'Small caps'],
  ['emph', 'Emphasis'],
  ['underline', 'Underline'],
  ['footnote', 'Footnote'],
  ['label', 'Label for cross-reference'],
  ['ref', 'Reference a label'],
  ['eqref', 'Reference an equation'],
  ['autoref', 'Named reference (hyperref)'],
  ['cite', 'Citation'],
  ['citep', 'Parenthetical citation (natbib)'],
  ['citet', 'Textual citation (natbib)'],
  ['caption', 'Figure or table caption'],
  ['centering', 'Center the content'],
  ['includegraphics', 'Insert an image'],
  ['input', 'Include a file inline'],
  ['include', 'Include a file on a new page'],
  ['usepackage', 'Load a package'],
  ['documentclass', 'Document class'],
  ['title', 'Document title'],
  ['author', 'Document author'],
  ['date', 'Document date'],
  ['maketitle', 'Typeset the title block'],
  ['tableofcontents', 'Table of contents'],
  ['bibliography', 'Bibliography file'],
  ['bibliographystyle', 'Bibliography style'],
  ['newcommand', 'Define a command'],
  ['renewcommand', 'Redefine a command'],
  ['newtheorem', 'Define a theorem environment'],
  ['begin', 'Begin an environment'],
  ['end', 'End an environment'],
  ['item', 'List item'],
  ['frac', 'Fraction'],
  ['sqrt', 'Square root'],
  ['sum', 'Summation'],
  ['prod', 'Product'],
  ['int', 'Integral'],
  ['lim', 'Limit'],
  ['infty', 'Infinity'],
  ['partial', 'Partial derivative'],
  ['nabla', 'Nabla'],
  ['mathbb', 'Blackboard bold'],
  ['mathcal', 'Calligraphic'],
  ['mathbf', 'Bold math'],
  ['mathrm', 'Roman math'],
  ['text', 'Text inside math'],
  ['left', 'Auto-sized left delimiter'],
  ['right', 'Auto-sized right delimiter'],
  ['alpha', 'α'],
  ['beta', 'β'],
  ['gamma', 'γ'],
  ['delta', 'δ'],
  ['epsilon', 'ε'],
  ['varepsilon', 'ε (variant)'],
  ['theta', 'θ'],
  ['lambda', 'λ'],
  ['mu', 'μ'],
  ['pi', 'π'],
  ['sigma', 'σ'],
  ['phi', 'φ'],
  ['omega', 'ω'],
  ['Omega', 'Ω'],
  ['leq', '≤'],
  ['geq', '≥'],
  ['neq', '≠'],
  ['approx', '≈'],
  ['in', '∈'],
  ['subset', '⊂'],
  ['cdot', '·'],
  ['times', '×'],
  ['to', '→'],
  ['rightarrow', '→'],
  ['Rightarrow', '⇒'],
  ['hline', 'Horizontal table rule'],
  ['toprule', 'Top rule (booktabs)'],
  ['midrule', 'Middle rule (booktabs)'],
  ['bottomrule', 'Bottom rule (booktabs)'],
  ['multicolumn', 'Span table columns'],
  ['url', 'Typeset a URL'],
  ['href', 'Hyperlink'],
  ['newpage', 'Start a new page'],
  ['vspace', 'Vertical space'],
  ['hspace', 'Horizontal space'],
  ['noindent', 'No paragraph indent'],
  ['today', 'Current date'],
];

const ENVIRONMENTS = [
  'document',
  'abstract',
  'equation',
  'equation*',
  'align',
  'align*',
  'gather',
  'multline',
  'split',
  'cases',
  'matrix',
  'pmatrix',
  'bmatrix',
  'itemize',
  'enumerate',
  'description',
  'figure',
  'table',
  'tabular',
  'center',
  'quote',
  'verbatim',
  'theorem',
  'lemma',
  'proposition',
  'corollary',
  'definition',
  'proof',
  'remark',
  'example',
  'tikzpicture',
  'frame',
  'minipage',
  'thebibliography',
];

const PACKAGES = [
  'amsmath',
  'amssymb',
  'amsthm',
  'algorithm2e',
  'array',
  'booktabs',
  'caption',
  'enumitem',
  'fontspec',
  'geometry',
  'graphicx',
  'hyperref',
  'listings',
  'mathtools',
  'microtype',
  'multirow',
  'natbib',
  'pgfplots',
  'siunitx',
  'subcaption',
  'tikz',
  'xcolor',
];

const CITE_COMMANDS = /^(cite[a-zA-Z]*|parencite|textcite|autocite|footcite|nocite)$/;
const REF_COMMANDS = /^(ref|eqref|autoref|cref|Cref|pageref|nameref|vref)$/;
const ARGUMENT_PATTERN = /\\([A-Za-z]+)\*?(?:\[[^\]]*\])*\{([^{}]*)$/;

export const parseBibKeys = (source) => {
  const keys = [];
  const pattern = /@(\w+)\s*[{(]\s*([^,\s{}]+)\s*,/g;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    const kind = match[1].toLowerCase();
    if (kind === 'comment' || kind === 'string' || kind === 'preamble') continue;
    const tail = source.slice(match.index, match.index + 700);
    const title = /title\s*=\s*[{"]+\s*([^}"]+)/i.exec(tail)?.[1]?.replace(/\s+/g, ' ').trim();
    const author = /author\s*=\s*[{"]+\s*([^}"]+)/i.exec(tail)?.[1]?.split(/\s+and\s+/)[0]?.replace(/\s+/g, ' ').trim();
    const year = /year\s*=\s*[{"]?\s*(\d{4})/i.exec(tail)?.[1];
    keys.push({ key: match[2], detail: [author, year].filter(Boolean).join(' '), info: title });
  }
  return keys;
};

export const parseLabels = (source) => {
  const labels = [];
  const pattern = /\\label\{([^{}]+)\}/g;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) labels.push(match[1]);
  return labels;
};

const environmentApply = (name) => (view, _completion, from, to) => {
  const closing = view.state.sliceDoc(to, to + 1) === '}' ? 1 : 0;
  const insert = `${name}}\n  \n\\end{${name}}`;
  view.dispatch({
    changes: { from, to: to + closing, insert },
    selection: { anchor: from + name.length + 4 },
    userEvent: 'input.complete',
  });
};

const plain = (values, type) => values.map((label) => ({ label, type }));

export const createCompletionSource = (getProject) => (context) => {
  const argument = context.matchBefore(ARGUMENT_PATTERN);
  if (argument) {
    const [, command, inside] = ARGUMENT_PATTERN.exec(argument.text);
    const lastSeparator = Math.max(inside.lastIndexOf(','), -1);
    const partial = inside.slice(lastSeparator + 1);
    const leading = partial.length - partial.trimStart().length;
    const from = argument.to - partial.length + leading;
    const { files, read } = getProject();
    let options = null;

    if (CITE_COMMANDS.test(command)) {
      options = files
        .filter((f) => f.path.endsWith('.bib'))
        .flatMap((f) => parseBibKeys(read(f.path) ?? ''))
        .map(({ key, detail, info }) => ({ label: key, detail, info, type: 'constant' }));
    } else if (REF_COMMANDS.test(command)) {
      options = files
        .filter((f) => f.path.endsWith('.tex'))
        .flatMap((f) => parseLabels(read(f.path) ?? ''))
        .map((label) => ({ label, type: 'variable' }));
    } else if (command === 'includegraphics') {
      options = plain(
        files.filter((f) => /\.(png|jpe?g|pdf|eps)$/i.test(f.path)).map((f) => f.path),
        'file',
      );
    } else if (command === 'input' || command === 'include') {
      options = plain(
        files.filter((f) => f.path.endsWith('.tex')).map((f) => f.path.replace(/\.tex$/, '')),
        'file',
      );
    } else if (command === 'bibliography') {
      options = plain(
        files.filter((f) => f.path.endsWith('.bib')).map((f) => f.path.replace(/\.bib$/, '')),
        'file',
      );
    } else if (command === 'usepackage') {
      options = plain(PACKAGES, 'namespace');
    } else if (command === 'begin') {
      options = ENVIRONMENTS.map((name) => ({ label: name, type: 'class', apply: environmentApply(name) }));
    } else if (command === 'end') {
      options = plain(ENVIRONMENTS, 'class');
    }

    if (!options) return null;
    return { from, options, validFor: /^[\w:.\-/*]*$/ };
  }

  const word = context.matchBefore(/\\[A-Za-z]*$/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  if (word.text.length < 2 && !context.explicit) return null;
  return {
    from: word.from,
    options: COMMANDS.map(([name, detail]) => ({ label: `\\${name}`, detail, type: 'function', boost: name.length < 6 ? 0 : -1 })),
    validFor: /^\\[A-Za-z]*$/,
  };
};
