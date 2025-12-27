import { PDFDocument, rgb, degrees, StandardFonts, PDFPage, PDFFont, PDFImage } from 'pdf-lib';
import { WatermarkConfig, PdfMetadata } from '../types';

const DEFAULT_WATERMARK_TEXT = 'vtunotesforall';
const STRICT_WATERMARK_COLOR = rgb(0.5, 0.5, 0.5); 
const WATERMARK_ANGLE = 60; 

// Standard configuration for Merge Mode (Strict Rules per requirements)
const DEFAULT_MERGE_CONFIG: WatermarkConfig = {
  diagonal: true,
  bottom: true,
  top: false,
  crossed: false,
  textColor: '#808080',
  textOpacity: 0.2,
  logoFile: null,
  logoOpacity: 0.5,
  logoScale: 0.5
};

// Helper to convert Hex to PDF RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? rgb(
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ) : STRICT_WATERMARK_COLOR;
};

/**
 * Applies watermark (Text + Optional Logo) to a single page
 */
const applyWatermarkToPage = (
  page: PDFPage, 
  font: PDFFont, 
  config: WatermarkConfig,
  logoImage: PDFImage | null = null
) => {
  const { width, height } = page.getSize();
  const color = hexToRgb(config.textColor);
  const opacity = config.textOpacity;

  // --- 1. Logo Watermark (Centered Background) ---
  if (logoImage) {
    const logoDims = logoImage.scale(1);
    const scaleFactor = (width * config.logoScale) / logoDims.width;
    const scaledWidth = logoDims.width * scaleFactor;
    const scaledHeight = logoDims.height * scaleFactor;

    page.drawImage(logoImage, {
      x: (width / 2) - (scaledWidth / 2),
      y: (height / 2) - (scaledHeight / 2),
      width: scaledWidth,
      height: scaledHeight,
      opacity: config.logoOpacity,
    });
  }
  
  // Helper to draw rotated text
  const drawRotatedWatermark = (angle: number) => {
    // Responsive font size: 11% of the smallest dimension
    const fontSize = Math.min(width, height) * 0.11;
    const textWidth = font.widthOfTextAtSize(DEFAULT_WATERMARK_TEXT, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    // Geometric Centering for Rotated Text
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const pCx = width / 2;
    const pCy = height / 2;

    const x = pCx - (textWidth / 2 * cos - textHeight / 2 * sin);
    const y = pCy - (textWidth / 2 * sin + textHeight / 2 * cos);

    page.drawText(DEFAULT_WATERMARK_TEXT, {
      x,
      y,
      size: fontSize,
      font: font,
      color: color,
      opacity: opacity,
      rotate: degrees(angle),
    });
  };

  // --- 2. Main Diagonal Watermark ---
  if (config.diagonal) {
    drawRotatedWatermark(WATERMARK_ANGLE);
  }

  // --- 3. Crossed Diagonal Watermark ---
  if (config.crossed) {
    drawRotatedWatermark(-WATERMARK_ANGLE);
  }

  // --- 4. Bottom Footer Watermark ---
  if (config.bottom) {
    const footerSize = 10;
    const footerWidth = font.widthOfTextAtSize(DEFAULT_WATERMARK_TEXT, footerSize);
    
    page.drawText(DEFAULT_WATERMARK_TEXT, {
      x: (width / 2) - (footerWidth / 2),
      y: 15,
      size: footerSize,
      font: font,
      color: color,
      opacity: Math.min(opacity + 0.4, 1), // Slightly more visible for footer
    });
  }

  // --- 5. Top Header Watermark ---
  if (config.top) {
    const headerSize = 10;
    const headerWidth = font.widthOfTextAtSize(DEFAULT_WATERMARK_TEXT, headerSize);
    
    page.drawText(DEFAULT_WATERMARK_TEXT, {
      x: (width / 2) - (headerWidth / 2),
      y: height - 25,
      size: headerSize,
      font: font,
      color: color,
      opacity: Math.min(opacity + 0.4, 1), // Slightly more visible for header
    });
  }
};

/**
 * Merges PDFs (Strict Mode)
 */
export const mergeAndWatermarkPdfs = async (
  coverFile: File,
  contentFiles: File[],
  onProgress: (progress: number) => void,
  metadata?: PdfMetadata
): Promise<Uint8Array> => {
  try {
    const mergedPdf = await PDFDocument.create();
    
    // Set Metadata
    if (metadata) {
      if (metadata.title) mergedPdf.setTitle(metadata.title);
      if (metadata.author) mergedPdf.setAuthor(metadata.author);
      mergedPdf.setCreator('VTU Notes Merging System');
    }

    const helveticaFont = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
    
    // Step 1: Cover Page
    onProgress(5);
    const coverBytes = await coverFile.arrayBuffer();
    const coverDoc = await PDFDocument.load(coverBytes);
    const copiedCoverPages = await mergedPdf.copyPages(coverDoc, coverDoc.getPageIndices());
    copiedCoverPages.forEach((page) => mergedPdf.addPage(page));
    
    onProgress(15);

    // Step 2: Content PDFs
    const totalFiles = contentFiles.length;
    for (let i = 0; i < totalFiles; i++) {
      const fileBytes = await contentFiles[i].arrayBuffer();
      const contentDoc = await PDFDocument.load(fileBytes);
      const copiedContentPages = await mergedPdf.copyPages(contentDoc, contentDoc.getPageIndices());
      
      copiedContentPages.forEach((page) => {
        const addedPage = mergedPdf.addPage(page);
        // Use default config for strict merge mode
        applyWatermarkToPage(addedPage, helveticaFont, DEFAULT_MERGE_CONFIG);
      });

      const progressChunk = 80 / totalFiles;
      onProgress(15 + ((i + 1) * progressChunk));
    }

    onProgress(95);
    const pdfBytes = await mergedPdf.save();
    onProgress(100);
    return pdfBytes;
  } catch (error) {
    console.error("Merge error", error);
    throw new Error("Failed to process PDFs. Ensure files are valid.");
  }
};

/**
 * Processes a single file (Batch Mode with Custom Config)
 */
export const processBatchFile = async (
  contentFile: File,
  coverFile: File | undefined,
  config: WatermarkConfig,
  metadata?: PdfMetadata
): Promise<Uint8Array> => {
  const finalPdf = await PDFDocument.create();
  
  // Set Metadata
  if (metadata) {
    if (metadata.title) finalPdf.setTitle(metadata.title);
    if (metadata.author) finalPdf.setAuthor(metadata.author);
    finalPdf.setCreator('VTU Notes Merging System');
  }

  const helveticaFont = await finalPdf.embedFont(StandardFonts.HelveticaBold);

  // Embed Logo if exists
  let embeddedLogo: PDFImage | null = null;
  if (config.logoFile) {
    try {
      const logoBytes = await config.logoFile.arrayBuffer();
      // Attempt to embed based on file type. PDFLib usually needs strict types, 
      // but we can try catch block for png/jpg
      if (config.logoFile.type === 'image/jpeg' || config.logoFile.name.toLowerCase().endsWith('.jpg') || config.logoFile.name.toLowerCase().endsWith('.jpeg')) {
        embeddedLogo = await finalPdf.embedJpg(logoBytes);
      } else {
        // Default to PNG for other types or explicit PNG
        embeddedLogo = await finalPdf.embedPng(logoBytes);
      }
    } catch (e) {
      console.warn("Failed to embed logo", e);
    }
  }

  // 1. Add Cover (No Watermark)
  if (coverFile) {
    const coverBytes = await coverFile.arrayBuffer();
    const coverDoc = await PDFDocument.load(coverBytes);
    const copiedCoverPages = await finalPdf.copyPages(coverDoc, coverDoc.getPageIndices());
    copiedCoverPages.forEach(p => finalPdf.addPage(p));
  }

  // 2. Add Content (With Watermark)
  const contentBytes = await contentFile.arrayBuffer();
  const contentDoc = await PDFDocument.load(contentBytes);
  const copiedContentPages = await finalPdf.copyPages(contentDoc, contentDoc.getPageIndices());
  
  copiedContentPages.forEach(p => {
    const addedPage = finalPdf.addPage(p);
    applyWatermarkToPage(addedPage, helveticaFont, config, embeddedLogo);
  });
  
  return await finalPdf.save();
};

/**
 * Merges multiple pre-processed PDF buffers into a single PDF
 */
export const mergeProcessedFiles = async (processedFiles: Uint8Array[]): Promise<Uint8Array> => {
  const mergedPdf = await PDFDocument.create();
  mergedPdf.setCreator('VTU Notes Merging System');
  
  for (const bytes of processedFiles) {
    const doc = await PDFDocument.load(bytes);
    const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  
  return await mergedPdf.save();
};