import { AnimatePresence, motion } from 'framer-motion';
import { FileQuestion, Minus, Plus, ScanLine } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PaperSkeleton } from '../../components/Skeleton.jsx';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const releaseDocument = (doc) => {
  if (doc) Promise.resolve(doc.loadingTask?.destroy()).catch(() => {});
};

const PAGE_GAP = 14;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;

const Page = ({ doc, number, size, scale, root }) => {
  const canvasRef = useRef(null);
  const holderRef = useRef(null);
  const [visible, setVisible] = useState(number <= 2);

  useEffect(() => {
    const node = holderRef.current;
    if (!node || !root) return undefined;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { root, rootMargin: '900px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas) return undefined;
    let task;
    let cancelled = false;
    doc.getPage(number).then((page) => {
      if (cancelled) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
      const viewport = page.getViewport({ scale: scale * ratio });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      task.promise.then(() => !cancelled && canvas.classList.add('is-ready')).catch(() => {});
    });
    return () => {
      cancelled = true;
      task?.cancel();
      canvas.classList.remove('is-ready');
    };
  }, [visible, doc, number, scale]);

  return (
    <div ref={holderRef} className="pdf-page" data-page={number} style={{ width: size.width * scale, height: size.height * scale }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export const PdfViewer = ({ url, compiling, hasBuild }) => {
  const scrollRef = useRef(null);
  const [root, setRoot] = useState(null);
  const [doc, setDoc] = useState(null);
  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);
  const [zoom, setZoom] = useState('fit');
  const [current, setCurrent] = useState(1);
  const docRef = useRef(null);

  const setScroller = useCallback((node) => {
    scrollRef.current = node;
    setRoot(node);
  }, []);

  useEffect(() => {
    if (!root) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(root);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    if (!url) {
      setDoc(null);
      setSizes([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(!docRef.current);
    setFailed(false);
    const task = pdfjs.getDocument({
      url,
      withCredentials: true,
      wasmUrl: '/pdfjs/wasm/',
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      cMapUrl: '/pdfjs/cmaps/',
      cMapPacked: true,
      isEvalSupported: false,
    });
    let adopted = false;
    task.promise
      .then(async (loaded) => {
        const pages = await Promise.all(Array.from({ length: loaded.numPages }, (_, i) => loaded.getPage(i + 1).then((p) => p.getViewport({ scale: 1 }))));
        if (cancelled) return;
        const previous = docRef.current;
        adopted = true;
        docRef.current = loaded;
        setDoc(loaded);
        setSizes(pages.map((viewport) => ({ width: viewport.width, height: viewport.height })));
        setLoading(false);
        setCurrent((page) => Math.min(page, loaded.numPages));
        window.setTimeout(() => releaseDocument(previous), 400);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
      if (!adopted) Promise.resolve(task.destroy()).catch(() => {});
    };
  }, [url]);

  useEffect(
    () => () => {
      releaseDocument(docRef.current);
      docRef.current = null;
    },
    [],
  );

  const available = Math.max(width - 48, 120);
  const widest = sizes.reduce((max, s) => Math.max(max, s.width), 1);
  const fitScale = available / widest;
  const scale = zoom === 'fit' ? fitScale : zoom;

  useEffect(() => {
    if (!root || sizes.length === 0) return undefined;
    const onScroll = () => {
      const probe = root.scrollTop + root.clientHeight * 0.35;
      let offset = 16;
      for (let i = 0; i < sizes.length; i += 1) {
        offset += sizes[i].height * scale + PAGE_GAP;
        if (offset > probe) {
          setCurrent(i + 1);
          return;
        }
      }
      setCurrent(sizes.length);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [root, sizes, scale]);

  const step = (direction) => {
    const base = zoom === 'fit' ? fitScale : zoom;
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round((base + direction * 0.15) * 100) / 100)));
  };

  const hasDoc = doc && sizes.length > 0;

  return (
    <div className="pdf">
      <div className="pdf-toolbar">
        <span className="pdf-pages tabular" aria-live="polite">
          {hasDoc ? `Page ${current} of ${sizes.length}` : 'Preview'}
        </span>
        <div className="pdf-zoom">
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => step(-1)} disabled={!hasDoc} aria-label="Zoom out">
            <Minus size={15} />
          </button>
          <span className="pdf-zoom-value tabular">{Math.round(scale * 100)}%</span>
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => step(1)} disabled={!hasDoc} aria-label="Zoom in">
            <Plus size={15} />
          </button>
          <button type="button" className={`icon-btn icon-btn-sm ${zoom === 'fit' ? 'is-on' : ''}`} onClick={() => setZoom('fit')} disabled={!hasDoc} aria-label="Fit to width" aria-pressed={zoom === 'fit'} title="Fit to width">
            <ScanLine size={15} />
          </button>
        </div>
      </div>

      <div className="pdf-scroll" ref={setScroller} tabIndex={0} aria-label="PDF preview">
        <AnimatePresence>
          {compiling && (
            <motion.div className="pdf-progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-hidden="true">
              <span />
            </motion.div>
          )}
        </AnimatePresence>

        {hasDoc ? (
          <div className={`pdf-pages-list ${compiling ? 'is-stale' : ''}`} style={{ gap: PAGE_GAP }}>
            {sizes.map((size, index) => (
              <Page key={index} doc={doc} number={index + 1} size={size} scale={scale} root={root} />
            ))}
          </div>
        ) : loading || (compiling && !failed) ? (
          <PaperSkeleton label={compiling ? 'Compiling your document' : 'Loading preview'} />
        ) : (
          <div className="pdf-empty">
            <span className="pdf-empty-icon">
              <FileQuestion size={26} aria-hidden />
            </span>
            <h3>{failed ? 'The preview could not be shown' : hasBuild ? 'No PDF from the last build' : 'Nothing to preview yet'}</h3>
            <p>{failed ? 'Compile again to refresh it.' : hasBuild ? 'Fix the errors listed below and compile again.' : 'Press Compile or Ctrl+Enter to build your document.'}</p>
          </div>
        )}
      </div>
    </div>
  );
};
