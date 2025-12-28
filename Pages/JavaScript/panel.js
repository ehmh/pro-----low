/**
 * Mosuight Pro - 三角洲行动战绩分析助手
 * Panel Page - 数据面板页面脚本
 * 
 * 功能：
 * - 用户信息展示
 * - 战斗统计图表
 * - 角色使用统计
 * - 地图战绩分析
 * - 趋势图表展示
 */

(function() {
  'use strict';

  const STATE = {
    battleData: [],
    roleJson: null,
    userInfo: null,
    userTag: null,
    expiryDate: null,
    isRefreshing: false
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

  const CHART_THEME = {
    color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'],
    textStyle: {
      fontFamily: 'Microsoft YaHei, sans-serif'
    }
  };

  function initDomElements() {
    return {
      userTag: document.getElementById('user-tag'),
      expiryDate: document.getElementById('expiry-date'),
      vipBadge: document.getElementById('vip-badge'),
      battleCount: document.getElementById('battle-count'),
      winRate: document.getElementById('win-rate'),
      totalProfitLoss: document.getElementById('total-profit-loss'),
      avgGameTime: document.getElementById('avg-game-time'),
      refreshButton: document.getElementById('refresh-button'),
      logoutButton: document.getElementById('logout-button'),
      loadingOverlay: document.getElementById('loading-overlay'),
      tabButtons: document.querySelectorAll('.tab-btn'),
      tabContents: document.querySelectorAll('.tab-content'),
      roleChart: document.getElementById('role-chart'),
      mapChart: document.getElementById('map-chart'),
      performanceChart: document.getElementById('performance-chart'),
      qualityChart: document.getElementById('quality-chart'),
      roleUsageList: document.getElementById('role-usage-list'),
      recentBattlesList: document.getElementById('recent-battles-list'),
      environmentBadge: document.getElementById('environment-badge')
    };
  }

  function showLoading() {
    STATE.isRefreshing = true;
    DOM.loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    STATE.isRefreshing = false;
    DOM.loadingOverlay.classList.add('hidden');
  }

  function switchTab(tabName) {
    DOM.tabButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      }
    });
    DOM.tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === tabName + '-tab') {
        content.classList.add('active');
      }
    });
  }

  function formatDate(timestamp) {
    const date = new Date(parseInt(timestamp) * 1000);
    return (date.getMonth() + 1) + '/' + date.getDate() + ' ' + 
           date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
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

  function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes + '分' + secs + '秒';
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
    let validTimeCount = 0;

    battles.forEach(battle => {
      totalProfitLoss += parseInt(battle.ProfitLoss) || 0;
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
      avgGameTime
    };
  }

  function updateUserInfoDisplay() {
    DOM.userTag.textContent = STATE.userTag || '普通用户';
    
    if (STATE.expiryDate) {
      DOM.expiryDate.textContent = '有效期至: ' + formatDate(STATE.expiryDate);
      DOM.expiryDate.classList.remove('hidden');
    } else {
      DOM.expiryDate.classList.add('hidden');
    }

    if (STATE.userTag && STATE.userTag !== '普通用户') {
      DOM.vipBadge.classList.remove('hidden');
    } else {
      DOM.vipBadge.classList.add('hidden');
    }
  }

  function updateOverallStats(stats) {
    DOM.battleCount.textContent = stats.totalBattles;
    DOM.winRate.textContent = stats.winRate + '%';
    
    const profitLossElement = DOM.totalProfitLoss;
    profitLossElement.textContent = formatNumber(stats.totalProfitLoss);
    profitLossElement.className = stats.totalProfitLoss >= 0 ? 'stat-value profit' : 'stat-value loss';
    
    DOM.avgGameTime.textContent = formatDuration(stats.avgGameTime);
  }

  function initCharts(battles) {
    if (typeof echarts === 'undefined') {
      console.warn('ECharts 未加载');
      return;
    }

    initRoleChart(battles);
    initMapChart(battles);
    initPerformanceChart(battles);
    initQualityChart(battles);
  }

  function initRoleChart(battles) {
    if (!DOM.roleChart || typeof echarts === 'undefined') return;

    const roleUsage = window.calculateModule.calculateCharacterUsage(
      battles, 
      window.calculateModule.roleJson?.data || {}
    );

    const chart = echarts.init(DOM.roleChart);
    const data = roleUsage.slice(0, 8);

    const option = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: {
          fontSize: 12
        }
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
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
            color: CHART_THEME.color[index % CHART_THEME.color.length]
          }
        }))
      }]
    };

    chart.setOption(option);
  }

  function initMapChart(battles) {
    if (!DOM.mapChart || typeof echarts === 'undefined') return;

    const mapStats = window.calculateModule.calculateMapStats(battles);

    const chart = echarts.init(DOM.mapChart);

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: ['撤离率', '金物品率', '红物品率'],
        axisLabel: {
          fontSize: 12
        }
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          formatter: '{value}%',
          fontSize: 12
        }
      },
      series: [{
        name: '占比',
        type: 'bar',
        barWidth: '40%',
        data: [
          {
            value: mapStats.evacuationRate.toFixed(1),
            itemStyle: { color: CHART_COLORS.success }
          },
          {
            value: mapStats.goldItemRate.toFixed(1),
            itemStyle: { color: CHART_COLORS.warning }
          },
          {
            value: mapStats.redItemRate.toFixed(1),
            itemStyle: { color: CHART_COLORS.danger }
          }
        ]
      }]
    };

    chart.setOption(option);
  }

  function initPerformanceChart(battles) {
    if (!DOM.performanceChart || typeof echarts === 'undefined') return;

    const performanceData = window.calculateModule.calculatePlayerPerformanceTrend(battles);
    const qualityData = window.calculateModule.calculateMatchQualityScoreTrend(battles);

    const chart = echarts.init(DOM.performanceChart);

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['表现分', '质量分'],
        top: 0,
        textStyle: { fontSize: 12 }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: performanceData.xAxisData,
        axisLabel: {
          fontSize: 10,
          rotate: 30
        }
      },
      yAxis: {
        type: 'value',
        min: 1000,
        axisLabel: { fontSize: 11 }
      },
      series: [
        {
          name: '表现分',
          type: 'line',
          data: performanceData.performanceData,
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { color: CHART_COLORS.primary },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
                { offset: 1, color: 'rgba(64, 158, 255, 0.05)' }
              ]
            }
          }
        },
        {
          name: '质量分',
          type: 'line',
          data: qualityData.qualityScoreData,
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { color: CHART_COLORS.success }
        }
      ]
    };

    chart.setOption(option);
  }

  function initQualityChart(battles) {
    if (!DOM.qualityChart || typeof echarts === 'undefined') return;

    const performanceData = window.calculateModule.calculatePlayerPerformanceTrend(battles);

    const chart = echarts.init(DOM.qualityChart);

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['表现分', '趋势分'],
        top: 0,
        textStyle: { fontSize: 12 }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: performanceData.xAxisData,
        axisLabel: {
          fontSize: 10,
          rotate: 30
        }
      },
      yAxis: {
        type: 'value',
        min: 1000,
        axisLabel: { fontSize: 11 }
      },
      series: [
        {
          name: '表现分',
          type: 'line',
          data: performanceData.performanceData,
          smooth: true,
          lineStyle: { width: 2 },
          itemStyle: { color: CHART_COLORS.primary }
        },
        {
          name: '趋势分',
          type: 'line',
          data: performanceData.trendScoreData,
          smooth: true,
          lineStyle: { width: 2, type: 'dashed' },
          itemStyle: { color: CHART_COLORS.warning }
        }
      ]
    };

    chart.setOption(option);
  }

  function renderRoleUsageList(battles) {
    const roleUsage = window.calculateModule.calculateCharacterUsage(
      battles,
      window.calculateModule.roleJson?.data || {}
    );

    DOM.roleUsageList.innerHTML = '';

    roleUsage.slice(0, 8).forEach(role => {
      const roleItem = document.createElement('div');
      roleItem.className = 'role-usage-item';
      roleItem.innerHTML = `
        <div class="role-info">
          <span class="role-name">${role.name}</span>
          <span class="role-count">${role.value}次</span>
        </div>
        <div class="role-progress">
          <div class="role-progress-bar" style="width: ${role.percentage}%"></div>
        </div>
        <span class="role-percentage">${role.percentage}%</span>
      `;
      DOM.roleUsageList.appendChild(roleItem);
    });
  }

  function renderRecentBattles(battles) {
    DOM.recentBattlesList.innerHTML = '';

    const recentBattles = battles.slice(0, 5);

    if (recentBattles.length === 0) {
      DOM.recentBattlesList.innerHTML = '<div class="empty-message">暂无战斗记录</div>';
      return;
    }

    recentBattles.forEach(battle => {
      const battleItem = document.createElement('div');
      battleItem.className = 'battle-item';
      
      const resultClass = parseInt(battle.gameResult) === 0 ? 'success' : 'failure';
      const resultText = parseInt(battle.gameResult) === 0 ? '撤离成功' : '撤离失败';

      battleItem.innerHTML = `
        <div class="battle-item-header">
          <span class="battle-time">${formatDate(battle.dtEventTime)}</span>
          <span class="battle-result ${resultClass}">${resultText}</span>
        </div>
        <div class="battle-item-info">
          <span class="battle-map">${getMapName(battle.mapId)}</span>
          <span class="battle-kda">淘汰:${battle.killPlayer || 0} 击杀:${battle.killAi || 0}</span>
        </div>
        <div class="battle-item-stats">
          <span class="stat profit-loss ${parseInt(battle.ProfitLoss) >= 0 ? 'profit' : 'loss'}">
            ${formatNumber(battle.ProfitLoss)}
          </span>
        </div>
      `;

      battleItem.addEventListener('click', () => {
        window.parent.postMessage({
          type: 'VIEW_BATTLE_DETAIL',
          roomId: battle.roomId
        }, '*');
      });

      DOM.recentBattlesList.appendChild(battleItem);
    });
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

  function updateBattleEnvironment(battles) {
    const environment = window.calculateModule.calculateBattleEnvironment(battles);
    
    const environmentClasses = {
      '低压局': 'environment-easy',
      '普通局': 'environment-normal',
      '压力局': 'environment-hard',
      '高压局': 'environment-extreme'
    };

    DOM.environmentBadge.textContent = environment.environmentType;
    DOM.environmentBadge.className = 'environment-badge ' + (environmentClasses[environment.environmentType] || 'environment-normal');
  }

  async function loadData() {
    showLoading();

    try {
      await window.calculateModule.loadRoleData();
      STATE.roleJson = window.calculateModule.roleJson;

      STATE.battleData = processBattleData(getCachedBattleList());

      if (STATE.battleData.length === 0) {
        await requestUserInfoAndBattles();
        STATE.battleData = processBattleData(getCachedBattleList());
      }

      if (STATE.battleData.length > 0) {
        const stats = calculateOverallStats(STATE.battleData);
        updateOverallStats(stats);
        initCharts(STATE.battleData);
        renderRoleUsageList(STATE.battleData);
        renderRecentBattles(STATE.battleData);
        updateBattleEnvironment(STATE.battleData);
      }

      updateUserInfoDisplay();
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      hideLoading();
    }
  }

  function requestUserInfoAndBattles() {
    return new Promise((resolve) => {
      if (window.parent) {
        window.parent.postMessage({ type: 'GET_USER_ROLE_INFO' }, '*');
        
        window._userInfoResolver = (event) => {
          if (event.data?.type === 'USER_ROLE_INFO_RESULT') {
            if (event.data.data?.mosuight_info) {
              STATE.userInfo = event.data.data;
              STATE.userTag = event.data.data.mosuight_info.user_tag;
              STATE.expiryDate = event.data.data.mosuight_info.expiry_date;
            }
            window.removeEventListener('message', window._userInfoResolver);
            window._userInfoResolver = null;
            resolve();
          }
        };
        window.addEventListener('message', window._userInfoResolver);
      } else {
        resolve();
      }
    });
  }

  async function refreshData() {
    if (STATE.isRefreshing) return;

    STATE.battleData = [];
    DOM.roleChart && echarts.getInstanceByDom(DOM.roleChart)?.dispose();
    DOM.mapChart && echarts.getInstanceByDom(DOM.mapChart)?.dispose();
    DOM.performanceChart && echarts.getInstanceByDom(DOM.performanceChart)?.dispose();
    DOM.qualityChart && echarts.getInstanceByDom(DOM.qualityChart)?.dispose();

    await loadData();
  }

  function handleMessage(event) {
    switch (event.data?.type) {
      case 'USER_ROLE_INFO_RESULT':
        if (window._userInfoResolver) {
          window._userInfoResolver(event);
        }
        break;
      case 'REFRESH_DATA':
        refreshData();
        break;
    }
  }

  function logout() {
    if (window.parent) {
      window.parent.postMessage({ type: 'LOGOUT' }, '*');
    }
  }

  function bindEventListeners() {
    DOM.refreshButton.addEventListener('click', refreshData);
    DOM.logoutButton.addEventListener('click', logout);
    
    DOM.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab);
      });
    });

    window.addEventListener('message', handleMessage);

    window.addEventListener('resize', () => {
      if (typeof echarts !== 'undefined') {
        DOM.roleChart && echarts.getInstanceByDom(DOM.roleChart)?.resize();
        DOM.mapChart && echarts.getInstanceByDom(DOM.mapChart)?.resize();
        DOM.performanceChart && echarts.getInstanceByDom(DOM.performanceChart)?.resize();
        DOM.qualityChart && echarts.getInstanceByDom(DOM.qualityChart)?.resize();
      }
    });
  }

  let DOM;

  async function init() {
    DOM = initDomElements();
    bindEventListeners();
    await loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
