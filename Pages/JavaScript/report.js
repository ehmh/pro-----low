/**
 * Mosuight Pro - 三角洲行动战绩分析助手
 * Report Page - 报告页面脚本
 * 
 * 功能：
 * - 战斗数据图表展示
 * - 统计数据汇总
 * - 角色/地图分析
 * - 导出报告功能
 */

(function() {
  'use strict';

  const STATE = {
    battleData: [],
    roleJson: null,
    isLoading: false,
    currentView: 'overview'
  };

  const CACHE_KEYS = {
    BATTLE_LIST: 'mosuight_battle_list_cache'
  };

  const CHART_COLORS = {
    primary: '#409EFF',
    success: '#67C23A',
    warning: '#E6A23C',
    danger: '#F56C6C',
    info: '#909399'
  };

  function initDomElements() {
    return {
      loadingOverlay: document.getElementById('loading-overlay'),
      dateRangeSelect: document.getElementById('date-range-select'),
      exportButton: document.getElementById('export-button'),
      viewTabs: document.querySelectorAll('.view-tab'),
      overviewSection: document.getElementById('overview-section'),
      roleSection: document.getElementById('role-section'),
      mapSection: document.getElementById('map-section'),
      trendSection: document.getElementById('trend-section'),
      totalBattles: document.getElementById('total-battles'),
      winRate: document.getElementById('win-rate'),
      totalProfitLoss: document.getElementById('total-profit-loss'),
      avgGameTime: document.getElementById('avg-game-time'),
      totalKills: document.getElementById('total-kills'),
      battleTrendChart: document.getElementById('battle-trend-chart'),
      profitTrendChart: document.getElementById('profit-trend-chart'),
      roleDistributionChart: document.getElementById('role-distribution-chart'),
      mapStatsChart: document.getElementById('map-stats-chart')
    };
  }

  function showLoading() {
    STATE.isLoading = true;
    DOM.loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    STATE.isLoading = false;
    DOM.loadingOverlay.classList.add('hidden');
  }

  function switchView(viewName) {
    STATE.currentView = viewName;
    
    DOM.viewTabs.forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.view === viewName) {
        tab.classList.add('active');
      }
    });

    const sections = ['overview', 'role', 'map', 'trend'];
    sections.forEach(section => {
      const element = document.getElementById(`${section}-section`);
      if (element) {
        element.classList.remove('active');
        if (section === viewName) {
          element.classList.add('active');
        }
      }
    });
  }

  function getCachedBattleList() {
    try {
      const cached = sessionStorage.getItem(CACHE_KEYS.BATTLE_LIST);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.sols && Array.isArray(parsed.sols)) {
          return parsed.sols;
        }
      }
    } catch (e) {
      console.error('读取缓存失败:', e);
    }
    return [];
  }

  function filterBattlesByDateRange(battles, range) {
    if (range === 'all') {
      return battles;
    }

    const now = new Date();
    const cutoffDate = new Date();

    switch (range) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case 'threeMonths':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case 'halfYear':
        cutoffDate.setDate(now.getDate() - 180);
        break;
      default:
        return battles;
    }

    return battles.filter(battle => new Date(battle.dtEventTime) >= cutoffDate);
  }

  function processBattleData(battles) {
    if (!battles || !Array.isArray(battles)) {
      return [];
    }

    return battles
      .filter(battle => battle && battle.dtEventTime)
      .sort((a, b) => new Date(b.dtEventTime) - new Date(a.dtEventTime));
  }

  function calculateOverallStats(battles) {
    const totalBattles = battles.length;
    const winBattles = battles.filter(b => parseInt(b.gameResult) === 0).length;
    const winRate = totalBattles > 0 ? ((winBattles / totalBattles) * 100).toFixed(1) : '0.0';
    
    let totalProfitLoss = 0;
    let totalGameTime = 0;
    let totalKills = 0;
    let validTimeCount = 0;

    battles.forEach(battle => {
      totalProfitLoss += parseInt(battle.ProfitLoss) || 0;
      totalKills += parseInt(battle.killPlayer) || 0;
      
      if (battle.gameTime) {
        totalGameTime += parseInt(battle.gameTime) || 0;
        validTimeCount++;
      }
    });

    const avgGameTime = validTimeCount > 0 ? Math.round(totalGameTime / validTimeCount) : 0;

    return {
      totalBattles,
      winBattles,
      winRate,
      totalProfitLoss,
      avgGameTime,
      totalKills
    };
  }

  function updateOverallStats(stats) {
    DOM.totalBattles.textContent = stats.totalBattles;
    DOM.winRate.textContent = stats.winRate + '%';
    
    const profitLossElement = DOM.totalProfitLoss;
    profitLossElement.textContent = formatNumber(stats.totalProfitLoss);
    profitLossElement.className = stats.totalProfitLoss >= 0 ? 'stat-value profit' : 'stat-value loss';
    
    const avgTimeStr = Math.floor(stats.avgGameTime / 60) + '分' + (stats.avgGameTime % 60) + '秒';
    DOM.avgGameTime.textContent = avgTimeStr;
    DOM.totalKills.textContent = formatNumber(stats.totalKills);
  }

  function formatNumber(num) {
    if (num === null || num === undefined) {
      return '0';
    }
    const value = parseInt(num) || 0;
    if (value >= 10000) {
      return (value / 10000).toFixed(1) + '万';
    }
    if (value <= -10000) {
      return (value / 10000).toFixed(1) + '万';
    }
    return value.toLocaleString('zh-CN');
  }

  function initBattleTrendChart(battles) {
    if (!DOM.battleTrendChart || typeof echarts === 'undefined') return;

    const chart = echarts.init(DOM.battleTrendChart);

    const dailyStats = {};
    battles.forEach(battle => {
      const date = new Date(battle.dtEventTime);
      const dateKey = (date.getMonth() + 1) + '/' + date.getDate();
      
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { total: 0, wins: 0 };
      }
      dailyStats[dateKey].total++;
      if (parseInt(battle.gameResult) === 0) {
        dailyStats[dateKey].wins++;
      }
    });

    const sortedDates = Object.keys(dailyStats).sort((a, b) => {
      const [aMonth, aDay] = a.split('/').map(Number);
      const [bMonth, bDay] = b.split('/').map(Number);
      const year = new Date().getFullYear();
      const dateA = new Date(year, aMonth - 1, aDay);
      const dateB = new Date(year, bMonth - 1, bDay);
      return dateA - dateB;
    });

    const totalData = sortedDates.map(date => dailyStats[date].total);
    const winData = sortedDates.map(date => dailyStats[date].wins);

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['总场次', '胜场'],
        top: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: sortedDates,
        axisLabel: { interval: 0, rotate: 30 }
      },
      yAxis: {
        type: 'value',
        minInterval: 1
      },
      series: [
        {
          name: '总场次',
          type: 'bar',
          data: totalData,
          itemStyle: { color: CHART_COLORS.primary }
        },
        {
          name: '胜场',
          type: 'bar',
          data: winData,
          itemStyle: { color: CHART_COLORS.success }
        }
      ]
    };

    chart.setOption(option);
  }

  function initProfitTrendChart(battles) {
    if (!DOM.profitTrendChart || typeof echarts === 'undefined') return;

    const chart = echarts.init(DOM.profitTrendChart);

    const profitData = window.calculateModule.calculateProfitRatioTrend(battles);

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['最终资产', '盈利率(%)'],
        top: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: profitData.xAxisData,
        axisLabel: { interval: 0, rotate: 30 }
      },
      yAxis: [
        {
          type: 'value',
          name: '资产',
          position: 'left'
        },
        {
          type: 'value',
          name: '盈利率(%)',
          position: 'right',
          axisLabel: { formatter: '{value}%' }
        }
      ],
      series: [
        {
          name: '最终资产',
          type: 'bar',
          yAxisIndex: 0,
          data: profitData.finalAssetValueData,
          itemStyle: { color: CHART_COLORS.warning }
        },
        {
          name: '盈利率(%)',
          type: 'line',
          yAxisIndex: 1,
          data: profitData.profitRateData,
          smooth: true,
          itemStyle: { color: CHART_COLORS.danger }
        }
      ]
    };

    chart.setOption(option);
  }

  function initRoleDistributionChart(battles) {
    if (!DOM.roleDistributionChart || typeof echarts === 'undefined') return;

    const chart = echarts.init(DOM.roleDistributionChart);

    const roleUsage = window.calculateModule.calculateCharacterUsage(
      battles,
      window.calculateModule.roleJson?.data || {}
    );

    const data = roleUsage.slice(0, 10);

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}次 ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center'
      },
      series: [{
        type: 'pie',
        radius: ['40%', '65%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: { show: false },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data: data.map((item, index) => ({
          value: item.value,
          name: item.name,
          itemStyle: {
            color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'][index % 9]
          }
        }))
      }]
    };

    chart.setOption(option);
  }

  function initMapStatsChart(battles) {
    if (!DOM.mapStatsChart || typeof echarts === 'undefined') return;

    const chart = echarts.init(DOM.mapStatsChart);

    const mapStats = window.calculateModule.calculateMapStats(battles);

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      legend: {
        data: ['撤离率', '金物品率', '红物品率'],
        top: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: ['地图统计'],
        axisLabel: { show: false }
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: { formatter: '{value}%' }
      },
      series: [
        {
          name: '撤离率',
          type: 'bar',
          stack: 'map',
          data: [mapStats.evacuationRate.toFixed(1)],
          itemStyle: { color: CHART_COLORS.success }
        },
        {
          name: '金物品率',
          type: 'bar',
          stack: 'map',
          data: [mapStats.goldItemRate.toFixed(1)],
          itemStyle: { color: CHART_COLORS.warning }
        },
        {
          name: '红物品率',
          type: 'bar',
          stack: 'map',
          data: [mapStats.redItemRate.toFixed(1)],
          itemStyle: { color: CHART_COLORS.danger }
        }
      ]
    };

    chart.setOption(option);
  }

  function generateExportData(battles, stats) {
    return {
      exportTime: new Date().toISOString(),
      summary: {
        totalBattles: stats.totalBattles,
        winRate: stats.winRate + '%',
        totalProfitLoss: stats.totalProfitLoss,
        avgGameTime: stats.avgGameTime,
        totalKills: stats.totalKills
      },
      battles: battles.map(battle => ({
        time: new Date(battle.dtEventTime).toLocaleString('zh-CN'),
        mapId: battle.mapId,
        mapName: getMapName(battle.mapId),
        gameResult: parseInt(battle.gameResult) === 0 ? '撤离成功' : '撤离失败',
        gameTime: battle.gameTime,
        killPlayer: battle.killPlayer,
        killAi: battle.killAi,
        ProfitLoss: battle.ProfitLoss,
        gainedPrice: battle.gainedPrice,
        collectionPrice: battle.collectionPrice
      }))
    };
  }

  function getMapName(mapId) {
    const mapNames = {
      8101: '巴克什-机密文件',
      8102: '巴克什-重要物资',
      8103: '巴克什-男团',
      2201: '零号大坝-机密文件',
      2202: '零号大坝-重要物资',
      2211: '零号大坝-男团',
      2212: '零号大坝-实验室',
      2231: '零号大坝-大型物资',
      2232: '零号大坝-高价值目标',
      2233: '零号大坝-男团',
      2242: '零号大坝-实验室',
      1901: '长弓溪谷-机密文件',
      1902: '长弓溪谷-重要物资',
      1911: '长弓溪谷-男团',
      1912: '长弓溪谷-实验室',
      1999: '长弓溪谷-大型物资',
      3901: '航天基地-机密文件',
      3902: '航天基地-重要物资',
      8803: '潮汐监狱-机密文件'
    };
    return mapNames[mapId] || '地图' + (mapId || '');
  }

  function exportToJson() {
    const exportData = generateExportData(STATE.battleData, STATE.currentStats);
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `mosuight-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportToCsv() {
    if (STATE.battleData.length === 0) return;

    const headers = ['时间', '地图', '结果', '时长', '淘汰', '击杀', '盈亏', '总价值', '收集物'];
    
    const rows = STATE.battleData.map(battle => [
      new Date(battle.dtEventTime).toLocaleString('zh-CN'),
      getMapName(battle.mapId),
      parseInt(battle.gameResult) === 0 ? '撤离成功' : '撤离失败',
      battle.gameTime,
      battle.killPlayer || 0,
      battle.killAi || 0,
      battle.ProfitLoss || 0,
      battle.gainedPrice || 0,
      battle.collectionPrice || 0
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `mosuight-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function loadData() {
    showLoading();

    try {
      await window.calculateModule.loadRoleData();
      STATE.roleJson = window.calculateModule.roleJson;

      const dateRange = DOM.dateRangeSelect.value;
      const rawData = getCachedBattleList();
      const processedData = processBattleData(rawData);
      STATE.battleData = filterBattlesByDateRange(processedData, dateRange);

      if (STATE.battleData.length === 0) {
        hideLoading();
        return;
      }

      STATE.currentStats = calculateOverallStats(STATE.battleData);
      updateOverallStats(STATE.currentStats);

      initBattleTrendChart(STATE.battleData);
      initProfitTrendChart(STATE.battleData);
      initRoleDistributionChart(STATE.battleData);
      initMapStatsChart(STATE.battleData);

    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      hideLoading();
    }
  }

  function bindEventListeners() {
    DOM.dateRangeSelect.addEventListener('change', () => {
      loadData();
    });

    DOM.exportButton.addEventListener('click', () => {
      const exportType = prompt('请选择导出格式:\n1. JSON\n2. CSV\n请输入序号:', '1');
      
      if (exportType === '1') {
        exportToJson();
      } else if (exportType === '2') {
        exportToCsv();
      }
    });

    DOM.viewTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        switchView(tab.dataset.view);
      });
    });

    window.addEventListener('resize', () => {
      if (typeof echarts !== 'undefined') {
        DOM.battleTrendChart && echarts.getInstanceByDom(DOM.battleTrendChart)?.resize();
        DOM.profitTrendChart && echarts.getInstanceByDom(DOM.profitTrendChart)?.resize();
        DOM.roleDistributionChart && echarts.getInstanceByDom(DOM.roleDistributionChart)?.resize();
        DOM.mapStatsChart && echarts.getInstanceByDom(DOM.mapStatsChart)?.resize();
      }
    });
  }

  let DOM;

  function init() {
    DOM = initDomElements();
    bindEventListeners();
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
