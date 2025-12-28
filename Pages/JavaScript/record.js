/**
 * Mosuight Pro - 三角洲行动战绩分析助手
 * Record Page - 战绩记录页面脚本
 * 
 * 功能：
 * - 战绩数据列表展示
 * - 筛选和搜索功能
 * - 分页加载
 * - 详情跳转
 */

(function() {
  'use strict';

  const STATE = {
    battleData: [],
    filteredData: [],
    currentPage: 1,
    pageSize: 50,
    isLoading: false,
    filters: {
      gameResult: 'all',
      mapId: 'all',
      dateRange: 'all'
    },
    sortField: 'dtEventTime',
    sortOrder: 'desc'
  };

  const CACHE_KEY = 'mosuight_battle_list_cache';

  function initDomElements() {
    return {
      container: document.getElementById('record-container'),
      loadingIndicator: document.getElementById('loading-indicator'),
      emptyState: document.getElementById('empty-state'),
      loadMoreButton: document.getElementById('load-more-button'),
      totalStats: document.getElementById('total-stats'),
      filterForm: document.getElementById('filter-form'),
      gameResultFilter: document.getElementById('game-result-filter'),
      mapFilter: document.getElementById('map-filter'),
      dateRangeFilter: document.getElementById('date-range-filter'),
      searchInput: document.getElementById('search-input'),
      sortSelect: document.getElementById('sort-select')
    };
  }

  function showLoading() {
    STATE.isLoading = true;
    DOM.loadingIndicator.classList.remove('hidden');
  }

  function hideLoading() {
    STATE.isLoading = false;
    DOM.loadingIndicator.classList.add('hidden');
  }

  function showEmptyState() {
    hideLoading();
    DOM.emptyState.classList.remove('hidden');
    DOM.loadMoreButton.classList.add('hidden');
  }

  function hideEmptyState() {
    DOM.emptyState.classList.add('hidden');
  }

  function getCachedBattleList() {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
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

  function applyFilters(battles) {
    let result = [...battles];

    if (STATE.filters.gameResult !== 'all') {
      const targetResult = STATE.filters.gameResult === 'success' ? 0 : 1;
      result = result.filter(b => parseInt(b.gameResult) === targetResult);
    }

    if (STATE.filters.mapId !== 'all') {
      result = result.filter(b => String(b.mapId) === STATE.filters.mapId);
    }

    if (STATE.filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (STATE.filters.dateRange) {
        case 'today':
          cutoffDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setDate(now.getDate() - 30);
          break;
        case 'threeMonths':
          cutoffDate.setDate(now.getDate() - 90);
          break;
      }
      
      result = result.filter(b => new Date(b.dtEventTime) >= cutoffDate);
    }

    const searchKeyword = STATE.searchKeyword?.toLowerCase().trim();
    if (searchKeyword) {
      result = result.filter(b => {
        const mapName = getMapName(b.mapId).toLowerCase();
        return mapName.includes(searchKeyword) ||
               String(b.roomId).includes(searchKeyword);
      });
    }

    return result;
  }

  function sortBattles(battles) {
    const sorted = [...battles];
    
    sorted.sort((a, b) => {
      let valueA, valueB;
      
      switch (STATE.sortField) {
        case 'dtEventTime':
          valueA = new Date(a.dtEventTime).getTime();
          valueB = new Date(b.dtEventTime).getTime();
          break;
        case 'gameTime':
          valueA = parseInt(a.gameTime) || 0;
          valueB = parseInt(b.gameTime) || 0;
          break;
        case 'ProfitLoss':
          valueA = parseInt(a.ProfitLoss) || 0;
          valueB = parseInt(b.ProfitLoss) || 0;
          break;
        case 'killPlayer':
          valueA = parseInt(a.killPlayer) || 0;
          valueB = parseInt(b.killPlayer) || 0;
          break;
        default:
          valueA = new Date(a.dtEventTime).getTime();
          valueB = new Date(b.dtEventTime).getTime();
      }

      if (STATE.sortOrder === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });

    return sorted;
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

  function formatNumber(num) {
    if (num === null || num === undefined) {
      return '0';
    }
    const value = parseInt(num) || 0;
    if (value >= 10000) {
      return (value / 10000).toFixed(1) + '万';
    }
    return value.toLocaleString('zh-CN');
  }

  function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes + ':' + String(secs).padStart(2, '0');
  }

  function formatDateTime(timestamp) {
    const date = new Date(parseInt(timestamp) * 1000);
    return (date.getMonth() + 1) + '/' + date.getDate() + ' ' + 
           date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');
  }

  function renderBattleTable(pageData) {
    DOM.container.innerHTML = '';

    if (pageData.length === 0) {
      showEmptyState();
      return;
    }

    hideEmptyState();

    const table = document.createElement('table');
    table.className = 'record-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>时间</th>
          <th>地图</th>
          <th>结果</th>
          <th>时长</th>
          <th>淘汰</th>
          <th>击杀</th>
          <th>盈亏</th>
          <th>总价值</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${pageData.map(battle => `
          <tr data-room-id="${battle.roomId}">
            <td>${formatDateTime(battle.dtEventTime)}</td>
            <td>${getMapName(battle.mapId)}</td>
            <td>
              <span class="result-badge ${parseInt(battle.gameResult) === 0 ? 'success' : 'failure'}">
                ${parseInt(battle.gameResult) === 0 ? '撤离成功' : '撤离失败'}
              </span>
            </td>
            <td>${formatDuration(battle.gameTime)}</td>
            <td>${battle.killPlayer || 0}</td>
            <td>${battle.killAi || 0}</td>
            <td class="${parseInt(battle.ProfitLoss) >= 0 ? 'profit' : 'loss'}">
              ${formatNumber(battle.ProfitLoss)}
            </td>
            <td>${formatNumber(battle.gainedPrice)}</td>
            <td>
              <button class="detail-btn" data-room-id="${battle.roomId}">详情</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;

    table.querySelectorAll('.detail-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomId = btn.dataset.roomId;
        window.parent.postMessage({
          type: 'VIEW_BATTLE_DETAIL',
          roomId: roomId
        }, '*');
      });
    });

    table.querySelectorAll('tbody tr').forEach(row => {
      row.addEventListener('click', () => {
        const roomId = row.dataset.roomId;
        window.parent.postMessage({
          type: 'VIEW_BATTLE_DETAIL',
          roomId: roomId
        }, '*');
      });
    });

    DOM.container.appendChild(table);

    if (STATE.filteredData.length > STATE.currentPage * STATE.pageSize) {
      DOM.loadMoreButton.classList.remove('hidden');
    } else {
      DOM.loadMoreButton.classList.add('hidden');
    }
  }

  function updateStats() {
    const total = STATE.filteredData.length;
    const wins = STATE.filteredData.filter(b => parseInt(b.gameResult) === 0).length;
    const totalProfitLoss = STATE.filteredData.reduce((sum, b) => sum + (parseInt(b.ProfitLoss) || 0), 0);
    const avgKills = total > 0 
      ? (STATE.filteredData.reduce((sum, b) => sum + (parseInt(b.killPlayer) || 0), 0) / total).toFixed(1) 
      : '0';

    DOM.totalStats.innerHTML = `
      <span>总场次: ${total}</span>
      <span>胜率: ${total > 0 ? ((wins / total) * 100).toFixed(1) : 0}%</span>
      <span>总盈亏: <span class="${totalProfitLoss >= 0 ? 'profit' : 'loss'}">${formatNumber(totalProfitLoss)}</span></span>
      <span>场均淘汰: ${avgKills}</span>
    `;
  }

  function loadData() {
    showLoading();

    try {
      const rawData = getCachedBattleList();
      STATE.battleData = processBattleData(rawData);

      if (STATE.battleData.length === 0) {
        showEmptyState();
        hideLoading();
        return;
      }

      STATE.filteredData = applyFilters(STATE.battleData);
      STATE.filteredData = sortBattles(STATE.filteredData);

      updateStats();

      const startIndex = 0;
      const endIndex = STATE.currentPage * STATE.pageSize;
      const pageData = STATE.filteredData.slice(startIndex, endIndex);

      renderBattleTable(pageData);
    } catch (error) {
      console.error('加载数据失败:', error);
      showEmptyState();
    } finally {
      hideLoading();
    }
  }

  function loadMore() {
    if (STATE.isLoading) return;

    STATE.currentPage++;
    const startIndex = (STATE.currentPage - 1) * STATE.pageSize;
    const endIndex = STATE.currentPage * STATE.pageSize;
    const pageData = STATE.filteredData.slice(startIndex, endIndex);

    const existingTable = DOM.container.querySelector('table');
    if (!existingTable) {
      renderBattleTable(pageData);
      return;
    }

    const tbody = existingTable.querySelector('tbody');
    tbody.innerHTML += pageData.map(battle => `
      <tr data-room-id="${battle.roomId}">
        <td>${formatDateTime(battle.dtEventTime)}</td>
        <td>${getMapName(battle.mapId)}</td>
        <td>
          <span class="result-badge ${parseInt(battle.gameResult) === 0 ? 'success' : 'failure'}">
            ${parseInt(battle.gameResult) === 0 ? '撤离成功' : '撤离失败'}
          </span>
        </td>
        <td>${formatDuration(battle.gameTime)}</td>
        <td>${battle.killPlayer || 0}</td>
        <td>${battle.killAi || 0}</td>
        <td class="${parseInt(battle.ProfitLoss) >= 0 ? 'profit' : 'loss'}">
          ${formatNumber(battle.ProfitLoss)}
        </td>
        <td>${formatNumber(battle.gainedPrice)}</td>
        <td>
          <button class="detail-btn" data-room-id="${battle.roomId}">详情</button>
        </td>
      </tr>
    `).join('');

    existingTable.querySelectorAll('.detail-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomId = btn.dataset.roomId;
        window.parent.postMessage({
          type: 'VIEW_BATTLE_DETAIL',
          roomId: roomId
        }, '*');
      });
    });

    if (STATE.filteredData.length <= endIndex) {
      DOM.loadMoreButton.classList.add('hidden');
    }
  }

  function applyFiltersAndReload() {
    STATE.currentPage = 1;
    STATE.filteredData = applyFilters(STATE.battleData);
    STATE.filteredData = sortBattles(STATE.filteredData);
    
    updateStats();
    
    const pageData = STATE.filteredData.slice(0, STATE.pageSize);
    renderBattleTable(pageData);
  }

  function bindEventListeners() {
    DOM.gameResultFilter.addEventListener('change', (e) => {
      STATE.filters.gameResult = e.target.value;
      applyFiltersAndReload();
    });

    DOM.mapFilter.addEventListener('change', (e) => {
      STATE.filters.mapId = e.target.value;
      applyFiltersAndReload();
    });

    DOM.dateRangeFilter.addEventListener('change', (e) => {
      STATE.filters.dateRange = e.target.value;
      applyFiltersAndReload();
    });

    DOM.searchInput.addEventListener('input', (e) => {
      STATE.searchKeyword = e.target.value;
      applyFiltersAndReload();
    });

    DOM.sortSelect.addEventListener('change', (e) => {
      const [field, order] = e.target.value.split('-');
      STATE.sortField = field;
      STATE.sortOrder = order;
      STATE.filteredData = sortBattles(STATE.filteredData);
      STATE.currentPage = 1;
      const pageData = STATE.filteredData.slice(0, STATE.pageSize);
      renderBattleTable(pageData);
    });

    DOM.loadMoreButton.addEventListener('click', loadMore);
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
