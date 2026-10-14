const {
  detectRevengeTrade,
  calculateDisciplineScore,
  detectPsychologicalArchetype
} = require('../utils/psychologyEngine');

describe('Suite de Pruebas Unitarias - Algoritmos Psicológicos y Revenge Trading', () => {

  describe('Detección Algorítmica de Revenge Trading', () => {
    test('Identifica revenge trading cuando el trader entra en menos de 20 min tras una pérdida aumentando volumen', () => {
      const prevTrade = {
        createdAt: new Date('2026-03-15T14:00:00Z'),
        pnl: -350,
        volume: 1
      };
      const currentTrade = {
        createdAt: new Date('2026-03-15T14:10:00Z'), // 10 min después
        volume: 2, // Volumen duplicado (> 1.25x)
        stop_loss: 1.0800,
        risk_percentage: 1.5,
        emotion_state: 'Calma'
      };

      expect(detectRevengeTrade(currentTrade, prevTrade)).toBe(true);
    });

    test('Identifica revenge trading si la emoción es explícitamente reactiva (Venganza/FOMO)', () => {
      const prevTrade = {
        createdAt: new Date('2026-03-15T14:00:00Z'),
        pnl: -200,
        volume: 1
      };
      const currentTrade = {
        createdAt: new Date('2026-03-15T14:15:00Z'),
        volume: 1,
        stop_loss: 1.0800,
        risk_percentage: 1.0,
        emotion_state: 'Venganza'
      };

      expect(detectRevengeTrade(currentTrade, prevTrade)).toBe(true);
    });

    test('No clasifica como revenge trading si la operación anterior fue ganadora', () => {
      const prevTrade = {
        createdAt: new Date('2026-03-15T14:00:00Z'),
        pnl: 400,
        volume: 1
      };
      const currentTrade = {
        createdAt: new Date('2026-03-15T14:05:00Z'),
        volume: 2,
        stop_loss: null
      };

      expect(detectRevengeTrade(currentTrade, prevTrade)).toBe(false);
    });

    test('No clasifica como revenge trading si transcurrió más tiempo (> 25 min)', () => {
      const prevTrade = {
        createdAt: new Date('2026-03-15T14:00:00Z'),
        pnl: -200,
        volume: 1
      };
      const currentTrade = {
        createdAt: new Date('2026-03-15T14:45:00Z'), // 45 min después
        volume: 1.5,
        stop_loss: 1.0800,
        emotion_state: 'Calma'
      };

      expect(detectRevengeTrade(currentTrade, prevTrade)).toBe(false);
    });
  });

  describe('Cálculo Ponderado de Disciplina Mental', () => {
    test('Retorna 100% para cuenta sin operaciones o con cumplimiento total', () => {
      expect(calculateDisciplineScore({ totalTrades: 0 })).toBe(100);
      expect(calculateDisciplineScore({
        totalTrades: 5,
        slSetCount: 5,
        safeRiskCount: 5,
        revengeTradesCount: 0,
        confluencesCount: 5
      })).toBe(100);
    });

    test('Penaliza severamente la falta de Stop Loss y las operaciones de venganza', () => {
      const score = calculateDisciplineScore({
        totalTrades: 10,
        slSetCount: 2, // 20% SL
        safeRiskCount: 5, // 50% riesgo seguro
        revengeTradesCount: 4, // 40% venganza
        confluencesCount: 2
      });
      expect(score).toBeLessThan(50);
    });
  });

  describe('Detección de Arquetipos Psicológicos', () => {
    test('Detecta "El Francotirador de Alta Precisión" ante alta rentabilidad y control de pérdidas', () => {
      const archetype = detectPsychologicalArchetype({
        totalTrades: 10,
        winRate: 80,
        netPnL: 2500,
        losingTrades: 2,
        profitFactor: 3.5,
        disciplineScore: 95
      });
      expect(archetype.title).toBe('El Francotirador de Alta Precisión');
      expect(archetype.emoji).toBe('🎯');
    });

    test('Detecta "El Gladiador Reactivo" cuando abundan operaciones de venganza', () => {
      const archetype = detectPsychologicalArchetype({
        totalTrades: 10,
        winRate: 40,
        netPnL: -800,
        losingTrades: 6,
        revengeTradesCount: 3,
        revengeLossTotal: 650,
        profitFactor: 0.6,
        disciplineScore: 45
      });
      expect(archetype.title).toBe('El Gladiador Reactivo');
      expect(archetype.emoji).toBe('⚔️');
    });

    test('Detecta "El Cazador Impulsivo" ante entradas sin Stop Loss (FOMO)', () => {
      const archetype = detectPsychologicalArchetype({
        totalTrades: 10,
        winRate: 50,
        netPnL: -300,
        losingTrades: 5,
        revengeTradesCount: 0,
        revengeLossTotal: 0,
        fomoTradesCount: 5,
        slSetCount: 3,
        profitFactor: 0.8,
        disciplineScore: 40
      });
      expect(archetype.title).toBe('El Cazador Impulsivo');
      expect(archetype.emoji).toBe('🦅');
    });
  });

});
