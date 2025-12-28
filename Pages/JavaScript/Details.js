/**
 * Mosuight Pro - 三角洲行动战绩分析助手
 * Details Page - 战斗详情页面脚本
 * 
 * 功能：
 * - 显示战斗详情信息
 * - 渲染玩家数据卡片
 * - 同局玩家数据查询
 */

(function() {
  'use strict';

  const STATE = {
    currentOpenid: null,
    currentUserTag: null,
    currentRoomId: null,
    mapDataCache: null,
    roleDataCache: null,
    battleDetailData: null
  };

  const DOM_ELEMENTS = {};

  function initDomElements() {
    DOM_ELEMENTS.loadingIndicator = document.getElementById('loading-indicator');
    DOM_ELEMENTS.errorMessage = document.getElementById('error-message');
    DOM_ELEMENTS.errorText = document.getElementById('error-text');
    DOM_ELEMENTS.emptyState = document.getElementById('empty-state');
    DOM_ELEMENTS.battleDetails = document.getElementById('battle-details');
    DOM_ELEMENTS.roomIdElement = document.getElementById('room-id');
    DOM_ELEMENTS.mapIdElement = document.getElementById('map-id');
    DOM_ELEMENTS.gameModeElement = document.getElementById('game-mode');
    DOM_ELEMENTS.startTimeElement = document.getElementById('start-time');
    DOM_ELEMENTS.gameDurationElement = document.getElementById('game-duration');
    DOM_ELEMENTS.myBattleDataElement = document.getElementById('my-battle-data');
    DOM_ELEMENTS.teamMembersDataElement = document.getElementById('team-members-data');
    DOM_ELEMENTS.playerCardTemplate = document.getElementById('player-card-template');
    DOM_ELEMENTS.backButton = document.getElementById('back-button');
  }

  function formatGameTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes + ':' + String(secs).padStart(2, '0');
  }

  function formatNumber(num) {
    return parseInt(num || 0).toLocaleString();
  }

  function formatDate(timestamp) {
    return new Date(parseInt(timestamp) * 1000).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function getMapNameByIdSync(mapId) {
    return STATE.mapDataCache?.[mapId] || '地图' + mapId || '-';
  }

  async function loadMapData() {
    try {
      const response = await fetch('../../Asset/Resource/Dictionary/MapID.Json');
      STATE.mapDataCache = await response.json();
    } catch (error) {
      console.error('加载地图数据失败:', error);
      STATE.mapDataCache = {};
    }
  }

  async function loadRoleData() {
    try {
      const response = await fetch('../../Asset/Resource/Dictionary/Role.Json');
      STATE.roleDataCache = await response.json();
    } catch (error) {
      console.error('加载角色数据失败:', error);
      STATE.roleDataCache = {};
    }
  }

  async function fetchSameGamePlayers(roomId) {
    return new Promise((resolve, reject) => {
      if (chrome && chrome.runtime) {
        const message = {
          type: 'GET_SAME_GAME_PLAYERS',
          data: {
            PsType: 'chromeData',
            roomId: roomId
          }
        };
        chrome.runtime.sendMessage(message, (response) => {
          if (response && response.success) {
            resolve(response.data || []);
          } else {
            reject(new Error(response?.error || '获取同局玩家数据失败'));
          }
        });
      } else {
        reject(new Error('Chrome插件API不可用'));
      }
    });
  }

  function requestBattleDetail(roomId) {
    if (window.parent) {
      window.parent.postMessage({
        type: 'GET_BATTLE_DETAIL',
        params: { roomId }
      }, '*');
    } else {
      showError('无法访问父窗口');
    }
  }

  function handleUserInfoResult(data) {
    if (data && data.success && data.data) {
      STATE.currentOpenid = data.data.openid;
      STATE.currentUserTag = data.data.userTag;
      requestBattleDetail(STATE.currentRoomId);
      if (STATE.battleDetailData) {
        hideLoading();
        renderBattleDetails(STATE.battleDetailData);
      }
    } else {
      hideLoading();
      showError(data.error || '获取用户信息失败');
    }
  }

  function createPlayerCard(player, isCurrentUser = false) {
    const card = DOM_ELEMENTS.playerCardTemplate.content.cloneNode(true);
    const cardElement = card.querySelector('.player-card');

    if (isCurrentUser) {
      cardElement.classList.add('current-user');
    }

    card.querySelector('.player-name').textContent = player.name || '未知玩家';
    
    const roleName = player.armedForceId 
      ? STATE.roleDataCache?.[player.armedForceId] || '角色' + player.armedForceId 
      : '未知角色';
    card.querySelector('.player-tag').textContent = roleName;

    const resultElement = card.querySelector('.player-result');
    resultElement.textContent = player.gameResult === 0 ? '撤离成功' : '撤离失败';
    resultElement.className = 'player-result ' + (player.gameResult === 0 ? 'win' : 'lose');

    const statsContainer = card.querySelector('.stats-cards-container');
    const statsItems = [
      { label: '战斗时长', value: formatGameTime(player.gameTime) },
      { label: '总价值', value: formatNumber(player.gainedPrice), isProfit: true },
      { label: '盈亏数据', value: formatNumber(player.ProfitLoss), isProfit: true, isLoss: parseInt(player.ProfitLoss) < 0 },
      { label: '收集物总价值', value: formatNumber(player.collectionPrice), isProfit: true },
      { label: '带入装备价值', value: formatNumber(player.originalEquipmentPriceWithoutKeyChain), isProfit: true },
      { label: '带出队友物资', value: formatNumber(player.teammatePrice), isProfit: true },
      { label: '击杀玩家数量', value: player.killPlayer || 0 }
    ];

    if (player.hasBlueBox) {
      statsItems.push({ label: '曼德尔砖', value: '有' });
    }

    statsContainer.innerHTML = '';
    statsItems.forEach(item => {
      const statCard = document.createElement('div');
      statCard.className = 'stat-card';
      
      const labelElement = document.createElement('div');
      labelElement.className = 'stat-label';
      labelElement.textContent = item.label;
      
      const valueElement = document.createElement('div');
      valueElement.className = 'stat-value';
      valueElement.textContent = item.value;
      
      if (item.isProfit) {
        if (item.isLoss) {
          valueElement.classList.add('loss');
        } else {
          valueElement.classList.add('profit');
        }
      }
      
      statCard.appendChild(labelElement);
      statCard.appendChild(valueElement);
      statsContainer.appendChild(statCard);
    });

    return cardElement;
  }

  function renderBattleDetails(battleData) {
    if (!battleData.battle_detail) {
      showEmptyState();
      return;
    }

    const players = battleData.battle_detail.sol_players || [];
    const currentPlayerData = players[0];
    const myData = players.find(p => {
      const playerIdStr = String(p.playerId || '');
      const vopenidStr = String(p.vopenid || '');
      const openidStr = String(STATE.currentOpenid || '');
      return playerIdStr === openidStr || vopenidStr === openidStr;
    });

    DOM_ELEMENTS.roomIdElement.textContent = currentPlayerData?.roomId || '--';
    
    if (currentPlayerData?.mapId) {
      const mapName = getMapNameByIdSync(currentPlayerData.mapId);
      const mapParts = mapName.split('-');
      if (mapParts.length >= 2) {
        DOM_ELEMENTS.mapIdElement.textContent = mapParts[0];
        DOM_ELEMENTS.gameModeElement.textContent = mapParts.slice(1).join('-');
      } else {
        DOM_ELEMENTS.mapIdElement.textContent = mapName;
        DOM_ELEMENTS.gameModeElement.textContent = currentPlayerData?.gameMode === 1 ? '战术模式' : '其他模式';
      }
    } else {
      DOM_ELEMENTS.mapIdElement.textContent = '--';
      DOM_ELEMENTS.gameModeElement.textContent = '--';
    }

    DOM_ELEMENTS.startTimeElement.textContent = currentPlayerData?.startTime ? formatDate(currentPlayerData.startTime) : '--';
    DOM_ELEMENTS.gameDurationElement.textContent = currentPlayerData?.gameTime ? formatGameTime(currentPlayerData.gameTime) : '--';

    DOM_ELEMENTS.myBattleDataElement.innerHTML = '';
    if (myData) {
      const playerCard = createPlayerCard(myData, true);
      DOM_ELEMENTS.myBattleDataElement.appendChild(playerCard);
    } else {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = '未找到您的战斗数据';
      DOM_ELEMENTS.myBattleDataElement.appendChild(emptyMessage);
    }

    DOM_ELEMENTS.teamMembersDataElement.innerHTML = '';
    const otherPlayers = players.filter(p => {
      const playerIdStr = String(p.playerId || '');
      const vopenidStr = String(p.vopenid || '');
      const openidStr = String(STATE.currentOpenid || '');
      return playerIdStr !== openidStr && vopenidStr !== openidStr;
    });

    if (otherPlayers.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = '没有其他玩家数据';
      DOM_ELEMENTS.teamMembersDataElement.appendChild(emptyMessage);
    } else {
      const teams = {};
      otherPlayers.forEach(player => {
        const teamId = String(player.teamId || 'unknown');
        if (!teams[teamId]) {
          teams[teamId] = [];
        }
        teams[teamId].push(player);
      });

      Object.entries(teams).forEach(([teamId, teamPlayers]) => {
        const teamContainer = document.createElement('div');
        teamContainer.className = 'team-container';
        
        const teamTitle = document.createElement('div');
        teamTitle.className = 'team-title';
        teamTitle.textContent = '队伍 ' + (teamId === 'unknown' ? '未知' : teamId);
        
        const playersContainer = document.createElement('div');
        playersContainer.className = 'players-container';
        
        teamPlayers.forEach(player => {
          const playerCard = createPlayerCard(player, false);
          playersContainer.appendChild(playerCard);
        });

        teamContainer.appendChild(teamTitle);
        teamContainer.appendChild(playersContainer);
        DOM_ELEMENTS.teamMembersDataElement.appendChild(teamContainer);
      });
    }

    DOM_ELEMENTS.battleDetails.classList.remove('display-none');
    DOM_ELEMENTS.battleDetails.classList.add('display-block');

    sendBattleDataToBackground(battleData);
  }

  function sendBattleDataToBackground(battleData) {
    if (!battleData.battle_detail) {
      return;
    }

    const players = battleData.battle_detail.sol_players || [];
    const firstPlayer = players[0];

    if (!firstPlayer?.roomId) {
      return;
    }

    const battleDataPayload = {
      roomId: firstPlayer.roomId,
      teamId: 1,
      Details: []
    };

    players.forEach(player => {
      if (player.name) {
        battleDataPayload.Details.push({
          name: player.name,
          originalEquipmentPriceWithoutKeyChain: parseInt(player.originalEquipmentPriceWithoutKeyChain) || 0,
          gainedPrice: String(player.gainedPrice || 0),
          ProfitLoss: parseInt(player.ProfitLoss) || 0,
          collectionPrice: String(player.collectionPrice || 0)
        });
      }
    });

    if (chrome && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'BATTLE_DETAILS_DATA',
        data: battleDataPayload
      }, (response) => {
        if (response) {
          console.log('战斗数据发送结果:', response);
        }
      });
    }
  }

  function hideLoading() {
    DOM_ELEMENTS.loadingIndicator.classList.add('display-none');
    DOM_ELEMENTS.loadingIndicator.classList.remove('display-flex');
  }

  function showError(message) {
    hideLoading();
    DOM_ELEMENTS.errorText.textContent = message;
    DOM_ELEMENTS.errorMessage.classList.add('display-flex');
    DOM_ELEMENTS.errorMessage.classList.remove('display-none');
    DOM_ELEMENTS.battleDetails.classList.add('display-none');
    DOM_ELEMENTS.battleDetails.classList.remove('display-block');
    DOM_ELEMENTS.emptyState.classList.add('display-none');
    DOM_ELEMENTS.emptyState.classList.remove('display-flex');
  }

  function showEmptyState() {
    hideLoading();
    DOM_ELEMENTS.emptyState.classList.add('display-flex');
    DOM_ELEMENTS.emptyState.classList.remove('display-none');
    DOM_ELEMENTS.errorMessage.classList.add('display-none');
    DOM_ELEMENTS.errorMessage.classList.remove('display-flex');
    DOM_ELEMENTS.battleDetails.classList.add('display-none');
    DOM_ELEMENTS.battleDetails.classList.remove('display-block');
  }

  function switchView(viewId) {
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });
    document.getElementById(viewId).classList.add('active');
  }

  async function loadSameGamePlayers() {
    const container = document.getElementById('same-game-players');
    container.innerHTML = `
      <div class="loading-message">
        <i class="fas fa-spinner fa-spin"></i>
        <span>加载同局玩家信息中...</span>
      </div>
    `;

    try {
      if (!STATE.currentRoomId) {
        throw new Error('房间ID不存在');
      }

      const players = await fetchSameGamePlayers(STATE.currentRoomId);
      container.innerHTML = '';

      if (!Array.isArray(players) || players.length === 0) {
        container.innerHTML = `
          <div class="empty-players">
            <i class="fas fa-users"></i>
            <span>当前没有其他使用本插件的同局玩家</span>
          </div>
        `;
        return;
      }

      const template = document.getElementById('player-card-simple-template');
      const teams = {};
      
      players.forEach(player => {
        if (player.Details && Array.isArray(player.Details)) {
          player.Details.forEach(detail => {
            const teamId = detail.teamId === undefined || detail.teamId === null ? '未知' : detail.teamId;
            if (!teams[teamId]) {
              teams[teamId] = [];
            }
            teams[teamId].push(detail);
          });
        }
      });

      Object.entries(teams).forEach(([teamId, teamPlayers]) => {
        const teamContainer = document.createElement('div');
        teamContainer.className = 'team-container-simple';
        
        const teamHeader = document.createElement('div');
        teamHeader.className = 'team-header-simple';
        teamHeader.textContent = '队伍 ' + teamId;
        
        const teamPlayersContainer = document.createElement('div');
        teamPlayersContainer.className = 'team-players-simple';
        
        teamPlayers.forEach(player => {
          const card = template.content.cloneNode(true);
          card.querySelector('.player-name-simple').textContent = player.name;
          
          const statItems = card.querySelectorAll('.stat-item-simple');
          statItems[0].querySelector('.stat-value-simple').textContent = formatNumber(player.originalEquipmentPriceWithoutKeyChain);
          statItems[1].querySelector('.stat-value-simple').textContent = formatNumber(player.gainedPrice);
          
          const profitLossElement = statItems[2].querySelector('.stat-value-simple');
          profitLossElement.textContent = formatNumber(player.ProfitLoss);
          profitLossElement.classList.add(player.ProfitLoss > 0 ? 'profit' : 'loss');
          
          statItems[3].querySelector('.stat-value-simple').textContent = formatNumber(player.collectionPrice);
          
          teamPlayersContainer.appendChild(card);
        });

        teamContainer.appendChild(teamHeader);
        teamContainer.appendChild(teamPlayersContainer);
        container.appendChild(teamContainer);
      });
    } catch (error) {
      container.innerHTML = `
        <div class="empty-players">
          <i class="fas fa-exclamation-circle"></i>
          <span>获取同局玩家数据失败：${error.message}</span>
        </div>
      `;
    }
  }

  function setupEventListeners() {
    if (DOM_ELEMENTS.backButton) {
      DOM_ELEMENTS.backButton.addEventListener('click', () => {
        if (window.parent) {
          window.parent.postMessage({ type: 'GO_BACK' }, '*');
        } else {
          window.history.back();
        }
      });
    }

    const backButtonView2 = document.getElementById('back-button-view2');
    if (backButtonView2) {
      backButtonView2.addEventListener('click', () => {
        window.history.back();
      });
    }

    const switchViewBtn = document.getElementById('switch-view-btn');
    const view1 = document.getElementById('view-1');
    const view2 = document.getElementById('view-2');

    if (switchViewBtn && view1 && view2) {
      switchViewBtn.addEventListener('click', () => {
        if (view1.classList.contains('active')) {
          switchView('view-2');
          loadSameGamePlayers();
        } else {
          switchView('view-1');
        }
      });
    }

    window.addEventListener('message', (event) => {
      switch (event.data?.type) {
        case 'BATTLE_DETAIL_RESULT':
          if (event.data && event.data.success && event.data.data) {
            STATE.battleDetailData = event.data.data;
            if (STATE.currentOpenid) {
              hideLoading();
              renderBattleDetails(STATE.battleDetailData);
            }
          } else {
            hideLoading();
            showError(event.data.error || '获取战斗详情失败');
          }
          break;
        case 'USER_INFO_RESULT':
          handleUserInfoResult(event.data);
          break;
      }
    });
  }

  async function init() {
    initDomElements();
    setupEventListeners();

    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId');

    if (roomId) {
      STATE.currentRoomId = roomId;
      await Promise.all([loadMapData(), loadRoleData()]);
      
      hideLoading();
      DOM_ELEMENTS.loadingIndicator.classList.add('display-flex');
      DOM_ELEMENTS.loadingIndicator.classList.remove('display-none');
      DOM_ELEMENTS.errorMessage.classList.add('display-none');
      DOM_ELEMENTS.errorMessage.classList.remove('display-flex');
      DOM_ELEMENTS.emptyState.classList.add('display-none');
      DOM_ELEMENTS.emptyState.classList.remove('display-flex');
      DOM_ELEMENTS.battleDetails.classList.add('display-none');
      DOM_ELEMENTS.battleDetails.classList.remove('display-block');

      if (window.parent) {
        window.parent.postMessage({ type: 'HOME_GET_USER_INFO' }, '*');
      } else {
        showError('无法访问父窗口');
      }
    } else {
      showError('缺少房间ID参数');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
