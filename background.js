const _runtime = (typeof browser !== 'undefined' ? browser : chrome);

_runtime.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PARTICIPANT_UPDATE') {
    handleParticipantUpdate(message.meetingId, message.participants)
      .catch(err => console.error('[GMeet Attendance] Storage error:', err));
  } else if (message.type === 'OPEN_DASHBOARD') {
    _runtime.tabs.create({ url: _runtime.runtime.getURL('dashboard.html') });
  }
  return true;
});

async function handleParticipantUpdate(meetingId, currentParticipants) {
  const result = await _runtime.storage.local.get('meetings');
  const meetings = result.meetings || {};
  const now = Date.now();

  if (!meetings[meetingId]) {
    meetings[meetingId] = { startTime: now, attendance: {} };
  }

  const meeting = meetings[meetingId];

  currentParticipants.forEach(p => {
    if (!meeting.attendance[p.name]) {
      meeting.attendance[p.name] = {
        name: p.name,
        avatar: p.avatar,
        firstSeen: now,
        lastSeen: now
      };
    } else {
      meeting.attendance[p.name].lastSeen = now;
      if (p.avatar && !meeting.attendance[p.name].avatar) {
        meeting.attendance[p.name].avatar = p.avatar;
      }
    }
  });

  await _runtime.storage.local.set({ meetings });
  
  // Notify Dashboard of live update
  _runtime.runtime.sendMessage({ type: 'DASHBOARD_REFRESH' }).catch(() => {});
}
