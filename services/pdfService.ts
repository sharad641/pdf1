import { PDFDocument, rgb, degrees, StandardFonts, PDFPage, PDFFont, PDFImage } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { WatermarkConfig, PdfMetadata, EditorPage, FileWithId } from '../types';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

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
 * Generates the Default Cover Page if none is provided.
 * Replicates the design: Split BG, Cards, Pills, Community Hub.
 * Ensures only 1 page is generated (Requirement: remove page 2).
 */
const generateDefaultCoverPage = async (doc: PDFDocument, logoFile: File | null) => {
  const page = doc.addPage([595.28, 841.89]); // A4 Size
  const { width, height } = page.getSize();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);

  const darkBlue = rgb(0.04, 0.09, 0.25);
  const brandCyan = rgb(0.0, 0.7, 0.8);
  const cardBlue = rgb(0.1, 0.2, 0.5);

  // 1. Split Background
  // Top Part (Blue) approx 35%
  const headerHeight = height * 0.35;
  page.drawRectangle({
    x: 0, y: height - headerHeight,
    width, height: headerHeight,
    color: darkBlue,
  });

  // Top Glow effect
  page.drawRectangle({
    x: 0, y: height - (headerHeight * 0.8),
    width, height: headerHeight * 0.8,
    color: rgb(0.05, 0.12, 0.35),
    opacity: 0.5
  });

  let currentY = height - 80;

  // 2. Logo
  if (logoFile) {
    try {
      const logoBytes = await logoFile.arrayBuffer();
      let logoImage;
      if (logoFile.type === 'image/jpeg' || logoFile.name.endsWith('.jpg')) {
        logoImage = await doc.embedJpg(logoBytes);
      } else {
        logoImage = await doc.embedPng(logoBytes);
      }
      
      const logoDims = logoImage.scale(0.2); // Scale down
      page.drawImage(logoImage, {
        x: (width / 2) - (logoDims.width / 2),
        y: currentY - logoDims.height,
        width: logoDims.width,
        height: logoDims.height,
      });
      currentY -= (logoDims.height + 20);
    } catch (e) {
      console.warn("Failed to embed logo for default cover", e);
      currentY -= 50;
    }
  } else {
    currentY -= 80; 
  }

  // 3. Title Text
  const title = "vtunotesforall.in";
  const titleSize = 42;
  const titleWidth = fontBold.widthOfTextAtSize(title, titleSize);
  
  page.drawText(title, {
    x: (width / 2) - (titleWidth / 2),
    y: currentY,
    size: titleSize,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // 4. Subtitle
  const subtitle = "EXCELLENCE IN ENGINEERING RESOURCES";
  const subSize = 10;
  const subWidth = fontBold.widthOfTextAtSize(subtitle, subSize);
  
  page.drawText(subtitle, {
    x: (width / 2) - (subWidth / 2),
    y: currentY - 25,
    size: subSize,
    font: fontBold,
    color: brandCyan, 
  });

  // --- CARDS SECTION ---
  const cardY = height - headerHeight - 30; // Start just below header split
  const cardGap = 20;
  const cardWidth = (width - 100 - cardGap) / 2; // 50 margin each side
  const cardHeight = 140;

  // Left Card (About Us) - White
  page.drawRectangle({
    x: 50, y: cardY - cardHeight, width: cardWidth, height: cardHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 1
  });
  
  page.drawText("About Us", {
    x: 70, y: cardY - 30, size: 14, font: fontBold, color: darkBlue
  });
  page.drawText("A specialized digital ecosystem for VTU\nengineers. We provide syllabus-aligned,\nexam-centric resources to drive academic\nmastery and career success.", {
    x: 70, y: cardY - 55, size: 9, font: fontReg, color: rgb(0.4, 0.4, 0.4), lineHeight: 12
  });

  // Right Card (Projects & Career) - Blue
  page.drawRectangle({
    x: 50 + cardWidth + cardGap, y: cardY - cardHeight, width: cardWidth, height: cardHeight,
    color: cardBlue,
  });

  page.drawText("Projects & Career", {
    x: 50 + cardWidth + cardGap + 20, y: cardY - 30, size: 14, font: fontBold, color: brandCyan
  });
  
  // Custom List Drawing for Right Card (Avoiding Unicode Bullets which crash WinAnsi)
  const listStartY = cardY - 55;
  const listLineHeight = 16;
  const items = [
      "Placement Stories & Help",
      "Professional Project Inquiry",
      "Expert Career Guidance"
  ];
  
  items.forEach((item, i) => {
      const itemY = listStartY - (i * listLineHeight);
      // Draw Bullet Circle
      page.drawCircle({ x: 50 + cardWidth + cardGap + 20, y: itemY + 3, size: 2, color: rgb(1,1,1) });
      // Draw Text
      page.drawText(item, { x: 50 + cardWidth + cardGap + 30, y: itemY, size: 9, font: fontReg, color: rgb(1, 1, 1) });
  });

  // --- PILL BUTTONS SECTION ---
  const pillStartY = cardY - cardHeight - 30;
  const pillHeight = 30;
  const pillGapY = 15;
  const pills = [
    ["SGPA Calculator", "Previous Year Papers"],
    ["Model Question Papers", "Detailed QP Solutions"],
    ["Placement Stories", "Semester Blueprints"]
  ];

  // Helper to draw Diamond
  const drawDiamond = (cx: number, cy: number, r: number, color: any) => {
     const path = `M ${cx} ${cy+r} L ${cx+r} ${cy} L ${cx} ${cy-r} L ${cx-r} ${cy} Z`;
     page.drawSvgPath(path, { color, borderWidth: 0 });
  };

  pills.forEach((row, rowIndex) => {
    const y = pillStartY - (rowIndex * (pillHeight + pillGapY));
    const midY = y - (pillHeight/2);
    
    // Left Pill
    page.drawRectangle({ x: 50, y: y - pillHeight, width: cardWidth, height: pillHeight, color: rgb(0.96, 0.98, 1) });
    drawDiamond(62, midY + 15, 3, rgb(0.1, 0.1, 0.2)); // Adjusted Y for PDF coords (bottom-up) - wait, y is top of rect in drawing logic? 
    // PDFLib drawText y is baseline. drawRectangle y is bottom-left usually. 
    // In this func, I used y for top of text. 
    // drawRectangle y: y - pillHeight. So bottom is y-pillHeight.
    // midY = y - pillHeight/2.
    // Let's use simpler relative coords.
    // Text is at y-20. 
    // Icon should be around y-17.
    
    drawDiamond(62, y - 17, 3, rgb(0.1, 0.1, 0.2));
    page.drawText(row[0], { x: 72, y: y - 20, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.2) });

    // Right Pill
    const rightPillX = 50 + cardWidth + cardGap;
    page.drawRectangle({ x: rightPillX, y: y - pillHeight, width: cardWidth, height: pillHeight, color: rgb(0.96, 0.98, 1) });
    drawDiamond(rightPillX + 12, y - 17, 3, rgb(0.1, 0.1, 0.2));
    page.drawText(row[1], { x: rightPillX + 22, y: y - 20, size: 9, font: fontBold, color: rgb(0.1, 0.1, 0.2) });
  });

  // --- COMMUNITY HUB SECTION ---
  const hubY = pillStartY - (3 * (pillHeight + pillGapY)) - 20;
  const hubHeight = 150;
  
  page.drawRectangle({
    x: 50, y: hubY - hubHeight, width: width - 100, height: hubHeight,
    color: rgb(0.95, 0.96, 0.98)
  });

  page.drawText("Community Hub", {
    x: 70, y: hubY - 30, size: 14, font: fontBold, color: rgb(0.1, 0.1, 0.1)
  });
  page.drawText("Join thousands of VTU students in our digital circles.", {
    x: 70, y: hubY - 45, size: 9, font: fontReg, color: rgb(0.5, 0.5, 0.5)
  });

  // Icons (Simulated with squares)
  const iconY = hubY - 90;
  const iconSize = 30;
  // const iconGap = (width - 100 - 100) / 3;

  // Icon 1
  page.drawRectangle({ x: 100, y: iconY, width: iconSize, height: iconSize, color: rgb(0, 0.6, 0.5) });
  page.drawText("W", { x: 108, y: iconY + 8, size: 14, font: fontBold, color: rgb(1,1,1) });
  page.drawText("Updates", { x: 95, y: iconY - 15, size: 9, font: fontBold, color: rgb(0,0,0) });

  // Icon 2 (Center)
  const centerX = width / 2;
  page.drawRectangle({ x: centerX - 15, y: iconY, width: iconSize, height: iconSize, color: rgb(0, 0.6, 0.5) });
  page.drawText("W", { x: centerX - 7, y: iconY + 8, size: 14, font: fontBold, color: rgb(1,1,1) });
  page.drawText("Forum", { x: centerX - 15, y: iconY - 15, size: 9, font: fontBold, color: rgb(0,0,0) });

  // Icon 3
  page.drawRectangle({ x: width - 130, y: iconY, width: iconSize + 10, height: iconSize, color: rgb(0.9, 0.1, 0.1) });
  page.drawText("nammaVTUbros", { x: width - 155, y: iconY - 15, size: 9, font: fontBold, color: rgb(0,0,0) });


  // Footer
  const footerText = "vtunotesforall.in   |   EMPOWERING ENGINEERS EVERY SEMESTER";
  const fWidth = fontBold.widthOfTextAtSize(footerText, 8);
  
  // Footer BG
  page.drawRectangle({ x: 0, y: 0, width, height: 60, color: darkBlue });
  
  page.drawText(footerText, {
      x: (width/2) - (fWidth/2),
      y: 25,
      size: 8,
      font: fontBold,
      color: rgb(1,1,1)
  });
};

/**
 * Merges PDFs (Strict Mode)
 */
export const mergeAndWatermarkPdfs = async (
  coverFile: File | undefined,
  contentFiles: File[],
  onProgress: (progress: number) => void,
  metadata?: PdfMetadata,
  defaultCoverLogo?: File | null, // Param for default cover generation
  useDefaultCover: boolean = false // Flag to enable default cover
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
    
    // Step 1: Cover Page logic
    if (coverFile) {
      onProgress(5);
      const coverBytes = await coverFile.arrayBuffer();
      const coverDoc = await PDFDocument.load(coverBytes);
      const indices = coverDoc.getPageIndices();
      const copiedCoverPages = await mergedPdf.copyPages(coverDoc, indices);
      copiedCoverPages.forEach((page) => mergedPdf.addPage(page));
    } else if (useDefaultCover) {
      // GENERATE DEFAULT COVER (Single Page) ONLY if flag is true
      onProgress(5);
      await generateDefaultCoverPage(mergedPdf, defaultCoverLogo || null);
    }
    
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


// --- EDITOR SERVICES ---

/**
 * Generates thumbnails for all pages in a PDF file
 */
export const generatePdfThumbnails = async (
  fileItem: FileWithId, 
  onProgress?: (curr: number, total: number) => void
): Promise<EditorPage[]> => {
  const fileArrayBuffer = await fileItem.file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(fileArrayBuffer).promise;
  const totalPages = pdf.numPages;
  const pages: EditorPage[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.3 }); // Low scale for thumbnail speed
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({ canvasContext: context, viewport: viewport }).promise;
      pages.push({
        id: Math.random().toString(36).substring(2, 9),
        fileId: fileItem.id,
        originalPageIndex: i - 1, // PDFLib is 0-based
        rotation: 0,
        thumbnailUrl: canvas.toDataURL()
      });
    }
    
    if (onProgress) onProgress(i, totalPages);
  }

  return pages;
};

/**
 * Builds the final PDF from the Editor Page List
 */
export const buildPdfFromEditor = async (
  editorPages: EditorPage[], 
  sourceFiles: FileWithId[]
): Promise<Uint8Array> => {
  const newPdf = await PDFDocument.create();
  
  // Cache loaded PDFDocuments to avoid re-parsing the same file multiple times
  const loadedDocs: Record<string, PDFDocument> = {};

  for (const page of editorPages) {
    let srcDoc = loadedDocs[page.fileId];
    
    if (!srcDoc) {
      const sourceFile = sourceFiles.find(f => f.id === page.fileId);
      if (!sourceFile) continue; // Should not happen
      const bytes = await sourceFile.file.arrayBuffer();
      srcDoc = await PDFDocument.load(bytes);
      loadedDocs[page.fileId] = srcDoc;
    }

    const [copiedPage] = await newPdf.copyPages(srcDoc, [page.originalPageIndex]);
    
    // Apply Rotation
    const currentRotation = copiedPage.getRotation().angle;
    copiedPage.setRotation(degrees(currentRotation + page.rotation));
    
    newPdf.addPage(copiedPage);
  }

  return await newPdf.save();
};