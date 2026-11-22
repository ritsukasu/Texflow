import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, FileCode, FilePlus, FileText, Folder, Image, MoreHorizontal, Pencil, Star, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Menu } from '../../components/Menu.jsx';
import { baseName, extensionOf, formatBytes } from '../../lib/format.js';

const iconFor = (path) => {
  const ext = extensionOf(path);
  if (ext === 'tex') return FileText;
  if (['png', 'jpg', 'jpeg', 'pdf', 'eps'].includes(ext)) return Image;
  return FileCode;
};

const buildTree = (files) => {
  const root = { folders: new Map(), files: [] };
  for (const file of files) {
    const parts = file.path.split('/');
    let node = root;
    parts.slice(0, -1).forEach((part, index) => {
      const key = parts.slice(0, index + 1).join('/');
      if (!node.folders.has(part)) node.folders.set(part, { key, name: part, folders: new Map(), files: [] });
      node = node.folders.get(part);
    });
    node.files.push(file);
  }
  return root;
};

const FileRow = ({ file, depth, active, isMain, onOpen, onRename, onDelete, onSetMain }) => {
  const Icon = iconFor(file.path);
  const items = [
    { label: 'Rename', icon: Pencil, onSelect: () => onRename(file) },
    ...(file.path.endsWith('.tex') && !isMain ? [{ label: 'Set as main file', icon: Star, onSelect: () => onSetMain(file) }] : []),
    { separator: true },
    { label: 'Delete', icon: Trash2, danger: true, onSelect: () => onDelete(file) },
  ];
  return (
    <li className={`tree-row ${active ? 'is-active' : ''}`}>
      {active && <motion.span layoutId="tree-active" className="tree-active-bg" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
      <button type="button" className="tree-open" style={{ paddingLeft: 12 + depth * 14 }} onClick={() => onOpen(file)} title={`${file.path} · ${formatBytes(file.size)}`} aria-current={active ? 'true' : undefined}>
        <Icon size={15} aria-hidden />
        <span className="tree-name">{baseName(file.path)}</span>
        {isMain && <Star size={12} className="tree-main" aria-label="Main file" />}
      </button>
      <Menu
        className="tree-menu"
        label={`Actions for ${file.path}`}
        trigger={<span className="icon-btn icon-btn-sm"><MoreHorizontal size={15} /></span>}
        items={items}
      />
    </li>
  );
};

const Folder_ = ({ node, depth, open, toggle, ...rest }) => {
  const isOpen = open.has(node.key) || !open.has(`-${node.key}`);
  return (
    <li>
      <button type="button" className="tree-folder" style={{ paddingLeft: 8 + depth * 14 }} onClick={() => toggle(node.key, isOpen)} aria-expanded={isOpen}>
        <ChevronRight size={14} className={`tree-chevron ${isOpen ? 'is-open' : ''}`} aria-hidden />
        <Folder size={15} aria-hidden />
        <span className="tree-name">{node.name}</span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} style={{ overflow: 'hidden' }}>
            <Level node={node} depth={depth + 1} open={open} toggle={toggle} {...rest} />
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
};

const Level = ({ node, depth, open, toggle, ...rest }) => (
  <>
    {[...node.folders.values()].map((folder) => (
      <Folder_ key={folder.key} node={folder} depth={depth} open={open} toggle={toggle} {...rest} />
    ))}
    {node.files.map((file) => (
      <FileRow key={file.path} file={file} depth={depth} active={rest.activePath === file.path} isMain={rest.mainFile === file.path} {...rest} />
    ))}
  </>
);

export const FileTree = ({ files, activePath, mainFile, onOpen, onNew, onUpload, onRename, onDelete, onSetMain, loading }) => {
  const [open, setOpen] = useState(() => new Set());
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const tree = useMemo(() => buildTree(files), [files]);

  const toggle = (key, isOpen) =>
    setOpen((current) => {
      const next = new Set(current);
      next.delete(key);
      next.delete(`-${key}`);
      next.add(isOpen ? `-${key}` : key);
      return next;
    });

  const pick = (list) => {
    if (list && list.length > 0) onUpload([...list]);
  };

  return (
    <aside
      className={`files ${dragging ? 'is-dragging' : ''}`}
      aria-label="Project files"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        pick(event.dataTransfer.files);
      }}
    >
      <div className="files-head">
        <h2>Files</h2>
        <div className="files-actions">
          <button type="button" className="icon-btn icon-btn-sm" onClick={onNew} aria-label="New file" title="New file">
            <FilePlus size={16} />
          </button>
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => inputRef.current?.click()} aria-label="Upload files" title="Upload images, PDFs or EPS figures">
            <Upload size={16} />
          </button>
          <input ref={inputRef} type="file" multiple hidden accept=".png,.jpg,.jpeg,.pdf,.eps" onChange={(event) => { pick(event.target.files); event.target.value = ''; }} />
        </div>
      </div>

      {loading ? (
        <ul className="tree" aria-hidden="true">
          {[70, 52, 64, 44].map((w, i) => (
            <li key={i} className="tree-skeleton">
              <span className="skeleton" style={{ width: 15, height: 15, borderRadius: 4 }} />
              <span className="skeleton" style={{ width: `${w}%`, height: 11, borderRadius: 4 }} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="tree">
          <Level node={tree} depth={0} open={open} toggle={toggle} activePath={activePath} mainFile={mainFile} onOpen={onOpen} onRename={onRename} onDelete={onDelete} onSetMain={onSetMain} />
        </ul>
      )}

      <AnimatePresence>
        {dragging && (
          <motion.div className="files-drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Upload size={22} aria-hidden />
            <span>Drop to upload</span>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
};
