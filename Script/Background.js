/**
 * Mosuight Pro - 三角洲行动战绩分析助手
 * Background Script - 后台服务脚本
 * 
 * 功能：
 * - 版本更新检测
 * - 缓存清理
 * - 用户标签获取
 * - 战斗数据上报
 * - 同局玩家数据查询
 */

(function() {
  'use strict';

  const CONFIG = {
    API_BASE_URL: 'https://api.mosuight.xyz/api',
    WEGAME_DOMAIN: 'wegame.com.cn',
    UPDATE_CHECK_URL: 'https://api.mosuight.xyz/api/version/check'
  };

  /**
   * 获取本地扩展版本
   * @returns {string} 当前扩展版本号
   */
  function getLocalVersion() {
    return chrome.runtime.getManifest().version;
  }

  /**
   * 比较版本号，判断远程版本是否更新
   * @param {string} remoteVersion 远程版本号
   * @param {string} localVersion 本地版本号
   * @returns {boolean} 远程版本更新时返回true
   */
  function compareVersions(remoteVersion, localVersion) {
    const remoteParts = remoteVersion.split('.').map(Number);
    const localParts = localVersion.split('.').map(Number);
    
    const maxLength = Math.max(remoteParts.length, localParts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const remotePart = remoteParts[i] || 0;
      const localPart = localParts[i] || 0;
      
      if (remotePart > localPart) {
        return true;
      }
      if (remotePart < localPart) {
        return false;
      }
    }
    return false;
  }

  /**
   * 检查并执行缓存清理和页面刷新
   * @param {number} [tabId] 可选，指定要刷新的标签页ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async function clearCacheAndReload(tabId) {
    try {
      const cookies = await chrome.cookies.getAll({
        domain: CONFIG.WEGAME_DOMAIN
      });
      
      if (cookies.length > 0) {
        await Promise.all(cookies.map(cookie => {
          const url = `http${cookie.secure ? 's' : ''}://${cookie.domain.replace(/^\./, '')}${cookie.path}`;
          return chrome.cookies.remove({
            url: url,
            name: cookie.name
          });
        }));
      }
      
      const storageKeys = ['userSessionInfo', 'auhData', 'battleHistory'];
      await chrome.storage.local.remove(storageKeys);
      await chrome.storage.session.clear();
      
      if (tabId) {
        chrome.tabs.reload(tabId);
      }
      
      return { success: true };
    } catch (error) {
      console.error('清理缓存失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取用户标签信息
   * @param {string} openid 用户的OpenID
   * @returns {Promise<{success: boolean, userTag?: string, expiryDate?: string, error?: string}>}
   */
  async function fetchUserTag(openid) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/plugin-communication`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Openid: openid,
          PsType: 'query'
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'OK' && data.recode === '200' && data.UsData?.length > 0) {
        return {
          success: true,
          userTag: data.UsData[0].UsTage,
          expiryDate: data.UsData[0].DtTime
        };
      } else {
        return {
          success: false,
          error: '无效的API响应'
        };
      }
    } catch (error) {
      console.error('获取用户标签失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 发送战斗数据到服务器
   * @param {object} battleData 战斗数据
   * @returns {Promise<{success: boolean, data?: object, error?: string}>}
   */
  async function sendBattleDataToServer(battleData) {
    try {
      const payload = {
        ...battleData,
        PsType: 'chromeData'
      };
      
      const response = await fetch(`${CONFIG.API_BASE_URL}/plugin-communication`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      console.log('战斗数据发送结果:', result);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('发送战斗数据到服务器失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取同局玩家数据
   * @param {object} requestData 请求参数
   * @returns {Promise<{success: boolean, data?: array, error?: string}>}
   */
  async function fetchTeamPlayersData(requestData) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/plugin-communication`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('同局玩家数据响应:', data);
      
      return {
        success: true,
        data: data.UsData || []
      };
    } catch (error) {
      console.error('获取同局玩家数据失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 检查版本更新
   * @returns {Promise<{updateAvailable: boolean, latestVersion?: string, updateFeatures?: string, error?: string}>}
   */
  async function checkForUpdates() {
    try {
      const response = await fetch(CONFIG.UPDATE_CHECK_URL);
      
      if (!response.ok) {
        console.warn('版本检查API返回非200状态:', response.status);
        await chrome.storage.local.set({ updateAvailable: false });
        return { updateAvailable: false, error: `HTTP ${response.status}` };
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.warn('版本检查API返回非JSON格式:', text.substring(0, 200));
        await chrome.storage.local.set({ updateAvailable: false });
        return { updateAvailable: false, error: 'Invalid response format' };
      }
      
      const result = await response.json();
      
      if (result.status === 'OK' && result.data?.length > 0) {
        const latestVersion = result.data[0].version;
        const localVersion = getLocalVersion();
        
        if (compareVersions(latestVersion, localVersion)) {
          const updateInfo = {
            updateAvailable: true,
            latestVersion: latestVersion,
            updateFeatures: result.data[0].features
          };
          
          await chrome.storage.local.set(updateInfo);
          return updateInfo;
        } else {
          await chrome.storage.local.set({ updateAvailable: false });
          return { updateAvailable: false };
        }
      } else {
        await chrome.storage.local.set({ updateAvailable: false });
        return { updateAvailable: false };
      }
    } catch (error) {
      console.error('版本检查失败:', error);
      await chrome.storage.local.set({ updateAvailable: false });
      return {
        updateAvailable: false,
        error: error.message
      };
    }
  }

  /**
   * 处理来自内容脚本的连接
   * @param {chrome.runtime.Port} port 通信端口
   */
  function handleConnect(port) {
    port.onMessage.addListener(async (request) => {
      if (request.type === 'GET_USER_TAG') {
        const result = await fetchUserTag(request.tgpThirdOpenid);
        port.postMessage(result);
      } else {
        port.postMessage({
          success: false,
          error: '未知的请求类型'
        });
      }
    });
    
    port.onDisconnect.addListener(() => {
      console.log('内容脚本连接已断开');
    });
  }

  /**
   * 处理来自内容脚本的消息
   * @param {object} request 消息请求
   * @param {chrome.runtime.MessageSender} sender 发送者信息
   * @param {function} sendResponse 响应回调
   * @returns {boolean} 是否异步响应
   */
  function handleMessage(request, sender, sendResponse) {
    switch (request.type) {
      case 'CLEAR_CACHE_AND_COOKIES': {
        clearCacheAndReload(sender.tab?.id).then(sendResponse);
        return true;
      }
      
      case 'OPEN_SUBSCRIBE_PAGE': {
        const params = new URLSearchParams();
        params.append('user_tag', request.user_tag || 'USER');
        params.append('username', request.username || '');
        params.append('level', request.level || '');
        params.append('tgp_third_openid', request.tgp_third_openid || '');
        params.append('expiry_date', request.expiry_date || '');
        
        const subscribeUrl = chrome.runtime.getURL(`Pages/HTML/subscribe.html?${params.toString()}`);
        chrome.tabs.create({
          url: subscribeUrl,
          active: true
        });
        
        sendResponse({ success: true });
        return true;
      }
      
      case 'CHECK_FOR_UPDATES': {
        chrome.storage.local.get(['updateAvailable', 'latestVersion', 'updateFeatures'], (result) => {
          sendResponse({
            updateAvailable: result.updateAvailable || false,
            latestVersion: result.latestVersion || '',
            updateFeatures: result.updateFeatures || ''
          });
        });
        return true;
      }
      
      case 'BATTLE_DETAILS_DATA': {
        console.log('收到战斗详情数据:', request.data);
        
        sendBattleDataToServer(request.data)
          .then((result) => {
            if (result.success) {
              sendResponse({
                success: true,
                message: '战斗数据已接收并发送到服务器'
              });
            } else {
              console.error('发送战斗数据到服务器失败:', result.error);
              sendResponse({
                success: false,
                message: '战斗数据已接收，但发送到服务器失败'
              });
            }
          })
          .catch((error) => {
            console.error('处理战斗数据时发生错误:', error);
            sendResponse({
              success: false,
              message: '战斗数据已接收，但处理时发生错误'
            });
          });
        return true;
      }
      
      case 'GET_TEAM_PLAYERS_IMAGE': {
        console.log('收到同局玩家数据请求:', request.data);
        
        fetchTeamPlayersData(request.data)
          .then((result) => {
            sendResponse({
              success: result.success,
              data: result.data,
              error: result.error
            });
          })
          .catch((error) => {
            console.error('获取同局玩家数据失败:', error);
            sendResponse({
              success: false,
              error: error.message
            });
          });
        return true;
      }
      
      default:
        console.warn('收到未知消息类型:', request.type);
        sendResponse({
          success: false,
          error: `未知的消息类型: ${request.type}`
        });
        return false;
    }
  }

  // ==================== 事件监听器 ====================

  chrome.runtime.onConnect.addListener(handleConnect);
  
  chrome.runtime.onMessage.addListener(handleMessage);
  
  chrome.runtime.onInstalled.addListener(() => {
    checkForUpdates();
  });
  
  chrome.runtime.onStartup.addListener(() => {
    checkForUpdates();
  });
  
  chrome.action.onClicked.addListener(() => {
    chrome.tabs.create({
      url: 'https://www.wegame.com.cn/helper/df/'
    });
  });

})();
