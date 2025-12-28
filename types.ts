
export interface FileWithId {
  id: string;
  file: File;
}

export interface ProcessedFile {
  id: string;
  originalName: string;
  downloadFilename: string;
  processedData: Uint8Array;
  downloadUrl: string;
}

export enum MergeStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface ProcessingState {
  status: MergeStatus;
  message?: string;
  progress: number; // 0 to 100
}

export type AppMode = 'MERGE' | 'WATERMARK_ONLY' | 'EDITOR';

export interface PdfMetadata {
  title: string;
  author: string;
  subject?: string;
}

export interface WatermarkConfig {
  // Positions
  diagonal: boolean;
  bottom: boolean;
  top: boolean;
  crossed: boolean;
  
  // Text Styling
  textColor: string; // Hex code
  textOpacity: number; // 0 to 1

  // Logo Settings
  logoFile: File | null;
  logoOpacity: number; // 0 to 1
  logoScale: number; // 0.1 to 1.0 (relative to page width)
}

export interface EditorPage {
  id: string;
  fileId: string; // Reference to the uploaded file in memory
  originalPageIndex: number; // 0-based index in the original file
  rotation: number; // 0, 90, 180, 270
  thumbnailUrl: string;
}
