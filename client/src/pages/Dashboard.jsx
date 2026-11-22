import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Copy, File, FileText, Loader2, LogOut, MoreHorizontal, Pencil, Plus, Presentation, Search, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ConfirmDialog, PromptDialog } from '../components/Dialogs.jsx';
import { Logo } from '../components/Logo.jsx';
import { RevealWords } from '../components/TextFx.jsx';
import { Menu } from '../components/Menu.jsx';
import { Modal } from '../components/Modal.jsx';
import { ProjectCardSkeleton } from '../components/Skeleton.jsx';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { hashString, initials, pluralize, timeAgo } from '../lib/format.js';

const TEMPLATES = [
  { id: 'welcome', icon: Sparkles, title: 'Example paper', text: 'A guided tour with equations, a table, a figure and citations.' },
  { id: 'article', icon: FileText, title: 'Article', text: 'A clean single-column paper with a bibliography.' },
  { id: 'report', icon: BookOpen, title: 'Report', text: 'Chapters and a table of contents for longer work.' },
  { id: 'beamer', icon: Presentation, title: 'Slides', text: 'A Beamer presentation with a title frame.' },
  { id: 'blank', icon: File, title: 'Blank', text: 'Just the document skeleton.' },
];

const TINTS = ['#e3e9f0', '#e8e9ee', '#e0ecee', '#eae7e3', '#dde6ef'];
const DARK_TINTS = ['#1b2634', '#222530', '#16292d', '#2a2622', '#17283a'];

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const Thumbnail = ({ id }) => {
  const seed = hashString(id);
  const lines = 5 + (seed % 4);
  const hasFigure = seed % 3 !== 0;
  const tint = seed % TINTS.length;
  return (
    <div className="project-thumb" style={{ '--tint': TINTS[tint], '--tint-dark': DARK_TINTS[tint] }}>
      <div className="thumb-paper">
        <span className="thumb-title" style={{ width: `${46 + (seed % 30)}%` }} />
        <span className="thumb-author" />
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className="thumb-line" style={{ width: `${i === lines - 1 ? 55 : 100 - ((seed >> i) % 12)}%` }} />
        ))}
        {hasFigure && <span className="thumb-figure" />}
        <span className="thumb-line" style={{ width: '88%' }} />
        <span className="thumb-line" style={{ width: '64%' }} />
      </div>
    </div>
  );
};

const ProjectCard = ({ project, onRename, onDuplicate, onDelete }) => (
  <motion.li
    layout
    className="project-card"
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
  >
    <Link to={`/app/p/${project.id}`} className="project-link" aria-label={`Open ${project.name}`}>
      <Thumbnail id={project.id} />
      <div className="project-meta">
        <h3>{project.name}</h3>
        <p>
          Edited {timeAgo(project.updatedAt)} · {pluralize(project.fileCount ?? 0, 'file')}
        </p>
      </div>
    </Link>
    <Menu
      className="project-menu"
      label={`Actions for ${project.name}`}
      trigger={<span className="icon-btn icon-btn-sm"><MoreHorizontal size={16} /></span>}
      items={[
        { label: 'Rename', icon: Pencil, onSelect: () => onRename(project) },
        { label: 'Duplicate', icon: Copy, onSelect: () => onDuplicate(project) },
        { separator: true },
        { label: 'Delete', icon: Trash2, danger: true, onSelect: () => onDelete(project) },
      ]}
    />
  </motion.li>
);

const NewProjectDialog = ({ open, onClose, onCreate }) => {
  const [template, setTemplate] = useState('welcome');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTemplate('welcome');
      setName('');
      setError('');
      setBusy(false);
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    const finalName = name.trim() || (template === 'welcome' ? 'Example paper' : 'Untitled project');
    setBusy(true);
    setError('');
    try {
      await onCreate({ name: finalName, template });
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="New project" description="Choose a starting point. You can change anything later." width={560}>
      <form className="modal-form" onSubmit={submit}>
        <div className="field">
          <label className="field-label" htmlFor="new-project-name">
            Project name
          </label>
          <input
            id="new-project-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="My thesis chapter"
            maxLength={100}
            autoComplete="off"
            data-autofocus
          />
        </div>

        <fieldset className="template-group">
          <legend className="field-label">Template</legend>
          <div className="template-grid" role="radiogroup" aria-label="Template">
            {TEMPLATES.map(({ id, icon: Icon, title, text }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={template === id}
                className={`template ${template === id ? 'is-selected' : ''}`}
                onClick={() => setTemplate(id)}
              >
                {template === id && <motion.span layoutId="template-ring" className="template-ring" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <span className="template-icon">
                  <Icon size={18} aria-hidden />
                </span>
                <strong>{title}</strong>
                <span>{text}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}

        <div className="modal-actions" style={{ marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy && <Loader2 size={16} className="spin" aria-hidden />}
            Create project
          </button>
        </div>
      </form>
    </Modal>
  );
};

const EmptyState = ({ onCreate }) => (
  <motion.div className="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}>
    <div className="empty-art" aria-hidden="true">
      <span className="empty-page empty-page-a" />
      <span className="empty-page empty-page-b" />
      <span className="empty-page empty-page-c">
        <i />
        <i />
        <i />
      </span>
    </div>
    <h2 className="serif">Nothing here yet</h2>
    <p>Create a project to start writing. The example paper is a good first stop.</p>
    <button type="button" className="btn btn-primary" onClick={onCreate}>
      <Plus size={16} aria-hidden /> New project
    </button>
  </motion.div>
);

export const Dashboard = () => {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const data = await api.listProjects();
      setProjects(data.projects);
    } catch (failure) {
      setLoadError(failure.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!projects) return null;
    const needle = query.trim().toLowerCase();
    return needle ? projects.filter((project) => project.name.toLowerCase().includes(needle)) : projects;
  }, [projects, query]);

  const closeDialog = useCallback(() => setDialog(null), []);

  const createProject = async (input) => {
    const data = await api.createProject(input);
    navigate(`/app/p/${data.project.id}`);
  };

  const renameProject = async (project, name) => {
    const data = await api.updateProject(project.id, { name });
    setProjects((list) => list.map((p) => (p.id === project.id ? { ...p, ...data.project } : p)));
    toast.success('Project renamed');
  };

  const duplicateProject = async (project) => {
    try {
      const data = await api.duplicateProject(project.id);
      setProjects((list) => [{ ...data.project, fileCount: project.fileCount }, ...list]);
      toast.success(`Created “${data.project.name}”`);
    } catch (failure) {
      toast.error(failure.message, 'Could not duplicate');
    }
  };

  const deleteProject = async (project) => {
    try {
      await api.deleteProject(project.id);
      setProjects((list) => list.filter((p) => p.id !== project.id));
      toast.success(`Deleted “${project.name}”`);
    } catch (failure) {
      toast.error(failure.message, 'Could not delete');
      throw failure;
    }
  };

  const firstName = user.name.split(/\s+/)[0];

  return (
    <div className="dash">
      <header className="dash-bar">
        <div className="dash-bar-inner">
          <Logo to="/app" />
          <div className="dash-bar-actions">
            <ThemeToggle />
            <Menu
              label="Account menu"
              align="start"
              trigger={<span className="avatar" title={user.email}>{initials(user.name)}</span>}
              items={[{ label: 'Sign out', icon: LogOut, onSelect: () => logout().then(() => navigate('/')) }]}
            />
          </div>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-head">
          <div>
            <RevealWords as="h1" className="serif" text={`${greeting()}, ${firstName}`} stagger={0.07} />
            <p className="dash-sub">{projects ? (projects.length ? `You have ${pluralize(projects.length, 'project')}.` : 'Start your first project below.') : 'Loading your projects…'}</p>
          </div>
          <div className="dash-tools">
            <div className="search">
              <Search size={16} aria-hidden />
              <input
                className="input"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects"
                aria-label="Search projects"
              />
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ type: 'new' })}>
              <Plus size={16} aria-hidden /> New project
            </button>
          </div>
        </div>

        {loadError ? (
          <div className="empty" role="alert">
            <h2 className="serif">We could not load your projects</h2>
            <p>{loadError}</p>
            <button type="button" className="btn btn-secondary" onClick={load}>
              Try again
            </button>
          </div>
        ) : !filtered ? (
          <ul className="project-grid" aria-busy="true" aria-label="Loading projects">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index}>
                <ProjectCardSkeleton />
              </li>
            ))}
          </ul>
        ) : projects.length === 0 ? (
          <EmptyState onCreate={() => setDialog({ type: 'new' })} />
        ) : filtered.length === 0 ? (
          <div className="empty">
            <h2 className="serif">No matches</h2>
            <p>Nothing is called “{query.trim()}”. Try a different search.</p>
          </div>
        ) : (
          <ul className="project-grid">
            <AnimatePresence mode="popLayout" initial>
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onRename={(p) => setDialog({ type: 'rename', project: p })}
                  onDuplicate={duplicateProject}
                  onDelete={(p) => setDialog({ type: 'delete', project: p })}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </main>

      <NewProjectDialog open={dialog?.type === 'new'} onClose={closeDialog} onCreate={createProject} />
      <PromptDialog
        open={dialog?.type === 'rename'}
        title="Rename project"
        label="Project name"
        initialValue={dialog?.project?.name ?? ''}
        submitLabel="Rename"
        validate={(value) => (value ? '' : 'Enter a name')}
        onSubmit={(value) => renameProject(dialog.project, value)}
        onClose={closeDialog}
      />
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        title={`Delete “${dialog?.project?.name ?? ''}”?`}
        description="All of its files and its last PDF will be removed permanently."
        confirmLabel="Delete project"
        onConfirm={() => deleteProject(dialog.project)}
        onClose={closeDialog}
      />
    </div>
  );
};
