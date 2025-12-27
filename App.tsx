import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Header from './components/Header';
import UploadZone from './components/UploadZone';
import { FileWithId, MergeStatus, ProcessingState, AppMode, ProcessedFile, WatermarkConfig } from './types';
import { mergeAndWatermarkPdfs, processBatchFile, mergeProcessedFiles } from './services/pdfService';
import { FileDown, RefreshCw, CheckCircle, AlertTriangle, ArrowRight, Layers, FileCheck, Download, Stamp, ArrowDownToLine, ArrowUpToLine, Eye, X, Palette, Image as ImageIcon, Sliders, Upload, FileStack, ChevronRight, Settings2, Sparkles, FileText } from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('MERGE');
  
  const [coverFile, setCoverFile] = useState<FileWithId[]>([]);
  const [contentFiles, setContentFiles] = useState<FileWithId[]>([]);
  
  // Watermark Settings
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

  // Logo Preview URL
  const logoPreviewUrl = useMemo(() => {
    if (wmConfig.logoFile) {
      return URL.createObjectURL(wmConfig.logoFile);
    }
    return null;
  }, [wmConfig.logoFile]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Auto-scroll
  useEffect(() => {
    if (processingState.status === MergeStatus.SUCCESS && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [processingState.status]);

  // File Handlers
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

  // Logo Handlers
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
      // Reset to default batch config
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
        // Reuse status for basic feedback, although immediate usually
        const mergedBytes = await mergeProcessedFiles(allBytes);
        const blob = new Blob([mergedBytes], { type: 'application/pdf' });
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

  // Process Logic
  const handleProcess = async () => {
    setProcessingState({ status: MergeStatus.PROCESSING, progress: 0, message: "Initializing..." });

    try {
      await new Promise(r => setTimeout(r, 500)); 

      if (mode === 'MERGE') {
        if (coverFile.length === 0 || contentFiles.length === 0) return;

        const mergedBytes = await mergeAndWatermarkPdfs(
          coverFile[0].file,
          contentFiles.map(f => f.file),
          (p) => setProcessingState(prev => ({ ...prev, progress: p, message: "Processing pages & merging..." }))
        );

        const blob = new Blob([mergedBytes], { type: 'application/pdf' });
        setMergedPdfUrl(URL.createObjectURL(blob));

      } else {
        // Batch Mode
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
          const bytes = await processBatchFile(f.file, currentCover, wmConfig);
          const blob = new Blob([bytes], { type: 'application/pdf' });
          
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

      setProcessingState({ status: MergeStatus.SUCCESS, progress: 100, message: "Processing Complete!" });

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
      link.download = 'VTU_Notes_Merged_vtunotesforall.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const isReady = mode === 'MERGE' 
    ? (coverFile.length > 0 && contentFiles.length > 0)
    : (contentFiles.length > 0); 

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pt-16 md:pt-20">
      <Header />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        
        {/* Intro Section */}
        <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold mb-4 tracking-wide uppercase">
            <Sparkles className="w-3 h-3" />
            PDF Utility Suite
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
            Manage your PDF Documents <br className="hidden sm:block" /> with <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">Precision & Ease</span>
          </h2>
          <p className="text-slate-500 text-sm md:text-base leading-relaxed max-w-lg mx-auto">
            Securely merge notes, add watermarks, and organize academic content entirely in your browser. No server uploads, 100% private.
          </p>
        </div>

        {/* Mode Toggles */}
        <div className="flex justify-center mb-10 animate-fade-in delay-75">
          <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 inline-flex relative w-full sm:w-auto max-w-md">
            <button
              onClick={() => switchMode('MERGE')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold transition-all relative z-10 ${mode === 'MERGE' ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Layers className="w-4 h-4" />
              Merge Mode
            </button>
            <button
              onClick={() => switchMode('WATERMARK_ONLY')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold transition-all relative z-10 ${mode === 'WATERMARK_ONLY' ? 'text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <FileCheck className="w-4 h-4" />
              Batch Process
            </button>
            
            {/* Sliding Background */}
            <div className={`absolute top-1.5 bottom-1.5 rounded-xl bg-slate-900 transition-all duration-300 ease-spring ${mode === 'MERGE' ? 'left-1.5 w-[calc(50%-6px)] sm:w-[155px]' : 'left-[calc(50%+3px)] sm:left-[161px] w-[calc(50%-6px)] sm:w-[160px]'}`}></div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative animate-fade-in delay-100">
          
          {/* Progress Bar (Floating) */}
          <div className={`absolute top-0 left-0 right-0 h-1 bg-brand-50 z-20 ${processingState.status === MergeStatus.PROCESSING ? 'opacity-100' : 'opacity-0'}`}>
            <div 
              className="h-full bg-gradient-to-r from-brand-400 to-brand-600 shadow-[0_0_10px_rgba(14,165,233,0.5)] transition-all duration-300 ease-out"
              style={{ width: `${processingState.progress}%` }}
            />
          </div>

          <div className="p-6 sm:p-10 lg:p-12 space-y-12">

            {/* ERROR MESSAGE */}
            {processingState.status === MergeStatus.ERROR && (
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 flex items-start gap-4 animate-slide-up">
                <div className="p-2 bg-rose-100 rounded-full flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-900">Process Failed</h3>
                  <p className="text-sm text-rose-700 mt-1 leading-relaxed">{processingState.message}</p>
                  <button onClick={cleanupResults} className="mt-3 text-xs font-bold text-rose-700 hover:text-rose-800 flex items-center gap-1 group">
                    Try Again <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              </div>
            )}

            {/* SUCCESS STATE */}
            {processingState.status === MergeStatus.SUCCESS ? (
              <div ref={resultsRef} className="animate-slide-up space-y-10">
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-emerald-50/50">
                    <CheckCircle className="w-10 h-10 text-emerald-500 animate-pulse-slow" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">Processing Complete!</h3>
                  <p className="text-slate-500">Your files have been successfully processed and are ready.</p>
                </div>

                {/* MERGE RESULT */}
                {mode === 'MERGE' && mergedPdfUrl && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 md:p-12 text-center max-w-2xl mx-auto">
                    <div className="mb-8">
                        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h4 className="text-lg font-semibold text-slate-800">VTU_Notes_Merged.pdf</h4>
                        <p className="text-sm text-slate-500">Ready for download</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button onClick={handleDownloadMerged} className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all w-full sm:w-auto">
                        <FileDown className="w-5 h-5" /> Download PDF
                      </button>
                      <button onClick={cleanupResults} className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 px-8 py-3.5 rounded-xl font-semibold transition-all w-full sm:w-auto">
                        <RefreshCw className="w-4 h-4" /> Process New
                      </button>
                    </div>
                  </div>
                )}

                {/* BATCH RESULT */}
                {mode === 'WATERMARK_ONLY' && processedFiles.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    {/* Header Toolbar */}
                    <div className="bg-slate-50 border-b border-slate-200 p-4 md:p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                                <FileStack className="w-4 h-4 text-brand-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Processed Files</h4>
                                <p className="text-xs text-slate-500">{processedFiles.length} documents ready</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                            {processedFiles.length > 1 && (
                                <div className="flex items-center p-1 bg-white border border-slate-300 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 transition-all w-full sm:w-auto">
                                    <input 
                                      type="text"
                                      value={batchMergedFilename}
                                      onChange={(e) => setBatchMergedFilename(e.target.value)}
                                      className="text-sm border-none focus:ring-0 w-full sm:w-40 px-3 text-slate-700 placeholder-slate-400 bg-transparent outline-none font-medium"
                                      placeholder="Combined Name"
                                    />
                                    <span className="text-xs text-slate-400 font-medium px-2 select-none border-l border-slate-100">.pdf</span>
                                    <button 
                                        onClick={handleDownloadAllMerged}
                                        className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition-colors whitespace-nowrap ml-1 shadow-sm"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        Merge & Download
                                    </button>
                                </div>
                            )}
                            
                            <button onClick={cleanupResults} className="text-sm text-slate-600 font-medium hover:text-slate-900 px-4 py-2 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap">Start Over</button>
                        </div>
                    </div>

                    {/* File List Grid */}
                    <div className="bg-white max-h-[500px] overflow-y-auto p-2 md:p-4 grid grid-cols-1 md:grid-cols-2 gap-3 custom-scrollbar">
                      {processedFiles.map((pf) => (
                        <div key={pf.id} className="p-4 rounded-xl border border-slate-100 hover:border-brand-200 bg-white hover:bg-brand-50/30 transition-all group flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 overflow-hidden">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:text-brand-600 group-hover:shadow-sm transition-all flex-shrink-0">
                              <CheckCircle className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 pt-0.5">
                                <span className="block text-sm font-semibold text-slate-700 truncate mb-0.5">{pf.downloadFilename}</span>
                                <span className="block text-xs text-slate-400 truncate">From: {pf.originalName}</span>
                            </div>
                          </div>
                          <a 
                            href={pf.downloadUrl} 
                            download={pf.downloadFilename} 
                            className="flex-shrink-0 p-2 text-slate-400 hover:text-brand-600 hover:bg-white hover:shadow-sm rounded-lg border border-transparent hover:border-slate-200 transition-all"
                            title="Download Single File"
                          >
                            <Download className="w-5 h-5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* INPUT FORM */
              <div className={`grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 ${processingState.status === MergeStatus.PROCESSING ? 'opacity-50 pointer-events-none filter grayscale-[0.5]' : ''}`}>
                
                {/* Left Column: Uploads */}
                <div className="lg:col-span-7 space-y-8 animate-slide-up">
                    
                    {/* 1. Cover Page */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 text-white text-sm font-bold shadow-md shadow-slate-200">1</div>
                            <h3 className="text-lg font-bold text-slate-900">Cover Page</h3>
                         </div>
                         {mode === 'WATERMARK_ONLY' && <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-md">Optional</span>}
                      </div>
                      <UploadZone
                        id="cover-upload"
                        label="Select Cover PDF"
                        subLabel={mode === 'MERGE' ? "First page of the document (No Watermark)" : "Prepended to all files"}
                        accept=".pdf"
                        multiple={false}
                        files={coverFile}
                        onFilesSelected={handleCoverSelect}
                        onRemoveFile={removeCover}
                        required={mode === 'MERGE'}
                      />
                    </div>

                    <div className="w-full h-px bg-slate-100"></div>

                    {/* 2. Content Files */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 text-white text-sm font-bold shadow-md shadow-slate-200">2</div>
                        <h3 className="text-lg font-bold text-slate-900">{mode === 'MERGE' ? 'Content Notes' : 'Files to Process'}</h3>
                      </div>
                      <UploadZone
                        id="content-upload"
                        label={mode === 'MERGE' ? "Select Note Files" : "Select PDFs"}
                        subLabel="These files will be watermarked"
                        accept=".pdf"
                        multiple={true}
                        files={contentFiles}
                        onFilesSelected={handleContentSelect}
                        onRemoveFile={removeContent}
                        required
                      />
                    </div>
                </div>

                {/* Right Column: Settings & Action */}
                <div className="lg:col-span-5 space-y-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
                    
                    {/* Watermark Configuration Card */}
                    {mode === 'WATERMARK_ONLY' ? (
                      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-1 overflow-hidden shadow-sm">
                        <div className="bg-white rounded-xl border border-slate-200/60 p-5 space-y-6">
                            
                            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                                <Settings2 className="w-4 h-4 text-brand-600" />
                                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Watermark Settings</h3>
                            </div>

                            {/* Live Preview (Compact) */}
                            <div className="aspect-[1.414/1] bg-slate-100 rounded-lg border border-slate-200 relative overflow-hidden shadow-inner group">
                                <div className="absolute inset-4 bg-white shadow-sm border border-slate-100"></div>
                                {/* Mock Lines */}
                                <div className="absolute inset-8 border border-dashed border-slate-100 opacity-50"></div>
                                
                                {/* Logo Layer */}
                                {logoPreviewUrl && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10" style={{ opacity: wmConfig.logoOpacity }}>
                                    <img src={logoPreviewUrl} alt="" className="object-contain transition-all duration-300" style={{ width: `${wmConfig.logoScale * 80}%` }} />
                                  </div>
                                )}
                                
                                {/* Text Layer */}
                                <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden" style={{ color: wmConfig.textColor }}>
                                    {wmConfig.diagonal && <div className="absolute inset-0 flex items-center justify-center"><span className="text-lg font-bold uppercase -rotate-[60deg] opacity-50" style={{ opacity: wmConfig.textOpacity }}>vtunotesforall</span></div>}
                                    {wmConfig.crossed && <div className="absolute inset-0 flex items-center justify-center"><span className="text-lg font-bold uppercase rotate-[60deg] opacity-50" style={{ opacity: wmConfig.textOpacity }}>vtunotesforall</span></div>}
                                    {wmConfig.top && <div className="absolute top-6 w-full text-center"><span className="text-[8px] font-bold uppercase opacity-80" style={{ opacity: Math.min(wmConfig.textOpacity + 0.4, 1) }}>vtunotesforall</span></div>}
                                    {wmConfig.bottom && <div className="absolute bottom-6 w-full text-center"><span className="text-[8px] font-bold uppercase opacity-80" style={{ opacity: Math.min(wmConfig.textOpacity + 0.4, 1) }}>vtunotesforall</span></div>}
                                </div>

                                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">Preview</div>
                            </div>

                            {/* Controls Grid */}
                            <div className="space-y-5">
                                {/* Toggles */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-2 block">Position</label>
                                    <div className="flex bg-slate-100 p-1 rounded-lg">
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
                                                    className={`flex-1 flex flex-col items-center py-1.5 rounded-md text-[10px] font-medium transition-all ${isActive ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    <Icon className="w-3.5 h-3.5 mb-0.5" />
                                                    {opt.label}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Sliders & Colors */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-2 block">Color</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" value={wmConfig.textColor} onChange={e => setWmConfig(prev => ({...prev, textColor: e.target.value}))} className="w-8 h-8 rounded-full border-none p-0 cursor-pointer shadow-sm ring-2 ring-white" />
                                            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-1.5 py-1 rounded">{wmConfig.textColor}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-slate-500 mb-2 block">Opacity</label>
                                        <input type="range" min="0.1" max="1" step="0.1" value={wmConfig.textOpacity} onChange={e => setWmConfig(prev => ({...prev, textOpacity: parseFloat(e.target.value)}))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-500" />
                                    </div>
                                </div>

                                {/* Logo Upload */}
                                <div className="pt-2 border-t border-slate-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-semibold text-slate-500">Logo Overlay</label>
                                        {wmConfig.logoFile && <button onClick={removeLogo} className="text-[10px] text-red-500 hover:underline">Remove</button>}
                                    </div>
                                    {!wmConfig.logoFile ? (
                                        <div onClick={() => logoInputRef.current?.click()} className="border border-dashed border-slate-300 rounded-lg p-3 text-center cursor-pointer hover:bg-slate-50 transition-colors">
                                            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
                                            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                                                <ImageIcon className="w-3 h-3" />
                                                <span>Upload PNG/JPG</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                             <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <div className="w-6 h-6 rounded bg-white flex items-center justify-center overflow-hidden border border-slate-200"><img src={logoPreviewUrl!} className="w-full h-full object-cover" /></div>
                                                <span className="text-xs text-slate-600 truncate flex-1">{wmConfig.logoFile.name}</span>
                                             </div>
                                             <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] text-slate-400 block mb-1">Scale</label>
                                                    <input type="range" min="0.1" max="1" step="0.1" value={wmConfig.logoScale} onChange={e => setWmConfig(prev => ({...prev, logoScale: parseFloat(e.target.value)}))} className="w-full h-1 bg-slate-200 rounded appearance-none accent-brand-500" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-400 block mb-1">Opacity</label>
                                                    <input type="range" min="0.1" max="1" step="0.1" value={wmConfig.logoOpacity} onChange={e => setWmConfig(prev => ({...prev, logoOpacity: parseFloat(e.target.value)}))} className="w-full h-1 bg-slate-200 rounded appearance-none accent-brand-500" />
                                                </div>
                                             </div>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Filename */}
                                <div className="pt-2 border-t border-slate-100">
                                     <label className="text-xs font-semibold text-slate-500 mb-2 block">Filename Suffix</label>
                                     <div className="flex items-center bg-slate-100 rounded-lg px-3 py-2">
                                        <span className="text-xs text-slate-400 mr-1">_</span>
                                        <input type="text" value={filenameSuffix} onChange={e => setFilenameSuffix(e.target.value)} className="bg-transparent border-none p-0 text-xs text-slate-700 w-full focus:ring-0 placeholder-slate-400" placeholder="suffix" />
                                     </div>
                                </div>

                            </div>
                        </div>
                      </div>
                    ) : (
                       /* Instructions for Merge Mode */
                       <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                           <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                               <CheckCircle className="w-4 h-4 text-brand-500" />
                               Merge Rules
                           </h3>
                           <ul className="space-y-3">
                               <li className="flex gap-3 text-sm text-slate-600">
                                   <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 flex-shrink-0" />
                                   <span>Cover page remains <strong>untouched</strong> (no watermark).</span>
                               </li>
                               <li className="flex gap-3 text-sm text-slate-600">
                                   <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 flex-shrink-0" />
                                   <span>All content notes are appended in order.</span>
                               </li>
                               <li className="flex gap-3 text-sm text-slate-600">
                                   <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-2 flex-shrink-0" />
                                   <span>Watermark "vtunotesforall" applied diagonally.</span>
                               </li>
                           </ul>
                       </div>
                    )}

                    {/* Main Action Button */}
                    <button
                      onClick={handleProcess}
                      disabled={!isReady}
                      className={`
                        w-full group relative overflow-hidden
                        flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-lg shadow-lg transition-all duration-300
                        ${isReady 
                          ? 'bg-slate-900 text-white hover:bg-brand-600 hover:shadow-brand-500/25 hover:-translate-y-1' 
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        }
                      `}
                    >
                        <span className="relative z-10 flex items-center gap-2">
                             {processingState.status === MergeStatus.PROCESSING ? (
                                <>
                                  <RefreshCw className="w-5 h-5 animate-spin" />
                                  <span>Processing...</span>
                                </>
                             ) : (
                                <>
                                  <span>{mode === 'MERGE' ? 'Merge Documents' : 'Process Batch'}</span>
                                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                             )}
                        </span>
                        
                        {/* Button Glow Effect */}
                        {isReady && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>}
                    </button>

                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm font-medium text-slate-500">
            &copy; {new Date().getFullYear()} <span className="text-slate-900">VTU Notes For All</span>.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Optimized for performance & privacy.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;