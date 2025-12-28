/**
 * Mosuight Pro - 三角洲行动战绩分析助手
 * Subscribe Page - 订阅管理页面脚本
 * 
 * 功能：
 * - URL查询参数解析
 * - 复制到剪贴板
 * - 订阅信息管理
 * - 会员激活功能
 * - Tab切换
 */

(function() {
  'use strict';

  const API_BASE_URL = 'https://api.mosuight.xyz/api';

  /**
   * 获取URL查询参数
   * @returns {object} 参数字典
   */
  function getQueryParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    
    if (!queryString) {
      return params;
    }
    
    const pairs = queryString.split('&');
    
    for (let i = 0; i < pairs.length; i++) {
      const [key, value] = pairs[i].split('=');
      const decodedKey = decodeURIComponent(key);
      const decodedValue = decodeURIComponent((value || '').replace(/\+/g, ' '));
      params[decodedKey] = decodedValue;
    }
    
    return params;
  }

  /**
   * 复制文本到剪贴板
   * @param {string} text 要复制的文本
   * @param {HTMLElement} buttonElement 按钮元素（用于显示反馈）
   */
  async function copyToClipboard(text, buttonElement) {
    const textToCopy = text || '';
    const originalText = buttonElement.textContent;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      showCopyFeedback(buttonElement, originalText);
    } catch (error) {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showCopyFeedback(buttonElement, originalText);
    }
  }

  /**
   * 显示复制反馈
   * @param {HTMLElement} buttonElement 按钮元素
   * @param {string} originalText 原始文本
   */
  function showCopyFeedback(buttonElement, originalText) {
    buttonElement.textContent = '已复制';
    buttonElement.classList.add('copied');
    
    setTimeout(() => {
      buttonElement.textContent = originalText;
      buttonElement.classList.remove('copied');
    }, 1000);
  }

  /**
   * 根据用户标签获取订阅信息
   * @param {string} userTag 用户标签
   * @param {string} expiryDate 过期日期
   * @returns {object} 订阅信息对象
   */
  function getSubscriptionInfoByTag(userTag, expiryDate) {
    const upperTag = userTag ? userTag.toUpperCase() : '';
    
    const daysLeft = calculateDaysLeft(expiryDate);
    
    const subscriptions = {
      SVIP: {
        type: 'SVIP',
        name: '超级会员',
        status: 'svip',
        description: '全部上述功能（无版本限制），无账号数量及分析次数限制',
        expiry: expiryDate,
        daysLeft: daysLeft,
        apiLimit: '无限',
        keyStatus: '无限'
      },
      VIP: {
        type: 'VIP',
        name: '荣誉会员',
        status: 'vip',
        description: '截止2025年11月5日前在任意平台捐赠、打赏任意金额的人员自动获得',
        expiry: expiryDate,
        daysLeft: daysLeft,
        apiLimit: '5000/月',
        keyStatus: '高级'
      },
      FANS: {
        type: 'FANS',
        name: '粉丝共创',
        status: 'fans',
        description: '每日拉取粉丝群成员信息，在粉丝群中入群时间超过15天的自动获得',
        expiry: expiryDate,
        daysLeft: daysLeft,
        apiLimit: '5000/月',
        keyStatus: '高级'
      },
      USER: {
        type: 'USER',
        name: '免费会员',
        status: 'free',
        description: '基础功能、战绩列表、免费版分析报告、免费版收益统计，单日单账号限1次',
        expiry: expiryDate,
        daysLeft: daysLeft,
        apiLimit: '1000/月',
        keyStatus: '限制'
      },
      FREE: {
        type: 'USER',
        name: '免费会员',
        status: 'free',
        description: '基础功能、战绩列表、免费版分析报告、免费版收益统计，单日单账号限1次',
        expiry: expiryDate,
        daysLeft: daysLeft,
        apiLimit: '1000/月',
        keyStatus: '限制'
      }
    };
    
    return subscriptions[upperTag] || subscriptions.FREE;
  }

  /**
   * 计算距离到期的天数
   * @param {string} expiryDate 过期日期
   * @returns {string} 剩余天数
   */
  function calculateDaysLeft(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    
    const diffMs = expiry - today;
    const diffDays = Math.ceil(diffMs / 86400000);
    
    return diffDays > 0 ? diffDays.toString() : '0';
  }

  /**
   * 更新当前订阅卡片显示
   * @param {object} subscriptionInfo 订阅信息
   * @param {string} userOpenid 用户OpenID
   */
  function updateCurrentSubscriptionCard(subscriptionInfo, userOpenid) {
    updateElementText('current-plan-name', subscriptionInfo.name);
    updateElementText('status-indicator', subscriptionInfo.name === '免费版' ? '免费' : subscriptionInfo.name);
    
    const statusIndicator = document.getElementById('status-indicator');
    if (statusIndicator) {
      statusIndicator.className = 'status-indicator ' + subscriptionInfo.status;
    }
    
    updateElementText('expiry-date', '到期: ' + subscriptionInfo.expiry);
    updateElementText('days-remaining', '剩余 ' + subscriptionInfo.daysLeft + ' 天');
    
    const userOpenidElement = document.getElementById('user-openid');
    if (userOpenidElement) {
      userOpenidElement.textContent = userOpenid || '未获取到用户标识';
    }
    
    updateElementText('api-limit', subscriptionInfo.apiLimit);
    updateElementText('api-key-status', subscriptionInfo.keyStatus);
    
    const upgradeButton = document.getElementById('upgrade-btn');
    if (upgradeButton) {
      upgradeButton.textContent = subscriptionInfo.type === 'FREE' ? '立即升级' : '管理订阅';
    }
  }

  /**
   * 更新元素文本内容
   * @param {string} elementId 元素ID
   * @param {string} text 文本内容
   */
  function updateElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
    }
  }

  /**
   * 初始化复制按钮
   * @param {string} openid 要复制的OpenID
   */
  function initCopyButton(openid) {
    const copyButton = document.getElementById('copy-openid');
    if (copyButton) {
      copyButton.addEventListener('click', async () => {
        await copyToClipboard(openid, copyButton);
      });
    }
  }

  /**
   * 初始化OpenID显示和警告弹窗
   * @param {string} openid 用户OpenID
   */
  function initOpenidDisplay(openid) {
    const toggleButton = document.getElementById('toggle-openid');
    const openidElement = document.getElementById('user-openid');
    const copyButton = document.getElementById('copy-openid');
    const warningModal = document.getElementById('openidWarningModal');
    const closeButton = document.getElementById('closeOpenidWarning');
    const confirmButton = document.getElementById('confirmOpenidWarning');
    
    if (!toggleButton || !openidElement || !copyButton || !warningModal || !closeButton || !confirmButton) {
      return;
    }
    
    const showModal = () => {
      warningModal.style.display = 'flex';
    };
    
    const hideModal = () => {
      warningModal.style.display = 'none';
    };
    
    toggleButton.addEventListener('click', showModal);
    closeButton.addEventListener('click', hideModal);
    
    warningModal.addEventListener('click', (event) => {
      if (event.target === warningModal) {
        hideModal();
      }
    });
    
    confirmButton.addEventListener('click', async () => {
      hideModal();
      openidElement.style.display = 'inline';
      copyButton.style.display = 'inline';
      toggleButton.remove();
      await copyToClipboard(openid, copyButton);
    });
  }

  /**
   * 初始化订阅按钮
   */
  function setupSubscriptionButtons() {
    const upgradeButton = document.getElementById('upgrade-btn');
    if (upgradeButton) {
      upgradeButton.addEventListener('click', () => {
        const currentPlan = document.getElementById('current-plan-name').textContent;
        const isFreePlan = currentPlan === '免费会员';
        
        if (isFreePlan) {
          alert('即将跳转到支付页面');
        } else {
          alert('即将跳转到订阅管理页面');
        }
      });
    }
  }

  /**
   * 初始化爱发电支付按钮
   */
  function initAfadianPayButton() {
    const payButton = document.getElementById('afadianPayBtn');
    const activeModal = document.getElementById('activeMemberModal');
    
    if (payButton && activeModal) {
      payButton.addEventListener('click', () => {
        window.open('https://ifdian.net/order/create?plan_id=2ff5e0dcc5e711f0bce152540025c377&product_type=0&remark=&affiliate_code=', '_blank');
        activeModal.style.display = 'flex';
      });
    }
  }

  /**
   * 初始化Tab切换功能
   */
  function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const leftContentItems = document.querySelectorAll('.left-content-item');
    
    if (tabButtons.length === 0 || tabPanes.length === 0) {
      return;
    }
    
    const showLeftContent = (tabName) => {
      leftContentItems.forEach(item => {
        item.style.display = 'none';
      });
      
      const contentMap = {
        'fans': 'fans-left-content',
        'vip': 'vip-left-content',
        'svip': 'svip-left-content'
      };
      
      const defaultContent = contentMap[tabName] || 'default-left-content';
      const contentElement = document.getElementById(defaultContent);
      
      if (contentElement) {
        contentElement.style.display = 'block';
      }
    };
    
    const activeButton = document.querySelector('.tab-btn.active');
    if (activeButton) {
      const activeTab = activeButton.getAttribute('data-tab');
      showLeftContent(activeTab);
    }
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));
        
        button.classList.add('active');
        
        const tabName = button.getAttribute('data-tab');
        const targetPane = document.getElementById(tabName);
        
        if (targetPane) {
          targetPane.classList.add('active');
        }
        
        showLeftContent(tabName);
      });
    });
  }

  /**
   * 初始化会员激活功能
   * @param {string} userOpenid 用户OpenID
   */
  function initActiveMemberFeature(userOpenid) {
    const activateButton = document.getElementById('activeMemberBtn');
    const modal = document.getElementById('activeMemberModal');
    const closeButton = document.getElementById('closeActiveMember');
    const cancelButton = document.getElementById('cancelActiveMember');
    const submitButton = document.getElementById('submitActiveMember');
    const orderInput = document.getElementById('orderNumber');
    
    if (!activateButton || !modal || !closeButton || !cancelButton || !submitButton || !orderInput) {
      return;
    }
    
    const hideModal = () => {
      modal.style.display = 'none';
      orderInput.value = '';
    };
    
    activateButton.addEventListener('click', () => {
      modal.style.display = 'flex';
    });
    
    closeButton.addEventListener('click', hideModal);
    cancelButton.addEventListener('click', hideModal);
    
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        hideModal();
      }
    });
    
    submitButton.addEventListener('click', async () => {
      const orderNumber = orderInput.value.trim();
      
      if (!orderNumber) {
        alert('请输入订单号');
        return;
      }
      
      try {
        const response = await fetch(API_BASE_URL + '/plugin-communication', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            Openid: userOpenid,
            PsType: 'transmit',
            OrNumb: orderNumber
          })
        });
        
        const result = await response.json();
        
        if (result.recode === '200' && result.status === 'OK') {
          const userData = result.UsData[0];
          const subscriptionInfo = getSubscriptionInfoByTag(userData.UsTage, userData.DtTime);
          
          updateCurrentSubscriptionCard(subscriptionInfo, userOpenid);
          hideModal();
          alert('会员激活成功！');
        } else {
          const errorMessages = {
            '400': '参数错误或系统错误',
            '800': '注册异常',
            '100': '订单不存在',
            '102': '订单已绑定2个用户',
            '103': '该用户已绑定到该订单'
          };
          
          const errorMessage = errorMessages[result.recode] || '激活失败，请重试';
          alert(errorMessage);
        }
      } catch (error) {
        alert('网络错误，请检查网络连接后重试');
      }
    });
  }

  /**
   * 初始化订阅页面
   */
  function initSubscribePage() {
    const queryParams = getQueryParams();
    
    let userTag = queryParams.user_tag || queryParams.tag || queryParams.userTag || 'FREE';
    userTag = userTag.toUpperCase();
    
    const expiryDate = queryParams.expiry_date || '2025-11-20';
    
    const userOpenid = queryParams.tgp_third_openid || 
                       queryParams.openid || 
                       queryParams.openId || 
                       queryParams.OpenID || '';
    
    const subscriptionInfo = getSubscriptionInfoByTag(userTag, expiryDate);
    
    const initializePage = () => {
      updateCurrentSubscriptionCard(subscriptionInfo, userOpenid);
      setupSubscriptionButtons();
      initCopyButton(userOpenid);
      initOpenidDisplay(userOpenid);
      initActiveMemberFeature(userOpenid);
      initAfadianPayButton();
    };
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializePage);
    } else {
      initializePage();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initSubscribePage();
      initTabs();
    });
  } else {
    initSubscribePage();
    initTabs();
  }

})();
