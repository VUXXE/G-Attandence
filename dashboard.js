const _runtime = (typeof browser !== 'undefined' ? browser : chrome);

// Localize static elements
document.querySelectorAll('[data-i18n]').forEach(el => {
  const key = el.getAttribute('data-i18n');
  const translation = _runtime.i18n.getMessage(key);
  if (translation) {
    el.innerText = translation;
  }
});

async function loadAttendance() {
  const result = await _runtime.storage.local.get('meetings');
  const meetings = result.meetings || {};
  const list = document.getElementById('meetingList');
  
  const sortedIds = Object.keys(meetings).sort((a, b) => meetings[b].startTime - meetings[a].startTime);

  if (sortedIds.length === 0) {
    list.textContent = '';
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = _runtime.i18n.getMessage('noData') || 'No attendance data captured yet.';
    list.appendChild(emptyState);
    return;
  }

  list.textContent = '';
  sortedIds.forEach(id => {
    const meeting = meetings[id];
    const section = document.createElement('div');
    section.className = 'meeting-section';

    // Header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'meeting-header';
    
    const idSpan = document.createElement('span');
    idSpan.className = 'meeting-id';
    idSpan.textContent = (_runtime.i18n.getMessage('meetingId') || 'ID: ') + id;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'meeting-time';
    timeSpan.textContent = (_runtime.i18n.getMessage('sessionStarted') || '') + new Date(meeting.startTime).toLocaleString();
    
    headerDiv.appendChild(idSpan);
    headerDiv.appendChild(timeSpan);
    section.appendChild(headerDiv);

    // Table
    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';
    
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    ['participant', 'firstJoined', 'lastSeen', 'presence'].forEach(key => {
      const th = document.createElement('th');
      th.textContent = _runtime.i18n.getMessage(key) || key.charAt(0).toUpperCase() + key.slice(1);
      headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const participants = Object.values(meeting.attendance).sort((a, b) => a.firstSeen - b.firstSeen);
    
    participants.forEach(p => {
      const tr = document.createElement('tr');
      
      // Participant Cell
      const tdName = document.createElement('td');
      const cellDiv = document.createElement('div');
      cellDiv.className = 'participant-cell';
      
      const img = document.createElement('img');
      img.className = 'avatar';
      img.src = p.avatar || 'https://lh3.googleusercontent.com/a/default-user=s32-c';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => { img.src = 'https://lh3.googleusercontent.com/a/default-user=s32-c'; };
      
      const nameSpan = document.createElement('span');
      nameSpan.style.fontWeight = '900';
      nameSpan.textContent = p.name;
      
      cellDiv.appendChild(img);
      cellDiv.appendChild(nameSpan);
      tdName.appendChild(cellDiv);
      tr.appendChild(tdName);

      // Joined
      const tdJoined = document.createElement('td');
      tdJoined.textContent = new Date(p.firstSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      tr.appendChild(tdJoined);

      // Last Seen
      const tdLast = document.createElement('td');
      tdLast.textContent = new Date(p.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      tr.appendChild(tdLast);

      // Presence
      const tdPresence = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = 'badge';
      const duration = Math.round((p.lastSeen - p.firstSeen) / 60000);
      const minStr = _runtime.i18n.getMessage(duration === 1 ? 'min' : 'mins') || (duration === 1 ? 'min' : 'mins');
      badge.textContent = `${duration} ${minStr}`;
      tdPresence.appendChild(badge);
      tr.appendChild(tdPresence);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    section.appendChild(tableContainer);
    
    list.appendChild(section);
  });
}

document.getElementById('savePdf').addEventListener('click', () => {
  window.print();
});

document.getElementById('saveCsv').addEventListener('click', async () => {
  const result = await _runtime.storage.local.get('meetings');
  const meetings = result.meetings || {};
  const sortedIds = Object.keys(meetings).sort((a, b) => meetings[b].startTime - meetings[a].startTime);

  if (sortedIds.length === 0) return;

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Meeting ID,Session Date,Participant,First Joined,Last Seen,Presence (mins)\r\n";

  sortedIds.forEach(id => {
    const meeting = meetings[id];
    const sessionDate = new Date(meeting.startTime).toLocaleDateString();
    const participants = Object.values(meeting.attendance).sort((a, b) => a.firstSeen - b.firstSeen);
    
    participants.forEach(p => {
      const firstJoined = new Date(p.firstSeen).toLocaleTimeString();
      const lastSeen = new Date(p.lastSeen).toLocaleTimeString();
      const duration = Math.round((p.lastSeen - p.firstSeen) / 60000);
      
      // Clean name of any commas to prevent CSV breakage
      const cleanName = p.name.replace(/,/g, '');
      csvContent += `${id},${sessionDate},${cleanName},${firstJoined},${lastSeen},${duration}\r\n`;
    });
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "gmeet_attendance.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

document.getElementById('clearData').addEventListener('click', async () => {
  if (confirm(_runtime.i18n.getMessage('confirmClear') || 'Clear all records?')) {
    await _runtime.storage.local.set({ meetings: {} });
    loadAttendance();
  }
});

// Listen for live updates from background
_runtime.runtime.onMessage.addListener((message) => {
  if (message.type === 'DASHBOARD_REFRESH') {
    loadAttendance();
  }
});

loadAttendance();
setInterval(loadAttendance, 30000); // Only as backup now
