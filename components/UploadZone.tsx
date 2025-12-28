import React, { useRef, useState } from 'react';
import { UploadCloud, Trash2, Upload, ChevronUp, ChevronDown, GripVertical, FileType, Check } from 'lucide-react';
import { FileWithId } from '../types';

interface UploadZoneProps {
  id: string;
  label: string;
  subLabel: string;
  accept: string;
  multiple?: boolean;
  files: FileWithId[];
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (id: string) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  required?: boolean;
}

const UploadZone: React.FC<UploadZoneProps> = ({
  id,
  label,
  subLabel,
  accept,
  multiple = false,
  files,
  onFilesSelected,
  onRemoveFile,
  onMoveUp,
  onMoveDown,
  required = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const validFiles = Array.from(e.dataTransfer.files).filter((f: File) => f.type === 'application/pdf');
      if (validFiles.length > 0) {
        if (!multiple) {
            onFilesSelected([validFiles[0]]);
        } else {
            onFilesSelected(validFiles);
        }
      }
    }
  };

  const handleCardClick = () => {
    inputRef.current?.click();
  };

  const hasFiles = files.length > 0;

  // Format bytes to human readable string
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full">
      {/* Hidden Input */}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />

      {/* Drop Area */}
      {(!hasFiles || (multiple && hasFiles)) && (
        <div 
          onClick={handleCardClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            group relative overflow-hidden
            rounded-2xl transition-all duration-500 ease-out cursor-pointer
            ${hasFiles && multiple ? 'border-2 border-dashed border-slate-200 dark:border-slate-800 bg-transparent py-4' : 'border-2 border-dashed py-8 md:py-10'}
            ${isDragging 
              ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20 scale-[1.01] shadow-xl shadow-brand-500/10' 
              : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-white dark:hover:bg-slate-800'
            }
          `}
        >
            <div className={`flex flex-col items-center justify-center text-center ${hasFiles ? 'gap-2' : 'gap-3'} relative z-10`}>
                <div className={`
                    rounded-2xl flex items-center justify-center transition-all duration-500 ease-spring
                    ${isDragging ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30 rotate-12 scale-110' : 'bg-white dark:bg-slate-800 text-brand-500 shadow-md shadow-slate-200/50 dark:shadow-none'}
                    ${hasFiles ? 'w-10 h-10' : 'w-14 h-14 md:w-16 md:h-16'}
                `}>
                    {isDragging ? <UploadCloud className={hasFiles ? "w-5 h-5" : "w-7 h-7"} /> : <Upload className={hasFiles ? "w-5 h-5" : "w-7 h-7"} strokeWidth={1.5} />}
                </div>
                
                <div className="space-y-1">
                    <p className={`font-display font-semibold text-slate-700 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors ${hasFiles ? 'text-sm' : 'text-base md:text-lg'}`}>
                    {hasFiles ? "Add more files" : label} {required && !hasFiles && <span className="text-red-500">*</span>}
                    </p>
                    {!hasFiles && <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">{subLabel}</p>}
                </div>
            </div>
            
            {/* Animated Background Mesh */}
            <div className={`absolute inset-0 bg-gradient-to-tr from-brand-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
        </div>
      )}

      {/* File List */}
      {hasFiles && (
        <div className={`space-y-3 ${multiple ? 'mt-4 max-h-[360px] overflow-y-auto custom-scrollbar pr-1' : 'mt-0'}`}>
            {/* Header for list */}
           {multiple && (
               <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{files.length} File{files.length !== 1 && 's'}</span>
               </div>
           )}

          {files.map((fileItem, index) => (
            <div 
              key={fileItem.id}
              className="group relative flex items-center gap-4 p-3 bg-white dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-sm hover:shadow-lg hover:border-brand-300 dark:hover:border-brand-700 hover:-translate-y-0.5 transition-all duration-300 animate-scale-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Drag Handle or Indicator */}
              {multiple && onMoveUp ? (
                 <div className="text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing hover:text-slate-500 dark:hover:text-slate-400 p-1">
                    <GripVertical className="w-4 h-4" />
                 </div>
              ) : (
                  <div className="w-1.5 h-10 bg-brand-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
              )}

              {/* Icon */}
              <div className="flex-shrink-0 w-10 h-10 bg-rose-50 dark:bg-rose-900/20 rounded-xl flex items-center justify-center border border-rose-100 dark:border-rose-900/30 text-rose-500 dark:text-rose-400">
                 <FileType className="w-5 h-5" strokeWidth={1.5} />
              </div>
              
              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate font-display">
                  {fileItem.file.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {formatSize(fileItem.file.size)}
                  </span>
                  {!multiple && <span className="text-[10px] text-emerald-500 flex items-center gap-1"><Check className="w-3 h-3" /> Ready</span>}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                {multiple && onMoveUp && onMoveDown && (
                  <div className="flex flex-col gap-1 mr-2">
                    <button 
                      onClick={(e) => {e.stopPropagation(); onMoveUp(index)}}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md disabled:opacity-20 transition-colors"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={(e) => {e.stopPropagation(); onMoveDown(index)}}
                      disabled={index === files.length - 1}
                      className="p-1 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md disabled:opacity-20 transition-colors"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
                {!multiple && (
                    <button
                        onClick={(e) => { e.stopPropagation(); handleCardClick(); }}
                        className="p-2 text-slate-400 hover:text-brand-600 bg-slate-50 dark:bg-slate-900 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-xl transition-all"
                        title="Replace file"
                    >
                        <UploadCloud className="w-4 h-4" />
                    </button>
                )}
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveFile(fileItem.id); }}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                  title="Remove file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UploadZone;