const WELCOME_TEX = String.raw`\documentclass[11pt]{article}

\usepackage[margin=1in]{geometry}
\usepackage{amsmath, amssymb, amsthm}
\usepackage{booktabs}
\usepackage{graphicx}
\usepackage{tikz}
\usepackage[numbers]{natbib}
\usepackage[colorlinks=true, linkcolor=blue!50!black, citecolor=blue!50!black, urlcolor=blue!50!black]{hyperref}

\newtheorem{theorem}{Theorem}

\title{Welcome to Texflow}
\author{Your Name \\ \small Your Institution}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
This document is a short tour of what you can do here. Edit anything on the left,
press \textbf{Compile} (or \texttt{Ctrl+Enter}), and the PDF on the right updates.
Your changes save automatically.
\end{abstract}

\section{Writing and structure}
Sections, lists and emphasis work as usual. Use \verb|\section{}| and
\verb|\subsection{}| to organise longer papers, and \verb|\label{}| with
\verb|\ref{}| for cross-references such as Section~\ref{sec:math}.

\begin{itemize}
  \item Press \texttt{Ctrl+S} to save immediately.
  \item Errors and warnings appear below the preview. Select one to jump to its line.
  \item Add files from the sidebar, or drop images and \texttt{.bib} files onto it.
\end{itemize}

\section{Mathematics}\label{sec:math}
Inline math such as $e^{i\pi} + 1 = 0$ sits in the text. Display equations are numbered
and can be referenced.

\begin{equation}\label{eq:energy}
  E(u) = \int_{\Omega} \tfrac{1}{2}\,\lvert \nabla u \rvert^{2} \,\mathrm{d}x
\end{equation}

\begin{theorem}[Cauchy--Schwarz]
For all vectors $x, y$ in an inner product space, $\lvert\langle x, y\rangle\rvert \le \lVert x\rVert\,\lVert y\rVert$.
\end{theorem}

\section{Tables and figures}
Tables read well with \texttt{booktabs}.

\begin{table}[htbp]
  \centering
  \caption{Results on three benchmarks.}
  \begin{tabular}{lrr}
    \toprule
    Method & Accuracy (\%) & Time (s) \\
    \midrule
    Baseline & 81.4 & 12.0 \\
    Ours & \textbf{86.9} & 9.5 \\
    \bottomrule
  \end{tabular}
\end{table}

Figures can be drawn directly with TikZ, or uploaded as PNG, JPG or PDF files.

\begin{figure}[htbp]
  \centering
  \begin{tikzpicture}[scale=0.9]
    \draw[->] (0,0) -- (6.6,0) node[right] {$t$};
    \draw[->] (0,-1.2) -- (0,1.4) node[above] {$u$};
    \draw[thick, blue!60!black, domain=0:6.28, samples=80, smooth] plot (\x, {sin(\x r)});
  \end{tikzpicture}
  \caption{A plot drawn with TikZ.}
\end{figure}

\section{Citations}
Cite entries from \texttt{references.bib} with \verb|\cite{}|. For example, the foundations
of information theory are in \citet{shannon1948}, and typesetting is covered by
\citet{knuth1984} and \citet{lamport1994}.

\bibliographystyle{plainnat}
\bibliography{references}

\end{document}
`;

const WELCOME_BIB = String.raw`@article{shannon1948,
  author  = {Shannon, Claude E.},
  title   = {A Mathematical Theory of Communication},
  journal = {The Bell System Technical Journal},
  year    = {1948},
  volume  = {27},
  number  = {3},
  pages   = {379--423}
}

@book{knuth1984,
  author    = {Knuth, Donald E.},
  title     = {The {\TeX}book},
  publisher = {Addison-Wesley},
  year      = {1984}
}

@book{lamport1994,
  author    = {Lamport, Leslie},
  title     = {{\LaTeX}: A Document Preparation System},
  edition   = {2},
  publisher = {Addison-Wesley},
  year      = {1994}
}
`;

const ARTICLE_TEX = String.raw`\documentclass[11pt]{article}

\usepackage[margin=1in]{geometry}
\usepackage{amsmath, amssymb}
\usepackage{graphicx}
\usepackage[numbers]{natbib}
\usepackage{hyperref}

\title{Untitled Paper}
\author{Your Name}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
Write a short summary of your work here.
\end{abstract}

\section{Introduction}
Start writing here.

\section{Methods}

\section{Results}

\section{Conclusion}

\bibliographystyle{plainnat}
\bibliography{references}

\end{document}
`;

const REPORT_TEX = String.raw`\documentclass[11pt]{report}

\usepackage[margin=1in]{geometry}
\usepackage{amsmath, amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage[numbers]{natbib}
\usepackage{hyperref}

\title{Untitled Report}
\author{Your Name}
\date{\today}

\begin{document}
\maketitle
\tableofcontents

\chapter{Introduction}
Start writing here.

\chapter{Background}

\chapter{Conclusion}

\bibliographystyle{plainnat}
\bibliography{references}

\end{document}
`;

const BEAMER_TEX = String.raw`\documentclass{beamer}

\usetheme{default}
\usepackage{amsmath, amssymb}

\title{Untitled Presentation}
\author{Your Name}
\institute{Your Institution}
\date{\today}

\begin{document}

\begin{frame}
  \titlepage
\end{frame}

\begin{frame}{Outline}
  \tableofcontents
\end{frame}

\section{Motivation}
\begin{frame}{Why this matters}
  \begin{itemize}
    \item First point
    \item Second point
  \end{itemize}
\end{frame}

\section{Results}
\begin{frame}{Main result}
  \[
    \int_0^1 x^2 \, \mathrm{d}x = \tfrac{1}{3}
  \]
\end{frame}

\end{document}
`;

const BLANK_TEX = String.raw`\documentclass{article}

\begin{document}

Hello, world.

\end{document}
`;

const EMPTY_BIB = '% Add your references here.\n';

export const TEMPLATES = {
  welcome: {
    mainFile: 'main.tex',
    files: { 'main.tex': WELCOME_TEX, 'references.bib': WELCOME_BIB },
  },
  article: {
    mainFile: 'main.tex',
    files: { 'main.tex': ARTICLE_TEX, 'references.bib': EMPTY_BIB },
  },
  report: {
    mainFile: 'main.tex',
    files: { 'main.tex': REPORT_TEX, 'references.bib': EMPTY_BIB },
  },
  beamer: {
    mainFile: 'main.tex',
    files: { 'main.tex': BEAMER_TEX },
  },
  blank: {
    mainFile: 'main.tex',
    files: { 'main.tex': BLANK_TEX },
  },
};
