import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Eraser,
  Flame,
  Flower2,
  Heart,
  Laugh,
  Moon,
  Palette,
  PenTool,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Sun,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type BaseType =
  | 'none'
  | 'banana_leaf'
  | 'banana_double'
  | 'lotus'
  | 'bread'
  | 'coconut'
  | 'marigold';

type SignStyle = 'none' | 'floating' | 'wood' | 'paper' | 'heart' | 'flag' | 'scroll';
type TextSizeOption = 'sm' | 'md' | 'lg' | 'xl';
type DrawTool = 'pen' | 'flower' | 'eraser';
type StampKind = 'lotus' | 'marigold' | 'jasmine' | 'rose' | 'leaf' | 'sparkle' | 'heart';
type SkyMode = 'realtime' | 'dusk' | 'midnight' | 'dawn';

interface KrathongItem {
  id: string;
  userCode: string;
  name: string;
  ownerName: string;
  wish: string;
  imageData: string; // Data URL of drawn + base canvas (400x400 transparent PNG)
  baseType: BaseType;
  signStyle: SignStyle;
  signColor: string;
  signX: number; // 0..100 percentage across canvas
  signY: number; // 0..100 percentage down canvas
  nameSize: TextSizeOption;
  wishSize: TextSizeOption;
  isContest: boolean;
  beautifulVotes: number;
  funnyVotes: number;
  createdAt: string;
}

interface FloatingKrathongState {
  item: KrathongItem;
  x: number; // 0..115 percentage across viewport (left to right)
  lane: number; // 0..4 depth lane
  speed: number; // % per second
  bobOffset: number;
  scale: number;
}

interface SkyLantern {
  id: number;
  leftPct: number;
  size: number;
  durationSec: number;
  delaySec: number;
  swayOffset: number;
}

const COLLEGE_LOGO_URL =
  '/assets/aistudio/383967470_750445170429048_7326493794326681002_n_ddaffa8e.jpg';

const STORAGE_KEYS = {
  KRATHONGS: 'wice_loykrathong_2569_items_v2',
  OLD_KRATHONGS_V1: 'wice_loykrathong_2569_items_v1',
  USER_CODE: 'wice_loykrathong_2569_usercode_v1',
  VOTED_MAP: 'wice_loykrathong_2569_votes_v1',
  GAS_URL: 'wice_loykrathong_2569_gas_url_v1',
};

// หมายเหตุสำคัญสำหรับผู้ดูแลระบบ:
// หากต้องการให้ผู้ใช้งานจากทุกเครื่องบันทึกลง Google Sheet ได้ทันทีโดยไม่ต้องส่งลิงก์พ่วง ?gas=...
// ให้วาง Web App URL (/exec) ลงในตัวแปร VITE_GAS_WEBAPP_URL หรือใส่แทนค่าว่างด้านล่างแล้ว Build ใหม่
const DEFAULT_GAS_URL =
  (typeof import.meta !== 'undefined' &&
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GAS_WEBAPP_URL) ||
  '';

function isValidGasWebAppUrl(url: string): boolean {
  return /^https:\/\/script\.google\.com\/(?:a\/macros\/[^/]+\/)?macros\/s\/.+\/(exec|dev)(?:[?#].*)?$/i.test(
    url.trim()
  );
}

const PEN_COLORS = [
  '#2E7D32',
  '#8BC34A',
  '#F59E0B',
  '#FDE047',
  '#F48FB1',
  '#E53935',
  '#A78BFA',
  '#67E8F9',
  '#FFF8E7',
  '#784B2A',
  '#262626',
];

const SIGN_COLORS = [
  { id: 'wood', hex: '#A46A3E', text: '#FFFDF7', label: 'ไม้สัก' },
  { id: 'cream', hex: '#FFF9E8', text: '#3B2818', label: 'ครีมอุ่น' },
  { id: 'pink', hex: '#F9A8D4', text: '#4A1230', label: 'ชมพูบัว' },
  { id: 'red', hex: '#DC2626', text: '#FFFFFF', label: 'แดงชาด' },
  { id: 'gold', hex: '#EAB308', text: '#2B1B04', label: 'ทองคำ' },
  { id: 'sky', hex: '#93C5FD', text: '#0F294A', label: 'ฟ้าใส' },
];

const BASE_OPTIONS: { id: BaseType; label: string }[] = [
  { id: 'none', label: 'ไม่ใช้ฐาน' },
  { id: 'banana_leaf', label: 'ใบตอง' },
  { id: 'banana_double', label: 'ใบตองสองชั้น' },
  { id: 'lotus', label: 'ดอกบัว' },
  { id: 'bread', label: 'ขนมปัง' },
  { id: 'coconut', label: 'กาบมะพร้าว' },
  { id: 'marigold', label: 'ดาวเรือง' },
];

const SIGN_STYLES: { id: SignStyle; label: string }[] = [
  { id: 'none', label: 'ไม่แสดง' },
  { id: 'floating', label: 'ข้อความลอย' },
  { id: 'wood', label: 'ป้ายไม้' },
  { id: 'paper', label: 'กระดาษ' },
  { id: 'heart', label: 'หัวใจ' },
  { id: 'flag', label: 'ธง' },
  { id: 'scroll', label: 'ม้วน' },
];

const PETAL_PALETTES = [
  { id: 'natural', label: 'ธรรมชาติ', primary: '#2E7D32', secondary: '#66BB6A', accent: '#FBC02D' },
  { id: 'lotus_pink', label: 'ชมพูบัว', primary: '#EC4899', secondary: '#F9A8D4', accent: '#FDE047' },
  { id: 'gold', label: 'ทองดาวเรือง', primary: '#D97706', secondary: '#FBBF24', accent: '#FEF08A' },
  { id: 'royal', label: 'ม่วงคราม', primary: '#7C3AED', secondary: '#C4B5FD', accent: '#FDE68A' },
  { id: 'ivory', label: 'ขาวมะลิ', primary: '#E2E8F0', secondary: '#FFFFFF', accent: '#F59E0B' },
];

const STAMP_ITEMS: { id: StampKind; label: string; color: string }[] = [
  { id: 'lotus', label: 'ดอกบัว', color: '#F472B6' },
  { id: 'marigold', label: 'ดาวเรือง', color: '#F59E0B' },
  { id: 'jasmine', label: 'มะลิ', color: '#FFFDF7' },
  { id: 'rose', label: 'กุหลาบ', color: '#E11D48' },
  { id: 'leaf', label: 'ใบตอง', color: '#4ADE80' },
  { id: 'sparkle', label: 'ประกาย', color: '#FDE047' },
  { id: 'heart', label: 'หัวใจ', color: '#FB7185' },
];

// ============================================================================
// GOOGLE APPS SCRIPT TEMPLATE (Code.gs)
// ============================================================================

const GOOGLE_APPS_SCRIPT_CODE = `/**
 * Google Apps Script Backend สำหรับระบบ "ลอยกระทงออนไลน์ 2569"
 * วิทยาลัยการอาชีพเวียงเชียงรุ้ง
 *
 * วิธีติดตั้งและแก้ไขปัญหาเครื่องอื่นบันทึกไม่ได้:
 * 1. เปิด Google Sheets ที่ต้องการเก็บข้อมูล แล้วไปที่ Extensions > Apps Script
 * 2. วางโค้ดนี้ลงในไฟล์ Code.gs ทั้งหมดแล้วกด Save (Ctrl+S)
 * 3. กด Deploy > New deployment (หรือ Manage deployments > Edit > Version: New version)
 *    - Type: Web app
 *    - Execute as: Me (บัญชีเจ้าของสคริปต์)
 *    - Who has access: Anyone (ทุกคน — ห้ามเลือก Only myself หรือ Anyone within organization)
 * 4. คัดลอก Web app URL (.../exec) มาวางในหน้าตั้งค่า (?setup=sheet) ของเว็บลอยกระทง
 */

const SHEET_NAME = 'Krathongs';
// หากสร้างสคริปต์แยกไม่ได้สร้างจาก Google Sheet โดยตรง ให้ใส่ Spreadsheet ID ลงในเครื่องหมายคำพูดด้านล่าง
const SPREADSHEET_ID = '';

const HEADERS = [
  'id',
  'userCode',
  'name',
  'ownerName',
  'wish',
  'imageData',
  'baseType',
  'signStyle',
  'signColor',
  'signX',
  'signY',
  'nameSize',
  'wishSize',
  'isContest',
  'beautifulVotes',
  'funnyVotes',
  'createdAt'
];

function getOrCreateSheet() {
  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('ไม่พบ Spreadsheet กรุณาสร้างสคริปต์ผ่านเมนู Extensions > Apps Script ใน Google Sheet หรือระบุ SPREADSHEET_ID');
  }
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return sheet;
}

function doGet(e) {
  try {
    const sheet = getOrCreateSheet();
    const values = sheet.getDataRange().getValues();
    const params = (e && e.parameter) || {};

    if (params.action === 'ping') {
      return jsonResponse({
        ok: true,
        sheetName: sheet.getName(),
        spreadsheetName: sheet.getParent().getName(),
        total: Math.max(0, values.length - 1)
      });
    }

    if (params.checkId) {
      const targetId = String(params.checkId).trim();
      let exists = false;
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === targetId) {
          exists = true;
          break;
        }
      }
      return jsonResponse({ ok: true, exists, total: Math.max(0, values.length - 1) });
    }

    if (values.length <= 1) {
      return jsonResponse({ ok: true, items: [], total: 0 });
    }
    const headers = values[0];
    const userCodeFilter = params.userCode ? String(params.userCode).trim().toUpperCase() : '';
    const items = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row[0]) continue;
      const item = {};
      for (let c = 0; c < headers.length; c++) {
        item[headers[c]] = row[c];
      }
      item.isContest = item.isContest === true || item.isContest === 'TRUE' || item.isContest === 'true';
      item.beautifulVotes = Number(item.beautifulVotes || 0);
      item.funnyVotes = Number(item.funnyVotes || 0);
      item.signX = Number(item.signX || 50);
      item.signY = Number(item.signY || 28);
      if (item.createdAt instanceof Date) {
        item.createdAt = item.createdAt.toISOString();
      }
      if (!userCodeFilter || String(item.userCode).toUpperCase() === userCodeFilter) {
        items.push(item);
      }
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return jsonResponse({ ok: true, items: items.slice(0, 200), total: values.length - 1 });
  } catch (err) {
    return jsonResponse({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(15000);
  if (!hasLock) {
    return jsonResponse({ ok: false, error: 'ระบบกำลังบันทึกข้อมูลจำนวนมาก กรุณาลองใหม่อีกครั้ง' });
  }
  try {
    const rawBody =
      (e && e.postData && e.postData.contents) ||
      (e && e.parameter && e.parameter.payload) ||
      '';
    if (!rawBody) {
      return jsonResponse({ ok: false, error: 'Missing request body' });
    }
    const payload = JSON.parse(rawBody);
    const sheet = getOrCreateSheet();

    if (payload.action === 'create') {
      const k = payload.krathong || {};
      const itemId = String(k.id || '').trim();
      if (!itemId) {
        return jsonResponse({ ok: false, error: 'Missing krathong id' });
      }
      // ป้องกันการบันทึกซ้ำเมื่อมีการส่งซ้ำหรือ fallback
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const existingIds = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (let i = 0; i < existingIds.length; i++) {
          if (String(existingIds[i][0]) === itemId) {
            return jsonResponse({ ok: true, id: itemId, duplicate: true });
          }
        }
      }

      const safeImageData = String(k.imageData || '');
      if (safeImageData.length > 49500) {
        return jsonResponse({
          ok: false,
          error: 'ขนาดภาพกระทงเกินขีดจำกัด 50,000 ตัวอักษรของเซลล์ Google Sheets (' + safeImageData.length + ')'
        });
      }
      sheet.appendRow([
        itemId,
        String(k.userCode || ''),
        String(k.name || ''),
        String(k.ownerName || ''),
        String(k.wish || ''),
        safeImageData,
        String(k.baseType || 'none'),
        String(k.signStyle || 'none'),
        String(k.signColor || '#A46A3E'),
        Number(k.signX || 50),
        Number(k.signY || 28),
        String(k.nameSize || 'md'),
        String(k.wishSize || 'md'),
        Boolean(k.isContest),
        Number(k.beautifulVotes || 0),
        Number(k.funnyVotes || 0),
        k.createdAt || new Date().toISOString()
      ]);
      SpreadsheetApp.flush();
      return jsonResponse({ ok: true, id: itemId });
    }

    if (payload.action === 'vote') {
      const id = String(payload.id || '');
      const voteType = payload.voteType; // 'beautiful' | 'funny'
      const delta = Number(payload.delta || 1);
      const data = sheet.getDataRange().getValues();
      const headers = data[0] || [];
      const bCol = headers.indexOf('beautifulVotes') >= 0 ? headers.indexOf('beautifulVotes') + 1 : 15;
      const fCol = headers.indexOf('funnyVotes') >= 0 ? headers.indexOf('funnyVotes') + 1 : 16;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === id) {
          const colIndex = voteType === 'funny' ? fCol : bCol;
          const current = Number(data[i][colIndex - 1] || 0);
          const next = Math.max(0, current + delta);
          sheet.getRange(i + 1, colIndex).setValue(next);
          SpreadsheetApp.flush();
          return jsonResponse({ ok: true, id, voteType, count: next });
        }
      }
      return jsonResponse({ ok: false, error: 'Krathong not found' });
    }

    return jsonResponse({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err && err.message ? err.message : String(err) });
  } finally {
    if (hasLock) lock.releaseLock();
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

// Compress Krathong canvas image strictly under Google Sheets 50,000 char cell limit
function exportCompactKrathongDataUrl(sourceCanvas: HTMLCanvasElement): string {
  const attempts: { size: number; mime: string; quality?: number }[] = [
    { size: 260, mime: 'image/webp', quality: 0.82 },
    { size: 220, mime: 'image/webp', quality: 0.72 },
    { size: 180, mime: 'image/webp', quality: 0.62 },
    { size: 160, mime: 'image/png' },
    { size: 120, mime: 'image/png' },
    { size: 96, mime: 'image/png' },
    { size: 76, mime: 'image/png' },
  ];

  const offscreen = document.createElement('canvas');
  const ctx = offscreen.getContext('2d');
  if (!ctx) return sourceCanvas.toDataURL('image/png');

  for (const step of attempts) {
    offscreen.width = step.size;
    offscreen.height = step.size;
    ctx.clearRect(0, 0, step.size, step.size);
    ctx.drawImage(sourceCanvas, 0, 0, step.size, step.size);
    const url =
      step.quality !== undefined
        ? offscreen.toDataURL(step.mime, step.quality)
        : offscreen.toDataURL(step.mime);
    if (url.length <= 44000) {
      return url;
    }
  }

  // Final safety fallback on iOS/older Safari if PNG remains > 44,000 chars
  offscreen.width = 160;
  offscreen.height = 160;
  ctx.fillStyle = '#0E2347';
  ctx.fillRect(0, 0, 160, 160);
  ctx.drawImage(sourceCanvas, 0, 0, 160, 160);
  return offscreen.toDataURL('image/jpeg', 0.78);
}

// ============================================================================
// PROCEDURAL KRATHONG BASE & STAMP RENDERER (HTML5 CANVAS)
// ============================================================================

function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `WICE-${seg(4)}-${seg(4)}`;
}

function drawCandleAndIncense(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  candleMode: 'single' | 'double' | 'none',
  candleColor: string,
  incenseCount: 0 | 1 | 3
) {
  ctx.save();
  // Incense sticks behind candle
  if (incenseCount > 0) {
    const angles = incenseCount === 3 ? [-0.26, 0, 0.26] : [0.18];
    angles.forEach((angle, idx) => {
      ctx.save();
      ctx.translate(cx + (idx - 1) * 6, baseY - 10);
      ctx.rotate(angle);
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -108);
      ctx.stroke();

      ctx.strokeStyle = '#A16207';
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.lineTo(0, -105);
      ctx.stroke();

      // Glowing ember tip
      ctx.fillStyle = '#FB923C';
      ctx.beginPath();
      ctx.arc(0, -108, 3, 0, Math.PI * 2);
      ctx.fill();

      // Gentle incense smoke wisp
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.35)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -112);
      ctx.bezierCurveTo(-8, -128, 10, -142, -3, -158);
      ctx.stroke();
      ctx.restore();
    });
  }

  // Candles
  const positions =
    candleMode === 'none' ? [] : candleMode === 'double' ? [cx - 22, cx + 22] : [cx];

  positions.forEach((xPos) => {
    const cWidth = candleMode === 'double' ? 14 : 18;
    const cHeight = candleMode === 'double' ? 88 : 96;
    const topY = baseY - cHeight;

    // Warm halo glow
    const glow = ctx.createRadialGradient(xPos, topY - 14, 4, xPos, topY - 14, 70);
    glow.addColorStop(0, 'rgba(253, 224, 71, 0.65)');
    glow.addColorStop(0.45, 'rgba(245, 158, 11, 0.24)');
    glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(xPos, topY - 14, 70, 0, Math.PI * 2);
    ctx.fill();

    // Candle body
    const bodyGrad = ctx.createLinearGradient(xPos - cWidth / 2, 0, xPos + cWidth / 2, 0);
    bodyGrad.addColorStop(0, candleColor);
    bodyGrad.addColorStop(0.5, '#FFFBEB');
    bodyGrad.addColorStop(1, candleColor);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(xPos - cWidth / 2, topY, cWidth, cHeight, 4);
    ctx.fill();

    // Wick
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xPos, topY);
    ctx.lineTo(xPos, topY - 8);
    ctx.stroke();

    // Flame
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.moveTo(xPos, topY - 30);
    ctx.quadraticCurveTo(xPos + 10, topY - 14, xPos, topY - 7);
    ctx.quadraticCurveTo(xPos - 10, topY - 14, xPos, topY - 30);
    ctx.fill();

    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.moveTo(xPos, topY - 24);
    ctx.quadraticCurveTo(xPos + 5, topY - 13, xPos, topY - 9);
    ctx.quadraticCurveTo(xPos - 5, topY - 13, xPos, topY - 24);
    ctx.fill();
  });

  ctx.restore();
}

function drawStampOnCanvas(
  ctx: CanvasRenderingContext2D,
  kind: StampKind,
  x: number,
  y: number,
  radius: number,
  customColor?: string
) {
  ctx.save();
  ctx.translate(x, y);

  if (kind === 'lotus') {
    const col = customColor || '#F472B6';
    for (let i = -2; i <= 2; i++) {
      ctx.save();
      ctx.rotate(i * 0.34);
      ctx.fillStyle = i % 2 === 0 ? col : '#FBCFE8';
      ctx.beginPath();
      ctx.moveTo(0, radius * 0.45);
      ctx.quadraticCurveTo(radius * 0.55, -radius * 0.1, 0, -radius);
      ctx.quadraticCurveTo(-radius * 0.55, -radius * 0.1, 0, radius * 0.45);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(0, radius * 0.1, radius * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'marigold') {
    const petals = 10;
    for (let i = 0; i < petals; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI * 2) / petals);
      ctx.fillStyle = i % 2 === 0 ? '#F59E0B' : '#FACC15';
      ctx.beginPath();
      ctx.ellipse(0, -radius * 0.52, radius * 0.28, radius * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#B45309';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.24, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'jasmine') {
    const petals = 6;
    for (let i = 0; i < petals; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI * 2) / petals);
      ctx.fillStyle = '#FFFDF7';
      ctx.beginPath();
      ctx.ellipse(0, -radius * 0.48, radius * 0.24, radius * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'rose') {
    ctx.fillStyle = '#BE123C';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F43F5E';
    ctx.beginPath();
    ctx.arc(-radius * 0.1, -radius * 0.1, radius * 0.58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FDA4AF';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'leaf') {
    ctx.fillStyle = '#16A34A';
    ctx.beginPath();
    ctx.moveTo(0, radius * 0.8);
    ctx.quadraticCurveTo(radius * 0.85, 0, 0, -radius * 0.9);
    ctx.quadraticCurveTo(-radius * 0.85, 0, 0, radius * 0.8);
    ctx.fill();
    ctx.strokeStyle = '#86EFAC';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, radius * 0.6);
    ctx.lineTo(0, -radius * 0.7);
    ctx.stroke();
  } else if (kind === 'sparkle') {
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
      ctx.lineTo(Math.cos(a + Math.PI / 4) * radius * 0.28, Math.sin(a + Math.PI / 4) * radius * 0.28);
    }
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'heart') {
    ctx.fillStyle = customColor || '#FB7185';
    ctx.beginPath();
    ctx.moveTo(0, radius * 0.65);
    ctx.bezierCurveTo(-radius, 0, -radius * 0.9, -radius * 0.85, 0, -radius * 0.35);
    ctx.bezierCurveTo(radius * 0.9, -radius * 0.85, radius, 0, 0, radius * 0.65);
    ctx.fill();
  }
  ctx.restore();
}

function renderKrathongBaseToCanvas(
  ctx: CanvasRenderingContext2D,
  baseType: BaseType,
  options: {
    petalPaletteId: string;
    petalDensity: 'sparse' | 'medium' | 'dense';
    candleMode: 'single' | 'double' | 'none';
    candleColor: string;
    incenseCount: 0 | 1 | 3;
  }
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.clearRect(0, 0, W, H);

  if (baseType === 'none') {
    return;
  }

  const palette = PETAL_PALETTES.find((p) => p.id === options.petalPaletteId) || PETAL_PALETTES[0];
  const cx = W / 2;
  const baseY = H * 0.72;
  const count = options.petalDensity === 'sparse' ? 7 : options.petalDensity === 'dense' ? 13 : 9;

  // Draw candle & incense first so front petals/rim sit cleanly in front
  drawCandleAndIncense(ctx, cx, baseY - 12, options.candleMode, options.candleColor, options.incenseCount);

  ctx.save();

  if (baseType === 'banana_leaf' || baseType === 'banana_double') {
    const tiers = baseType === 'banana_double' ? 2 : 1;
    for (let t = tiers - 1; t >= 0; t--) {
      const yOff = t === 1 ? -22 : 0;
      const scale = t === 1 ? 0.78 : 1;
      const pCount = count;
      for (let i = 0; i < pCount; i++) {
        const frac = i / (pCount - 1) - 0.5;
        const px = cx + frac * 175 * scale;
        const py = baseY + yOff + Math.abs(frac) * 14;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(frac * 0.45);
        ctx.fillStyle = i % 2 === 0 ? palette.primary : palette.secondary;
        ctx.beginPath();
        ctx.moveTo(-16 * scale, 10);
        ctx.lineTo(0, -34 * scale);
        ctx.lineTo(16 * scale, 10);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    }
    // Base trunk ring
    const grad = ctx.createLinearGradient(cx - 105, baseY, cx + 105, baseY + 34);
    grad.addColorStop(0, '#14532D');
    grad.addColorStop(0.5, '#15803D');
    grad.addColorStop(1, '#14532D');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 12, 102, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Accent flowers along rim
    for (let i = -2; i <= 2; i++) {
      drawStampOnCanvas(ctx, i % 2 === 0 ? 'marigold' : 'lotus', cx + i * 38, baseY + 6, 11);
    }
  } else if (baseType === 'lotus') {
    const lotusCols =
      options.petalPaletteId === 'natural'
        ? ['#EC4899', '#F9A8D4', '#FBCFE8']
        : [palette.primary, palette.secondary, '#FFFDF7'];
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1) - 0.5;
      const px = cx + frac * 168;
      const py = baseY + 8 - (1 - Math.abs(frac) * 1.4) * 6;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(frac * 0.65);
      ctx.fillStyle = lotusCols[i % lotusCols.length];
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.quadraticCurveTo(26, -10, 0, -54);
      ctx.quadraticCurveTo(-26, -10, 0, 18);
      ctx.fill();
      ctx.restore();
    }
    // Green lotus pad beneath
    ctx.fillStyle = '#15803D';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 24, 116, 20, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (baseType === 'bread') {
    // Baked bread turtle/flower bowl
    const breadGrad = ctx.createRadialGradient(cx, baseY - 4, 20, cx, baseY + 10, 115);
    breadGrad.addColorStop(0, '#F59E0B');
    breadGrad.addColorStop(0.6, '#D97706');
    breadGrad.addColorStop(1, '#92400E');
    ctx.fillStyle = breadGrad;
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 10, 104, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1) - 0.5;
      ctx.fillStyle = i % 2 === 0 ? '#FBBF24' : '#B45309';
      ctx.beginPath();
      ctx.arc(cx + frac * 165, baseY - 2 + Math.abs(frac) * 10, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    drawStampOnCanvas(ctx, 'jasmine', cx - 44, baseY + 10, 10);
    drawStampOnCanvas(ctx, 'jasmine', cx + 44, baseY + 10, 10);
  } else if (baseType === 'coconut') {
    // Coconut husk bowl
    const huskGrad = ctx.createRadialGradient(cx, baseY - 12, 16, cx, baseY + 18, 120);
    huskGrad.addColorStop(0, '#D6B89C');
    huskGrad.addColorStop(0.55, '#9A6B46');
    huskGrad.addColorStop(1, '#5C3A21');
    ctx.fillStyle = huskGrad;
    ctx.beginPath();
    ctx.arc(cx, baseY - 6, 106, 0, Math.PI, false);
    ctx.quadraticCurveTo(cx, baseY + 8, cx - 106, baseY - 6);
    ctx.fill();

    // Inner rim
    ctx.fillStyle = '#E7D5C4';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 6, 104, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    drawStampOnCanvas(ctx, 'marigold', cx - 64, baseY - 6, 13);
    drawStampOnCanvas(ctx, 'lotus', cx + 64, baseY - 6, 13);
  } else if (baseType === 'marigold') {
    ctx.fillStyle = '#14532D';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 16, 106, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < count + 2; i++) {
      const frac = i / (count + 1) - 0.5;
      drawStampOnCanvas(
        ctx,
        'marigold',
        cx + frac * 176,
        baseY + (i % 2 === 0 ? -4 : 10),
        16
      );
    }
  }

  ctx.restore();
}

function createSampleImageData(
  baseType: BaseType,
  paletteId: string,
  candleColor: string,
  extraStamps: { kind: StampKind; x: number; y: number; r: number }[]
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  renderKrathongBaseToCanvas(ctx, baseType, {
    petalPaletteId: paletteId,
    petalDensity: 'medium',
    candleMode: 'single',
    candleColor,
    incenseCount: 3,
  });
  extraStamps.forEach((s) => drawStampOnCanvas(ctx, s.kind, s.x, s.y, s.r));
  return canvas.toDataURL('image/png');
}

function createSeedKrathongs(): KrathongItem[] {
  const seeds: Omit<KrathongItem, 'imageData'>[] = [
    {
      id: 'seed-1',
      userCode: 'WICE-2569-DEMO',
      name: 'กระทงตัวอย่าง เวียงเชียงรุ้ง',
      ownerName: 'วิทยาลัยการอาชีพเวียงเชียงรุ้ง',
      wish: 'ร่วมสืบสานประเพณีลอยกระทงออนไลน์ 2569 ขอให้ทุกท่านมีความสุขสมหวังตลอดปี',
      baseType: 'banana_double',
      signStyle: 'wood',
      signColor: '#A46A3E',
      signX: 52,
      signY: 28,
      nameSize: 'md',
      wishSize: 'sm',
      isContest: true,
      beautifulVotes: 1,
      funnyVotes: 0,
      createdAt: new Date().toISOString(),
    },
  ];

  return seeds.map((s) => ({
    ...s,
    imageData: createSampleImageData(s.baseType, 'natural', '#FDE047', [
      { kind: 'sparkle', x: 130, y: 185, r: 10 },
      { kind: 'sparkle', x: 270, y: 175, r: 9 },
      { kind: 'lotus', x: 160, y: 265, r: 12 },
      { kind: 'marigold', x: 240, y: 265, r: 12 },
    ]),
  }));
}

// ============================================================================
// REAL-TIME SKY THEME HELPER
// ============================================================================

function getSkyPalette(mode: SkyMode, hourFloat: number) {
  let effectiveHour = hourFloat;
  if (mode === 'dusk') effectiveHour = 18.2;
  if (mode === 'midnight') effectiveHour = 23.0;
  if (mode === 'dawn') effectiveHour = 5.7;

  // Compute sky mood based on real time or selected mode
  if (effectiveHour >= 5 && effectiveHour < 7.5) {
    return {
      label: 'รุ่งอรุณริมน้ำ',
      skyGrad: 'linear-gradient(180deg, #172554 0%, #312E81 42%, #7C2D12 78%, #C2410C 100%)',
      waterGrad: 'linear-gradient(180deg, #1E293B 0%, #0F172A 45%, #091428 100%)',
      starOpacity: 0.45,
      moonOpacity: 0.72,
      moonTopPct: 24,
      ambientGlow: 'rgba(251, 146, 60, 0.22)',
    };
  }
  if (effectiveHour >= 7.5 && effectiveHour < 16.5) {
    return {
      label: 'ฟ้าใสสายน้ำเย็น',
      skyGrad: 'linear-gradient(180deg, #0C244A 0%, #163A6B 48%, #25588E 82%, #3B729E 100%)',
      waterGrad: 'linear-gradient(180deg, #123159 0%, #0C2242 50%, #07152B 100%)',
      starOpacity: 0.25,
      moonOpacity: 0.65,
      moonTopPct: 16,
      ambientGlow: 'rgba(125, 211, 252, 0.16)',
    };
  }
  if (effectiveHour >= 16.5 && effectiveHour < 19.2) {
    return {
      label: 'ย่ำค่ำจันทร์ขึ้น',
      skyGrad: 'linear-gradient(180deg, #0E1B3D 0%, #1E2558 45%, #4C2A6A 78%, #9A3412 100%)',
      waterGrad: 'linear-gradient(180deg, #162447 0%, #0E1A36 45%, #071124 100%)',
      starOpacity: 0.75,
      moonOpacity: 0.92,
      moonTopPct: 18,
      ambientGlow: 'rgba(245, 158, 11, 0.2)',
    };
  }
  return {
    label: 'ค่ำคืนจันทร์เพ็ญ',
    skyGrad: 'linear-gradient(180deg, #071026 0%, #0B1936 46%, #132A52 84%, #1A3664 100%)',
    waterGrad: 'linear-gradient(180deg, #0E2347 0%, #0A1B38 48%, #061126 100%)',
    starOpacity: 0.95,
    moonOpacity: 1,
    moonTopPct: 14,
    ambientGlow: 'rgba(253, 224, 71, 0.16)',
  };
}

// ============================================================================
// SIGN OVERLAY COMPONENT (REUSED IN CANVAS PREVIEW, RIVER, & MODALS)
// ============================================================================

const KrathongSignBadge: React.FC<{
  styleType: SignStyle;
  colorHex: string;
  name: string;
  wish: string;
  nameSize: TextSizeOption;
  wishSize: TextSizeOption;
  compact?: boolean;
}> = ({ styleType, colorHex, name, wish, nameSize, wishSize, compact }) => {
  if (styleType === 'none') return null;

  const colorObj = SIGN_COLORS.find((c) => c.hex.toLowerCase() === colorHex.toLowerCase());
  const textColor = colorObj ? colorObj.text : '#FFFDF7';

  const nameSizeCls =
    nameSize === 'sm'
      ? 'text-[10px]'
      : nameSize === 'lg'
        ? 'text-[14px]'
        : nameSize === 'xl'
          ? 'text-[16px]'
          : 'text-[12px]';

  const wishSizeCls =
    wishSize === 'sm'
      ? 'text-[9px]'
      : wishSize === 'lg'
        ? 'text-[11px]'
        : wishSize === 'xl'
          ? 'text-[12px]'
          : 'text-[10px]';

  const displayName = name.trim() || 'ชื่อกระทง';
  const displayWish = wish.trim();

  if (styleType === 'floating') {
    return (
      <div
        className={`text-center pointer-events-none select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] ${compact ? 'max-w-[116px]' : 'max-w-[144px]'}`}
        style={{ color: colorHex === '#A46A3E' ? '#FFF8E7' : colorHex }}
      >
        <div className={`font-semibold leading-tight truncate ${nameSizeCls}`}>{displayName}</div>
        {displayWish && (
          <div className={`leading-snug line-clamp-2 opacity-90 mt-0.5 ${wishSizeCls}`}>
            {displayWish}
          </div>
        )}
      </div>
    );
  }

  const shapeClass =
    styleType === 'heart'
      ? 'rounded-2xl rounded-b-3xl px-3 py-1 border border-white/25'
      : styleType === 'flag'
        ? 'rounded-r-lg rounded-tl-sm px-2.5 py-0.5 border-l-4 border-amber-300/80'
        : styleType === 'scroll'
          ? 'rounded-md px-3 py-0.5 border-x-4 border-amber-800/60'
          : styleType === 'paper'
            ? 'rounded-sm px-2.5 py-0.5 shadow-md'
            : 'rounded-md px-2.5 py-0.5 border border-black/25 shadow-md';

  return (
    <div className="flex flex-col items-center pointer-events-none select-none">
      <div
        className={`${shapeClass} ${compact ? 'max-w-[116px]' : 'max-w-[144px]'} text-center`}
        style={{ backgroundColor: colorHex, color: textColor }}
      >
        <div className={`font-semibold leading-tight truncate ${nameSizeCls}`}>{displayName}</div>
        {displayWish && (
          <div className={`leading-tight line-clamp-2 opacity-90 mt-0.5 ${wishSizeCls}`}>
            {displayWish}
          </div>
        )}
      </div>
      {/* Wooden stick */}
      <div className="w-[2px] h-3 bg-amber-900/90 rounded-b-sm" />
    </div>
  );
};

// ============================================================================
// RANDOM PERIODIC FIREWORKS & SKY BURST CANVAS
// ============================================================================

const FireworksCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    interface Rocket {
      x: number;
      y: number;
      vx: number;
      vy: number;
      targetY: number;
      hueColor: string;
      secondaryColor: string;
    }

    interface Spark {
      x: number;
      y: number;
      px: number;
      py: number;
      vx: number;
      vy: number;
      alpha: number;
      decay: number;
      color: string;
      size: number;
    }

    interface Flash {
      x: number;
      y: number;
      radius: number;
      alpha: number;
      color: string;
    }

    const PALETTES: [string, string][] = [
      ['#FDE047', '#F59E0B'], // Golden chrysanthemum
      ['#F472B6', '#FBCFE8'], // Lotus rose pink
      ['#67E8F9', '#A5F3FC'], // Sky cyan
      ['#FB923C', '#FEF08A'], // Warm festival amber
      ['#C4B5FD', '#FDE68A'], // Violet & gold
      ['#6EE7B7', '#FEF9C3'], // Emerald & cream
    ];

    const rockets: Rocket[] = [];
    const sparks: Spark[] = [];
    const flashes: Flash[] = [];

    const spawnRocket = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const [hueColor, secondaryColor] = PALETTES[Math.floor(Math.random() * PALETTES.length)];
      const startX = w * (0.14 + Math.random() * 0.72);
      const targetY = h * (0.16 + Math.random() * 0.34);
      rockets.push({
        x: startX,
        y: h * 0.86,
        vx: (Math.random() - 0.5) * 45,
        vy: -(210 + Math.random() * 95),
        targetY,
        hueColor,
        secondaryColor,
      });
    };

    const explode = (x: number, y: number, primary: string, secondary: string) => {
      flashes.push({ x, y, radius: 95 + Math.random() * 55, alpha: 0.34, color: primary });
      const count = 30 + Math.floor(Math.random() * 18);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.16;
        const speed = 55 + Math.random() * 115;
        sparks.push({
          x,
          y,
          px: x,
          py: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1,
          decay: 0.48 + Math.random() * 0.38,
          color: i % 3 === 0 ? secondary : primary,
          size: 1.4 + Math.random() * 1.4,
        });
      }
    };

    let nextLaunchIn = 0.7;
    let queuedSecondLaunchIn = -1;
    let lastTime = performance.now();
    let animId = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;

      ctx.clearRect(0, 0, w, h);

      nextLaunchIn -= dt;
      if (nextLaunchIn <= 0) {
        spawnRocket();
        if (Math.random() < 0.35) {
          queuedSecondLaunchIn = 0.24 + Math.random() * 0.28;
        }
        nextLaunchIn = 2.1 + Math.random() * 2.8;
      }

      if (queuedSecondLaunchIn > 0) {
        queuedSecondLaunchIn -= dt;
        if (queuedSecondLaunchIn <= 0) {
          spawnRocket();
          queuedSecondLaunchIn = -1;
        }
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Ambient sky flash glows
      for (let i = flashes.length - 1; i >= 0; i--) {
        const fl = flashes[i];
        fl.alpha -= dt * 0.65;
        if (fl.alpha <= 0) {
          flashes.splice(i, 1);
          continue;
        }
        const grad = ctx.createRadialGradient(fl.x, fl.y, 2, fl.x, fl.y, fl.radius);
        grad.addColorStop(0, fl.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = fl.alpha;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(fl.x, fl.y, fl.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rising rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        const prevX = r.x;
        const prevY = r.y;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.vy += 45 * dt;

        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = r.hueColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(prevX, prevY);
        ctx.lineTo(r.x, r.y);
        ctx.stroke();

        if (r.y <= r.targetY || r.vy >= -25) {
          explode(r.x, r.y, r.hueColor, r.secondaryColor);
          rockets.splice(i, 1);
        }
      }

      // Burst sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i];
        sp.px = sp.x;
        sp.py = sp.y;
        sp.vx *= 0.985;
        sp.vy = sp.vy * 0.985 + 68 * dt;
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.alpha -= sp.decay * dt;

        if (sp.alpha <= 0.02) {
          sparks.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = sp.alpha;
        ctx.strokeStyle = sp.color;
        ctx.lineWidth = sp.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sp.px, sp.py);
        ctx.lineTo(sp.x, sp.y);
        ctx.stroke();
      }

      ctx.restore();
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
};

// ============================================================================
// ANIMATED FLOWING WATER CANVAS
// ============================================================================

const FlowingWaterCanvas: React.FC<{ moonLeftPct: number }> = ({ moonLeftPct }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = parent.clientWidth * dpr;
      canvas.height = parent.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    let start = performance.now();
    const draw = (now: number) => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const t = prefersReduced ? 0 : (now - start) * 0.001;

      ctx.clearRect(0, 0, w, h);

      // Moon shimmer column on water
      const moonX = (moonLeftPct / 100) * w;
      for (let i = 0; i < 16; i++) {
        const y = (i / 16) * h * 0.92 + 12;
        const spread = 18 + i * 3.5;
        const wave = Math.sin(t * 1.4 + i * 0.9) * (6 + i * 0.4);
        const alpha = 0.24 - i * 0.011;
        ctx.fillStyle = `rgba(254, 240, 138, ${Math.max(0.03, alpha)})`;
        ctx.beginPath();
        ctx.roundRect(moonX - spread / 2 + wave, y, spread, 2.4, 2);
        ctx.fill();
      }

      // Flowing water current lines moving left -> right
      const waveCount = 26;
      for (let i = 0; i < waveCount; i++) {
        const rowProgress = (i % 10) / 10;
        const y = 14 + rowProgress * (h - 24);
        const speed = 18 + (i % 5) * 9;
        const length = 60 + (i % 4) * 38;
        const baseOffset = (i * 173) % (w + 200);
        const x = ((baseOffset + t * speed) % (w + length * 2)) - length;
        const alpha = 0.05 + rowProgress * 0.09;

        ctx.strokeStyle = `rgba(147, 197, 253, ${alpha})`;
        ctx.lineWidth = 1 + rowProgress * 1.1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(
          x + length * 0.5,
          y + Math.sin(t * 1.6 + i) * 3.2,
          x + length,
          y
        );
        ctx.stroke();
      }

      if (!prefersReduced) {
        animId = requestAnimationFrame(draw);
      }
    };

    animId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [moonLeftPct]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
};

// ============================================================================
// CHIANG RAI NIGHT SKYLINE SILHOUETTE (SVG)
// ============================================================================

const ChiangRaiShoreline: React.FC = () => {
  return (
    <div className="absolute inset-x-0 bottom-0 h-28 sm:h-36 pointer-events-none select-none overflow-hidden">
      <svg
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        className="w-full h-full"
        aria-label="ทิวทัศน์สถานที่สำคัญจังหวัดเชียงรายยามค่ำคืน"
      >
        <defs>
          <linearGradient id="mountainFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#162A4D" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#0C1B36" stopOpacity="0.98" />
          </linearGradient>
          <linearGradient id="goldGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>
          <radialGradient id="templeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Distant Doi Tung & Doi Nang Non Mountains */}
        <path
          d="M0,160 L0,108 Q120,62 260,96 Q410,55 560,104 Q710,72 860,105 Q1040,58 1210,94 Q1340,68 1440,98 L1440,160 Z"
          fill="url(#mountainFar)"
        />

        {/* Ambient glows behind landmarks */}
        <circle cx="245" cy="112" r="64" fill="url(#templeGlow)" />
        <circle cx="720" cy="108" r="56" fill="url(#templeGlow)" />
        <circle cx="1175" cy="114" r="58" fill="url(#templeGlow)" />

        {/* Landmark 1: วัดร่องขุ่น (Wat Rong Khun - White Temple ornate silhouette, left) */}
        <g transform="translate(160, 56)" opacity="0.95">
          {/* Reflected base */}
          <rect x="20" y="76" width="130" height="28" fill="#1E293B" />
          {/* Tiered Lanna Ubosot roofs */}
          <polygon points="10,78 85,48 160,78" fill="#CBD5E1" fillOpacity="0.28" stroke="#E2E8F0" strokeOpacity="0.45" strokeWidth="1" />
          <polygon points="28,64 85,32 142,64" fill="#E2E8F0" fillOpacity="0.32" stroke="#F8FAFC" strokeOpacity="0.5" strokeWidth="1" />
          <polygon points="46,48 85,16 124,48" fill="#F1F5F9" fillOpacity="0.38" />
          {/* Central Spire */}
          <polygon points="81,22 85,-6 89,22" fill="#F8FAFC" fillOpacity="0.7" />
          {/* Side Chofa spires */}
          <polygon points="26,64 21,49 30,62" fill="#E2E8F0" fillOpacity="0.55" />
          <polygon points="144,64 149,49 140,62" fill="#E2E8F0" fillOpacity="0.55" />
          {/* Warm doorway light */}
          <rect x="78" y="80" width="14" height="20" rx="7" fill="#FDE047" fillOpacity="0.65" />
        </g>

        {/* Landmark 2: หอนาฬิกาเชียงราย (Chiang Rai Golden Clock Tower, center) */}
        <g transform="translate(692, 40)">
          <rect x="16" y="70" width="24" height="50" fill="#B45309" fillOpacity="0.7" />
          <polygon points="12,72 28,44 44,72" fill="url(#goldGlow)" fillOpacity="0.82" />
          <polygon points="18,48 28,22 38,48" fill="#FDE047" fillOpacity="0.88" />
          <polygon points="25,24 28,4 31,24" fill="#FEF08A" />
          {/* Glowing clock face */}
          <circle cx="28" cy="60" r="6" fill="#FEF9C3" stroke="#92400E" strokeWidth="1.2" />
          {/* Base lotus pedestal */}
          <ellipse cx="28" cy="116" rx="22" ry="6" fill="#F59E0B" fillOpacity="0.65" />
        </g>

        {/* Landmark 3: พระธาตุดอยจอมทอง / อนุสาวรีย์พ่อขุนเม็งรายฯ (Golden Chedi & Monument, right) */}
        <g transform="translate(1130, 52)">
          <rect x="18" y="80" width="52" height="28" fill="#1E293B" />
          {/* Golden Chedi */}
          <polygon points="28,82 44,44 60,82" fill="url(#goldGlow)" fillOpacity="0.78" />
          <polygon points="36,48 44,18 52,48" fill="#FDE047" fillOpacity="0.85" />
          <line x1="44" y1="18" x2="44" y2="4" stroke="#FEF08A" strokeWidth="2" />
          {/* King Mengrai Monument Silhouette */}
          <rect x="88" y="76" width="24" height="32" fill="#0F172A" />
          <circle cx="100" cy="56" r="5" fill="#1E293B" />
          <path d="M94,76 L96,60 L104,60 L106,76 Z" fill="#1E293B" />
        </g>

        {/* Riverbank foliage & warm festival lanterns along the shore */}
        <path
          d="M0,160 L0,132 Q60,118 110,134 Q165,126 230,136 Q320,122 410,136 Q520,120 620,136 Q740,124 840,136 Q950,118 1060,134 Q1180,124 1280,135 Q1370,120 1440,132 L1440,160 Z"
          fill="#071226"
        />

        {/* Warm shoreline lantern dots */}
        {[95, 145, 295, 385, 510, 645, 765, 895, 1020, 1115, 1295, 1380].map((lx, i) => (
          <g key={i}>
            <circle cx={lx} cy={135 + (i % 2) * 3} r="2.6" fill="#FBBF24" opacity="0.85" />
            <circle cx={lx} cy={135 + (i % 2) * 3} r="8" fill="#F59E0B" opacity="0.2" />
          </g>
        ))}
      </svg>
    </div>
  );
};

// ============================================================================
// MAIN APPLICATION (SINGLE-FILE ARCHITECTURE)
// ============================================================================

export default function App() {
  // Core Krathong data & persistence (starts cleanly with 1 sample krathong)
  const [krathongs, setKrathongs] = useState<KrathongItem[]>(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.OLD_KRATHONGS_V1);
      const saved = localStorage.getItem(STORAGE_KEYS.KRATHONGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fallback to 1 sample krathong
    }
    return createSeedKrathongs();
  });

  const [userCode, setUserCode] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.USER_CODE) || '';
    } catch {
      return '';
    }
  });

  const [votedMap, setVotedMap] = useState<Record<string, { beautiful?: boolean; funny?: boolean }>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VOTED_MAP);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [gasUrl, setGasUrl] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const paramUrl = (params.get('gas') || params.get('sheet') || '').trim();
        if (paramUrl && isValidGasWebAppUrl(paramUrl)) {
          localStorage.setItem(STORAGE_KEYS.GAS_URL, paramUrl);
          return paramUrl;
        }
      }
      return localStorage.getItem(STORAGE_KEYS.GAS_URL) || DEFAULT_GAS_URL;
    } catch {
      return DEFAULT_GAS_URL;
    }
  });

  // UI & Modal States
  const [howToOpen, setHowToOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'none' | 'draw' | 'contest' | 'mine' | 'gas'>('none');
  const [selectedKrathong, setSelectedKrathong] = useState<KrathongItem | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [skyMode, setSkyMode] = useState<SkyMode>('realtime');
  const [currentHourFloat, setCurrentHourFloat] = useState(() => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  });

  // Contest modal state
  const [contestTab, setContestTab] = useState<'beautiful' | 'funny' | 'latest'>('beautiful');

  // My Krathongs lookup state
  const [lookupCodeInput, setLookupCodeInput] = useState('');
  const [remoteLookupItems, setRemoteLookupItems] = useState<KrathongItem[] | null>(null);
  const [isSyncingGas, setIsSyncingGas] = useState(false);

  // Google Sheet Setup modal state
  const [gasInputUrl, setGasInputUrl] = useState(gasUrl);
  const [gasStatus, setGasStatus] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [copiedCodeGs, setCopiedCodeGs] = useState(false);

  // Draw Studio States
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const signContainerRef = useRef<HTMLDivElement | null>(null);
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [penColor, setPenColor] = useState('#F59E0B');
  const [brushSize, setBrushSize] = useState<'sm' | 'md' | 'lg'>('md');
  const [selectedStamp, setSelectedStamp] = useState<StampKind>('lotus');
  const [baseType, setBaseType] = useState<BaseType>('coconut');
  const [petalPaletteId, setPetalPaletteId] = useState('natural');
  const [petalDensity, setPetalDensity] = useState<'sparse' | 'medium' | 'dense'>('medium');
  const [candleMode, setCandleMode] = useState<'single' | 'double' | 'none'>('single');
  const [candleColor, setCandleColor] = useState('#FFFBEB');
  const [incenseCount, setIncenseCount] = useState<0 | 1 | 3>(3);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Sign & Form States
  const [signStyle, setSignStyle] = useState<SignStyle>('wood');
  const [signColor, setSignColor] = useState('#A46A3E');
  const [signPos, setSignPos] = useState({ x: 64, y: 34 });
  const [isDraggingSign, setIsDraggingSign] = useState(false);
  const [nameSize, setNameSize] = useState<TextSizeOption>('md');
  const [wishSize, setWishSize] = useState<TextSizeOption>('md');
  const [krathongName, setKrathongName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [wishText, setWishText] = useState('');
  const [isContest, setIsContest] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sky Stars & Lanterns (memoized for smooth compositor animation)
  const stars = useMemo(
    () =>
      Array.from({ length: 72 }, (_, i) => ({
        id: i,
        left: (i * 37.3 + 11) % 100,
        top: (i * 19.7 + 5) % 88,
        size: i % 5 === 0 ? 3 : i % 2 === 0 ? 2 : 1.4,
        dur: 2.8 + (i % 6) * 0.7,
        delay: (i % 7) * 0.45,
      })),
    []
  );

  const [skyLanterns, setSkyLanterns] = useState<SkyLantern[]>(() =>
    Array.from({ length: 13 }, (_, i) => ({
      id: i + 1,
      leftPct: 6 + ((i * 8.3) % 88),
      size: 16 + (i % 4) * 7,
      durationSec: 22 + (i % 5) * 5,
      delaySec: -((i * 3.1) % 24),
      swayOffset: (i % 3) - 1,
    }))
  );

  // Floating River Physics State
  const [riverItems, setRiverItems] = useState<FloatingKrathongState[]>([]);
  const riverRef = useRef<FloatingKrathongState[]>([]);

  // Show temporary toast helper
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 4200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Real-time clock ticker every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentHourFloat(d.getHours() + d.getMinutes() / 60);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Persist Krathongs locally
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.KRATHONGS, JSON.stringify(krathongs));
    } catch {
      // Ignore quota exceeded
    }
  }, [krathongs]);

  // Persist voted map
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.VOTED_MAP, JSON.stringify(votedMap));
    } catch {
      // Ignore
    }
  }, [votedMap]);

  // Sync from Google Apps Script
  const fetchFromGas = useCallback(
    async (targetUrl: string, silent = true) => {
      const cleanUrl = targetUrl.trim();
      if (!cleanUrl) return;

      if (cleanUrl.includes('docs.google.com/spreadsheets')) {
        const msg =
          'ลิงก์นี้เป็นลิงก์ของหน้า Google Sheets ไม่ใช่ลิงก์ Web App จาก Apps Script กรุณาเปิด Extensions > Apps Script > Deploy แล้วคัดลอกลิงก์ที่ลงท้ายด้วย /exec มาวาง';
        setGasStatus({ type: 'error', text: msg });
        if (!silent) showToast(msg);
        return;
      }

      if (!isValidGasWebAppUrl(cleanUrl)) {
        const msg =
          'รูปแบบ URL ไม่ถูกต้อง ลิงก์ Web App ควรลงท้ายด้วย /exec เช่น https://script.google.com/macros/s/.../exec';
        setGasStatus({ type: 'error', text: msg });
        if (!silent) showToast(msg);
        return;
      }

      setIsSyncingGas(true);
      if (!silent) {
        setGasStatus({ type: 'info', text: 'กำลังเชื่อมต่อและดึงข้อมูลจาก Google Sheet...' });
      }

      try {
        const res = await fetch(cleanUrl, {
          method: 'GET',
          redirect: 'follow',
          cache: 'no-store',
        });
        const text = await res.text();
        let data: { ok?: boolean; items?: KrathongItem[]; error?: string } | null = null;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error('NOT_JSON');
        }

        if (data && data.ok && Array.isArray(data.items)) {
          if (data.items.length > 0) {
            setKrathongs((prev) => {
              const merged = new Map<string, KrathongItem>();
              data!.items!.forEach((item: KrathongItem) => merged.set(item.id, item));
              prev.forEach((item) => {
                if (!merged.has(item.id) && !item.id.startsWith('seed-')) {
                  merged.set(item.id, item);
                }
              });
              return Array.from(merged.values()).sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
            });
            const msg = `เชื่อมต่อ Google Sheet สำเร็จ (ซิงค์ข้อมูลแล้ว ${data.items.length} รายการ)`;
            setGasStatus({ type: 'success', text: msg });
            if (!silent) showToast(msg);
          } else {
            const msg = 'เชื่อมต่อ Google Sheet สำเร็จ (พร้อมบันทึกข้อมูลใหม่ลงชีตแล้ว)';
            setGasStatus({ type: 'success', text: msg });
            if (!silent) showToast(msg);
          }
        } else {
          const msg = `Apps Script ตอบกลับผิดพลาด: ${data?.error || 'กรุณาตรวจสอบโค้ด Code.gs'}`;
          setGasStatus({ type: 'error', text: msg });
          if (!silent) showToast(msg);
        }
      } catch (err) {
        const isNotJson = err instanceof Error && err.message === 'NOT_JSON';
        const msg = isNotJson
          ? 'เชื่อมต่อได้แต่ไม่ได้รับข้อมูล JSON — กรุณาตั้งค่า Deploy > Who has access เป็น "Anyone" (ทุกคน) ไม่ใช่เฉพาะภายในองค์กร'
          : 'ไม่สามารถเชื่อมต่อ Apps Script URL นี้ได้ กรุณาตรวจสอบว่าตั้งค่า Who has access เป็น "Anyone" (ทุกคน) และคัดลอกลิงก์ /exec ล่าสุด';
        setGasStatus({ type: 'error', text: msg });
        if (!silent) showToast(msg);
      } finally {
        setIsSyncingGas(false);
      }
    },
    [showToast]
  );

  // POST helper to Google Apps Script with verified response + no-cors + GET verification
  const postToGas = useCallback(
    async (
      targetUrl: string,
      payload: Record<string, unknown>
    ): Promise<{ ok: boolean; opaque?: boolean; error?: string }> => {
      const cleanUrl = targetUrl.trim();
      if (!cleanUrl) return { ok: false, error: 'ยังไม่ได้ตั้งค่า Web App URL' };
      const bodyStr = JSON.stringify(payload);
      try {
        const res = await fetch(cleanUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: bodyStr,
        });
        const text = await res.text();
        try {
          const parsed = JSON.parse(text);
          if (parsed && parsed.ok) {
            return { ok: true };
          }
          return {
            ok: false,
            error: parsed?.error || 'Apps Script ปฏิเสธการบันทึกข้อมูล',
          };
        } catch {
          return {
            ok: false,
            error:
              'ไม่ได้รับผลลัพธ์ JSON จาก Apps Script (โปรดตรวจสอบว่า Deploy สิทธิ์ Who has access เป็น "Anyone" ทุกคน และใช้ลิงก์ /exec ล่าสุด)',
          };
        }
      } catch {
        // Fallback when browser blocks reading redirected POST response from script.googleusercontent.com
        try {
          await fetch(cleanUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: bodyStr,
          });

          // If creating a krathong, verify persistence via GET ?checkId=
          const createdId =
            payload.action === 'create' &&
            payload.krathong &&
            typeof (payload.krathong as { id?: string }).id === 'string'
              ? (payload.krathong as { id: string }).id
              : '';

          if (createdId) {
            await new Promise((r) => setTimeout(r, 750));
            const sep = cleanUrl.includes('?') ? '&' : '?';
            try {
              const checkRes = await fetch(
                `${cleanUrl}${sep}checkId=${encodeURIComponent(createdId)}`,
                { method: 'GET', redirect: 'follow', cache: 'no-store' }
              );
              const checkText = await checkRes.text();
              const checkData = JSON.parse(checkText);
              if (checkData && checkData.ok && checkData.exists === true) {
                return { ok: true };
              }
              return {
                ok: false,
                error:
                  'ส่งข้อมูลแล้วแต่ยังไม่พบแถวใหม่ใน Google Sheet (กรุณาอัปเดต Code.gs และ Deploy > Manage deployments > New version พร้อมตั้งค่า Who has access เป็น Anyone)',
              };
            } catch {
              return {
                ok: false,
                error:
                  'เครื่องนี้เข้าถึง Apps Script ไม่ได้ — กรุณาตรวจสอบว่า Deploy > Who has access ตั้งเป็น "Anyone (ทุกคน)" ไม่ใช่เฉพาะบัญชีองค์กร',
              };
            }
          }

          return { ok: true, opaque: true };
        } catch {
          return {
            ok: false,
            error: 'เชื่อมต่อ Google Apps Script ไม่สำเร็จ (Network/CORS error)',
          };
        }
      }
    },
    []
  );

  // Sync once on initial mount, periodic background sync every 25s, + Ctrl+Shift+G modal shortcut
  const didInitialMountSyncRef = useRef(false);
  useEffect(() => {
    if (didInitialMountSyncRef.current) return;
    didInitialMountSyncRef.current = true;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('setup') === 'sheet') {
        setActiveModal('gas');
      }
    }
    if (gasUrl) {
      fetchFromGas(gasUrl, true);
    }
  }, [gasUrl, fetchFromGas]);

  useEffect(() => {
    if (!gasUrl.trim()) return;
    const interval = setInterval(() => {
      fetchFromGas(gasUrl, true);
    }, 25000);
    return () => clearInterval(interval);
  }, [gasUrl, fetchFromGas]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setGasInputUrl(gasUrl);
        setGasStatus(null);
        setActiveModal('gas');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gasUrl]);

  // Initialize & sync Floating River items (left to right movement)
  useEffect(() => {
    const existingMap = new Map<string, FloatingKrathongState>();
    riverRef.current.forEach((f) => existingMap.set(f.item.id, f));

    const visiblePool = krathongs.slice(0, 28);
    const nextList: FloatingKrathongState[] = visiblePool.map((item, idx) => {
      const existing = existingMap.get(item.id);
      if (existing) {
        return { ...existing, item };
      }
      const lane = idx % 5; // 0 = farthest back, 4 = nearest front
      const scale = 0.62 + lane * 0.11;
      const speed = 1.65 + lane * 0.48 + (idx % 3) * 0.18;
      // Newly created item spawns near left entrance so user sees it float immediately!
      const isBrandNew = Date.now() - new Date(item.createdAt).getTime() < 8000;
      const startX = isBrandNew ? 4 : ((idx * 17.5 + lane * 7) % 102) - 4;
      return {
        item,
        x: startX,
        lane,
        speed,
        bobOffset: idx * 0.85,
        scale,
      };
    });

    riverRef.current = nextList;
    setRiverItems(nextList);
  }, [krathongs]);

  // River animation loop (left -> right)
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let animId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      riverRef.current = riverRef.current.map((f) => {
        let nextX = f.x + f.speed * dt;
        if (nextX > 108) nextX = -14;
        return { ...f, x: nextX };
      });
      setRiverItems([...riverRef.current]);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // ============================================================================
  // DRAWING CANVAS HANDLERS
  // ============================================================================

  const pushUndoSnapshot = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack((prev) => [...prev.slice(-14), snap]);
  }, []);

  // Re-render preset base onto canvas when Draw Studio opens or base customization changes
  const applyBaseToCanvas = useCallback(
    (
      nextBase: BaseType,
      paletteId = petalPaletteId,
      density = petalDensity,
      cMode = candleMode,
      cColor = candleColor,
      iCount = incenseCount
    ) => {
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      pushUndoSnapshot();
      renderKrathongBaseToCanvas(ctx, nextBase, {
        petalPaletteId: paletteId,
        petalDensity: density,
        candleMode: cMode,
        candleColor: cColor,
        incenseCount: iCount,
      });
    },
    [candleColor, candleMode, incenseCount, petalDensity, petalPaletteId, pushUndoSnapshot]
  );

  // Initialize Draw Studio canvas when modal opens
  useEffect(() => {
    if (activeModal !== 'draw') return;
    const timer = setTimeout(() => {
      const canvas = drawCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderKrathongBaseToCanvas(ctx, baseType, {
        petalPaletteId,
        petalDensity,
        candleMode,
        candleColor,
        incenseCount,
      });
      setUndoStack([]);
    }, 30);
    return () => clearTimeout(timer);
    // Intentionally run when modal opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModal]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingSign) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    pushUndoSnapshot();
    const pt = getCanvasPoint(e);

    if (drawTool === 'flower') {
      const radius = brushSize === 'sm' ? 10 : brushSize === 'lg' ? 22 : 15;
      drawStampOnCanvas(ctx, selectedStamp, pt.x, pt.y, radius);
      return;
    }

    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    lastPointRef.current = pt;

    const strokeW = brushSize === 'sm' ? 4 : brushSize === 'lg' ? 16 : 9;
    ctx.save();
    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    }
    ctx.fillStyle = penColor;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, strokeW / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getCanvasPoint(e);
    const strokeW = brushSize === 'sm' ? 4 : brushSize === 'lg' ? 16 : 9;

    ctx.save();
    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    }
    ctx.strokeStyle = penColor;
    ctx.lineWidth = strokeW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.restore();

    lastPointRef.current = pt;
  };

  const handleCanvasPointerUp = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  const handleUndo = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas || undoStack.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const prevSnap = undoStack[undoStack.length - 1];
    ctx.putImageData(prevSnap, 0, 0);
    setUndoStack((s) => s.slice(0, -1));
  };

  const handleClearCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    pushUndoSnapshot();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setBaseType('none');
  };

  // Sign drag handler on canvas container
  const handleSignContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSign || !signContainerRef.current) return;
    const rect = signContainerRef.current.getBoundingClientRect();
    const xPct = Math.max(12, Math.min(88, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(10, Math.min(72, ((e.clientY - rect.top) / rect.height) * 100));
    setSignPos({ x: xPct, y: yPct });
  };

  // ============================================================================
  // RELEASE KRATHONG & VOTING HANDLERS
  // ============================================================================

  const handleReleaseKrathong = async () => {
    if (isContest && !krathongName.trim()) {
      showToast('กรุณาตั้งชื่อกระทงก่อนส่งเข้าประกวด');
      return;
    }

    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const imageData = exportCompactKrathongDataUrl(canvas);

    let activeCode = userCode;
    if (!activeCode) {
      activeCode = generateUserCode();
      setUserCode(activeCode);
      try {
        localStorage.setItem(STORAGE_KEYS.USER_CODE, activeCode);
      } catch {
        // Ignore
      }
    }

    const newItem: KrathongItem = {
      id: `kr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userCode: activeCode,
      name: krathongName.trim() || 'กระทงอธิษฐาน',
      ownerName: ownerName.trim() || 'ผู้ร่วมลอยออนไลน์',
      wish: wishText.trim(),
      imageData,
      baseType,
      signStyle,
      signColor,
      signX: signPos.x,
      signY: signPos.y,
      nameSize,
      wishSize,
      isContest,
      beautifulVotes: 0,
      funnyVotes: 0,
      createdAt: new Date().toISOString(),
    };

    setIsSubmitting(true);
    setKrathongs((prev) => [newItem, ...prev]);

    // Sync to Google Apps Script Web App if configured
    let sheetSyncNote = '';
    if (gasUrl.trim()) {
      const result = await postToGas(gasUrl, { action: 'create', krathong: newItem });
      if (!result.ok) {
        sheetSyncNote = ` (หมายเหตุ: บันทึกลง Google Sheet ไม่สำเร็จ: ${result.error})`;
      } else if (!result.opaque) {
        sheetSyncNote = ' และบันทึกลง Google Sheet แล้ว';
      }
    }

    setIsSubmitting(false);
    setActiveModal('none');
    setKrathongName('');
    setWishText('');
    showToast(`ปล่อยกระทงลงสายน้ำแล้ว${sheetSyncNote}! รหัสกระทงของคุณคือ ${activeCode}`);
  };

  const handleVote = async (item: KrathongItem, voteType: 'beautiful' | 'funny') => {
    const prevVote = votedMap[item.id]?.[voteType] || false;
    const delta = prevVote ? -1 : 1;

    setVotedMap((prev) => ({
      ...prev,
      [item.id]: {
        ...prev[item.id],
        [voteType]: !prevVote,
      },
    }));

    const updateList = (list: KrathongItem[]) =>
      list.map((k) => {
        if (k.id !== item.id) return k;
        return {
          ...k,
          beautifulVotes:
            voteType === 'beautiful' ? Math.max(0, k.beautifulVotes + delta) : k.beautifulVotes,
          funnyVotes: voteType === 'funny' ? Math.max(0, k.funnyVotes + delta) : k.funnyVotes,
        };
      });

    setKrathongs(updateList);
    if (selectedKrathong && selectedKrathong.id === item.id) {
      setSelectedKrathong((curr) =>
        curr
          ? {
              ...curr,
              beautifulVotes:
                voteType === 'beautiful'
                  ? Math.max(0, curr.beautifulVotes + delta)
                  : curr.beautifulVotes,
              funnyVotes:
                voteType === 'funny' ? Math.max(0, curr.funnyVotes + delta) : curr.funnyVotes,
            }
          : null
      );
    }

    if (gasUrl.trim()) {
      const result = await postToGas(gasUrl, {
        action: 'vote',
        id: item.id,
        voteType,
        delta,
      });
      if (!result.ok && result.error) {
        showToast(`อัปเดตผลโหวตลง Google Sheet ไม่สำเร็จ: ${result.error}`);
      }
    }
  };

  const handleUseForeignCode = async () => {
    const clean = lookupCodeInput.trim().toUpperCase();
    if (!clean) return;
    setUserCode(clean);
    try {
      localStorage.setItem(STORAGE_KEYS.USER_CODE, clean);
    } catch {
      // Ignore
    }
    if (gasUrl.trim()) {
      setIsSyncingGas(true);
      try {
        const sep = gasUrl.includes('?') ? '&' : '?';
        const res = await fetch(`${gasUrl.trim()}${sep}userCode=${encodeURIComponent(clean)}`);
        const data = await res.json();
        if (data && data.ok && Array.isArray(data.items)) {
          setRemoteLookupItems(data.items);
        }
      } catch {
        // Fallback to local
      } finally {
        setIsSyncingGas(false);
      }
    }
    showToast(`สลับมาใช้รหัสกระทง ${clean} แล้ว`);
  };

  const handleShareInvite = async () => {
    const urlObj = new URL(window.location.href);
    urlObj.searchParams.delete('setup');
    if (gasUrl.trim() && gasUrl.trim() !== DEFAULT_GAS_URL) {
      urlObj.searchParams.set('gas', gasUrl.trim());
    }
    const shareUrl = urlObj.toString();
    const shareText =
      'มาร่วมลอยกระทงออนไลน์ 2569 กับวิทยาลัยการอาชีพเวียงเชียงรุ้ง วาดกระทงและปล่อยลงสายน้ำพร้อมกัน!';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ลอยกระทงออนไลน์ 2569', text: shareText, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        showToast('คัดลอกลิงก์ชวนเพื่อนมาลอยแล้ว');
      }
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('คัดลอกลิงก์ชวนเพื่อนมาลอยแล้ว');
      } catch {
        showToast('แชร์ลิงก์หน้านี้ให้เพื่อนมาร่วมลอยด้วยกันได้เลย');
      }
    }
  };

  const handleReleaseExtraLantern = () => {
    setSkyLanterns((prev) => [
      ...prev.slice(-18),
      {
        id: Date.now(),
        leftPct: 14 + Math.random() * 72,
        size: 18 + Math.random() * 10,
        durationSec: 20 + Math.random() * 8,
        delaySec: 0,
        swayOffset: Math.random() > 0.5 ? 1 : -1,
      },
    ]);
    showToast('ปล่อยโคมลอยขึ้นสู่ฟากฟ้าเชียงรายแล้ว');
  };

  const handleSpotlightOnRiver = (item: KrathongItem) => {
    setActiveModal('none');
    riverRef.current = riverRef.current.map((f) =>
      f.item.id === item.id ? { ...f, x: 42 } : f
    );
    const existsOnRiver = riverRef.current.some((f) => f.item.id === item.id);
    if (!existsOnRiver) {
      riverRef.current = [
        ...riverRef.current,
        { item, x: 42, lane: 3, speed: 2.6, bobOffset: 0, scale: 0.95 },
      ];
    }
    setRiverItems([...riverRef.current]);
    setSelectedKrathong(item);
  };

  // Derived lists & stats
  const totalKrathongCount = krathongs.length;
  const skyPalette = getSkyPalette(skyMode, currentHourFloat);

  const myKrathongs = useMemo(() => {
    if (!userCode) return [];
    const localMatches = krathongs.filter(
      (k) => k.userCode.toUpperCase() === userCode.toUpperCase()
    );
    if (remoteLookupItems && remoteLookupItems.length > 0) {
      const map = new Map<string, KrathongItem>();
      remoteLookupItems.forEach((k) => map.set(k.id, k));
      localMatches.forEach((k) => map.set(k.id, k));
      return Array.from(map.values());
    }
    return localMatches;
  }, [krathongs, remoteLookupItems, userCode]);

  const sortedContestItems = useMemo(() => {
    const pool = krathongs.filter((k) => k.isContest || contestTab === 'latest');
    if (contestTab === 'beautiful') {
      return [...pool].sort((a, b) => b.beautifulVotes - a.beautifulVotes);
    }
    if (contestTab === 'funny') {
      return [...pool].sort((a, b) => b.funnyVotes - a.funnyVotes);
    }
    return [...pool].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [contestTab, krathongs]);

  const recentParticipants = useMemo(() => krathongs.slice(0, 6), [krathongs]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#071026] text-slate-100 select-none">
      {/* =====================================================================
          UPPER SKY BACKGROUND (46% dynamic viewport height)
         ===================================================================== */}
      <div
        className="absolute inset-x-0 top-0 h-[46dvh] sm:h-[45dvh] transition-all duration-1000"
        style={{ background: skyPalette.skyGrad }}
      >
        {/* Twinkling Starfield */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
          style={{ opacity: skyPalette.starOpacity }}
        >
          {stars.map((s) => (
            <span
              key={s.id}
              className="absolute rounded-full bg-amber-50 animate-twinkle"
              style={
                {
                  left: `${s.left}%`,
                  top: `${s.top}%`,
                  width: `${s.size}px`,
                  height: `${s.size}px`,
                  '--twinkle-dur': `${s.dur}s`,
                  animationDelay: `${s.delay}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        {/* Full Moon with atmospheric halo & craters */}
        <div
          className="absolute right-[28%] sm:right-[22%] transition-all duration-1000 pointer-events-none"
          style={{ top: `${skyPalette.moonTopPct}%`, opacity: skyPalette.moonOpacity }}
        >
          <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-[#FEF6D3] shadow-[0_0_65px_24px_rgba(253,230,138,0.28)]">
            <div className="absolute top-4 left-5 w-4 h-4 rounded-full bg-amber-200/45" />
            <div className="absolute bottom-5 right-6 w-5 h-5 rounded-full bg-amber-200/35" />
            <div className="absolute top-10 right-4 w-2.5 h-2.5 rounded-full bg-amber-200/40" />
          </div>
        </div>

        {/* Floating Yi Peng Sky Lanterns (โคมลอย) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {skyLanterns.map((lantern) => (
            <div
              key={lantern.id}
              className="absolute bottom-4 animate-lantern"
              style={
                {
                  left: `${lantern.leftPct}%`,
                  '--lantern-dur': `${lantern.durationSec}s`,
                  animationDelay: `${lantern.delaySec}s`,
                } as React.CSSProperties
              }
            >
              <div
                className="rounded-t-md rounded-b-sm bg-gradient-to-b from-amber-200 via-amber-400 to-orange-600 shadow-[0_0_16px_rgba(251,191,36,0.65)]"
                style={{
                  width: `${lantern.size}px`,
                  height: `${Math.round(lantern.size * 1.28)}px`,
                }}
              />
            </div>
          ))}
        </div>

        {/* Random Periodic Fireworks & Sky Bursts */}
        <FireworksCanvas />

        {/* Ambient Horizon Warmth */}
        <div
          className="absolute inset-x-0 bottom-0 h-24 pointer-events-none"
          style={{
            background: `linear-gradient(to top, ${skyPalette.ambientGlow}, transparent)`,
          }}
        />

        {/* Chiang Rai Landmarks Shoreline */}
        <ChiangRaiShoreline />
      </div>

      {/* =====================================================================
          ANIMATED RIVER WATER LAYER (54% dynamic viewport height)
         ===================================================================== */}
      <div
        className="absolute inset-x-0 bottom-0 h-[54dvh] sm:h-[55dvh] transition-all duration-1000 overflow-hidden"
        style={{ background: skyPalette.waterGrad }}
      >
        <FlowingWaterCanvas moonLeftPct={76} />

        {/* Subtle surface shimmer reflection under shoreline */}
        <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#071226]/90 to-transparent pointer-events-none" />

        {/* Real-time Floating Krathongs (Left -> Right across 5 depth lanes) */}
        <div className="relative w-full h-full">
          {riverItems.map((fk) => {
            const topPct = 6 + fk.lane * 16.5;
            const zIdx = 10 + fk.lane;
            return (
              <button
                key={fk.item.id}
                type="button"
                onClick={() => setSelectedKrathong(fk.item)}
                title={`คลิกเพื่อดูคำอธิษฐานและโหวตให้ "${fk.item.name}"`}
                className="group absolute -translate-x-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl cursor-pointer transition-transform hover:scale-105"
                style={{
                  left: `${fk.x}%`,
                  top: `${topPct}%`,
                  zIndex: zIdx,
                  transform: `translateX(-50%) scale(${fk.scale})`,
                }}
              >
                <div
                  className="relative flex flex-col items-center animate-bob"
                  style={
                    {
                      '--bob-dur': `${3.1 + (fk.lane % 3) * 0.55}s`,
                      animationDelay: `${-fk.bobOffset}s`,
                    } as React.CSSProperties
                  }
                >
                  {/* Warm candle glow reflection on water */}
                  <div className="absolute bottom-2 w-24 h-7 rounded-full bg-amber-400/20 blur-md group-hover:bg-amber-300/35 transition-colors pointer-events-none" />

                  {/* Krathong Artwork + Sign */}
                  <div className="relative w-32 h-32 sm:w-36 sm:h-36">
                    <img
                      src={fk.item.imageData}
                      alt={fk.item.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)]"
                    />
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${fk.item.signX}%`, top: `${fk.item.signY}%` }}
                    >
                      <KrathongSignBadge
                        styleType={fk.item.signStyle}
                        colorHex={fk.item.signColor}
                        name={fk.item.name}
                        wish={fk.item.wish}
                        nameSize={fk.item.nameSize}
                        wishSize={fk.item.wishSize}
                        compact
                      />
                    </div>
                  </div>

                  {/* Subtle Water Reflection */}
                  <div className="w-24 h-5 -mt-5 opacity-25 scale-y-[-0.45] blur-[1.5px] pointer-events-none overflow-hidden">
                    <img
                      src={fk.item.imageData}
                      alt=""
                      aria-hidden="true"
                      className="w-full h-24 object-contain"
                    />
                  </div>

                  {/* Owner label cleanly beneath */}
                  <span className="mt-1 px-2 py-0.5 rounded bg-slate-950/65 text-[11px] font-medium text-amber-100/95 whitespace-nowrap max-w-[140px] truncate backdrop-blur-xs">
                    {fk.item.ownerName}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          TOP OVERLAY HUD (Hero Title, College Badge, How-to Toggle, Actions)
         ===================================================================== */}
      <header className="relative z-30 flex items-start justify-between gap-3 p-4 sm:p-7 pointer-events-none">
        {/* Left Hero Stack */}
        <div className="max-w-md pointer-events-auto">
          <h1 className="font-display-thai text-5xl sm:text-7xl font-bold text-[#FEF3C7] leading-none drop-shadow-[0_4px_18px_rgba(253,224,71,0.35)]">
            ลอยกระทง
          </h1>
          <p className="text-xl sm:text-2xl font-bold text-white mt-1 tracking-wide">
            ออนไลน์ 2569
          </p>
          <p className="text-xs sm:text-sm text-slate-200/90 mt-2 leading-relaxed max-w-xs sm:max-w-sm">
            วาดกระทงของคุณ แล้วปล่อยลงสายน้ำพร้อมทุกคน ฟรี ไม่ต้องสมัคร
          </p>

          {/* Total Krathong Count & Recent Participants Trigger */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-amber-100/90 tabular-nums">
            <span>• {totalKrathongCount.toLocaleString('th-TH')} กระทงลอยอยู่ในสายน้ำ</span>
            <button
              type="button"
              onClick={() => setRecentOpen((v) => !v)}
              className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 underline underline-offset-4 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>ผู้เข้าร่วมล่าสุด</span>
            </button>
          </div>

          {/* College Host Badge (blended midnight glass with high-contrast text) */}
          <div className="mt-3 inline-flex items-center gap-2.5 bg-slate-950/55 backdrop-blur-md border border-amber-200/25 text-white rounded-2xl pl-2.5 pr-4 py-2 shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
            <img
              src={COLLEGE_LOGO_URL}
              alt="ตราสัญลักษณ์วิทยาลัยการอาชีพเวียงเชียงรุ้ง"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-full object-cover bg-white p-0.5 border border-amber-300/45 shrink-0"
            />
            <div className="leading-tight">
              <div className="text-[11px] text-amber-200/85">ร่วมลอยกระทงกับ</div>
              <div className="text-xs sm:text-sm font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] whitespace-nowrap">
                วิทยาลัยการอาชีพเวียงเชียงรุ้ง
              </div>
              <div className="text-[10.5px] sm:text-[11px] text-slate-300 mt-0.5">
                พัฒนาโดยงานศูนย์ดิจิทัลและสื่อสารองค์กร
              </div>
            </div>
          </div>

          {/* Collapsible "วิธีลอยกระทงออนไลน์" Link */}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setHowToOpen((prev) => !prev)}
              aria-expanded={howToOpen}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-200 hover:text-amber-200 underline underline-offset-4 cursor-pointer py-1"
            >
              {howToOpen ? (
                <ChevronDown className="w-4 h-4 text-amber-300" />
              ) : (
                <ChevronRight className="w-4 h-4 text-amber-300" />
              )}
              <span>วิธีลอยกระทงออนไลน์</span>
            </button>

            {howToOpen && (
              <div className="mt-2 p-4 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-white/15 text-xs sm:text-[13px] text-slate-200 leading-relaxed space-y-2 shadow-2xl max-w-md max-h-[38dvh] overflow-y-auto">
                <p className="font-medium text-amber-200">
                  วันลอยกระทง 2569 (ลอยกระทง 69 · ค.ศ. 2026 หรือปี 26) ตรงกับวันอังคารที่ 24
                  พฤศจิกายน 2569 ร่วมลอยกระทงออนไลน์ 69 กับ วิทยาลัยการอาชีพเวียงเชียงรุ้ง ได้จาก
                  มือถือหรือคอมพิวเตอร์ ใช้ฟรี ไม่ต้องสมัครสมาชิก
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-200/95">
                  <li>กด วาดกระทง วาดเองหรือเลือกฐานกระทง สำเร็จรูป แล้วตกแต่งด้วยดอกไม้</li>
                  <li>ใส่ชื่อและคำอธิษฐาน แล้วกด ปล่อยกระทงลงน้ำ กระทงจะลอยไปพร้อมกระทงของทุกคน</li>
                  <li>ติ๊ก ส่งเข้าประกวด ให้คนดูโหวตกระทงสวยงาม หรือกระทงปั่น ๆ</li>
                  <li>เก็บ รหัสกระทง ไว้เปิดดูกระทงของคุณจากเครื่องอื่น</li>
                </ol>
                <p className="text-[11.5px] text-slate-400 pt-1 border-t border-white/10">
                  Loy Krathong Online 2026: draw your own krathong, add a wish and float it on a
                  shared river. Free, no sign-up.
                </p>
              </div>
            )}

            {/* Collapsible Recent Participants Panel */}
            {recentOpen && (
              <div className="mt-2 p-3.5 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-white/15 text-xs shadow-2xl max-w-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-amber-200">
                    รายชื่อผู้เข้าร่วมกิจกรรมล่าสุด
                  </span>
                  <button
                    type="button"
                    onClick={() => setRecentOpen(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                    aria-label="ปิดรายชื่อผู้เข้าร่วม"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {recentParticipants.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setRecentOpen(false);
                        handleSpotlightOnRiver(p);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-left transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate">{p.ownerName}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {p.name}
                          {p.wish ? ` · "${p.wish}"` : ''}
                        </div>
                      </div>
                      <span className="text-[11px] text-amber-300 whitespace-nowrap shrink-0">
                        ดูในน้ำ
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Top Controls */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto shrink-0">
          <button
            type="button"
            onClick={handleShareInvite}
            className="px-3.5 py-2 rounded-full bg-slate-900/65 hover:bg-slate-900/90 border border-white/20 text-xs sm:text-sm font-medium text-white backdrop-blur-md transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-amber-300" />
            <span>ชวนเพื่อนมาลอย</span>
          </button>

          <button
            type="button"
            onClick={handleReleaseExtraLantern}
            className="px-3 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-[11.5px] text-amber-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Flame className="w-3.5 h-3.5 text-amber-300" />
            <span>ปล่อยโคมลอย</span>
          </button>

          {/* Interactive Sky Time Lighting Column directly below ปล่อยโคมลอย */}
          <div
            aria-label="เลือกช่วงเวลาท้องฟ้า"
            className="flex flex-col items-stretch gap-1 bg-slate-950/70 border border-white/15 rounded-2xl p-1.5 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
          >
            {(
              [
                { id: 'realtime', label: 'เวลาจริง' },
                { id: 'dusk', label: 'พลบค่ำ' },
                { id: 'midnight', label: 'จันทร์เพ็ญ' },
                { id: 'dawn', label: 'รุ่งสาง' },
              ] as { id: SkyMode; label: string }[]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSkyMode(m.id)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] leading-tight text-center transition-colors whitespace-nowrap cursor-pointer ${
                  skyMode === m.id
                    ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* =====================================================================
          BOTTOM FLOATING DOCK (Fixed at bottom for all screen & iPad orientations)
         ===================================================================== */}
      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-x-0 z-40 flex justify-center px-3 pointer-events-none"
        style={{ bottom: 'max(0.85rem, env(safe-area-inset-bottom))' }}
      >
        <div className="pointer-events-auto inline-flex items-center gap-1 sm:gap-2 p-1.5 rounded-full bg-slate-950/85 border border-white/15 backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.65)] max-w-full">
          <button
            type="button"
            onClick={() => setActiveModal('contest')}
            className="px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer min-h-[42px]"
          >
            <Award className="w-4 h-4 text-amber-300" />
            <span>ประกวด</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('draw')}
            className="px-5 sm:px-7 py-2.5 rounded-full text-xs sm:text-sm font-bold bg-[#F5A623] hover:bg-[#FFB73B] text-slate-950 shadow-[0_4px_18px_rgba(245,166,35,0.4)] transition-all active:scale-95 inline-flex items-center gap-2 whitespace-nowrap cursor-pointer min-h-[44px]"
          >
            <PenTool className="w-4 h-4" />
            <span>วาดกระทง</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveModal('mine')}
            className="px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium text-slate-200 hover:text-white hover:bg-white/10 transition-colors inline-flex items-center gap-2 whitespace-nowrap cursor-pointer min-h-[42px]"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>ของฉัน</span>
          </button>
        </div>
      </nav>

      {/* =====================================================================
          TOAST FEEDBACK BANNER (Always rendered above modals)
         ===================================================================== */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-xl bg-slate-900/95 border border-amber-400/45 text-amber-100 text-xs sm:text-sm shadow-2xl backdrop-blur-md flex items-center gap-2 max-w-[92vw]">
          <Check className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* =====================================================================
          KRATHONG CLICK DETAIL & VOTE POPOVER MODAL
         ===================================================================== */}
      {selectedKrathong && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedKrathong(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#101D3B] border border-white/15 p-5 sm:p-6 shadow-2xl text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-amber-200">
                  {selectedKrathong.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  ผู้ลอย: <span className="font-medium text-white">{selectedKrathong.ownerName}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedKrathong(null)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Artwork Showcase */}
            <div className="mt-4 relative h-52 rounded-xl bg-gradient-to-b from-[#0A142D] to-[#0E244A] border border-white/10 flex items-center justify-center overflow-hidden">
              <img
                src={selectedKrathong.imageData}
                alt={selectedKrathong.name}
                referrerPolicy="no-referrer"
                className="w-44 h-44 object-contain"
              />
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${selectedKrathong.signX}%`,
                  top: `${selectedKrathong.signY}%`,
                }}
              >
                <KrathongSignBadge
                  styleType={selectedKrathong.signStyle}
                  colorHex={selectedKrathong.signColor}
                  name={selectedKrathong.name}
                  wish={selectedKrathong.wish}
                  nameSize={selectedKrathong.nameSize}
                  wishSize={selectedKrathong.wishSize}
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 h-10 bg-sky-900/25 border-t border-dashed border-sky-300/30 pointer-events-none" />
            </div>

            {/* Full Wish */}
            <div className="mt-4 p-3.5 rounded-xl bg-white/5 border border-white/10">
              <div className="text-[11px] text-amber-300/90 mb-1">คำอธิษฐาน</div>
              <p className="text-sm text-slate-100 leading-relaxed">
                {selectedKrathong.wish || 'ร่วมสืบสานประเพณีลอยกระทงออนไลน์ 2569'}
              </p>
            </div>

            {/* Vote Buttons: สวยงาม & ปั่นๆ */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleVote(selectedKrathong, 'beautiful')}
                className={`py-2.5 px-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px] ${
                  votedMap[selectedKrathong.id]?.beautiful
                    ? 'bg-pink-500/25 border-pink-400 text-pink-100'
                    : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-100'
                }`}
              >
                <Heart
                  className={`w-4 h-4 ${
                    votedMap[selectedKrathong.id]?.beautiful ? 'fill-pink-400 text-pink-400' : 'text-pink-300'
                  }`}
                />
                <span>สวยงาม</span>
                <span className="tabular-nums text-xs opacity-85">
                  ({selectedKrathong.beautifulVotes})
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleVote(selectedKrathong, 'funny')}
                className={`py-2.5 px-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px] ${
                  votedMap[selectedKrathong.id]?.funny
                    ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                    : 'bg-white/5 hover:bg-white/10 border-white/15 text-slate-100'
                }`}
              >
                <Laugh
                  className={`w-4 h-4 ${
                    votedMap[selectedKrathong.id]?.funny ? 'text-amber-300' : 'text-amber-200'
                  }`}
                />
                <span>ปั่นๆ</span>
                <span className="tabular-nums text-xs opacity-85">
                  ({selectedKrathong.funnyVotes})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: DRAW KRATHONG STUDIO ("วาดกระทงของคุณ")
         ===================================================================== */}
      {activeModal === 'draw' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
          <div className="w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-2xl bg-[#111E3E] border border-white/15 p-4 sm:p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="font-display-thai text-3xl sm:text-4xl font-bold text-[#FEF3C7]">
                วาดกระทงของคุณ
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 cursor-pointer"
                aria-label="ปิดหน้าต่างวาดกระทง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* LEFT COLUMN: Interactive Drawing Canvas + Preset Base + Material Customizer */}
              <div className="lg:col-span-6 space-y-4">
                {/* Interactive Canvas Container */}
                <div>
                  <div
                    ref={signContainerRef}
                    onPointerMove={handleSignContainerPointerMove}
                    onPointerUp={() => setIsDraggingSign(false)}
                    onPointerLeave={() => setIsDraggingSign(false)}
                    className="relative w-full aspect-square max-w-[440px] mx-auto rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-b from-[#0E1D42] via-[#122652] to-[#0B1733]"
                  >
                    <canvas
                      ref={drawCanvasRef}
                      width={400}
                      height={400}
                      onPointerDown={handleCanvasPointerDown}
                      onPointerMove={handleCanvasPointerMove}
                      onPointerUp={handleCanvasPointerUp}
                      onPointerCancel={handleCanvasPointerUp}
                      className="w-full h-full touch-none cursor-crosshair"
                    />

                    {/* Waterline Indicator */}
                    <div className="absolute inset-x-0 bottom-[22%] border-t border-dashed border-sky-200/50 pointer-events-none">
                      <span className="absolute right-2 -top-5 text-[11px] text-sky-200/80">
                        ระดับน้ำ
                      </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-[22%] bg-sky-950/35 pointer-events-none" />

                    {/* Draggable Sign Preview */}
                    {signStyle !== 'none' && (
                      <div
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setIsDraggingSign(true);
                        }}
                        title="ลากป้ายไปวางตรงไหนก็ได้"
                        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-20"
                        style={{ left: `${signPos.x}%`, top: `${signPos.y}%` }}
                      >
                        <KrathongSignBadge
                          styleType={signStyle}
                          colorHex={signColor}
                          name={krathongName || 'ชื่อกระทง'}
                          wish={wishText || 'ลากป้ายไปวางตรงไหนก็ได้'}
                          nameSize={nameSize}
                          wishSize={wishSize}
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-center text-xs text-slate-300 mt-1.5">
                    ส่วนที่อยู่ใต้เส้นระดับน้ำจะจมอยู่ในน้ำ · ลากป้ายชื่อบนภาพเพื่อย้ายตำแหน่งได้
                  </p>
                </div>

                {/* Preset Bases Grid */}
                <div>
                  <div className="text-xs sm:text-sm font-medium text-slate-200 mb-2">
                    ฐานกระทงสำเร็จรูป (เลือกแล้ววาดตกแต่งต่อได้ เปลี่ยนแบบได้ตลอด)
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {BASE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setBaseType(opt.id);
                          applyBaseToCanvas(opt.id);
                        }}
                        className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 min-h-[66px] ${
                          baseType === opt.id
                            ? 'bg-amber-400/15 border-amber-300 text-amber-200'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                        }`}
                      >
                        <span className="text-[11px] leading-tight font-medium">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Self-Customizable Elements: รูปทรง กลีบบัว ธูป เทียน วัสดุ สีสัน */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="text-xs font-semibold text-amber-200">
                    ปรับแต่งองค์ประกอบฐานกระทง (กลีบบัว · ธูป · เทียน · สีสัน)
                  </div>

                  {/* Petal Color / Material Palette */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-300 w-20 shrink-0">สีกลีบ/วัสดุ</span>
                    {PETAL_PALETTES.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setPetalPaletteId(p.id);
                          if (baseType !== 'none') {
                            applyBaseToCanvas(baseType, p.id, petalDensity, candleMode, candleColor, incenseCount);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] border cursor-pointer transition-colors ${
                          petalPaletteId === p.id
                            ? 'bg-amber-300 text-slate-950 border-amber-200 font-semibold'
                            : 'bg-white/5 text-slate-200 border-white/15 hover:bg-white/10'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Petal Density */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-300 w-20 shrink-0">กลีบบัว</span>
                    {(
                      [
                        { id: 'sparse', label: 'โปร่ง' },
                        { id: 'medium', label: 'พอดี' },
                        { id: 'dense', label: 'แน่นพิเศษ' },
                      ] as const
                    ).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          setPetalDensity(d.id);
                          if (baseType !== 'none') {
                            applyBaseToCanvas(baseType, petalPaletteId, d.id, candleMode, candleColor, incenseCount);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] border cursor-pointer ${
                          petalDensity === d.id
                            ? 'bg-amber-300 text-slate-950 border-amber-200 font-semibold'
                            : 'bg-white/5 text-slate-200 border-white/15 hover:bg-white/10'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>

                  {/* Candle & Incense Toggles */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-300 w-20 shrink-0">เทียน</span>
                    {(
                      [
                        { id: 'single', label: '1 เล่ม' },
                        { id: 'double', label: '2 เล่ม' },
                        { id: 'none', label: 'ไม่ใส่' },
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCandleMode(c.id);
                          if (baseType !== 'none') {
                            applyBaseToCanvas(baseType, petalPaletteId, petalDensity, c.id, candleColor, incenseCount);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] border cursor-pointer ${
                          candleMode === c.id
                            ? 'bg-amber-300 text-slate-950 border-amber-200 font-semibold'
                            : 'bg-white/5 text-slate-200 border-white/15 hover:bg-white/10'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 ml-1">
                      {['#FFFBEB', '#FDE047', '#F9A8D4', '#EF4444'].map((cCol) => (
                        <button
                          key={cCol}
                          type="button"
                          onClick={() => {
                            setCandleColor(cCol);
                            if (baseType !== 'none') {
                              applyBaseToCanvas(baseType, petalPaletteId, petalDensity, candleMode, cCol, incenseCount);
                            }
                          }}
                          className={`w-4 h-4 rounded-full border cursor-pointer ${
                            candleColor === cCol ? 'ring-2 ring-amber-300 border-white' : 'border-white/30'
                          }`}
                          style={{ backgroundColor: cCol }}
                          aria-label="เลือกสีเทียน"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-300 w-20 shrink-0">ธูป</span>
                    {([3, 1, 0] as const).map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => {
                          setIncenseCount(cnt);
                          if (baseType !== 'none') {
                            applyBaseToCanvas(baseType, petalPaletteId, petalDensity, candleMode, candleColor, cnt);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] border cursor-pointer ${
                          incenseCount === cnt
                            ? 'bg-amber-300 text-slate-950 border-amber-200 font-semibold'
                            : 'bg-white/5 text-slate-200 border-white/15 hover:bg-white/10'
                        }`}
                      >
                        {cnt === 0 ? 'ไม่ใส่ธูป' : `${cnt} ดอก`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Tools, Colors, Sign Styles, Form Inputs, Submit */}
              <div className="lg:col-span-6 space-y-4">
                {/* Drawing Tools */}
                <div>
                  <div className="text-xs text-slate-300 mb-1.5">เครื่องมือ</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDrawTool('pen')}
                      className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                        drawTool === 'pen'
                          ? 'bg-[#FEF08A] text-slate-950'
                          : 'bg-white/5 text-slate-200 border border-white/15 hover:bg-white/10'
                      }`}
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>ปากกา</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawTool('flower')}
                      className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                        drawTool === 'flower'
                          ? 'bg-[#FEF08A] text-slate-950'
                          : 'bg-white/5 text-slate-200 border border-white/15 hover:bg-white/10'
                      }`}
                    >
                      <Flower2 className="w-3.5 h-3.5" />
                      <span>ดอกไม้</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawTool('eraser')}
                      className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                        drawTool === 'eraser'
                          ? 'bg-[#FEF08A] text-slate-950'
                          : 'bg-white/5 text-slate-200 border border-white/15 hover:bg-white/10'
                      }`}
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      <span>ยางลบ</span>
                    </button>
                  </div>

                  {/* Stamp Picker when Flower Tool active */}
                  {drawTool === 'flower' && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-white/5 border border-white/10">
                      {STAMP_ITEMS.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setSelectedStamp(st.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer transition-colors ${
                            selectedStamp === st.id
                              ? 'bg-amber-400 text-slate-950 font-semibold'
                              : 'bg-white/5 text-slate-200 hover:bg-white/10'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Color Palette + Rainbow Custom Color Picker */}
                <div>
                  <div className="text-xs text-slate-300 mb-1.5">
                    สี (วงสีรุ้ง = เลือกสีเองได้ทุกสี)
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {PEN_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => {
                          setPenColor(hex);
                          if (drawTool === 'eraser') setDrawTool('pen');
                        }}
                        className={`w-8 h-8 rounded-full transition-transform cursor-pointer ${
                          penColor.toLowerCase() === hex.toLowerCase() && drawTool !== 'eraser'
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111E3E] scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: hex }}
                        aria-label={`เลือกสี ${hex}`}
                      />
                    ))}
                    <label
                      title="เลือกสีเองได้ทุกสี"
                      className="relative w-8 h-8 rounded-full cursor-pointer overflow-hidden border border-white/30 flex items-center justify-center"
                      style={{
                        background:
                          'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                      }}
                    >
                      <input
                        type="color"
                        value={penColor}
                        onChange={(e) => {
                          setPenColor(e.target.value);
                          if (drawTool === 'eraser') setDrawTool('pen');
                        }}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                      <Palette className="w-3.5 h-3.5 text-white drop-shadow" />
                    </label>
                  </div>
                </div>

                {/* Brush Size & Undo / Clear */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs text-slate-300 mb-1.5">ขนาด</div>
                    <div className="flex items-center gap-2">
                      {(
                        [
                          { id: 'sm', label: 'เล็ก' },
                          { id: 'md', label: 'กลาง' },
                          { id: 'lg', label: 'ใหญ่' },
                        ] as const
                      ).map((sz) => (
                        <button
                          key={sz.id}
                          type="button"
                          onClick={() => setBrushSize(sz.id)}
                          className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            brushSize === sz.id
                              ? 'bg-[#FEF08A] text-slate-950'
                              : 'bg-white/5 text-slate-200 border border-white/15 hover:bg-white/10'
                          }`}
                        >
                          {sz.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end">
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      className="px-3.5 py-1.5 rounded-full text-xs bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/15 text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>ย้อนกลับ</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClearCanvas}
                      className="px-3.5 py-1.5 rounded-full text-xs bg-white/5 hover:bg-red-500/20 border border-white/15 text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ล้างทั้งหมด</span>
                    </button>
                  </div>
                </div>

                {/* Sign Style & Colors */}
                <div className="pt-2 border-t border-white/10 space-y-2.5">
                  <div className="text-xs text-slate-300">
                    ชื่อและคำอธิษฐานบนกระทง (ข้อความลอยหรือป้ายปัก · ลากบนภาพเพื่อย้ายได้)
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {SIGN_STYLES.map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSignStyle(st.id)}
                        className={`px-2 py-2 rounded-xl border text-[11px] font-medium cursor-pointer transition-colors ${
                          signStyle === st.id
                            ? 'bg-amber-400/15 border-amber-300 text-amber-200'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {/* Sign Color Swatches */}
                  <div className="flex flex-wrap items-center gap-2">
                    {SIGN_COLORS.map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setSignColor(sc.hex)}
                        title={sc.label}
                        className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                          signColor === sc.hex
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-[#111E3E] scale-110'
                            : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: sc.hex }}
                      />
                    ))}
                  </div>

                  {/* Name & Wish Size Selectors */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300 w-20 shrink-0">ขนาดชื่อ</span>
                      {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setNameSize(sz)}
                          className={`px-2 py-1 rounded-full text-[11px] cursor-pointer ${
                            nameSize === sz
                              ? 'bg-[#FEF08A] text-slate-950 font-semibold'
                              : 'bg-white/5 text-slate-300 border border-white/10'
                          }`}
                        >
                          {sz === 'sm' ? 'เล็ก' : sz === 'md' ? 'กลาง' : sz === 'lg' ? 'ใหญ่' : 'ใหญ่มาก'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-300 w-20 shrink-0">ขนาดคำอธิษฐาน</span>
                      {(['sm', 'md', 'lg', 'xl'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setWishSize(sz)}
                          className={`px-2 py-1 rounded-full text-[11px] cursor-pointer ${
                            wishSize === sz
                              ? 'bg-[#FEF08A] text-slate-950 font-semibold'
                              : 'bg-white/5 text-slate-300 border border-white/10'
                          }`}
                        >
                          {sz === 'sm' ? 'เล็ก' : sz === 'md' ? 'กลาง' : sz === 'lg' ? 'ใหญ่' : 'ใหญ่มาก'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Krathong Name, Owner Name, Wish */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-200 mb-1">
                      ชื่อกระทง <span className="text-slate-400">(ต้องใส่ถ้าส่งประกวด)</span>
                    </label>
                    <input
                      type="text"
                      maxLength={36}
                      value={krathongName}
                      onChange={(e) => setKrathongName(e.target.value)}
                      placeholder="ตั้งชื่อกระทงของคุณ"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/50 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-200 mb-1">
                      ชื่อผู้ลอย <span className="text-slate-400">(แสดงบนสายน้ำ)</span>
                    </label>
                    <input
                      type="text"
                      maxLength={32}
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="ชื่อเล่น / แผนกวิชา"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/50 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-200 mb-1">
                    คำอธิษฐาน <span className="text-slate-400">(ไม่ใส่ก็ได้ · แตะกระทงในแม่น้ำเพื่ออ่านเต็ม)</span>
                  </label>
                  <textarea
                    rows={2}
                    maxLength={180}
                    value={wishText}
                    onChange={(e) => setWishText(e.target.value)}
                    placeholder="ขอให้ปีนี้..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/50 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 resize-none"
                  />
                </div>

                {/* Contest Checkbox */}
                <label className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isContest}
                    onChange={(e) => setIsContest(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-amber-400 rounded cursor-pointer"
                  />
                  <div className="text-xs leading-relaxed">
                    <div className="font-semibold text-white">ส่งเข้าประกวด</div>
                    <div className="text-slate-300">
                      คนดูโหวตได้ 2 แบบ: สวยงาม กับ ปั่น ๆ ต้องตั้งชื่อกระทง ไม่อยากส่งให้เอาเครื่องหมายออก
                    </div>
                  </div>
                </label>

                {/* Primary Release CTA */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleReleaseKrathong}
                  className="w-full py-3.5 rounded-full bg-[#F5A623] hover:bg-[#FFB73B] disabled:opacity-60 text-slate-950 font-bold text-base shadow-[0_6px_24px_rgba(245,166,35,0.35)] transition-all active:scale-[0.99] cursor-pointer"
                >
                  {isSubmitting ? 'กำลังปล่อยกระทงลงน้ำ...' : 'ปล่อยกระทงลงน้ำ'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: MY KRATHONGS ("กระทงของฉัน" + Cross-device Code)
         ===================================================================== */}
      {activeModal === 'mine' && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActiveModal('none')}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111E3E] border border-white/15 p-5 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display-thai text-3xl sm:text-4xl font-bold text-[#FEF3C7]">
                กระทงของฉัน
              </h2>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 cursor-pointer"
                aria-label="ปิดหน้าต่างกระทงของฉัน"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Device Krathong Code Status */}
            {userCode ? (
              <div className="mt-4 p-4 rounded-xl bg-amber-400/10 border border-amber-300/30 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-amber-200">รหัสกระทงประจำตัวของคุณ</div>
                  <div className="font-mono-code text-lg sm:text-xl font-semibold text-white tracking-wider mt-0.5">
                    {userCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(userCode);
                      showToast(`คัดลอกรหัส ${userCode} แล้ว`);
                    } catch {
                      showToast(`รหัสของคุณคือ ${userCode}`);
                    }
                  }}
                  className="px-3.5 py-2 rounded-full bg-amber-400 text-slate-950 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-amber-300"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกรหัส</span>
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-200 leading-relaxed">
                ยังไม่มีกระทงบนเครื่องนี้ เมื่อปล่อยกระทงใบแรก คุณจะได้{' '}
                <strong className="text-white">รหัสกระทง</strong> ประจำตัว
                ใช้เปิดดูกระทงของคุณจากเครื่องไหนก็ได้ ไม่ต้องสมัครสมาชิก
              </p>
            )}

            {/* Foreign Code Input */}
            <div className="mt-5 pt-5 border-t border-white/10">
              <label className="block text-sm text-slate-300 mb-2">
                มีรหัสกระทงจากเครื่องอื่น
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={lookupCodeInput}
                  onChange={(e) => setLookupCodeInput(e.target.value.toUpperCase())}
                  placeholder="เช่น ABCD-EFGH-JKMN"
                  className="flex-1 px-4 py-2.5 rounded-full bg-slate-950/50 border border-white/15 text-sm font-mono-code text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleUseForeignCode}
                  disabled={isSyncingGas}
                  className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-medium text-white whitespace-nowrap cursor-pointer"
                >
                  {isSyncingGas ? 'กำลังค้นหา...' : 'ใช้รหัสนี้'}
                </button>
              </div>
            </div>

            {/* User Krathong History & Vote Status */}
            {myKrathongs.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="text-sm font-semibold text-amber-200">
                  ประวัติกระทงของคุณ ({myKrathongs.length})
                </div>
                {myKrathongs.map((k) => (
                  <div
                    key={k.id}
                    className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={k.imageData}
                        alt={k.name}
                        className="w-16 h-16 rounded-lg bg-[#0A1633] object-contain shrink-0 border border-white/10"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">{k.name}</div>
                        <div className="text-xs text-slate-300 truncate">
                          {k.wish || 'ไม่มีคำอธิษฐาน'}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-300 tabular-nums">
                          <span>สวยงาม {k.beautifulVotes}</span>
                          <span aria-hidden="true">·</span>
                          <span>ปั่นๆ {k.funnyVotes}</span>
                          {k.isContest && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-300">ส่งประกวด</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSpotlightOnRiver(k)}
                      className="px-3.5 py-2 rounded-full bg-amber-400/15 hover:bg-amber-400/25 border border-amber-300/35 text-xs font-medium text-amber-200 whitespace-nowrap cursor-pointer self-start sm:self-center"
                    >
                      ดูในแม่น้ำ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: CONTEST & LEADERBOARD ("ประกวดกระทง")
         ===================================================================== */}
      {activeModal === 'contest' && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4"
          onClick={() => setActiveModal('none')}
        >
          <div
            className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#111E3E] border border-white/15 p-4 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h2 className="font-display-thai text-3xl sm:text-4xl font-bold text-[#FEF3C7]">
                  ประกวดกระทงออนไลน์ 2569
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  วิทยาลัยการอาชีพเวียงเชียงรุ้ง · โหวตได้ทั้งสายสวยงามและสายปั่นๆ ({sortedContestItems.length} กระทง)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 cursor-pointer"
                aria-label="ปิดหน้าต่างประกวด"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Tabs */}
            <div className="mt-4 flex flex-wrap items-center gap-2 bg-slate-950/50 p-1 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setContestTab('beautiful')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                  contestTab === 'beautiful'
                    ? 'bg-pink-500 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Heart className="w-3.5 h-3.5" />
                <span>สวยงามยอดนิยม</span>
              </button>
              <button
                type="button"
                onClick={() => setContestTab('funny')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                  contestTab === 'funny'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Laugh className="w-3.5 h-3.5" />
                <span>ปั่นๆ ยอดฮิต</span>
              </button>
              <button
                type="button"
                onClick={() => setContestTab('latest')}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                  contestTab === 'latest'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>ผู้เข้าร่วมล่าสุด</span>
              </button>
            </div>

            {/* TOP 1, 2, 3 PODIUM SECTION */}
            {sortedContestItems.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-amber-200 mb-3">
                  <Trophy className="w-4 h-4 text-amber-300" />
                  <span>อันดับยอดนิยม 1 · 2 · 3</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  {sortedContestItems.slice(0, 3).map((item, idx) => {
                    const rank = idx + 1;
                    const podiumOrderClass =
                      rank === 1 ? 'md:order-2' : rank === 2 ? 'md:order-1' : 'md:order-3';
                    const podiumCardStyle =
                      rank === 1
                        ? 'bg-gradient-to-b from-amber-400/20 via-amber-500/10 to-white/5 border-amber-300/60 shadow-[0_8px_28px_rgba(251,191,36,0.18)] md:pb-5'
                        : rank === 2
                          ? 'bg-gradient-to-b from-slate-200/15 via-slate-300/5 to-white/5 border-slate-300/45'
                          : 'bg-gradient-to-b from-orange-400/15 via-orange-500/5 to-white/5 border-orange-300/45';
                    const rankBadgeClass =
                      rank === 1
                        ? 'bg-amber-400 text-slate-950'
                        : rank === 2
                          ? 'bg-slate-200 text-slate-950'
                          : 'bg-orange-400 text-slate-950';

                    return (
                      <div
                        key={item.id}
                        className={`${podiumOrderClass} ${podiumCardStyle} rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-transform`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1 ${rankBadgeClass}`}
                            >
                              <Trophy className="w-3 h-3" />
                              <span>อันดับที่ {rank}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSpotlightOnRiver(item)}
                              className="text-xs text-sky-300 hover:text-sky-200 underline underline-offset-4 cursor-pointer"
                            >
                              ดูในแม่น้ำ
                            </button>
                          </div>

                          <div className="flex flex-col items-center text-center">
                            <div
                              className={`rounded-xl bg-[#09142E] border border-white/10 flex items-center justify-center mb-2.5 ${
                                rank === 1 ? 'w-28 h-28' : 'w-24 h-24'
                              }`}
                            >
                              <img
                                src={item.imageData}
                                alt={item.name}
                                className={rank === 1 ? 'w-24 h-24 object-contain' : 'w-20 h-20 object-contain'}
                              />
                            </div>
                            <div className="font-semibold text-white text-sm sm:text-base line-clamp-1">
                              {item.name}
                            </div>
                            <div className="text-xs text-amber-200/90 line-clamp-1 mt-0.5">
                              {item.ownerName}
                            </div>
                            <p className="text-xs text-slate-300 line-clamp-2 mt-1.5 min-h-[2rem]">
                              {item.wish || 'ร่วมสืบสานประเพณีลอยกระทง 2569'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => handleVote(item, 'beautiful')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs inline-flex items-center justify-center gap-1 border cursor-pointer ${
                              votedMap[item.id]?.beautiful
                                ? 'bg-pink-500/25 border-pink-400 text-pink-100'
                                : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            <Heart className="w-3.5 h-3.5 text-pink-300" />
                            <span>สวยงาม</span>
                            <span className="tabular-nums font-semibold">{item.beautifulVotes}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVote(item, 'funny')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs inline-flex items-center justify-center gap-1 border cursor-pointer ${
                              votedMap[item.id]?.funny
                                ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                                : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            <Laugh className="w-3.5 h-3.5 text-amber-300" />
                            <span>ปั่นๆ</span>
                            <span className="tabular-nums font-semibold">{item.funnyVotes}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RANK 4, 5, 6, 7 ... TO LAST CONTESTANT (4-COLUMN GRID) */}
            {sortedContestItems.length > 3 && (
              <div className="mt-6 pt-5 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs sm:text-sm font-semibold text-slate-200">
                    อันดับที่ 4 — {sortedContestItems.length} (เรียง 4 คอลัมน์)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {sortedContestItems.slice(3).map((item, idx) => {
                    const rank = idx + 4;
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between gap-2.5"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-white/15 text-[11px] font-mono-code text-amber-300">
                              อันดับ {rank}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSpotlightOnRiver(item)}
                              className="text-[11px] text-sky-300 hover:text-sky-200 underline underline-offset-4 cursor-pointer"
                            >
                              ดูในน้ำ
                            </button>
                          </div>

                          <div className="w-full h-24 rounded-lg bg-[#09142E] border border-white/10 flex items-center justify-center mb-2">
                            <img
                              src={item.imageData}
                              alt={item.name}
                              className="w-20 h-20 object-contain"
                            />
                          </div>

                          <div className="font-semibold text-white text-sm truncate">
                            {item.name}
                          </div>
                          <div className="text-[11.5px] text-amber-200/90 truncate">
                            {item.ownerName}
                          </div>
                          <p className="text-[11px] text-slate-300 line-clamp-2 mt-1 min-h-[2rem]">
                            {item.wish || 'ร่วมสืบสานประเพณีลอยกระทง 2569'}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => handleVote(item, 'beautiful')}
                            className={`px-2 py-1.5 rounded-lg text-[11px] inline-flex items-center justify-center gap-1 border cursor-pointer ${
                              votedMap[item.id]?.beautiful
                                ? 'bg-pink-500/25 border-pink-400 text-pink-100'
                                : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            <Heart className="w-3 h-3 text-pink-300" />
                            <span className="tabular-nums">{item.beautifulVotes}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVote(item, 'funny')}
                            className={`px-2 py-1.5 rounded-lg text-[11px] inline-flex items-center justify-center gap-1 border cursor-pointer ${
                              votedMap[item.id]?.funny
                                ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                                : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'
                            }`}
                          >
                            <Laugh className="w-3 h-3 text-amber-300" />
                            <span className="tabular-nums">{item.funnyVotes}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: GOOGLE APPS SCRIPT & GOOGLE SHEET INTEGRATION SETUP
         ===================================================================== */}
      {activeModal === 'gas' && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setActiveModal('none')}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#111E3E] border border-white/15 p-5 sm:p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-amber-200">
                  เชื่อมโยง Google Apps Script & Google Sheet
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  บันทึกข้อมูลกระทง คำอธิษฐาน และผลโหวตลง Google Sheets แบบเรียลไทม์
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal('none')}
                className="p-2 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 cursor-pointer"
                aria-label="ปิดหน้าต่างตั้งค่า"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Web App URL Input */}
            <div className="mt-4 space-y-2.5">
              <label className="block text-xs sm:text-sm font-medium text-slate-200">
                Google Apps Script Web App URL (ลงท้ายด้วย /exec)
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="url"
                  value={gasInputUrl}
                  onChange={(e) => {
                    setGasInputUrl(e.target.value);
                    if (gasStatus) setGasStatus(null);
                  }}
                  placeholder="https://script.google.com/macros/s/xxxxx/exec"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950/60 border border-white/15 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  disabled={isSyncingGas}
                  onClick={() => {
                    const trimmed = gasInputUrl.trim();
                    setGasUrl(trimmed);
                    try {
                      localStorage.setItem(STORAGE_KEYS.GAS_URL, trimmed);
                    } catch {
                      // Ignore
                    }
                    if (trimmed) {
                      fetchFromGas(trimmed, false);
                    } else {
                      setGasStatus({
                        type: 'info',
                        text: 'ล้างการเชื่อมต่อ Apps Script แล้ว (ใช้งานเก็บข้อมูลในเครื่อง)',
                      });
                      showToast('ล้างการเชื่อมต่อ Apps Script แล้ว');
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-semibold text-xs sm:text-sm whitespace-nowrap cursor-pointer"
                >
                  {isSyncingGas ? 'กำลังเชื่อมต่อ...' : 'บันทึกและซิงค์ข้อมูล'}
                </button>
              </div>

              {/* Inline Connection Status Banner */}
              {gasStatus && (
                <div
                  className={`p-3 rounded-xl border text-xs leading-relaxed ${
                    gasStatus.type === 'success'
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100'
                      : gasStatus.type === 'error'
                        ? 'bg-rose-500/15 border-rose-400/40 text-rose-100'
                        : 'bg-sky-500/15 border-sky-400/40 text-sky-100'
                  }`}
                >
                  {gasStatus.text}
                </div>
              )}

              {/* Cross-Device Distribution Notice + Shareable Link */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 text-[11.5px] text-amber-100 space-y-2 leading-relaxed">
                <div>
                  <span className="font-semibold text-amber-200">สำคัญสำหรับการใช้งานจากเครื่องอื่น:</span>{' '}
                  {DEFAULT_GAS_URL
                    ? 'ระบบฝังค่าลิงก์ Google Sheet เริ่มต้นไว้ในเว็บแล้ว ทุกเครื่องที่เปิดเว็บจะบันทึกข้อมูลตรงเข้าชีตอัตโนมัติ'
                    : 'ค่า URL ในช่องด้านบนจะเก็บเฉพาะในเบราว์เซอร์เครื่องนี้เท่านั้น หากให้เครื่องอื่นเปิดเว็บจากลิงก์ปกติโดยไม่มี ?gas=... เครื่องอื่นจะยังไม่รู้จักลิงก์ชีต'}
                </div>
                {gasInputUrl.trim() && isValidGasWebAppUrl(gasInputUrl.trim()) && (
                  <button
                    type="button"
                    onClick={async () => {
                      const u = new URL(window.location.href);
                      u.searchParams.delete('setup');
                      u.searchParams.set('gas', gasInputUrl.trim());
                      try {
                        await navigator.clipboard.writeText(u.toString());
                        showToast('คัดลอกลิงก์สำหรับแจกให้เครื่องอื่นแล้ว (ผูก Google Sheet อัตโนมัติ)');
                      } catch {
                        showToast('ไม่สามารถคัดลอกอัตโนมัติได้');
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/40 text-[11px] font-medium text-amber-100 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>คัดลอกลิงก์เว็บพร้อมผูก Google Sheet ให้เครื่องอื่น</span>
                  </button>
                )}
              </div>

              {/* Quick Reset Local Data & Live Write Test */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-400">
                  ขั้นตอน: Extensions → Apps Script → วาง Code.gs → Deploy (Execute as: Me / Access: Anyone)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isSyncingGas || !gasInputUrl.trim()}
                    onClick={async () => {
                      const target = gasInputUrl.trim();
                      if (!target) return;
                      if (!isValidGasWebAppUrl(target)) {
                        setGasStatus({
                          type: 'error',
                          text: 'รูปแบบ Web App URL ไม่ถูกต้อง (ต้องลงท้ายด้วย /exec)',
                        });
                        return;
                      }
                      setIsSyncingGas(true);
                      setGasStatus({
                        type: 'info',
                        text: 'กำลังทดสอบอ่าน-เขียน (GET + POST) กับ Google Sheet...',
                      });
                      const sample = createSeedKrathongs()[0];
                      const testItem: KrathongItem = {
                        ...sample,
                        id: `test-${Date.now()}`,
                        name: 'ทดสอบเชื่อมต่อ Google Sheet',
                        wish: 'ทดสอบบันทึกข้อมูลจากเว็บลอยกระทง 2569',
                        createdAt: new Date().toISOString(),
                      };
                      const res = await postToGas(target, {
                        action: 'create',
                        krathong: testItem,
                      });
                      setIsSyncingGas(false);
                      if (res.ok && !res.opaque) {
                        setGasStatus({
                          type: 'success',
                          text: 'ทดสอบบันทึกข้อมูล (POST + ยืนยันแถวใหม่) ลง Google Sheet สำเร็จ! ตรวจสอบแถวใหม่ในชีต "Krathongs" ได้เลย',
                        });
                        showToast('ทดสอบบันทึกข้อมูลลง Google Sheet สำเร็จ');
                      } else if (res.ok && res.opaque) {
                        setGasStatus({
                          type: 'info',
                          text: 'ส่งคำขอแบบ no-cors แล้ว กรุณาเปิดตรวจใน Google Sheet แท็บ "Krathongs" ว่ามีแถวใหม่เข้าหรือไม่',
                        });
                      } else {
                        setGasStatus({
                          type: 'error',
                          text: `บันทึกไม่สำเร็จ: ${res.error}`,
                        });
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-45 border border-emerald-400/35 text-[11px] text-emerald-200 cursor-pointer"
                  >
                    ทดสอบบันทึกลง Sheet
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const fresh = createSeedKrathongs();
                      setKrathongs(fresh);
                      setVotedMap({});
                      try {
                        localStorage.setItem(STORAGE_KEYS.KRATHONGS, JSON.stringify(fresh));
                        localStorage.removeItem(STORAGE_KEYS.VOTED_MAP);
                      } catch {
                        // Ignore
                      }
                      setGasStatus({
                        type: 'info',
                        text: 'รีเซ็ตข้อมูลบนเครื่องกลับเป็นค่าเริ่มต้น (1 กระทงตัวอย่าง) แล้ว',
                      });
                      showToast('ล้างข้อมูลเหลือ 1 กระทงตัวอย่างแล้ว');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] text-slate-200 cursor-pointer"
                  >
                    รีเซ็ตข้อมูลเหลือ 1 กระทงตัวอย่าง
                  </button>
                </div>
              </div>
            </div>

            {/* Copyable Code.gs */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs sm:text-sm font-semibold text-white">
                  โค้ดไฟล์ Code.gs สำหรับนำไปวางใน Google Apps Script
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
                      setCopiedCodeGs(true);
                      setTimeout(() => setCopiedCodeGs(false), 2500);
                      showToast('คัดลอกโค้ด Code.gs แล้ว');
                    } catch {
                      showToast('กรุณาคลุมดำเพื่อคัดลอกโค้ดด้านล่าง');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-amber-200 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCodeGs ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCodeGs ? 'คัดลอกแล้ว' : 'คัดลอก Code.gs'}</span>
                </button>
              </div>

              <pre className="p-3.5 rounded-xl bg-slate-950 border border-white/10 text-[11px] font-mono-code text-sky-100 overflow-x-auto max-h-64 leading-relaxed">
                {GOOGLE_APPS_SCRIPT_CODE}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
