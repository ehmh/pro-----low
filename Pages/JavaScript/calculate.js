/**
 * Mosuight Pro - 三角洲行动战绩分析助手
 * Calculate Module - 数据计算模块
 * 
 * 功能：
 * - 战斗数据统计分析
 * - 角色使用统计
 * - 地图战绩统计
 * - 趋势分析计算
 */

(function() {
  'use strict';

  const ROLE_CACHE = {
    data: null
  };

  const MAP_CONFIG = {
    bakeshi: {
      ids: [8101, 8102, 8103],
      name: '巴克什',
      earningsId: 'bakeshi-earnings',
      evacuationId: 'bakeshi-evacuation',
      goldProbId: 'bakeshi-gold-prob',
      redProbId: 'bakeshi-red-prob'
    },
    daba: {
      ids: [2201, 2202, 2211, 2212, 2231, 2232, 2233, 2242],
      name: '零号大坝',
      earningsId: 'daba-earnings',
      evacuationId: 'daba-evacuation',
      goldProbId: 'daba-gold-prob',
      redProbId: 'daba-red-prob'
    },
    changgong: {
      ids: [1901, 1902, 1911, 1912, 1999],
      name: '长弓溪谷',
      earningsId: 'changgong-earnings',
      evacuationId: 'changgong-evacuation',
      goldProbId: 'changgong-gold-prob',
      redProbId: 'changgong-red-prob'
    },
    hangtian: {
      ids: [3901, 3902],
      name: '航天基地',
      earningsId: 'hangtian-earnings',
      evacuationId: 'hangtian-evacuation',
      goldProbId: 'hangtian-gold-prob',
      redProbId: 'hangtian-red-prob'
    },
    chaoxi: {
      ids: [8803],
      name: '潮汐监狱',
      earningsId: 'chaoxi-earnings',
      evacuationId: 'chaoxi-evacuation',
      goldProbId: 'chaoxi-gold-prob',
      redProbId: 'chaoxi-red-prob'
    }
  };

  async function loadRoleData() {
    if (!ROLE_CACHE.data) {
      try {
        const response = await fetch('../../Asset/Resource/Dictionary/Role.Json');
        const data = await response.json();
        ROLE_CACHE.data = {
          data: Object.entries(data).map(([id, name]) => ({
            id: parseInt(id),
            name: name,
            avatar: '',
            avatar2: ''
          }))
        };
      } catch (error) {
        console.error('加载角色数据失败:', error);
        ROLE_CACHE.data = { data: [] };
      }
    }
    return ROLE_CACHE;
  }

  function getRoleJson() {
    return ROLE_CACHE.data || { data: [] };
  }

  function getRoleNameByIdSync(roleId) {
    if (!ROLE_CACHE.data || !ROLE_CACHE.data.data) {
      return '未知角色';
    }
    const role = ROLE_CACHE.data.data.find(r => r.id === roleId);
    return role ? role.name : '未知角色';
  }

  function calculateBaseScore(battle) {
    let score = 1500;
    
    score += (parseInt(battle.killCnt) || 0) * 20;
    score += (parseInt(battle.headShotCnt) || 0) * 30;
    score += (parseInt(battle.killPlayer) || 0) * 40;
    
    score += (parseInt(battle.doubleKill) || 0) * 50;
    score += (parseInt(battle.tripleKill) || 0) * 100;
    score += (parseInt(battle.quadKill) || 0) * 200;
    score += (parseInt(battle.pentaKill) || 0) * 400;
    
    if (parseInt(battle.gameResult) === 0) {
      score += 100;
    } else {
      score -= 50;
    }
    
    const gameTime = parseInt(battle.gameTime) || 0;
    if (gameTime >= 200 && gameTime <= 1200) {
      score += 60;
    } else if (gameTime < 200) {
      score -= 40;
    } else if (gameTime > 1200) {
      score -= 20;
    }
    
    const profitLoss = parseInt(battle.ProfitLoss) || 0;
    let profitRatio = profitLoss / 10000;
    profitRatio = Math.max(-50, Math.min(100, profitRatio));
    score += profitRatio;
    
    return Math.round(score);
  }

  function calculateMatchQualityScore(battles) {
    const validBattles = battles.filter(battle => {
      return battle && battle.dtEventTime && battle.gameResult !== undefined && battle.isLeave !== 1;
    });
    
    validBattles.sort((a, b) => new Date(a.dtEventTime).getTime() - new Date(b.dtEventTime).getTime());
    
    const timeLabels = [];
    const qualityScores = [];
    const trendScores = [];
    let totalScore = 0;
    
    let previousTrendScore = null;
    const recentScores = [];
    
    validBattles.forEach((battle, index) => {
      const date = new Date(battle.dtEventTime);
      const timeLabel = (date.getMonth() + 1) + '/' + date.getDate() + ' ' + 
                        date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
      timeLabels.push(timeLabel);
      
      const baseScore = calculateBaseScore(battle);
      
      let adjustedScore;
      if (parseInt(battle.gameResult) === 0) {
        adjustedScore = baseScore * 0.7 + 300;
        adjustedScore = Math.max(1350, Math.min(2400, adjustedScore));
      } else {
        adjustedScore = baseScore * 0.7 + 1000;
        adjustedScore = Math.max(1950, Math.min(3100, adjustedScore));
      }
      
      adjustedScore = Math.round(adjustedScore);
      qualityScores.push(adjustedScore);
      totalScore += adjustedScore;
      
      recentScores.unshift(adjustedScore);
      if (recentScores.length > 5) {
        recentScores.pop();
      }
      
      let trendScore;
      if (recentScores.length === 1) {
        trendScore = recentScores[0];
      } else {
        const weights = [0.4, 0.3, 0.15, 0.1, 0.05];
        let weightedSum = 0;
        const totalWeight = recentScores.reduce((sum, _, i) => {
          if (i < weights.length) return sum + weights[i];
          return sum;
        }, 0);
        
        recentScores.forEach((score, i) => {
          if (i < weights.length) {
            weightedSum += score * weights[i];
          }
        });
        
        trendScore = weightedSum / totalWeight;
      }
      
      if (previousTrendScore === null) {
        trendScore = trendScore;
      } else {
        trendScore = trendScore * 0.8 + previousTrendScore * 0.2;
      }
      
      previousTrendScore = trendScore;
      trendScore = Math.round(trendScore);
      trendScores.push(trendScore);
    });
    
    const avgScore = validBattles.length > 0 ? totalScore / validBattles.length : 0;
    
    return {
      xAxisData: timeLabels,
      qualityScoreData: qualityScores,
      trendQualityScoreData: trendScores,
      avgQualityScore: avgScore,
      currentTrendScore: trendScores[trendScores.length - 1] || 0
    };
  }

  function calculatePlayerPerformanceScore(battles) {
    const validBattles = battles.filter(battle => {
      return battle && battle.dtEventTime && battle.gameResult !== undefined && battle.isLeave !== 1;
    });
    
    validBattles.sort((a, b) => new Date(a.dtEventTime).getTime() - new Date(b.dtEventTime).getTime());
    
    const timeLabels = [];
    const performanceScores = [];
    const trendScores = [];
    let totalScore = 0;
    
    let previousTrendScore = null;
    const recentScores = [];
    
    validBattles.forEach((battle) => {
      const date = new Date(battle.dtEventTime);
      const timeLabel = (date.getMonth() + 1) + '/' + date.getDate() + ' ' + 
                        date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
      timeLabels.push(timeLabel);
      
      const baseScore = calculateBaseScore(battle);
      
      if (parseInt(battle.gameResult) === 1) {
        baseScore -= 50;
      }
      
      performanceScores.push(baseScore);
      totalScore += baseScore;
      
      recentScores.unshift(baseScore);
      if (recentScores.length > 5) {
        recentScores.pop();
      }
      
      let trendScore;
      if (recentScores.length === 1) {
        trendScore = recentScores[0];
      } else {
        const weights = [0.4, 0.3, 0.15, 0.1, 0.05];
        let weightedSum = 0;
        const totalWeight = recentScores.reduce((sum, _, i) => {
          if (i < weights.length) return sum + weights[i];
          return sum;
        }, 0);
        
        recentScores.forEach((score, i) => {
          if (i < weights.length) {
            weightedSum += score * weights[i];
          }
        });
        
        trendScore = weightedSum / totalWeight;
      }
      
      if (previousTrendScore === null) {
        trendScore = trendScore;
      } else {
        trendScore = trendScore * 0.8 + previousTrendScore * 0.2;
      }
      
      previousTrendScore = trendScore;
      trendScore = Math.round(trendScore);
      trendScores.push(trendScore);
    });
    
    const avgScore = validBattles.length > 0 ? totalScore / validBattles.length : 0;
    
    return {
      xAxisData: timeLabels,
      performanceScoreData: performanceScores,
      trendPerformanceScoreData: trendScores,
      avgPerformanceScore: avgScore,
      currentTrendScore: trendScores[trendScores.length - 1] || 0
    };
  }

  function calculateMapStats(battles) {
    let totalMatches = battles.length;
    let successfulEvacuations = 0;
    let totalProfitLoss = 0;
    let goldItemsFound = 0;
    let redItemsFound = 0;
    
    battles.forEach(battle => {
      if (parseInt(battle.gameResult) === 0) {
        successfulEvacuations++;
      }
      
      totalProfitLoss += parseInt(battle.ProfitLoss) || 0;
      
      if (battle.collections && Array.isArray(battle.collections)) {
        battle.collections.forEach(item => {
          if (item.grade === 5) {
            goldItemsFound++;
          } else if (item.grade === 6) {
            redItemsFound++;
          }
        });
      }
    });
    
    return {
      totalMatches: totalMatches,
      successfulEvacuations: successfulEvacuations,
      totalProfitLoss: totalProfitLoss,
      goldItemsFound: goldItemsFound,
      redItemsFound: redItemsFound,
      evacuationRate: totalMatches > 0 ? successfulEvacuations / totalMatches * 100 : 0,
      goldItemRate: totalMatches > 0 ? goldItemsFound / totalMatches * 100 : 0,
      redItemRate: totalMatches > 0 ? redItemsFound / totalMatches * 100 : 0
    };
  }

  function calculateCharacterUsage(battles, roleData) {
    const usageCount = {};
    let totalCount = 0;
    
    battles.forEach(battle => {
      const roleId = parseInt(battle.armedForceId);
      if (!isNaN(roleId)) {
        usageCount[roleId] = (usageCount[roleId] || 0) + 1;
        totalCount++;
      }
    });
    
    const result = [];
    for (const [roleId, count] of Object.entries(usageCount)) {
      const roleInfo = roleData[roleId] || { name: '未知角色(' + roleId + ')' };
      result.push({
        name: roleInfo.name,
        value: count,
        percentage: totalCount > 0 ? (count / totalCount * 100).toFixed(1) : '0.0',
        avatar: roleInfo.avatar
      });
    }
    
    result.sort((a, b) => b.value - a.value);
    return result;
  }

  function calculateCharacterFinance(battles, roleData) {
    const financeData = {};
    
    battles.forEach(battle => {
      const roleId = parseInt(battle.armedForceId);
      if (!isNaN(roleId)) {
        if (!financeData[roleId]) {
          financeData[roleId] = {
            totalProfit: 0,
            totalLoss: 0,
            profitCount: 0,
            lossCount: 0,
            totalMatches: 0
          };
        }
        
        const profitLoss = parseInt(battle.ProfitLoss) || 0;
        financeData[roleId].totalMatches++;
        
        if (profitLoss > 0) {
          financeData[roleId].totalProfit += profitLoss;
          financeData[roleId].profitCount++;
        } else if (profitLoss < 0) {
          financeData[roleId].totalLoss += Math.abs(profitLoss);
          financeData[roleId].lossCount++;
        }
      }
    });
    
    const profitStats = [];
    const lossStats = [];
    
    for (const [roleId, data] of Object.entries(financeData)) {
      const roleInfo = roleData[roleId] || { name: '未知角色(' + roleId + ')' };
      
      if (data.totalProfit > 0) {
        profitStats.push({
          name: roleInfo.name,
          value: data.totalProfit,
          averageProfit: data.profitCount > 0 ? Math.round(data.totalProfit / data.profitCount) : 0
        });
      }
      
      if (data.totalLoss > 0) {
        lossStats.push({
          name: roleInfo.name,
          value: data.totalLoss,
          averageLoss: data.lossCount > 0 ? Math.round(data.totalLoss / data.lossCount) : 0
        });
      }
    }
    
    profitStats.sort((a, b) => b.value - a.value);
    lossStats.sort((a, b) => b.value - a.value);
    
    return {
      profitStats: profitStats.slice(0, 8),
      lossStats: lossStats.slice(0, 8)
    };
  }

  function calculateProfitRatioTrend(battles) {
    const validBattles = battles.filter(battle => {
      return battle.dtEventTime && 
             battle.originalEquipmentPriceWithoutKeyChain !== undefined && 
             battle.ProfitLoss !== undefined && 
             parseInt(battle.originalEquipmentPriceWithoutKeyChain) > 0;
    });
    
    validBattles.sort((a, b) => new Date(a.dtEventTime) - new Date(b.dtEventTime));
    
    const timeLabels = [];
    const finalAssetValues = [];
    const profitRates = [];
    
    validBattles.forEach(battle => {
      const equipmentPrice = parseInt(battle.originalEquipmentPriceWithoutKeyChain) || 0;
      const profitLoss = parseInt(battle.ProfitLoss) || 0;
      const finalAsset = equipmentPrice + profitLoss;
      const profitRate = equipmentPrice > 0 ? (profitLoss / equipmentPrice) * 100 : 0;
      
      const date = new Date(battle.dtEventTime);
      const timeLabel = (date.getMonth() + 1) + '/' + date.getDate() + ' ' + 
                        date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
      
      timeLabels.push(timeLabel);
      finalAssetValues.push(finalAsset);
      profitRates.push(profitRate.toFixed(1));
    });
    
    const avgFinalAsset = finalAssetValues.length > 0 
      ? finalAssetValues.reduce((sum, val) => sum + val, 0) / finalAssetValues.length 
      : 0;
    
    const avgProfitRate = profitRates.length > 0 
      ? profitRates.reduce((sum, val) => sum + parseFloat(val), 0) / profitRates.length 
      : 0;
    
    return {
      xAxisData: timeLabels,
      finalAssetValueData: finalAssetValues,
      profitRateData: profitRates,
      avgFinalAssetValue: avgFinalAsset,
      avgProfitRate: avgProfitRate,
      validData: validBattles
    };
  }

  function calculatePlayerPerformanceTrend(battles) {
    const validBattles = battles.filter(battle => {
      return battle.dtEventTime && battle.gameResult !== undefined && battle.isLeave !== 1;
    });
    
    validBattles.sort((a, b) => new Date(a.dtEventTime) - new Date(b.dtEventTime));
    
    const timeLabels = [];
    const performanceData = [];
    const trendScoreData = [];
    let totalScore = 0;
    
    let previousTrendScore = null;
    
    validBattles.forEach((battle) => {
      const date = new Date(battle.dtEventTime);
      const timeLabel = (date.getMonth() + 1) + '/' + date.getDate() + ' ' + 
                        date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
      timeLabels.push(timeLabel);
      
      const baseScore = calculateBaseScore(battle);
      performanceData.push(baseScore);
      totalScore += baseScore;
    });
    
    const weights = [0.4, 0.3, 0.15, 0.1, 0.05];
    
    performanceData.forEach((score, index) => {
      const recentScores = performanceData.slice(Math.max(0, index - 4), index + 1);
      
      let weightedSum = 0;
      recentScores.forEach((s, i) => {
        if (i < weights.length) {
          weightedSum += s * weights[i];
        }
      });
      
      const totalWeight = weights.slice(0, recentScores.length).reduce((sum, w) => sum + w, 0);
      let trendScore = weightedSum / totalWeight;
      
      if (previousTrendScore === null) {
        trendScore = trendScore;
      } else {
        trendScore = trendScore * 0.8 + previousTrendScore * 0.2;
      }
      
      trendScore = Math.max(1000, trendScore);
      trendScore = Math.round(trendScore);
      trendScoreData.push(trendScore);
      previousTrendScore = trendScore;
    });
    
    const avgPerformance = validBattles.length > 0 ? totalScore / validBattles.length : 0;
    
    return {
      xAxisData: timeLabels,
      performanceData: performanceData,
      trendScoreData: trendScoreData,
      avgPerformance: avgPerformance,
      validData: validBattles
    };
  }

  function calculateMatchQualityScoreTrend(battles) {
    const validBattles = battles.filter(battle => {
      return battle && battle.dtEventTime && battle.gameResult !== undefined && battle.isLeave !== 1;
    });
    
    validBattles.sort((a, b) => new Date(a.dtEventTime).getTime() - new Date(b.dtEventTime).getTime());
    
    const timeLabels = [];
    const qualityScores = [];
    const trendScores = [];
    let totalScore = 0;
    
    let previousTrendScore = null;
    const recentScores = [];
    
    validBattles.forEach((battle) => {
      const date = new Date(battle.dtEventTime);
      const timeLabel = (date.getMonth() + 1) + '/' + date.getDate() + ' ' + 
                        date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
      timeLabels.push(timeLabel);
      
      const baseScore = calculateBaseScore(battle);
      
      let adjustedScore;
      if (parseInt(battle.gameResult) === 0) {
        adjustedScore = baseScore * 0.7 + 300;
        adjustedScore = Math.max(1350, Math.min(2400, adjustedScore));
      } else {
        adjustedScore = baseScore * 0.7 + 1000;
        adjustedScore = Math.max(1950, Math.min(3100, adjustedScore));
      }
      
      adjustedScore = Math.round(adjustedScore);
      qualityScores.push(adjustedScore);
      totalScore += adjustedScore;
      
      recentScores.unshift(adjustedScore);
      if (recentScores.length > 5) {
        recentScores.pop();
      }
      
      let trendScore;
      if (recentScores.length === 1) {
        trendScore = recentScores[0];
      } else {
        const weights = [0.4, 0.3, 0.15, 0.1, 0.05];
        let weightedSum = 0;
        const totalWeight = recentScores.reduce((sum, _, i) => {
          if (i < weights.length) return sum + weights[i];
          return sum;
        }, 0);
        
        recentScores.forEach((score, i) => {
          if (i < weights.length) {
            weightedSum += score * weights[i];
          }
        });
        
        trendScore = weightedSum / totalWeight;
      }
      
      if (previousTrendScore === null) {
        trendScore = trendScore;
      } else {
        trendScore = trendScore * 0.8 + previousTrendScore * 0.2;
      }
      
      previousTrendScore = trendScore;
      trendScore = Math.round(trendScore);
      trendScores.push(trendScore);
    });
    
    const avgScore = validBattles.length > 0 ? totalScore / validBattles.length : 0;
    
    return {
      xAxisData: timeLabels,
      qualityScoreData: qualityScores,
      trendQualityScoreData: trendScores,
      avgQualityScore: avgScore
    };
  }

  function normalizeValue(value, min, max) {
    return (value - min) / (max - min + 0.000001);
  }

  function calculatePlayerBehaviorChangeTrend(battles) {
    const validBattles = battles.filter(battle => {
      return battle && battle.startTime && 
             battle.originalEquipmentPriceWithoutKeyChain !== undefined && 
             battle.killAi !== undefined && 
             battle.killPlayer !== undefined && 
             battle.doubleKill !== undefined && 
             battle.tripleKill !== undefined && 
             battle.quadKill !== undefined && 
             battle.pentaKill !== undefined && 
             battle.isLeave !== undefined && 
             battle.gameResult !== undefined;
    });
    
    if (validBattles.length === 0) {
      return {
        xAxisData: [],
        battleEffectivenessData: [],
        resourceSurvivalData: [],
        battleSignificantChanges: [],
        resourceSignificantChanges: []
      };
    }
    
    validBattles.sort((a, b) => parseInt(a.startTime) - parseInt(b.startTime));
    
    const metrics = [
      'originalEquipmentPriceWithoutKeyChain',
      'killAi', 'killPlayer', 'doubleKill', 'tripleKill', 'quadKill', 'pentaKill', 'isLeave'
    ];
    
    const metricRanges = {};
    metrics.forEach(metric => {
      const values = validBattles.map(b => parseFloat(b[metric]) || 0);
      metricRanges[metric] = {
        min: Math.min(...values),
        max: Math.max(...values)
      };
    });
    
    const normalizedData = validBattles.map(battle => ({
      originalEquipmentPriceWithoutKeyChain: normalizeValue(parseFloat(battle.originalEquipmentPriceWithoutKeyChain) || 0, 
        metricRanges.originalEquipmentPriceWithoutKeyChain.min, 
        metricRanges.originalEquipmentPriceWithoutKeyChain.max),
      killAi: normalizeValue(parseFloat(battle.killAi) || 0, metricRanges.killAi.min, metricRanges.killAi.max),
      killPlayer: normalizeValue(parseFloat(battle.killPlayer) || 0, metricRanges.killPlayer.min, metricRanges.killPlayer.max),
      doubleKill: normalizeValue(parseFloat(battle.doubleKill) || 0, metricRanges.doubleKill.min, metricRanges.doubleKill.max),
      tripleKill: normalizeValue(parseFloat(battle.tripleKill) || 0, metricRanges.tripleKill.min, metricRanges.tripleKill.max),
      quadKill: normalizeValue(parseFloat(battle.quadKill) || 0, metricRanges.quadKill.min, metricRanges.quadKill.max),
      pentaKill: normalizeValue(parseFloat(battle.pentaKill) || 0, metricRanges.pentaKill.min, metricRanges.pentaKill.max),
      isLeave: 1 - normalizeValue(parseFloat(battle.isLeave) || 0, metricRanges.isLeave.min, metricRanges.isLeave.max),
      gameResult_score: parseInt(battle.gameResult) === 0 ? 1 : 0
    }));
    
    const windowSize = Math.min(10, validBattles.length);
    const battleEffectivenessData = [];
    const resourceSurvivalData = [];
    
    for (let i = 0; i <= normalizedData.length - windowSize; i++) {
      const window = normalizedData.slice(i, i + windowSize);
      
      let battleEffectiveness = 0;
      let resourceSurvival = 0;
      
      window.forEach(data => {
        battleEffectiveness += data.killPlayer * 0.25 + data.killAi * 0.25 + 
                              data.doubleKill * 0.15 + data.tripleKill * 0.15 + 
                              data.quadKill * 0.1 + data.pentaKill * 0.1;
        resourceSurvival += data.originalEquipmentPriceWithoutKeyChain * 0.4 + 
                           data.gameResult_score * 0.3 + data.isLeave * 0.3;
      });
      
      battleEffectivenessData.push(battleEffectiveness / windowSize);
      resourceSurvivalData.push(resourceSurvival / windowSize);
    }
    
    const battleSignificantChanges = [];
    const resourceSignificantChanges = [];
    
    for (let i = 1; i < battleEffectivenessData.length; i++) {
      const prevValue = battleEffectivenessData[i - 1];
      const currValue = battleEffectivenessData[i];
      
      if (prevValue !== 0) {
        const changeRate = (currValue - prevValue) / prevValue;
        if (Math.abs(changeRate) >= 0.3) {
          battleSignificantChanges.push({
            index: i,
            value: currValue,
            changeRate: changeRate
          });
        }
      }
      
      const prevResource = resourceSurvivalData[i - 1];
      const currResource = resourceSurvivalData[i];
      
      if (prevResource !== 0) {
        const resourceChangeRate = (currResource - prevResource) / prevResource;
        if (Math.abs(resourceChangeRate) >= 0.4) {
          resourceSignificantChanges.push({
            index: i,
            value: currResource,
            changeRate: resourceChangeRate
          });
        }
      }
    }
    
    const xAxisLabels = battleEffectivenessData.map((_, index) => '窗口' + (index + 1));
    
    return {
      xAxisData: xAxisLabels,
      battleEffectivenessData: battleEffectivenessData,
      resourceSurvivalData: resourceSurvivalData,
      battleSignificantChanges: battleSignificantChanges,
      resourceSignificantChanges: resourceSignificantChanges
    };
  }

  function calculateBattleEnvironment(battles) {
    const performanceResult = calculatePlayerPerformanceScore(battles);
    const qualityResult = calculateMatchQualityScore(battles);
    
    const performanceScore = performanceResult.currentTrendScore || 0;
    const qualityScore = qualityResult.currentTrendScore || 0;
    
    const difference = performanceScore - qualityScore;
    
    let environmentType;
    if (difference > 300) {
      environmentType = '低压局';
    } else if (difference > -100) {
      environmentType = '普通局';
    } else if (difference > -400) {
      environmentType = '压力局';
    } else {
      environmentType = '高压局';
    }
    
    return {
      environmentType: environmentType,
      difference: difference,
      performanceScore: performanceScore,
      qualityScore: qualityScore
    };
  }

  window.calculateModule = {
    get roleJson() {
      return getRoleJson();
    },
    mapConfig: MAP_CONFIG,
    calculateMapStats: calculateMapStats,
    calculateCharacterUsage: calculateCharacterUsage,
    calculateCharacterFinance: calculateCharacterFinance,
    calculateProfitRatioTrend: calculateProfitRatioTrend,
    calculatePlayerPerformanceTrend: calculatePlayerPerformanceTrend,
    calculateMatchQualityScoreTrend: calculateMatchQualityScoreTrend,
    calculatePlayerPerformanceScore: calculatePlayerPerformanceScore,
    calculateMatchQualityScore: calculateMatchQualityScore,
    calculatePlayerBehaviorChangeTrend: calculatePlayerBehaviorChangeTrend,
    calculateBattleEnvironment: calculateBattleEnvironment,
    loadRoleData: loadRoleData,
    getRoleNameByIdSync: getRoleNameByIdSync
  };

})();
