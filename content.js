// Universal Compatibility Layer
const _runtime = (typeof browser !== 'undefined' ? browser : chrome);

console.log('%c[GMeet Attendance] PRO-SYNC ACTIVATED', 'color: #1a73e8; font-weight: bold;');

let isScraping = false;

function getMeetingId() {
  const match = window.location.pathname.match(/\/([a-z0-9\-]+)$/);
  if (match && !['landing', 'new'].includes(match[1])) return match[1];
  return null;
}

function getMeetingName() {
  // Logic from reverse-engineered extension
  const elem = document.querySelector('[data-meeting-title]');
  if (elem && elem.dataset.meetingTitle) {
    return elem.dataset.meetingTitle;
  }
  return document.title.replace(' - Google Meet', '');
}

async function scrape() {
  if (isScraping) return;
  const meetingId = getMeetingId();
  if (!meetingId) return;
  
  isScraping = true;
  const meetingName = getMeetingName();
  console.log(`[GMeet Attendance] Scraping "${meetingName}"...`);

  const findPeopleBtn = () => {
    // Priority 1: The data-avatar-count badge (most reliable)
    const badge = document.querySelector('[data-avatar-count]');
    if (badge) return badge.closest('[role="button"], button');

    // Priority 2: JSNAME
    let btn = document.querySelector('[jsname="H2Y76b"]');
    if (btn) return btn;

    // Priority 3: Aria-label fallbacks
    return document.querySelector('button[aria-label*="everyone"], button[aria-label*="peserta"], [role="button"][aria-label*="everyone"]');
  };

  const peopleBtn = findPeopleBtn();
  if (!peopleBtn) {
    isScraping = false;
    return;
  }

  const sidePanel = document.querySelector('[role="complementary"], [jsname="S3u9He"], .dqy09c');
  const isAlreadyOpen = sidePanel && sidePanel.getBoundingClientRect().width > 0;
  
  if (!isAlreadyOpen) {
    // --- GHOST MODE ---
    let style = document.getElementById('gmeet-att-ghost') || document.createElement('style');
    style.id = 'gmeet-att-ghost';
    style.innerHTML = `
      [role="complementary"], .dqy09c, [jsname="S3u9He"], .cr77db { 
        opacity: 0 !important; 
        pointer-events: none !important; 
        position: fixed !important; 
        right: -1000px !important;
        display: flex !important;
        visibility: visible !important;
      }
    `;
    if (!style.parentElement) document.head.appendChild(style);

    peopleBtn.click();
    await new Promise(r => setTimeout(r, 1500));
  }

  // --- INCREMENTAL SCROLLING (from reverse-engineered logic) ---
  const scrollContainer = document.querySelector('[jsname="S3u9He"], [role="list"]')?.parentElement;
  const participantNames = new Map(); // Use Map to store {name: avatar}

  if (scrollContainer) {
    let lastScrollTop = -1;
    while (scrollContainer.scrollTop !== lastScrollTop) {
      lastScrollTop = scrollContainer.scrollTop;
      
      // Capture what's visible now
      const elements = scrollContainer.querySelectorAll('[data-participant-id]');
      elements.forEach(el => {
        let name = '';
        const pId = el.dataset.participantId;
        const sortKey = el.dataset.sortKey;
        
        if (sortKey && pId) {
          name = sortKey.replace(pId, '').trim();
        } else {
          name = el.innerText.split('\n')[0].trim();
        }

        if (name && name.length > 1 && !name.includes(':')) {
          const img = el.querySelector('img');
          participantNames.set(name, img?.src || null);
        }
      });

      scrollContainer.scrollTop += 150;
      await new Promise(r => setTimeout(r, 150));
    }
    // Reset scroll
    scrollContainer.scrollTop = 0;
  }

  // --- CLEANUP ---
  if (!isAlreadyOpen) {
    peopleBtn.click();
    setTimeout(() => {
        document.getElementById('gmeet-att-ghost')?.remove();
    }, 500);
  }

  const uniqueParticipants = Array.from(participantNames.entries()).map(([name, avatar]) => ({
    name,
    avatar
  }));

  console.log(`[GMeet Attendance] Pro-Scraped: ${uniqueParticipants.length} participants.`);

  if (uniqueParticipants.length > 0) {
    _runtime.runtime.sendMessage({ 
      type: 'PARTICIPANT_UPDATE', 
      meetingId, 
      meetingName,
      participants: uniqueParticipants 
    }).catch(() => {});
  }
  
  isScraping = false;
}

function createUI() {
  if (document.getElementById('gmeet-att-wrap')) return;

  const wrap = document.createElement('div');
  wrap.id = 'gmeet-att-wrap';
  wrap.style.cssText = 'position:fixed; bottom:85px; right:20px; z-index:9999; display:flex; flex-direction:column; align-items:flex-end; gap:8px;';

  const btn = document.createElement('button');
  const recordText = _runtime.i18n.getMessage('recordAttendance') || 'Record Attendance';
  btn.textContent = '';
  const iconSpan = document.createElement('span');
  iconSpan.textContent = '📊';
  btn.appendChild(iconSpan);
  btn.appendChild(document.createTextNode(' ' + recordText));
  btn.style.cssText = `
    padding: 15px 25px;
    background: #FFDE59;
    color: #000;
    border: 4px solid #000;
    font-weight: 900;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 6px 6px 0px #000;
    font-size: 14px;
    font-family: 'Courier New', monospace;
    transition: all 0.1s;
  `;

  btn.onmousedown = () => {
    btn.style.transform = 'translate(4px, 4px)';
    btn.style.boxShadow = '0px 0px 0px #000';
  };

  btn.onmouseup = () => {
    btn.style.transform = 'translate(0px, 0px)';
    btn.style.boxShadow = '6px 6px 0px #000';
  };

  btn.onclick = async () => {
    btn.style.background = '#5CE1E6';
    btn.innerText = `⌛ ${_runtime.i18n.getMessage('recording') || 'RECORDING...'}`;

    await scrape();
    
    btn.style.background = '#34a853';
    btn.innerText = `✅ ${_runtime.i18n.getMessage('recorded') || 'Recorded!'}`;
    
    setTimeout(() => {
      _runtime.runtime.sendMessage({ type: 'OPEN_DASHBOARD' });
      btn.style.background = '#FFDE59';
      btn.textContent = '';
      const iconSpan = document.createElement('span');
      iconSpan.textContent = '📊';
      btn.appendChild(iconSpan);
      btn.appendChild(document.createTextNode(' ' + recordText));
    }, 1000);
  };

  wrap.appendChild(btn);
  document.body.appendChild(wrap);
}

// Start
setTimeout(async () => { 
  createUI(); 
  await scrape(); 
}, 5000);

// Auto-sync every 30 seconds (Pro logic is heavier, so we do it less often)
setInterval(async () => {
  await scrape();
}, 30000);

// Debounced observer for major UI changes
let debounceTimer;
const obs = new MutationObserver((mutations) => {
    const relevant = mutations.some(m => m.addedNodes.length > 0);
    if (!relevant) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      await scrape();
    }, 5000);
});

obs.observe(document.body, { childList: true, subtree: true });
