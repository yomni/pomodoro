/**
 * Pomodoro & Customizable Routine Interval Timer
 * Built with Vanilla JavaScript (ES6+) following Clean Code & OOP Principles
 */

// --- 1. Sound Notification Service (Web Audio API) ---
class AudioNotifier {
  constructor() {
    this.audioCtx = null;
    this.isEnabled = true;
  }

  init() {
    if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
    return this.isEnabled;
  }

  playCompletionChime() {
    if (!this.isEnabled) return;
    this.init();
    if (!this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // Rich 3-stage ascending chime (A Major chord arpeggio with warm bell harmonics)
    // E5 (659.25Hz) -> A5 (880.00Hz) -> C#6 (1108.73Hz) + E6 (1318.51Hz)
    const tones = [
      { freq: 659.25, start: 0, duration: 0.9, gain: 0.4 },
      { freq: 880.00, start: 0.18, duration: 1.1, gain: 0.45 },
      { freq: 1108.73, start: 0.36, duration: 1.5, gain: 0.5 },
      { freq: 1318.51, start: 0.36, duration: 1.7, gain: 0.45 }
    ];

    tones.forEach(tone => {
      const startTime = now + tone.start;

      // Primary sine oscillator for pure clarity
      const sineOsc = ctx.createOscillator();
      sineOsc.type = 'sine';
      sineOsc.frequency.setValueAtTime(tone.freq, startTime);

      // Secondary triangle oscillator for acoustic presence and bell-like body
      const triOsc = ctx.createOscillator();
      triOsc.type = 'triangle';
      triOsc.frequency.setValueAtTime(tone.freq, startTime);

      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(tone.gain, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0008, startTime + tone.duration);

      sineOsc.connect(gainNode);
      triOsc.connect(gainNode);
      gainNode.connect(ctx.destination);

      sineOsc.start(startTime);
      triOsc.start(startTime);

      sineOsc.stop(startTime + tone.duration);
      triOsc.stop(startTime + tone.duration);
    });
  }
}

// --- 2. Browser System Notification Service ---
class BrowserNotificationService {
  constructor() {
    this.isEnabled = StorageService.getNotificationEnabled();
  }

  isSupported() {
    return 'Notification' in window;
  }

  getPermission() {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission; // 'granted', 'denied', 'default'
  }

  async requestPermission() {
    if (!this.isSupported()) {
      alert('사용 중이신 브라우저는 시스템 알림을 지원하지 않습니다.');
      return false;
    }
    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      this.setEnabled(granted);
      return granted;
    } catch (err) {
      console.error('Notification permission error:', err);
      return false;
    }
  }

  setEnabled(val) {
    this.isEnabled = val;
    StorageService.saveNotificationEnabled(val);
  }

  notify({ title, body }) {
    if (!this.isEnabled || !this.isSupported() || Notification.permission !== 'granted') {
      return;
    }

    try {
      const notification = new Notification(title, {
        body,
        silent: true, // We already play our clear custom chime
        tag: 'pomodoro-session-alert'
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (err) {
      console.error('Failed to trigger notification:', err);
    }
  }
}

// --- 3. Storage Service (Persistence) ---
class StorageService {
  static KEYS = {
    ROUTINE: 'pomodoro_routine_steps',
    ACTIVE_INDEX: 'pomodoro_active_index',
    AUTO_START: 'pomodoro_auto_start',
    COMPLETED_COUNT: 'pomodoro_completed_count',
    SOUND_ENABLED: 'pomodoro_sound_enabled',
    NOTIF_ENABLED: 'pomodoro_notif_enabled'
  };

  static DEFAULT_ROUTINE = [
    { id: 'step-1', name: '서있기', minutes: 40, color: '#0284c7' },
    { id: 'step-2', name: '앉기', minutes: 20, color: '#0d9488' }
  ];

  static PRESETS = {
    standing: [
      { id: 'std-1', name: '서있기', minutes: 40, color: '#0284c7' },
      { id: 'std-2', name: '앉기', minutes: 20, color: '#0d9488' }
    ],
    pomodoro: [
      { id: 'pomo-1', name: '집중', minutes: 25, color: '#ea580c' },
      { id: 'pomo-2', name: '짧은 휴식', minutes: 5, color: '#16a34a' },
      { id: 'pomo-3', name: '집중', minutes: 25, color: '#ea580c' },
      { id: 'pomo-4', name: '짧은 휴식', minutes: 5, color: '#16a34a' },
      { id: 'pomo-5', name: '긴 휴식', minutes: 15, color: '#2563eb' }
    ],
    deepwork: [
      { id: 'dw-1', name: '딥포커스', minutes: 50, color: '#6366f1' },
      { id: 'dw-2', name: '휴식 & 스트레칭', minutes: 10, color: '#059669' }
    ]
  };

  static getRoutine() {
    try {
      const data = localStorage.getItem(this.KEYS.ROUTINE);
      return data ? JSON.parse(data) : this.DEFAULT_ROUTINE;
    } catch {
      return this.DEFAULT_ROUTINE;
    }
  }

  static saveRoutine(steps) {
    try {
      localStorage.setItem(this.KEYS.ROUTINE, JSON.stringify(steps));
    } catch (err) {
      console.error('Storage error:', err);
    }
  }

  static getAutoStart() {
    const val = localStorage.getItem(this.KEYS.AUTO_START);
    return val === null ? true : val === 'true';
  }

  static saveAutoStart(value) {
    localStorage.setItem(this.KEYS.AUTO_START, value ? 'true' : 'false');
  }

  static getCompletedCount() {
    const val = localStorage.getItem(this.KEYS.COMPLETED_COUNT);
    return val ? parseInt(val, 10) : 0;
  }

  static saveCompletedCount(count) {
    localStorage.setItem(this.KEYS.COMPLETED_COUNT, count.toString());
  }

  static getSoundEnabled() {
    const val = localStorage.getItem(this.KEYS.SOUND_ENABLED);
    return val === null ? true : val === 'true';
  }

  static saveSoundEnabled(enabled) {
    localStorage.setItem(this.KEYS.SOUND_ENABLED, enabled ? 'true' : 'false');
  }

  static getNotificationEnabled() {
    const val = localStorage.getItem(this.KEYS.NOTIF_ENABLED);
    return val === null ? false : val === 'true';
  }

  static saveNotificationEnabled(enabled) {
    localStorage.setItem(this.KEYS.NOTIF_ENABLED, enabled ? 'true' : 'false');
  }
}

// --- 3. Precision Timer Engine ---
class TimerEngine {
  constructor({ onTick, onComplete, onStateChange }) {
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.onStateChange = onStateChange;

    this.totalSeconds = 25 * 60;
    this.remainingSeconds = this.totalSeconds;
    this.status = 'IDLE'; // 'IDLE', 'RUNNING', 'PAUSED'

    this.timerId = null;
    this.endTime = null;
  }

  setDuration(minutes) {
    this.totalSeconds = Math.max(1, Math.round(minutes * 60));
    this.remainingSeconds = this.totalSeconds;
    this.onTick({
      remaining: this.remainingSeconds,
      total: this.totalSeconds,
      ratio: 1
    });
  }

  start() {
    if (this.status === 'RUNNING') return;

    this.status = 'RUNNING';
    this.endTime = Date.now() + this.remainingSeconds * 1000;
    this.onStateChange(this.status);

    this._runLoop();
  }

  pause() {
    if (this.status !== 'RUNNING') return;

    this.status = 'PAUSED';
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    // Calculate remaining seconds precisely
    if (this.endTime) {
      this.remainingSeconds = Math.max(0, Math.ceil((this.endTime - Date.now()) / 1000));
    }
    this.onStateChange(this.status);
  }

  reset() {
    this.pause();
    this.status = 'IDLE';
    this.remainingSeconds = this.totalSeconds;
    this.onStateChange(this.status);
    this.onTick({
      remaining: this.remainingSeconds,
      total: this.totalSeconds,
      ratio: 1
    });
  }

  adjustTime(deltaMinutes) {
    const deltaSeconds = deltaMinutes * 60;
    const newRemaining = Math.max(10, this.remainingSeconds + deltaSeconds);
    const difference = newRemaining - this.remainingSeconds;

    this.remainingSeconds = newRemaining;
    this.totalSeconds = Math.max(this.remainingSeconds, this.totalSeconds + difference);

    if (this.status === 'RUNNING') {
      this.endTime = Date.now() + this.remainingSeconds * 1000;
    }

    this.onTick({
      remaining: this.remainingSeconds,
      total: this.totalSeconds,
      ratio: this.remainingSeconds / this.totalSeconds
    });
  }

  _runLoop() {
    if (this.status !== 'RUNNING') return;

    const now = Date.now();
    const remainingMs = this.endTime - now;
    this.remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

    const ratio = Math.max(0, Math.min(1, this.remainingSeconds / this.totalSeconds));

    this.onTick({
      remaining: this.remainingSeconds,
      total: this.totalSeconds,
      ratio
    });

    if (this.remainingSeconds <= 0) {
      this.status = 'IDLE';
      this.timerId = null;
      this.onStateChange(this.status);
      this.onComplete();
      return;
    }

    // Precision drift compensation: schedule next tick near full second
    const delay = (remainingMs % 1000) || 1000;
    this.timerId = setTimeout(() => this._runLoop(), Math.min(delay, 1000));
  }
}

// --- 4. Main Application Controller ---
class AppController {
  constructor() {
    this.audioNotifier = new AudioNotifier();
    this.notificationService = new BrowserNotificationService();
    this.routineSteps = StorageService.getRoutine();
    this.currentIndex = 0;
    this.autoStartNext = StorageService.getAutoStart();
    this.completedCount = StorageService.getCompletedCount();

    // Cache DOM Elements
    this.dom = {
      // Header
      soundToggleBtn: document.getElementById('soundToggleBtn'),
      soundOnIcon: document.getElementById('soundOnIcon'),
      soundOffIcon: document.getElementById('soundOffIcon'),
      notificationToggleBtn: document.getElementById('notificationToggleBtn'),
      notifOnIcon: document.getElementById('notifOnIcon'),
      notifOffIcon: document.getElementById('notifOffIcon'),
      settingsBtn: document.getElementById('settingsBtn'),

      // Routine Navigation
      routineTabs: document.getElementById('routineTabs'),

      // Card & Activity
      activityDot: document.getElementById('activityDot'),
      currentActivityName: document.getElementById('currentActivityName'),
      timerDisplay: document.getElementById('timerDisplay'),
      sessionStatusText: document.getElementById('sessionStatusText'),
      progressCircle: document.getElementById('progressCircle'),

      // Quick Adjust
      quickSub1Btn: document.getElementById('quickSub1Btn'),
      quickAdd1Btn: document.getElementById('quickAdd1Btn'),
      quickAdd5Btn: document.getElementById('quickAdd5Btn'),

      // Controls
      toggleTimerBtn: document.getElementById('toggleTimerBtn'),
      toggleBtnText: document.getElementById('toggleBtnText'),
      resetBtn: document.getElementById('resetBtn'),
      prevBtn: document.getElementById('prevBtn'),
      nextBtn: document.getElementById('nextBtn'),

      // Footer
      completedSessionsCount: document.getElementById('completedSessionsCount'),
      resetSessionsBtn: document.getElementById('resetSessionsBtn'),

      // Dialog
      settingsDialog: document.getElementById('settingsDialog'),
      closeSettingsBtn: document.getElementById('closeSettingsBtn'),
      presetStandingBtn: document.getElementById('presetStandingBtn'),
      presetPomodoroBtn: document.getElementById('presetPomodoroBtn'),
      presetDeepWorkBtn: document.getElementById('presetDeepWorkBtn'),
      stepListContainer: document.getElementById('stepListContainer'),
      addStepBtn: document.getElementById('addStepBtn'),
      testSoundBtn: document.getElementById('testSoundBtn'),
      browserNotificationCheckbox: document.getElementById('browserNotificationCheckbox'),
      autoStartNextCheckbox: document.getElementById('autoStartNextCheckbox'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn')
    };

    this.timer = new TimerEngine({
      onTick: (data) => this.handleTick(data),
      onComplete: () => this.handleSessionComplete(),
      onStateChange: (state) => this.handleStateChange(state)
    });

    this.circumference = 2 * Math.PI * 126; // 791.68
  }

  init() {
    this.bindEvents();
    this.syncSoundUI(StorageService.getSoundEnabled());
    this.audioNotifier.isEnabled = StorageService.getSoundEnabled();
    this.syncNotificationUI();
    this.dom.autoStartNextCheckbox.checked = this.autoStartNext;
    this.dom.completedSessionsCount.textContent = this.completedCount;

    this.renderRoutineTabs();
    this.loadCurrentStep();
  }

  bindEvents() {
    // Audio Toggle
    this.dom.soundToggleBtn.addEventListener('click', () => {
      const enabled = this.audioNotifier.toggle();
      StorageService.saveSoundEnabled(enabled);
      this.syncSoundUI(enabled);
    });

    // Browser Notification Header Toggle Button
    this.dom.notificationToggleBtn.addEventListener('click', async () => {
      if (this.notificationService.getPermission() !== 'granted') {
        const granted = await this.notificationService.requestPermission();
        if (!granted && Notification.permission === 'denied') {
          alert('브라우저에서 알림 권한이 차단되어 있습니다.\n주소창 좌측의 설정/자물쇠 아이콘에서 알림을 허용해주세요.');
        }
      } else {
        this.notificationService.setEnabled(!this.notificationService.isEnabled);
      }
      this.syncNotificationUI();
    });

    // Timer Controls
    this.dom.toggleTimerBtn.addEventListener('click', () => {
      this.audioNotifier.init(); // enable audio context on gesture
      if (this.timer.status === 'RUNNING') {
        this.timer.pause();
      } else {
        this.timer.start();
      }
    });

    this.dom.resetBtn.addEventListener('click', () => this.timer.reset());

    this.dom.nextBtn.addEventListener('click', () => this.goToNextStep(false));
    this.dom.prevBtn.addEventListener('click', () => this.goToPrevStep());

    // Quick Time Adjustments
    this.dom.quickSub1Btn.addEventListener('click', () => this.timer.adjustTime(-1));
    this.dom.quickAdd1Btn.addEventListener('click', () => this.timer.adjustTime(1));
    this.dom.quickAdd5Btn.addEventListener('click', () => this.timer.adjustTime(5));

    // Reset Completed Sessions
    this.dom.resetSessionsBtn.addEventListener('click', () => {
      if (confirm('완료 세션 카운트를 초기화하시겠습니까?')) {
        this.completedCount = 0;
        StorageService.saveCompletedCount(0);
        this.dom.completedSessionsCount.textContent = '0';
      }
    });

    // Settings Dialog
    this.dom.settingsBtn.addEventListener('click', () => this.openSettings());
    this.dom.closeSettingsBtn.addEventListener('click', () => this.dom.settingsDialog.close());
    this.dom.settingsDialog.addEventListener('click', (e) => {
      if (e.target === this.dom.settingsDialog) this.dom.settingsDialog.close();
    });

    // Presets in Dialog
    this.dom.presetStandingBtn.addEventListener('click', () => {
      this.loadPreset(StorageService.PRESETS.standing);
    });
    this.dom.presetPomodoroBtn.addEventListener('click', () => {
      this.loadPreset(StorageService.PRESETS.pomodoro);
    });
    this.dom.presetDeepWorkBtn.addEventListener('click', () => {
      this.loadPreset(StorageService.PRESETS.deepwork);
    });

    // Add Step in Dialog
    this.dom.addStepBtn.addEventListener('click', () => this.addCustomStepRow());

    // Test Sound Button in Settings
    this.dom.testSoundBtn.addEventListener('click', () => {
      this.audioNotifier.playCompletionChime();
    });

    // Browser Notification Checkbox in Settings
    this.dom.browserNotificationCheckbox.addEventListener('change', async (e) => {
      if (e.target.checked) {
        if (this.notificationService.getPermission() !== 'granted') {
          const granted = await this.notificationService.requestPermission();
          if (!granted) {
            e.target.checked = false;
            if (Notification.permission === 'denied') {
              alert('브라우저에서 알림 권한이 차단되어 있습니다.\n주소창 좌측의 설정/자물쇠 아이콘에서 알림을 허용해주세요.');
            }
          }
        } else {
          this.notificationService.setEnabled(true);
        }
      } else {
        this.notificationService.setEnabled(false);
      }
      this.syncNotificationUI();
    });

    // Setup Drag & Drop on Step List Container
    this.setupStepListDragAndDrop();

    // Save Settings
    this.dom.saveSettingsBtn.addEventListener('click', () => this.saveSettings());

    // Keyboard Shortcuts (Space: Start/Pause, R: Reset, N: Next)
    window.addEventListener('keydown', (e) => {
      if (this.dom.settingsDialog.open || ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this.dom.toggleTimerBtn.click();
      } else if (e.key === 'r' || e.key === 'R') {
        this.timer.reset();
      } else if (e.key === 'n' || e.key === 'N') {
        this.goToNextStep(false);
      }
    });
  }

  renderRoutineTabs() {
    this.dom.routineTabs.innerHTML = '';
    this.routineSteps.forEach((step, idx) => {
      const tab = document.createElement('button');
      tab.className = `routine-tab ${idx === this.currentIndex ? 'active' : ''}`;
      tab.innerHTML = `<span>${step.name}</span> <small>${step.minutes}m</small>`;
      tab.addEventListener('click', () => {
        if (this.currentIndex !== idx) {
          this.currentIndex = idx;
          this.renderRoutineTabs();
          this.loadCurrentStep();
        }
      });
      this.dom.routineTabs.appendChild(tab);
    });
  }

  loadCurrentStep() {
    if (this.currentIndex >= this.routineSteps.length) {
      this.currentIndex = 0;
    }
    const currentStep = this.routineSteps[this.currentIndex];
    if (!currentStep) return;

    // Apply color theme accent
    const accentColor = currentStep.color || '#0284c7';
    document.documentElement.style.setProperty('--current-accent', accentColor);

    this.dom.currentActivityName.textContent = currentStep.name;
    this.timer.setDuration(currentStep.minutes);
    this.updateTabTitle(currentStep.minutes * 60, currentStep.name);
  }

  handleTick({ remaining, ratio }) {
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    this.dom.timerDisplay.textContent = formatted;

    // Update circular progress ring
    const offset = this.circumference * (1 - ratio);
    this.dom.progressCircle.style.strokeDashoffset = offset;

    // Update tab title
    const currentStep = this.routineSteps[this.currentIndex];
    this.updateTabTitle(remaining, currentStep ? currentStep.name : '');
  }

  updateTabTitle(remaining, activityName) {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    document.title = `${formatted} • ${activityName || '뽀모도로'}`;
  }

  handleStateChange(state) {
    if (state === 'RUNNING') {
      this.dom.toggleBtnText.textContent = '일시정지';
      this.dom.sessionStatusText.textContent = '진행 중';
      this.dom.timerDisplay.classList.add('running');
    } else if (state === 'PAUSED') {
      this.dom.toggleBtnText.textContent = '계속하기';
      this.dom.sessionStatusText.textContent = '일시 정지됨';
      this.dom.timerDisplay.classList.remove('running');
    } else {
      this.dom.toggleBtnText.textContent = '시작';
      this.dom.sessionStatusText.textContent = '준비 완료';
      this.dom.timerDisplay.classList.remove('running');
    }
  }

  handleSessionComplete() {
    const currentStep = this.routineSteps[this.currentIndex] || { name: '세션' };
    const nextIndex = (this.currentIndex + 1) % this.routineSteps.length;
    const nextStep = this.routineSteps[nextIndex] || { name: '다음 세션', minutes: 25 };

    // 1. Play enhanced crystal chime
    this.audioNotifier.playCompletionChime();

    // 2. Trigger browser system notification
    this.notificationService.notify({
      title: `⏰ [${currentStep.name}] 세션 완료!`,
      body: `다음 활동: ${nextStep.name} (${nextStep.minutes}분)가 시작됩니다.`
    });

    // 3. Increment completed count
    this.completedCount += 1;
    StorageService.saveCompletedCount(this.completedCount);
    this.dom.completedSessionsCount.textContent = this.completedCount;

    // 4. Switch to next step
    this.goToNextStep(this.autoStartNext);
  }

  goToNextStep(autoStart = false) {
    this.timer.pause();
    this.currentIndex = (this.currentIndex + 1) % this.routineSteps.length;
    this.renderRoutineTabs();
    this.loadCurrentStep();

    if (autoStart) {
      setTimeout(() => this.timer.start(), 400);
    }
  }

  goToPrevStep() {
    this.timer.pause();
    this.currentIndex = (this.currentIndex - 1 + this.routineSteps.length) % this.routineSteps.length;
    this.renderRoutineTabs();
    this.loadCurrentStep();
  }

  syncSoundUI(enabled) {
    if (enabled) {
      this.dom.soundOnIcon.classList.remove('hidden');
      this.dom.soundOffIcon.classList.add('hidden');
    } else {
      this.dom.soundOnIcon.classList.add('hidden');
      this.dom.soundOffIcon.classList.remove('hidden');
    }
  }

  syncNotificationUI() {
    const isPermGranted = this.notificationService.getPermission() === 'granted';
    const isActive = isPermGranted && this.notificationService.isEnabled;

    if (isActive) {
      this.dom.notifOnIcon.classList.remove('hidden');
      this.dom.notifOffIcon.classList.add('hidden');
      this.dom.notificationToggleBtn.classList.add('active');
      this.dom.notificationToggleBtn.title = '브라우저 시스템 알림 켜짐 (클릭하여 끄기)';
    } else {
      this.dom.notifOnIcon.classList.add('hidden');
      this.dom.notifOffIcon.classList.remove('hidden');
      this.dom.notificationToggleBtn.classList.remove('active');
      this.dom.notificationToggleBtn.title = '브라우저 시스템 알림 꺼짐 (클릭하여 켜기)';
    }

    if (this.dom.browserNotificationCheckbox) {
      this.dom.browserNotificationCheckbox.checked = isActive;
    }
  }

  // --- Settings Modal Logic ---
  openSettings() {
    this.populateStepRows(this.routineSteps);
    this.dom.autoStartNextCheckbox.checked = this.autoStartNext;
    this.syncNotificationUI();
    this.dom.settingsDialog.showModal();
  }

  loadPreset(presetList) {
    this.populateStepRows(presetList);
  }

  populateStepRows(steps) {
    this.dom.stepListContainer.innerHTML = '';
    steps.forEach((step) => {
      this.addCustomStepRow(step.name, step.minutes);
    });
  }

  addCustomStepRow(name = '새 활동', minutes = 25) {
    const row = document.createElement('div');
    row.className = 'step-item-row';
    row.setAttribute('draggable', 'false');

    row.innerHTML = `
      <div class="drag-handle" title="드래그하여 순서 변경" aria-label="드래그하여 순서 변경">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="5" r="1.5"></circle>
          <circle cx="15" cy="5" r="1.5"></circle>
          <circle cx="9" cy="12" r="1.5"></circle>
          <circle cx="15" cy="12" r="1.5"></circle>
          <circle cx="9" cy="19" r="1.5"></circle>
          <circle cx="15" cy="19" r="1.5"></circle>
        </svg>
      </div>
      <input type="text" class="step-name-input" value="${this.escapeHtml(name)}" placeholder="활동명 (예: 서있기, 집중)" required>
      <div class="step-duration-wrapper">
        <input type="number" class="step-duration-input" value="${minutes}" min="1" max="180" required>
        <span class="step-duration-unit">분</span>
      </div>
      <button type="button" class="step-delete-btn" title="삭제" aria-label="항목 삭제">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `;

    // Grabbing the drag-handle enables drag on the row
    const handle = row.querySelector('.drag-handle');
    handle.addEventListener('mousedown', () => {
      row.setAttribute('draggable', 'true');
    });
    handle.addEventListener('mouseup', () => {
      row.setAttribute('draggable', 'false');
    });
    row.addEventListener('dragend', () => {
      row.setAttribute('draggable', 'false');
      row.classList.remove('dragging');
    });

    // Touch reordering support for mobile
    this.bindTouchDrag(handle, row);

    row.querySelector('.step-delete-btn').addEventListener('click', () => {
      if (this.dom.stepListContainer.children.length <= 1) {
        alert('최소 1개 이상의 활동이 있어야 합니다.');
        return;
      }
      row.remove();
    });

    this.dom.stepListContainer.appendChild(row);
  }

  setupStepListDragAndDrop() {
    const container = this.dom.stepListContainer;
    let draggingRow = null;

    container.addEventListener('dragstart', (e) => {
      const row = e.target.closest('.step-item-row');
      if (!row) return;
      draggingRow = row;
      row.classList.add('dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', '');
      }
    });

    container.addEventListener('dragend', (e) => {
      const row = e.target.closest('.step-item-row');
      if (row) {
        row.classList.remove('dragging');
        row.setAttribute('draggable', 'false');
      }
      container.querySelectorAll('.step-item-row').forEach(r => {
        r.classList.remove('dragging');
        r.setAttribute('draggable', 'false');
      });
      draggingRow = null;
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggingRow) return;

      const afterElement = this.getDragAfterElement(container, e.clientY);
      if (afterElement == null) {
        container.appendChild(draggingRow);
      } else if (afterElement !== draggingRow) {
        container.insertBefore(draggingRow, afterElement);
      }
    });
  }

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.step-item-row:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  bindTouchDrag(handle, row) {
    const container = this.dom.stepListContainer;

    handle.addEventListener('touchstart', () => {
      row.classList.add('dragging');
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      e.preventDefault();

      const afterElement = this.getDragAfterElement(container, touch.clientY);
      if (afterElement == null) {
        container.appendChild(row);
      } else if (afterElement !== row) {
        container.insertBefore(row, afterElement);
      }
    }, { passive: false });

    handle.addEventListener('touchend', () => {
      row.classList.remove('dragging');
    });

    handle.addEventListener('touchcancel', () => {
      row.classList.remove('dragging');
    });
  }

  saveSettings() {
    const rows = this.dom.stepListContainer.querySelectorAll('.step-item-row');
    const newSteps = [];

    // Distinct palette for alternating steps
    const defaultColors = ['#0284c7', '#0d9488', '#ea580c', '#16a34a', '#8b5cf6', '#d97706'];

    rows.forEach((row, i) => {
      const nameInput = row.querySelector('.step-name-input');
      const durationInput = row.querySelector('.step-duration-input');

      const name = nameInput.value.trim() || `활동 ${i + 1}`;
      const minutes = Math.max(1, Math.min(180, parseInt(durationInput.value, 10) || 25));

      newSteps.push({
        id: `custom-step-${Date.now()}-${i}`,
        name,
        minutes,
        color: defaultColors[i % defaultColors.length]
      });
    });

    if (newSteps.length === 0) {
      alert('최소 1개 이상의 활동을 입력해주세요.');
      return;
    }

    this.routineSteps = newSteps;
    StorageService.saveRoutine(this.routineSteps);

    this.autoStartNext = this.dom.autoStartNextCheckbox.checked;
    StorageService.saveAutoStart(this.autoStartNext);

    this.currentIndex = 0;
    this.renderRoutineTabs();
    this.loadCurrentStep();

    this.dom.settingsDialog.close();
  }

  escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

// Initialize Application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
