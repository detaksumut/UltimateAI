/**
 * SlideRenderer.mjs
 * Renders a corporate slide schema to vector SVG, compact PNG preview, and
 * an editable native-shape PowerPoint OpenXML package. No external browser is
 * required, so the renderer works in local Windows and server runtimes.
 */
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import Jimp from 'jimp';

const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 720;
const EMU_PER_PIXEL = 9525;

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
function xmlEsc(value = '') {
  return esc(value);
}
function hexToRgb(hex, fallback = '#0B1220') {
  const raw = String(hex || fallback).replace('#', '').trim();
  const safe = /^[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback.replace('#', '');
  return [parseInt(safe.slice(0, 2), 16), parseInt(safe.slice(2, 4), 16), parseInt(safe.slice(4, 6), 16)];
}
function toHex(rgb) {
  return rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function choosePalette(schema) {
  const primary = schema?.theme?.primaryColor || '#0F766E';
  return {
    background: '#0B1220',
    background2: '#12233B',
    card: '#13263C',
    card2: '#17334B',
    white: '#F8FAFC',
    muted: '#B8C7D9',
    primary,
    accent: schema?.theme?.accentColor || '#2DD4BF',
    gold: '#F4B860',
    divider: '#35516B',
    danger: '#F87171',
    success: '#6EE7B7'
  };
}
function svgText(x, y, text, size, fill, weight = 400, anchor = 'start') {
  return '<text x="' + x + '" y="' + y + '" font-family="Aptos,Segoe UI,Arial,sans-serif" font-size="' + size +
    '" font-weight="' + weight + '" fill="' + fill + '" text-anchor="' + anchor + '">' + esc(text) + '</text>';
}
function svgWrapText(text, maxChars) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars && current) {
      lines.push(current);
      current = word;
    } else current = (current ? current + ' ' : '') + word;
  }
  if (current) lines.push(current);
  return lines;
}

function shapeBase(id, name, x, y, w, h, { fill = null, line = null, text = null, fontPt = 18, color = 'FFFFFF', bold = false, align = 'l', valign = 'ctr', lines = null } = {}) {
  const xEmu = Math.round(x * EMU_PER_PIXEL);
  const yEmu = Math.round(y * EMU_PER_PIXEL);
  const wEmu = Math.round(w * EMU_PER_PIXEL);
  const hEmu = Math.round(h * EMU_PER_PIXEL);
  const fillXml = fill
    ? '<a:solidFill><a:srgbClr val="' + fill.replace('#', '').toUpperCase() + '"/></a:solidFill>'
    : '<a:noFill/>';
  const lineXml = line
    ? '<a:ln w="12700"><a:solidFill><a:srgbClr val="' + line.replace('#', '').toUpperCase() + '"/></a:solidFill></a:ln>'
    : '<a:ln><a:noFill/></a:ln>';
  const geometry = '<p:spPr><a:xfrm><a:off x="' + xEmu + '" y="' + yEmu + '"/><a:ext cx="' + wEmu + '" cy="' + hEmu + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' + fillXml + lineXml + '</p:spPr>';
  if (text === null && !lines) {
    return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="' + xmlEsc(name) + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' + geometry + '</p:sp>';
  }

  const arr = lines || String(text || '').split('\n');
  const paragraphs = arr.map(line => {
    const paragraphAlign = align === 'center' ? 'ctr' : align === 'right' ? 'r' : 'l';
    return '<a:p><a:pPr algn="' + paragraphAlign + '"/><a:r><a:rPr lang="id-ID" sz="' + Math.round(fontPt * 100) +
      '"' + (bold ? ' b="1"' : '') + ' dirty="0"><a:solidFill><a:srgbClr val="' + color.replace('#', '').toUpperCase() +
      '"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>' + xmlEsc(line) +
      '</a:t></a:r><a:endParaRPr lang="id-ID"/></a:p>';
  }).join('');
  const txBody = '<p:txBody><a:bodyPr wrap="square" anchor="' + (valign === 'top' ? 't' : 'ctr') +
    '" lIns="114300" rIns="114300" tIns="76200" bIns="76200"/><a:lstStyle/>' + paragraphs + '</p:txBody>';
  return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="' + xmlEsc(name) + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>' + geometry + txBody + '</p:sp>';
}

function buildSlideXml(schema) {
  const palette = choosePalette(schema);
  const title = schema.header.title;
  const subtitle = schema.header.subtitle;
  const cols = schema.columns || [];
  const shapes = [];
  let id = 2;
  const add = (...args) => shapes.push(shapeBase(id++, ...args));
  const p = palette;
  // 13.333 x 7.5 inch 16:9 slide; geometry is in 1280x720 design pixels.
  add('Canvas accent', 0, 0, 1280, 12, { fill: p.primary });
  add('Brand label', 62, 28, 400, 24, { text: 'JIN  /  CORPORATE INTELLIGENCE', fontPt: 10, color: p.accent, bold: true, valign: 'top' });
  add('Main title', 62, 58, 1155, 78, { text: title, fontPt: 31, color: p.white, bold: true, valign: 'top' });
  add('Subtitle', 62, 139, 1150, 58, { text: subtitle, fontPt: 14, color: p.muted, valign: 'top' });
  add('Header line', 62, 204, 1155, 2, { fill: p.divider });

  const cardY = 230, cardH = 345, gap = 24, cardW = 557, leftX = 62, rightX = leftX + cardW + gap;
  cols.slice(0, 2).forEach((col, idx) => {
    const x = idx === 0 ? leftX : rightX;
    const fill = idx === 0 ? p.card : p.card2;
    add('Column ' + (idx + 1) + ' card', x, cardY, cardW, cardH, { fill, line: p.divider });
    add('Column ' + (idx + 1) + ' accent', x, cardY, 7, cardH, { fill: idx === 0 ? p.accent : p.gold });
    add('Column ' + (idx + 1) + ' heading', x + 22, cardY + 20, cardW - 42, 48, { text: col.title, fontPt: 16, color: idx === 0 ? p.accent : p.gold, bold: true, valign: 'top' });
    (col.items || []).slice(0, 5).forEach((item, j) => {
      const text = typeof item === 'string' ? item : item.title || item.text || '';
      const number = String(j + 1).padStart(2, '0');
      add('Column ' + (idx + 1) + ' bullet ' + (j + 1), x + 22, cardY + 76 + j * 50, 34, 38, { text: number, fontPt: 11, color: p.accent, bold: true, valign: 'top' });
      add('Column ' + (idx + 1) + ' item ' + (j + 1), x + 64, cardY + 74 + j * 50, cardW - 88, 44, { text, fontPt: 11.5, color: p.white, valign: 'top' });
    });
  });

  add('Footer takeaway label', 62, 592, 180, 25, { text: 'KEY TAKEAWAY', fontPt: 10, color: p.accent, bold: true, valign: 'top' });
  add('Footer takeaway', 62, 615, 850, 43, { text: schema.footer.takeaway, fontPt: 13, color: p.white, bold: true, valign: 'top' });
  add('Footer conclusion', 62, 665, 1055, 25, { text: schema.footer.conclusion, fontPt: 9, color: p.muted, valign: 'top' });
  add('Footer page', 1170, 672, 45, 18, { text: '01 / 01', fontPt: 8, color: p.muted, align: 'right', valign: 'top' });

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld name="' + xmlEsc(title) + '"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="' + p.background.replace('#', '') + '"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
    '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    shapes.join('') + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
}

function buildPptxPackage(schema, slideXml) {
  const zip = new JSZip();
  const title = xmlEsc(schema.header.title);
  const primary = choosePalette(schema).primary.replace('#', '').toUpperCase();
  const accent = choosePalette(schema).accent.replace('#', '').toUpperCase();
  const appXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>UltimateAI JIN Slide Studio</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>1</Slides></Properties>';
  const coreXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<dc:title>' + title + '</dc:title><dc:creator>UltimateAI JIN</dc:creator><dc:subject>Editable corporate presentation slide</dc:subject>' +
    '<dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString() + '</dcterms:created></cp:coreProperties>';

  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
    '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' +
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>';

  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';

  const presentationXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    '<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>' +
    '<p:notesSz cx="6858000" cy="9144000"/></p:presentation>';

  const presentationRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>';

  const groupTree = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree>';
  const slideMasterXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld>' + groupTree + '</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    '<p:txStyles><p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="3600" b="1"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr marL="0" indent="0"><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1400"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>';
  const masterRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>';
  const slideLayoutXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">' +
    '<p:cSld name="Blank">' + groupTree + '</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';
  const slideLayoutRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>';
  const slideRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>';

  const themeXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="JIN Corporate">' +
    '<a:themeElements><a:clrScheme name="JIN Corporate"><a:dk1><a:srgbClr val="0B1220"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="203040"/></a:dk2><a:lt2><a:srgbClr val="F5F7FA"/></a:lt2>' +
    '<a:accent1><a:srgbClr val="' + primary + '"/></a:accent1><a:accent2><a:srgbClr val="' + accent + '"/></a:accent2>' +
    '<a:accent3><a:srgbClr val="F4B860"/></a:accent3><a:accent4><a:srgbClr val="6EE7B7"/></a:accent4><a:accent5><a:srgbClr val="60A5FA"/></a:accent5><a:accent6><a:srgbClr val="F87171"/></a:accent6>' +
    '<a:hlink><a:srgbClr val="60A5FA"/></a:hlink><a:folHlink><a:srgbClr val="A78BFA"/></a:folHlink></a:clrScheme>' +
    '<a:fontScheme name="Aptos"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
    '<a:fmtScheme name="JIN"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"/></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:shade val="70000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="1"/></a:gradFill><a:solidFill><a:schemeClr val="phClr"><a:alpha val="80000"/></a:schemeClr></a:solidFill></a:fillStyleLst>' +
    '<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst>' +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
    '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:alpha val="95000"/></a:schemeClr></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:alpha val="90000"/></a:schemeClr></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>';

  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rootRels);
  zip.file('docProps/app.xml', appXml);
  zip.file('docProps/core.xml', coreXml);
  zip.file('ppt/presentation.xml', presentationXml);
  zip.file('ppt/_rels/presentation.xml.rels', presentationRels);
  zip.file('ppt/slides/slide1.xml', slideXml);
  zip.file('ppt/slides/_rels/slide1.xml.rels', slideRels);
  zip.file('ppt/slideLayouts/slideLayout1.xml', slideLayoutXml);
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', slideLayoutRels);
  zip.file('ppt/slideMasters/slideMaster1.xml', slideMasterXml);
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', masterRels);
  zip.file('ppt/theme/theme1.xml', themeXml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

async function buildPreview(schema) {
  const p = choosePalette(schema);
  const width = PREVIEW_WIDTH, height = PREVIEW_HEIGHT;
  const image = new Jimp(width, height, 0x0B1220FF);
  const data = image.bitmap.data;
  const bgA = hexToRgb(p.background);
  const bgB = hexToRgb(p.background2);
  // Gentle vertical gradient plus low-amplitude deterministic texture.
  for (let y = 0; y < height; y++) {
    const t = y / height;
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const grain = ((Math.floor(x / 4) * 17 + Math.floor(y / 4) * 29) % 5) - 2;
      data[idx] = bgA[0] * (1 - t) + bgB[0] * t + grain;
      data[idx + 1] = bgA[1] * (1 - t) + bgB[1] * t + grain;
      data[idx + 2] = bgA[2] * (1 - t) + bgB[2] * t + grain;
      data[idx + 3] = 255;
    }
  }
  const colorInt = hex => Jimp.rgbaToInt(...hexToRgb(hex), 255);
  const rect = (x, y, w, h, hex) => {
    const color = colorInt(hex);
    for (let yy = Math.max(0, y); yy < Math.min(height, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(width, x + w); xx++) image.setPixelColor(color, xx, yy);
    }
  };

  rect(0, 0, width, 7, p.primary);
  rect(64, 30, 3, 21, p.accent);
  rect(64, 205, 1152, 2, p.divider);

  const fonts = await Promise.all([
    Jimp.loadFont(Jimp.FONT_SANS_64_WHITE),
    Jimp.loadFont(Jimp.FONT_SANS_32_WHITE),
    Jimp.loadFont(Jimp.FONT_SANS_16_WHITE),
    Jimp.loadFont(Jimp.FONT_SANS_32_BLACK),
    Jimp.loadFont(Jimp.FONT_SANS_16_BLACK)
  ]);
  const [f64, f32, f16w, f32b, f16b] = fonts;
  image.print(f16w, 78, 25, 'JIN  /  CORPORATE INTELLIGENCE');
  image.print(f32, 62, 56, {
    text: String(schema.header.title || '').slice(0, 90),
    alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
    alignmentY: Jimp.VERTICAL_ALIGN_TOP
  }, 1150, 80);
  image.print(f16w, 64, 143, {
    text: String(schema.header.subtitle || '').slice(0, 180),
    alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
    alignmentY: Jimp.VERTICAL_ALIGN_TOP
  }, 1150, 52);

  const cols = schema.columns || [];
  const colX = [64, 660], colY = 232, colW = 556, colH = 345;
  cols.slice(0, 2).forEach((col, index) => {
    rect(colX[index], colY, colW, colH, index === 0 ? p.card : p.card2);
    rect(colX[index], colY, 6, colH, index === 0 ? p.accent : p.gold);
    image.print(f16w, colX[index] + 24, colY + 18, {
      text: String(col.title || '').slice(0, 60),
      alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP
    }, colW - 48, 45);
    (col.items || []).slice(0, 5).forEach((item, i) => {
      const itemText = typeof item === 'string' ? item : item.title || item.text || '';
      rect(colX[index] + 24, colY + 72 + i * 51, 26, 3, index === 0 ? p.accent : p.gold);
      image.print(f16w, colX[index] + 24, colY + 79 + i * 51, String(i + 1).padStart(2, '0'));
      image.print(f16w, colX[index] + 64, colY + 76 + i * 51, {
        text: String(itemText).slice(0, 105),
        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP
      }, colW - 94, 42);
    });
  });
  rect(64, 598, 125, 3, p.accent);
  image.print(f16w, 64, 607, 'KEY TAKEAWAY');
  image.print(f32, 64, 630, {
    text: String(schema.footer.takeaway || '').slice(0, 105),
    alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
    alignmentY: Jimp.VERTICAL_ALIGN_TOP
  }, 1140, 42);
  image.print(f16b, 64, 682, String(schema.footer.conclusion || '').slice(0, 155));
  return image.getBufferAsync(Jimp.MIME_PNG);
}

export class SlideRenderer {
  async renderSvg(schema) {
    const p = choosePalette(schema);
    const parts = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">',
      '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="' + p.background + '"/><stop offset="100%" stop-color="' + p.background2 + '"/></linearGradient></defs>',
      '<rect width="1920" height="1080" fill="url(#bg)"/>',
      '<rect width="1920" height="12" fill="' + p.primary + '"/>',
      svgText(96, 58, 'JIN / CORPORATE INTELLIGENCE', 20, p.accent, 700),
      svgText(96, 132, schema.header.title, 46, p.white, 700),
      svgText(96, 196, schema.header.subtitle, 23, p.muted, 400),
      '<line x1="96" y1="220" x2="1824" y2="220" stroke="' + p.divider + '" stroke-width="2"/>'
    ];
    const cols = schema.columns || [];
    const cardX = [96, 958], cardY = 260, cardW = 826, cardH = 515;
    cols.slice(0, 2).forEach((col, idx) => {
      const x = cardX[idx], fill = idx === 0 ? p.card : p.card2;
      parts.push('<rect x="' + x + '" y="' + cardY + '" width="' + cardW + '" height="' + cardH + '" rx="20" fill="' + fill + '" stroke="' + p.divider + '" stroke-width="2"/>');
      parts.push('<rect x="' + x + '" y="' + cardY + '" width="10" height="' + cardH + '" rx="4" fill="' + (idx === 0 ? p.accent : p.gold) + '"/>');
      parts.push(svgText(x + 38, cardY + 56, col.title, 28, idx === 0 ? p.accent : p.gold, 700));
      (col.items || []).slice(0, 5).forEach((item, i) => {
        const text = typeof item === 'string' ? item : item.title || item.text || '';
        const y = cardY + 124 + i * 72;
        parts.push('<circle cx="' + (x + 48) + '" cy="' + (y - 7) + '" r="17" fill="' + (idx === 0 ? p.primary : '#8A5D1B') + '"/>');
        parts.push(svgText(x + 48, y, String(i + 1), 15, p.white, 700, 'middle'));
        const lines = svgWrapText(text, 53).slice(0, 2);
        lines.forEach((line, j) => parts.push(svgText(x + 82, y + j * 27, line, 21, p.white, 400)));
      });
    });
    parts.push(svgText(96, 834, 'KEY TAKEAWAY', 18, p.accent, 700));
    parts.push(svgText(96, 882, schema.footer.takeaway, 28, p.white, 700));
    parts.push(svgText(96, 936, schema.footer.conclusion, 18, p.muted, 400));
    parts.push(svgText(1824, 1015, '01 / 01', 15, p.muted, 400, 'end'));
    parts.push('</svg>');
    return parts.join('');
  }

  async renderPreview(schema) {
    return buildPreview(schema);
  }

  async renderPptx(schema, svg = null) {
    return buildPptxPackage(schema, buildSlideXml(schema));
  }

  /**
   * Produce a genuine multi-slide editable PPTX by extending the canonical
   * OpenXML package and adding one native shape/text tree per slide.
   */
  async renderDeckPptx(schemas = []) {
    if (!Array.isArray(schemas) || schemas.length === 0) {
      throw new Error('PPTX_DECK_EMPTY: At least one slide schema is required.');
    }
    const deckSchemas = schemas.slice(0, 60);
    const firstSchema = deckSchemas[0];
    const baseBuffer = await buildPptxPackage(firstSchema, buildSlideXml(firstSchema));
    const zip = await JSZip.loadAsync(baseBuffer);

    const presentationPath = 'ppt/presentation.xml';
    const relsPath = 'ppt/_rels/presentation.xml.rels';
    const contentTypesPath = '[Content_Types].xml';
    let presentationXml = await zip.file(presentationPath).async('text');
    let presentationRels = await zip.file(relsPath).async('text');
    let contentTypes = await zip.file(contentTypesPath).async('text');
    let appXml = await zip.file('docProps/app.xml').async('text');

    const slideIds = deckSchemas.map((schema, index) =>
      '<p:sldId id="' + (256 + index) + '" r:id="rId' + (index + 2) + '"/>'
    ).join('');
    presentationXml = presentationXml.replace(/<p:sldIdLst>[\\s\\S]*?<\\/p:sldIdLst>/,
      '<p:sldIdLst>' + slideIds + '</p:sldIdLst>');
    presentationXml = presentationXml.replace(/<p:sldSz cx="[^"]+" cy="[^"]+" type="[^"]+"\\/>/,
      '<p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>');

    for (let index = 1; index < deckSchemas.length; index++) {
      const slideNumber = index + 1;
      const schema = deckSchemas[index];
      zip.file('ppt/slides/slide' + slideNumber + '.xml', buildSlideXml(schema));
      zip.file('ppt/slides/_rels/slide' + slideNumber + '.xml.rels',
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
        '</Relationships>');
      contentTypes = contentTypes.replace('</Types>',
        '<Override PartName="/ppt/slides/slide' + slideNumber + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>');
      presentationRels = presentationRels.replace('</Relationships>',
        '<Relationship Id="rId' + (index + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + slideNumber + '.xml"/></Relationships>');
    }

    appXml = appXml.replace(/<Slides>\\d+<\\/Slides>/, '<Slides>' + deckSchemas.length + '</Slides>');
    zip.file(presentationPath, presentationXml);
    zip.file(relsPath, presentationRels);
    zip.file(contentTypesPath, contentTypes);
    zip.file('docProps/app.xml', appXml);
    return zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  }

  async render(schema) {
    const svg = await this.renderSvg(schema);
    const previewBuffer = await this.renderPreview(schema);
    const pptxBuffer = await this.renderPptx(schema, svg);
    return { success: true, svg, previewBuffer, pptxBuffer, width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT };
  }
}

export const slideRendererInstance = new SlideRenderer();
export default slideRendererInstance;
