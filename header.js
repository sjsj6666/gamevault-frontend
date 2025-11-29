// header.js

const headerHTML = `
<header>
  <nav>
    <div class="nav-left">
      <button class="hamburger" id="hamburger" aria-label="Menu"><span></span><span></span><span></span></button>
      <a href="/" class="logo">GAMEVAULT</a>
    </div>
    <ul class="nav-links" id="navLinks">
      <li><a href="/">Home</a></li>
      <li class="nav-item desktop-games-nav">
        <a href="/games.html">Games ▾</a>
        <div class="dropdown"></div>
      </li>
      <li class="nav-item mobile-games-nav has-submenu">
        <a href="#" id="mobile-games-toggle">Games ▾</a>
        <ul class="mobile-submenu" id="mobile-games-dropdown"></ul>
      </li>
      <li><a href="/blog.html">Blog</a></li>
      <li class="nav-item">
        <a href="#">Help Center ▾</a>
        <div class="dropdown help-dropdown">
          <a href="/account.html#help-center" class="dropdown-item"><span>📚</span><span>FAQs</span><span class="arrow">></span></a>
          <a href="/account.html#feedback" class="dropdown-item"><span>💬</span><span>Feedback</span><span class="arrow">></span></a>
        </div>
      </li>
    </ul>
    <div class="nav-right">
      <div class="search-wrapper">
        <div class="search-container" id="searchContainer">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
          <input type="text" class="search-input" id="searchInput" placeholder="Search games or goods" autocomplete="off">
        </div>
        <div id="search-results-container" class="search-results-container"></div>
      </div>
      <button id="mobile-search-trigger" class="mobile-search-trigger">
        <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>
      </button>
      <button id="header-signin-btn" class="header-signin-btn">Log in / Sign up</button>
      <a href="/account.html#messages" id="header-messages-icon" class="text-white text-2xl relative hidden">✉️</a>
      <div class="nav-item profile-area hidden">
        <div class="user-avatar"></div>
        <div class="dropdown profile-dropdown">
          <div id="profile-logged-in" style="display: none;">
            <div class="profile-header">
              <div class="profile-avatar"><img id="header-profile-avatar" src="https://i.pravatar.cc/50" alt="avatar"></div>
              <div class="profile-info">
                <div class="profile-id" id="profile-id"></div>
                <a href="/account.html#member" class="profile-vip">Check VIP Benefits ›</a>
              </div>
            </div>
            <div class="profile-stats">
              <div class="stat-item"><span class="stat-value" id="profile-balance">$0.00</span><span class="stat-label">Balance</span></div>
              <div class="stat-divider"></div>
              <div class="stat-item"><span class="stat-value" id="profile-points">0</span><span class="stat-label">Points <span class="new-badge">NEW</span></span></div>
            </div>
            <ul class="profile-menu">
              <li><a href="/account.html#buy-history" class="profile-menu-item"><div class="item-content"><span class="item-icon">📋</span><span>Buy History</span></div><div class="item-indicator">></div></a></li>
              <li><a href="/account.html#coupons" class="profile-menu-item"><div class="item-content"><span class="item-icon">🎫</span><span>Coupon</span></div><div class="item-indicator"><span id="coupon-count">0</span>></div></a></li>
              <li><a href="/account.html#settings" class="profile-menu-item"><div class="item-content"><span class="item-icon">⚙️</span><span>Settings</span></div><div class="item-indicator">></div></a></li>
              <li><a href="/account.html#help-center" class="profile-menu-item"><div class="item-content"><span class="item-icon">❓</span><span>Help Center</span></div><div class="item-indicator">></div></a></li>
              <li><a href="/account.html#feedback" class="profile-menu-item"><div class="item-content"><span class="item-icon">✍️</span><span>Feedback</span></div><div class="item-indicator">></div></a></li>
              <li><a href="/account.html#invite" class="profile-menu-item"><div class="item-content"><span class="item-icon">🎁</span><div class="item-text"><span>Invite for Coupons</span><span class="subtext">Unlock rich coupon rewards</span></div></div><div class="item-indicator">></div></a></li>
              <li><a href="/account.html#affiliate" class="profile-menu-item"><div class="item-content"><span class="item-icon">💰</span><div class="item-text"><span>Affiliate Program</span><span class="subtext">Earn up to 10% money</span></div></div><div class="item-indicator">></div></a></li>
              <li><a href="#" id="logout-button" class="profile-menu-item"><div class="item-content"><span class="item-icon">🚪</span><span>Log out</span></div></a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </nav>
</header>
<div id="auth-modal" class="modal-backdrop hidden">
  <div class="auth-modal-content">
    <button id="close-auth-modal" class="close-btn">&times;</button>
    <h2 class="modal-title">Log in / Sign up</h2>
    <div class="auth-providers">
      <button class="auth-provider-btn" data-provider="google" title="Continue with Google">G</button>
      <button class="auth-provider-btn" data-provider="discord" title="Continue with Discord">D</button>
      <button class="auth-provider-btn" data-provider="twitter" title="Continue with X/Twitter">X</button>
      <button class="auth-provider-btn" data-provider="facebook" title="Continue with Facebook">f</button>
      <button class="auth-provider-btn" data-provider="apple" title="Continue with Apple"></button>
      <button class="auth-provider-btn" data-provider="email" title="Continue with Email">✉️</button>
    </div>
    <p class="auth-legal-text">By registering an account or logging in, you agree to the <a href="#" class="auth-link">Privacy Policy</a>, <a href="#" class="auth-link">Terms of Service</a>, and <a href="#" class="auth-link">Cookie Policy</a>.</p>
    <div class="auth-social-proof">
      <div><span>⭐ 4.9</span> Trustpilot 20k+ Reviews</div>
      <div><span>🔥 30%</span> Up to 30% OFF</div>
      <div><span>🎮 10M+</span> Gamers' Choice</div>
    </div>
  </div>
</div>
`;

document.getElementById('header-placeholder').innerHTML = headerHTML;