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
    list.innerHTML = `<div class="empty-state">${_runtime.i18n.getMessage('noData') || 'No attendance data captured yet.'}</div>`;
    return;
  }

  list.innerHTML = '';
  sortedIds.forEach(id => {
    const meeting = meetings[id];
    const section = document.createElement('div');
    section.className = 'meeting-section';

    const header = `
      <div class="meeting-header">
        <span class="meeting-id">${_runtime.i18n.getMessage('meetingId') || 'ID: '}${id}</span>
        <span class="meeting-time">${_runtime.i18n.getMessage('sessionStarted') || ''}${new Date(meeting.startTime).toLocaleString()}</span>
      </div>
    `;

    let rows = '';
    const participants = Object.values(meeting.attendance).sort((a, b) => a.firstSeen - b.firstSeen);
    
    participants.forEach(p => {
      const avatarSrc = p.avatar || 'https://lh3.googleusercontent.com/a/default-user=s32-c';
      const duration = Math.round((p.lastSeen - p.firstSeen) / 60000);
      const minStr = _runtime.i18n.getMessage(duration === 1 ? 'min' : 'mins') || (duration === 1 ? 'min' : 'mins');
      
      rows += `
        <tr>
          <td>
            <div class="participant-cell">
              <img class="avatar" src="${avatarSrc}" referrerpolicy="no-referrer" onerror="this.src='https://lh3.googleusercontent.com/a/default-user=s32-c'">
              <span style="font-weight: 900;">${p.name}</span>
            </div>
          </td>
          <td>${new Date(p.firstSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${new Date(p.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td><span class="badge">${duration} ${minStr}</span></td>
        </tr>
      `;
    });

    section.innerHTML = `
      ${header}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>${_runtime.i18n.getMessage('participant') || 'Participant'}</th>
              <th>${_runtime.i18n.getMessage('firstJoined') || 'Joined'}</th>
              <th>${_runtime.i18n.getMessage('lastSeen') || 'Last Seen'}</th>
              <th>${_runtime.i18n.getMessage('presence') || 'Presence'}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
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
