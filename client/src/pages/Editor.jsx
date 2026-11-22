import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Archive, CloudCheck, CloudOff, Download, FileDown, FolderTree, Loader2, Pencil, Play, Eye, Code2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ConfirmDialog, PromptDialog } from '../components/Dialogs.jsx';
import { LogoMark } from '../components/Logo.jsx';
import { Menu } from '../components/Menu.jsx';
import { PaperSkeleton, Skeleton } from '../components/Skeleton.jsx';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { baseName, extensionOf } from '../lib/format.js';
import { BuildPanel } from './editor/BuildPanel.jsx';
import { CodeEditor } from './editor/CodeEditor.jsx';
import { FileTree } from './editor/FileTree.jsx';
import { PdfViewer } from './editor/PdfViewer.jsx';
import { useProjectEditor } from './editor/useProjectEditor.js';

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const TEXT_EXTENSIONS = ['tex', 'bib', 'sty', 'cls', 'bst', 'bbx', 'cbx', 'def', 'cfg', 'txt', 'csv', 'dat'];
const BINARY_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf', 'eps'];
const MAX_UPLOAD = 8 * 1024 * 1024;
const SPLIT_KEY = 'tf-split';

const validatePath = (value, { requireText = false } = {}) => {
  if (!value) return 'Enter a file name';
  const segments = value.split('/');
  if (segments.length > 4) return 'Folders can be nested at most three levels deep';
  if (!segments.every((segment) => SEGMENT.test(segment) && !segment.includes('..'))) return 'Use letters, numbers, dots, dashes and underscores only';
  const ext = extensionOf(value);
  if (!TEXT_EXTENSIONS.includes(ext) && !BINARY_EXTENSIONS.includes(ext)) return `.${ext || 'none'} files are not supported`;
  if (requireText && !TEXT_EXTENSIONS.includes(ext)) return 'Create text files here. Use upload for images.';
  return '';
};

const readSplit = () => {
  try {
    const value = Number.parseFloat(localStorage.getItem(SPLIT_KEY) ?? '');
    return Number.isFinite(value) ? Math.min(0.7, Math.max(0.28, value)) : 0.5;
  } catch {
    return 0.5;
  }
};

const SAVE_STATES = {
  saved: { label: 'Saved', icon: CloudCheck },
  saving: { label: 'Saving…', icon: Loader2 },
  unsaved: { label: 'Unsaved changes', icon: Pencil },
  error: { label: 'Offline. Retrying…', icon: CloudOff },
};

const SaveStatus = ({ state }) => {
  const { label, icon: Icon } = SAVE_STATES[state];
  return (
    <span className={`save-status is-${state}`} role="status" aria-live="polite">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={state} className="save-inner" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.16 }}>
          <Icon size={14} className={state === 'saving' ? 'spin' : ''} aria-hidden />
          <span className="save-label">{label}</span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const BinaryPreview = ({ projectId, file }) => {
  const ext = extensionOf(file.path);
  const isImage = ['png', 'jpg', 'jpeg'].includes(ext);
  return (
    <div className="binary">
      {isImage ? (
        <img src={api.rawUrl(projectId, file.path)} alt={`Preview of ${file.path}`} />
      ) : (
        <div className="binary-note">
          <FileDown size={28} aria-hidden />
          <p>
            <strong>{baseName(file.path)}</strong> can be used with <code>\includegraphics</code>, but it cannot be previewed here.
          </p>
        </div>
      )}
    </div>
  );
};

const EditorSkeleton = () => (
  <div className="ed">
    <header className="ed-bar">
      <div className="ed-bar-left">
        <LogoMark size={26} />
        <Skeleton width={160} height={16} />
      </div>
      <div className="ed-bar-right">
        <Skeleton width={96} height={34} radius={8} />
      </div>
    </header>
    <div className="ed-body" style={{ gridTemplateColumns: '236px 1fr' }}>
      <aside className="files">
        <div className="files-head">
          <h2>Files</h2>
        </div>
        <ul className="tree" aria-hidden="true">
          {[70, 52, 64].map((w, i) => (
            <li key={i} className="tree-skeleton">
              <Skeleton width={15} height={15} radius={4} />
              <Skeleton width={`${w}%`} height={11} radius={4} />
            </li>
          ))}
        </ul>
      </aside>
      <div className="ed-work">
        <div className="ed-pane" style={{ padding: '22px 24px' }} role="status" aria-live="polite">
          <span className="sr-only">Loading project</span>
          {Array.from({ length: 16 }, (_, i) => (
            <Skeleton key={i} width={`${[88, 64, 72, 46, 92, 58][i % 6]}%`} height={11} style={{ marginBottom: 14 }} />
          ))}
        </div>
        <div className="ed-pane ed-preview">
          <PaperSkeleton label="Loading preview" />
        </div>
      </div>
    </div>
  </div>
);

export const Editor = () => {
  const { projectId } = useParams();
  const toast = useToast();
  const editor = useProjectEditor(projectId);
  const { phase, project, files, textFiles, build, compiling } = editor;

  const [activePath, setActivePath] = useState(null);
  const [editorPath, setEditorPath] = useState(null);
  const [jump, setJump] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [split, setSplit] = useState(readSplit);
  const [mobileView, setMobileView] = useState('editor');
  const [drawer, setDrawer] = useState(false);
  const workRef = useRef(null);
  const autoCompiled = useRef(false);
  const textFilesRef = useRef(textFiles);
  textFilesRef.current = textFiles;

  const getProject = useCallback(() => ({ files: textFilesRef.current, read: editor.readContent }), [editor.readContent]);

  useEffect(() => {
    if (phase.status === 'ready' && project && !activePath) {
      setActivePath(project.mainFile);
      setEditorPath(project.mainFile);
    }
  }, [phase.status, project, activePath]);

  useEffect(() => {
    if (!activePath || files.length === 0) return;
    if (!files.some((f) => f.path === activePath)) {
      const fallback = files.find((f) => f.path === project?.mainFile)?.path ?? files[0].path;
      setActivePath(fallback);
      if (files.find((f) => f.path === fallback)?.isText) setEditorPath(fallback);
    }
  }, [files, activePath, project]);

  useEffect(() => {
    if (phase.status === 'ready' && !build && !autoCompiled.current && project) {
      autoCompiled.current = true;
      editor.compile();
    }
  }, [phase.status, build, project, editor]);

  useEffect(() => {
    if (project) document.title = `${project.name} · Texflow`;
    return () => {
      document.title = 'Texflow · LaTeX editor for researchers';
    };
  }, [project]);

  const activeFile = files.find((f) => f.path === activePath);
  const showingBinary = activeFile && !activeFile.isText;

  const openFile = useCallback((file) => {
    setActivePath(file.path);
    if (file.isText) setEditorPath(file.path);
    setMobileView('editor');
    setDrawer(false);
  }, []);

  const jumpTo = useCallback((path, line) => {
    setActivePath(path);
    setEditorPath(path);
    setMobileView('editor');
    setJump({ path, line, nonce: Date.now() });
  }, []);

  const handleCompile = useCallback(async () => {
    const result = await editor.compile();
    if (result) {
      setMobileView((view) => (view === 'editor' && window.matchMedia('(max-width: 900px)').matches && result.ok ? 'preview' : view));
      if (!result.ok) setPanelOpen(true);
    }
  }, [editor]);

  const handleSave = useCallback(() => {
    editor.flush().catch((failure) => toast.error(failure.message, 'Could not save'));
  }, [editor, toast]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        handleCompile();
      } else if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCompile, handleSave]);

  const startDrag = (event) => {
    event.preventDefault();
    const rect = workRef.current.getBoundingClientRect();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const move = (moveEvent) => setSplit(Math.min(0.7, Math.max(0.28, (moveEvent.clientX - rect.left) / rect.width)));
    const stop = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', stop);
      target.removeEventListener('pointercancel', stop);
      setSplit((value) => {
        try {
          localStorage.setItem(SPLIT_KEY, String(value));
        } catch {
          /* storage unavailable */
        }
        return value;
      });
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', stop);
    target.addEventListener('pointercancel', stop);
  };

  const nudgeSplit = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setSplit((value) => Math.min(0.7, Math.max(0.28, value + (event.key === 'ArrowLeft' ? -0.03 : 0.03))));
  };

  const uploadMany = async (list) => {
    for (const file of list) {
      const safe = file.name.replace(/\s+/g, '-').replace(/[^A-Za-z0-9._-]/g, '_').replace(/^[._-]+/, '').toLowerCase();
      const problem = validatePath(safe);
      if (problem || !BINARY_EXTENSIONS.includes(extensionOf(safe))) {
        toast.error(`${file.name} is not a supported figure. Use PNG, JPG, PDF or EPS.`, 'Skipped');
        continue;
      }
      if (file.size > MAX_UPLOAD) {
        toast.error(`${file.name} is larger than 8 MB.`, 'Skipped');
        continue;
      }
      try {
        await editor.uploadFile(safe, file);
        toast.success(`${safe} uploaded`);
      } catch {
        /* reported by the hook */
      }
    }
  };

  const download = (url) => {
    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const pdfUrl = useMemo(() => (build?.hasPdf ? api.pdfUrl(projectId, build.builtAt) : null), [build, projectId]);

  if (phase.status === 'loading') return <EditorSkeleton />;

  if (phase.status !== 'ready') {
    return (
      <div className="notfound">
        <LogoMark size={40} />
        <h1 className="serif">{phase.status === 'missing' ? 'Project not found' : 'We could not open this project'}</h1>
        <p>{phase.status === 'missing' ? 'It may have been deleted, or it belongs to another account.' : phase.message}</p>
        <div className="notfound-actions">
          {phase.status === 'error' && (
            <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
              Try again
            </button>
          )}
          <Link to="/app" className="btn btn-primary">
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  const downloadItems = [
    ...(build?.hasPdf ? [{ label: 'Download PDF', icon: FileDown, onSelect: () => download(api.pdfDownloadUrl(projectId)) }] : []),
    { label: 'Download source (.zip)', icon: Archive, onSelect: () => download(api.sourceUrl(projectId)) },
  ];

  return (
    <div className="ed">
      <header className="ed-bar">
        <div className="ed-bar-left">
          <button type="button" className="icon-btn ed-drawer-btn" onClick={() => setDrawer((v) => !v)} aria-label="Toggle file list" aria-expanded={drawer}>
            <FolderTree size={18} />
          </button>
          <Link to="/app" className="icon-btn" aria-label="Back to projects" title="All projects">
            <ArrowLeft size={18} />
          </Link>
          <LogoMark size={24} />
          <button type="button" className="ed-title" onClick={() => setDialog({ type: 'project-rename' })} title="Rename project">
            <span>{project.name}</span>
            <Pencil size={13} aria-hidden />
          </button>
          <SaveStatus state={editor.saveState} />
        </div>

        <div className="ed-mobile-tabs" role="tablist" aria-label="View">
          {[
            ['editor', 'Source', Code2],
            ['preview', 'Preview', Eye],
          ].map(([id, label, Icon]) => (
            <button key={id} type="button" role="tab" aria-selected={mobileView === id} className={mobileView === id ? 'is-active' : ''} onClick={() => setMobileView(id)}>
              <Icon size={14} aria-hidden /> {label}
            </button>
          ))}
        </div>

        <div className="ed-bar-right">
          <label className="ed-engine">
            <span className="sr-only">LaTeX engine</span>
            <select className="select" value={project.engine} onChange={(event) => editor.updateProject({ engine: event.target.value })} disabled={compiling}>
              {editor.engines.map((engine) => (
                <option key={engine} value={engine}>
                  {{ pdflatex: 'pdfLaTeX', xelatex: 'XeLaTeX', lualatex: 'LuaLaTeX' }[engine]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-primary btn-sm compile-btn" onClick={handleCompile} disabled={compiling} title="Compile (Ctrl+Enter)">
            {compiling ? <Loader2 size={15} className="spin" aria-hidden /> : <Play size={15} aria-hidden />}
            <span>{compiling ? 'Compiling' : 'Compile'}</span>
          </button>
          <Menu label="Download" trigger={<span className="icon-btn"><Download size={18} /></span>} items={downloadItems} />
          <ThemeToggle />
        </div>
      </header>

      <div className={`ed-body ${drawer ? 'drawer-open' : ''}`}>
        <FileTree
          files={files}
          activePath={activePath}
          mainFile={project.mainFile}
          onOpen={openFile}
          onNew={() => setDialog({ type: 'new-file' })}
          onUpload={uploadMany}
          onRename={(file) => setDialog({ type: 'rename-file', file })}
          onDelete={(file) => setDialog({ type: 'delete-file', file })}
          onSetMain={(file) => editor.updateProject({ mainFile: file.path }).then(() => toast.success(`${baseName(file.path)} is now the main file`)).catch(() => {})}
        />
        {drawer && <button type="button" className="ed-scrim" aria-label="Close file list" onClick={() => setDrawer(false)} />}

        <div className="ed-work" ref={workRef} data-view={mobileView} style={{ '--split': `${split * 100}%` }}>
          <div className="ed-pane ed-source">
            <div className="ed-filebar">
              <span>{activePath}</span>
              {activePath === project.mainFile && <span className="badge">Main</span>}
            </div>
            <div className="ed-editor-host" hidden={showingBinary}>
              {editorPath && (
                <CodeEditor
                  path={editorPath}
                  readContent={editor.readContent}
                  getProject={getProject}
                  onChange={editor.changeContent}
                  onSave={handleSave}
                  onCompile={handleCompile}
                  diagnostics={build?.diagnostics ?? []}
                  jump={jump}
                />
              )}
            </div>
            {showingBinary && <BinaryPreview projectId={projectId} file={activeFile} />}
          </div>

          <div
            className="ed-divider"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize editor and preview"
            aria-valuenow={Math.round(split * 100)}
            aria-valuemin={28}
            aria-valuemax={70}
            tabIndex={0}
            onPointerDown={startDrag}
            onKeyDown={nudgeSplit}
          />

          <div className="ed-pane ed-preview">
            <PdfViewer url={pdfUrl} compiling={compiling} hasBuild={Boolean(build)} />
          </div>
        </div>
      </div>

      <BuildPanel build={build} compiling={compiling} onJump={jumpTo} open={panelOpen} onOpenChange={setPanelOpen} />

      <PromptDialog
        open={dialog?.type === 'new-file'}
        title="New file"
        description="Add a .tex, .bib or other text file."
        label="File name"
        placeholder="chapters/results.tex"
        hint="Folders are created automatically. Without an extension, .tex is used."
        submitLabel="Create file"
        validate={(value) => validatePath(extensionOf(value) ? value : `${value}.tex`, { requireText: true })}
        onSubmit={async (value) => {
          const path = extensionOf(value) ? value : `${value}.tex`;
          if (files.some((f) => f.path === path)) throw new Error('A file with that name already exists');
          const file = await editor.createFile(path);
          openFile(file);
        }}
        onClose={() => setDialog(null)}
      />
      <PromptDialog
        open={dialog?.type === 'rename-file'}
        title="Rename file"
        label="File name"
        initialValue={dialog?.file?.path ?? ''}
        selectBase
        submitLabel="Rename"
        validate={validatePath}
        onSubmit={async (value) => {
          const from = dialog.file.path;
          if (value === from) return;
          const file = await editor.renameFile(from, value);
          if (activePath === from) setActivePath(file.path);
          if (editorPath === from) setEditorPath(file.path);
        }}
        onClose={() => setDialog(null)}
      />
      <PromptDialog
        open={dialog?.type === 'project-rename'}
        title="Rename project"
        label="Project name"
        initialValue={project.name}
        submitLabel="Rename"
        validate={(value) => (value ? '' : 'Enter a name')}
        onSubmit={async (value) => {
          await editor.updateProject({ name: value });
        }}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog?.type === 'delete-file'}
        title={`Delete ${dialog?.file ? baseName(dialog.file.path) : 'file'}?`}
        description="This cannot be undone."
        confirmLabel="Delete file"
        onConfirm={() => editor.deleteFile(dialog.file.path)}
        onClose={() => setDialog(null)}
      />
    </div>
  );
};
