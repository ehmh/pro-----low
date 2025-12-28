/**
 * Mosuight Pro - 三角洲行动战绩分析助手
 * Content Script - 内容脚本
 * 
 * 功能：
 * - 检测登录状态
 * - 版本更新提示
 * - 战绩数据获取
 * - 与后台脚本通信
 */

(function() {
  'use strict';

  const CONFIG = {
    TARGET_URL_REG: /^https:\/\/www\.wegame\.com\.cn\/helper\/df\/.*/,
    WEGAME_DOMAIN: 'wegame.com.cn',
    API_BASE_URL: 'https://www.wegame.com.cn/api/v1/wegame.pallas.dfm.DfmBattle',
    PANEL_URL: chrome.runtime.getURL('Pages/HTML/panel.html'),
    UPDATE_DOWNLOAD_URL: 'https://api.mosuight.xyz/download'
  };

  const STATE = {
    userSessionInfo: null,
    currentUrl: window.location.href,
    hasUpdateAvailable: false
  };

  function isTargetUrl() {
    return CONFIG.TARGET_URL_REG.test(window.location.href);
  }

  async function hasTgpCookie() {
    if (chrome?.cookies) {
      try {
        const cookies = await new Promise(resolve => {
          chrome.cookies.getAll({
            url: window.location.origin
          }, res => resolve(chrome.runtime.lastError ? [] : res));
        });
        return cookies.some(c => c.name.toLowerCase().startsWith('tgp'));
      } catch {}
    }
    return document.cookie.split(';').some(c => c.trim().toLowerCase().startsWith('tgp'));
  }

  function simulateLoginClick() {
    const btn = document.querySelector('a.button-login');
    if (!btn) {
      return false;
    }
    btn.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
    btn.click();
    return true;
  }

  async function checkForUpdates() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_FOR_UPDATES'
      });
      return response;
    } catch (error) {
      console.error('版本检查失败:', error);
      return {
        updateAvailable: false
      };
    }
  }

  function showUpdateModal(latestVersion, updateFeatures) {
    const existingModal = document.getElementById('mosuight-update-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'mosuight-update-modal';
    Object.assign(modal.style, {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      fontFamily: 'Microsoft YaHei, Arial, sans-serif'
    });

    const content = document.createElement('div');
    Object.assign(content.style, {
      width: '400px',
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
    });

    const title = document.createElement('h2');
    title.textContent = '发现新版本';
    Object.assign(title.style, {
      margin: '0 0 16px 0',
      fontSize: '20px',
      color: '#333',
      textAlign: 'center'
    });
    content.appendChild(title);

    const versionInfo = document.createElement('div');
    versionInfo.innerHTML = `<p style="margin: 0 0 12px 0; text-align: center; color: #666; font-size: 14px;">新版本：<strong style="color: #409EFF;">${latestVersion}</strong></p>`;
    content.appendChild(versionInfo);

    const updateTitle = document.createElement('h3');
    updateTitle.textContent = '更新内容：';
    Object.assign(updateTitle.style, {
      margin: '16px 0 8px 0',
      fontSize: '16px',
      color: '#333'
    });
    content.appendChild(updateTitle);

    const featuresList = updateFeatures.split('\n').map(feature => {
      if (feature.trim()) {
        return `<li style="margin: 4px 0; padding-left: 8px; color: #666; font-size: 14px;">${feature.trim()}</li>`;
      }
      return '';
    }).join('');

    const updateContent = document.createElement('div');
    updateContent.innerHTML = `<ul style="margin: 0; padding-left: 20px; list-style-type: disc;">${featuresList}</ul>`;
    content.appendChild(updateContent);

    const buttonContainer = document.createElement('div');
    Object.assign(buttonContainer.style, {
      marginTop: '24px',
      display: 'flex',
      justifyContent: 'center'
    });
    content.appendChild(buttonContainer);

    const updateButton = document.createElement('button');
    updateButton.textContent = '立即升级';
    Object.assign(updateButton.style, {
      padding: '8px 24px',
      backgroundColor: '#409EFF',
      color: '#fff',
      border: 'none',
      borderRadius: '4px',
      fontSize: '14px',
      cursor: 'pointer',
      transition: 'background-color 0.3s'
    });

    updateButton.addEventListener('click', () => {
      window.open(CONFIG.UPDATE_DOWNLOAD_URL, '_blank');
      modal.remove();
    });

    buttonContainer.appendChild(updateButton);
    modal.appendChild(content);
    document.body.appendChild(modal);
  }

  function createWhiteOverlay() {
    if (document.getElementById('mosuight-white-overlay')) {
      return;
    }
    const overlay = document.createElement('div');
    overlay.id = 'mosuight-white-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: '#fff',
      zIndex: 9998,
      display: 'block'
    });

    const insertOverlay = () => document.body?.insertBefore(overlay, document.body.firstChild);
    if (document.body) {
      insertOverlay();
    } else {
      document.addEventListener('DOMContentLoaded', insertOverlay);
    }
  }

  function showModal() {
    let modal = document.getElementById('mosuight-modal');
    if (modal) {
      return modal.style.display = 'flex';
    }
    try {
      modal = document.createElement('div');
      modal.id = 'mosuight-modal';
      Object.assign(modal.style, {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(240,240,240,0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999
      });

      const content = document.createElement('div');
      Object.assign(content.style, {
        width: '75vw',
        height: '75vh',
        border: '2px solid #e0e0e0',
        borderRadius: '12px',
        overflow: 'hidden',
        backgroundColor: '#fff',
        resize: 'none',
        userSelect: 'none',
        touchAction: 'none'
      });

      const iframe = document.createElement('iframe');
      iframe.src = CONFIG.PANEL_URL;
      Object.assign(iframe.style, {
        width: '100%',
        height: '100%',
        border: 'none'
      });
      iframe.sandbox = 'allow-scripts allow-same-origin';
      content.appendChild(iframe);
      modal.appendChild(content);
      document.body.appendChild(modal);

      const handleEsc = (e) => {
        if (e.key === 'Escape') {
          modal.style.display = 'none';
          document.removeEventListener('keydown', handleEsc);
        }
      };
      document.addEventListener('keydown', handleEsc);
    } catch {}
  }

  function setupLoginDetection() {
    let modalShown = false;
    const interval = setInterval(async () => {
      if (modalShown) {
        return clearInterval(interval);
      }
      if (await hasTgpCookie()) {
        showModal();
        modalShown = true;
        clearInterval(interval);
      }
    }, 2000);
    setTimeout(() => clearInterval(interval), 300000);
  }

  function clearStorage() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('mosuight_')) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('mosuight_')) {
        sessionStorage.removeItem(key);
      }
    });
    try {
      const keysToRemove = ['userSessionInfo', 'authData', 'battleHistory'];
      chrome.storage.local?.remove(keysToRemove);
      chrome.storage.session?.clear();
    } catch (e) {
      console.warn('清除插件存储失败:', e);
    }
    STATE.userSessionInfo = null;
  }

  function requestClearCacheAndCookies() {
    clearStorage();
    chrome.runtime.sendMessage({
      type: 'CLEAR_CACHE_AND_COOKIES'
    }).catch(() => {});
    setTimeout(() => window.location.reload(), 1000);
  }

  function getTgpThirdOpenid() {
    return document.cookie.split(';').find(c => c.trim().startsWith('tgp_third_openid='))?.split('=')[1] || '';
  }

  function getAccountType(openid) {
    return new RegExp('^\\d+$', '').test(openid) ? 1 : 2;
  }

  async function getUserTagFromBackground(openid) {
    try {
      return await new Promise(resolve => {
        const port = chrome.runtime.connect({
          name: 'content-background-port'
        });
        port.onMessage.addListener(res => {
          port.disconnect();
          resolve({
            user_tag: res?.userTag || 'User',
            expiry_date: res?.expiryDate || null
          });
        });
        port.onDisconnect.addListener(() => resolve({
          user_tag: 'User',
          expiry_date: null
        }));
        port.postMessage({
          type: 'GET_USER_TAG',
          tgpThirdOpenid: openid
        });
      });
    } catch {
      return {
        user_tag: 'User',
        expiry_date: null
      };
    }
  }

  async function fetchUserRoleInfo() {
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/GetRoleInfo`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          authority: 'www.wegame.com.cn',
          origin: 'https://www.wegame.com.cn',
          referer: 'https://www.wegame.com.cn/helper/df/',
          'trpc-caller': 'wegame.pallas.web.DfmBattle'
        },
        body: JSON.stringify({
          from_src: 'df_web',
          account_type: getAccountType(getTgpThirdOpenid()),
          area: 36
        })
      });
      return await res.json();
    } catch (e) {
      return {
        error: e.message
      };
    }
  }

  async function getUserAuthInfo() {
    if (STATE.userSessionInfo?.roleInfo?.role_info?.openid) {
      return {
        openid: STATE.userSessionInfo.roleInfo.role_info.openid,
        accountType: STATE.userSessionInfo.accountType
      };
    }
    const roleInfo = await fetchUserRoleInfo();
    const openid = roleInfo?.role_info?.openid;
    if (!openid) {
      return {
        openid: null,
        accountType: null
      };
    }
    const tgpOpenid = getTgpThirdOpenid();
    const accountType = getAccountType(tgpOpenid);
    const userTagInfo = await getUserTagFromBackground(tgpOpenid);
    STATE.userSessionInfo = {
      roleInfo: roleInfo,
      tgpThirdOpenid: tgpOpenid,
      accountType: accountType,
      userTagInfo: userTagInfo
    };
    return {
      openid: openid,
      accountType: accountType
    };
  }

  async function fetchBattleReport(openid, accountType, params = {}) {
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/GetBattleReport`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          authority: 'www.wegame.com.cn',
          origin: 'https://www.wegame.com.cn',
          referer: 'https://www.wegame.com.cn/helper/df/',
          'trpc-caller': 'wegame.pallas.web.DfmBattle',
          accept: '*/*'
        },
        body: JSON.stringify({
          from_src: 'df_web',
          openid: openid,
          area: 36,
          sid: '7',
          account_type: accountType,
          queue: 'sol',
          ...params
        })
      });
      return await res.json();
    } catch (e) {
      return {
        error: e.message
      };
    }
  }

  async function fetchBattleList(openid, accountType, params = {}) {
    try {
      const requestParams = {
        from_src: 'df_web',
        size: 5,
        openid: openid,
        area: 36,
        queue: 'sol',
        account_type: accountType,
        filters: [],
        ...params
      };
      if (!params.after) {
        delete requestParams.after;
      }
      const res = await fetch(`${CONFIG.API_BASE_URL}/GetBattleList`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          authority: 'www.wegame.com.cn',
          origin: 'https://www.wegame.com.cn',
          referer: 'https://www.wegame.com.cn/helper/df/',
          'trpc-caller': 'wegame.pallas.web.DfmBattle',
          accept: '*/*',
          'accept-language': 'zh-CN,zh;q=0.9',
          priority: 'u=1, i',
          'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin'
        },
        body: JSON.stringify(requestParams)
      });
      return await res.json();
    } catch (e) {
      return {
        error: e.message
      };
    }
  }

  async function fetchBattleDetail(openid, accountType, params = {}) {
    if (!params.roomId) {
      return {
        error: '缺少必需参数roomId'
      };
    }
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/GetBattleDetail`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          authority: 'www.wegame.com.cn',
          origin: 'https://www.wegame.com.cn',
          referer: 'https://www.wegame.com.cn/helper/df/score-detail/?',
          'trpc-caller': 'wegame.pallas.web.DfmBattle',
          accept: '*/*',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
          priority: 'u=1, i',
          'sec-ch-ua': '"Chromium";v="142", "Microsoft Edge";v="142", "Not_A Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin'
        },
        body: JSON.stringify({
          from_src: 'df_web',
          openid: openid,
          area: 36,
          queue: 'sol',
          account_type: accountType,
          ...params
        })
      });
      return await res.json();
    } catch (e) {
      return {
        error: e.message
      };
    }
  }

  function setupMessageListeners() {
    chrome.runtime.onMessage.addListener(async (msg, _, sendRes) => {
      try {
        switch (msg.type) {
          case 'GET_USER_ROLE_INFO': {
            const roleInfo = await fetchUserRoleInfo();
            const tgpOpenid = getTgpThirdOpenid();
            const userTagInfo = await getUserTagFromBackground(tgpOpenid);
            STATE.userSessionInfo = {
              roleInfo: roleInfo,
              tgpThirdOpenid: tgpOpenid,
              accountType: getAccountType(tgpOpenid),
              userTagInfo: userTagInfo
            };
            sendRes({
              ...roleInfo,
              mosuight_info: {
                user_tag: userTagInfo.user_tag,
                tgp_third_openid: tgpOpenid,
                expiry_date: userTagInfo.expiry_date
              }
            });
            break;
          }
          case 'GET_BATTLE_REPORT': {
            const { openid, accountType } = await getUserAuthInfo();
            if (!openid) {
              return sendRes({
                success: false,
                error: '无法获取用户openid'
              });
            }
            const result = await fetchBattleReport(openid, accountType, msg.params);
            sendRes({
              success: !result.error,
              data: result,
              error: result.error
            });
            break;
          }
          case 'GET_BATTLE_LIST': {
            const { openid, accountType } = await getUserAuthInfo();
            if (!openid) {
              return sendRes({
                success: false,
                error: '无法获取用户openid'
              });
            }
            const result = await fetchBattleList(openid, accountType, msg.params);
            sendRes({
              success: !result.error,
              data: result,
              error: result.error
            });
            break;
          }
          case 'GET_BATTLE_DETAIL': {
            const { openid, accountType } = await getUserAuthInfo();
            if (!openid) {
              return sendRes({
                success: false,
                error: '无法获取用户openid'
              });
            }
            const result = await fetchBattleDetail(openid, accountType, msg.params);
            sendRes({
              success: !result.error,
              data: result,
              error: result.error
            });
            break;
          }
          case 'LOGOUT':
          case 'SWITCH_ACCOUNT':
          case 'CLEAR_CACHE_AND_COOKIES':
            requestClearCacheAndCookies();
            sendRes({
              success: true
            });
            break;
          default:
            sendRes({
              success: false,
              error: '未知消息类型'
            });
        }
      } catch (e) {
        sendRes({
          success: false,
          error: e.message
        });
      }
      return true;
    });

    window.addEventListener('message', async (e) => {
      try {
        switch (e.data?.type) {
          case 'GET_USER_ROLE_INFO': {
            const roleInfo = await fetchUserRoleInfo();
            const tgpOpenid = getTgpThirdOpenid();
            const userTagInfo = await getUserTagFromBackground(tgpOpenid);
            STATE.userSessionInfo = {
              roleInfo: roleInfo,
              tgpThirdOpenid: tgpOpenid,
              accountType: getAccountType(tgpOpenid),
              userTagInfo: userTagInfo
            };
            e.source.postMessage({
              type: 'USER_ROLE_INFO_RESULT',
              data: {
                ...roleInfo,
                mosuight_info: {
                  ...userTagInfo,
                  tgp_third_openid: tgpOpenid
                }
              }
            }, '*');
            break;
          }
          case 'GET_BATTLE_REPORT': {
            const { openid, accountType } = await getUserAuthInfo();
            if (!openid) {
              return e.source.postMessage({
                type: 'BATTLE_REPORT_RESULT',
                success: false,
                error: '无法获取用户openid'
              }, '*');
            }
            const result = await fetchBattleReport(openid, accountType, e.data.params);
            e.source.postMessage({
              type: 'BATTLE_REPORT_RESULT',
              success: !result.error,
              data: result,
              error: result.error
            }, '*');
            break;
          }
          case 'GET_BATTLE_LIST': {
            const { openid, accountType } = await getUserAuthInfo();
            if (!openid) {
              return e.source.postMessage({
                type: 'BATTLE_LIST_RESULT',
                success: false,
                error: '无法获取用户openid'
              }, '*');
            }
            const result = await fetchBattleList(openid, accountType, e.data.params);
            e.source.postMessage({
              type: 'BATTLE_LIST_RESULT',
              success: !result.error,
              data: result,
              error: result.error
            }, '*');
            break;
          }
          case 'GET_BATTLE_DETAIL': {
            const { openid, accountType } = await getUserAuthInfo();
            if (!openid) {
              return e.source.postMessage({
                type: 'BATTLE_DETAIL_RESULT',
                success: false,
                error: '无法获取用户openid'
              }, '*');
            }
            const result = await fetchBattleDetail(openid, accountType, e.data.params);
            e.source.postMessage({
              type: 'BATTLE_DETAIL_RESULT',
              success: !result.error,
              data: result,
              error: result.error
            }, '*');
            break;
          }
          case 'LOGOUT':
            requestClearCacheAndCookies();
            break;
        }
      } catch (err) {
        e.source.postMessage({
          type: `${e.data?.type}_RESULT`,
          success: false,
          error: err.message
        }, '*');
      }
    });
  }

  async function init() {
    if (!isTargetUrl()) {
      return;
    }
    createWhiteOverlay();
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        setTimeout(resolve, 1000);
      } else {
        window.addEventListener('load', () => setTimeout(resolve, 1000));
      }
    });
    try {
      const hasCookie = await hasTgpCookie();
      if (hasCookie) {
        const updateInfo = await checkForUpdates();
        if (updateInfo.updateAvailable) {
          showUpdateModal(updateInfo.latestVersion, updateInfo.updateFeatures);
          STATE.hasUpdateAvailable = true;
        } else {
          showModal();
        }
      } else {
        simulateLoginClick();
        setupLoginDetection();
      }
    } catch {
      simulateLoginClick();
      setupLoginDetection();
    }
  }

  setupMessageListeners();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  setInterval(() => {
    if (window.location.href !== STATE.currentUrl) {
      STATE.currentUrl = window.location.href;
      if (isTargetUrl()) {
        createWhiteOverlay();
        init();
      }
    }
  }, 1000);

})();
