import { jsPDF } from 'jspdf';
import { ISSUE_CATEGORIES, PUBLIC_OFFICIALS } from '../data/civicDirectory';
import { resolveReportMediaUrl } from '../data/civicMedia';
import type { CivicReport } from '../types/civic';

async function loadImageAsJpegDataUrl(url: string): Promise<{
  dataUrl: string;
  width: number;
  height: number;
} | null> {
  if (typeof window === 'undefined' || !url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => resolve(null), 2500);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const maxW = 900;
        const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', 0.82),
          width: canvas.width,
          height: canvas.height,
        });
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };

    img.src = url;
  });
}

export async function generateCivicReportPdf(report: CivicReport): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const contentW = pageW - marginX * 2;
  const bottomLimit = pageH - 20;

  let y = 16;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > bottomLimit) {
      doc.addPage();
      y = 18;
    }
  };

  const drawSectionHeading = (label: string) => {
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 76, 129);
    doc.text(label.toUpperCase(), marginX, y);
    y += 2;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, pageW - marginX, y);
    y += 5;
  };

  const drawWrappedParagraph = (
    text: string,
    opts?: { fontSize?: number; bold?: boolean; color?: [number, number, number]; lineHeight?: number }
  ) => {
    const fontSize = opts?.fontSize ?? 9.5;
    const lineHeight = opts?.lineHeight ?? 4.6;
    const color = opts?.color ?? [30, 41, 59];
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);

    const paragraphs = (text || '').split(/\r?\n/);
    for (const para of paragraphs) {
      if (!para.trim()) {
        y += lineHeight * 0.6;
        continue;
      }
      const lines = doc.splitTextToSize(para, contentW) as string[];
      for (const line of lines) {
        ensureSpace(lineHeight + 2);
        doc.text(line, marginX, y);
        y += lineHeight;
      }
    }
  };

  // Top Header Band
  doc.setFillColor(15, 76, 129);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('CityFix — Civic Issue Complaint Summary', marginX, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(219, 234, 254);
  doc.text(
    `Report Reference: ${report.id}   |   Status: ${report.status}   |   Severity: ${report.severity}`,
    marginX,
    20
  );

  y = 37;

  // Report Headline
  drawWrappedParagraph(report.title, {
    fontSize: 13,
    bold: true,
    color: [15, 23, 42],
    lineHeight: 5.8,
  });
  y += 2;

  // Structured Metadata Block
  const categoryLabel =
    ISSUE_CATEGORIES.find((c) => c.id === report.category)?.label ?? report.category;
  const createdFormatted = new Date(report.createdAt).toLocaleString();
  const metaRows: [string, string][] = [
    ['Category & Severity', `${categoryLabel} (${report.severity})`],
    ['Ward & District', `${report.wardName} — ${report.district}`],
    ['Location Address', report.address || `${report.wardName}`],
    ['GPS Coordinates', `${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}`],
    ['Filed Timestamp', createdFormatted],
    ['Submitted By', `${report.citizenName} (${report.citizenContact})`],
    ['Current Status', report.status],
  ];
  if (report.evidenceHash) {
    metaRows.push(['Evidence SHA-256', report.evidenceHash]);
  }

  const rowHeight = 6.2;
  const boxHeight = metaRows.length * rowHeight + 4;
  ensureSpace(boxHeight + 4);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, y - 2, contentW, boxHeight, 1.5, 1.5, 'FD');

  let metaY = y + 3;
  for (const [k, v] of metaRows) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`${k}:`, marginX + 3, metaY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const valLines = doc.splitTextToSize(v, contentW - 44) as string[];
    doc.text(valLines[0] ?? '', marginX + 41, metaY);
    metaY += rowHeight;
  }
  y += boxHeight + 6;

  // Issue Description
  drawSectionHeading('01. Field Observation & Details');
  drawWrappedParagraph(report.description);
  y += 4;

  // Attached Visual Evidence Image (if resolvable)
  const mediaUrl = resolveReportMediaUrl(report);
  if (mediaUrl && report.mediaType !== 'video') {
    const imgData = await loadImageAsJpegDataUrl(mediaUrl);
    if (imgData) {
      const renderW = Math.min(contentW, 120);
      const renderH = Math.min(72, (imgData.height / imgData.width) * renderW);
      ensureSpace(renderH + 16);
      drawSectionHeading('02. Visual Evidence');
      doc.addImage(imgData.dataUrl, 'JPEG', marginX, y, renderW, renderH);
      y += renderH + 6;
    }
  }

  // Responsible Authorities
  const officials = report.assignedOfficialIds
    .map((id) => PUBLIC_OFFICIALS.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  if (officials.length > 0) {
    drawSectionHeading('03. Assigned Responsible Authorities');
    for (const off of officials) {
      ensureSpace(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${off.name} — ${off.designation}`, marginX, y);
      y += 4.3;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      const contactLine = [off.department, off.email, off.phone]
        .filter(Boolean)
        .join('  |  ');
      const wrappedContact = doc.splitTextToSize(contactLine, contentW) as string[];
      for (const line of wrappedContact) {
        ensureSpace(5);
        doc.text(line, marginX, y);
        y += 4.2;
      }
      y += 2;
    }
    y += 2;
  }

  // Formal Complaint Brief
  drawSectionHeading('04. Formal Complaint Brief');
  if (report.draftSubject) {
    drawWrappedParagraph(`Subject: ${report.draftSubject}`, {
      fontSize: 9.5,
      bold: true,
      color: [15, 23, 42],
    });
    y += 1.5;
  }
  drawWrappedParagraph(report.draftBody || report.description);

  // Page Footers with Boundary Disclaimer & Pagination
  const totalPages = doc.getNumberOfPages();
  const generatedIso = new Date().toLocaleString();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, pageH - 14, pageW - marginX, pageH - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `CityFix Hard Copy Record (${report.id}) · Generated ${generatedIso} · For citizen documentation only`,
      marginX,
      pageH - 9
    );
    doc.text(`Page ${p} of ${totalPages}`, pageW - marginX, pageH - 9, {
      align: 'right',
    });
  }

  const safeId = report.id.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'report';
  doc.save(`${safeId}-civic-complaint.pdf`);
}
