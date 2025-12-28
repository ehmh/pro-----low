/**
 * Mosuight Pro - 三角洲行动战绩分析助手
 * Collect Page - 收藏/收获页面脚本
 * 
 * 功能：
 * - 展示战斗收获物品统计
 * - 物品分类展示
 * - 刷新数据功能
 */

(function() {
  'use strict';

  const CACHE_KEY = 'mosuight_battle_list_cache';

  function updateTimeInfo() {
    const now = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    document.getElementById('update-info').textContent = '更新时间: ' + now;
  }

  function getMockHarvestData() {
    return {
      earnings: {
        total: '0'
      },
      redItems: {
        total: 0
      },
      goldItems: {
        total: 0
      },
      harvestItems: []
    };
  }

  function getRecentSevenDaysBattles(battles) {
    if (!Array.isArray(battles)) {
      return [];
    }

    const sortedBattles = [...battles].sort((a, b) => 
      new Date(b.dtEventTime) - new Date(a.dtEventTime)
    );

    if (sortedBattles.length === 0) {
      return [];
    }

    const latestDate = new Date(sortedBattles[0].dtEventTime);
    const sevenDaysAgo = new Date(latestDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return sortedBattles.filter(battle => 
      new Date(battle.dtEventTime) >= sevenDaysAgo
    );
  }

  function extractAllCollections(battles) {
    const itemMap = new Map();

    battles.forEach(battle => {
      if (Array.isArray(battle.collections)) {
        battle.collections.forEach(item => {
          const itemName = item.name;
          const itemQuantity = item.quantity || 1;

          if (itemMap.has(itemName)) {
            const existingItem = itemMap.get(itemName);
            existingItem.quantity += itemQuantity;
            if (item.grade > existingItem.grade) {
              existingItem.grade = item.grade;
            }
          } else {
            const newItem = {
              ...item,
              battleTime: battle.dtEventTime,
              quantity: itemQuantity,
              grade: item.grade || 0
            };
            itemMap.set(itemName, newItem);
          }
        });
      }
    });

    return Array.from(itemMap.values());
  }

  function sortCollectionsByGrade(items) {
    return items.sort((a, b) => {
      if (b.grade !== a.grade) {
        return b.grade - a.grade;
      }
      const priceA = parseInt(a.price) || 0;
      const priceB = parseInt(b.price) || 0;
      return priceB - priceA;
    });
  }

  function calculateStatistics(items) {
    let totalEarnings = 0;
    let redItemCount = 0;
    let goldItemCount = 0;

    items.forEach(item => {
      const quantity = parseInt(item.quantity || item.num || 1);
      const price = parseInt(item.price) || 0;
      totalEarnings += price * quantity;

      if (item.grade === 6) {
        redItemCount += quantity;
      } else if (item.grade === 5) {
        goldItemCount += quantity;
      }
    });

    return {
      earnings: {
        total: totalEarnings.toLocaleString('zh-CN')
      },
      redItems: {
        total: redItemCount
      },
      goldItems: {
        total: goldItemCount
      }
    };
  }

  function updateDisplay(data) {
    updateEarningsCard(data.earnings);
    updateRedItemsCard(data.redItems);
    updateGoldItemsCard(data.goldItems);
    updateHarvestDisplay(data.harvestItems);
  }

  function updateEarningsCard(earnings) {
    document.getElementById('total-earnings').textContent = earnings.total;
  }

  function updateRedItemsCard(redItems) {
    document.getElementById('red-items-count').textContent = redItems.total;
  }

  function updateGoldItemsCard(goldItems) {
    document.getElementById('gold-items-count').textContent = goldItems.total;
  }

  function updateHarvestDisplay(items) {
    const container = document.querySelector('.harvest-content') || document.getElementById('harvest-items');
    container.innerHTML = '';

    if (!items || items.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = '暂无收获物品';
      container.appendChild(emptyState);
      return;
    }

    container.className = 'harvest-items-grid';
    items.forEach(item => {
      container.appendChild(createHarvestItemElement(item));
    });
  }

  function createHarvestItemElement(item) {
    const card = document.createElement('div');
    
    let gradeClass = 'grade-default';
    if (item.grade === 6) {
      gradeClass = 'grade-6';
    } else if (item.grade === 5) {
      gradeClass = 'grade-5';
    }
    
    card.className = 'harvest-item-card ' + gradeClass;

    const quantityBadge = document.createElement('div');
    quantityBadge.className = 'quantity-badge';
    quantityBadge.textContent = 'X' + (item.quantity || item.num || 1);
    card.appendChild(quantityBadge);

    const imageContainer = document.createElement('div');
    imageContainer.className = 'item-image-container';

    const image = document.createElement('img');
    image.className = 'item-image';
    image.alt = item.name || '物品';
    image.src = getItemImageSrc(item);
    imageContainer.appendChild(image);

    if (item.price) {
      const priceTag = createPriceTag(item.price);
      imageContainer.appendChild(priceTag);
    }

    card.appendChild(imageContainer);

    const nameElement = document.createElement('div');
    nameElement.className = 'item-name';
    nameElement.textContent = item.name || '未知物品';
    card.appendChild(nameElement);

    return card;
  }

  function getItemImageSrc(item) {
    if (item.icon && item.icon !== '0') {
      return '../Asset/Images/Icons/' + item.icon + '.png';
    } else if (item.pic) {
      return item.pic;
    } else {
      return 'https://via.placeholder.com/100x100?text=' + encodeURIComponent(item.name || '未知物品');
    }
  }

  function createPriceTag(price) {
    const priceValue = parseInt(price) || 0;
    let formattedPrice;
    
    if (priceValue >= 100000000) {
      formattedPrice = (priceValue / 100000000).toFixed(1) + '亿';
    } else if (priceValue >= 10000) {
      formattedPrice = (priceValue / 10000).toFixed(1) + '万';
    } else {
      formattedPrice = priceValue.toLocaleString('zh-CN');
    }

    const priceElement = document.createElement('div');
    priceElement.className = 'price-tag';
    priceElement.textContent = formattedPrice;
    priceElement.title = priceValue.toLocaleString('zh-CN');
    return priceElement;
  }

  function loadHarvestData() {
    try {
      const cachedData = sessionStorage.getItem(CACHE_KEY);
      
      if (!cachedData?.sols?.length) {
        updateDisplay(getMockHarvestData());
        return;
      }

      const recentBattles = getRecentSevenDaysBattles(cachedData.sols);
      const allCollections = extractAllCollections(recentBattles);
      const sortedCollections = sortCollectionsByGrade(allCollections);
      const statistics = calculateStatistics(sortedCollections);

      const result = {
        ...statistics,
        harvestItems: sortedCollections
      };

      updateDisplay(result);
    } catch (error) {
      console.error('加载收获数据失败:', error);
      updateDisplay(getMockHarvestData());
    }
  }

  function bindRefreshEvent() {
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
      refreshButton.addEventListener('click', function() {
        this.classList.add('refreshing');
        loadHarvestData();
        updateTimeInfo();
        setTimeout(() => this.classList.remove('refreshing'), 1000);
      });
    }
  }

  function init() {
    updateTimeInfo();
    loadHarvestData();
    bindRefreshEvent();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
