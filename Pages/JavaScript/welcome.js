/**
 * Mosuight Pro - 三角洲行动战绩分析助手
 * Welcome Page - 欢迎页面脚本
 * 
 * 功能：
 * - 滚动交互效果
 * - 动态背景粒子效果
 * - 滚动提示和导航
 */

(function() {
  'use strict';

  const COLORS = [
    'rgba(59, 130, 246, 0.3)',
    'rgba(255, 127, 0, 0.2)',
    'rgba(16, 185, 129, 0.2)',
    'rgba(139, 92, 246, 0.2)',
    'rgba(236, 72, 153, 0.2)'
  ];

  const PARTICLE_COUNT = 20;
  const MIN_PARTICLE_SIZE = 10;
  const MAX_PARTICLE_SIZE = 80;
  const MIN_ANIMATION_DURATION = 10;
  const MAX_ANIMATION_DURATION = 40;

  /**
   * 初始化滚动交互效果
   * 处理容器1和容器2的滚动联动效果
   */
  function initScrollInteraction() {
    const container1 = document.getElementById('container1');
    const container2 = document.getElementById('container2');

    if (!container1 || !container2) {
      return;
    }

    const updateTransform = () => {
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const scrollProgress = Math.min(scrollY / viewportHeight, 1);

      const translateY = (1 - scrollProgress) * 100;
      container2.style.transform = `translateY(${translateY}vh)`;
      container2.style.opacity = '1';
      container1.style.opacity = 1 - scrollProgress;
    };

    window.addEventListener('scroll', updateTransform, { passive: true });
    window.addEventListener('resize', updateTransform);

    window.scrollTo(0, 0);
  }

  /**
   * 初始化滚动提示按钮
   */
  function initScrollHint() {
    const scrollHint = document.querySelector('.scroll-hint');
    
    if (!scrollHint) {
      return;
    }

    scrollHint.addEventListener('click', () => {
      window.scrollTo({
        top: window.innerHeight,
        behavior: 'smooth'
      });
    });
  }

  /**
   * 创建动态背景粒子效果
   */
  function createDynamicBackground() {
    const backgroundContainer = document.querySelector('.dynamic-bg');
    
    if (!backgroundContainer) {
      return;
    }

    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles';
    backgroundContainer.appendChild(particlesContainer);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const particle = createParticle();
      particlesContainer.appendChild(particle);
    }
  }

  /**
   * 创建单个粒子元素
   * @returns {HTMLElement} 粒子元素
   */
  function createParticle() {
    const particle = document.createElement('div');
    particle.className = 'particle';

    const size = Math.floor(Math.random() * (MAX_PARTICLE_SIZE - MIN_PARTICLE_SIZE + 1)) + MIN_PARTICLE_SIZE;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const animationDuration = Math.floor(Math.random() * (MAX_ANIMATION_DURATION - MIN_ANIMATION_DURATION + 1)) + MIN_ANIMATION_DURATION;
    const animationDelay = Math.random() * 5;

    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.backgroundColor = color;
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.top = `${Math.random() * 100}%`;
    particle.style.animationDuration = `${animationDuration}s`;
    particle.style.animationDelay = `${animationDelay}s`;

    const cssVars = ['--x1', '--y1', '--r1', '--x2', '--y2', '--r2', '--x3', '--y3', '--r3'];
    cssVars.forEach(cssVar => {
      const value = Math.floor(Math.random() * 100) - 50;
      const unit = cssVar.includes('r') ? 'deg' : 'px';
      particle.style.setProperty(cssVar, `${value}${unit}`);
    });

    return particle;
  }

  /**
   * 页面初始化
   */
  function initPage() {
    initScrollInteraction();
    initScrollHint();
    createDynamicBackground();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
  } else {
    initPage();
  }

})();
