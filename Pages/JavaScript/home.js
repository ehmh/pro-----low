/**
 * Mosuight Pro - 三角洲行动战绩分析助手
 * Home Page - 首页脚本
 * 
 * 功能：
 * - 主页数据展示
 * - 战绩列表管理
 * - 战斗数据请求与处理
 */

(function() {
  'use strict';

  const STATE = {
    battleHistory: [],
    currentPage: 1,
    pageSize: 20,
    isLoading: false,
    hasMoreData: true,
    battleListCache: null,
    userSessionInfo: null,
    lastBattleTime: null,
    battleCount: 0
  };

  const CACHE_KEY = 'mosuight_battle_list_cache';

  function initDomElements() {
    return {
      battleListContainer: document.getElementById('battle-list-container'),
      loadingIndicator: document.getElementById('loading-indicator'),
      loadMoreButton: document.getElementById('load-more-button'),
      emptyState: document.getElementById('empty-state'),
      noMoreData: document.getElementById('no-more-data'),
      refreshButton: document.getElementById('refresh-button'),
      dataCount: document.getElementById('data-count')
    };
  }

  function showLoading() {
    STATE.isLoading = true;
    if (STATE.currentPage === 1) {
      DOM.loadingIndicator.classList.remove('hidden');
      DOM.emptyState.classList.add('hidden');
      DOM.battleListContainer.innerHTML = '';
    }
  }

  function hideLoading() {
    STATE.isLoading = false;
    DOM.loadingIndicator.classList.add('hidden');
  }

  function showEmptyState() {
    hideLoading();
    DOM.emptyState.classList.remove('hidden');
    DOM.loadMoreButton.classList.add('hidden');
    DOM.noMoreData.classList.add('hidden');
  }

  function showNoMoreData() {
    hideLoading();
    DOM.loadMoreButton.classList.add('hidden');
    DOM.noMoreData.classList.remove('hidden');
  }

  function updateDataCount() {
    DOM.dataCount.textContent = '共 ' + STATE.battleCount + ' 条记录';
  }

  function getCachedBattleList() {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached && cached.sols && Array.isArray(cached.sols)) {
        return cached;
      }
    } catch (e) {
      console.error('读取缓存失败:', e);
    }
    return null;
  }

  function saveBattleListToCache(battleList, lastBattleTime) {
    try {
      const cacheData = {
        sols: battleList,
        lastUpdateTime: new Date().toISOString(),
        lastBattleTime: lastBattleTime
      };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.error('保存缓存失败:', e);
    }
  }

  function requestBattleListFromParent(page, pageSize) {
    return new Promise((resolve, reject) => {
      if (window.parent) {
        window.parent.postMessage({
          type: 'GET_BATTLE_LIST',
          params: {
            size: pageSize,
            after: page === 1 ? null : STATE.lastBattleTime
          }
        }, '*');
        
        const timeoutId = setTimeout(() => {
          reject(new Error('请求超时'));
        }, 30000);
        
        window._battleListResolver = {
          resolve: (result) => {
            clearTimeout(timeoutId);
            resolve(result);
            window._battleListResolver = null;
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            reject(error);
            window._battleListResolver = null;
          }
        };
      } else {
        reject(new Error('无法访问父窗口'));
      }
    });
  }

  async function fetchBattleList(page) {
    if (STATE.isLoading) {
      return null;
    }

    showLoading();

    try {
      const cached = getCachedBattleList();
      
      if (cached && page === 1) {
        const sortedBattles = [...cached.sols].sort((a, b) => 
          new Date(b.dtEventTime) - new Date(a.dtEventTime)
        );
        
        STATE.battleHistory = sortedBattles;
        STATE.battleCount = sortedBattles.length;
        STATE.lastBattleTime = cached.lastBattleTime;
        
        updateDataCount();
        hideLoading();
        
        renderBattleList(sortedBattles);
        
        if (sortedBattles.length >= STATE.pageSize) {
          STATE.currentPage = 1;
          STATE.hasMoreData = true;
          DOM.loadMoreButton.classList.remove('hidden');
        } else {
          showNoMoreData();
        }
        
        return sortedBattles;
      }

      const response = await requestBattleListFromParent(page, STATE.pageSize);
      
      if (response && response.success && response.data?.sols) {
        const newBattles = response.data.sols;
        
        if (page === 1) {
          STATE.battleHistory = newBattles;
        } else {
          STATE.battleHistory = [...STATE.battleHistory, ...newBattles];
        }

        STATE.battleCount = STATE.battleHistory.length;
        
        if (newBattles.length > 0) {
          const lastBattle = newBattles[newBattles.length - 1];
          STATE.lastBattleTime = lastBattle.dtEventTime;
        }

        updateDataCount();
        saveBattleListToCache(STATE.battleHistory, STATE.lastBattleTime);
        
        hideLoading();
        renderBattleList(STATE.battleHistory);
        
        if (newBattles.length >= STATE.pageSize) {
          STATE.hasMoreData = true;
          DOM.loadMoreButton.classList.remove('hidden');
        } else {
          showNoMoreData();
        }
        
        return STATE.battleHistory;
      } else {
        throw new Error(response?.error || '获取战斗列表失败');
      }
    } catch (error) {
      console.error('获取战斗列表失败:', error);
      hideLoading();
      
      if (page === 1 && STATE.battleHistory.length === 0) {
        showEmptyState();
      }
      
      return null;
    }
  }

  function renderBattleList(battles) {
    DOM.battleListContainer.innerHTML = '';

    if (!battles || battles.length === 0) {
      showEmptyState();
      return;
    }

    const fragment = document.createDocumentFragment();

    battles.forEach(battle => {
      const battleCard = createBattleCard(battle);
      fragment.appendChild(battleCard);
    });

    DOM.battleListContainer.appendChild(fragment);

    if (battles.length > 0) {
      DOM.loadMoreButton.classList.remove('hidden');
    }
  }

  function createBattleCard(battle) {
    const card = document.createElement('div');
    card.className = 'battle-card';
    card.dataset.roomId = battle.roomId;

    const resultClass = parseInt(battle.gameResult) === 0 ? 'result-success' : 'result-failure';
    const resultText = parseInt(battle.gameResult) === 0 ? '撤离成功' : '撤离失败';

    const date = new Date(battle.dtEventTime);
    const dateStr = (date.getMonth() + 1) + '/' + date.getDate() + ' ' + 
                    date.getHours() + ':' + String(date.getMinutes()).padStart(2, '0');

    const gameTime = parseInt(battle.gameTime) || 0;
    const gameTimeStr = Math.floor(gameTime / 60) + ':' + String(gameTime % 60).padStart(2, '0');

    card.innerHTML = `
      <div class="battle-header">
        <span class="battle-date">${dateStr}</span>
        <span class="battle-result ${resultClass}">${resultText}</span>
      </div>
      <div class="battle-info">
        <div class="battle-map">
          <span class="map-label">地图</span>
          <span class="map-name">${getMapName(battle.mapId)}</span>
        </div>
        <div class="battle-duration">
          <span class="duration-label">时长</span>
          <span class="duration-value">${gameTimeStr}</span>
        </div>
      </div>
      <div class="battle-stats">
        <div class="stat-item">
          <span class="stat-value">${formatNumber(battle.killPlayer) || 0}</span>
          <span class="stat-label">淘汰</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${formatNumber(battle.killAi) || 0}</span>
          <span class="stat-label">击杀</span>
        </div>
        <div class="stat-item">
          <span class="stat-value ${parseInt(battle.ProfitLoss) >= 0 ? 'profit' : 'loss'}">${formatNumber(battle.ProfitLoss)}</span>
          <span class="stat-label">盈亏</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${formatNumber(battle.gainedPrice)}</span>
          <span class="stat-label">总价值</span>
        </div>
      </div>
      <div class="battle-collections">
        <span class="collections-label">收集物</span>
        <span class="collections-value">${formatNumber(battle.collectionPrice)}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      window.parent.postMessage({
        type: 'VIEW_BATTLE_DETAIL',
        roomId: battle.roomId
      }, '*');
    });

    return card;
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

  function handleMessage(event) {
    switch (event.data?.type) {
      case 'BATTLE_LIST_RESULT':
        if (window._battleListResolver) {
          if (event.data.success) {
            window._battleListResolver.resolve(event.data);
          } else {
            window._battleListResolver.reject(new Error(event.data.error));
          }
        }
        break;
    }
  }

  async function loadMoreBattles() {
    if (STATE.isLoading || !STATE.hasMoreData) {
      return;
    }

    STATE.currentPage++;
    await fetchBattleList(STATE.currentPage);
  }

  async function refreshData() {
    STATE.currentPage = 1;
    STATE.hasMoreData = true;
    STATE.battleHistory = [];
    STATE.lastBattleTime = null;
    
    DOM.loadMoreButton.classList.add('hidden');
    DOM.noMoreData.classList.add('hidden');
    
    await fetchBattleList(1);
  }

  function bindEventListeners() {
    DOM.refreshButton.addEventListener('click', refreshData);
    DOM.loadMoreButton.addEventListener('click', loadMoreBattles);
    window.addEventListener('message', handleMessage);
  }

  let DOM;

  async function init() {
    DOM = initDomElements();
    bindEventListeners();
    await fetchBattleList(1);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
