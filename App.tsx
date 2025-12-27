import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Header from './components/Header';
import UploadZone from './components/UploadZone';
import { FileWithId, MergeStatus, ProcessingState, AppMode, ProcessedFile, WatermarkConfig, PdfMetadata } from './types';
import { mergeAndWatermarkPdfs, processBatchFile, mergeProcessedFiles } from './services/pdfService';
import { FileDown, RefreshCw, CheckCircle, AlertTriangle, Layers, FileCheck, Download, Stamp, ArrowDownToLine, ArrowUpToLine, X, Image as ImageIcon, Settings2, Sparkles, FileText, Undo2, LayoutTemplate, PenTool, Type, Trash2, ArrowRightCircle, Plus, Maximize, Sun } from 'lucide-react';

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('theme') === 'dark' || 
               (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  
  const [mode, setMode] = useState<AppMode>('MERGE');
  
  const [coverFile, setCoverFile] = useState<FileWithId[]>([]);
  const [contentFiles, setContentFiles] = useState<FileWithId[]>([]);
  
  const [activeTab, setActiveTab] = useState<'watermark' | 'metadata'>('watermark');

  const [metadata, setMetadata] = useState<PdfMetadata>({
    title: '',
    author: ''
  });

  const [wmConfig, setWmConfig] = useState<WatermarkConfig>({
    diagonal: true,
    bottom: true,
    top: false,
    crossed: false,
    textColor: '#808080',
    textOpacity: 0.2,
    logoFile: null,
    logoOpacity: 0.5,
    logoScale: 0.5
  });

  const [filenameSuffix, setFilenameSuffix] = useState('vtunotesforall');
  const [batchMergedFilename, setBatchMergedFilename] = useState('All_Files_Merged');
  
  const [processingState, setProcessingState] = useState<ProcessingState>({
    status: MergeStatus.IDLE,
    progress: 0,
  });

  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  
  const resultsRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const logoPreviewUrl = useMemo(() => {
    if (wmConfig.logoFile) {
      return URL.createObjectURL(wmConfig.logoFile);
    }
    return null;
  }, [wmConfig.logoFile]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  useEffect(() => {
    if (processingState.status === MergeStatus.SUCCESS && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [processingState.status]);

  const handleCoverSelect = useCallback((files: File[]) => {
    if (files.length > 0) setCoverFile([{ id: generateId(), file: files[0] }]);
  }, []);

  const handleContentSelect = useCallback((files: File[]) => {
    const newFiles = files.map(f => ({ id: generateId(), file: f }));
    setContentFiles(prev => [...prev, ...newFiles]);
  }, []);

  const removeCover = useCallback(() => {
    setCoverFile([]);
    cleanupResults();
  }, []);

  const removeContent = useCallback((id: string) => {
    setContentFiles(prev => prev.filter(f => f.id !== id));
    cleanupResults();
  }, []);

  const clearAllFiles = () => {
    if (window.confirm("Are you sure you want to remove all files?")) {
      setCoverFile([]);
      setContentFiles([]);
      cleanupResults();
    }
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    const newFiles = [...contentFiles];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < newFiles.length) {
      [newFiles[index], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[index]];
      setContentFiles(newFiles);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setWmConfig(prev => ({ ...prev, logoFile: e.target.files![0] }));
    }
  };
  
  const removeLogo = () => {
    setWmConfig(prev => ({ ...prev, logoFile: null }));
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const cleanupResults = () => {
    if (mergedPdfUrl) URL.revokeObjectURL(mergedPdfUrl);
    processedFiles.forEach(f => URL.revokeObjectURL(f.downloadUrl));
    setMergedPdfUrl(null);
    setProcessedFiles([]);
    setProcessingState({ status: MergeStatus.IDLE, progress: 0 });
    setBatchMergedFilename('All_Files_Merged');
  };

  const switchMode = (newMode: AppMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setCoverFile([]);
    setContentFiles([]);
    cleanupResults();
    if (newMode === 'WATERMARK_ONLY') {
      setWmConfig({
        diagonal: true,
        bottom: true,
        top: false,
        crossed: false,
        textColor: '#808080',
        textOpacity: 0.2,
        logoFile: null,
        logoOpacity: 0.5,
        logoScale: 0.5
      });
      setFilenameSuffix('vtunotesforall');
    }
  };

  const toggleWmOption = (key: keyof Pick<WatermarkConfig, 'diagonal' | 'bottom' | 'top' | 'crossed'>) => {
    setWmConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getOutputFilename = (originalName: string) => {
    const namePart = originalName.replace(/\.pdf$/i, '');
    const cleanSuffix = filenameSuffix.trim();
    if (!cleanSuffix) return `${namePart}.pdf`;
    if (namePart.endsWith(`_${cleanSuffix}`) || namePart.endsWith(cleanSuffix)) {
      return `${namePart}.pdf`;
    }
    return `${namePart}_${cleanSuffix}.pdf`;
  };

  const handleDownloadAllMerged = async () => {
    if (processedFiles.length === 0) return;
    
    try {
        const allBytes = processedFiles.map(f => f.processedData);
        const mergedBytes = await mergeProcessedFiles(allBytes);
        const blob = new Blob([mergedBytes as any], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        
        let filename = batchMergedFilename.trim() || 'All_Files_Merged';
        if (!filename.toLowerCase().endsWith('.pdf')) {
            filename += '.pdf';
        }

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Failed to merge processed files", error);
        alert("Failed to create combined PDF.");
    }
  };

  const handleProcess = async () => {
    setProcessingState({ status: MergeStatus.PROCESSING, progress: 0, message: "Initializing..." });

    try {
      await new Promise(r => setTimeout(r, 600)); 

      if (mode === 'MERGE') {
        if (coverFile.length === 0 || contentFiles.length === 0) return;

        const mergedBytes = await mergeAndWatermarkPdfs(
          coverFile[0].file,
          contentFiles.map(f => f.file),
          (p) => setProcessingState(prev => ({ ...prev, progress: p, message: "Merging pages..." })),
          metadata
        );

        const blob = new Blob([mergedBytes as any], { type: 'application/pdf' });
        setMergedPdfUrl(URL.createObjectURL(blob));

      } else {
        if (contentFiles.length === 0) return;
        
        const total = contentFiles.length;
        const results: ProcessedFile[] = [];
        const currentCover = coverFile.length > 0 ? coverFile[0].file : undefined;

        for (let i = 0; i < total; i++) {
          setProcessingState({ 
            status: MergeStatus.PROCESSING, 
            progress: ((i / total) * 100), 
            message: `Processing file ${i + 1} of ${total}...` 
          });

          const f = contentFiles[i];
          const bytes = await processBatchFile(f.file, currentCover, wmConfig, metadata);
          const blob = new Blob([bytes as any], { type: 'application/pdf' });
          
          results.push({
            id: f.id,
            originalName: f.file.name,
            downloadFilename: getOutputFilename(f.file.name),
            processedData: bytes,
            downloadUrl: URL.createObjectURL(blob)
          });
        }
        setProcessedFiles(results);
      }

      setProcessingState({ status: MergeStatus.SUCCESS, progress: 100, message: "Done!" });

    } catch (error) {
      setProcessingState({ 
        status: MergeStatus.ERROR, 
        progress: 0, 
        message: error instanceof Error ? error.message : "An unexpected error occurred." 
      });
    }
  };

  const handleDownloadMerged = () => {
    if (mergedPdfUrl) {
      const link = document.createElement('a');
      link.href = mergedPdfUrl;
      link.download = metadata.title ? `${metadata.title.replace(/[^a-z0-9]/gi, '_')}.pdf` : 'VTU_Notes_Merged.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const isReady = mode === 'MERGE' 
    ? (coverFile.length > 0 && contentFiles.length > 0)
    : (contentFiles.length > 0); 

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-200/20 dark:bg-brand-900/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-200/20 dark:bg-indigo-900/10 blur-[100px]" />
      </div>

      <Header darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} />

      <main className="flex-grow w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24 relative z-10">
        
        {/* Intro Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 lg:mb-16 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-brand-600 dark:text-brand-400 text-[11px] font-bold mb-6 lg:mb-8 tracking-widest uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Secure PDF Tools v2.0</span>
          </div>
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 leading-[1.1]">
            Transform your PDFs <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600 dark:from-brand-400 dark:to-indigo-400">Instantly & Securely</span>
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg leading-relaxed max-w-2xl mx-auto">
            Merge notes, apply custom watermarks, and organize files directly in your browser. 
            No uploads, no servers, complete privacy.
          </p>
        </div>

        {/* Mode Toggles */}
        <div className="flex justify-center mb-12 lg:mb-16 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-xl shadow-slate-200/40 dark:shadow-black/40 border border-slate-200/60 dark:border-slate-800 inline-flex relative w-full sm:w-auto min-w-[320px] sm:min-w-[360px]">
            <button
              onClick={() => switchMode('MERGE')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 md:px-6 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 relative z-10 ${mode === 'MERGE' ? 'text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              <Layers className="w-4 h-4" />
              Merge Mode
            </button>
            <button
              onClick={() => switchMode('WATERMARK_ONLY')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 md:px-6 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 relative z-10 ${mode === 'WATERMARK_ONLY' ? 'text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
            >
              <FileCheck className="w-4 h-4" />
              Batch Process
            </button>
            
            {/* Sliding Background */}
            <div className={`absolute top-1.5 bottom-1.5 rounded-xl bg-slate-900 dark:bg-brand-600 shadow-lg shadow-slate-900/20 dark:shadow-brand-600/20 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${mode === 'MERGE' ? 'left-1.5 w-[calc(50%-3px)]' : 'left-[calc(50%+3px)] w-[calc(50%-6px)]'}`}></div>
          </div>
        </div>

        {/* Main Interface Wrapper */}
        <div className="relative animate-fade-in" style={{ animationDelay: '200ms' }}>
          
          {/* Progress Overlay */}
          <div className={`fixed inset-x-0 top-0 h-1.5 z-50 transition-opacity duration-300 ${processingState.status === MergeStatus.PROCESSING ? 'opacity-100' : 'opacity-0'}`}>
             <div 
              className="h-full bg-gradient-to-r from-brand-400 via-brand-500 to-indigo-500 shadow-[0_0_15px_rgba(14,165,233,0.6)] transition-all duration-300 ease-out"
              style={{ width: `${processingState.progress}%` }}
            />
          </div>

            {/* ERROR STATE */}
            {processingState.status === MergeStatus.ERROR && (
              <div className="max-w-2xl mx-auto mb-8 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-2xl p-6 flex items-start gap-4 animate-slide-up shadow-sm">
                <div className="p-3 bg-white dark:bg-rose-950/50 rounded-full flex-shrink-0 shadow-sm border border-rose-100 dark:border-rose-900/50 text-rose-500 dark:text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-rose-900 dark:text-rose-100">Process Failed</h3>
                  <p className="text-sm text-rose-700 dark:text-rose-300 mt-1 leading-relaxed">{processingState.message}</p>
                  <button onClick={cleanupResults} className="mt-4 text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 px-4 py-2 rounded-lg hover:bg-rose-200 dark:hover:bg-rose-900/60 transition-colors inline-flex items-center gap-2">
                    <Undo2 className="w-3.5 h-3.5" /> Try Again
                  </button>
                </div>
              </div>
            )}

            {/* SUCCESS STATE */}
            {processingState.status === MergeStatus.SUCCESS ? (
               <div ref={resultsRef} className="glass-panel rounded-[2.5rem] p-8 md:p-12 lg:p-16 border border-white/40 dark:border-slate-700/40 shadow-2xl shadow-slate-200/50 dark:shadow-black/50 text-center animate-slide-up max-w-4xl mx-auto">
                <div className="mb-8 relative inline-block">
                    <div className="absolute inset-0 bg-emerald-500 blur-[40px] opacity-20 dark:opacity-40 rounded-full animate-pulse-slow"></div>
                    <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/30 text-white animate-bounce-subtle rotate-3">
                        <CheckCircle className="w-12 h-12" />
                    </div>
                </div>
                
                <h3 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">All Done!</h3>
                <p className="text-slate-600 dark:text-slate-400 text-lg mb-10 max-w-md mx-auto">
                    Your files have been processed successfully and are ready for download.
                </p>

                {/* MERGE RESULT */}
                {mode === 'MERGE' && mergedPdfUrl && (
                  <div className="w-full max-w-md mx-auto space-y-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex items-center gap-5 text-left">
                       <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-500 dark:text-red-400 shrink-0 border border-red-100 dark:border-red-900/30">
                          <FileText className="w-8 h-8" />
                       </div>
                       <div className="grow min-w-0">
                          <div className="font-bold text-lg text-slate-800 dark:text-slate-200 truncate">
                             {metadata.title ? metadata.title : 'VTU_Notes_Merged'}
                          </div>
                          <div className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">
                             PDF Document
                          </div>
                       </div>
                    </div>
                    
                    <button onClick={handleDownloadMerged} className="w-full group flex items-center justify-center gap-3 bg-slate-900 dark:bg-brand-600 hover:bg-slate-800 dark:hover:bg-brand-500 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-xl shadow-slate-900/20 dark:shadow-brand-500/20 hover:-translate-y-1 transition-all active:scale-95">
                        <FileDown className="w-6 h-6 group-hover:animate-bounce" /> 
                        <span>Download PDF</span>
                    </button>
                    
                    <button onClick={cleanupResults} className="w-full text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white py-3 transition-colors flex items-center justify-center gap-2">
                        <Undo2 className="w-4 h-4" /> Start New Merge
                    </button>
                  </div>
                )}

                {/* BATCH RESULTS */}
                {mode === 'WATERMARK_ONLY' && processedFiles.length > 0 && (
                   <div className="w-full animate-slide-up" style={{ animationDelay: '100ms' }}>
                      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                          <div className="p-4 md:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-800/30">
                             <div className="text-left w-full lg:w-auto">
                                <h4 className="font-bold text-lg md:text-xl text-slate-900 dark:text-white flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                                    Processed Files
                                </h4>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{processedFiles.length} documents ready.</p>
                             </div>
                             
                             <div className="flex flex-col sm:flex-row items-center gap-2 bg-white dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm w-full lg:w-auto">
                                 <input 
                                    type="text"
                                    value={batchMergedFilename}
                                    onChange={(e) => setBatchMergedFilename(e.target.value)}
                                    className="text-sm border-none focus:ring-0 w-full sm:w-48 px-3 text-slate-700 dark:text-slate-200 font-medium placeholder-slate-400 bg-transparent py-2 sm:py-0"
                                    placeholder="Merged Filename"
                                 />
                                 <button 
                                    onClick={handleDownloadAllMerged}
                                    className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
                                 >
                                    <Download className="w-3.5 h-3.5" /> Merge & Download
                                 </button>
                             </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100 dark:bg-slate-800 max-h-[500px] overflow-y-auto custom-scrollbar">
                             {processedFiles.map(pf => (
                                <div key={pf.id} className="bg-white dark:bg-slate-900 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between group">
                                   <div className="flex items-center gap-4 min-w-0">
                                      <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-100 dark:border-emerald-900/30">
                                         <FileText className="w-5 h-5" />
                                      </div>
                                      <div className="min-w-0 text-left">
                                         <div className="font-semibold text-sm text-slate-700 dark:text-slate-200 truncate">{pf.downloadFilename}</div>
                                         <div className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{pf.originalName}</div>
                                      </div>
                                   </div>
                                   <a href={pf.downloadUrl} download={pf.downloadFilename} className="p-2.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors" title="Download File">
                                      <Download className="w-5 h-5" />
                                   </a>
                                </div>
                             ))}
                          </div>
                      </div>
                      
                      <div className="mt-8 text-center">
                        <button onClick={cleanupResults} className="text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center gap-2 mx-auto">
                            <Undo2 className="w-4 h-4" /> Start Over
                        </button>
                      </div>
                   </div>
                )}
              </div>
            ) : (
              /* INPUT & SETTINGS GRID */
              <div className={`grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 items-start ${processingState.status === MergeStatus.PROCESSING ? 'opacity-50 pointer-events-none grayscale-[0.8] blur-[1px]' : ''} transition-all duration-500`}>
                
                {/* Left Column: Input */}
                <div className="xl:col-span-7 space-y-6 lg:space-y-8 animate-slide-up">
                    <div className="glass-panel rounded-[2rem] p-1.5 shadow-xl shadow-slate-200/50 dark:shadow-black/20 border border-white/50 dark:border-slate-700/50">
                        <div className="bg-white/50 dark:bg-slate-900/50 rounded-[1.7rem] p-5 md:p-8 space-y-8">
                            
                            {/* Actions Header */}
                            <div className="flex justify-between items-center pb-4 border-b border-slate-200/50 dark:border-slate-700/50">
                                <h3 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                  <UploadZoneIcon className="w-4 h-4" />
                                  Input Files
                                </h3>
                                {(coverFile.length > 0 || contentFiles.length > 0) && (
                                    <button onClick={clearAllFiles} className="text-xs text-rose-600 dark:text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 flex items-center gap-1 font-bold px-3 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" /> Clear All
                                    </button>
                                )}
                            </div>

                            {/* Section 1: Cover */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 dark:bg-brand-600 text-white text-sm font-bold shadow-lg shadow-slate-300 dark:shadow-brand-900/30">1</div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Cover Page</h3>
                                    </div>
                                    {mode === 'WATERMARK_ONLY' && (
                                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full uppercase tracking-wide">
                                        Optional
                                      </span>
                                    )}
                                </div>
                                <UploadZone
                                    id="cover-upload"
                                    label="Upload Cover PDF"
                                    subLabel={mode === 'MERGE' ? "First page, no watermark applied" : "Prepended to every processed file"}
                                    accept=".pdf"
                                    multiple={false}
                                    files={coverFile}
                                    onFilesSelected={handleCoverSelect}
                                    onRemoveFile={removeCover}
                                    required={mode === 'MERGE'}
                                />
                            </div>

                            {/* Section 2: Content */}
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 dark:bg-brand-600 text-white text-sm font-bold shadow-lg shadow-slate-300 dark:shadow-brand-900/30">2</div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{mode === 'MERGE' ? 'Content Pages' : 'Batch Files'}</h3>
                                </div>
                                <UploadZone
                                    id="content-upload"
                                    label={mode === 'MERGE' ? "Upload Content PDFs" : "Upload PDFs to Process"}
                                    subLabel={mode === 'MERGE' ? "Reorder files to set merge sequence" : "Watermark will be applied to all"}
                                    accept=".pdf"
                                    multiple={true}
                                    files={contentFiles}
                                    onFilesSelected={handleContentSelect}
                                    onRemoveFile={removeContent}
                                    onMoveUp={(idx) => moveFile(idx, 'up')}
                                    onMoveDown={(idx) => moveFile(idx, 'down')}
                                    required
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Settings */}
                <div className="xl:col-span-5 space-y-6 lg:space-y-8 animate-slide-up xl:sticky xl:top-24" style={{ animationDelay: '100ms' }}>
                    
                    {/* Settings Panel */}
                    <div className="glass-panel rounded-[2rem] border border-white/50 dark:border-slate-700/50 shadow-xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden flex flex-col">
                        
                        {/* Tabs */}
                        <div className="p-3">
                           <div className="grid grid-cols-2 gap-1 bg-slate-100/80 dark:bg-slate-900/50 p-1.5 rounded-2xl">
                              <button 
                                  onClick={() => setActiveTab('watermark')}
                                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'watermark' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                              >
                                  <Settings2 className="w-3.5 h-3.5" /> Watermark
                              </button>
                              <button 
                                  onClick={() => setActiveTab('metadata')}
                                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${activeTab === 'metadata' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                              >
                                  <PenTool className="w-3.5 h-3.5" /> Metadata
                              </button>
                           </div>
                        </div>

                        {/* Panel Content */}
                        <div className="flex-grow p-6 md:p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                           
                           {/* METADATA TAB */}
                           {activeTab === 'metadata' && (
                               <div className="space-y-6 animate-fade-in">
                                   <div className="space-y-5">
                                       <div className="space-y-2">
                                           <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                               <Type className="w-3.5 h-3.5" /> Document Title
                                           </label>
                                           <input 
                                                type="text" 
                                                placeholder="e.g. Engineering Mathematics III" 
                                                value={metadata.title}
                                                onChange={(e) => setMetadata({...metadata, title: e.target.value})}
                                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:text-slate-200 placeholder-slate-400 transition-all"
                                           />
                                       </div>
                                       <div className="space-y-2">
                                           <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                               <PenTool className="w-3.5 h-3.5" /> Author Name
                                           </label>
                                           <input 
                                                type="text" 
                                                placeholder="e.g. VTU Notes Team" 
                                                value={metadata.author}
                                                onChange={(e) => setMetadata({...metadata, author: e.target.value})}
                                                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:text-slate-200 placeholder-slate-400 transition-all"
                                           />
                                       </div>
                                   </div>
                                   
                                   <div className="bg-brand-50/80 dark:bg-brand-900/20 p-5 rounded-2xl border border-brand-100 dark:border-brand-900/30 flex gap-3">
                                       <div className="shrink-0 pt-0.5 text-brand-500">
                                          <Sparkles className="w-4 h-4" />
                                       </div>
                                       <p className="text-xs text-brand-700 dark:text-brand-300 leading-relaxed font-medium">
                                           Pro Tip: Adding clear metadata improves how your PDFs appear in search results and document readers.
                                       </p>
                                   </div>
                               </div>
                           )}

                           {/* WATERMARK TAB */}
                           {activeTab === 'watermark' && (
                             mode === 'WATERMARK_ONLY' ? (
                                <div className="space-y-8 animate-fade-in">
                                    {/* Live Preview */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Live Preview</label>
                                        </div>
                                        <div className="aspect-[16/9] bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 relative overflow-hidden group shadow-inner">
                                            <div className="absolute inset-5 bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 rounded-lg"></div>
                                            <div className="absolute inset-8 border border-dashed border-slate-200 dark:border-slate-700 opacity-60 rounded-md"></div>
                                            
                                            {/* Logo Layer */}
                                            {logoPreviewUrl && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10" style={{ opacity: wmConfig.logoOpacity }}>
                                                <img src={logoPreviewUrl} alt="" className="object-contain transition-all duration-300" style={{ width: `${wmConfig.logoScale * 80}%` }} />
                                            </div>
                                            )}
                                            
                                            {/* Text Layer */}
                                            <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden" style={{ color: wmConfig.textColor }}>
                                                {wmConfig.diagonal && <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-bold uppercase -rotate-[60deg] opacity-50" style={{ opacity: wmConfig.textOpacity }}>vtunotesforall</span></div>}
                                                {wmConfig.crossed && <div className="absolute inset-0 flex items-center justify-center"><span className="text-2xl font-bold uppercase rotate-[60deg] opacity-50" style={{ opacity: wmConfig.textOpacity }}>vtunotesforall</span></div>}
                                                {wmConfig.top && <div className="absolute top-8 w-full text-center"><span className="text-[10px] font-bold uppercase opacity-80" style={{ opacity: Math.min(wmConfig.textOpacity + 0.4, 1) }}>vtunotesforall</span></div>}
                                                {wmConfig.bottom && <div className="absolute bottom-8 w-full text-center"><span className="text-[10px] font-bold uppercase opacity-80" style={{ opacity: Math.min(wmConfig.textOpacity + 0.4, 1) }}>vtunotesforall</span></div>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Controls */}
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-4 gap-2">
                                            {[
                                                { id: 'diagonal', icon: Stamp, label: 'Diag' },
                                                { id: 'bottom', icon: ArrowDownToLine, label: 'Bot' },
                                                { id: 'top', icon: ArrowUpToLine, label: 'Top' },
                                                { id: 'crossed', icon: X, label: 'Cross' },
                                            ].map((opt) => {
                                                const isActive = wmConfig[opt.id as keyof WatermarkConfig];
                                                const Icon = opt.icon;
                                                return (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => toggleWmOption(opt.id as any)}
                                                        className={`flex flex-col items-center justify-center py-3 rounded-xl text-[10px] font-bold transition-all border ${isActive ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-400 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent text-slate-500 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                                    >
                                                        <Icon className="w-4 h-4 mb-1" />
                                                        {opt.label}
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        {/* Color & Text Opacity */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
                                                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Color</label>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 shadow-sm">
                                                       <input type="color" value={wmConfig.textColor} onChange={e => setWmConfig(prev => ({...prev, textColor: e.target.value}))} className="absolute -top-2 -left-2 w-12 h-12 p-0 cursor-pointer border-none" />
                                                    </div>
                                                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300">{wmConfig.textColor}</span>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                <div className="flex justify-between items-center mb-2">
                                                   <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Text Opacity</label>
                                                   <span className="text-[10px] font-mono text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded">{Math.round(wmConfig.textOpacity * 100)}%</span>
                                                </div>
                                                <input type="range" min="0.1" max="1" step="0.1" value={wmConfig.textOpacity} onChange={e => setWmConfig(prev => ({...prev, textOpacity: parseFloat(e.target.value)}))} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg accent-brand-600 cursor-pointer" />
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-200/50 dark:border-slate-700/50 pt-5">
                                            <div className="flex justify-between items-center mb-4">
                                                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2"><ImageIcon className="w-3.5 h-3.5" /> Logo Overlay</label>
                                                {wmConfig.logoFile && <button onClick={removeLogo} className="text-[10px] text-red-500 hover:underline font-bold">REMOVE</button>}
                                            </div>
                                            {!wmConfig.logoFile ? (
                                                <div onClick={() => logoInputRef.current?.click()} className="border border-dashed border-slate-300 dark:border-slate-600 hover:border-brand-400 dark:hover:border-brand-500 bg-slate-50 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-900/50 rounded-xl p-6 text-center cursor-pointer transition-all group">
                                                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                                                    <div className="flex flex-col items-center justify-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                                        <div className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                                           <Plus className="w-4 h-4 text-brand-500" />
                                                        </div>
                                                        <span>Upload PNG / JPG Logo</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-800 space-y-6">
                                                    {/* File Info Card */}
                                                    <div className="flex items-center gap-3 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 shadow-sm">
                                                        <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-0.5 flex items-center justify-center overflow-hidden">
                                                             <img src={logoPreviewUrl!} className="w-full h-full object-contain" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{wmConfig.logoFile.name}</div>
                                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{(wmConfig.logoFile.size / 1024).toFixed(1)} KB</div>
                                                        </div>
                                                        <button onClick={removeLogo} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 rounded-lg transition-colors" title="Remove Logo">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    
                                                    {/* Controls */}
                                                    <div className="grid grid-cols-1 gap-5">
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between items-center">
                                                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                                   <Maximize className="w-3.5 h-3.5" /> Scale
                                                                </label>
                                                                <span className="text-[10px] font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">{Math.round(wmConfig.logoScale * 100)}%</span>
                                                            </div>
                                                            <input type="range" min="0.1" max="1" step="0.05" value={wmConfig.logoScale} onChange={e => setWmConfig(prev => ({...prev, logoScale: parseFloat(e.target.value)}))} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                                        </div>
                                                        
                                                        <div className="space-y-3">
                                                             <div className="flex justify-between items-center">
                                                                <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                                   <Sun className="w-3.5 h-3.5" /> Opacity
                                                                </label>
                                                                <span className="text-[10px] font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">{Math.round(wmConfig.logoOpacity * 100)}%</span>
                                                            </div>
                                                            <input type="range" min="0.1" max="1" step="0.05" value={wmConfig.logoOpacity} onChange={e => setWmConfig(prev => ({...prev, logoOpacity: parseFloat(e.target.value)}))} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="border-t border-slate-200/50 dark:border-slate-700/50 pt-5">
                                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2 block">Output Suffix</label>
                                            <div className="flex items-center bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 transition-all">
                                                <span className="text-xs text-slate-400 mr-1 font-mono">_</span>
                                                <input type="text" value={filenameSuffix} onChange={e => setFilenameSuffix(e.target.value)} className="bg-transparent border-none p-0 text-sm text-slate-700 dark:text-slate-200 w-full focus:ring-0 placeholder-slate-400 font-medium" placeholder="suffix" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                             ) : (
                               /* Locked View for Merge */
                               <div className="h-full flex flex-col items-center justify-center text-center p-4 animate-fade-in">
                                   <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/10 rounded-full flex items-center justify-center text-brand-500 mb-4 ring-8 ring-brand-50/50 dark:ring-brand-900/10">
                                       <LayoutTemplate className="w-8 h-8" />
                                   </div>
                                   <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Standard Merge Profile</h4>
                                   <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mb-8 leading-relaxed">
                                       This mode uses a strict configuration to ensure consistency across all VTU notes.
                                   </p>
                                   
                                   <div className="w-full max-w-xs space-y-3 text-left bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                       <div className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
                                           <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                                           <span>Separate Cover Page</span>
                                       </div>
                                       <div className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
                                           <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                                           <span>Diagonal "vtunotesforall" Watermark</span>
                                       </div>
                                       <div className="flex items-start gap-3 text-xs text-slate-600 dark:text-slate-300">
                                           <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                                           <span>Automated Page Sequencing</span>
                                       </div>
                                   </div>
                               </div>
                             )
                           )}
                        </div>
                    </div>

                    {/* ACTION BUTTON */}
                    <div className="pt-2">
                        <button
                          onClick={handleProcess}
                          disabled={!isReady}
                          className={`
                            w-full group relative overflow-hidden
                            flex items-center justify-center gap-3 py-5 rounded-2xl font-bold text-lg tracking-tight transition-all duration-300
                            ${isReady 
                              ? 'bg-slate-900 dark:bg-brand-600 text-white shadow-xl shadow-slate-900/20 dark:shadow-brand-600/20 hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99]' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                            }
                          `}
                        >
                             {processingState.status === MergeStatus.PROCESSING ? (
                                <>
                                  <RefreshCw className="w-5 h-5 animate-spin" />
                                  <span>Processing Files...</span>
                                </>
                             ) : (
                                <>
                                  <span>{mode === 'MERGE' ? 'Merge Documents' : 'Start Batch Process'}</span>
                                  <ArrowRightCircle className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                                </>
                             )}
                        </button>
                    </div>

                </div>
              </div>
            )}
          </div>
      </main>
    </div>
  );
};

// Helper Icon for generic use
const UploadZoneIcon = ({className}:{className?: string}) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

export default App;