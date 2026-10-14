/**
 * psychologyEngine.js
 * Algoritmos de Detección de Arquetipos Psicológicos, Revenge Trading y Sesgos Cognitivos
 * Trading Portfolio & Behavioral Finance
 */

const { calculatePnLInUSD } = require('./quantitativeEngine');

/**
 * Detecta si una operación califica como Revenge Trading (Trading por Venganza)
 */
function detectRevengeTrade(currentTrade, prevTrade) {
  if (!prevTrade) return false;

  const prevPnl = calculatePnLInUSD(prevTrade);
  if (prevPnl === null || prevPnl >= 0) {
    return false;
  }

  const currentTime = new Date(currentTrade.createdAt || Date.now()).getTime();
  const prevTime = new Date(prevTrade.createdAt || Date.now()).getTime();
  const timeDiffMinutes = (currentTime - prevTime) / (1000 * 60);

  if (timeDiffMinutes < 0 || timeDiffMinutes > 25) {
    return false;
  }

  const currentVol = parseFloat(currentTrade.volume) || 0;
  const prevVol = parseFloat(prevTrade.volume) || 0;
  const volumeIncreased = (currentVol > 0 && prevVol > 0 && currentVol >= prevVol * 1.25);

  const risk = parseFloat(currentTrade.risk_percentage) || 1.0;
  const unsafeRisk = risk > 2.5;

  const hasNoSL = !currentTrade.stop_loss || parseFloat(currentTrade.stop_loss) <= 0;

  const emo = currentTrade.emotion_state || 'Calma';
  const isNegativeEmo = ['FOMO', 'Venganza', 'Ira', 'Frustración', 'Desquite'].includes(emo);

  return (volumeIncreased || unsafeRisk || hasNoSL || isNegativeEmo);
}

/**
 * Calcula el puntaje de disciplina mental de 0 a 100
 */
function calculateDisciplineScore({
  totalTrades,
  slSetCount,
  safeRiskCount,
  revengeTradesCount,
  confluencesCount,
  isSuperPositive = false
}) {
  if (!totalTrades || totalTrades <= 0) return 100;

  const slPct = slSetCount / totalTrades;
  const slPoints = slPct * 40;

  const riskPct = safeRiskCount / totalTrades;
  const riskPoints = riskPct * 35;

  const revengeRatio = revengeTradesCount / totalTrades;
  const emotionalPoints = Math.max(0, 15 - (revengeRatio * 30));

  const confRatio = confluencesCount / totalTrades;
  let planPoints = confRatio * 10;
  if (isSuperPositive && planPoints < 8) {
    planPoints = 10;
  }

  let score = Math.round(slPoints + riskPoints + emotionalPoints + planPoints);
  if (slSetCount === totalTrades && safeRiskCount === totalTrades && revengeTradesCount === 0) {
    score = 100;
  }
  return Math.max(10, Math.min(100, score));
}

/**
 * Determina el arquetipo psicológico predominante del operador
 */
function detectPsychologicalArchetype({
  totalTrades,
  winRate,
  netPnL,
  losingTrades,
  revengeTradesCount,
  revengeLossTotal,
  fomoTradesCount,
  slSetCount,
  dispositionRatio,
  lossAmountsCount,
  overconfidenceTradesCount,
  disciplineScore,
  profitFactor
}) {
  if (!totalTrades || totalTrades === 0) {
    return {
      title: 'Estratega Disciplinado',
      emoji: '⛩️',
      subtitle: 'Disciplina inicial intacta (100% de cumplimiento)',
      description: 'Inicias con una hoja en blanco y 100% de disciplina mental. Tu ventaja se construye respetando tu plan desde el primer trade.'
    };
  }

  const isSuperPositive = (netPnL > 0 && (winRate >= 65 || losingTrades <= 1 || profitFactor >= 2.0));

  if (isSuperPositive) {
    return {
      title: 'El Francotirador de Alta Precisión',
      emoji: '🎯',
      subtitle: `Alta ventaja estadística institucional (${winRate.toFixed(0)}% Win Rate)`,
      description: `Muestras una lectura de mercado quirúrgica con balance neto positivo (+${netPnL.toFixed(2)} USD). Tus pérdidas están contenidas rigurosamente dentro de tu plan.`
    };
  }

  if (revengeTradesCount >= 2 && revengeLossTotal > 0) {
    return {
      title: 'El Gladiador Reactivo',
      emoji: '⚔️',
      subtitle: 'Vulnerable a tomar represalias contra el mercado tras una pérdida',
      description: 'Tu mayor debilidad es la frustración post-pérdida. Tiendes a entrar deprisa o aumentar el lotaje para recuperar lo perdido de inmediato.'
    };
  }

  if (fomoTradesCount >= Math.max(2, totalTrades * 0.4) || (slSetCount < totalTrades * 0.6)) {
    return {
      title: 'El Cazador Impulsivo',
      emoji: '🦅',
      subtitle: 'Impulsado por el miedo a perder oportunidades (FOMO / Sin SL)',
      description: 'Posees agilidad para encontrar movimientos, pero te precipitas entrando sin confirmaciones técnicas o descuidando el Stop Loss.'
    };
  }

  if (!isSuperPositive && dispositionRatio < 0.7 && lossAmountsCount >= 3 && netPnL < 0) {
    return {
      title: 'El Protector Cauteloso',
      emoji: '🛡️',
      subtitle: 'Aversión asimétrica al riesgo: corta ganancias prematuramente',
      description: 'Proteges tu capital con Stop Loss, pero la ansiedad te hace cerrar operaciones ganadoras antes de tiempo mientras dejas correr las pérdidas completas.'
    };
  }

  if (overconfidenceTradesCount >= 2 && netPnL < 0) {
    return {
      title: 'El Navegante Eufórico',
      emoji: '🚀',
      subtitle: 'Vulnerable a relajar el riesgo tras ganar operaciones',
      description: 'Tras victorias consecutivas relajas las reglas de lotaje, lo que suele devolver los beneficios acumulados en un solo trade.'
    };
  }

  if (disciplineScore >= 80) {
    return {
      title: 'El Estratega Zen',
      emoji: '⛩️',
      subtitle: 'Mentalidad institucional fría y probabilística',
      description: 'Ejecutas con serenidad, respetas tu plan de capital y aceptas las pérdidas normales como el costo natural del negocio del trading.'
    };
  }

  return {
    title: 'Operador Metódico en Desarrollo',
    emoji: '🧘',
    subtitle: 'Trading estructurado con base técnica sólida',
    description: 'Muestras consistencia en la ejecución y gestión de riesgo, con un enfoque disciplinado hacia la maestría a largo plazo.'
  };
}

module.exports = {
  detectRevengeTrade,
  calculateDisciplineScore,
  detectPsychologicalArchetype
};
