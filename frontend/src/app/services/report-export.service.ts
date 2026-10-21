import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

@Injectable({
  providedIn: 'root'
})
export class ReportExportService {

  constructor() {}

  /**
   * Limpia texto eliminando tags HTML, emojis y caracteres especiales que no soporta el motor tipográfico de jsPDF
   */
  private cleanText(str: any): string {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/<\/?[^>]+(>|$)/g, '') // Eliminar tags HTML
      // Eliminar rangos completos de emojis y pictogramas Unicode
      .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F2FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/•/g, '-')
      .trim();
  }

  /**
   * Genera un informe formal ejecutivo e institucional en PDF para el Portafolio de Trading
   */
  exportExecutivePdf(data: {
    account: any;
    metrics: any;
    quantitative: any;
    psychology: any;
    trades: any[];
  }): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const accountName = this.cleanText(data.account?.name || 'Cuenta Principal');
    const marketType = this.cleanText(data.account?.market_type || 'General');
    const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const disciplineScore = data.psychology?.disciplineScore ?? 100;

    // --- ENCABEZADO INSTITUCIONAL ---
    doc.setFillColor(15, 23, 42); // slate-900 (#0f172a)
    doc.rect(0, 0, 210, 34, 'F');

    // Línea de acento cyan / esmeralda
    doc.setFillColor(14, 165, 233); // cyan-500 (#0ea5e9)
    doc.rect(0, 34, 210, 1.2, 'F');

    doc.setTextColor(248, 250, 252);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('AUDITORÍA INTEGRAL DE RENDIMIENTO & CONTROL OPERATIVO', 14, 12);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Trading Portfolio Analytics • Motor Cuantitativo y Conductual Multi-Mercado USD', 14, 18);

    // Barra de metadatos en el encabezado
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(14, 22, 182, 8, 1.5, 1.5, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(226, 232, 240);
    const metaText = `Cuenta: ${accountName} (${marketType})   |   Emisión: ${today}   |   Disciplina: ${disciplineScore}/100`;
    doc.text(metaText, 18, 27.2);

    let yPos = 42;

    // --- BLOQUE 1: RESUMEN DE CAPITAL Y DESEMPEÑO CUANTITATIVO ---
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('1. Resumen Financiero y Expectanza Matemática (E)', 14, yPos);
    yPos += 4;

    const initialCap = data.metrics?.initialCapital || 10000;
    const currentCap = data.metrics?.currentCapital || initialCap;
    const netPnL = data.metrics?.totalPnL || 0;
    const roi = data.metrics?.roiPercentage || '0.00';
    const winRate = data.metrics?.winRate || '0.00';
    const profitFactor = data.metrics?.profitFactor || '0.00';
    const maxDD = data.metrics?.maxDrawdown || '0.00';

    const expUSD = data.quantitative?.expectancy?.expectancyUSD ?? 0;
    const expR = data.quantitative?.expectancy?.expectancyR ?? 0;
    const qualityLabel = this.cleanText(data.quantitative?.expectancy?.qualityLabel || 'Neutral / Sin Ventaja');

    const expSign = expUSD >= 0 ? '+' : '-';
    const expFormatted = `${expSign}$${Math.abs(expUSD).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD (${expR >= 0 ? '+' : ''}${expR}R)`;

    const kpiData = [
      ['Capital Inicial', `$${initialCap.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`, 'Win Rate (Acierto)', `${winRate}%`],
      ['Capital Actual', `$${currentCap.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`, 'Factor de Beneficio (PF)', `${profitFactor}`],
      ['PnL Neto Acumulado', `${netPnL >= 0 ? '+' : ''}$${netPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`, 'Máximo Drawdown', `${maxDD}%`],
      ['Retorno Total (ROI)', `${roi}%`, 'Expectanza Matemática (E)', expFormatted],
      ['Evaluación del Edge', qualityLabel, 'Operaciones Totales', `${data.trades?.length || 0}`]
    ];

    autoTable(doc, {
      startY: yPos,
      body: kpiData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.2, textColor: [15, 23, 42] },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 42 },
        1: { cellWidth: 49 },
        2: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 42 },
        3: { cellWidth: 49 }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // --- BLOQUE 2: AUDITORÍA PSICOLÓGICA Y FINANZAS CONDUCTUALES ---
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Diagnóstico de Psicología Operativa y Arquetipo Conductual', 14, yPos);
    yPos += 5;

    const archetypeTitle = this.cleanText(data.psychology?.archetype?.title || 'Estratega Disciplinado');
    const engineName = this.cleanText(data.psychology?.engine || 'Motor Cuantitativo & Finanzas Conductuales');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`Arquetipo Detectado: ${archetypeTitle}   |   Índice de Disciplina Mental: ${disciplineScore}/100`, 14, yPos);
    yPos += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Motor de Auditoría: ${engineName}`, 14, yPos);
    yPos += 4.5;

    // Síntesis narrativa limpia
    const rawSummary = data.psychology?.aiSummary || 'Sin resumen disponible.';
    const cleanSummary = this.cleanText(rawSummary);
    const splitSummary = doc.splitTextToSize(cleanSummary, 182);
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(8);
    doc.text(splitSummary, 14, yPos);
    yPos += (splitSummary.length * 3.8) + 6;

    // Prescripciones tácticas estructuradas en tabla limpia para evitar caracteres rotos
    if (data.psychology?.prescriptions && data.psychology.prescriptions.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('Protocolos de Ejecución y Reglas de Disciplina:', 14, yPos);
      yPos += 3.5;

      const prescriptionRows = data.psychology.prescriptions.slice(0, 4).map((p: string, idx: number) => {
        const clean = this.cleanText(p);
        const colonIdx = clean.indexOf(':');
        let title = `Protocolo #${idx + 1}`;
        let desc = clean;
        if (colonIdx > 0) {
          title = clean.substring(0, colonIdx).trim();
          desc = clean.substring(colonIdx + 1).trim();
        }
        return [title, desc];
      });

      autoTable(doc, {
        startY: yPos,
        head: [['Regla / Protocolo', 'Directriz Operativa & Recomendación']],
        body: prescriptionRows,
        theme: 'grid',
        styles: { fontSize: 7.8, cellPadding: 2.2, textColor: [30, 41, 59] },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 46, fontStyle: 'bold', fillColor: [248, 250, 252] },
          1: { cellWidth: 136 }
        }
      });
      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // --- NUEVA PÁGINA PARA MATRIZ EMOCIONAL, SESIONES Y OPERACIONES ---
    doc.addPage();
    let yPage2 = 16;

    // --- BLOQUE 3: MATRIZ EMPÍRICA DE CORRELACIÓN EMOCIÓN VS. PNL ---
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('3. Matriz de Correlación Emoción vs. Rendimiento (PnL)', 14, yPage2);
    yPage2 += 4;

    const emotionRows = (data.quantitative?.emotionMatrix?.matrix || []).map((m: any) => [
      this.cleanText(m.emotion),
      `${m.tradesCount}`,
      `${m.winRate}%`,
      `${m.totalPnL >= 0 ? '+' : ''}$${m.totalPnL.toFixed(2)} USD`,
      `$${m.avgPnL.toFixed(2)} USD`,
      `$${m.avgWin.toFixed(2)}`,
      `$${m.avgLoss.toFixed(2)}`,
      `${m.indisciplineRate}%`
    ]);

    if (emotionRows.length > 0) {
      autoTable(doc, {
        startY: yPage2,
        head: [['Emoción', 'Trades', 'Win Rate', 'PnL Acumulado', 'PnL Medio', 'Avg Win', 'Avg Loss', '% Sin SL']],
        body: emotionRows,
        theme: 'striped',
        styles: { fontSize: 7.8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] }
      });
      yPage2 = (doc as any).lastAutoTable.finalY + 6;
    }

    // Insights comparativos de emoción en recuadro suave
    if (data.quantitative?.emotionMatrix?.comparativeInsights?.length > 0) {
      data.quantitative.emotionMatrix.comparativeInsights.forEach((ci: any) => {
        const cleanInsight = this.cleanText(ci.insight);
        const splitInsight = doc.splitTextToSize(`Alerta Conductual: ${cleanInsight}`, 174);
        const boxHeight = (splitInsight.length * 3.6) + 5;

        doc.setFillColor(254, 242, 242);
        doc.setDrawColor(248, 113, 113);
        doc.roundedRect(14, yPage2, 182, boxHeight, 1.5, 1.5, 'FD');

        doc.setFontSize(7.8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(153, 27, 27);
        doc.text(splitInsight, 18, yPage2 + 4.2);
        yPage2 += boxHeight + 4;
      });
    }

    // --- BLOQUE 4: DESGLOSE DE SESIONES GLOBALES ---
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('4. Rendimiento por Sesión Global de Mercado', 14, yPage2);
    yPage2 += 4;

    const sessionRows = (data.quantitative?.sessionBreakdown?.sessions || []).map((s: any) => [
      this.cleanText(s.sessionName),
      `${s.tradesCount}`,
      `${s.winRate}%`,
      `${s.totalPnL >= 0 ? '+' : ''}$${s.totalPnL.toFixed(2)} USD`,
      `$${s.avgPnL.toFixed(2)} USD`,
      `${s.indisciplineCount}`
    ]);

    if (sessionRows.length > 0) {
      autoTable(doc, {
        startY: yPage2,
        head: [['Sesión de Mercado', 'Trades', 'Win Rate', 'PnL Total', 'PnL Medio', 'Trades Sin SL']],
        body: sessionRows,
        theme: 'striped',
        styles: { fontSize: 7.8, cellPadding: 2 },
        headStyles: { fillColor: [14, 116, 144], textColor: [255, 255, 255] }
      });
      yPage2 = (doc as any).lastAutoTable.finalY + 5;
    }

    // Alertas de fatiga en recuadro suave
    if (data.quantitative?.sessionBreakdown?.fatigueAlerts?.length > 0) {
      data.quantitative.sessionBreakdown.fatigueAlerts.forEach((fa: any) => {
        const cleanFa = this.cleanText(fa.message);
        const splitFa = doc.splitTextToSize(`Alerta de Fatiga: ${cleanFa}`, 174);
        const boxHeight = (splitFa.length * 3.6) + 5;

        doc.setFillColor(255, 251, 235);
        doc.setDrawColor(245, 158, 11);
        doc.roundedRect(14, yPage2, 182, boxHeight, 1.5, 1.5, 'FD');

        doc.setFontSize(7.8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 83, 9);
        doc.text(splitFa, 18, yPage2 + 4.2);
        yPage2 += boxHeight + 4;
      });
    }

    // --- BLOQUE 5: HISTORIAL RESUMIDO DE OPERACIONES EJECUTADAS ---
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('5. Muestra de Operaciones Recientes', 14, yPage2);
    yPage2 += 4;

    const tradeRows = (data.trades || []).slice(0, 25).map((t: any) => {
      const pnl = parseFloat(t.pnl) || 0;
      const dateEntryStr = (t.entry_date || t.createdAt) ? new Date(t.entry_date || t.createdAt).toLocaleDateString('es-ES') : '-';
      const dateExitStr = t.exit_date ? new Date(t.exit_date).toLocaleDateString('es-ES') : 'Abierta';
      return [
        dateEntryStr,
        dateExitStr,
        this.cleanText(t.asset || 'N/A'),
        this.cleanText(t.trade_type || 'LONG'),
        `${t.volume || 1}`,
        t.entry_price != null ? `${t.entry_price}` : '-',
        t.exit_price != null ? `${t.exit_price}` : '-',
        t.stop_loss != null ? `${t.stop_loss}` : 'SIN SL',
        `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`,
        this.cleanText(t.emotion_state || 'Calma'),
        this.cleanText(t.status || 'Cerrada')
      ];
    });

    if (tradeRows.length > 0) {
      autoTable(doc, {
        startY: yPage2,
        head: [['F. Entrada', 'F. Salida', 'Activo', 'Tipo', 'Vol', 'Entrada', 'Salida', 'Stop Loss', 'PnL ($)', 'Emoción', 'Estado']],
        body: tradeRows,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] }
      });
    }

    // Pie de página en todas las páginas
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Página ${i} de ${totalPages}   •   Trading Portfolio Analytics   •   Reporte Confidencial de Desempeño`,
        14,
        290
      );
    }

    // Descargar PDF
    const filename = `Auditoria_Trading_${accountName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  }

  /**
   * Genera un libro Excel (.xlsx) estructurado en múltiples hojas
   */
  exportStructuredExcel(data: {
    account: any;
    metrics: any;
    quantitative: any;
    psychology: any;
    trades: any[];
  }): void {
    const wb = XLSX.utils.book_new();

    // 1. Hoja de Resumen Ejecutivo & Métricas
    const summaryData = [
      ['REPORTE DE AUDITORÍA Y RENDIMIENTO OPERATIVO', ''],
      ['Cuenta', data.account?.name || 'Principal'],
      ['Mercado Base', data.account?.market_type || 'General'],
      ['Fecha Generación', new Date().toISOString()],
      ['', ''],
      ['MÉTRICA CUANTITATIVA', 'VALOR'],
      ['Capital Inicial (USD)', data.metrics?.initialCapital || 10000],
      ['Capital Actual (USD)', data.metrics?.currentCapital || 10000],
      ['PnL Neto Total (USD)', data.metrics?.totalPnL || 0],
      ['ROI (%)', data.metrics?.roiPercentage || 0],
      ['Win Rate (%)', data.metrics?.winRate || 0],
      ['Profit Factor', data.metrics?.profitFactor || 0],
      ['Max Drawdown (%)', data.metrics?.maxDrawdown || 0],
      ['Expectanza Matemática ($ USD)', data.quantitative?.expectancy?.expectancyUSD ?? 0],
      ['Expectanza en Unidades de Riesgo (R)', data.quantitative?.expectancy?.expectancyR ?? 0],
      ['Evaluación del Edge', data.quantitative?.expectancy?.qualityLabel || 'N/A'],
      ['Riesgo de Ruina Matemático (%)', `${data.quantitative?.monteCarlo?.riskOfRuinPct ?? 0}%`],
      ['Drawdown Esperado Monte Carlo 95% (%)', `${data.quantitative?.monteCarlo?.maxDrawdownP95Pct ?? 0}%`],
      ['Índice de Disciplina Mental', `${data.psychology?.disciplineScore ?? 100}/100`],
      ['Arquetipo Psicológico', data.psychology?.archetype?.title || 'Estratega']
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen_Métricas');

    // 2. Hoja Matriz Emocional vs PnL
    const emotionHeader = ['Emoción', 'Total Trades', 'Win Rate (%)', 'PnL Acumulado ($)', 'PnL Medio ($)', 'Ganancia Media ($)', 'Pérdida Media ($)', 'Tasa Sin SL (%)'];
    const emotionRows = (data.quantitative?.emotionMatrix?.matrix || []).map((m: any) => [
      m.emotion,
      m.tradesCount,
      m.winRate,
      m.totalPnL,
      m.avgPnL,
      m.avgWin,
      m.avgLoss,
      m.indisciplineRate
    ]);
    const wsEmotion = XLSX.utils.aoa_to_sheet([emotionHeader, ...emotionRows]);
    XLSX.utils.book_append_sheet(wb, wsEmotion, 'Matriz_Emocional');

    // 3. Hoja Desglose de Sesiones
    const sessionHeader = ['Sesión Global', 'Total Trades', 'Win Rate (%)', 'PnL Total ($)', 'PnL Medio ($)', 'Trades Indisciplinados'];
    const sessionRows = (data.quantitative?.sessionBreakdown?.sessions || []).map((s: any) => [
      s.sessionName,
      s.tradesCount,
      s.winRate,
      s.totalPnL,
      s.avgPnL,
      s.indisciplineCount
    ]);
    const wsSession = XLSX.utils.aoa_to_sheet([sessionHeader, ...sessionRows]);
    XLSX.utils.book_append_sheet(wb, wsSession, 'Sesiones_Globales');

    // 4. Hoja Historial de Operaciones
    const tradesHeader = ['ID', 'Fecha Entrada', 'Fecha Salida', 'Activo', 'Mercado', 'Dirección', 'Volumen', 'Precio Entrada', 'Precio Salida', 'Stop Loss', 'Take Profit', 'PnL ($ USD)', 'Emoción', 'Estado', 'Confluencias', 'Notas'];
    const tradesRows = (data.trades || []).map((t: any) => [
      t.id_trade,
      t.entry_date ? new Date(t.entry_date).toISOString() : (t.createdAt ? new Date(t.createdAt).toISOString() : ''),
      t.exit_date ? new Date(t.exit_date).toISOString() : 'Abierta',
      t.asset,
      t.market_type,
      t.trade_type,
      t.volume,
      t.entry_price,
      t.exit_price,
      t.stop_loss,
      t.take_profit,
      parseFloat(t.pnl) || 0,
      t.emotion_state,
      t.status,
      t.confluences,
      t.notes
    ]);
    const wsTrades = XLSX.utils.aoa_to_sheet([tradesHeader, ...tradesRows]);
    XLSX.utils.book_append_sheet(wb, wsTrades, 'Historial_Operaciones');

    // Descargar archivo
    const accountName = data.account?.name || 'Cuenta';
    const filename = `Portafolio_Trading_${accountName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
  }
}
