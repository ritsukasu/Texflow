import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, indentUnit, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { linter, lintGutter, setDiagnostics } from '@codemirror/lint';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import { drawSelection, dropCursor, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useMemo, useRef } from 'react';
import { createCompletionSource } from './latexCompletions.js';

const highlightStyle = HighlightStyle.define([
  { tag: [tags.tagName, tags.keyword, tags.atom], color: 'var(--cm-command)' },
  { tag: tags.comment, color: 'var(--cm-comment)', fontStyle: 'italic' },
  { tag: [tags.string, tags.number], color: 'var(--cm-math)' },
  { tag: [tags.bracket, tags.operator, tags.punctuation], color: 'var(--cm-bracket)' },
  { tag: [tags.variableName, tags.meta, tags.attributeName], color: 'var(--cm-arg)' },
  { tag: tags.invalid, color: 'var(--err)' },
]);

const editorTheme = EditorView.theme({
  '&': { height: '100%', color: 'var(--text)', backgroundColor: 'var(--surface)', fontSize: '13.5px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.7', overflow: 'auto' },
  '.cm-content': { padding: '14px 0', caretColor: 'var(--accent)' },
  '.cm-line': { padding: '0 18px 0 8px' },
  '.cm-gutters': { backgroundColor: 'var(--surface)', color: 'var(--text-3)', border: 'none' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 14px', minWidth: '38px', fontSize: '12px' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--accent) 6%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 24%, transparent) !important',
  },
  '.cm-selectionMatch': { backgroundColor: 'color-mix(in srgb, var(--accent) 16%, transparent)' },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)', outline: 'none' },
  '.cm-tooltip': {
    border: '1px solid var(--line-strong)',
    borderRadius: 'var(--r-md)',
    backgroundColor: 'var(--surface)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
  },
  '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-mono)', fontSize: '12.5px', maxHeight: '260px' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '4px 10px', display: 'flex', alignItems: 'center' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--text)' },
  '.cm-completionDetail': { marginLeft: 'auto', paddingLeft: '16px', fontFamily: 'var(--font-sans)', fontStyle: 'normal', color: 'var(--text-3)' },
  '.cm-completionInfo': { padding: '8px 10px', fontFamily: 'var(--font-sans)', color: 'var(--text-2)', maxWidth: '260px' },
  '.cm-diagnostic': { padding: '6px 10px', fontFamily: 'var(--font-sans)', fontSize: '13px' },
  '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--err)', textUnderlineOffset: '3px' },
  '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline wavy var(--warn)', textUnderlineOffset: '3px' },
  '.cm-panels': { backgroundColor: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--line)' },
  '.cm-panels input, .cm-panels button': { fontFamily: 'var(--font-sans)', fontSize: '12.5px' },
  '.cm-panels input': { border: '1px solid var(--line-strong)', borderRadius: '5px', backgroundColor: 'var(--surface)', color: 'var(--text)', padding: '3px 7px' },
  '.cm-panels button': { border: '1px solid var(--line-strong)', borderRadius: '5px', backgroundColor: 'var(--surface-2)', backgroundImage: 'none', color: 'var(--text)' },
  '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--warn) 30%, transparent)' },
  '.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--accent) 35%, transparent)' },
});

const toLintDiagnostics = (state, diagnostics, path) =>
  diagnostics
    .filter((item) => item.file === path && item.line && item.line <= state.doc.lines && item.type !== 'info')
    .map((item) => {
      const line = state.doc.line(item.line);
      return { from: line.from, to: Math.max(line.from, line.to), severity: item.type === 'error' ? 'error' : 'warning', message: item.message };
    });

export const CodeEditor = ({ path, readContent, getProject, onChange, onSave, onCompile, diagnostics, jump }) => {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const cache = useRef(new Map());
  const activePath = useRef(null);
  const handlers = useRef({ onChange, onSave, onCompile });
  handlers.current = { onChange, onSave, onCompile };

  const completionSource = useMemo(() => createCompletionSource(getProject), [getProject]);

  const extensions = useMemo(
    () => [
      lineNumbers(),
      highlightActiveLineGutter(),
      history(),
      drawSelection(),
      dropCursor(),
      EditorState.allowMultipleSelections.of(true),
      indentUnit.of('  '),
      bracketMatching(),
      closeBrackets({ brackets: ['(', '[', '{', '$'] }),
      autocompletion({ override: [completionSource], icons: false, activateOnTyping: true }),
      highlightActiveLine(),
      highlightSelectionMatches(),
      StreamLanguage.define(stex),
      syntaxHighlighting(highlightStyle),
      EditorView.lineWrapping,
      linter(null),
      lintGutter(),
      keymap.of([
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            handlers.current.onSave();
            return true;
          },
        },
        {
          key: 'Mod-Enter',
          preventDefault: true,
          run: () => {
            handlers.current.onCompile();
            return true;
          },
        },
        ...closeBracketsKeymap,
        ...completionKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && activePath.current) handlers.current.onChange(activePath.current, update.state.doc.toString());
      }),
      editorTheme,
    ],
    [completionSource],
  );

  useEffect(() => {
    const view = new EditorView({ parent: hostRef.current, state: EditorState.create({ doc: '', extensions }) });
    viewRef.current = view;
    const states = cache.current;
    return () => {
      view.destroy();
      viewRef.current = null;
      states.clear();
      activePath.current = null;
    };
  }, [extensions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (activePath.current && activePath.current !== path) cache.current.set(activePath.current, view.state);
    const doc = readContent(path) ?? '';
    let state = cache.current.get(path);
    if (!state || state.doc.toString() !== doc) state = EditorState.create({ doc, extensions });
    activePath.current = path;
    view.setState(state);
  }, [path, readContent, extensions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(setDiagnostics(view.state, toLintDiagnostics(view.state, diagnostics, path)));
  }, [diagnostics, path]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !jump || jump.path !== path) return;
    const line = view.state.doc.line(Math.min(Math.max(jump.line ?? 1, 1), view.state.doc.lines));
    view.dispatch({ selection: { anchor: line.from, head: line.to }, effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
    view.focus();
  }, [jump, path]);

  return <div className="code-editor" ref={hostRef} role="group" aria-label={`Editing ${path}`} />;
};
