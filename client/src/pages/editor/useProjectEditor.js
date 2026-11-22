import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../lib/api.js';

const SAVE_DELAY = 900;
const RETRY_DELAY = 5000;

const byPath = (a, b) => a.path.localeCompare(b.path, undefined, { numeric: true });

export const useProjectEditor = (projectId) => {
  const toast = useToast();
  const [phase, setPhase] = useState({ status: 'loading', message: '' });
  const [project, setProject] = useState(null);
  const [files, setFiles] = useState([]);
  const [engines, setEngines] = useState(['pdflatex', 'xelatex']);
  const [build, setBuild] = useState(null);
  const [compiling, setCompiling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirtyCount, setDirtyCount] = useState(0);
  const [saveFailed, setSaveFailed] = useState(false);
  const [contentVersion, setContentVersion] = useState(0);

  const contents = useRef(new Map());
  const dirty = useRef(new Set());
  const timer = useRef(null);
  const chain = useRef(Promise.resolve());
  const alive = useRef(true);

  const syncDirty = () => setDirtyCount(dirty.current.size);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhase({ status: 'loading', message: '' });
    api
      .getProject(projectId)
      .then((data) => {
        if (cancelled) return;
        contents.current = new Map(data.files.filter((f) => f.isText).map((f) => [f.path, f.content ?? '']));
        dirty.current = new Set();
        setProject(data.project);
        setFiles(data.files.map(({ content, ...meta }) => meta).sort(byPath));
        setEngines(data.engines);
        setBuild(data.build);
        setDirtyCount(0);
        setContentVersion((v) => v + 1);
        setPhase({ status: 'ready', message: '' });
      })
      .catch((failure) => {
        if (!cancelled) setPhase({ status: failure.status === 404 ? 'missing' : 'error', message: failure.message });
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const run = async () => {
      while (dirty.current.size > 0) {
        const path = dirty.current.values().next().value;
        dirty.current.delete(path);
        const content = contents.current.get(path);
        if (content === undefined) continue;
        if (alive.current) setSaving(true);
        try {
          const { file } = await api.saveFile(projectId, path, content);
          if (alive.current) {
            setFiles((list) => list.map((item) => (item.path === path ? { ...item, size: file.size, updatedAt: file.updatedAt } : item)));
            setSaveFailed(false);
          }
        } catch (failure) {
          dirty.current.add(path);
          if (alive.current) setSaveFailed(true);
          throw failure;
        } finally {
          if (alive.current) {
            setSaving(false);
            syncDirty();
          }
        }
      }
    };
    chain.current = chain.current.catch(() => {}).then(run);
    return chain.current;
  }, [projectId]);

  const scheduleSave = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(function attempt() {
      flush().catch((failure) => {
        if (!alive.current) return;
        if (failure.status === 413 || failure.status === 422 || failure.status === 409) {
          toast.error(failure.message, 'Could not save');
          return;
        }
        timer.current = window.setTimeout(attempt, RETRY_DELAY);
      });
    }, SAVE_DELAY);
  }, [flush, toast]);

  const readContent = useCallback((path) => contents.current.get(path), []);

  const changeContent = useCallback(
    (path, text) => {
      if (contents.current.get(path) === text) return;
      contents.current.set(path, text);
      dirty.current.add(path);
      syncDirty();
      scheduleSave();
    },
    [scheduleSave],
  );

  useEffect(() => {
    const onBeforeUnload = (event) => {
      if (dirty.current.size === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(
    () => () => {
      if (dirty.current.size > 0) flush().catch(() => {});
    },
    [flush],
  );

  const run = useCallback(
    async (action, failureTitle) => {
      try {
        return await action();
      } catch (failure) {
        toast.error(failure.message, failureTitle);
        throw failure;
      }
    },
    [toast],
  );

  const createFile = useCallback(
    (path) =>
      run(async () => {
        const { file } = await api.saveFile(projectId, path, '');
        contents.current.set(path, '');
        setFiles((list) => [...list.filter((f) => f.path !== path), file].sort(byPath));
        setContentVersion((v) => v + 1);
        return file;
      }, 'Could not create file'),
    [projectId, run],
  );

  const uploadFile = useCallback(
    (path, blob) =>
      run(async () => {
        const { file } = await api.uploadFile(projectId, path, blob);
        setFiles((list) => [...list.filter((f) => f.path !== path), file].sort(byPath));
        return file;
      }, 'Could not upload file'),
    [projectId, run],
  );

  const renameFile = useCallback(
    (from, to) =>
      run(async () => {
        await flush().catch(() => {});
        const { file } = await api.renameFile(projectId, from, to);
        const text = contents.current.get(from);
        if (text !== undefined) {
          contents.current.delete(from);
          contents.current.set(to, text);
        }
        setFiles((list) => list.map((f) => (f.path === from ? file : f)).sort(byPath));
        setProject((p) => (p.mainFile === from ? { ...p, mainFile: to } : p));
        setContentVersion((v) => v + 1);
        return file;
      }, 'Could not rename file'),
    [flush, projectId, run],
  );

  const deleteFile = useCallback(
    (path) =>
      run(async () => {
        dirty.current.delete(path);
        syncDirty();
        await api.deleteFile(projectId, path);
        contents.current.delete(path);
        setFiles((list) => list.filter((f) => f.path !== path));
        setContentVersion((v) => v + 1);
      }, 'Could not delete file'),
    [projectId, run],
  );

  const updateProject = useCallback(
    (patch) =>
      run(async () => {
        const { project: next } = await api.updateProject(projectId, patch);
        setProject(next);
        return next;
      }, 'Could not update project'),
    [projectId, run],
  );

  const compile = useCallback(async () => {
    if (compiling) return null;
    setCompiling(true);
    try {
      await flush();
      const { build: result } = await api.compile(projectId);
      setBuild(result);
      return result;
    } catch (failure) {
      toast.error(failure.message, 'Could not compile');
      return null;
    } finally {
      if (alive.current) setCompiling(false);
    }
  }, [compiling, flush, projectId, toast]);

  const saveState = saving ? 'saving' : dirtyCount > 0 ? (saveFailed ? 'error' : 'unsaved') : saveFailed ? 'error' : 'saved';

  const textFiles = useMemo(() => files.filter((f) => f.isText), [files]);

  return {
    phase,
    project,
    files,
    textFiles,
    engines,
    build,
    compiling,
    saveState,
    contentVersion,
    readContent,
    changeContent,
    flush,
    createFile,
    uploadFile,
    renameFile,
    deleteFile,
    updateProject,
    compile,
  };
};
