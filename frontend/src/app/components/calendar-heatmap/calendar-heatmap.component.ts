import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DayData {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  tradesCount: number;
  pnl: number;
  trades: any[];
}

@Component({
  selector: 'app-calendar-heatmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-heatmap.component.html',
  styleUrl: './calendar-heatmap.component.css'
})
export class CalendarHeatmapComponent implements OnChanges {
  @Input() trades: any[] = [];

  currentDate = new Date();
  calendarDays: DayData[] = [];
  selectedDayModal: DayData | null = null;

  monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  monthPnL = 0;
  greenDays = 0;
  redDays = 0;
  bestDayPnL = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['trades']) {
      this.generateCalendar();
    }
  }

  changeMonth(delta: number): void {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + delta, 1);
    this.generateCalendar();
  }

  goToCurrentMonth(): void {
    this.currentDate = new Date();
    this.generateCalendar();
  }

  generateCalendar(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Ajustar para empezar en Lunes (0 = Domingo en JS)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: DayData[] = [];

    // Días del mes anterior para rellenar
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthLastDay - i;
      const date = new Date(year, month - 1, d);
      days.push(this.buildDayData(date, false));
    }

    // Días del mes actual
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const date = new Date(year, month, day);
      days.push(this.buildDayData(date, true));
    }

    // Días del mes siguiente para completar múltiplos de 7
    const remaining = 7 - (days.length % 7);
    if (remaining < 7 && remaining > 0) {
      for (let i = 1; i <= remaining; i++) {
        const date = new Date(year, month + 1, i);
        days.push(this.buildDayData(date, false));
      }
    }

    this.calendarDays = days;
    this.calculateMonthSummary();
  }

  buildDayData(date: Date, isCurrentMonth: boolean): DayData {
    const dateStr = this.formatDateKey(date);

    // Filtrar trades de ese día
    const dayTrades = this.trades.filter(t => {
      if (!t.createdAt) return false;
      const tDate = new Date(t.createdAt);
      return this.formatDateKey(tDate) === dateStr;
    });

    let pnl = 0;
    dayTrades.forEach(t => {
      if (t.pnl !== null && t.pnl !== undefined) {
        pnl += parseFloat(t.pnl);
      }
    });

    return {
      date,
      dayNumber: date.getDate(),
      isCurrentMonth,
      tradesCount: dayTrades.length,
      pnl: parseFloat(pnl.toFixed(2)),
      trades: dayTrades
    };
  }

  formatDateKey(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  calculateMonthSummary(): void {
    let totalPnl = 0;
    let green = 0;
    let red = 0;
    let best = 0;

    this.calendarDays.forEach(day => {
      if (day.isCurrentMonth && day.tradesCount > 0) {
        totalPnl += day.pnl;
        if (day.pnl > 0) {
          green++;
          if (day.pnl > best) best = day.pnl;
        } else if (day.pnl < 0) {
          red++;
        }
      }
    });

    this.monthPnL = parseFloat(totalPnl.toFixed(2));
    this.greenDays = green;
    this.redDays = red;
    this.bestDayPnL = parseFloat(best.toFixed(2));
  }

  selectDay(cell: DayData): void {
    if (cell.tradesCount > 0) {
      this.selectedDayModal = cell;
    }
  }
}
