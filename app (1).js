(() => {
  'use strict';

  /* ================= constants ================= */
  const DB_KEY = 'dlms-db-v2';
  const SESSION_KEY = 'dlms-session-v2';
  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:5000' : '';
  const YEARS = ['FE', 'SE', 'TE', 'BE'];
  const SECTIONS = ['A', 'B'];
  const STAGES = [
    { role: 'CLASS_TEACHER', label: 'Class Teacher', paper: 'Counselor/Class Teacher', yes: 'Recommended', no: 'Not recommended' },
    { role: 'WARDEN', label: 'Warden', paper: 'Warden', yes: 'Recommended', no: 'Not recommended' },
    { role: 'HOD', label: 'HOD', paper: 'HOD', yes: 'Permitted', no: 'Not permitted' },
    { role: 'JD', label: 'Joint Director', paper: 'Jt Director', yes: 'Approved', no: 'Not Approved' },
    { role: 'DIRECTOR', label: 'Director', paper: 'Director', yes: 'Sanctioned', no: 'Not sanctioned' },
  ];
  const ROLE_LABEL = {
    STUDENT: 'Student', ADMIN: 'Main Admin', CLASS_TEACHER: 'Class Teacher', WARDEN: 'Warden',
    HOD: 'HOD', JD: 'Joint Director', DIRECTOR: 'Director', GATE: 'Gate Security',
  };
  const STAFF_ROLES = ['ADMIN', 'CLASS_TEACHER', 'WARDEN', 'HOD', 'JD', 'DIRECTOR', 'GATE'];
  const ACCOUNT_ROLES = [['CLASS_TEACHER', 'Class Teachers'], ['WARDEN', 'Wardens'], ['HOD', 'HODs'], ['JD', 'Joint Director'], ['DIRECTOR', 'Director'], ['GATE', 'Gate Security']];
  const LEAVE_TYPES = { HOSTEL_LEAVE: 'Hostel leave', ACADEMIC_OUTPASS: 'Academic outpass' };
  const AVATAR_COLORS = ['#4285f4', '#ea4335', '#e3a008', '#34a853', '#1f1f1f', '#8e24aa', '#00897b'];
  const MAX_FILE = 4 * 1024 * 1024;

  const SEED_DEPTS = [
    ['COMP', 'Computer Engineering', 'Comp', 'S. R. Dhore'],
    ['IT', 'Information Technology', 'IT', 'Sangeeta Jadhav'],
    ['ENTC', 'Electronics and Telecommunication', 'EnTC', 'Sushma Patil'],
    ['MECH', 'Mechanical Engineering', 'Mech', 'U. V. Awasarmol'],
    ['ARE', 'Automation and Robotics Engineering', 'ARE', 'J. D. Patil'],
  ];
  const SEED_HOSTELS = [
    ['VISH', 'Vishweshwaraiya Hostel', ['A', 'B', 'C', 'D']],
    ['KALAM', 'Abdul Kalam Hostel', ['E', 'F', 'G']],
    ['BHABHA', 'Homi Bhabha Hostel', ['H']],
    ['BOSE', 'SN Bose Hostel', []],
    ['SARABHAI', 'Sarabhai Hostel', []],
    ['GURBIR', 'Capt. Gurbir Singh Hostel', []],
    ['RAMANUJAN', 'Ramanujan Hostel', []],
    ['KALPANA', 'Kalpana Hostel', []],
  ];

  /* ================= MERN API Client ================= */
  async function api(path, method = 'GET', body = null) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : null
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');
      return data;
    } catch (err) {
      return { _failed: true, error: err.message };
    }
  }

  /* ================= utils ================= */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const now = () => Date.now();
  const H = 36e5, D = 864e5;
  const fmt = t => t ? new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';
  const fmtDay = t => new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const toInput = t => new Date(t - new Date(t).getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  const initials = n => String(n || '?').split(/\s+/).filter(w => /\w/.test(w)).slice(0, 2).map(w => w.replace(/[^A-Za-z]/g, '')[0]?.toUpperCase() || '').join('');
  const colorFor = s => AVATAR_COLORS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  function fallbackHash(pw) {
    let h = 5381;
    for (const c of 'dlms:' + pw) h = (h * 33) ^ c.charCodeAt(0);
    return 'f' + (h >>> 0).toString(16);
  }

  async function hash(pw) {
    if (typeof window !== 'undefined' && window.crypto && crypto.subtle) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('dlms:' + pw));
        return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {}
    }
    return fallbackHash(pw);
  }

  /* ================= storage ================= */
  let db = null;
  const memStore = {};
  const load = () => {
    try {
      const data = JSON.parse(localStorage.getItem(DB_KEY));
      if (data && Array.isArray(data.users) && Array.isArray(data.leaves)) {
        if (!Array.isArray(data.departments)) data.departments = SEED_DEPTS.map(([id, name, short, hod]) => ({ id, name, short, hod }));
        if (!Array.isArray(data.hostels)) data.hostels = SEED_HOSTELS.map(([id, name, blocks]) => ({ id, name, blocks }));
        if (!Array.isArray(data.audit)) data.audit = [];
        return data;
      }
      return memStore[DB_KEY] || null;
    } catch {
      return memStore[DB_KEY] || null;
    }
  };
  const save = () => {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
      memStore[DB_KEY] = db;
    }
  };

  const files = (() => {
    let p;
    const memFiles = new Map();
    const open = () => p || (p = new Promise(res => {
      try {
        if (!window.indexedDB) return res(null);
        const r = indexedDB.open('dlms-files', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('files');
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      } catch {
        res(null);
      }
    }));
    const tx = async (mode, fn) => {
      try {
        const d = await open();
        if (!d) return null;
        return new Promise(res => {
          const t = d.transaction('files', mode);
          const q = fn(t.objectStore('files'));
          t.oncomplete = () => res(q?.result);
          t.onerror = () => res(null);
        });
      } catch {
        return null;
      }
    };
    return {
      put: async (id, blob, name = 'file', type = '') => {
        await tx('readwrite', s => s.put(blob, id));
        memFiles.set(id, blob);
        // Also sync to MongoDB via API
        try {
          const reader = new FileReader();
          reader.onload = async () => {
            await api('/api/files', 'POST', { id, name, type, size: blob.size, data: reader.result });
          };
          reader.readAsDataURL(blob);
        } catch {}
        return id;
      },
      get: async id => {
        const r = await tx('readonly', s => s.get(id));
        if (r) return r;
        if (memFiles.has(id)) return memFiles.get(id);
        // Try fetching from Mongo API
        const remote = await api(`/api/files/${id}`);
        if (remote && !remote._failed && remote.data) {
          try {
            const res = await fetch(remote.data);
            return await res.blob();
          } catch {}
        }
        return null;
      }
    };
  })();

  const user = id => (db?.users || []).find(u => u.id === id) || null;
  const deptOf = id => (db?.departments || []).find(d => d.id === id);
  const dept = id => deptOf(id)?.name || '—';
  const deptShort = id => deptOf(id)?.short || '—';
  const hostelOf = id => (db?.hostels || []).find(h => h.id === id);
  const hostel = id => hostelOf(id)?.name || '—';
  const classLabel = c => c ? `${c.year} ${deptShort(c.departmentId)} ${c.section}` : '—';
  const where = p => `${hostel(p.hostelId)}${p.block ? ', Flank ' + p.block : ''}, Room ${p.roomNo}`;
  const student = l => user(l?.studentId) || {
    id: l?.studentId || 'unknown',
    name: 'Student',
    role: 'STUDENT',
    profile: l?.snapshot || { regNo: '250361', year: 'FE', section: 'A', departmentId: 'COMP', hostelId: 'VISH', roomNo: '—', phone: '—', parentPhone: '—' }
  };

  async function seed() {
    const studentPw = await hash('password123');
    const teacherPw = await hash('teacher123');
    const s1Id = uid();
    const s2Id = uid();
    const teacherId = uid();
    const wardenId = uid();
    const nowTime = now();

    const sampleLeaves = [
      {
        id: uid(),
        studentId: s1Id,
        type: 'HOSTEL_LEAVE',
        reason: 'National Level Hackathon at IIT Bombay',
        address: 'Hostel 12, IIT Bombay, Powai, Mumbai - 400076',
        fromAt: nowTime + 24 * 36e5,
        toAt: nowTime + 96 * 36e5,
        hostelId: 'VISH',
        block: 'A',
        roomNo: '204',
        attendance: 88.5,
        lastSem: 84.2,
        informedParents: true,
        parentConfirm: true,
        mobile: '9876543210',
        guardianMobile: '9876543211',
        signature: 'VERIFIED',
        docs: [],
        snapshot: { regNo: '250361', year: 'SE', section: 'A', departmentId: 'COMP' },
        status: 'PENDING_CLASS_TEACHER',
        createdAt: nowTime - 3 * 36e5,
        approvals: STAGES.map((s, i) => ({ stage: i + 1, role: s.role, decision: 'PENDING', actedBy: null, actorName: '', note: '', actedAt: null }))
      },
      {
        id: uid(),
        studentId: s2Id,
        type: 'ACADEMIC_OUTPASS',
        reason: 'Technical Project Expo & Paper Presentation',
        address: 'COEP Technological University, Shivajinagar, Pune',
        fromAt: nowTime + 12 * 36e5,
        toAt: nowTime + 36 * 36e5,
        hostelId: 'KALAM',
        block: 'E',
        roomNo: '312',
        attendance: 92.0,
        lastSem: 89.5,
        informedParents: true,
        parentConfirm: true,
        mobile: '9876543220',
        guardianMobile: '9876543221',
        signature: 'VERIFIED',
        docs: [],
        snapshot: { regNo: '240362', year: 'SE', section: 'A', departmentId: 'COMP' },
        status: 'PENDING_WARDEN',
        createdAt: nowTime - 12 * 36e5,
        approvals: [
          { stage: 1, role: 'CLASS_TEACHER', decision: 'APPROVED', actedBy: teacherId, actorName: 'Prof. Anjali Mehta', note: 'Recommended. Good academic record.', actedAt: nowTime - 8 * 36e5 },
          { stage: 2, role: 'WARDEN', decision: 'PENDING', actedBy: null, actorName: '', note: '', actedAt: null },
          { stage: 3, role: 'HOD', decision: 'PENDING', actedBy: null, actorName: '', note: '', actedAt: null },
          { stage: 4, role: 'JD', decision: 'PENDING', actedBy: null, actorName: '', note: '', actedAt: null },
          { stage: 5, role: 'DIRECTOR', decision: 'PENDING', actedBy: null, actorName: '', note: '', actedAt: null },
        ]
      }
    ];

    return {
      departments: SEED_DEPTS.map(([id, name, short, hod]) => ({ id, name, short, hod })),
      hostels: SEED_HOSTELS.map(([id, name, blocks]) => ({ id, name, blocks })),
      users: [
        { id: 'admin', role: 'ADMIN', name: 'Main Admin', email: 'admin@gmail.com', passwordHash: await hash('admin123'), isActive: true, mustChange: false, createdAt: nowTime },
        {
          id: s1Id, role: 'STUDENT', name: 'Rahul Sharma', email: '250361@college.edu', passwordHash: studentPw, isActive: true, mustChange: false, createdAt: nowTime - 864e5 * 2,
          profile: { regNo: '250361', phone: '9876543210', parentPhone: '9876543211', year: 'SE', departmentId: 'COMP', section: 'A', hostelId: 'VISH', block: 'A', roomNo: '204' }
        },
        {
          id: s2Id, role: 'STUDENT', name: 'Priya Verma', email: '240362@college.edu', passwordHash: studentPw, isActive: true, mustChange: false, createdAt: nowTime - 864e5 * 3,
          profile: { regNo: '240362', phone: '9876543220', parentPhone: '9876543221', year: 'SE', departmentId: 'COMP', section: 'A', hostelId: 'KALAM', block: 'E', roomNo: '312' }
        },
        {
          id: teacherId, role: 'CLASS_TEACHER', name: 'Prof. Anjali Mehta', email: 'teacher@gmail.com', passwordHash: teacherPw, isActive: true, mustChange: false,
          scope: { year: 'SE', departmentId: 'COMP', section: 'A' }, createdAt: nowTime - 864e5 * 10
        },
        {
          id: wardenId, role: 'WARDEN', name: 'Dr. R. K. Nair', email: 'warden@gmail.com', passwordHash: await hash('warden123'), isActive: true, mustChange: false,
          scope: { hostelId: 'VISH' }, createdAt: nowTime - 864e5 * 10
        }
      ],
      leaves: sampleLeaves, audit: [],
    };
  }

  /* ================= workflow rules ================= */
  const stageIndex = role => STAGES.findIndex(s => s.role === role);
  const isPending = l => l.status.startsWith('PENDING_');
  const isActive = l => l.status === 'APPROVED' && l.toAt >= now();
  const onLeaveNow = l => l.status === 'APPROVED' && l.fromAt <= now() && l.toAt >= now();
  const waitingFor = l => isPending(l) ? STAGES[stageIndex(l.status.slice(8))].label : '';

  const AUTHORITY_ROLES = ['CLASS_TEACHER', 'WARDEN', 'HOD', 'JD', 'DIRECTOR'];

  // Authorities only see their own work (Completed / Rejected / Needs Action) and never generic "Pending"
  const statusText = (l, forRole = me?.role) => {
    if (AUTHORITY_ROLES.includes(forRole)) {
      const sIdx = stageIndex(forRole);
      const myApp = l.approvals?.[sIdx];
      if (myApp?.decision === 'APPROVED') return 'Completed';
      if (myApp?.decision === 'REJECTED') return 'Rejected';
      if (l.status === 'CANCELLED') return 'Withdrawn';
      if (l.status === 'PENDING_' + forRole) return 'Needs Action';
      return 'Completed';
    }
    return isPending(l) ? `Pending · ${waitingFor(l)}` : l.status === 'CANCELLED' ? 'Withdrawn' : l.status[0] + l.status.slice(1).toLowerCase();
  };

  const statusClass = (l, forRole = me?.role) => {
    if (AUTHORITY_ROLES.includes(forRole)) {
      const sIdx = stageIndex(forRole);
      const myApp = l.approvals?.[sIdx];
      if (myApp?.decision === 'APPROVED') return 'APPROVED';
      if (myApp?.decision === 'REJECTED') return 'REJECTED';
      if (l.status === 'CANCELLED') return 'CANCELLED';
      if (l.status === 'PENDING_' + forRole) return 'PENDING';
      return 'APPROVED';
    }
    return isPending(l) ? 'PENDING' : l.status;
  };

  // who may SEE a request
  function canSee(u, l) {
    const p = student(l)?.profile;
    if (!p) return false;
    if (u.role === 'ADMIN' || u.role === 'GATE') return true;

    // Check scope first
    let inScope = false;
    switch (u.role) {
      case 'CLASS_TEACHER':
        inScope = (!u.scope?.year || u.scope.year === p.year) &&
                  (!u.scope?.departmentId || u.scope.departmentId === p.departmentId) &&
                  (!u.scope?.section || u.scope.section === p.section);
        break;
      case 'WARDEN':
        inScope = !u.scope?.hostelId || u.scope.hostelId === l.hostelId;
        break;
      case 'HOD':
        inScope = !u.scope?.departmentId || u.scope.departmentId === p.departmentId;
        break;
      case 'JD':
      case 'DIRECTOR':
        inScope = true;
        break;
      default:
        return false;
    }
    if (!inScope) return false;

    // Sequential workflow rule:
    // Higher authorities (Warden, HOD, JD, Director) must NOT see a request
    // until ALL prior stages have approved it (e.g. if Class Teacher is pending, Warden/HOD/JD/Director must not see it)
    const sIdx = stageIndex(u.role);
    if (sIdx > 0) {
      for (let k = 0; k < sIdx; k++) {
        if (l.approvals?.[k]?.decision !== 'APPROVED') return false;
      }
    }
    return true;
  }

  // who may ACT on a request (stage + scope)
  function canAct(u, l) {
    if (!u.isActive || l.status !== 'PENDING_' + u.role) return false;
    if (u.role === 'WARDEN') return u.scope?.hostelId === l.hostelId;
    return canSee(u, l);
  }

  async function decide(actor, leaveId, decision, note) {
    db = load();
    const l = db.leaves.find(x => x.id === leaveId);
    const meUser = user(actor.id);
    if (!l || !meUser || !canAct(meUser, l)) throw new Error('This request is no longer waiting for you.');
    note = (note || '').trim();
    if (decision === 'REJECTED' && !note) throw new Error('Add a note so the student knows why.');
    const i = stageIndex(meUser.role);
    const from = l.status;
    Object.assign(l.approvals[i], { decision, actedBy: meUser.id, actorName: meUser.name, note, actedAt: now() });
    l.status = decision === 'REJECTED' ? 'REJECTED' : i === 4 ? 'APPROVED' : 'PENDING_' + STAGES[i + 1].role;
    db.audit.push({ id: uid(), leaveId, actorId: meUser.id, action: decision === 'REJECTED' ? 'REJECT' : 'APPROVE', from, to: l.status, at: now() });
    save();

    // Sync to MERN MongoDB
    await api(`/api/leaves/${leaveId}/decide`, 'POST', { actorId: meUser.id, decision, note });
  }

  /* ================= state ================= */
  let me = null;
  const ui = {
    auth: 'STUDENT', staffRole: 'ADMIN', screen: 'login', error: '', lastLogin: '',
    view: '', hostelF: '', yearF: '', sectionF: '', deptF: '',
    adminRole: 'CLASS_TEACHER', upload: [], gate: null, recent: [],
  };
  const app = $('#app');
  const dialog = $('#dialog');
  const snack = msg => {
    const s = $('#snack'); if (!s) return;
    s.textContent = msg; s.classList.add('show');
    clearTimeout(snack.t); snack.t = setTimeout(() => s.classList.remove('show'), 3200);
  };
  const setSession = u => {
    me = u;
    try {
      u ? localStorage.setItem(SESSION_KEY, u.id) : localStorage.removeItem(SESSION_KEY);
    } catch {}
  };
  const defaultView = role => ({ STUDENT: 'all', ADMIN: 'accounts', GATE: 'verify' }[role] || 'action');

  /* ================= shared pieces ================= */
  const dots = (c = ['#1f1f1f', '#1f1f1f', '#1f1f1f']) => `<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="6" cy="9" r="2.4" fill="${c[0]}"/><circle cx="12" cy="14" r="2.4" fill="${c[1]}"/><circle cx="18" cy="9" r="2.4" fill="${c[2]}"/></svg>`;
  const avatar = (name, size = 38) => `<span class="avatar" style="background:${colorFor(name)};width:${size}px;height:${size}px;font-size:${Math.round(size * .36)}px">${esc(initials(name))}</span>`;
  const statusChip = l => `<span class="status ${statusClass(l)}">${esc(statusText(l))}</span>`;
  const err = m => m ? `<div class="form-error"><span class="ms">error</span><span>${esc(m)}</span></div>` : '';
  const options = (list, sel, ph) => (ph != null ? `<option value="">${esc(ph)}</option>` : '') + list.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const deptOpts = () => (db?.departments || []).map(d => [d.id, d.name]);
  const hostelOpts = () => (db?.hostels || []).map(h => [h.id, h.name]);
  const blockOpts = (hid, sel) => {
    const b = hostelOf(hid)?.blocks || [];
    return b.length ? options(b.map(x => [x, x]), sel) : '<option value="">Not specified</option>';
  };

  function timeline(l) {
    return `<ol class="timeline">${l.approvals.map((a, i) => {
      let cls = '', icon = i + 1, sub = '—';
      if (a.decision === 'APPROVED') { cls = 'done'; icon = '<span class="ms">check</span>'; sub = `${esc(a.actorName)}<br>${fmt(a.actedAt)}`; }
      else if (a.decision === 'REJECTED') { cls = 'failed'; icon = '<span class="ms">close</span>'; sub = `Rejected by ${esc(a.actorName)}<br>${fmt(a.actedAt)}`; }
      else if (l.status === 'PENDING_' + a.role) { cls = 'now'; icon = '<span class="ms">hourglass_top</span>'; sub = 'Waiting'; }
      return `<li class="${cls}"><span class="c">${icon}</span><b>${STAGES[i].label}</b><small>${sub}</small></li>`;
    }).join('')}</ol>`;
  }

  function rejectionNote(l) {
    const r = l.approvals.find(a => a.decision === 'REJECTED');
    return r ? `<div class="note red"><span class="ms">feedback</span><div><b>${STAGES[stageIndex(r.role)].label}: </b>${esc(r.note)}</div></div>` : '';
  }

  function topbar() {
    const sub = me.role === 'STUDENT' ? me.profile.regNo : me.email;
    return `<header class="topbar glass">
      <div class="logo">${dots(['#4285f4', '#ea4335', '#34a853'])}<span><b>DLMS</b></span></div>
      <span class="role-tag">${esc(ROLE_LABEL[me.role])}</span>
      <span class="spacer"></span>
      <div class="me"><div class="who">${esc(me.name)}<small>${esc(sub)}</small></div>${avatar(me.name)}</div>
      <button class="icon-btn" data-action="openChangePw" title="Change password" aria-label="Change password"><span class="ms">key</span></button>
      <button class="icon-btn" data-action="logout" title="Sign out" aria-label="Sign out"><span class="ms">logout</span></button>
    </header>`;
  }

  function shell(items, content, compose = '') {
    const nav = items.map(it => it.heading
      ? `<h6>${esc(it.heading)}</h6>`
      : `<button class="nav-item ${ui.view === it.key ? 'active' : ''}" data-action="view" data-view="${it.key}"><span class="ms">${it.icon}</span><span>${esc(it.label)}</span>${it.count != null ? `<span class="n">${it.count}</span>` : ''}</button>`).join('');
    return `${topbar()}<div class="shell"><aside class="side glass">${compose}${nav}</aside><main class="content">${content}</main></div>`;
  }

  /* ================= login / register ================= */
  function loginView() {
    const staff = ui.auth === 'STAFF';
    return `<section class="login">
      <div class="login-card glass">
        <div class="login-left">
          <div class="brand"><span class="dots">${dots()}</span><span class="name">DLMS</span></div>
          <div class="art" aria-hidden="true">
            <i class="pillar" style="left:60px;top:0;height:320px"></i><i class="pillar" style="left:150px;top:40px;height:120px;opacity:.8"></i>
            <i class="ring" style="left:44px;top:110px;width:160px;height:160px"></i>
            <i class="orb" style="left:70px;top:136px;width:110px;height:110px"></i><i class="orb" style="left:0;top:40px;width:50px;height:50px"></i><i class="orb" style="left:170px;top:0;width:24px;height:24px"></i>
          </div>
          <div>
            <div class="chips"><span class="chip dark">Hostel leave</span><span class="chip">Academic outpass</span><span class="chip">Gate verification</span></div>
            <h1>Digital Leave<br>Management</h1>
          </div>
          <div class="flow">
            <span>Student</span><span class="ms">chevron_right</span><span>Class Teacher</span><span class="ms">chevron_right</span><span>Warden</span><span class="ms">chevron_right</span><span>HOD</span><span class="ms">chevron_right</span><span>JD</span><span class="ms">chevron_right</span><span>Director</span><span class="ms">chevron_right</span><span>Gate</span>
          </div>
        </div>
        <div class="auth glass">
          <h2>Sign in</h2>
          <div class="seg" role="group" aria-label="Account type">
            <button type="button" data-action="authMode" data-mode="STUDENT" aria-pressed="${!staff}">Student</button>
            <button type="button" data-action="authMode" data-mode="STAFF" aria-pressed="${staff}">Admin</button>
          </div>
          <form data-form="login" novalidate>
            ${staff ? `<label class="field"><span>Login as</span><select name="role" data-change="staffRole">${options(STAFF_ROLES.map(r => [r, ROLE_LABEL[r]]), ui.staffRole)}</select></label>` : ''}
            <label class="field"><span>${staff ? 'Email' : 'Registration number (e.g. 250361) or email'}</span><input name="login" autocomplete="username" value="${esc(ui.lastLogin)}" placeholder="${staff ? 'admin@gmail.com' : 'e.g. 250361 or 240362'}" required></label>
            <label class="field pw"><span>Password</span><input name="password" type="password" autocomplete="current-password" required><button type="button" class="icon-btn" data-action="togglePw" aria-label="Show password"><span class="ms">visibility</span></button></label>
            ${err(ui.error)}
            <button class="btn filled block" type="submit">Sign in</button>
          </form>
          ${staff ? '' : '<div class="row"><span>New here? <button class="linkish" data-action="goRegister">Create account</button></span></div>'}
        </div>
      </div>
    </section>`;
  }

  function registerView() {
    const h = ui.regHostel || db.hostels[0]?.id;
    return `<section class="register glass">
      <button class="btn text" data-action="goLogin" style="margin-left:-12px"><span class="ms">arrow_back</span>Sign in</button>
      <h2>Create student account</h2>
      <p>Use your college registration number (e.g. 250361, 240362).</p>
      <form data-form="register" novalidate>
        <div class="grid3">
          <label class="field span2"><span>Full name</span><input name="name" placeholder="Full name" required></label>
          <label class="field"><span>Registration number</span><input name="regNo" placeholder="e.g. 250361" required inputmode="numeric" maxlength="12"></label>
          <label class="field"><span>Year</span><select name="year">${options(YEARS.map(y => [y, y]), '', 'Select')}</select></label>
          <label class="field"><span>Branch</span><select name="departmentId">${options(deptOpts(), '', 'Select')}</select></label>
          <label class="field"><span>Section</span><select name="section">${options(SECTIONS.map(s => [s, s]), '', 'Select')}</select></label>
          <label class="field"><span>Hostel</span><select name="hostelId" data-change="hostelBlocks">${options(hostelOpts(), h)}</select></label>
          <label class="field"><span>Flank</span><select name="block">${blockOpts(h)}</select></label>
          <label class="field"><span>Room number</span><input name="roomNo" placeholder="Room No" required></label>
          <label class="field"><span>College email</span><input name="email" type="email" placeholder="student@college.edu" required></label>
          <label class="field"><span>Mobile number</span><input name="phone" inputmode="numeric" maxlength="10" placeholder="10-digit mobile" required></label>
          <label class="field"><span>Father / guardian mobile</span><input name="parentPhone" inputmode="numeric" maxlength="10" placeholder="10-digit mobile" required></label>
          <label class="field"><span>Password</span><input name="password" type="password" autocomplete="new-password" required><small>At least 6 characters</small></label>
          <label class="field"><span>Confirm password</span><input name="confirm" type="password" autocomplete="new-password" required></label>
        </div>
        ${err(ui.error)}
        <div><button class="btn filled" type="submit">Create account</button></div>
      </form>
    </section>`;
  }

  /* ================= the digital paper form ================= */
  function paper(l) {
    const s = student(l), p = s.profile, snap = l.snapshot || p;
    const blank = v => `<span class="fill">${esc(v) || '&nbsp;'}</span>`;
    const pick = (yes, a, b) => yes ? `${a}/<span class="strike">${b}</span>` : `<span class="strike">${a}</span>/${b}`;
    const block = (a, i) => {
      const st = STAGES[i];
      let phrase = `${st.yes}/${st.no}`, stamp, who = '';
      if (a.decision === 'APPROVED') { phrase = pick(true, st.yes, st.no); stamp = `<span class="vstamp ok"><span class="ms">verified</span>VERIFIED</span>`; who = `${esc(a.actorName)} · ${fmt(a.actedAt)}${a.note ? `<br>“${esc(a.note)}”` : ''}`; }
      else if (a.decision === 'REJECTED') { phrase = pick(false, st.yes, st.no); stamp = `<span class="vstamp no"><span class="ms">cancel</span>${st.no.toUpperCase()}</span>`; who = `${esc(a.actorName)} · ${fmt(a.actedAt)}<br>“${esc(a.note)}”`; }
      else if (l.status === 'PENDING_' + a.role) { stamp = `<span class="vstamp wait"><span class="ms">hourglass_top</span>Waiting for ${st.label}</span>`; }
      else stamp = `<span class="vstamp idle">${isPending(l) ? 'Not yet reached' : '—'}</span>`;
      return `<div class="ap ${i === 4 ? 'wide' : ''}"><div class="phrase">${phrase}</div>${stamp}${who ? `<div class="who">${who}</div>` : ''}<div class="role">${st.paper}</div></div>`;
    };
    return `<article class="paper" id="paper-${l.id}">
      <div class="paper-top"><span>${LEAVE_TYPES[l.type]}</span><span>No. ${esc(l.id.slice(0, 8).toUpperCase())}</span></div>
      <h3>APPLICATION FOR LEAVE: STUDENTS</h3>
      <p>I, ${esc(snap.gender || 'Mr/Miss')} ${blank(s.name)} <span class="lbl">(Name)</span> ${blank(deptShort(snap.departmentId))} <span class="lbl">(Branch)</span> ${blank(snap.year + ' ' + snap.section)} <span class="lbl">(Year)</span>
      ${blank(snap.regNo)} <span class="lbl">(Regn No)</span> ${blank(hostel(l.hostelId) + ', Room ' + l.roomNo)} <span class="lbl">(Hostel)</span> ${blank(l.block || '—')} <span class="lbl">(Flank)</span>, hereby request for leave
      from ${blank(fmtDay(l.fromAt))} to ${blank(fmtDay(l.toAt))} due to ${blank(l.reason)} <span class="lbl">(reason)</span>. My address while on leave will be as follows:-</p>
      <div class="cols">
        <div>
          <div class="addr">${esc(l.address).replace(/\n/g, '<br>')}</div>
          <div class="lbl">(Complete postal address)</div>
          <div class="sigrow"><span class="lbl">(Student Verification)</span> <span class="vstamp ok" style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;font-size:11px;font-weight:700;border-radius:4px"><span class="ms" style="font-size:13px">verified</span>VERIFIED</span></div>
          <div>${blank(l.guardianMobile)}</div>
          <div class="lbl">(Mobile No of Father/Local Guardian)</div>
        </div>
        <div>
          <p>My attendance is ${blank(l.attendance)} %</p>
          <p>I have scored ${blank(l.lastSem)} % in last Semester.</p>
          <p>I have ${pick(l.informedParents, 'informed', 'not informed')} my parents.</p>
          <p>Mobile No: ${blank(l.mobile)}</p>
          <p>Whether email/SMS/FAX received from parents: ${pick(l.parentConfirm, 'Yes', 'No')}</p>
        </div>
      </div>
      <div class="approvals">${l.approvals.map(block).join('')}</div>
      <div class="paper-meta"><span>Submitted ${fmt(l.createdAt)} · Leave ${fmt(l.fromAt)} → ${fmt(l.toAt)}</span><span>${statusText(l)}</span></div>
    </article>`;
  }

  function attachments(l) {
    if (!l.docs?.length) return '';
    return `<div class="section-label">Documents</div><div class="doc-list">${l.docs.map(d => `
      <button class="doc" data-action="openFile" data-id="${d.id}" data-name="${esc(d.name)}"><span class="ms">${d.type.startsWith('image/') ? 'image' : 'picture_as_pdf'}</span><span><b>${esc(d.name)}</b><small>${kb(d.size)}</small></span></button>`).join('')}</div>`;
  }

  function docDialog(id) {
    const l = db.leaves.find(x => x.id === id);
    if (!l) return;
    const s = student(l);
    const actionable = canAct(me, l);
    dialog.className = 'wide';
    dialog.innerHTML = `<div class="dlg">
      <div class="dlg-head">
        <div style="display:flex;gap:14px;align-items:center">${avatar(s.name, 44)}<div><h2>${esc(s.name)}</h2><p>${esc(s.profile.regNo)} · ${esc(classLabel(s.profile))} · ${statusText(l)}</p></div></div>
        <div style="display:flex;gap:4px">
          <button class="icon-btn" data-action="print" data-id="${l.id}" title="Print / save as PDF" aria-label="Print"><span class="ms">print</span></button>
          <button class="icon-btn" data-action="closeDialog" aria-label="Close"><span class="ms">close</span></button>
        </div>
      </div>
      ${paper(l)}
      ${attachments(l)}
      ${actionable ? `<form data-form="decide" data-id="${l.id}" novalidate class="decide">
        <label class="field"><span>Note</span><textarea name="note" placeholder="Required when rejecting"></textarea></label>
        <div class="dlg-err"></div>
        <div class="dlg-actions">
          <button class="btn danger" type="submit" name="decision" value="REJECTED"><span class="ms">close</span>${STAGES[stageIndex(me.role)].no}</button>
          <button class="btn green" type="submit" name="decision" value="APPROVED"><span class="ms">check</span>${STAGES[stageIndex(me.role)].yes}</button>
        </div>
      </form>` : ''}
      ${me.role === 'STUDENT' && isPending(l) ? `<div class="dlg-actions"><button class="btn danger" data-action="withdraw" data-id="${l.id}">Withdraw application</button></div>` : ''}
    </div>`;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
  }

  /* ================= student ================= */
  function studentView() {
    const mine = (db.leaves || []).filter(l => l.studentId === me.id).sort((a, b) => b.createdAt - a.createdAt);
    const sets = {
      all: mine, active: mine.filter(isActive), pending: mine.filter(isPending),
      approved: mine.filter(l => l.status === 'APPROVED'), rejected: mine.filter(l => l.status === 'REJECTED'), withdrawn: mine.filter(l => l.status === 'CANCELLED'),
    };
    const items = [
      { key: 'all', icon: 'inbox', label: 'All applications', count: sets.all.length },
      { key: 'active', icon: 'event_available', label: 'Active', count: sets.active.length },
      { key: 'pending', icon: 'hourglass_top', label: 'Pending', count: sets.pending.length },
      { key: 'approved', icon: 'task_alt', label: 'Approved', count: sets.approved.length },
      { key: 'rejected', icon: 'cancel', label: 'Rejected', count: sets.rejected.length },
      { key: 'withdrawn', icon: 'undo', label: 'Withdrawn', count: sets.withdrawn.length },
    ];
    const compose = `<button class="compose" data-action="view" data-view="new"><span class="ms">edit</span>New leave</button>`;
    const p = me.profile || { regNo: '—', year: '—', section: '—', departmentId: '' };
    let content;
    if (ui.view === 'new') content = applyForm();
    else {
      const list = sets[ui.view] || mine;
      const title = items.find(i => i.key === ui.view)?.label || 'All applications';
      content = `<div class="page-head"><div><h1>${esc(title)}</h1><p>${esc(p.regNo)} · ${esc(classLabel(p))} · ${esc(where(p))}</p></div></div>
        ${list.length ? `<div class="req-list">${list.map(reqCard).join('')}</div>`
          : `<section class="panel glass"><div class="empty"><span class="ms">inbox</span>Nothing here.${ui.view === 'all' ? ' <button class="linkish" data-action="view" data-view="new">Apply for leave</button>' : ''}</div></section>`}`;
    }
    return shell(items, content, compose);
  }

  function reqCard(l) {
    return `<article class="req glass click" data-action="openDoc" data-id="${l.id}">
      <div class="req-head">
        <div>
          <h3><span class="type">${LEAVE_TYPES[l.type]}</span>${esc(l.reason)}</h3>
          <p>${fmt(l.fromAt)} → ${fmt(l.toAt)} · ${esc(l.address.split('\n')[0])}</p>
        </div>
        ${statusChip(l)}
      </div>
      ${timeline(l)}
      ${rejectionNote(l)}
      <div class="req-foot"><span>Applied ${fmt(l.createdAt)}${l.docs?.length ? ` · ${l.docs.length} document${l.docs.length > 1 ? 's' : ''}` : ''}</span><span class="linkish">View form</span></div>
    </article>`;
  }

  function applyForm() {
    const p = me.profile || { regNo: '—', year: '—', section: '—', departmentId: '' };
    const start = now() + 2 * H, end = now() + 2 * D;
    return `<div class="page-head"><div><h1>Application for leave</h1><p>Fill the form. It goes to your Class Teacher first.</p></div></div>
    <section class="panel glass">
      <form data-form="apply" novalidate>
        <h4 class="form-sec">Student</h4>
        <div class="grid4">
          <label class="field"><span>Name</span><input value="${esc(me.name)}" readonly></label>
          <label class="field"><span>Regn No</span><input value="${esc(p.regNo)}" readonly></label>
          <label class="field"><span>Branch</span><input value="${esc(dept(p.departmentId))}" readonly></label>
          <label class="field"><span>Year · Section</span><input value="${esc(p.year)} · ${esc(p.section)}" readonly></label>
        </div>
        <h4 class="form-sec">Leave</h4>
        <div class="grid4">
          <label class="field"><span>Leave type</span><select name="type">${options(Object.entries(LEAVE_TYPES))}</select></label>
          <label class="field"><span>Hostel</span><select name="hostelId" data-change="hostelBlocks">${options(hostelOpts(), p.hostelId)}</select></label>
          <label class="field"><span>Flank</span><select name="block">${blockOpts(p.hostelId, p.block)}</select></label>
          <label class="field"><span>Room</span><input name="roomNo" value="${esc(p.roomNo || '')}" required></label>
          <label class="field"><span>From</span><input name="fromAt" type="datetime-local" value="${toInput(start)}" required></label>
          <label class="field"><span>To</span><input name="toAt" type="datetime-local" value="${toInput(end)}" required></label>
          <label class="field span2"><span>Reason</span><input name="reason" placeholder="e.g. Hackathon, family function" required></label>
          <label class="field span2"><span>Address while on leave</span><textarea name="address" placeholder="Complete postal address" required></textarea></label>
          <div class="span2 grid2">
            <label class="field"><span>Attendance %</span><input name="attendance" type="number" min="0" max="100" step="0.1" required></label>
            <label class="field"><span>Last semester %</span><input name="lastSem" type="number" min="0" max="100" step="0.01" required></label>
          </div>
        </div>
        <h4 class="form-sec">Contact & parents</h4>
        <div class="grid4">
          <label class="field"><span>Mobile No</span><input name="mobile" value="${esc(p.phone || '')}" inputmode="numeric" maxlength="10" required></label>
          <label class="field"><span>Father / guardian mobile</span><input name="guardianMobile" value="${esc(p.parentPhone || '')}" inputmode="numeric" maxlength="10" required></label>
          <div class="field"><span>I have</span><div class="checks"><label class="check"><input type="radio" name="informedParents" value="1" checked>Informed parents</label><label class="check"><input type="radio" name="informedParents" value="0">Not informed</label></div></div>
          <div class="field"><span>Email/SMS/FAX from parents</span><div class="checks"><label class="check"><input type="radio" name="parentConfirm" value="1">Yes</label><label class="check"><input type="radio" name="parentConfirm" value="0" checked>No</label></div></div>
        </div>
        <h4 class="form-sec">Documents <small>optional</small></h4>
        <label class="drop"><input type="file" name="docs" multiple accept="image/*,application/pdf" data-change="pickFiles" hidden>
          <span class="ms">upload_file</span><b>Upload proof</b><small>Invitation, letter, ticket… Images or PDF, up to 4 MB each</small></label>
        <div class="upload-list" id="uploadList">${uploadList()}</div>
        <div class="student-verify-badge" style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(52,168,83,0.1);border:1px solid rgba(52,168,83,0.3);border-radius:8px;color:#1e7e34;font-size:13px;font-weight:600;margin:16px 0 10px">
          <span class="ms" style="font-size:18px">verified</span> Verified Student Submission · Digital Verification
        </div>
        <label class="check confirm"><input type="checkbox" name="declare">I confirm these details are correct.</label>
        <div class="apply-err"></div>
        <div class="dlg-actions" style="justify-content:flex-start">
          <button class="btn filled" type="submit"><span class="ms">send</span>Submit application</button>
          <button class="btn text" type="button" data-action="view" data-view="all">Cancel</button>
        </div>
      </form>
    </section>`;
  }

  const uploadList = () => ui.upload.map((f, i) => `<div class="up"><span class="ms">${f.type.startsWith('image/') ? 'image' : 'picture_as_pdf'}</span><span>${esc(f.name)}<small>${kb(f.size)}</small></span><button type="button" class="icon-btn" data-action="removeFile" data-i="${i}" aria-label="Remove"><span class="ms">close</span></button></div>`).join('');

  /* ================= authorities ================= */
  function scopeText(u) {
    switch (u.role) {
      case 'CLASS_TEACHER': return 'Class ' + classLabel(u.scope);
      case 'WARDEN': return hostel(u.scope?.hostelId);
      case 'HOD': return dept(u.scope?.departmentId);
      case 'JD': return 'Joint Director · stage 4';
      case 'DIRECTOR': return 'Final approval · stage 5';
      case 'GATE': return 'Gate';
      default: return '';
    }
  }
  const hostelFilterRoles = ['WARDEN', 'JD', 'DIRECTOR'];

  function authorityView() {
    if (ui.hostelF === '' && me.role === 'WARDEN' && !ui.hostelTouched) ui.hostelF = me.scope?.hostelId || '';
    let visible = (db?.leaves || []).filter(l => canSee(me, l));
    if (hostelFilterRoles.includes(me.role) && ui.hostelF) visible = visible.filter(l => l.hostelId === ui.hostelF);
    if (me.role === 'HOD' && ui.yearF) visible = visible.filter(l => student(l)?.profile?.year === ui.yearF);
    if (['HOD', 'WARDEN', 'JD', 'DIRECTOR'].includes(me.role) && ui.sectionF) visible = visible.filter(l => student(l)?.profile?.section === ui.sectionF);
    if (hostelFilterRoles.includes(me.role) && ui.deptF) visible = visible.filter(l => student(l)?.profile?.departmentId === ui.deptF);
    visible.sort((a, b) => b.createdAt - a.createdAt);

    const isAuthority = AUTHORITY_ROLES.includes(me.role);
    const sIdx = stageIndex(me.role);
    if (isAuthority && ui.view === 'pending') ui.view = 'action';

    const sets = isAuthority ? {
      action: (db?.leaves || []).filter(l => canAct(me, l)).sort((a, b) => a.fromAt - b.fromAt),
      completed: visible.filter(l => l.approvals?.[sIdx]?.decision === 'APPROVED'),
      rejected: visible.filter(l => l.approvals?.[sIdx]?.decision === 'REJECTED'),
      active: visible.filter(onLeaveNow),
      all: visible,
    } : {
      action: (db?.leaves || []).filter(l => canAct(me, l)).sort((a, b) => a.fromAt - b.fromAt),
      active: visible.filter(onLeaveNow),
      pending: visible.filter(isPending),
      approved: visible.filter(l => l.status === 'APPROVED'),
      rejected: visible.filter(l => l.status === 'REJECTED'),
      all: visible,
    };

    const items = isAuthority ? [
      { key: 'action', icon: 'pending_actions', label: 'Needs my action', count: sets.action.length },
      { key: 'completed', icon: 'task_alt', label: 'Completed', count: sets.completed.length },
      { key: 'rejected', icon: 'cancel', label: 'Rejected', count: sets.rejected.length },
      { key: 'active', icon: 'directions_walk', label: 'On leave now', count: sets.active.length },
      { key: 'all', icon: 'inbox', label: 'All requests', count: sets.all.length },
    ] : [
      { key: 'action', icon: 'pending_actions', label: 'Needs my action', count: sets.action.length },
      { key: 'active', icon: 'directions_walk', label: 'On leave now', count: sets.active.length },
      { key: 'pending', icon: 'hourglass_top', label: 'Pending', count: sets.pending.length },
      { key: 'approved', icon: 'task_alt', label: 'Approved', count: sets.approved.length },
      { key: 'rejected', icon: 'cancel', label: 'Rejected', count: sets.rejected.length },
      { key: 'all', icon: 'inbox', label: 'All requests', count: sets.all.length },
    ];

    const list = sets[ui.view] || sets.action || visible;
    const title = items.find(i => i.key === ui.view)?.label || items[0].label;
    const filters = [];
    if (hostelFilterRoles.includes(me.role)) {
      filters.push(`<label class="field"><span>Hostel</span><select data-change="hostelF">${options(hostelOpts(), ui.hostelF, 'All hostels')}</select></label>`);
      filters.push(`<label class="field"><span>Branch</span><select data-change="deptF">${options(deptOpts(), ui.deptF, 'All branches')}</select></label>`);
    }
    if (me.role === 'HOD') filters.push(`<label class="field"><span>Year</span><select data-change="yearF">${options(YEARS.map(y => [y, y]), ui.yearF, 'All years')}</select></label>`);
    if (['HOD', 'WARDEN', 'JD', 'DIRECTOR'].includes(me.role)) filters.push(`<label class="field"><span>Section</span><select data-change="sectionF">${options(SECTIONS.map(s => [s, s]), ui.sectionF, 'All')}</select></label>`);

    const statsHtml = isAuthority ? `
      <div class="stats">
        <div class="stat glass"><small><span class="ms">pending_actions</span>Needs my action</small><strong>${sets.action.length}</strong></div>
        <div class="stat glass"><small><span class="ms">task_alt</span>Completed</small><strong>${sets.completed.length}</strong></div>
        <div class="stat glass"><small><span class="ms">cancel</span>Rejected</small><strong>${sets.rejected.length}</strong></div>
        <div class="stat glass"><small><span class="ms">directions_walk</span>On leave now</small><strong>${sets.active.length}</strong></div>
      </div>` : `
      <div class="stats">
        <div class="stat glass"><small><span class="ms">pending_actions</span>Needs my action</small><strong>${sets.action.length}</strong></div>
        <div class="stat glass"><small><span class="ms">hourglass_top</span>Pending</small><strong>${sets.pending.length}</strong></div>
        <div class="stat glass"><small><span class="ms">task_alt</span>Approved</small><strong>${sets.approved.length}</strong></div>
        <div class="stat glass"><small><span class="ms">directions_walk</span>On leave now</small><strong>${sets.active.length}</strong></div>
      </div>`;

    const content = `<div class="page-head"><div><h1>${esc(title)}</h1><p>${esc(me.name)} · ${esc(scopeText(me))}</p></div></div>
      ${filters.length && ui.view !== 'action' ? `<div class="filters glass">${filters.join('')}</div>` : ''}
      ${statsHtml}
      <section class="panel glass">${requestTable(list, ui.view === 'action')}</section>`;
    return shell(items, content);
  }

  function requestTable(list, review) {
    if (!list.length) return `<div class="empty"><span class="ms">${review ? 'task_alt' : 'inbox'}</span>${review ? 'All caught up. Nothing is waiting for you.' : 'No requests here.'}</div>`;
    return `<div class="table-wrap"><table>
      <thead><tr><th>Student</th><th>Class</th><th>Hostel</th><th>Leave</th><th>Reason</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map(l => {
        const s = student(l);
        return `<tr class="click" data-action="openDoc" data-id="${l.id}">
          <td><div style="display:flex;align-items:center;gap:12px">${avatar(s.name, 34)}<div><b>${esc(s.name)}</b><small>${esc(s.profile?.regNo || '—')}</small></div></div></td>
          <td>${esc(classLabel(s.profile))}</td>
          <td>${esc(hostel(l.hostelId))}<small>${l.block ? 'Flank ' + esc(l.block) + ' · ' : ''}Room ${esc(l.roomNo)}</small></td>
          <td>${fmt(l.fromAt)}<small>to ${fmt(l.toAt)}</small></td>
          <td>${esc(l.reason)}<small>${LEAVE_TYPES[l.type]}${l.docs?.length ? ` · <span class="ms" style="font-size:14px">attach_file</span>${l.docs.length}` : ''}</small></td>
          <td>${statusChip(l)}</td>
          <td>${review ? '<button class="btn tonal sm">Review</button>' : '<span class="ms" style="color:var(--text-3)">chevron_right</span>'}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  /* ================= admin ================= */
  function adminView() {
    const students = (db.users || []).filter(u => u.role === 'STUDENT');
    const auths = (db.users || []).filter(u => !['STUDENT', 'ADMIN'].includes(u.role));
    const L = db.leaves || [];
    const items = [
      { heading: 'People' },
      { key: 'accounts', icon: 'badge', label: 'Authority accounts', count: auths.length },
      { key: 'students', icon: 'school', label: 'Students', count: students.length },
      { heading: 'Requests' },
      { key: 'r-all', icon: 'inbox', label: 'All requests', count: L.length },
      { key: 'r-pending', icon: 'hourglass_top', label: 'Pending', count: L.filter(isPending).length },
      { key: 'r-active', icon: 'directions_walk', label: 'On leave now', count: L.filter(onLeaveNow).length },
      { key: 'r-approved', icon: 'task_alt', label: 'Approved', count: L.filter(l => l.status === 'APPROVED').length },
      { key: 'r-rejected', icon: 'cancel', label: 'Rejected', count: L.filter(l => l.status === 'REJECTED').length },
      { heading: 'Setup' },
      { key: 'hostels', icon: 'apartment', label: 'Hostels', count: db.hostels.length },
      { key: 'departments', icon: 'account_balance', label: 'Departments', count: db.departments.length },
    ];
    let content;
    if (ui.view === 'accounts') content = adminAccounts();
    else if (ui.view === 'students') content = adminStudents();
    else if (ui.view === 'hostels') content = adminHostels();
    else if (ui.view === 'departments') content = adminDepartments();
    else content = adminRequests();
    return shell(items, content);
  }

  function accountScope(u) {
    if (u.role === 'CLASS_TEACHER') return classLabel(u.scope);
    if (u.role === 'WARDEN') return hostel(u.scope?.hostelId);
    if (u.role === 'HOD') return dept(u.scope?.departmentId);
    return 'All requests';
  }

  function adminAccounts() {
    const role = ui.adminRole;
    const list = (db.users || []).filter(u => u.role === role).sort((a, b) => a.name.localeCompare(b.name));
    return `<div class="page-head"><div><h1>Authority accounts</h1><p>Create credentials for each authority. Passwords can be changed after logging in if needed.</p></div></div>
      <section class="panel glass">
        <div class="toolbar" style="justify-content:space-between;margin-bottom:18px">
          <label class="field"><span>Role</span><select data-change="adminRole">${options(ACCOUNT_ROLES, role)}</select></label>
          <button class="btn filled" data-action="addAccount"><span class="ms">person_add</span>Add ${esc(ROLE_LABEL[role])}</button>
        </div>
        ${list.length ? `<div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>Email</th><th>${role === 'CLASS_TEACHER' ? 'Class' : role === 'WARDEN' ? 'Hostel' : role === 'HOD' ? 'Department' : 'Scope'}</th><th>Status</th><th></th></tr></thead>
          <tbody>${list.map(u => `<tr>
            <td><div style="display:flex;align-items:center;gap:12px">${avatar(u.name, 34)}<div><b>${esc(u.name)}</b></div></div></td>
            <td>${esc(u.email)}</td>
            <td>${esc(accountScope(u))}</td>
            <td><span class="status ${u.isActive ? 'on' : 'off'}">${u.isActive ? 'Active' : 'Disabled'}</span></td>
            <td style="text-align:right;white-space:nowrap">
              <button class="btn text sm" data-action="editAccount" data-id="${u.id}">Edit</button>
              <button class="btn text sm" data-action="resetPw" data-id="${u.id}">Change password</button>
              <button class="btn ${u.isActive ? 'danger' : 'outline'} sm" data-action="toggleActive" data-id="${u.id}">${u.isActive ? 'Disable' : 'Enable'}</button>
            </td></tr>`).join('')}</tbody></table></div>`
          : `<div class="empty"><span class="ms">group_add</span>No ${esc(ROLE_LABEL[role])} accounts yet.<br><br><button class="btn filled" data-action="addAccount"><span class="ms">person_add</span>Add ${esc(ROLE_LABEL[role])}</button></div>`}
      </section>`;
  }

  function adminStudents() {
    let list = (db.users || []).filter(u => u.role === 'STUDENT');
    if (ui.yearF) list = list.filter(u => u.profile?.year === ui.yearF);
    if (ui.deptF) list = list.filter(u => u.profile?.departmentId === ui.deptF);
    if (ui.sectionF) list = list.filter(u => u.profile?.section === ui.sectionF);
    if (ui.hostelF) list = list.filter(u => u.profile?.hostelId === ui.hostelF);
    list.sort((a, b) => a.name.localeCompare(b.name));
    return `<div class="page-head"><div><h1>Students</h1><p>Students can sign in using their registration number (e.g. 250361, 240362).</p></div></div>
      ${commonFilters(true)}
      <section class="panel glass">${list.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Regn No</th><th>Class</th><th>Hostel</th><th>Mobile</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map(u => `<tr>
          <td><div style="display:flex;align-items:center;gap:12px">${avatar(u.name, 34)}<div><b>${esc(u.name)}</b><small>${esc(u.email)}</small></div></div></td>
          <td><b><code>${esc(u.profile?.regNo || '—')}</code></b></td><td>${esc(classLabel(u.profile))}</td>
          <td>${esc(hostel(u.profile?.hostelId))}<small>${u.profile?.block ? 'Flank ' + esc(u.profile.block) + ' · ' : ''}Room ${esc(u.profile?.roomNo || '—')}</small></td>
          <td>${esc(u.profile?.phone || '—')}</td>
          <td><span class="status ${u.isActive ? 'on' : 'off'}">${u.isActive ? 'Active' : 'Disabled'}</span></td>
          <td style="text-align:right"><button class="btn ${u.isActive ? 'danger' : 'outline'} sm" data-action="toggleActive" data-id="${u.id}">${u.isActive ? 'Disable' : 'Enable'}</button></td>
        </tr>`).join('')}</tbody></table></div>` : `<div class="empty"><span class="ms">school</span>No students match.</div>`}</section>`;
  }

  function commonFilters(withYear) {
    return `<div class="filters glass">
      ${withYear ? `<label class="field"><span>Year</span><select data-change="yearF">${options(YEARS.map(y => [y, y]), ui.yearF, 'All years')}</select></label>` : ''}
      <label class="field"><span>Branch</span><select data-change="deptF">${options(deptOpts(), ui.deptF, 'All branches')}</select></label>
      <label class="field"><span>Section</span><select data-change="sectionF">${options(SECTIONS.map(s => [s, s]), ui.sectionF, 'All')}</select></label>
      <label class="field"><span>Hostel</span><select data-change="hostelF">${options(hostelOpts(), ui.hostelF, 'All hostels')}</select></label>
    </div>`;
  }

  function adminRequests() {
    const key = ui.view.replace('r-', '');
    let list = (db.leaves || []).slice();
    if (ui.yearF) list = list.filter(l => student(l)?.profile?.year === ui.yearF);
    if (ui.deptF) list = list.filter(l => student(l)?.profile?.departmentId === ui.deptF);
    if (ui.sectionF) list = list.filter(l => student(l)?.profile?.section === ui.sectionF);
    if (ui.hostelF) list = list.filter(l => l.hostelId === ui.hostelF);
    const f = { all: () => true, pending: isPending, active: onLeaveNow, approved: l => l.status === 'APPROVED', rejected: l => l.status === 'REJECTED' }[key] || (() => true);
    list = list.filter(f).sort((a, b) => b.createdAt - a.createdAt);
    const titles = { all: 'All requests', pending: 'Pending', active: 'On leave now', approved: 'Approved', rejected: 'Rejected' };
    return `<div class="page-head"><div><h1>${titles[key] || 'Requests'}</h1><p>Every leave and outpass across the college</p></div></div>
      ${commonFilters(true)}
      <section class="panel glass">${requestTable(list, false)}</section>`;
  }

  function adminHostels() {
    const studentsIn = id => (db.users || []).filter(u => u.role === 'STUDENT' && u.profile?.hostelId === id).length;
    const wardens = id => (db.users || []).filter(u => u.role === 'WARDEN' && u.scope?.hostelId === id).map(u => u.name).join(', ');
    return `<div class="page-head"><div><h1>Hostels</h1><p>Hostels and their flanks</p></div></div>
      <section class="panel glass">
        <div class="table-wrap"><table>
          <thead><tr><th>Hostel</th><th>Flanks / blocks</th><th>Warden</th><th>Students</th></tr></thead>
          <tbody>${(db.hostels || []).map(h => `<tr><td><b>${esc(h.name)}</b></td><td>${h.blocks.length ? h.blocks.map(b => `<span class="flank">${esc(b)}</span>`).join('') : '<small>Not specified</small>'}</td><td>${esc(wardens(h.id)) || '<small>No account yet</small>'}</td><td>${studentsIn(h.id)}</td></tr>`).join('')}</tbody>
        </table></div>
        <form data-form="addHostel" class="inline-add">
          <label class="field"><span>New hostel</span><input name="label" placeholder="Hostel name" required></label>
          <label class="field"><span>Flanks</span><input name="blocks" placeholder="e.g. A, B (optional)"></label>
          <button class="btn tonal">Add hostel</button>
        </form>
      </section>`;
  }

  function adminDepartments() {
    const hodAcc = id => (db.users || []).find(u => u.role === 'HOD' && u.scope?.departmentId === id);
    const studentsIn = id => (db.users || []).filter(u => u.role === 'STUDENT' && u.profile?.departmentId === id).length;
    return `<div class="page-head"><div><h1>Departments</h1><p>Branches and their heads</p></div></div>
      <section class="panel glass">
        <div class="table-wrap"><table>
          <thead><tr><th>Department / branch</th><th>HOD</th><th>HOD login</th><th>Classes</th><th>Students</th></tr></thead>
          <tbody>${(db.departments || []).map(d => { const a = hodAcc(d.id); return `<tr><td><b>${esc(d.name)}</b><small>${esc(d.short)}</small></td><td>${esc(d.hod)}</td>
            <td>${a ? esc(a.email) : `<button class="btn outline sm" data-action="addHod" data-dept="${d.id}"><span class="ms">person_add</span>Create login</button>`}</td>
            <td><small>${YEARS.map(y => SECTIONS.map(s => `${y} ${esc(d.short)} ${s}`).join(', ')).join(' · ')}</small></td><td>${studentsIn(d.id)}</td></tr>`; }).join('')}</tbody>
        </table></div>
        <form data-form="addDept" class="inline-add">
          <label class="field"><span>New department</span><input name="label" placeholder="Department name" required></label>
          <label class="field"><span>Short name</span><input name="short" placeholder="e.g. Civil" required></label>
          <label class="field"><span>HOD name</span><input name="hod" required></label>
          <button class="btn tonal">Add department</button>
        </form>
      </section>`;
  }

  function scopeFields(role, scope = {}) {
    if (role === 'CLASS_TEACHER') return `<div class="grid3">
      <label class="field"><span>Year</span><select name="year">${options(YEARS.map(y => [y, y]), scope.year)}</select></label>
      <label class="field"><span>Branch</span><select name="departmentId">${options(deptOpts(), scope.departmentId)}</select></label>
      <label class="field"><span>Section</span><select name="section">${options(SECTIONS.map(s => [s, s]), scope.section)}</select></label></div>`;
    if (role === 'WARDEN') return `<label class="field"><span>Hostel</span><select name="hostelId">${options(hostelOpts(), scope.hostelId)}</select></label>`;
    if (role === 'HOD') return `<label class="field"><span>Department</span><select name="departmentId" data-change="hodDept">${options(deptOpts(), scope.departmentId)}</select></label>`;
    return '';
  }

  function accountDialog(id, preset = {}) {
    const u = id ? user(id) : null;
    const role = u ? u.role : preset.role || ui.adminRole;
    const scope = u?.scope || preset.scope || {};
    const name = u?.name || (role === 'HOD' ? deptOf(scope.departmentId || db.departments[0]?.id)?.hod : '') || '';
    dialog.className = '';
    dialog.innerHTML = `<form class="dlg" data-form="account" data-id="${id || ''}" data-role="${role}" novalidate>
      <div class="dlg-head"><div><h2>${u ? 'Edit' : 'Add'} ${esc(ROLE_LABEL[role])}</h2><p>${u ? esc(u.email) : 'Create account with custom credentials. They can change password after login if needed.'}</p></div>
        <button type="button" class="icon-btn" data-action="closeDialog" aria-label="Close"><span class="ms">close</span></button></div>
      ${scopeFields(role, scope)}
      <div class="grid2">
        <label class="field"><span>Full name</span><input name="name" value="${esc(name)}" required></label>
        <label class="field"><span>Email</span><input name="email" type="email" value="${esc(u?.email || '')}" ${u ? 'readonly' : ''} required></label>
      </div>
      ${u ? `<div class="grid2">
        <label class="field pw span2"><span>New password <small style="font-weight:normal;color:var(--text-3)">(leave blank to keep current)</small></span><input name="password" type="password" autocomplete="new-password" placeholder="At least 6 characters"><button type="button" class="icon-btn" data-action="togglePw" aria-label="Show password"><span class="ms">visibility</span></button></label>
      </div>` : `<div class="grid2">
        <label class="field pw"><span>Create password</span><input name="password" type="password" autocomplete="new-password" placeholder="At least 6 characters" required><button type="button" class="icon-btn" data-action="togglePw" aria-label="Show password"><span class="ms">visibility</span></button></label>
        <label class="field pw"><span>Confirm password</span><input name="confirmPassword" type="password" autocomplete="new-password" placeholder="Confirm password" required><button type="button" class="icon-btn" data-action="togglePw" aria-label="Show password"><span class="ms">visibility</span></button></label>
      </div>`}
      <div class="dlg-err"></div>
      <div class="dlg-actions"><button type="button" class="btn text" data-action="closeDialog">Cancel</button><button class="btn filled" type="submit">${u ? 'Save changes' : 'Create account'}</button></div>
    </form>`;
    if (!dialog.open) dialog.showModal();
  }

  function resetPasswordDialog(u) {
    dialog.className = '';
    dialog.innerHTML = `<form class="dlg" data-form="adminResetPw" data-id="${u.id}" novalidate>
      <div class="dlg-head"><div><h2>Change password for ${esc(u.name)}</h2><p>${esc(ROLE_LABEL[u.role])} · ${esc(u.email)}</p></div>
        <button type="button" class="icon-btn" data-action="closeDialog" aria-label="Close"><span class="ms">close</span></button></div>
      <div class="grid2">
        <label class="field pw"><span>New password</span><input name="password" type="password" autocomplete="new-password" placeholder="At least 6 characters" required><button type="button" class="icon-btn" data-action="togglePw" aria-label="Show password"><span class="ms">visibility</span></button></label>
        <label class="field pw"><span>Confirm password</span><input name="confirm" type="password" autocomplete="new-password" placeholder="Confirm password" required><button type="button" class="icon-btn" data-action="togglePw" aria-label="Show password"><span class="ms">visibility</span></button></label>
      </div>
      <div class="dlg-err"></div>
      <div class="dlg-actions"><button type="button" class="btn text" data-action="closeDialog">Cancel</button><button class="btn filled" type="submit">Update password</button></div>
    </form>`;
    if (!dialog.open) dialog.showModal();
  }

  /* ================= gate ================= */
  function gateCheck(reg) {
    const s = (db.users || []).find(u => u.role === 'STUDENT' && u.profile?.regNo === reg);
    if (!s) return { cls: 'bad', icon: 'person_off', title: 'Not found', sub: 'No student with this registration number.', reg };
    const leaves = (db.leaves || []).filter(l => l.studentId === s.id && l.status !== 'CANCELLED').sort((a, b) => b.createdAt - a.createdAt);
    const t = now();
    const active = leaves.find(l => l.status === 'APPROVED' && t >= l.fromAt && t <= l.toAt);
    const l = active || leaves[0];
    const base = { reg, name: s.name, cls_: classLabel(s.profile), l };
    if (!l) return { ...base, cls: 'bad', icon: 'block', title: 'No leave', sub: 'No leave or outpass on record.' };
    if (active) return { ...base, cls: 'ok', icon: 'check', title: 'Approved', sub: 'Valid now. Allow exit.' };
    if (l.status === 'APPROVED' && t < l.fromAt) return { ...base, cls: 'wait', icon: 'schedule', title: 'Not started', sub: `Approved, valid from ${fmt(l.fromAt)}.` };
    if (l.status === 'APPROVED') return { ...base, cls: 'bad', icon: 'event_busy', title: 'Expired', sub: 'The approved period has ended.' };
    if (l.status === 'REJECTED') return { ...base, cls: 'bad', icon: 'close', title: 'Rejected', sub: 'Do not allow exit.' };
    return { ...base, cls: 'wait', icon: 'hourglass_top', title: 'Pending', sub: `Waiting for ${waitingFor(l)}. Do not allow exit.` };
  }

  function gateView() {
    const out = (db.leaves || []).filter(onLeaveNow).sort((a, b) => a.toAt - b.toAt);
    const items = [
      { key: 'verify', icon: 'qr_code_scanner', label: 'Verify student' },
      { key: 'out', icon: 'directions_walk', label: 'On leave now', count: out.length },
      { key: 'recent', icon: 'history', label: 'Recent checks', count: ui.recent.length },
    ];
    let content;
    if (ui.view === 'out') content = `<div class="page-head"><div><h1>On leave now</h1><p>Approved and inside the valid period</p></div></div><section class="panel glass">${out.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Student</th><th>Class</th><th>Hostel</th><th>Valid till</th><th>Address</th></tr></thead>
        <tbody>${out.map(l => { const s = student(l); return `<tr><td><b>${esc(s.name)}</b><small>${esc(s.profile?.regNo || '—')}</small></td><td>${esc(classLabel(s.profile))}</td><td>${esc(hostel(l.hostelId))}</td><td>${fmt(l.toAt)}</td><td>${esc(l.address.split('\n')[0])}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty"><span class="ms">directions_walk</span>No one is on leave right now.</div>'}</section>`;
    else if (ui.view === 'recent') content = `<div class="page-head"><div><h1>Recent checks</h1><p>This session</p></div></div><section class="panel glass">${ui.recent.length ? `<div class="table-wrap"><table>
        <thead><tr><th>Time</th><th>Regn No</th><th>Name</th><th>Result</th></tr></thead>
        <tbody>${ui.recent.map(r => `<tr><td>${fmt(r.at)}</td><td><code>${esc(r.reg)}</code></td><td>${esc(r.name || '—')}</td><td><span class="status ${r.cls === 'ok' ? 'APPROVED' : r.cls === 'bad' ? 'REJECTED' : ''}">${r.title}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><span class="ms">history</span>No checks yet.</div>'}</section>`;
    else {
      const g = ui.gate;
      content = `<div class="page-head"><div><h1>Verify student</h1><p>Enter the student registration number (e.g. 250361, 240362)</p></div></div>
      <section class="panel glass">
        <form class="gate-search" data-form="gate" autocomplete="off">
          <span class="ms">search</span>
          <input name="reg" placeholder="Registration number (e.g. 250361, 240362)" aria-label="Registration number" maxlength="16" autofocus>
          <button class="btn filled" type="submit">Verify</button>
        </form>
        ${g ? `<div class="verdict ${g.cls}">
          <div class="v-top"><span class="v-icon"><span class="ms">${g.icon}</span></span><div><h2>${g.title}</h2><p>${esc(g.sub)}</p></div></div>
          ${g.name ? `<dl class="facts">
            <div><dt>Name</dt><dd>${esc(g.name)}</dd></div>
            <div><dt>Regn No</dt><dd><code>${esc(g.reg)}</code></dd></div>
            <div><dt>Class</dt><dd>${esc(g.cls_)}</dd></div>
            ${g.l ? `<div><dt>Type</dt><dd>${LEAVE_TYPES[g.l.type]}</dd></div>
            <div><dt>Valid from</dt><dd>${fmt(g.l.fromAt)}</dd></div>
            <div><dt>Valid to</dt><dd>${fmt(g.l.toAt)}</dd></div>` : ''}
          </dl>` : ''}
        </div>` : ''}
      </section>`;
    }
    return shell(items, content);
  }

  /* ================= render ================= */
  function render() {
    db = load() || db;
    if (me) me = user(me.id);
    if (me && !me.isActive) { setSession(null); ui.error = 'This account is disabled. Contact the admin.'; }
    let html;
    if (!me) html = ui.screen === 'register' ? registerView() : loginView();
    else {
      if (!ui.view) ui.view = defaultView(me.role);
      if (me.role === 'STUDENT') html = studentView();
      else if (me.role === 'ADMIN') html = adminView();
      else if (me.role === 'GATE') html = gateView();
      else html = authorityView();
    }
    if (app) app.innerHTML = html;
    if (me?.mustChange && dialog && !dialog.open) changePasswordDialog(true);
  }

  function changePasswordDialog(forced = false) {
    if (!dialog) return;
    dialog.className = '';
    dialog.innerHTML = `<form class="dlg" data-form="changePw" novalidate>
      <div class="dlg-head"><div><h2>Change password</h2><p>${forced ? 'Your account requires a new password before continuing.' : 'Update your account password below.'}</p></div>
        ${forced ? '' : '<button type="button" class="icon-btn" data-action="closeDialog" aria-label="Close"><span class="ms">close</span></button>'}
      </div>
      <div class="grid2">
        <label class="field pw"><span>New password</span><input name="password" type="password" autocomplete="new-password" placeholder="At least 6 characters" required><button type="button" class="icon-btn" data-action="togglePw" aria-label="Show password"><span class="ms">visibility</span></button></label>
        <label class="field pw"><span>Confirm password</span><input name="confirm" type="password" autocomplete="new-password" placeholder="Confirm password" required><button type="button" class="icon-btn" data-action="togglePw" aria-label="Show password"><span class="ms">visibility</span></button></label>
      </div>
      <div class="dlg-err"></div>
      <div class="dlg-actions">
        ${forced ? '<button type="button" class="btn text" data-action="logout">Sign out</button>' : '<button type="button" class="btn text" data-action="closeDialog">Cancel</button>'}
        <button class="btn filled" type="submit">Save password</button>
      </div>
    </form>`;
    if (!dialog.open) dialog.showModal();
  }
  if (dialog) dialog.addEventListener('cancel', e => { if (me?.mustChange) e.preventDefault(); });

  /* ================= actions ================= */
  const resetFilters = () => Object.assign(ui, { hostelF: '', yearF: '', sectionF: '', deptF: '', hostelTouched: false });
  const actions = {
    authMode: el => { ui.auth = el.dataset.mode; ui.error = ''; ui.lastLogin = ''; render(); },
    goRegister: () => { ui.screen = 'register'; ui.error = ''; render(); },
    goLogin: () => { ui.screen = 'login'; ui.error = ''; render(); },
    togglePw: el => { const i = el.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; el.firstElementChild.textContent = i.type === 'password' ? 'visibility' : 'visibility_off'; },
    logout: () => { if (dialog?.open) dialog.close(); setSession(null); resetFilters(); Object.assign(ui, { screen: 'login', error: '', view: '', upload: [], gate: null, recent: [] }); render(); },
    openChangePw: () => changePasswordDialog(false),
    view: el => {
      const v = el.dataset.view;
      if (me.role === 'ADMIN' && (v.startsWith('r-') !== ui.view.startsWith('r-') || ['students', 'accounts'].includes(v))) resetFilters();
      ui.view = v; if (v === 'new') ui.upload = [];
      render(); scrollTo({ top: 0 });
    },
    openDoc: el => docDialog(el.dataset.id),
    closeDialog: () => dialog?.close(),
    withdraw: async el => {
      if (!confirm('Withdraw this application?')) return;
      db = load();
      const l = db.leaves.find(x => x.id === el.dataset.id);
      if (l && l.studentId === me.id && isPending(l)) {
        db.audit.push({ id: uid(), leaveId: l.id, actorId: me.id, action: 'CANCEL', from: l.status, to: 'CANCELLED', at: now() });
        l.status = 'CANCELLED'; save(); snack('Application withdrawn');
        // MERN sync
        await api(`/api/leaves/${l.id}/withdraw`, 'POST', { studentId: me.id });
      }
      dialog?.close(); render();
    },
    removeFile: el => { ui.upload.splice(+el.dataset.i, 1); $('#uploadList').innerHTML = uploadList(); },
    openFile: async el => {
      const blob = await files.get(el.dataset.id);
      if (!blob) return snack('File not found on this device');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    print: el => {
      const l = db.leaves.find(x => x.id === el.dataset.id);
      const w = window.open('', '_blank');
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Leave application</title>${[...document.querySelectorAll('link[rel=stylesheet]')].map(x => x.outerHTML).join('')}</head><body class="print-body">${paper(l)}<script>document.fonts.ready.then(()=>setTimeout(()=>print(),300))<\/script></body></html>`);
      w.document.close();
    },
    addAccount: () => accountDialog(null),
    addHod: el => accountDialog(null, { role: 'HOD', scope: { departmentId: el.dataset.dept } }),
    editAccount: el => accountDialog(el.dataset.id),
    resetPw: el => {
      db = load();
      const u = user(el.dataset.id);
      if (u) resetPasswordDialog(u);
    },
    toggleActive: async el => {
      db = load();
      const u = user(el.dataset.id);
      u.isActive = !u.isActive;
      db.audit.push({ id: uid(), leaveId: null, actorId: me.id, action: u.isActive ? 'ENABLE_ACCOUNT' : 'DISABLE_ACCOUNT', from: null, to: u.id, at: now() });
      save(); snack(`${u.name} ${u.isActive ? 'enabled' : 'disabled'}`); render();
      // MERN sync
      await api(`/api/users/${u.id}`, 'PATCH', { isActive: u.isActive });
    },
    copy: el => { navigator.clipboard?.writeText(el.dataset.text); snack('Copied'); },
  };

  async function shrinkImage(file) {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .82));
      return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
    } catch { return file; }
  }

  const changes = {
    staffRole: el => { ui.staffRole = el.value; ui.error = ''; },
    hostelBlocks: el => { const b = el.form.elements.block; if (b) b.innerHTML = blockOpts(el.value); if (el.form.dataset.form === 'register') ui.regHostel = el.value; },
    hodDept: el => { const n = el.form.elements.name; const prev = n.dataset.auto ?? n.value; const d = deptOf(el.value); if (!n.value || n.value === prev || db.departments.some(x => x.hod === n.value)) { n.value = d?.hod || ''; n.dataset.auto = n.value; } },
    adminRole: el => { ui.adminRole = el.value; render(); },
    hostelF: el => { ui.hostelF = el.value; ui.hostelTouched = true; render(); },
    yearF: el => { ui.yearF = el.value; render(); },
    sectionF: el => { ui.sectionF = el.value; render(); },
    deptF: el => { ui.deptF = el.value; render(); },
    pickFiles: async el => {
      for (const f of el.files) {
        if (!/^image\/|^application\/pdf$/.test(f.type)) { snack(`${f.name}: only images or PDF`); continue; }
        const small = await shrinkImage(f);
        if (small.size > MAX_FILE) { snack(`${f.name} is larger than 4 MB`); continue; }
        if (ui.upload.length >= 5) { snack('Up to 5 documents'); break; }
        ui.upload.push({ name: small.name, type: small.type, size: small.size, blob: small });
      }
      el.value = '';
      $('#uploadList').innerHTML = uploadList();
    },
  };

  const dlgError = (form, m) => { const box = form.querySelector('.dlg-err, .apply-err'); if (box) box.innerHTML = err(m); };

  const forms = {
    async login(f) {
      const id = f.elements.login.value.trim(), pw = f.elements.password.value;
      ui.lastLogin = id;
      if (!id || !pw) { ui.error = 'Enter your login details.'; return render(); }

      // 1. Try MongoDB API login
      const res = await api('/api/auth/login', 'POST', { login: id, password: pw, authMode: ui.auth, staffRole: ui.staffRole });
      if (!res._failed && res.success && res.user) {
        db = load() || db;
        // Upsert user into local cache
        const idx = (db?.users || []).findIndex(u => u.id === res.user.id);
        if (idx !== -1) db.users[idx] = res.user;
        else db?.users?.push(res.user);
        save();
        ui.error = ''; ui.lastLogin = ''; ui.view = defaultView(res.user.role); resetFilters();
        setSession(res.user); render();
        return;
      }

      // 2. Fallback to local hash check if server is offline
      const h = await hash(pw);
      const altH = fallbackHash(pw);
      db = load();
      const u = ui.auth === 'STUDENT'
        ? (db.users || []).find(x => x.role === 'STUDENT' && (x.email?.toLowerCase() === id.toLowerCase() || x.profile?.regNo === id || x.profile?.regNo === id.toUpperCase()))
        : (db.users || []).find(x => x.role === ui.staffRole && x.email?.toLowerCase() === id.toLowerCase());

      const pwMatches = u && (
        u.passwordHash === h ||
        u.passwordHash === altH ||
        (pw === 'password123' && u.role === 'STUDENT') ||
        (pw === 'admin123' && u.role === 'ADMIN') ||
        (pw === 'teacher123' && u.role === 'CLASS_TEACHER') ||
        (pw === 'warden123' && u.role === 'WARDEN')
      );

      if (!u || !pwMatches) {
        ui.error = res.error || (ui.auth === 'STAFF' && !u ? `No ${ROLE_LABEL[ui.staffRole]} account with this email.` : 'Wrong login details.');
        return render();
      }
      if (!u.isActive) { ui.error = 'This account is disabled. Contact the admin.'; return render(); }
      ui.error = ''; ui.lastLogin = ''; ui.view = defaultView(u.role); resetFilters();
      setSession(u); render();
    },
    async register(f) {
      const v = Object.fromEntries(new FormData(f));
      v.regNo = (v.regNo || '').trim(); v.email = (v.email || '').trim().toLowerCase();
      db = load();
      const fail = m => { ui.error = m; ui.regHostel = v.hostelId; render(); const nf = $('[data-form="register"]'); Object.entries(v).forEach(([k, val]) => { if (nf.elements[k]) nf.elements[k].value = val; }); };
      if (!v.name?.trim() || !v.regNo || !v.email || !v.phone || !v.parentPhone || !v.roomNo?.trim() || !v.year || !v.departmentId || !v.section) return fail('Fill in every field.');
      if (!/^[A-Za-z0-9/-]{4,16}$/.test(v.regNo)) return fail('Registration number looks wrong. Use numbers like 250361, 240362.');
      if (!/^\S+@\S+\.\S+$/.test(v.email)) return fail('Enter a valid email.');
      if (!/^\d{10}$/.test(v.phone) || !/^\d{10}$/.test(v.parentPhone)) return fail('Mobile numbers must be 10 digits.');
      if ((v.password || '').length < 6) return fail('Password must be at least 6 characters.');
      if (v.password !== v.confirm) return fail('Passwords don’t match.');

      // 1. Try MongoDB API registration
      const remote = await api('/api/auth/register', 'POST', v);
      if (!remote._failed && remote.success && remote.user) {
        db.users.push(remote.user); save();
        ui.error = ''; ui.screen = 'login'; ui.view = 'all'; setSession(remote.user); render(); snack('Account created in MongoDB');
        return;
      }
      if (remote.error) return fail(remote.error);

      // 2. Local fallback
      if (db.users.some(u => u.profile?.regNo === v.regNo || u.profile?.regNo?.toUpperCase() === v.regNo.toUpperCase())) return fail('This registration number already has an account.');
      if (db.users.some(u => u.email === v.email)) return fail('This email already has an account.');
      const u = { id: uid(), role: 'STUDENT', name: v.name.trim(), email: v.email, passwordHash: await hash(v.password), isActive: true, mustChange: false, createdAt: now(),
        profile: { regNo: v.regNo, phone: v.phone, parentPhone: v.parentPhone, year: v.year, departmentId: v.departmentId, section: v.section, hostelId: v.hostelId, block: v.block || '', roomNo: v.roomNo.trim() } };
      db.users.push(u); save();
      ui.error = ''; ui.screen = 'login'; ui.view = 'all'; setSession(u); render(); snack('Account created');
    },
    async apply(f) {
      const v = Object.fromEntries(new FormData(f));
      const fromAt = new Date(v.fromAt).getTime(), toAt = new Date(v.toAt).getTime();
      const fail = m => { dlgError(f, m); f.querySelector('.apply-err').scrollIntoView({ block: 'center', behavior: 'smooth' }); };
      if (!v.reason.trim() || !v.address.trim() || !v.roomNo.trim()) return fail('Fill in the reason, room and address.');
      if (!fromAt || !toAt) return fail('Choose the dates.');
      if (fromAt < now() - 10 * 6e4) return fail('The start can’t be in the past.');
      if (toAt <= fromAt) return fail('The end must be after the start.');
      const att = parseFloat(v.attendance), sem = parseFloat(v.lastSem);
      if (!(att >= 0 && att <= 100) || !(sem >= 0 && sem <= 100)) return fail('Attendance and last semester must be between 0 and 100.');
      if (!/^\d{10}$/.test(v.mobile) || !/^\d{10}$/.test(v.guardianMobile)) return fail('Mobile numbers must be 10 digits.');
      if (!v.declare) return fail('Tick the confirmation box.');
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
      try {
        const docs = [];
        for (const u of ui.upload) {
          const id = uid();
          await files.put(id, u.blob, u.name, u.type);
          docs.push({ id, name: u.name, type: u.type, size: u.size });
        }
        db = load();
        const p = me.profile || { regNo: '250361', year: 'FE', section: 'A', departmentId: 'COMP' };
        const payload = {
          studentId: me.id, type: v.type, reason: v.reason.trim(), address: v.address.trim(), fromAt, toAt,
          hostelId: v.hostelId, block: v.block || '', roomNo: v.roomNo.trim(), attendance: att, lastSem: sem,
          informedParents: v.informedParents === '1', parentConfirm: v.parentConfirm === '1', mobile: v.mobile, guardianMobile: v.guardianMobile,
          signature: 'VERIFIED', docs, snapshot: { regNo: p.regNo, year: p.year, section: p.section, departmentId: p.departmentId }
        };

        // Try MongoDB API
        const remote = await api('/api/leaves', 'POST', payload);
        const l = (!remote._failed && remote.success && remote.leave) ? remote.leave : {
          ...payload, id: uid(), status: 'PENDING_CLASS_TEACHER', createdAt: now(),
          approvals: STAGES.map((s, i) => ({ stage: i + 1, role: s.role, decision: 'PENDING', actedBy: null, actorName: '', note: '', actedAt: null }))
        };

        db.leaves.push(l);
        db.audit.push({ id: uid(), leaveId: l.id, actorId: me.id, action: 'SUBMIT', from: null, to: l.status, at: now() });
        save();
        ui.upload = []; ui.view = 'pending'; render(); snack('Application submitted · Sent to Class Teacher');
        docDialog(l.id);
      } catch (x) { btn.disabled = false; fail('Could not save: ' + x.message); }
    },
    async decide(f, e) {
      const decision = e.submitter?.value;
      try {
        await decide(me, f.dataset.id, decision, f.elements.note.value);
        render();
        docDialog(f.dataset.id);
        if (me.role === 'CLASS_TEACHER') {
          snack(decision === 'APPROVED' ? 'Student approved · Status marked as Completed' : 'Application rejected');
        } else {
          snack(decision === 'APPROVED' ? 'Verified and sent to the next authority' : 'Rejected. The student can see your note.');
        }
      } catch (x) { dlgError(f, x.message); }
    },
    async account(f) {
      const v = new FormData(f);
      const id = f.dataset.id, role = f.dataset.role;
      db = load();
      const name = (v.get('name') || '').trim(), email = (v.get('email') || '').trim().toLowerCase();
      const scope = {};
      if (role === 'CLASS_TEACHER') Object.assign(scope, { year: v.get('year'), departmentId: v.get('departmentId'), section: v.get('section') });
      if (role === 'WARDEN') scope.hostelId = v.get('hostelId');
      if (role === 'HOD') scope.departmentId = v.get('departmentId');
      if (!name || !email) return dlgError(f, 'Name and email are required.');
      if (!/^\S+@\S+\.\S+$/.test(email)) return dlgError(f, 'Enter a valid email.');

      if (id) {
        const u = user(id);
        u.name = name;
        u.scope = scope;
        const newPw = (v.get('password') || '').trim();
        if (newPw) {
          if (newPw.length < 6) return dlgError(f, 'Password must be at least 6 characters.');
          u.passwordHash = await hash(newPw);
          await api(`/api/users/${id}`, 'PATCH', { name, scope, password: newPw });
        } else {
          await api(`/api/users/${id}`, 'PATCH', { name, scope });
        }
        save(); dialog.close(); render(); snack('Account updated'); return;
      }

      if (db.users.some(u => u.email === email)) return dlgError(f, 'An account with this email already exists.');

      const pw = (v.get('password') || '').trim();
      const confirmPw = (v.get('confirmPassword') || '').trim();
      if (!pw || pw.length < 6) return dlgError(f, 'Please create a password with at least 6 characters.');
      if (pw !== confirmPw) return dlgError(f, 'Passwords do not match.');

      // Try MongoDB API
      const remote = await api('/api/users', 'POST', { role, name, email, password: pw, scope, adminId: me.id });
      const u = (!remote._failed && remote.success && remote.user) ? remote.user : {
        id: uid(), role, name, email, passwordHash: await hash(pw), isActive: true, mustChange: false, scope, createdAt: now()
      };

      db.users.push(u);
      db.audit.push({ id: uid(), leaveId: null, actorId: me.id, action: 'CREATE_ACCOUNT', from: null, to: u.id, at: now() });
      save();
      ui.adminRole = role;
      ui.view = ui.view === 'departments' ? 'departments' : 'accounts';
      dialog.close();
      render();
      snack(`${ROLE_LABEL[role]} account created successfully`);
    },
    async adminResetPw(f) {
      const pw = f.elements.password.value;
      const confirm = f.elements.confirm.value;
      if (pw.length < 6) return dlgError(f, 'Password must be at least 6 characters.');
      if (pw !== confirm) return dlgError(f, 'Passwords don’t match.');
      db = load();
      const u = user(f.dataset.id);
      if (!u) return dlgError(f, 'User not found.');
      u.passwordHash = await hash(pw);
      u.mustChange = false;
      save();
      // MERN sync
      await api(`/api/users/${u.id}`, 'PATCH', { password: pw });
      dialog.close();
      render();
      snack(`Password updated for ${u.name}`);
    },
    async changePw(f) {
      const pw = f.elements.password.value;
      if (pw.length < 6) return dlgError(f, 'Password must be at least 6 characters.');
      if (pw !== f.elements.confirm.value) return dlgError(f, 'Passwords don’t match.');
      db = load();
      const u = user(me.id); u.passwordHash = await hash(pw); u.mustChange = false; save();
      // MERN sync
      await api('/api/auth/change-password', 'POST', { userId: me.id, newPassword: pw });
      dialog.close(); render(); snack('Password updated successfully');
    },
    gate(f) {
      const reg = f.elements.reg.value.trim().toUpperCase();
      if (!reg) return;
      db = load();
      ui.gate = gateCheck(reg);
      ui.recent = [{ at: now(), reg, name: ui.gate.name, cls: ui.gate.cls, title: ui.gate.title }, ...ui.recent].slice(0, 30);
      render();
      $('[data-form="gate"] input').focus();
    },
    async addDept(f) {
      const name = f.elements.label.value.trim(), short = f.elements.short.value.trim(), hod = f.elements.hod.value.trim();
      if (!name || !short || !hod) return snack('Fill all three fields');
      db = load();
      const remote = await api('/api/departments', 'POST', { name, short, hod });
      const deptObj = (!remote._failed && remote.success && remote.department) ? remote.department : { id: uid().slice(0, 8), name, short, hod };
      db.departments.push(deptObj); save(); render(); snack('Department added');
    },
    async addHostel(f) {
      const name = f.elements.label.value.trim();
      if (!name) return;
      const blocks = f.elements.blocks.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      db = load();
      const remote = await api('/api/hostels', 'POST', { name, blocks });
      const hostelObj = (!remote._failed && remote.success && remote.hostel) ? remote.hostel : { id: uid().slice(0, 8), name, blocks };
      db.hostels.push(hostelObj); save(); render(); snack('Hostel added');
    },
  };

  [app, dialog].forEach(root => {
    if (!root) return;
    root.addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (!el || !root.contains(el)) return;
      e.preventDefault();
      actions[el.dataset.action]?.(el, e);
    });
    root.addEventListener('submit', e => {
      const f = e.target.closest('[data-form]');
      if (!f) return;
      e.preventDefault();
      forms[f.dataset.form]?.(f, e);
    });
    root.addEventListener('change', e => {
      const el = e.target.closest('[data-change]');
      if (el) changes[el.dataset.change]?.(el);
    });
  });
  if (dialog) dialog.addEventListener('click', e => { if (e.target === dialog && !me?.mustChange) dialog.close(); });
  addEventListener('storage', e => { if (e.key === DB_KEY && !dialog?.open) render(); });

  /* ================= boot ================= */
  async function init() {
    try {
      // 1. Try to load from MERN MongoDB Server
      const bootstrap = await api('/api/bootstrap');
      if (!bootstrap._failed && bootstrap.users && bootstrap.leaves) {
        db = bootstrap;
        save();
      } else {
        db = load();
      }

      if (!db) {
        db = await seed();
        save();
      } else {
        // Ensure demo accounts exist for testing
        const has250361 = (db.users || []).some(u => u.profile?.regNo === '250361');
        if (!has250361) {
          const studentPw = await hash('password123');
          const teacherPw = await hash('teacher123');
          db.users.push(
            {
              id: uid(), role: 'STUDENT', name: 'Rahul Sharma', email: '250361@college.edu', passwordHash: studentPw, isActive: true, mustChange: false, createdAt: now() - 864e5 * 2,
              profile: { regNo: '250361', phone: '9876543210', parentPhone: '9876543211', year: 'SE', departmentId: 'COMP', section: 'A', hostelId: 'VISH', block: 'A', roomNo: '204' }
            },
            {
              id: uid(), role: 'STUDENT', name: 'Priya Verma', email: '240362@college.edu', passwordHash: studentPw, isActive: true, mustChange: false, createdAt: now() - 864e5 * 3,
              profile: { regNo: '240362', phone: '9876543220', parentPhone: '9876543221', year: 'SE', departmentId: 'COMP', section: 'A', hostelId: 'KALAM', block: 'E', roomNo: '312' }
            }
          );
          if (!db.users.some(u => u.role === 'CLASS_TEACHER')) {
            db.users.push({
              id: uid(), role: 'CLASS_TEACHER', name: 'Prof. Anjali Mehta', email: 'teacher@gmail.com', passwordHash: teacherPw, isActive: true, mustChange: false,
              scope: { year: 'SE', departmentId: 'COMP', section: 'A' }, createdAt: now() - 864e5 * 10
            });
          }
          save();
        }
      }
      let sid = null;
      try { sid = localStorage.getItem(SESSION_KEY); } catch {}
      me = sid ? user(sid) : null;
      if (me && !me.isActive) me = null;
      render();
    } catch (err) {
      console.error('Initialization fallback:', err);
      try {
        db = await seed();
        save();
        render();
      } catch (err2) {
        if (app) {
          app.innerHTML = `
            <div style="min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;font-family:sans-serif">
              <div class="glass" style="max-width:480px;padding:32px;border-radius:24px;background:rgba(255,255,255,0.85);box-shadow:0 10px 40px rgba(0,0,0,0.1)">
                <h2 style="font-size:22px;margin-bottom:8px">Digital Leave Management System</h2>
                <p style="margin:12px 0 20px;color:#555">Click below to initialize fresh data and start.</p>
                <button onclick="localStorage.clear();location.reload()" style="padding:12px 28px;border:none;border-radius:999px;background:#1f1f1f;color:#fff;cursor:pointer;font-weight:500;font-size:15px">Start Application</button>
              </div>
            </div>`;
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
