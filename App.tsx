import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Header from './components/Header';
import UploadZone from './components/UploadZone';
import { FileWithId, MergeStatus, ProcessingState, AppMode, ProcessedFile, WatermarkConfig, PdfMetadata, EditorPage } from './types';
import { mergeAndWatermarkPdfs, processBatchFile, generatePdfThumbnails, buildPdfFromEditor, mergeProcessedFiles } from './services/pdfService';
import { FileDown, CheckCircle, Layers, Download, Stamp, ArrowDownToLine, ArrowUpToLine, X, Image as ImageIcon, Sparkles, FileText, Undo2, Trash2, ArrowRightCircle, Plus, RotateCw, Edit, Clock, Info, Pencil, Package, LayoutTemplate } from 'lucide-react';

// --- DEFAULT LOGO GENERATION ---
const DEFAULT_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <style>
      .cls-border { fill: none; stroke: #283088; stroke-width: 15px; }
      .cls-fill { fill: #283088; }
      .cls-text { font-size: 50px; fill: #283088; font-family: Arial, Helvetica, sans-serif; font-weight: bold; }
    </style>
  </defs>
  <circle class="cls-border" cx="250" cy="250" r="230"/>
  <path class="cls-fill" d="M250 110 L100 170 L250 230 L400 170 Z"/>
  <rect class="cls-fill" x="390" y="170" width="6" height="50"/>
  <circle class="cls-fill" cx="393" cy="230" r="10"/>
  <path class="cls-fill" d="M250 240 L250 370 C250 370 330 390 390 360 L390 230 C330 260 250 240 250 240 Z"/>
  <path class="cls-fill" d="M250 240 L250 370 C250 370 170 390 110 360 L110 230 C170 260 250 240 250 240 Z"/>
  <text class="cls-text" x="250" y="450" text-anchor="middle">vtunotesforall</text>
</svg>
`;

// Helper for logo loading
const loadDefaultLogo = async (): Promise<File> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const svgBlob = new Blob([DEFAULT_LOGO_SVG], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 500;
            canvas.height = 500;
            const ctx = canvas.getContext('2d');
            if (!ctx) { 
                URL.revokeObjectURL(url);
                reject(new Error('Canvas context failed')); 
                return; 
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);
                if (blob) {
                    const file = new File([blob], "vtunotesforall_logo.png", { type: 'image/png' });
                    resolve(file);
                } else reject(new Error('Blob creation failed'));
            }, 'image/png');
        };
        img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
    });
};

// --- TOAST COMPONENT ---
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const bgColors = {
        success: 'bg-emerald-500',
        error: 'bg-rose-500',
        info: 'bg-slate-800'
    };

    return (
        <div className="fixed top-24 right-4 z-[100] animate-slide-up flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl shadow-black/10 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
            <div className={`w-2 h-2 rounded-full ${bgColors[type]}`}></div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{message}</p>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X className="w-4 h-4" /></button>
        </div>
    );
};

// --- RECENT ACTIVITY STORAGE ---
const useRecentActivity = () => {
    const [recent, setRecent] = useState<{id: string, name: string, date: string, type: string}[]>([]);
    
    useEffect(() => {
        const stored = localStorage.getItem('vtu_recent_activity');
        if (stored) setRecent(JSON.parse(stored));
    }, []);

    const addActivity = (name: string, type: string) => {
        const newItem = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            date: new Date().toLocaleDateString(),
            type
        };
        const updated = [newItem, ...recent].slice(0, 5);
        setRecent(updated);
        localStorage.setItem('vtu_recent_activity', JSON.stringify(updated));
    };

    return { recent, addActivity };
};

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    return false;
  });

  // State Management
  const [mode, setMode] = useState<AppMode>('MERGE');
  const [coverFile, setCoverFile] = useState<FileWithId[]>([]);
  const [useDefaultCover, setUseDefaultCover] = useState(false); // Default Cover Toggle State
  const [contentFiles, setContentFiles] = useState<FileWithId[]>([]);
  const [editorPages, setEditorPages] = useState<EditorPage[]>([]);
  const [editorSourceFiles, setEditorSourceFiles] = useState<FileWithId[]>([]);
  const [metadata, setMetadata] = useState<PdfMetadata>({ title: '', author: '' });
  
  // Watermark Config
  const [wmConfig, setWmConfig] = useState<WatermarkConfig>({
    diagonal: true, bottom: true, top: false, crossed: false,
    textColor: '#808080', textOpacity: 0.2, logoFile: null, logoOpacity: 0.5, logoScale: 0.5
  });
  const [rotationAngle, setRotationAngle] = useState(60); // Dynamic rotation

  // Batch Filename Config
  const [filenameSuffix, setFilenameSuffix] = useState('vtunotesforall');
  
  const [processingState, setProcessingState] = useState<ProcessingState>({ status: MergeStatus.IDLE, progress: 0 });
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'info'} | null>(null);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { recent, addActivity } = useRecentActivity();

  // Initialization
  useEffect(() => {
    loadDefaultLogo().then(file => setWmConfig(prev => ({ ...prev, logoFile: file }))).catch(e => console.error(e));
  }, []);

  useEffect(() => {
    if (darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [darkMode]);

  // Derived State
  const logoPreviewUrl = useMemo(() => wmConfig.logoFile ? URL.createObjectURL(wmConfig.logoFile) : null, [wmConfig.logoFile]);
  const generateId = () => Math.random().toString(36).substring(2, 9);
  // NOTE: Modified isReady check to make cover file optional in MERGE mode
  const isReady = mode === 'EDITOR' ? editorPages.length > 0 : contentFiles.length > 0;

  // --- HANDLERS ---
  const handleCoverSelect = useCallback((files: File[]) => { if (files.length > 0) setCoverFile([{ id: generateId(), file: files[0] }]); }, []);
  const handleContentSelect = useCallback((files: File[]) => { setContentFiles(prev => [...prev, ...files.map(f => ({ id: generateId(), file: f }))]); }, []);
  
  const handleEditorFilesSelect = async (files: File[]) => {
    setProcessingState({ status: MergeStatus.PROCESSING, progress: 10, message: "Parsing pages..." });
    try {
        const newSourceFiles = files.map(f => ({ id: generateId(), file: f }));
        setEditorSourceFiles(prev => [...prev, ...newSourceFiles]);
        const allNewPages: EditorPage[] = [];
        let count = 0;
        for (const fileItem of newSourceFiles) {
            const pages = await generatePdfThumbnails(fileItem);
            allNewPages.push(...pages);
            count++;
            setProcessingState(prev => ({ ...prev, progress: 10 + (count / newSourceFiles.length) * 80 }));
        }
        setEditorPages(prev => [...prev, ...allNewPages]);
        setProcessingState({ status: MergeStatus.IDLE, progress: 0 });
    } catch (e) {
        setProcessingState({ status: MergeStatus.ERROR, progress: 0 });
        setToast({ msg: "Failed to parse PDF", type: 'error' });
    }
  };

  const handleProcess = async () => {
    if (mode === 'EDITOR') { await handleEditorSave(); return; }
    setProcessingState({ status: MergeStatus.PROCESSING, progress: 0, message: "Starting engine..." });
    try {
      await new Promise(r => setTimeout(r, 800)); // Cinematic delay
      if (mode === 'MERGE') {
        const bytes = await mergeAndWatermarkPdfs(
            coverFile[0]?.file, 
            contentFiles.map(f => f.file), 
            (p) => setProcessingState(prev => ({...prev, progress: p, message: 'Processing pages...'})), 
            metadata,
            wmConfig.logoFile, // Pass the loaded logo for default cover generation
            useDefaultCover // Pass the toggle state
        );
        setMergedPdfUrl(URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })));
        addActivity(metadata.title || 'Merged Document', 'Merge');
      } else {
        const results: ProcessedFile[] = [];
        for (let i = 0; i < contentFiles.length; i++) {
          setProcessingState({ status: MergeStatus.PROCESSING, progress: ((i/contentFiles.length)*100), message: `Processing ${i+1}/${contentFiles.length}` });
          const bytes = await processBatchFile(contentFiles[i].file, coverFile[0]?.file, wmConfig, metadata);
          results.push({ id: contentFiles[i].id, originalName: contentFiles[i].file.name, downloadFilename: `${contentFiles[i].file.name.replace('.pdf','')}_${filenameSuffix}.pdf`, processedData: bytes, downloadUrl: URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })) });
        }
        setProcessedFiles(results);
        addActivity(`Batch of ${contentFiles.length} files`, 'Watermark');
      }
      setProcessingState({ status: MergeStatus.SUCCESS, progress: 100, message: "Complete" });
      setToast({ msg: "Processing Complete!", type: 'success' });
    } catch (e) {
      setProcessingState({ status: MergeStatus.ERROR, progress: 0, message: String(e) });
      setToast({ msg: "An error occurred", type: 'error' });
    }
  };

  const handleEditorSave = async () => {
     setProcessingState({ status: MergeStatus.PROCESSING, progress: 30, message: "Compiling..." });
     try {
         const bytes = await buildPdfFromEditor(editorPages, editorSourceFiles);
         setMergedPdfUrl(URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })));
         setProcessingState({ status: MergeStatus.SUCCESS, progress: 100 });
         addActivity('Custom Edit', 'Editor');
         setToast({ msg: "PDF Recompiled Successfully", type: 'success' });
     } catch(e) { 
         setProcessingState({ status: MergeStatus.ERROR, progress: 0 }); 
         setToast({ msg: "Compilation failed", type: 'error' });
     }
  };

  const handleBatchMergeDownload = async () => {
     setProcessingState({ status: MergeStatus.PROCESSING, progress: 40, message: "Merging all files..." });
     try {
        await new Promise(r => setTimeout(r, 500)); // UI delay
        const arrays = processedFiles.map(f => f.processedData);
        const mergedBytes = await mergeProcessedFiles(arrays);
        
        const blob = new Blob([mergedBytes as unknown as BlobPart], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `Batch_Merged_${filenameSuffix || 'output'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setProcessingState({ status: MergeStatus.SUCCESS, progress: 100, message: "Complete" });
        setToast({ msg: "Merged batch downloaded!", type: 'success' });
     } catch (e) {
        console.error(e);
        // Return to success state so list is visible
        setProcessingState({ status: MergeStatus.SUCCESS, progress: 100, message: "Complete" });
        setToast({ msg: "Failed to merge batch", type: 'error' });
     }
  };

  // Result Management Handlers
  const updateResultFilename = (id: string, newName: string) => {
    setProcessedFiles(prev => prev.map(f => f.id === id ? { ...f, downloadFilename: newName } : f));
  };

  const updateGlobalSuffix = (suffix: string) => {
    setFilenameSuffix(suffix);
    setProcessedFiles(prev => prev.map(f => ({
        ...f,
        downloadFilename: `${f.originalName.replace(/\.pdf$/i, '')}_${suffix}.pdf`
    })));
  };

  const clearAll = () => {
      setCoverFile([]); setContentFiles([]); setEditorPages([]); setEditorSourceFiles([]);
      setProcessingState({ status: MergeStatus.IDLE, progress: 0 });
      setMergedPdfUrl(null); setProcessedFiles([]);
      setToast({ msg: "All files cleared", type: 'info' });
  };

  const shareApp = () => {
      if (navigator.share) {
          navigator.share({ title: 'VTU Notes Tools', text: 'Check out this awesome PDF tool for VTU students!', url: window.location.href });
      } else {
          setToast({ msg: "Link copied to clipboard", type: 'success' });
          navigator.clipboard.writeText(window.location.href);
      }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-surface-50 dark:bg-brand-950 transition-colors duration-500 overflow-x-hidden">
      
      {/* Dynamic Background Mesh */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 dark:opacity-20 bg-gradient-mesh dark:bg-gradient-mesh-dark animate-float" />

      <Header darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} onShare={shareApp} />
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <main className="flex-grow w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-24 pb-40 lg:pb-24 relative z-10">
        
        {/* HERO SECTION */}
        <div className="text-center max-w-4xl mx-auto mb-16 animate-fade-in relative">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-500/20 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-md mb-6 shadow-sm animate-slide-up">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">The Ultimate Student PDF Tool Suite</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 text-balance font-display">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-slate-400 drop-shadow-sm">
                  Merge. Edit. Watermark.
                </span>
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                Professional-grade PDF tools running entirely in your browser. <br className="hidden md:block"/> No uploads, no limits, 100% secure.
            </p>
        </div>

        {/* DASHBOARD CONTAINER */}
        <div className="glass-card rounded-[2.5rem] p-1.5 shadow-2xl shadow-brand-900/10 dark:shadow-black/40 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="bg-white/50 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2.2rem] overflow-hidden min-h-[600px] flex flex-col md:flex-row relative">
                
                {/* SIDEBAR (Desktop) */}
                <div className="hidden md:flex flex-col w-64 border-r border-slate-200/60 dark:border-slate-800/60 p-6 bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2 block">Tools</label>
                        {[
                            { id: 'MERGE', icon: Layers, label: 'Merge PDFs', desc: 'Combine multiple files' },
                            { id: 'WATERMARK_ONLY', icon: Stamp, label: 'Batch Watermark', desc: 'Brand your docs' },
                            { id: 'EDITOR', icon: Edit, label: 'Page Editor', desc: 'Rearrange & Rotate' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => { setMode(item.id as AppMode); clearAll(); }}
                                className={`w-full text-left p-3 rounded-xl transition-all duration-300 group ${mode === item.id ? 'bg-white dark:bg-slate-800 shadow-md shadow-slate-200/50 dark:shadow-black/20 text-brand-600 dark:text-brand-400 ring-1 ring-slate-200 dark:ring-slate-700' : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${mode === item.id ? 'bg-brand-50 dark:bg-brand-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                        <item.icon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm">{item.label}</div>
                                        <div className="text-[10px] opacity-70 font-medium">{item.desc}</div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="mt-auto pt-8">
                        <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-3 block flex items-center gap-2"><Clock className="w-3 h-3" /> Recent</label>
                        <div className="space-y-1">
                            {recent.length === 0 && <div className="px-3 text-xs text-slate-400 italic">No recent activity</div>}
                            {recent.map(r => (
                                <div key={r.id} className="px-3 py-2 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-default transition-colors">
                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{r.name}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-500 flex justify-between">
                                        <span>{r.type}</span>
                                        <span>{r.date}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* MAIN CONTENT AREA */}
                <div className="flex-1 flex flex-col relative overflow-hidden">
                    {/* Header for Mobile */}
                    <div className="md:hidden p-4 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between bg-white/50 dark:bg-slate-900/50">
                        <span className="font-bold text-lg font-display">{mode === 'MERGE' ? 'Merge PDFs' : mode === 'EDITOR' ? 'Page Editor' : 'Watermark'}</span>
                        <button onClick={clearAll} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-5 h-5"/></button>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 pb-32 md:pb-10">
                        
                        {/* PROCESSING OVERLAY */}
                        {processingState.status === MergeStatus.PROCESSING && (
                             <div className="absolute inset-0 z-50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-fade-in">
                                 <div className="relative w-24 h-24 mb-6">
                                     <svg className="animate-spin w-full h-full text-slate-200 dark:text-slate-800" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                     <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-brand-600">{Math.round(processingState.progress)}%</div>
                                 </div>
                                 <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{processingState.message}</h3>
                                 <p className="text-slate-500 text-sm">Please wait while we crunch the bits...</p>
                             </div>
                        )}

                        {/* SUCCESS STATE */}
                        {processingState.status === MergeStatus.SUCCESS ? (
                            <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto animate-scale-in">
                                <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/30 rotate-3">
                                    <CheckCircle className="w-12 h-12" />
                                </div>
                                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 font-display">Mission Accomplished!</h2>
                                <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                                    Your files have been processed securely. No data was sent to any server.
                                </p>
                                
                                {mergedPdfUrl && (
                                    <a href={mergedPdfUrl} download="Processed_Document.pdf" className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-bold text-lg shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3">
                                        <FileDown className="w-6 h-6" /> Download PDF
                                    </a>
                                )}

                                {processedFiles.length > 0 && (
                                    <div className="w-full space-y-4 text-left">
                                        {/* Batch Rename Control */}
                                        <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center">
                                            <div className="flex-1 w-full">
                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Batch Rename</label>
                                                <div className="relative">
                                                    <input 
                                                        type="text" 
                                                        value={filenameSuffix} 
                                                        onChange={(e) => updateGlobalSuffix(e.target.value)}
                                                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-2 focus:ring-brand-500 outline-none" 
                                                        placeholder="Enter new suffix..."
                                                    />
                                                    <Pencil className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 sm:text-right">
                                                Updates all files below. <br/> Example: <code>Note_<strong>{filenameSuffix || 'suffix'}</strong>.pdf</code>
                                            </div>
                                        </div>

                                        {/* Download Merged Option - NEW */}
                                        <button 
                                            onClick={handleBatchMergeDownload}
                                            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
                                        >
                                            <Package className="w-5 h-5" /> Download All as Merged PDF
                                        </button>

                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-2 max-h-[400px] overflow-y-auto border border-slate-200 dark:border-slate-700 custom-scrollbar">
                                            {processedFiles.map(f => (
                                                <div key={f.id} className="flex flex-col sm:flex-row items-center gap-3 p-3 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors group border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                                                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0">
                                                        <FileText className="w-5 h-5"/>
                                                    </div>
                                                    
                                                    <div className="flex-1 w-full min-w-0">
                                                        <div className="text-[10px] text-slate-400 truncate mb-1">{f.originalName}</div>
                                                        <input 
                                                            type="text" 
                                                            value={f.downloadFilename}
                                                            onChange={(e) => updateResultFilename(f.id, e.target.value)}
                                                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand-500 focus:bg-white dark:focus:bg-slate-900 outline-none text-sm font-bold text-slate-700 dark:text-slate-200 py-1 transition-all"
                                                        />
                                                    </div>

                                                    <a href={f.downloadUrl} download={f.downloadFilename} className="w-full sm:w-auto p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors flex items-center justify-center gap-2">
                                                        <Download className="w-4 h-4" /> <span className="sm:hidden text-xs font-bold">Download</span>
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <button onClick={clearAll} className="mt-8 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center gap-2">
                                    <Undo2 className="w-4 h-4" /> Process More Files
                                </button>
                            </div>
                        ) : mode === 'EDITOR' && editorPages.length > 0 ? (
                            /* EDITOR UI */
                            <div className="space-y-6 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold dark:text-white font-display">Page Editor</h3>
                                    <div className="flex gap-2">
                                        <button onClick={() => setEditorPages(prev => prev.map(p => ({...p, rotation: (p.rotation+90)%360})))} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Rotate All</button>
                                        <button onClick={() => setEditorPages([])} className="px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-100 transition-colors">Clear</button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {editorPages.map((page, idx) => (
                                        <div key={page.id} className="group relative aspect-[1/1.4] bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-transparent hover:border-brand-500">
                                            <img src={page.thumbnailUrl} className="w-full h-full object-contain bg-white" style={{ transform: `rotate(${page.rotation}deg)` }} />
                                            <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-md">{idx+1}</div>
                                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-[1px]">
                                                <button onClick={() => setEditorPages(prev => prev.map(p => p.id === page.id ? {...p, rotation: (p.rotation+90)%360} : p))} className="p-2 bg-white/20 hover:bg-white rounded-full hover:text-brand-600 text-white transition-all"><RotateCw className="w-5 h-5"/></button>
                                                <button onClick={() => setEditorPages(prev => prev.filter(p => p.id !== page.id))} className="p-2 bg-rose-500/80 hover:bg-rose-500 rounded-full text-white transition-all"><Trash2 className="w-5 h-5"/></button>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="aspect-[1/1.4] rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-brand-400 dark:hover:border-brand-500 flex flex-col items-center justify-center text-slate-400 hover:text-brand-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-all relative">
                                        <input type="file" multiple accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => e.target.files && handleEditorFilesSelect(Array.from(e.target.files))} />
                                        <Plus className="w-8 h-8 mb-2" />
                                        <span className="text-xs font-bold">Add Pages</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* UPLOAD & CONFIG UI */
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 animate-fade-in">
                                <div className="space-y-8">
                                    {mode === 'EDITOR' ? (
                                        <div className="text-center py-12">
                                            <div className="w-20 h-20 bg-brand-50 dark:bg-brand-900/20 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Edit className="w-10 h-10" />
                                            </div>
                                            <h3 className="text-xl font-bold dark:text-white">Start Editing</h3>
                                            <p className="text-slate-500 mb-6 text-sm">Upload a PDF to reorder, rotate or remove pages.</p>
                                            <UploadZone id="editor" label="Upload PDF" subLabel="Visual Page Editor" accept=".pdf" files={editorSourceFiles} onFilesSelected={handleEditorFilesSelect} onRemoveFile={() => {}} />
                                        </div>
                                    ) : (
                                        <>
                                           <div className="space-y-4">
                                               <div className="flex justify-between items-center">
                                                   <h3 className="text-lg font-bold dark:text-white font-display">1. Upload Files</h3>
                                                   {mode !== 'MERGE' && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">BATCH MODE</span>}
                                               </div>
                                               
                                               <div className="space-y-4">
                                                   <UploadZone 
                                                        id="cover" 
                                                        label="Cover Page" 
                                                        subLabel="First page of document (Optional)"
                                                        accept=".pdf" 
                                                        files={coverFile} 
                                                        onFilesSelected={handleCoverSelect} 
                                                        onRemoveFile={() => {setCoverFile([]); setMergedPdfUrl(null);}} 
                                                        required={false}
                                                    />
                                                    
                                                    {/* Default Cover Toggle */}
                                                    {coverFile.length === 0 && (
                                                       <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 -mt-2 shadow-sm animate-fade-in">
                                                            <div className="flex items-center gap-3">
                                                               <div className="p-2 bg-brand-50 dark:bg-brand-900/20 text-brand-600 rounded-lg">
                                                                  <LayoutTemplate className="w-4 h-4" />
                                                               </div>
                                                               <div>
                                                                  <h4 className="font-bold text-xs text-slate-700 dark:text-slate-200">Include Default Cover</h4>
                                                                  <p className="text-[10px] text-slate-500">Auto-generate VTU Notes cover page</p>
                                                               </div>
                                                            </div>
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                              <input type="checkbox" checked={useDefaultCover} onChange={e => setUseDefaultCover(e.target.checked)} className="sr-only peer" />
                                                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div>
                                                            </label>
                                                        </div>
                                                    )}

                                                   <UploadZone 
                                                        id="content" 
                                                        label="Content Files" 
                                                        subLabel="Main documents to process" 
                                                        accept=".pdf" 
                                                        multiple 
                                                        files={contentFiles} 
                                                        onFilesSelected={handleContentSelect} 
                                                        onRemoveFile={(id) => setContentFiles(prev => prev.filter(f => f.id !== id))} 
                                                        required 
                                                    />
                                               </div>
                                           </div>
                                           
                                           <div className="space-y-4">
                                                <h3 className="text-lg font-bold dark:text-white font-display">2. Metadata</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <input type="text" placeholder="Title" value={metadata.title} onChange={e => setMetadata({...metadata, title: e.target.value})} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all dark:text-white" />
                                                    <input type="text" placeholder="Author" value={metadata.author} onChange={e => setMetadata({...metadata, author: e.target.value})} className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none transition-all dark:text-white" />
                                                </div>
                                           </div>
                                        </>
                                    )}
                                </div>

                                {/* RIGHT PANEL: PREVIEW & SETTINGS */}
                                {mode !== 'EDITOR' && (
                                    <div className="space-y-6 lg:sticky lg:top-6">
                                        <div className="bg-slate-100 dark:bg-slate-800/50 rounded-[2rem] p-6 relative group overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                                            <div className="absolute top-4 right-4 z-20 flex gap-2">
                                                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">LIVE PREVIEW</div>
                                            </div>
                                            
                                            {/* Paper Representation */}
                                            <div className="aspect-[1/1.414] bg-white relative shadow-2xl shadow-slate-900/10 mx-auto w-3/4 transition-transform duration-500 group-hover:scale-[1.02] origin-bottom">
                                                {/* Simulated Content */}
                                                <div className="absolute inset-8 space-y-4 opacity-10 pointer-events-none">
                                                    <div className="h-6 bg-slate-900 w-3/4 mb-8"></div>
                                                    {[...Array(6)].map((_, i) => <div key={i} className="h-2.5 bg-slate-900 w-full"></div>)}
                                                </div>
                                                
                                                {/* Watermark Overlay */}
                                                <div className="absolute inset-0 overflow-hidden flex items-center justify-center pointer-events-none" style={{ color: wmConfig.textColor }}>
                                                     {mode === 'WATERMARK_ONLY' ? (
                                                        <>
                                                            {logoPreviewUrl && <img src={logoPreviewUrl} className="absolute object-contain transition-opacity duration-300" style={{ width: `${wmConfig.logoScale * 80}%`, opacity: wmConfig.logoOpacity }} />}
                                                            {wmConfig.diagonal && <div className="absolute inset-0 flex items-center justify-center"><span className="text-3xl font-bold uppercase transition-opacity" style={{ opacity: wmConfig.textOpacity, transform: `rotate(-${rotationAngle}deg)` }}>vtunotesforall</span></div>}
                                                            {wmConfig.crossed && <div className="absolute inset-0 flex items-center justify-center"><span className="text-3xl font-bold uppercase transition-opacity" style={{ opacity: wmConfig.textOpacity, transform: `rotate(${rotationAngle}deg)` }}>vtunotesforall</span></div>}
                                                            {wmConfig.bottom && <div className="absolute bottom-8 w-full text-center"><span className="text-xs font-bold uppercase" style={{ opacity: Math.min(wmConfig.textOpacity + 0.4, 1) }}>vtunotesforall</span></div>}
                                                        </>
                                                     ) : (
                                                         <div className="absolute inset-0 flex items-center justify-center opacity-30">
                                                             <span className="text-2xl font-bold -rotate-45">Standard Watermark</span>
                                                         </div>
                                                     )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Watermark Controls */}
                                        {mode === 'WATERMARK_ONLY' && (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-4 gap-2">
                                                    {[
                                                        { id: 'diagonal', icon: Stamp, label: 'Diag' },
                                                        { id: 'bottom', icon: ArrowDownToLine, label: 'Footer' },
                                                        { id: 'top', icon: ArrowUpToLine, label: 'Header' },
                                                        { id: 'crossed', icon: X, label: 'Cross' },
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.id}
                                                            onClick={() => setWmConfig(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof WatermarkConfig] }))}
                                                            className={`flex flex-col items-center justify-center py-3 rounded-xl text-[10px] font-bold transition-all border ${wmConfig[opt.id as keyof WatermarkConfig] ? 'bg-brand-500 text-white border-brand-500 shadow-lg shadow-brand-500/20' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'}`}
                                                        >
                                                            <opt.icon className="w-4 h-4 mb-1" /> {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                
                                                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-5">
                                                    {/* Rotation Slider (Optional Feature) */}
                                                    {(wmConfig.diagonal || wmConfig.crossed) && (
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                                                                <span>Rotation</span>
                                                                <span>{rotationAngle}°</span>
                                                            </div>
                                                            <input 
                                                                type="range" min="0" max="90" step="1" 
                                                                value={rotationAngle} 
                                                                onChange={e => setRotationAngle(parseInt(e.target.value))} 
                                                                className="w-full accent-brand-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Text Watermark Controls */}
                                                    <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                                                       <div className="flex items-center justify-between">
                                                           <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Text Opacity</label>
                                                           <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{Math.round(wmConfig.textOpacity * 100)}%</span>
                                                       </div>
                                                       <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden cursor-pointer relative shrink-0">
                                                                <input type="color" value={wmConfig.textColor} onChange={e => setWmConfig({...wmConfig, textColor: e.target.value})} className="absolute inset-0 opacity-0 cursor-pointer" />
                                                                <div className="w-5 h-5 rounded-full shadow-sm border border-black/10" style={{ backgroundColor: wmConfig.textColor }}></div>
                                                            </div>
                                                            <input 
                                                                type="range" min="0.1" max="1" step="0.05" 
                                                                value={wmConfig.textOpacity} 
                                                                onChange={e => setWmConfig({...wmConfig, textOpacity: parseFloat(e.target.value)})} 
                                                                className="w-full accent-brand-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                                                            />
                                                       </div>
                                                    </div>

                                                    {/* Logo Watermark Controls */}
                                                    <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                                                        <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider mb-2 block">Logo Watermark</label>
                                                        
                                                        <div className="flex gap-2">
                                                            <button onClick={() => logoInputRef.current?.click()} className="flex-1 py-2 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
                                                                {wmConfig.logoFile ? <><ImageIcon className="w-3 h-3"/> Change Logo</> : <><Plus className="w-3 h-3"/> Upload Logo</>}
                                                            </button>
                                                            <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && setWmConfig(prev => ({...prev, logoFile: e.target.files![0]}))} />
                                                            
                                                            {wmConfig.logoFile && (
                                                                <button onClick={() => setWmConfig(prev => ({...prev, logoFile: null}))} className="p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors">
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>

                                                        {wmConfig.logoFile && (
                                                            <div className="space-y-4 mt-3 animate-fade-in">
                                                                {/* Logo Opacity */}
                                                                <div className="space-y-1">
                                                                    <div className="flex justify-between text-[10px] font-medium text-slate-400">
                                                                        <span>Opacity</span>
                                                                        <span>{Math.round(wmConfig.logoOpacity * 100)}%</span>
                                                                    </div>
                                                                    <input 
                                                                        type="range" min="0.1" max="1" step="0.05" 
                                                                        value={wmConfig.logoOpacity} 
                                                                        onChange={e => setWmConfig({...wmConfig, logoOpacity: parseFloat(e.target.value)})} 
                                                                        className="w-full accent-brand-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                                                                    />
                                                                </div>
                                                                
                                                                {/* Logo Scale */}
                                                                <div className="space-y-1">
                                                                    <div className="flex justify-between text-[10px] font-medium text-slate-400">
                                                                        <span>Size</span>
                                                                        <span>{Math.round(wmConfig.logoScale * 100)}%</span>
                                                                    </div>
                                                                    <input 
                                                                        type="range" min="0.1" max="1" step="0.05" 
                                                                        value={wmConfig.logoScale} 
                                                                        onChange={e => setWmConfig({...wmConfig, logoScale: parseFloat(e.target.value)})} 
                                                                        className="w-full accent-brand-500 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" 
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Filename Output Settings for Batch Mode */}
                                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                                                         <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 block flex items-center gap-1">Output Suffix <Info className="w-3 h-3 text-slate-400" /></label>
                                                         <input 
                                                            type="text" 
                                                            value={filenameSuffix}
                                                            onChange={(e) => setFilenameSuffix(e.target.value)}
                                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-brand-500 outline-none"
                                                            placeholder="e.g. vtunotesforall"
                                                         />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Desktop Process Action */}
                                        <div className="hidden lg:block pt-4">
                                            <button
                                                onClick={handleProcess}
                                                disabled={!isReady}
                                                className={`w-full py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 ${isReady ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-slate-900/20 dark:shadow-white/10' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
                                            >
                                                Start Processing <ArrowRightCircle className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>

      </main>

      {/* MOBILE BOTTOM DOCK NAVIGATION */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-sm">
          {isReady && processingState.status === MergeStatus.IDLE ? (
               <button
                  onClick={handleProcess}
                  className="w-full py-4 rounded-2xl bg-brand-600 text-white font-bold text-lg shadow-2xl shadow-brand-500/40 flex items-center justify-center gap-2 animate-slide-up"
              >
                  {mode === 'EDITOR' ? 'Compile PDF' : 'Process Files'} <ArrowRightCircle className="w-5 h-5" />
              </button>
          ) : (
              <div className="glass-nav rounded-2xl p-1.5 flex justify-between shadow-2xl shadow-black/20 border border-white/20 dark:border-slate-700/50">
                  {[
                    { id: 'MERGE', icon: Layers, label: 'Merge' },
                    { id: 'WATERMARK_ONLY', icon: Stamp, label: 'Batch' },
                    { id: 'EDITOR', icon: Edit, label: 'Editor' },
                  ].map((item) => (
                      <button
                          key={item.id}
                          onClick={() => { setMode(item.id as AppMode); clearAll(); }}
                          className={`flex-1 flex flex-col items-center justify-center py-2 rounded-xl transition-all ${mode === item.id ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-400'}`}
                      >
                          <item.icon className={`w-5 h-5 ${mode === item.id ? 'mb-0.5' : ''}`} />
                          {mode === item.id && <span className="text-[10px] font-bold">{item.label}</span>}
                      </button>
                  ))}
              </div>
          )}
      </div>

    </div>
  );
};

export default App;