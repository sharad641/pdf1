import React, { useRef, useState } from 'react';
import { UploadCloud, Trash2, FileText, Upload, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
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
    <div className="w-full transition-all">
      {!hasFiles || multiple ? (
        <div 
          onClick={handleCardClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            group relative overflow-hidden
            border-2 border-dashed rounded-2xl p-6 md:p-8 
            flex flex-col items-center justify-center text-center cursor-pointer 
            transition-all duration-300 ease-out active:scale-98
            ${isDragging 
              ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10 scale-[1.02] shadow-xl shadow-brand-500/10' 
              : 'border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/30 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-white dark:hover:bg-slate-800'
            }
          `}
        >
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleChange}
            className="hidden"
          />
          
          <div className={`
            relative z-10 w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-3 md:mb-4 transition-all duration-300 shadow-sm
            ${isDragging 
               ? 'bg-brand-500 text-white rotate-6 scale-110 shadow-brand-500/30' 
               : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-400 group-hover:text-brand-500 group-hover:border-brand-200 dark:group-hover:border-brand-700 group-hover:scale-110'
            }
          `}>
            {isDragging ? <UploadCloud className="w-7 h-7 md:w-8 md:h-8 animate-bounce" /> : <Upload className="w-6 h-6 md:w-7 md:h-7" />}
          </div>
          
          <div className="relative z-10 space-y-1.5 md:space-y-2">
            <p className="text-sm md:text-base font-bold text-slate-700 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {label}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] md:max-w-[240px] mx-auto leading-relaxed">
              {isDragging ? "Release to drop files" : subLabel}
            </p>
          </div>
        </div>
      ) : null}

      {/* File List */}
      {hasFiles && (
        <div className={`mt-4 md:mt-5 space-y-2 md:space-y-3 ${multiple ? 'max-h-[300px] md:max-h-[320px] overflow-y-auto pr-1 custom-scrollbar' : ''}`}>
           {/* Header for list if multiple */}
           {multiple && (
               <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{files.length} PDF{files.length !== 1 && 's'}</span>
                  <button onClick={(e) => {e.stopPropagation(); handleCardClick()}} className="text-[10px] font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 hover:underline px-2 py-1 rounded hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors">
                      + Add PDF
                  </button>
               </div>
           )}

          {files.map((fileItem, index) => (
            <div 
              key={fileItem.id}
              className="relative flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm hover:shadow-md hover:border-brand-200 dark:hover:border-brand-800 transition-all group animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Drag Handle Visual (only if moveable) */}
              {multiple && onMoveUp && (
                 <div className="text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing hidden sm:block">
                    <GripVertical className="w-4 h-4" />
                 </div>
              )}

              <div className="flex-shrink-0 w-10 h-10 bg-rose-50 dark:bg-rose-950/30 rounded-lg flex items-center justify-center border border-rose-100 dark:border-rose-900/50 text-rose-500 dark:text-rose-400 group-hover:scale-105 transition-transform">
                 <FileText className="w-5 h-5" />
              </div>
              
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" title={fileItem.file.name}>
                  {fileItem.file.name}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {formatSize(fileItem.file.size)}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {multiple && onMoveUp && onMoveDown && (
                  <div className="flex flex-col gap-0.5">
                    <button 
                      onClick={(e) => {e.stopPropagation(); onMoveUp(index)}}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                      title="Move Up"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={(e) => {e.stopPropagation(); onMoveDown(index)}}
                      disabled={index === files.length - 1}
                      className="p-1 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
                      title="Move Down"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="w-px h-8 bg-slate-100 dark:bg-slate-800 mx-1"></div>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveFile(fileItem.id); }}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
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