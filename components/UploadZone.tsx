import React, { useRef, useState } from 'react';
import { UploadCloud, Trash2, CheckCircle2, FileText } from 'lucide-react';
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

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {label} 
          {required && !hasFiles && (
            <span className="flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
              Required
            </span>
          )}
          {hasFiles && (
             <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
               <CheckCircle2 className="w-3 h-3" /> Ready
             </span>
          )}
        </label>
        {hasFiles && (
          <span className="text-xs font-medium text-slate-500">
            {files.length} {files.length === 1 ? 'file' : 'files'} selected
          </span>
        )}
      </div>

      {!hasFiles || multiple ? (
        <div 
          onClick={handleCardClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            group relative overflow-hidden
            border-2 border-dashed rounded-2xl p-8 
            flex flex-col items-center justify-center text-center cursor-pointer 
            transition-all duration-300 ease-out
            ${isDragging 
              ? 'border-brand-500 bg-brand-50/50 scale-[1.01] shadow-lg ring-4 ring-brand-100' 
              : hasFiles 
                ? 'border-brand-200 bg-slate-50 hover:bg-white hover:border-brand-400 hover:shadow-md' 
                : 'border-slate-300 bg-white hover:border-brand-400 hover:bg-slate-50 hover:shadow-md'
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
            relative z-10 p-4 rounded-full mb-4 transition-all duration-300
            ${isDragging ? 'bg-brand-100 text-brand-600 scale-110' : 'bg-slate-100 text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-500 group-hover:scale-110'}
          `}>
            <UploadCloud className={`w-8 h-8 ${isDragging ? 'animate-bounce' : ''}`} />
          </div>
          
          <div className="relative z-10 space-y-1">
            <p className="text-base font-semibold text-slate-700 group-hover:text-brand-700 transition-colors">
              {isDragging ? "Drop to upload" : "Click to upload or drag & drop"}
            </p>
            <p className="text-xs text-slate-400 group-hover:text-slate-500 transition-colors">{subLabel}</p>
          </div>

          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] [background-size:16px_16px]"></div>
        </div>
      ) : null}

      {/* File List */}
      {hasFiles && (
        <div className={`mt-4 space-y-3 ${multiple ? 'max-h-80 overflow-y-auto pr-2 custom-scrollbar' : ''}`}>
          {files.map((fileItem, index) => (
            <div 
              key={fileItem.id}
              className="flex items-center justify-between p-3.5 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md hover:border-brand-200 transition-all group animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="flex-shrink-0 w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center border border-rose-100 group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5 text-rose-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-700 truncate group-hover:text-brand-600 transition-colors">{fileItem.file.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    {multiple && <span className="text-[10px] text-slate-400">#{index + 1}</span>}
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveFile(fileItem.id); }}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                title="Remove file"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UploadZone;