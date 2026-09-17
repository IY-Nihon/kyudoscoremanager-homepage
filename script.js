/**
 * 弓道部的中ノート ランディングページ
 * 究極刷新版 JavaScript
 * 
 * 機能一覧:
 * - ローディング画面のフェードアウト制御
 * - スクロール連動フェードインアニメーション
 * - ナビバーのスクロール縮小
 * - FAQアコーディオン開閉
 * - 上に戻るボタンの表示/非表示
 * - スライドショーの自動切り替え
 */

// この台本は <script type="module"> で読み込まれる。module は defer と同じ
// 扱いで、DOMContentLoaded が済んだあとに走ることがある。その場合
// addEventListener('DOMContentLoaded', ...) は二度と呼ばれず、下の初期化が
// まるごと行われない（スクロールの演出が出ず、opacity:0 のままの節に入った
// loading="lazy" の写真が永久に読み込まれない）。
// すでに読み終わっていれば、その場で始める。
const 始める = () => {

  // ─── ローディング画面 ───
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const minDisplayTime = prefersReducedMotion ? 0 : 300; // 軽量な静的サイトのため演出は最小限に
    window.addEventListener('load', () => {
      setTimeout(() => {
        loadingScreen.classList.add('loaded');
      }, minDisplayTime);
    });
    // フォールバック: 3秒経っても消えなければ強制非表示
    setTimeout(() => {
      loadingScreen.classList.add('loaded');
    }, 1200);
  }

  // ─── スクロール連動フェードイン (Intersection Observer) ───
  // 背の高い節（.features など）には content-visibility:auto が掛かっており、
  // まだ描いていないうちは高さが見積りで扱われる。交差の割合を高くすると
  // 出そびれることがあるので、低いままにしておく
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -50px 0px',
    threshold: 0.01
  };

  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.fade-up').forEach(el => {
    fadeObserver.observe(el);
  });

  // ─── ナビバーのスクロール縮小 ───
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 80) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }, { passive: true });
  }

  // ─── 上に戻るボタン ───
  const backToTop = document.getElementById('back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 500) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }, { passive: true });

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ─── FAQアコーディオン ───
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (!question) return;

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      if (isOpen) {
        item.classList.remove('open');
        question.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('open');
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });




  // ─── スライドショー ───
  // 何枚あるかが分からないと、切り替わるものだと気づかれない。
  // 端末の下に点を並べ、いま何枚目かを示す。点は押して選べる
  const slideshows = document.querySelectorAll('.slideshow');
  slideshows.forEach(slideshow => {
    const slides = slideshow.querySelectorAll('.slide');
    if (slides.length <= 1) return;

    let currentIdx = 0;
    Array.prototype.forEach.call(slides, (s, i) => {
      s.classList.toggle('active', i === 0);
    });

    // 点は端末の枠の外（下）に置く。枠の中だと画面に重なる
    const 台 = slideshow.closest('.device-frame') || slideshow.parentElement;
    const 点の列 = document.createElement('div');
    点の列.className = 'slide-dots';
    点の列.setAttribute('role', 'tablist');
    点の列.setAttribute('aria-label', '画面の切り替え');
    const 点たち = [];
    Array.prototype.forEach.call(slides, (s, i) => {
      const 点 = document.createElement('button');
      点.type = 'button';
      点.className = 'slide-dot';
      点.setAttribute('role', 'tab');
      点.setAttribute('aria-label', (i + 1) + '枚目');
      点.addEventListener('click', () => 見せる(i, true));
      点の列.appendChild(点);
      点たち.push(点);
    });
    台.appendChild(点の列);

    // スマホ向け：左右タッチスワイプ（フリック操作）対応
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    台.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    台.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipe();
    }, { passive: true });

    function handleSwipe() {
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      // 縦スクロール誤認を防ぐため、横方向の移動が縦の1.5倍以上かつ40px以上の場合のみスワイプと判定
      if (Math.abs(diffX) > Math.abs(diffY) * 1.5 && Math.abs(diffX) > 40) {
        if (diffX < 0) {
          // 左スワイプ: 次のスライド
          見せる(currentIdx + 1, true);
        } else {
          // 右スワイプ: 前のスライド
          見せる(currentIdx - 1, true);
        }
      }
    }

    let 時計 = null;
    function 見せる(i, 押された) {
      slides[currentIdx].classList.remove('active');
      currentIdx = (i + slides.length) % slides.length;
      slides[currentIdx].classList.add('active');
      点たち.forEach((点, k) => {
        点.classList.toggle('on', k === currentIdx);
        点.setAttribute('aria-selected', k === currentIdx ? 'true' : 'false');
      });
      // 押されたら、そこから数え直す（押した直後に切り替わると読めない）
      if (押された) 数え直す();
    }
    function 数え直す() {
      if (時計) clearInterval(時計);
      時計 = setInterval(() => 見せる(currentIdx + 1, false), 3000); // 3秒ごとに切り替え
    }
    見せる(0, false);
    数え直す();
  });

  // ─── モバイル追従フローティングCTA ───
  const floatingCta = document.querySelector('.floating-cta-bar');
  if (floatingCta) {
    let ticking = false;
    const footerEl = document.querySelector('footer');
    // QRコードは「かざして開いてもらう」ためのもの。その上に帯が重なると
    // 読み取れない。QRが画面に入っているあいだは帯を引っ込める
    const qrEl = document.querySelector('.pc-qr-block');

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          let isFooterVisible = false;
          if (footerEl) {
            const footerRect = footerEl.getBoundingClientRect();
            // フッターが画面下部から入ってきたら非表示
            if (footerRect.top < window.innerHeight) {
              isFooterVisible = true;
            }
          }

          let isQrVisible = false;
          // 画面に出ていないとき（スマホ幅では display:none）は幅も高さも0になる
          if (qrEl && qrEl.getBoundingClientRect().height > 0) {
            const qrRect = qrEl.getBoundingClientRect();
            if (qrRect.top < window.innerHeight && qrRect.bottom > 0) {
              isQrVisible = true;
            }
          }

          if (scrollY > 450 && !isFooterVisible && !isQrVisible) {
            floatingCta.classList.add('visible');
          } else {
            floatingCta.classList.remove('visible');
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // ─── 超軽量・遅延ロード セッション解析（Microsoft Clarity等） ───
  function initAnalyticsDelayed() {
    const clarityId = window.__CLARITY_ID__ || '';
    if (!window.clarity && clarityId) {
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", clarityId);
    }
  }

  let analyticsInitialized = false;
  function triggerAnalytics() {
    if (analyticsInitialized) return;
    analyticsInitialized = true;
    ['scroll', 'touchstart', 'mousemove', 'keydown'].forEach(evt => {
      window.removeEventListener(evt, triggerAnalytics, { passive: true });
    });
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(initAnalyticsDelayed, { timeout: 3000 });
    } else {
      setTimeout(initAnalyticsDelayed, 1500);
    }
  }

  ['scroll', 'touchstart', 'mousemove', 'keydown'].forEach(evt => {
    window.addEventListener(evt, triggerAnalytics, { passive: true, once: true });
  });


  // ─── 部内シェア（Web Share API / クリップボードコピー） ───
  const shareBtn = document.getElementById('share-site-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const shareData = {
        title: '弓道部的中ノート',
        text: '弓道の的中記録・分析・部活のチーム管理が完全無料でできるWebアプリ「弓道部的中ノート」',
        url: window.location.origin || 'https://kyudoscoremanagehomepage.netlify.app/'
      };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          // ユーザーキャンセル時は何もしない
        }
      } else {
        // PCなど非対応環境ではクリップボードにコピー
        try {
          await navigator.clipboard.writeText(shareData.url);
          const origText = shareBtn.innerHTML;
          shareBtn.innerHTML = '✓ URLをコピーしました！';
          setTimeout(() => {
            shareBtn.innerHTML = origText;
          }, 2500);
        } catch (e) {
          alert('URL: ' + shareData.url);
        }
      }
    });
  }


  // ─── オフライン対応 Service Worker の登録（道場・圏外閲覧対応） ───
  if ('serviceWorker' in navigator && window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        // キャッシュ更新チェック
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 新しいキャッシュが準備完了
              }
            };
          }
        };
      }).catch((err) => {
        // SW非対応またはプライベートブラウズ時は静かに無視
      });
    });
  }


  // ─── オフライン / オンライン状態通知トースト ───
  function showNetworkToast(isOnline) {
    let toast = document.querySelector('.network-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'network-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    if (isOnline) {
      toast.className = 'network-toast online visible';
      toast.innerHTML = '<span>✅ インターネットに復帰しました</span>';
      setTimeout(() => toast.classList.remove('visible'), 2500);
    } else {
      toast.className = 'network-toast offline visible';
      toast.innerHTML = '<span>📶 現在オフラインです（保存済みデータで表示中）</span>';
    }
  }

  window.addEventListener('online', () => showNetworkToast(true));
  window.addEventListener('offline', () => showNetworkToast(false));


  // ─── コピーライト年号の自動同期（永久メンテナンスフリー） ───
  const currentYear = new Date().getFullYear();
  document.querySelectorAll('.copyright-year').forEach(el => {
    el.textContent = currentYear;
  });


  // ─── 読了プログレスバーの更新 ───
  const progressBar = document.getElementById('reading-progress');
  if (progressBar) {
    window.addEventListener('scroll', () => {
      const scrollTotal = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollTotal > 0) {
        const progress = (window.scrollY / scrollTotal) * 100;
        progressBar.style.width = Math.min(100, Math.max(0, progress)) + '%';
      }
    }, { passive: true });
  }

};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', 始める);
} else {
  始める();
}