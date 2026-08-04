const APP_VERSION = '1.0.9';
const VERSION_HISTORY = {
    '1.0.0': 'Versión inicial',
    '1.0.1': 'Corrección de selección de preguntas en modo textual',
    '1.0.2': 'Mejora visual de selección de preguntas',
    '1.0.3': 'Sincronización de selección entre host y jugadores',
    '1.0.4': 'Timer visible para jugadores',
    '1.0.5': 'Corrección de penalización en modo difícil con timer',
    '1.0.6': 'Mejora visual para host',
    '1.0.7': 'Nuevos tipos de pregunta: ¿Quién soy? y Verdadero/Falso',
    '1.0.8': 'Edicion de trivia y arreglos en las preguntas'
    '1.0.9': 'Eliminacion de vistas de categorias he implementacion de categorias en la vista de preguntas y respuestas, y agregado del Easter Egg "ABY"'
};

function updateVersionDisplay() {
    const versionEl = document.getElementById('version-display');
    if (versionEl) {
        versionEl.textContent = 'v' + APP_VERSION;
        versionEl.title = 'Historial de versiones:\n' + 
            Object.entries(VERSION_HISTORY).map(([v, desc]) => `v${v}: ${desc}`).join('\n');
    }
}

function incrementVersion() {
    const parts = APP_VERSION.split('.').map(Number);
    let major = parts[0];
    let minor = parts[1];
    let patch = parts[2] + 1;
    
    if (patch >= 10) {
        patch = 0;
        minor++;
    }
    if (minor >= 10) {
        minor = 0;
        major++;
    }
    
    return `${major}.${minor}.${patch}`;
}

class JeopardyGame {
    constructor(roomFromQR) {
    this.categories = [];
    this.questions = [];
    this.players = [];
    this.currentPlayer = 0;
    this.totalCategories = 0;
    this.questionsPerCategory = 0;
    this.currentQuestion = null;
    this.gameStarted = false;
    this.answerRevealed = false;
    this.isHost = false;
    this.roomCode = '';
    this.peer = null;
    this.connections = [];
    this.joinedNames = new Set();
    this.musicPlaying = false;
    this.playerName = '';
    this.playerEmoji = '';
    this.sortedPlayers = [];
    this.roomFromQR = roomFromQR;
    this.jumpEnabled = false;
    this.hardMode = false;
    this.textualMode = false;
    this.timerEnabled = false;
    this.timerSeconds = 0;
    this.timerInterval = null;
    this.timerRunning = false;
    this.timerTimeout = false;
    this.jumpCount = 0;
    this.playersJumped = new Set();
    this.questionJumped = false;
    this.originalPlayer = 0;
    this.playerAnswer = null;
    this.availableEmojis = this.getEmojiList();
    this.timerTextSeconds = 25;
    this.timerOptionsSeconds = 15;
    this.timerAnagramSeconds = 20;
    this.timerWhoamiSeconds = 20;
    this.timerTruefalseSeconds = 10;
    this.selectedQuestionId = null;
    this.selectedQuestionData = null;
    this.pistasReveladas = 0;
    this.pistasReveladasSet = new Set();
    this.valorPregunta = 1;
    this.editMode = null;
    this.isAby = false; // [NUEVO] Para el easter egg

    this.setupMusic();
    this.musicStarted = false;
    this.bindEvents();
    this.setupEmojiPicker();
    
    if (this.restoreState()) {
        console.log('Estado restaurado');
    } else if (roomFromQR) {
        this.showQRJoinScreen(roomFromQR);
    } else {
        this.showScreen('home-screen');
    }
}


    getEmojiList() {
    return {
        animals: ['🐶','🐺','🦁','🐭','🐰','🐼','🐻','🦉','🐧','🦄','🐸','🐒','🦑','🪼','🐦‍🔥','🦩','🐦‍⬛','🦀','🦈','🐳','🦋'],
        food: ['🍕','🍔','🥚','🍿','🌮','🥩','🥠','🧀','🥗','🍩','🍰','🍭','🍫','🍼','🍾','🍵','🍺','🥞','🍷','🧋','🥨'],
        nature: ['🍒','🥭','🍓','🍋','🥝','🥥','🍇','🍉','🍍','🍌','🌷','🌹','🪻','🌳','🍃','🌵','🌻','🍁','🌲','🍀','🪺'],
        objects: ['👓','🎨','🛒','🩴','🥾','💍','💎','⚽','🏀','👠','⚾','🎱','🤿','🥊','🎲','🕹️','🎮','♟️','♠️','🎈','🧨'],
        others: ['✈️','💵','🌍','🪐','🏯','🗼','⛺','💈','🎫','🧻','🚿','🧯','🌕','☀️','🔥','💧','❤️','🎁','💝','❄️','🌈']
    };
}

    getAllEmojis() {
    const lists = this.availableEmojis;
    return [...lists.animals, ...lists.food, ...lists.nature, ...lists.objects, ...lists.others];
}

    setupEmojiPicker() {
    const trigger = document.getElementById('emoji-picker-trigger');
    const picker = document.getElementById('emoji-picker');
    const clearBtn = document.getElementById('emoji-clear');
    if (!trigger || !picker) return;
    
    const allEmojis = this.getAllEmojis();
    this.playerEmoji = allEmojis[Math.floor(Math.random() * allEmojis.length)];
    trigger.textContent = this.playerEmoji;
    
    // Llenar grids por categoría
    const grids = {
        animals: document.getElementById('emoji-animals'),
        food: document.getElementById('emoji-food'),
        nature: document.getElementById('emoji-nature'),
        objects: document.getElementById('emoji-objects'),
        others: document.getElementById('emoji-others')
    };
    
    Object.entries(this.availableEmojis).forEach(([category, emojis]) => {
        const grid = grids[category];
        if (!grid) return;
        emojis.forEach(emoji => {
            const item = document.createElement('div');
            item.className = 'emoji-item';
            item.textContent = emoji;
            if (emoji === this.playerEmoji) item.classList.add('selected');
            item.addEventListener('click', () => {
                this.playerEmoji = emoji;
                trigger.textContent = emoji;
                document.querySelectorAll('.emoji-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                this.playSound('click');
            });
            grid.appendChild(item);
        });
    });
    
    trigger.addEventListener('click', () => { picker.classList.toggle('hidden'); this.playSound('click'); });
    clearBtn.addEventListener('click', () => { this.playerEmoji = ''; trigger.textContent = '😊'; document.querySelectorAll('.emoji-item').forEach(el => el.classList.remove('selected')); this.playSound('click'); });
}

    setupMusic() {
        this.bgMusic = document.getElementById('bg-music');
        this.gameMusic = document.getElementById('game-music');
        if (this.bgMusic) this.bgMusic.volume = 0.12;
        if (this.gameMusic) this.gameMusic.volume = 0.18;
    }

    startGameMusic() {
    console.log('Iniciando música del juego...');
    if (this.bgMusic) {
        this.bgMusic.pause();
        this.bgMusic.currentTime = 0;
    }
    if (this.gameMusic) {
        this.gameMusic.currentTime = 0;
        this.gameMusic.volume = 0.2;
        
        // Intentar reproducir
        const playPromise = this.gameMusic.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('Música del juego iniciada');
                this.musicPlaying = true;
                this.updateMusicButton();
            }).catch((err) => {
                console.log('Reproducción bloqueada, esperando interacción:', err);
                // Esperar a la primera interacción del usuario
                const playOnInteraction = () => {
                    this.gameMusic.play().then(() => {
                        this.musicPlaying = true;
                        this.updateMusicButton();
                    }).catch(() => {});
                    document.removeEventListener('click', playOnInteraction);
                    document.removeEventListener('touchstart', playOnInteraction);
                };
                document.addEventListener('click', playOnInteraction, { once: true });
                document.addEventListener('touchstart', playOnInteraction, { once: true });
            });
        }
    }
}

    stopGameMusic() {
    console.log('Deteniendo música del juego...');
    if (this.gameMusic) {
        this.gameMusic.pause();
        this.gameMusic.currentTime = 0;
    }
    this.musicPlaying = false;
    this.updateMusicButton();
}

    updateMusicButton() {
        const btn = document.getElementById('toggle-music');
        if (btn) btn.innerHTML = this.musicPlaying ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-music"></i>';
    }

    playSound(type) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            switch(type) {
                case 'select': this._tone(ctx, 660, 0.08, 'sine', now); break;
                case 'correct': this._tone(ctx, 523, 0.12, 'sine', now); this._tone(ctx, 659, 0.12, 'sine', now + 0.1); this._tone(ctx, 784, 0.2, 'sine', now + 0.2); break;
                case 'incorrect': this._tone(ctx, 200, 0.3, 'sawtooth', now); break;
                case 'jump': this._tone(ctx, 440, 0.1, 'triangle', now); this._tone(ctx, 550, 0.1, 'triangle', now + 0.1); break;
                case 'click': this._tone(ctx, 800, 0.03, 'sine', now); break;
                case 'toggle': this._tone(ctx, 500, 0.05, 'sine', now); this._tone(ctx, 700, 0.05, 'sine', now + 0.05); break;
                case 'kick': this._tone(ctx, 150, 0.2, 'square', now); break;
                case 'join': this._tone(ctx, 400, 0.1, 'sine', now); this._tone(ctx, 600, 0.1, 'sine', now + 0.1); this._tone(ctx, 800, 0.15, 'sine', now + 0.2); break;
                case 'win': [523, 659, 784, 1047].forEach((f, i) => { this._tone(ctx, f, 0.2, 'sine', now + i * 0.15); }); break;
                case 'send': this._tone(ctx, 600, 0.08, 'sine', now); this._tone(ctx, 900, 0.1, 'sine', now + 0.08); break;
            }
        } catch(e) {}
    }

    _tone(ctx, freq, dur, type, startTime) {
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = type;
        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
        osc.start(startTime); osc.stop(startTime + dur);
    }

    saveState() {
    const state = {
        categories: this.categories,
        questions: this.questions,
        players: this.players,
        currentPlayer: this.currentPlayer,
        totalCategories: this.totalCategories,
        questionsPerCategory: this.questionsPerCategory,
        gameStarted: this.gameStarted,
        isHost: this.isHost,
        roomCode: this.roomCode,
        currentScreen: this.getCurrentScreen(),
        jumpEnabled: this.jumpEnabled,
        hardMode: this.hardMode,
        textualMode: this.textualMode,
        timerEnabled: this.timerEnabled,
        timerTextSeconds: this.timerTextSeconds,
        timerOptionsSeconds: this.timerOptionsSeconds,
        timerAnagramSeconds: this.timerAnagramSeconds,
        timerWhoamiSeconds: this.timerWhoamiSeconds,
        timerTruefalseSeconds: this.timerTruefalseSeconds
    };
    localStorage.setItem('jeopardy-state', JSON.stringify(state));
}

    restoreState() {
    const saved = localStorage.getItem('jeopardy-state');
    if (!saved) return false;
    try {
        const state = JSON.parse(saved);
        if (!state.isHost || !state.roomCode) return false;
        Object.assign(this, state);
        
        if (state.timerTextSeconds) this.timerTextSeconds = state.timerTextSeconds;
        if (state.timerOptionsSeconds) this.timerOptionsSeconds = state.timerOptionsSeconds;
        if (state.timerAnagramSeconds) this.timerAnagramSeconds = state.timerAnagramSeconds;
        if (state.timerWhoamiSeconds) this.timerWhoamiSeconds = state.timerWhoamiSeconds;
        if (state.timerTruefalseSeconds) this.timerTruefalseSeconds = state.timerTruefalseSeconds;
        
        this.joinedNames = new Set(this.players.map(p => p.name));
        this.initPeer(this.roomCode + '-host');
        if (state.currentScreen) {
            this.showScreen(state.currentScreen);
            if (state.currentScreen === 'lobby-screen') { this.updateLobby(); this.updateOptionsUI(); }
            else if (state.currentScreen === 'game-screen') { this.renderBoard(); this.startGameMusic(); }
            else if (state.currentScreen === 'questions-screen') this.showQuestionsScreen();
        }
        return true;
    } catch (e) { return false; }
}

    clearState() { localStorage.removeItem('jeopardy-state'); }
    getCurrentScreen() { const a = document.querySelector('.screen.active'); return a ? a.id : 'home-screen'; }

    showQRJoinScreen(code) {
        this.roomCode = code; this.isHost = false;
        document.getElementById('join-form').classList.remove('hidden');
        document.getElementById('room-code').value = code; document.getElementById('room-code').disabled = true;
        document.getElementById('join-player-name').focus();
        document.querySelector('.home-actions').style.display = 'none';
        document.querySelector('.trivia-actions').style.display = 'none';
        this.showScreen('home-screen');
    }

    bindEvents() {
    this.onClick('create-room-btn', () => { this.createRoom(); this.playSound('click'); });
    this.onClick('join-room-btn', () => { document.getElementById('join-form').classList.remove('hidden'); document.getElementById('room-code').disabled = false; document.getElementById('room-code').value = ''; document.querySelector('.home-actions').style.display = 'flex'; document.querySelector('.trivia-actions').style.display = 'flex'; this.playSound('click'); });
    this.onClick('join-room-submit', () => { this.joinRoom(); this.playSound('click'); });
    this.onClick('cancel-join', () => { document.getElementById('join-form').classList.add('hidden'); document.querySelector('.home-actions').style.display = 'flex'; document.querySelector('.trivia-actions').style.display = 'flex'; if (this.roomFromQR) window.location.href = window.location.pathname; this.playSound('click'); });
    this.onClick('toggle-music', () => this.toggleMusic());
    this.onClick('load-trivia-btn', () => { document.getElementById('load-trivia-form').classList.remove('hidden'); this.playSound('click'); });
    this.onClick('load-trivia-submit', () => { this.importTrivia(); this.playSound('click'); });
    this.onClick('cancel-load-trivia', () => { document.getElementById('load-trivia-form').classList.add('hidden'); this.playSound('click'); });
    this.onClick('back-to-home', () => { this.disconnect(); this.playSound('click'); });
    this.onClick('back-to-home-from-questions', () => { this.disconnect(); this.playSound('click'); });
    this.onClick('submit-questions', () => { this.submitQuestions(); this.playSound('click'); });
    this.onClick('back-to-questions', () => { this.showQuestionsScreen(); this.saveState(); this.playSound('click'); });
    this.onClick('export-trivia', () => { this.exportTrivia(); this.playSound('click'); });
    this.onClick('start-game-lobby', () => { this.startGame(); this.playSound('click'); });
    this.onClick('leave-lobby', () => { this.leaveLobby(); this.playSound('click'); });
    this.onClick('end-game', () => { this.endGame(); this.playSound('click'); });
    this.onClick('btn-correct', () => this.handleAnswer(true));
    this.onClick('btn-incorrect', () => this.handleAnswer(false));
    this.onClick('btn-jump', () => this.jumpQuestion());
    this.onClick('show-full-results', () => { this.toggleFullResults(); this.playSound('click'); });
    this.onClick('new-game', () => { this.disconnect(); this.playSound('click'); });
    this.onClick('btn-manual-add', () => this.adjustManualPoints(1));
    this.onClick('btn-manual-sub', () => this.adjustManualPoints(-1));
    this.onClick('btn-send-answer', () => this.sendPlayerAnswer());
    this.onClick('edit-trivia-btn', () => { this.editTrivia(); this.playSound('click'); });
    
    const closeBtn = document.querySelector('#question-modal .close');
    if (closeBtn) closeBtn.addEventListener('click', () => { this.closeModal(); this.playSound('click'); });
    
    const jumpCheck = document.getElementById('option-jump');
    const hardCheck = document.getElementById('option-hard');
    const textualCheck = document.getElementById('option-textual');
    const timerCheck = document.getElementById('option-timer');
    
    if (jumpCheck) jumpCheck.addEventListener('change', () => { this.jumpEnabled = jumpCheck.checked; this.saveState(); this.playSound('toggle'); });
    if (hardCheck) hardCheck.addEventListener('change', () => { this.hardMode = hardCheck.checked; this.saveState(); this.playSound('toggle'); });
    if (textualCheck) textualCheck.addEventListener('change', () => { this.textualMode = textualCheck.checked; this.saveState(); this.playSound('toggle'); });
    
    if (timerCheck) {
        timerCheck.addEventListener('change', () => {
            this.timerEnabled = timerCheck.checked;
            this.toggleTimerSettings(this.timerEnabled);
            this.saveState();
            this.playSound('toggle');
        });
    }
    
    const timerText = document.getElementById('timer-text');
    const timerOptions = document.getElementById('timer-options');
    const timerAnagram = document.getElementById('timer-anagram');
    const timerWhoami = document.getElementById('timer-whoami');
    const timerTruefalse = document.getElementById('timer-truefalse');
    
    if (timerText) timerText.addEventListener('change', () => {
        const val = parseInt(timerText.value);
        if (val >= 5 && val <= 60) this.timerTextSeconds = val;
        else timerText.value = this.timerTextSeconds;
        this.saveState();
    });
    
    if (timerOptions) timerOptions.addEventListener('change', () => {
        const val = parseInt(timerOptions.value);
        if (val >= 5 && val <= 60) this.timerOptionsSeconds = val;
        else timerOptions.value = this.timerOptionsSeconds;
        this.saveState();
    });
    
    if (timerAnagram) timerAnagram.addEventListener('change', () => {
        const val = parseInt(timerAnagram.value);
        if (val >= 5 && val <= 60) this.timerAnagramSeconds = val;
        else timerAnagram.value = this.timerAnagramSeconds;
        this.saveState();
    });
    
    if (timerWhoami) timerWhoami.addEventListener('change', () => {
        const val = parseInt(timerWhoami.value);
        if (val >= 5 && val <= 60) this.timerWhoamiSeconds = val;
        else timerWhoami.value = this.timerWhoamiSeconds;
        this.saveState();
    });
    
    if (timerTruefalse) timerTruefalse.addEventListener('change', () => {
        const val = parseInt(timerTruefalse.value);
        if (val >= 5 && val <= 60) this.timerTruefalseSeconds = val;
        else timerTruefalse.value = this.timerTruefalseSeconds;
        this.saveState();
    });
    
    const roomInput = document.getElementById('room-code');
    const nameInput = document.getElementById('join-player-name');
    
    if (roomInput && nameInput) {
        roomInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') nameInput.focus(); });
        nameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.joinRoom(); });
    }
    
    if (nameInput) {
        nameInput.addEventListener('input', () => {
            const hint = document.getElementById('name-length-hint');
            if (hint) {
                const length = nameInput.value.length;
                hint.textContent = `${length}/12`;
                if (length > 10) {
                    hint.classList.add('warning');
                } else {
                    hint.classList.remove('warning');
                }
            }
        });
    }
    
    const answerInput = document.getElementById('player-answer-input');
    if (answerInput) {
        answerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendPlayerAnswer(); });
    }
    
    window.addEventListener('beforeunload', () => { if (this.isHost && this.roomCode) this.saveState(); });

    document.addEventListener('click', () => {
        if (this.gameStarted && !this.musicPlaying && this.gameMusic) {
            this.gameMusic.play().then(() => {
                this.musicPlaying = true;
                this.updateMusicButton();
            }).catch(() => {});
        }
    }, { once: false });
}

    onClick(id, handler) { const el = document.getElementById(id); if (el) el.addEventListener('click', handler); }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(id);
        if (screen) screen.classList.add('active');
        
        const hostControls = document.getElementById('host-controls');
        const lobbyHostActions = document.getElementById('lobby-host-actions');
        const lobbyPlayerActions = document.getElementById('lobby-player-actions');
        const gameOptions = document.getElementById('game-options');
        const manualPanel = document.getElementById('manual-points-panel');
        
        if (hostControls) hostControls.style.display = (this.isHost && id === 'game-screen') ? 'flex' : 'none';
        if (lobbyHostActions) lobbyHostActions.style.display = (this.isHost && id === 'lobby-screen') ? 'flex' : 'none';
        if (lobbyPlayerActions) lobbyPlayerActions.style.display = (!this.isHost && id === 'lobby-screen') ? 'flex' : 'none';
        if (gameOptions) gameOptions.classList.toggle('hidden', !this.isHost || id !== 'lobby-screen');
        if (manualPanel) manualPanel.classList.toggle('hidden', !this.isHost || id !== 'game-screen');
        
        if (id === 'lobby-screen') this.updateOptionsUI();
        if (id === 'game-screen') this.updateManualPointsPanel();
        if (this.isHost) this.saveState();
    }

    updateOptionsUI() {
    const jumpCheck = document.getElementById('option-jump');
    const hardCheck = document.getElementById('option-hard');
    const textualCheck = document.getElementById('option-textual');
    const timerCheck = document.getElementById('option-timer');
    
    if (jumpCheck) jumpCheck.checked = this.jumpEnabled;
    if (hardCheck) hardCheck.checked = this.hardMode;
    if (textualCheck) textualCheck.checked = this.textualMode;
    if (timerCheck) {
        timerCheck.checked = this.timerEnabled;
        this.toggleTimerSettings(this.timerEnabled);
    }
    
    // [NUEVO] Actualizar valores de tiempo
    const timerText = document.getElementById('timer-text');
    const timerOptions = document.getElementById('timer-options');
    const timerAnagram = document.getElementById('timer-anagram');
    if (timerText) timerText.value = this.timerTextSeconds;
    if (timerOptions) timerOptions.value = this.timerOptionsSeconds;
    if (timerAnagram) timerAnagram.value = this.timerAnagramSeconds;
}

    updateManualPointsPanel() {
        const select = document.getElementById('manual-player-select');
        if (!select) return;
        select.innerHTML = '<option value="">Seleccionar jugador...</option>';
        this.players.forEach((p, i) => {
            if (!p.isHost) {
                const opt = document.createElement('option');
                opt.value = i; opt.textContent = (p.emoji ? p.emoji + ' ' : '') + p.name + ' (' + p.score + ' pts)';
                select.appendChild(opt);
            }
        });
    }

    toggleMusic() {
        if (this.musicPlaying) {
            if (this.bgMusic) this.bgMusic.pause();
            if (this.gameMusic) this.gameMusic.pause();
            this.musicPlaying = false;
        } else {
            if (this.gameStarted) { if (this.gameMusic) this.gameMusic.play().catch(() => {}); }
            else { if (this.bgMusic) this.bgMusic.play().catch(() => {}); }
            this.musicPlaying = true;
        }
        this.updateMusicButton();
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = ''; for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        return code;
    }

    createRoom() {
    this.clearState();
    this.isHost = true;
    this.roomCode = this.generateRoomCode();
    this.players = [{ name: 'Host', score: 0, id: 'host', isHost: true, emoji: '👑' }];
    this.joinedNames = new Set(['Host']);
    
    // Configuración por defecto
    this.totalCategories = 5;
    this.questionsPerCategory = 5;
    this.categories = ['Categoría 1', 'Categoría 2', 'Categoría 3', 'Categoría 4', 'Categoría 5'];
    
    // Inicializar preguntas vacías
    this.questions = [];
    let id = 0;
    this.categories.forEach(cat => {
        for (let i = 0; i < this.questionsPerCategory; i++) {
            this.questions.push({
                id: id,
                category: cat,
                points: (i + 1) * 100,
                question: '',
                answer: '',
                used: false,
                type: 'text',
                options: ['', ''],
                pistas: ['', '', '']
            });
            id++;
        }
    });
    
    this.initPeer(this.roomCode + '-host');
    this.showQuestionsScreen();
    this.saveState();
    this.showToast('🎯 ¡Crea tu trivia! Configura categorías, preguntas y respuestas');
}

    joinRoom() {
    const code = document.getElementById('room-code').value.trim().toUpperCase();
    const nameInput = document.getElementById('join-player-name');
    let name = nameInput.value.trim();
    
    if (!name) return alert('Ingresa tu nombre');
    
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F1E0}-\u{1F1FF}]/gu;
    if (emojiRegex.test(name)) {
        return alert('❌ El nombre no puede contener emojis. Usa solo letras y números.');
    }
    
    if (name.length > 12) {
        return alert('❌ El nombre no puede tener más de 12 caracteres.');
    }
    
    if (!code || code.length !== 6) return alert('El código debe tener 6 caracteres');
    
    // [NUEVO] Verificar nombre duplicado y agregar número
    const btn = document.getElementById('join-room-submit');
    btn.disabled = true;
    btn.textContent = 'Verificando...';
    
    // Verificar duplicados en la sala (solo si hay conexión)
    this.roomCode = code;
    this.isHost = false;
    this.playerName = name;
    
    // Guardar en sessionStorage para posible duplicado
    sessionStorage.setItem('jeopardy-player-code', code);
    sessionStorage.setItem('jeopardy-player-name', name);
    sessionStorage.setItem('jeopardy-player-emoji', this.playerEmoji);
    
    this.initPeer(code + '-player-' + Date.now());
}

// [NUEVO] Función para generar nombre con número si está duplicado
generateUniqueName(baseName, existingNames) {
    if (!existingNames.has(baseName)) {
        return baseName;
    }
    let counter = 1;
    let newName = `${baseName} ${counter}`;
    while (existingNames.has(newName)) {
        counter++;
        newName = `${baseName} ${counter}`;
    }
    return newName;
}

    initPeer(id) {
        if (this.peer) { this.peer.destroy(); this.peer = null; }
        this.peer = new Peer(id, { debug: 0, config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] } });
        this.peer.on('open', (peerId) => {
            if (!this.isHost) setTimeout(() => { const conn = this.peer.connect(this.roomCode + '-host', { reliable: true, metadata: { name: this.playerName, emoji: this.playerEmoji } }); this.handleConnection(conn); }, 500);
        });
        this.peer.on('connection', (conn) => this.handleConnection(conn));
        this.peer.on('error', (err) => { if (!this.isHost) { alert('Error de conexión.'); const btn = document.getElementById('join-room-submit'); if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; } } });
        this.peer.on('disconnected', () => { if (this.peer && !this.peer.destroyed) this.peer.reconnect(); });
    }

    handleConnection(conn) {
        if (this.connections.find(c => c.peer === conn.peer)) { conn.close(); return; }
        this.connections.push(conn);
        conn.on('open', () => {
            if (this.isHost) conn.send({ type: 'welcome', players: this.players, gameStarted: this.gameStarted, categories: this.categories, questions: this.questions, totalCategories: this.totalCategories, questionsPerCategory: this.questionsPerCategory, currentPlayer: this.currentPlayer, jumpEnabled: this.jumpEnabled, hardMode: this.hardMode, textualMode: this.textualMode });
            else conn.send({ type: 'join-request', name: this.playerName, emoji: this.playerEmoji });
        });
        conn.on('data', (data) => this.handleData(conn, data));
        conn.on('close', () => {
            this.connections = this.connections.filter(c => c !== conn);
            if (this.isHost && conn.metadata?.name) {
                this.players = this.players.filter(p => p.name !== conn.metadata.name);
                this.joinedNames.delete(conn.metadata.name);
                this.broadcastPlayers(); this.updateLobby(); this.saveState();
            }
        });
    }

    handleData(conn, data) {
    if (!this.isHost) {
        switch (data.type) {
            case 'welcome':
                this.players = data.players || [];
                this.jumpEnabled = data.jumpEnabled || false;
                this.hardMode = data.hardMode || false;
                this.textualMode = data.textualMode || false;
                this.timerEnabled = data.timerEnabled || false;
                this.timerTextSeconds = data.timerTextSeconds || 25;
                this.timerOptionsSeconds = data.timerOptionsSeconds || 15;
                this.timerAnagramSeconds = data.timerAnagramSeconds || 20;
                this.updateLobby();
                if (data.gameStarted) {
                    this.loadGameState(data);
                    this.renderBoard();
                    this.showScreen('game-screen');
                    this.startGameMusic();
                } else {
                    this.showLobby();
                }
                const btn = document.getElementById('join-room-submit');
                if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
                if (window.location.search) window.history.replaceState({}, '', window.location.pathname);
                this.playSound('join');
                break;
                
            case 'players-update':
                this.players = data.players;
                this.updateLobby();
                break;
                
            case 'game-start':
                this.loadGameState(data);
                this.renderBoard();
                this.showScreen('game-screen');
                this.startGameMusic();
                break;

            case 'points-animation': // [NUEVO]
                this.handlePointsAnimation(data);
                break;
                
            case 'game-update':
                this.applyGameUpdate(data);
                break;

            case 'name-changed': // [NUEVO]
                this.playerName = data.newName;
                sessionStorage.setItem('jeopardy-player-name', data.newName);
                this.showToast(`⚠️ El nombre "${data.originalName}" ya estaba en uso. Has sido renombrado a "${data.newName}"`);
                break;
                
            case 'question-selected':
                document.getElementById('player-answer-modal').classList.remove('active');
                this.showQuestionForPlayers(data);
                break;
                
            case 'answer-result':
                document.getElementById('player-answer-modal').classList.remove('active');
                this.showAnswerForPlayers(data);
                break;
                
            case 'jump-notification':
                this.showJumpNotification(data);
                break;
                
            case 'timer-jump':
                this.handleTimerJump(data);
                break;
                
            case 'timer-timeout-all':
                this.handleTimerTimeoutAll(data);
                break;
                
            case 'timer-update':
                this.updatePlayerTimer(data.seconds, data.isWarning);
                break;
                
            case 'timer-stopped':
                const playerTimerEl = document.getElementById('player-modal-timer');
                if (playerTimerEl) {
                    playerTimerEl.style.display = 'none';
                }
                break;
                
            case 'clear-player-selections':
                this.clearPlayerSelections();
                break;
                
            case 'question-assigned':
                this.handleQuestionAssigned(data);
                break;
                
            case 'pista-revelada':
                this.handlePistaRevelada(data);
                break;
                
            case 'close-modal':
                document.getElementById('question-modal').classList.remove('active');
                document.getElementById('player-answer-modal').classList.remove('active');
                break;
                
            case 'player-turn':
                document.getElementById('player-answer-modal').classList.remove('active');
                
                if (this.textualMode && !this.isHost) {
                    const myIndex = this.players.findIndex(p => p.name === this.playerName);
                    if (myIndex === this.currentPlayer && data.questionType) {
                        setTimeout(() => {
                            this.showPlayerAnswerModal({
                                category: data.category || '',
                                points: data.points || 0,
                                question: data.question || '',
                                type: data.questionType,
                                options: data.questionOptions,
                                anagramLetters: data.questionAnagram,
                                correctAnswer: data.correctAnswer,
                                pistas: data.pistas || [],
                                pistasReveladas: data.pistasReveladas || 0,
                                valorPregunta: data.valorPregunta || 1
                            });
                        }, 300);
                    }
                }
                break;
                
            case 'game-end':
                this.players = data.players;
                this.gameStarted = false;
                document.getElementById('question-modal').classList.remove('active');
                document.getElementById('player-answer-modal').classList.remove('active');
                this.stopGameMusic();
                this.showResults();
                this.playSound('win');
                break;
                
            case 'kicked':
                this.disconnect();
                break;
        }
    } else {
        if (data.type === 'join-request') {
            this.handleJoinRequest(conn, data);
        } else if (data.type === 'leave-request') {
            this.handleLeaveRequest(conn, data);
        } else if (data.type === 'player-select-question') {
            this.handlePlayerSelectQuestion(conn, data);
        } else if (data.type === 'revelar-pista') {
            this.handleRevelarPista(conn, data);
        } else if (data.type === 'player-answer') {
            if (this.timerEnabled) {
                this.stopTimer();
                this.broadcast({
                    type: 'timer-stopped'
                });
            }
            
            this.playerAnswer = data.answer;
            document.getElementById('player-answer-section').classList.remove('hidden');
            document.getElementById('player-answer-text').textContent = '"' + data.answer + '"';
            
            if (data.isCorrect !== undefined) {
                document.getElementById('answer-buttons').style.display = 'flex';
                this.handleAnswer(data.isCorrect);
            } else {
                document.getElementById('answer-buttons').style.display = 'flex';
            }
        }
    }
}

    handleJoinRequest(conn, data) {
    const name = data.name?.trim();
    const emoji = data.emoji || '';
    
    if (!name) return;
    
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F1E0}-\u{1F1FF}]/gu;
    if (emojiRegex.test(name)) {
        conn.send({ type: 'error', message: 'El nombre no puede contener emojis' });
        return;
    }
    
    if (name.length > 12) {
        conn.send({ type: 'error', message: 'El nombre no puede tener más de 12 caracteres' });
        return;
    }
    
    // [NUEVO] Generar nombre único si está duplicado
    let finalName = name;
    if (this.joinedNames.has(name)) {
        let counter = 1;
        let newName = `${name} ${counter}`;
        while (this.joinedNames.has(newName)) {
            counter++;
            newName = `${name} ${counter}`;
        }
        finalName = newName;
        // Notificar al jugador que su nombre fue modificado
        conn.send({ 
            type: 'name-changed', 
            originalName: name,
            newName: finalName 
        });
        this.showToast(`⚠️ El nombre "${name}" ya estaba en uso. Has sido renombrado a "${finalName}"`);
    }
    
    if (this.gameStarted) {
        conn.send({ type: 'error', message: 'Juego en curso' });
        return;
    }
    
    this.players.push({ name: finalName, score: 0, id: conn.peer, isHost: false, emoji });
    this.joinedNames.add(finalName);
    conn.metadata = { name: finalName, emoji };
    conn.send({ type: 'join-accepted', players: this.players });
    this.broadcastPlayers();
    this.updateLobby();
    this.saveState();
    this.playSound('join');
}

    handleLeaveRequest(conn, data) {
        const name = conn.metadata?.name;
        if (name) { this.players = this.players.filter(p => p.name !== name); this.joinedNames.delete(name); this.broadcastPlayers(); this.updateLobby(); this.saveState(); }
    }

    // ==================== MODO TEXTUAL ====================
    
    handlePlayerSelectQuestion(conn, data) {
    if (!this.isHost || !this.textualMode || !this.gameStarted) return;
    const playerName = conn.metadata?.name;
    const playerIndex = this.players.findIndex(p => p.name === playerName);
    if (playerIndex !== this.currentPlayer) return;
    
    // Buscar la pregunta por ID
    const q = this.questions.find(q => q.id === data.questionId && !q.used);
    if (!q) return;
    
    console.log('Jugador seleccionó:', q.category, q.points, 'ID:', q.id);
    
    // [CORREGIDO] Guardar la pregunta seleccionada globalmente
    this.selectedQuestionId = q.id;
    this.selectedQuestionData = q;
    
    // [CORREGIDO] Limpiar selecciones anteriores en TODOS los clientes
    this.broadcast({ type: 'clear-player-selections' });
    
    // [CORREGIDO] Notificar a TODOS qué pregunta fue seleccionada
    this.broadcast({ 
        type: 'question-assigned', 
        questionId: q.id, 
        category: q.category, 
        points: q.points,
        playerName: playerName 
    });
    
    // [CORREGIDO] Destacar la celda en el tablero del host (Y EN TODOS)
    this.highlightCell(q);
    
    // [NUEVO] Forzar actualización del tablero del host
    this.renderBoard();
}
    
    highlightCell(q) {
    // [CORREGIDO] Buscar la celda correcta por categoría y puntos
    const board = document.getElementById('game-board');
    if (!board) return;
    
    // Limpiar selecciones anteriores
    board.querySelectorAll('.game-cell.player-selected').forEach(el => {
        el.classList.remove('player-selected');
        el.style.border = '';
        el.style.boxShadow = '';
        el.style.transform = '';
        el.style.background = '';
        el.style.color = '';
        el.style.fontWeight = '';
        el.style.zIndex = '';
        el.style.position = '';
        // Remover indicador
        const indicator = el.querySelector('.selection-indicator');
        if (indicator) indicator.remove();
    });
    
    // Buscar la celda correcta
    const cells = board.querySelectorAll('.game-cell.clickable');
    let foundCell = null;
    
    cells.forEach(cell => {
        const cellCategory = cell.dataset.category;
        const cellPoints = parseInt(cell.dataset.points);
        if (cellCategory === q.category && cellPoints === q.points) {
            foundCell = cell;
        }
    });
    
    if (foundCell) {
        // [CORREGIDO] Hacer la selección MUCHO más visible para HOST también
        foundCell.classList.add('player-selected');
        foundCell.style.border = '4px solid #f59e0b';
        foundCell.style.boxShadow = '0 0 30px rgba(245, 158, 11, 0.8), inset 0 0 20px rgba(245, 158, 11, 0.3)';
        foundCell.style.transform = 'scale(1.1)';
        foundCell.style.zIndex = '10';
        foundCell.style.position = 'relative';
        foundCell.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        foundCell.style.color = 'white';
        foundCell.style.fontWeight = 'bold';
        foundCell.style.fontSize = '1.1rem';
        
        // Agregar un indicador visual adicional
        const indicator = document.createElement('div');
        indicator.className = 'selection-indicator';
        indicator.textContent = '👆';
        indicator.style.position = 'absolute';
        indicator.style.top = '-12px';
        indicator.style.right = '-12px';
        indicator.style.fontSize = '1.2rem';
        indicator.style.background = 'white';
        indicator.style.borderRadius = '50%';
        indicator.style.padding = '2px';
        indicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        indicator.style.zIndex = '20';
        
        // Remover indicador anterior si existe
        const oldIndicator = foundCell.querySelector('.selection-indicator');
        if (oldIndicator) oldIndicator.remove();
        foundCell.appendChild(indicator);
        
        // [NUEVO] Hacer la celda más grande temporalmente
        foundCell.style.animation = 'selectedPulse 0.8s ease-in-out infinite';
        
        this.showToast('🎯 ' + q.category + ' - ' + q.points + 'pts seleccionada por ' + this.players[this.currentPlayer]?.name);
    } else {
        console.log('No se encontró la celda para:', q.category, q.points);
    }
}
    
    handlePlayerAnswer(conn, data) {
        if (!this.isHost || !this.textualMode || !this.currentQuestion) return;
        const playerName = conn.metadata?.name;
        const playerIndex = this.players.findIndex(p => p.name === playerName);
        if (playerIndex !== this.currentPlayer) return;
        
        this.playerAnswer = data.answer;
        
        // Mostrar respuesta en el modal del host
        document.getElementById('player-answer-section').classList.remove('hidden');
        document.getElementById('player-answer-text').textContent = '"' + data.answer + '"';
        document.getElementById('answer-buttons').style.display = 'flex';
        
        this.broadcast({ type: 'answer-result', correct: null, answer: this.currentQuestion.answer, playerAnswer: data.answer, playerName: this.players[this.currentPlayer].name, playerEmoji: this.players[this.currentPlayer].emoji, awaitingHost: true });
        this.playSound('send');
    }
    
    handlePlayerTurn(data) {
        // El jugador recibe su turno
        if (data.currentPlayer !== undefined) this.currentPlayer = data.currentPlayer;
        this.renderBoard();
        // Mostrar indicador de que es su turno
        this.showToast('🎯 ¡Es tu turno! Elige una pregunta del tablero');
    }
    
    sendPlayerAnswer() {
    if (this.isHost || !this.textualMode) return;
    const input = document.getElementById('player-answer-input');
    if (!input || !input.value.trim()) return alert('Escribe tu respuesta');
    
    const answer = input.value.trim();
    if (this.connections.length > 0) {
        this.connections[0].send({ type: 'player-answer', answer });
    }
    
    document.getElementById('player-answer-status').classList.remove('hidden');
    document.getElementById('player-answer-status').textContent = '✅ Respuesta enviada. Esperando veredicto del host...';
    document.getElementById('btn-send-answer').disabled = true;
    input.disabled = true;
    this.playSound('send');
}

    leaveLobby() {
        if (this.isHost) return;
        if (this.connections.length > 0) this.connections[0].send({ type: 'leave-request' });
        sessionStorage.removeItem('jeopardy-player-code'); sessionStorage.removeItem('jeopardy-player-name'); sessionStorage.removeItem('jeopardy-player-emoji');
        this.disconnect();
    }

    kickPlayer(playerIndex) {
        if (!this.isHost) return;
        const player = this.players[playerIndex]; if (!player || player.isHost) return;
        const conn = this.connections.find(c => c.metadata?.name === player.name);
        if (conn && conn.open) conn.send({ type: 'kicked' });
        this.players.splice(playerIndex, 1); this.joinedNames.delete(player.name);
        this.connections = this.connections.filter(c => c.metadata?.name !== player.name);
        this.broadcastPlayers(); this.updateLobby(); this.saveState(); this.playSound('kick');
        this.showToast((player.emoji || '') + ' ' + player.name + ' expulsado');
    }

    broadcast(data) { this.connections.forEach(c => { if (c.open) { try { c.send(data); } catch(e) {} } }); }
    broadcastPlayers() { this.broadcast({ type: 'players-update', players: this.players }); }

    loadGameState(data) {
    this.categories = data.categories || [];
    this.questions = data.questions || [];
    this.players = data.players || [];
    this.totalCategories = data.totalCategories || 0;
    this.questionsPerCategory = data.questionsPerCategory || 0;
    this.currentPlayer = data.currentPlayer || 0;
    this.gameStarted = true;
    this.jumpEnabled = data.jumpEnabled || false;
    this.hardMode = data.hardMode || false;
    this.textualMode = data.textualMode || false;
    this.timerEnabled = data.timerEnabled || false;
    
    // [NUEVO] Cargar tiempos
    this.timerTextSeconds = data.timerTextSeconds || 25;
    this.timerOptionsSeconds = data.timerOptionsSeconds || 15;
    this.timerAnagramSeconds = data.timerAnagramSeconds || 20;
}

    applyGameUpdate(data) {
        if (data.questionId !== undefined) { const q = this.questions.find(q => q.id === data.questionId); if (q) q.used = true; }
        if (data.players) this.players = data.players;
        if (data.currentPlayer !== undefined) this.currentPlayer = data.currentPlayer;
        this.renderBoard(); this.updateManualPointsPanel();
    }

    createBoard() {
        if (!this.isHost) return;
        this.totalCategories = parseInt(document.getElementById('categories').value);
        this.questionsPerCategory = parseInt(document.getElementById('questions').value);
        if (this.totalCategories < 2 || this.totalCategories > 8 || this.questionsPerCategory < 1 || this.questionsPerCategory > 10) return alert('2-8 categorías, 1-10 preguntas');
        this.showCategoriesScreen(); this.saveState();
    }

    showCategoriesScreen() {
    if (!this.isHost) return;
    const container = document.getElementById('category-inputs');
    container.innerHTML = '';
    
    // Mostrar opción para cambiar número de categorías
    const controls = document.createElement('div');
    controls.className = 'category-controls';
    controls.style.cssText = 'display:flex;gap:12px;align-items:center;margin-bottom:20px;flex-wrap:wrap;padding:12px 16px;background:#f8fafc;border-radius:8px;border:1px solid var(--border);';
    controls.innerHTML = `
        <label style="font-size:0.85rem;color:var(--text-secondary);font-weight:500;">Categorías:</label>
        <input type="number" id="edit-categories-count" min="2" max="8" value="${this.totalCategories}" style="width:65px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;text-align:center;font-size:0.95rem;">
        <button id="apply-categories-count" class="btn btn-sm btn-primary" style="padding:6px 16px;font-size:0.85rem;">Aplicar</button>
        <span style="font-size:0.8rem;color:var(--text-secondary);margin-left:4px;">Cambiar número de categorías (2-8)</span>
    `;
    container.appendChild(controls);
    
    // Inputs para categorías
    const inputsContainer = document.createElement('div');
    inputsContainer.id = 'category-inputs-container';
    inputsContainer.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;';
    container.appendChild(inputsContainer);
    
    this.renderCategoryInputs(inputsContainer);
    
    // Evento para cambiar número de categorías
    document.getElementById('apply-categories-count').addEventListener('click', () => {
        const newCount = parseInt(document.getElementById('edit-categories-count').value);
        if (newCount < 2 || newCount > 8) {
            alert('El número de categorías debe ser entre 2 y 8');
            return;
        }
        this.totalCategories = newCount;
        // Ajustar categorías existentes
        while (this.categories.length < newCount) {
            this.categories.push(`Categoría ${this.categories.length + 1}`);
        }
        this.categories = this.categories.slice(0, newCount);
        // Re-renderizar
        this.renderCategoryInputs(inputsContainer);
        this.saveState();
    });
    
    this.showScreen('categories-screen');
}

renderCategoryInputs(container) {
    container.innerHTML = '';
    for (let i = 0; i < this.totalCategories; i++) {
        const div = document.createElement('div');
        div.className = 'category-input';
        div.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
        div.innerHTML = `
            <label style="font-size:0.85rem;color:var(--text-secondary);font-weight:500;">Categoría ${i + 1}</label>
            <input type="text" class="category-name" placeholder="Ej: Ciencia" value="${this.categories[i] || ''}" style="padding:10px 14px;border:1px solid var(--border);border-radius:8px;font-size:0.95rem;font-family:inherit;">
        `;
        container.appendChild(div);
    }
}

renderCategoryInputs(container) {
    container.innerHTML = '';
    for (let i = 0; i < this.totalCategories; i++) {
        const div = document.createElement('div');
        div.className = 'category-input';
        div.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
        div.innerHTML = `
            <label style="font-size:0.85rem;color:var(--text-secondary);font-weight:500;">Categoría ${i + 1}</label>
            <input type="text" class="category-name" placeholder="Ej: Ciencia" value="${this.categories[i] || ''}" style="padding:10px 14px;border:1px solid var(--border);border-radius:8px;font-size:0.95rem;font-family:inherit;">
        `;
        container.appendChild(div);
    }
}

renderCategoryInputs(container) {
    container.innerHTML = '';
    for (let i = 0; i < this.totalCategories; i++) {
        const div = document.createElement('div');
        div.className = 'category-input';
        div.innerHTML = `
            <label>Categoría ${i + 1}</label>
            <input type="text" class="category-name" placeholder="Ej: Ciencia" value="${this.categories[i] || ''}">
        `;
        container.appendChild(div);
    }
}

    submitCategories() {
    if (!this.isHost) return;
    const inputs = document.querySelectorAll('.category-name');
    this.categories = [];
    let valid = true;
    inputs.forEach((input, i) => {
        const name = input.value.trim();
        if (!name) {
            alert(`Nombre para Categoría ${i + 1}`);
            valid = false;
        }
        this.categories.push(name);
    });
    if (valid) {
        // Si venimos de edición, volver al lobby
        if (this.editMode === 'categories') {
            this.editMode = null;
            this.showLobby();
            this.saveState();
            this.showToast('✅ Categorías actualizadas');
        } else {
            this.showQuestionsScreen();
            this.saveState();
        }
    }
}

renderQuestionsList(container) {
    container.innerHTML = '';
    const existingQuestions = [...this.questions];
    this.questions = [];
    let id = 0;
    
    this.categories.forEach(cat => {
        for (let i = 0; i < this.questionsPerCategory; i++) {
            const points = (i + 1) * 100;
            const existing = existingQuestions.find(q => q.category === cat && q.points === points);
            const q = existing || {
                id,
                category: cat,
                points: points,
                question: '',
                answer: '',
                used: false,
                type: 'text',
                options: ['', ''],
                pistas: ['', '', '']
            };
            q.id = id;
            
            if (!q.options || !Array.isArray(q.options)) {
                q.options = ['', ''];
            }
            while (q.options.length < 2) q.options.push('');
            if (q.options.length > 4) q.options = q.options.slice(0, 4);
            
            if (!q.pistas || !Array.isArray(q.pistas)) {
                q.pistas = ['', '', ''];
            }
            while (q.pistas.length < 3) q.pistas.push('');
            if (q.pistas.length > 3) q.pistas = q.pistas.slice(0, 3);
            
            this.questions.push(q);
            
            const div = document.createElement('div');
            div.className = 'question-row';
            div.setAttribute('data-qid', id);
            
            const isAnagram = q.type === 'anagram';
            const isOptions = q.type === 'options';
            const isWhoami = q.type === 'whoami';
            const isTruefalse = q.type === 'truefalse';
            
            div.innerHTML = `
                <h3>${cat} — ${q.points} pts</h3>
                <div class="question-type-selector">
                    <select class="q-type" data-id="${id}">
                        <option value="text" ${q.type === 'text' ? 'selected' : ''}>📝 Texto</option>
                        <option value="options" ${q.type === 'options' ? 'selected' : ''}>🔤 Opción múltiple</option>
                        <option value="anagram" ${q.type === 'anagram' ? 'selected' : ''}>🔀 Anagrama</option>
                        <option value="whoami" ${q.type === 'whoami' ? 'selected' : ''}>🕵️ ¿Quién soy?</option>
                        <option value="truefalse" ${q.type === 'truefalse' ? 'selected' : ''}>✅ Verdadero/Falso</option>
                    </select>
                </div>
                <div class="question-inputs">
                    <textarea class="q-input" placeholder="${isWhoami ? 'Escribe la descripción o contexto' : isTruefalse ? 'Escribe la afirmación' : 'Escribe la pregunta aquí'}" data-id="${id}" style="${isAnagram ? 'display:none;' : ''}">${q.question || ''}</textarea>
                    <textarea class="a-input" placeholder="${isWhoami ? 'Respuesta correcta (nombre/personaje)' : isTruefalse ? 'Respuesta (verdadero/falso)' : isAnagram ? 'Palabra para anagrama' : isOptions ? 'Respuesta correcta (primera opción)' : 'Escribe la respuesta correcta'}" data-id="${id}" style="${isOptions ? 'display:none;' : ''}">${q.answer || ''}</textarea>
                </div>
                <div class="options-container" data-id="${id}" style="${isOptions ? '' : 'display:none;'}">
                    <div class="options-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <p class="hint options-count" style="margin:0;">Opciones (${q.options.length}) - La primera es la correcta</p>
                        <div class="options-btns" style="display:flex;gap:4px;">
                            ${q.options.length > 2 ? `<button type="button" class="btn btn-xs btn-danger remove-opt-btn" data-qid="${id}">−</button>` : ''}
                            ${q.options.length < 4 ? `<button type="button" class="btn btn-xs btn-success add-opt-btn" data-qid="${id}">+</button>` : ''}
                        </div>
                    </div>
                    <div class="options-list" data-id="${id}">
                        ${(q.options || []).map((opt, oi) => `
                            <div class="options-input-row">
                                <span style="font-weight:600;width:20px;color:${oi === 0 ? 'var(--success)' : 'var(--text-secondary)'};">${String.fromCharCode(65 + oi)})</span>
                                <input type="text" class="opt-input" placeholder="Opción ${oi + 1}${oi === 0 ? ' (correcta)' : ''}" value="${opt || ''}" data-qid="${id}" data-oidx="${oi}">
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="whoami-container" data-id="${id}" style="${isWhoami ? '' : 'display:none;'}">
                    <div class="pistas-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <p class="hint" style="margin:0;">🕵️ Pistas (3) - El jugador puede revelarlas</p>
                    </div>
                    <div class="pistas-list">
                        ${(q.pistas || []).map((pista, pi) => `
                            <div class="pista-input-row">
                                <span style="font-weight:600;width:30px;color:var(--text-secondary);">Pista ${pi + 1}:</span>
                                <input type="text" class="pista-input" placeholder="Escribe la pista ${pi + 1}" value="${pista || ''}" data-qid="${id}" data-pidx="${pi}">
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            container.appendChild(div);
            
            setTimeout(() => {
                const typeSelect = div.querySelector('.q-type');
                const optionsContainer = div.querySelector('.options-container');
                const whoamiContainer = div.querySelector('.whoami-container');
                const qInput = div.querySelector('.q-input');
                const aInput = div.querySelector('.a-input');
                
                if (typeSelect) {
                    typeSelect.addEventListener('change', () => {
                        const qObj = this.questions.find(q => q.id === id);
                        if (qObj) qObj.type = typeSelect.value;
                        
                        const isAnagramNow = typeSelect.value === 'anagram';
                        const isOptionsNow = typeSelect.value === 'options';
                        const isWhoamiNow = typeSelect.value === 'whoami';
                        const isTruefalseNow = typeSelect.value === 'truefalse';
                        
                        if (qInput) {
                            qInput.style.display = isAnagramNow ? 'none' : '';
                            qInput.placeholder = isWhoamiNow ? 'Escribe la descripción o contexto' : 
                                                  isTruefalseNow ? 'Escribe la afirmación' : 
                                                  'Escribe la pregunta aquí';
                        }
                        if (aInput) {
                            aInput.style.display = isOptionsNow ? 'none' : '';
                            aInput.placeholder = isWhoamiNow ? 'Respuesta correcta (nombre/personaje)' :
                                                  isTruefalseNow ? 'Respuesta (verdadero/falso)' :
                                                  isAnagramNow ? 'Palabra para anagrama' : 
                                                  'Escribe la respuesta correcta';
                        }
                        if (optionsContainer) {
                            optionsContainer.style.display = isOptionsNow ? '' : 'none';
                        }
                        if (whoamiContainer) {
                            whoamiContainer.style.display = isWhoamiNow ? '' : 'none';
                        }
                        
                        if (isOptionsNow && qObj) {
                            if (!qObj.options || qObj.options.length < 2) {
                                qObj.options = ['', ''];
                            }
                            this.refreshOptionsList(div, id);
                        }
                        
                        this.playSound('click');
                    });
                }
                
                div.querySelectorAll('.add-opt-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const qId2 = parseInt(btn.dataset.qid);
                        const qObj = this.questions.find(q => q.id === qId2);
                        if (qObj && qObj.options && qObj.options.length < 4) {
                            qObj.options.push('');
                            this.refreshOptionsList(div, qId2);
                            this.playSound('click');
                        }
                    });
                });
                
                div.querySelectorAll('.remove-opt-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const qId2 = parseInt(btn.dataset.qid);
                        const qObj = this.questions.find(q => q.id === qId2);
                        if (qObj && qObj.options && qObj.options.length > 2) {
                            qObj.options.pop();
                            this.refreshOptionsList(div, qId2);
                            this.playSound('click');
                        }
                    });
                });
                
                div.querySelectorAll('.opt-input').forEach(input => {
                    input.addEventListener('input', () => {
                        const qId2 = parseInt(input.dataset.qid);
                        const oIdx = parseInt(input.dataset.oidx);
                        const qObj = this.questions.find(q => q.id === qId2);
                        if (qObj && qObj.options) {
                            qObj.options[oIdx] = input.value.trim();
                        }
                    });
                });
                
                div.querySelectorAll('.pista-input').forEach(input => {
                    input.addEventListener('input', () => {
                        const qId2 = parseInt(input.dataset.qid);
                        const pIdx = parseInt(input.dataset.pidx);
                        const qObj = this.questions.find(q => q.id === qId2);
                        if (qObj && qObj.pistas) {
                            qObj.pistas[pIdx] = input.value.trim();
                        }
                    });
                });
                
            }, 0);
            id++;
        }
    });
}

    showQuestionsScreen() {
    if (!this.isHost) return;
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    
    const controls = document.createElement('div');
    controls.className = 'questions-controls';
    controls.style.cssText = 'display:flex;flex-direction:column;gap:12px;margin-bottom:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid var(--border);';
    
    const categoryNamesRow = document.createElement('div');
    categoryNamesRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;';
    categoryNamesRow.innerHTML = `
        <label style="font-size:0.85rem;color:var(--text-secondary);font-weight:500;min-width:100px;">Nombres de categorías:</label>
        <div id="category-names-edit" style="display:flex;flex-wrap:wrap;gap:6px;flex:1;">
            ${this.categories.map((cat, idx) => `
                <input type="text" class="category-name-edit" data-idx="${idx}" value="${cat}" placeholder="Categoría ${idx + 1}" style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:0.85rem;width:120px;flex:1;min-width:80px;">
            `).join('')}
        </div>
        <button id="apply-category-names" class="btn btn-sm btn-primary" style="padding:4px 12px;font-size:0.8rem;">Actualizar nombres</button>
    `;
    controls.appendChild(categoryNamesRow);
    
    const settingsRow = document.createElement('div');
    settingsRow.style.cssText = 'display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--border);';
    settingsRow.innerHTML = `
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <label style="font-size:0.85rem;color:var(--text-secondary);font-weight:500;">Categorías:</label>
            <input type="number" id="edit-categories-count-2" min="2" max="10" value="${this.totalCategories}" style="width:55px;padding:4px 8px;border:1px solid var(--border);border-radius:4px;text-align:center;font-size:0.9rem;">
            <button id="apply-categories-count-2" class="btn btn-sm btn-primary" style="padding:4px 10px;font-size:0.75rem;">Aplicar</button>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <label style="font-size:0.85rem;color:var(--text-secondary);font-weight:500;">Preguntas por categoría:</label>
            <input type="number" id="edit-questions-count" min="1" max="10" value="${this.questionsPerCategory}" style="width:55px;padding:4px 8px;border:1px solid var(--border);border-radius:4px;text-align:center;font-size:0.9rem;">
            <button id="apply-questions-count" class="btn btn-sm btn-primary" style="padding:4px 10px;font-size:0.75rem;">Aplicar</button>
        </div>
        <span style="font-size:0.7rem;color:var(--text-secondary);">Categorías (2-10) | Preguntas (1-10)</span>
    `;
    controls.appendChild(settingsRow);
    
    container.appendChild(controls);
    
    const questionsContainer = document.createElement('div');
    questionsContainer.id = 'questions-list-container';
    container.appendChild(questionsContainer);
    
    this.renderQuestionsList(questionsContainer);
    
    document.getElementById('apply-category-names').addEventListener('click', () => {
        const inputs = document.querySelectorAll('.category-name-edit');
        const newNames = [];
        inputs.forEach(input => {
            const name = input.value.trim();
            if (name) {
                newNames.push(name);
            } else {
                newNames.push(`Categoría ${parseInt(input.dataset.idx) + 1}`);
            }
        });
        this.categories = newNames;
        this.rebuildQuestions();
        this.renderQuestionsList(questionsContainer);
        this.saveState();
        this.showToast('✅ Nombres de categorías actualizados');
    });
    
    document.getElementById('apply-categories-count-2').addEventListener('click', () => {
        const newCount = parseInt(document.getElementById('edit-categories-count-2').value);
        if (newCount < 2 || newCount > 10) {
            alert('El número de categorías debe ser entre 2 y 10');
            return;
        }
        this.totalCategories = newCount;
        while (this.categories.length < newCount) {
            this.categories.push(`Categoría ${this.categories.length + 1}`);
        }
        this.categories = this.categories.slice(0, newCount);
        this.rebuildQuestions();
        this.renderQuestionsList(questionsContainer);
        const namesContainer = document.getElementById('category-names-edit');
        if (namesContainer) {
            namesContainer.innerHTML = this.categories.map((cat, idx) => `
                <input type="text" class="category-name-edit" data-idx="${idx}" value="${cat}" placeholder="Categoría ${idx + 1}" style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:0.85rem;width:120px;flex:1;min-width:80px;">
            `).join('');
        }
        document.getElementById('edit-categories-count-2').value = this.totalCategories;
        this.saveState();
        this.showToast('✅ Número de categorías actualizado');
    });
    
    document.getElementById('apply-questions-count').addEventListener('click', () => {
        const newCount = parseInt(document.getElementById('edit-questions-count').value);
        if (newCount < 1 || newCount > 10) {
            alert('El número de preguntas debe ser entre 1 y 10');
            return;
        }
        this.questionsPerCategory = newCount;
        this.rebuildQuestions();
        this.renderQuestionsList(questionsContainer);
        this.saveState();
        this.showToast('✅ Número de preguntas actualizado');
    });
    
    this.showScreen('questions-screen');
}

    refreshOptionsList(div, qId) {
    const q = this.questions.find(q => q.id === qId);
    if (!q) return;
    
    if (!q.options || !Array.isArray(q.options)) {
        q.options = ['', ''];
    }
    while (q.options.length < 2) q.options.push('');
    if (q.options.length > 4) q.options = q.options.slice(0, 4);
    
    const list = div.querySelector('.options-list');
    if (list) {
        list.innerHTML = q.options.map((opt, oi) => `
            <div class="options-input-row">
                <span style="font-weight:600;width:20px;color:${oi === 0 ? 'var(--success)' : 'var(--text-secondary)'};">${String.fromCharCode(65 + oi)})</span>
                <input type="text" class="opt-input" placeholder="Opción ${oi + 1}${oi === 0 ? ' (correcta)' : ''}" value="${opt || ''}" data-qid="${qId}" data-oidx="${oi}">
            </div>
        `).join('');
        
        list.querySelectorAll('.opt-input').forEach(input => {
            input.addEventListener('input', () => {
                const qId2 = parseInt(input.dataset.qid);
                const oIdx = parseInt(input.dataset.oidx);
                const qObj = this.questions.find(q => q.id === qId2);
                if (qObj && qObj.options) qObj.options[oIdx] = input.value.trim();
            });
        });
    }
    
    const countEl = div.querySelector('.options-count');
    if (countEl) countEl.textContent = `Opciones (${q.options.length}) - La primera es la correcta`;
    
    const btnsContainer = div.querySelector('.options-btns');
    if (btnsContainer) {
        btnsContainer.innerHTML = `
            ${q.options.length > 2 ? `<button type="button" class="btn btn-xs btn-danger remove-opt-btn" data-qid="${qId}">−</button>` : ''}
            ${q.options.length < 4 ? `<button type="button" class="btn btn-xs btn-success add-opt-btn" data-qid="${qId}">+</button>` : ''}
        `;
        
        btnsContainer.querySelectorAll('.add-opt-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                if (q.options && q.options.length < 4) {
                    q.options.push('');
                    this.refreshOptionsList(div, qId);
                    this.playSound('click');
                }
            });
        });
        
        btnsContainer.querySelectorAll('.remove-opt-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                if (q.options && q.options.length > 2) {
                    q.options.pop();
                    this.refreshOptionsList(div, qId);
                    this.playSound('click');
                }
            });
        });
    }
}

    submitQuestions() {
    if (!this.isHost) return;
    
    this.saveAllQuestionsFromDOM();
    
    let valid = true;
    for (const q of this.questions) {
        console.log('Submit - Validando:', q.id, q.type, 'q:', q.question, 'a:', q.answer, 'opts:', q.options, 'pistas:', q.pistas);
        
        if (q.type === 'anagram') {
            if (!q.answer || !q.answer.trim()) {
                alert(`Falta la palabra: ${q.category} ${q.points}pts`);
                valid = false;
                break;
            }
            if (!q.question) q.question = 'Ordena las letras para formar la palabra correcta';
        } else if (q.type === 'options') {
            if (!q.question || !q.question.trim()) {
                alert(`Falta la pregunta: ${q.category} ${q.points}pts`);
                valid = false;
                break;
            }
            const filled = (q.options || []).filter(o => o && o.trim());
            if (filled.length < 2) {
                alert(`Mínimo 2 opciones: ${q.category} ${q.points}pts (hay ${filled.length})`);
                valid = false;
                break;
            }
            q.answer = filled[0];
        } else if (q.type === 'whoami') {
            if (!q.question || !q.question.trim()) {
                alert(`Falta la descripción/contexto: ${q.category} ${q.points}pts`);
                valid = false;
                break;
            }
            if (!q.answer || !q.answer.trim()) {
                alert(`Falta la respuesta correcta: ${q.category} ${q.points}pts`);
                valid = false;
                break;
            }
            const pistasFilled = (q.pistas || []).filter(p => p && p.trim());
            if (pistasFilled.length < 3) {
                alert(`Faltan pistas (necesitas 3): ${q.category} ${q.points}pts (tienes ${pistasFilled.length})`);
                valid = false;
                break;
            }
        } else if (q.type === 'truefalse') {
            if (!q.question || !q.question.trim()) {
                alert(`Falta la afirmación: ${q.category} ${q.points}pts`);
                valid = false;
                break;
            }
            const answerLower = q.answer?.trim().toLowerCase();
            if (!q.answer || !q.answer.trim() || (answerLower !== 'verdadero' && answerLower !== 'falso' && answerLower !== 'true' && answerLower !== 'false')) {
                alert(`La respuesta debe ser "verdadero" o "falso": ${q.category} ${q.points}pts`);
                valid = false;
                break;
            }
            q.answer = answerLower === 'verdadero' || answerLower === 'true' ? 'Verdadero' : 'Falso';
        } else {
            if (!q.question || !q.question.trim()) {
                alert(`Falta la pregunta: ${q.category} ${q.points}pts`);
                valid = false;
                break;
            }
            if (!q.answer || !q.answer.trim()) {
                alert(`Falta la respuesta: ${q.category} ${q.points}pts`);
                valid = false;
                break;
            }
        }
    }
    
    if (valid) {
        console.log('Validación exitosa. Preguntas finales:', this.questions);
        
        if (this.editMode === 'questions') {
            this.editMode = null;
            this.showLobby();
            this.saveState();
            this.showToast('✅ Trivia actualizada correctamente');
        } else {
            this.showLobby();
            this.saveState();
        }
    }
}

    exportTrivia() {
    if (!this.isHost) return;
    
    this.saveAllQuestionsFromDOM();
    
    if (this.questions.length === 0) return alert('Primero crea las preguntas');
    
    for (const q of this.questions) {
        console.log('Export - Validando:', q.id, q.type, 'q:', q.question, 'a:', q.answer, 'opts:', q.options, 'pistas:', q.pistas);
        
        if (q.type === 'anagram') {
            if (!q.answer || !q.answer.trim()) {
                return alert(`Falta la palabra del anagrama: ${q.category} ${q.points}pts`);
            }
        } else if (q.type === 'options') {
            if (!q.question || !q.question.trim()) {
                return alert(`Falta la pregunta: ${q.category} ${q.points}pts`);
            }
            const filledOpts = (q.options || []).filter(o => o && o.trim());
            if (filledOpts.length < 2) {
                return alert(`Faltan opciones (mínimo 2): ${q.category} ${q.points}pts`);
            }
            q.answer = filledOpts[0];
        } else if (q.type === 'whoami') {
            if (!q.question || !q.question.trim()) {
                return alert(`Falta la descripción/contexto: ${q.category} ${q.points}pts`);
            }
            if (!q.answer || !q.answer.trim()) {
                return alert(`Falta la respuesta correcta: ${q.category} ${q.points}pts`);
            }
            const pistasFilled = (q.pistas || []).filter(p => p && p.trim());
            if (pistasFilled.length < 3) {
                return alert(`Faltan pistas (necesitas 3): ${q.category} ${q.points}pts`);
            }
        } else if (q.type === 'truefalse') {
            if (!q.question || !q.question.trim()) {
                return alert(`Falta la afirmación: ${q.category} ${q.points}pts`);
            }
            const answerLower = q.answer?.trim().toLowerCase();
            if (!q.answer || !q.answer.trim() || (answerLower !== 'verdadero' && answerLower !== 'falso' && answerLower !== 'true' && answerLower !== 'false')) {
                return alert(`La respuesta debe ser "verdadero" o "falso": ${q.category} ${q.points}pts`);
            }
            q.answer = answerLower === 'verdadero' || answerLower === 'true' ? 'Verdadero' : 'Falso';
        } else {
            if (!q.question || !q.question.trim()) {
                return alert(`Falta la pregunta: ${q.category} ${q.points}pts`);
            }
            if (!q.answer || !q.answer.trim()) {
                return alert(`Falta la respuesta: ${q.category} ${q.points}pts`);
            }
        }
    }
    
    const data = {
        v: 2,
        c: this.categories,
        qpc: this.questionsPerCategory,
        q: this.questions.map(q => ({
            cat: q.category,
            pts: q.points,
            q: q.question,
            a: q.answer,
            t: q.type || 'text',
            opts: (q.options || []).filter(o => o && o.trim()),
            pistas: (q.pistas || []).filter(p => p && p.trim())
        }))
    };
    
    const jsonStr = JSON.stringify(data);
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
    const code = 'JPTV' + base64;
    
    this.copyToClipboard(code);
    this.showToast('✅ ¡Código copiado!');
}

    importTrivia() {
    const codeInput = document.getElementById('trivia-code-input'); 
    const code = codeInput.value.trim();
    if (!code) return alert('Pega el código'); 
    if (!code.startsWith('JPTV')) return alert('Código inválido');
    try {
        const jsonStr = decodeURIComponent(escape(atob(code.substring(4)))); 
        const data = JSON.parse(jsonStr);
        const categories = data.c || data.categories; 
        const qpc = data.qpc || data.questionsPerCategory;
        const questions = data.q.map(q => ({ 
            category: q.cat || q.category, 
            points: q.pts || q.points, 
            question: q.q || q.question, 
            answer: q.a || q.answer, 
            type: q.t || 'text', 
            options: q.opts || q.options || [],
            pistas: q.pistas || []
        }));
        this.clearState(); 
        this.isHost = true; 
        this.categories = categories; 
        this.totalCategories = categories.length; 
        this.questionsPerCategory = qpc;
        this.questions = questions.map((q, i) => ({ 
            id: i, 
            ...q, 
            used: false,
            pistas: q.pistas || ['', '', '']
        }));
        this.roomCode = this.generateRoomCode(); 
        this.players = [{ name: 'Host', score: 0, id: 'host', isHost: true, emoji: '👑' }];
        this.joinedNames = new Set(['Host']); 
        this.gameStarted = false;
        document.getElementById('load-trivia-form').classList.add('hidden'); 
        codeInput.value = '';
        this.initPeer(this.roomCode + '-host'); 
        this.showLobby(); 
        this.saveState();
        this.showToast('✅ Trivia cargada! ' + this.totalCategories + ' categorías');
    } catch (e) { alert('Error al cargar.'); }
}

    copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).catch(() => this.fallbackCopy(text));
        else this.fallbackCopy(text);
    }

    fallbackCopy(text) {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch(e) {} document.body.removeChild(ta);
    }

    showToast(msg) {
        const ex = document.querySelector('.export-toast'); if (ex) ex.remove();
        const t = document.createElement('div'); t.className = 'export-toast'; t.textContent = msg;
        document.body.appendChild(t); setTimeout(() => { if (t.parentNode) t.remove(); }, 3000);
    }

    showLobby() {
        document.getElementById('room-code-display').textContent = this.roomCode;
        setTimeout(() => this.generateQR(), 300); this.updateLobby(); this.showScreen('lobby-screen');
        document.getElementById('lobby-status').textContent = this.isHost ? '' : '⏳ Esperando al host...';
        this.saveState();
    }

    generateQR() {
        const container = document.getElementById('qrcode'); if (!container) return; container.innerHTML = '';
        const url = window.location.origin + window.location.pathname + '?room=' + this.roomCode;
        try { if (typeof QRCode !== 'undefined') new QRCode(container, { text: url, width: 150, height: 150, colorDark: '#1e293b', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); } catch(e) { container.innerHTML = '<p>' + url + '</p>'; }
    }

    updateLobby() {
    const container = document.getElementById('lobby-players-list');
    if (!container) return;
    container.innerHTML = '';
    this.players.forEach((p, i) => {
        const tag = document.createElement('div');
        tag.className = 'player-tag' + (p.isHost ? ' host' : '');
        tag.innerHTML = (p.emoji ? p.emoji + ' ' : '') + p.name;
        
        // [NUEVO] Easter egg para "ABY"
        if (p.name === 'ABY' || p.name === 'Aby' || p.name === 'aby') {
            tag.classList.add('aby-easter-egg');
            tag.style.animation = 'abyColorShift 2s ease-in-out infinite';
            tag.style.border = '2px solid #FFD700';
            tag.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.3)';
            
            // Crear partículas doradas
            this.createAbyParticles(tag, p.emoji);
        }
        
        if (this.isHost && !p.isHost) {
            const kickBtn = document.createElement('button');
            kickBtn.className = 'kick-btn';
            kickBtn.innerHTML = '×';
            kickBtn.title = 'Expulsar';
            kickBtn.addEventListener('click', (e) => { e.stopPropagation(); this.kickPlayer(i); });
            tag.appendChild(kickBtn);
        }
        container.appendChild(tag);
    });
}

// [NUEVO] Crear partículas para el easter egg ABY
createAbyParticles(element, emoji) {
    const particleInterval = setInterval(() => {
        if (!document.body.contains(element)) {
            clearInterval(particleInterval);
            return;
        }
        
        const rect = element.getBoundingClientRect();
        const particle = document.createElement('div');
        particle.className = 'aby-particle';
        
        const isEmoji = Math.random() < 0.15 && emoji;
        particle.textContent = isEmoji ? emoji : '✦';
        
        const size = isEmoji ? 16 + Math.random() * 12 : 8 + Math.random() * 8;
        particle.style.cssText = `
            position: fixed;
            left: ${rect.left + Math.random() * rect.width}px;
            top: ${rect.top + Math.random() * rect.height}px;
            font-size: ${size}px;
            color: ${isEmoji ? '#FFD700' : '#FFD700'};
            pointer-events: none;
            z-index: 999;
            opacity: 1;
            transition: all ${1 + Math.random() * 1.5}s ease-out;
            text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
        `;
        
        document.body.appendChild(particle);
        
        requestAnimationFrame(() => {
            const angle = Math.random() * Math.PI * 2;
            const distance = 50 + Math.random() * 100;
            particle.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance - 60}px)`;
            particle.style.opacity = '0';
        });
        
        setTimeout(() => {
            if (particle.parentNode) particle.remove();
        }, 2500);
    }, 300 + Math.random() * 400);
    
    // Guardar intervalo para limpiar después
    if (!this._abyIntervals) this._abyIntervals = [];
    this._abyIntervals.push(particleInterval);
}

    startGame() {
    if (!this.isHost) return;
    if (this.players.filter(p => !p.isHost).length < 1) return alert('Mínimo 1 jugador');
    this.gameStarted = true;
    this.currentPlayer = this.players.findIndex(p => !p.isHost);
    if (this.currentPlayer < 0) this.currentPlayer = 0;
    
    const safeQuestions = this.questions.map(q => ({ ...q, answer: '' }));
    
    this.broadcast({ 
        type: 'game-start', 
        categories: this.categories, 
        questions: safeQuestions, 
        players: this.players, 
        totalCategories: this.totalCategories, 
        questionsPerCategory: this.questionsPerCategory, 
        currentPlayer: this.currentPlayer, 
        jumpEnabled: this.jumpEnabled, 
        hardMode: this.hardMode, 
        textualMode: this.textualMode,
        timerEnabled: this.timerEnabled,
        timerTextSeconds: this.timerTextSeconds, // [NUEVO]
        timerOptionsSeconds: this.timerOptionsSeconds, // [NUEVO]
        timerAnagramSeconds: this.timerAnagramSeconds // [NUEVO]
    });
    
    this.renderBoard(); 
    this.showScreen('game-screen'); 
    this.startGameMusic(); 
    this.saveState();
    
    if (this.textualMode) {
        this.broadcast({ 
            type: 'player-turn', 
            currentPlayer: this.currentPlayer, 
            playerName: this.players[this.currentPlayer].name 
        });
    }
}

    renderBoard() {
    const board = document.getElementById('game-board');
    if (!board) return;
    board.innerHTML = '';
    board.style.gridTemplateColumns = `repeat(${this.totalCategories + 1}, 1fr)`;
    
    const ph = document.createElement('div');
    ph.className = 'game-cell category';
    ph.textContent = 'Pts';
    board.appendChild(ph);
    
    this.categories.forEach(cat => {
        const h = document.createElement('div');
        h.className = 'game-cell category';
        h.textContent = cat;
        board.appendChild(h);
    });
    
    let selectedCell = null;
    let selectedQuestionId = null;
    
    for (let i = 0; i < this.questionsPerCategory; i++) {
        const pc = document.createElement('div');
        pc.className = 'game-cell category';
        pc.textContent = (i + 1) * 100;
        board.appendChild(pc);
        
        this.categories.forEach(cat => {
            const q = this.questions.find(q => q.category === cat && q.points === (i + 1) * 100);
            const cell = document.createElement('div');
            cell.className = `game-cell ${q?.used ? 'used' : 'clickable'}`;
            cell.textContent = q?.used ? '✓' : (i + 1) * 100;
            cell.dataset.questionId = q?.id;
            cell.dataset.category = cat;
            cell.dataset.points = (i + 1) * 100;
            cell.style.position = 'relative';
            
            // [NUEVO] Easter egg para "ABY" en el tablero (solo si hay un jugador ABY)
            const abyPlayer = this.players.find(p => p.name === 'ABY' || p.name === 'Aby' || p.name === 'aby');
            if (abyPlayer && !q?.used) {
                cell.addEventListener('mouseenter', () => {
                    cell.style.borderColor = '#FFD700';
                    cell.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.5)';
                });
                cell.addEventListener('mouseleave', () => {
                    if (!cell.classList.contains('player-selected')) {
                        cell.style.borderColor = '';
                        cell.style.boxShadow = '';
                    }
                });
            }
            
            if (q && !q.used && this.selectedQuestionId === q.id) {
                cell.classList.add('player-selected');
                cell.style.border = '4px solid #f59e0b';
                cell.style.boxShadow = '0 0 30px rgba(245, 158, 11, 0.8), inset 0 0 20px rgba(245, 158, 11, 0.3)';
                cell.style.transform = 'scale(1.1)';
                cell.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                cell.style.color = 'white';
                cell.style.fontWeight = 'bold';
                cell.style.zIndex = '10';
                cell.style.position = 'relative';
                cell.style.animation = 'selectedPulse 0.8s ease-in-out infinite';
                
                const indicator = document.createElement('div');
                indicator.className = 'selection-indicator';
                indicator.textContent = '👆';
                indicator.style.position = 'absolute';
                indicator.style.top = '-14px';
                indicator.style.right = '-14px';
                indicator.style.fontSize = '1.4rem';
                indicator.style.background = 'white';
                indicator.style.borderRadius = '50%';
                indicator.style.padding = '2px 4px';
                indicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                indicator.style.zIndex = '20';
                const oldInd = cell.querySelector('.selection-indicator');
                if (oldInd) oldInd.remove();
                cell.appendChild(indicator);
            }
            
            if (!q?.used) {
                if (this.isHost) {
                    cell.addEventListener('click', () => this.selectQuestion(q));
                } else if (this.textualMode) {
                    cell.addEventListener('click', () => {
                        if (this.isHost) return;
                        const myIndex = this.players.findIndex(p => p.name === this.playerName);
                        if (myIndex === this.currentPlayer && this.connections.length > 0) {
                            if (selectedCell) {
                                selectedCell.classList.remove('player-selected');
                                selectedCell.style.border = '';
                                selectedCell.style.boxShadow = '';
                                selectedCell.style.transform = '';
                                selectedCell.style.background = '';
                                selectedCell.style.color = '';
                                selectedCell.style.fontWeight = '';
                                selectedCell.style.zIndex = '';
                                selectedCell.style.position = '';
                                selectedCell.style.animation = '';
                                const oldInd = selectedCell.querySelector('.selection-indicator');
                                if (oldInd) oldInd.remove();
                            }
                            
                            cell.classList.add('player-selected');
                            cell.style.border = '4px solid #f59e0b';
                            cell.style.boxShadow = '0 0 30px rgba(245, 158, 11, 0.8), inset 0 0 20px rgba(245, 158, 11, 0.3)';
                            cell.style.transform = 'scale(1.1)';
                            cell.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                            cell.style.color = 'white';
                            cell.style.fontWeight = 'bold';
                            cell.style.zIndex = '10';
                            cell.style.position = 'relative';
                            cell.style.animation = 'selectedPulse 0.8s ease-in-out infinite';
                            
                            const indicator = document.createElement('div');
                            indicator.className = 'selection-indicator';
                            indicator.textContent = '👆';
                            indicator.style.position = 'absolute';
                            indicator.style.top = '-14px';
                            indicator.style.right = '-14px';
                            indicator.style.fontSize = '1.4rem';
                            indicator.style.background = 'white';
                            indicator.style.borderRadius = '50%';
                            indicator.style.padding = '2px 4px';
                            indicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                            indicator.style.zIndex = '20';
                            const oldInd = cell.querySelector('.selection-indicator');
                            if (oldInd) oldInd.remove();
                            cell.appendChild(indicator);
                            
                            selectedCell = cell;
                            selectedQuestionId = q.id;
                            
                            this.connections[0].send({
                                type: 'player-select-question',
                                questionId: q.id
                            });
                            this.showToast('📤 Seleccionaste: ' + q.category + ' - ' + q.points + 'pts');
                        }
                    });
                }
            }
            board.appendChild(cell);
        });
    }
    
    this.renderPlayers();
    this.updateTurnIndicator();
}

    renderPlayers() {
    const bar = document.getElementById('players-bar');
    if (!bar) return;
    bar.innerHTML = '';
    const gamePlayers = this.players.filter(p => !p.isHost);
    gamePlayers.forEach((p) => {
        const originalIndex = this.players.indexOf(p);
        const div = document.createElement('div');
        div.className = `player-score ${originalIndex === this.currentPlayer ? 'active' : ''}`;
        div.innerHTML = `<strong>${p.emoji ? p.emoji + ' ' : ''}${p.name}</strong><br>${p.score} pts`;
        
        // [NUEVO] Easter egg para "ABY" en el juego
        if (p.name === 'ABY' || p.name === 'Aby' || p.name === 'aby') {
            div.classList.add('aby-easter-egg');
            div.style.animation = 'abyColorShift 2s ease-in-out infinite';
            div.style.border = '2px solid #FFD700';
            div.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.3)';
            
            // Crear partículas doradas en el juego
            this.createAbyParticles(div, p.emoji);
        }
        
        if (this.isHost) {
            div.style.cursor = 'pointer';
            div.addEventListener('click', () => {
                if (!document.getElementById('question-modal').classList.contains('active')) {
                    this.currentPlayer = originalIndex;
                    this.renderBoard();
                    this.broadcast({ type: 'game-update', currentPlayer: this.currentPlayer });
                    if (this.textualMode) this.broadcast({ type: 'player-turn', currentPlayer: this.currentPlayer, playerName: this.players[this.currentPlayer].name });
                    this.saveState();
                }
            });
        }
        bar.appendChild(div);
    });
}

    updateTurnIndicator() {
        const ind = document.getElementById('turn-indicator');
        if (ind && this.players[this.currentPlayer]) {
            const p = this.players[this.currentPlayer];
            ind.textContent = `🏆 Turno de: ${p.emoji ? p.emoji + ' ' : ''}${p.name}`;
        }
    }

    selectQuestion(q) {
    if (!this.isHost || q.used || !this.gameStarted) return;
    console.log('Host seleccionó pregunta:', q.id, q.type);
    
    this.playSound('select');
    this.currentQuestion = q;
    this.answerRevealed = false;
    this.questionJumped = false;
    this.originalPlayer = this.currentPlayer;
    this.playerAnswer = null;
    this.currentShuffledOptions = null;
    this.currentShuffledLetters = null;
    
    this.pistasReveladas = 0;
    this.pistasReveladasSet = new Set();
    this.valorPregunta = 1;
    
    this.jumpCount = 0;
    this.playersJumped = new Set();
    this.playersJumped.add(this.players[this.currentPlayer]?.name);
    
    document.getElementById('modal-category').textContent = `${q.category} — ${q.points} pts`;
    document.getElementById('modal-question').textContent = q.question || 'Ordena las letras para formar la palabra correcta';
    document.getElementById('modal-answer').classList.add('hidden');
    document.getElementById('player-answer-section').classList.add('hidden');
    document.getElementById('modal-options').classList.add('hidden');
    document.getElementById('modal-anagram').classList.add('hidden');
    document.getElementById('modal-pistas').classList.add('hidden');
    document.getElementById('modal-truefalse').classList.add('hidden');
    document.getElementById('modal-valor-pregunta').classList.add('hidden');
    
    const typeBadge = document.getElementById('modal-question-type');
    typeBadge.classList.remove('hidden', 'anagram', 'options', 'whoami', 'truefalse');
    
    if (q.type === 'options') {
        typeBadge.textContent = '🔤 Opción múltiple';
        typeBadge.classList.add('options');
        
        const optionsDiv = document.getElementById('modal-options');
        optionsDiv.classList.remove('hidden');
        const validOptions = (q.options || []).filter(opt => opt && opt.trim());
        const shuffled = [...validOptions].sort(() => Math.random() - 0.5);
        this.currentShuffledOptions = shuffled;
        optionsDiv.innerHTML = shuffled.map((opt, i) => 
            `<button class="option-btn host-option-btn" data-option="${this.escapeHtml(opt)}">${String.fromCharCode(65 + i)}) ${opt}</button>`
        ).join('');
        
        optionsDiv.querySelectorAll('.host-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const selectedOption = btn.dataset.option;
                const isCorrect = selectedOption.trim().toLowerCase() === q.answer.trim().toLowerCase();
                this.handleOptionChoice(isCorrect, selectedOption);
            });
        });
        
        document.getElementById('answer-buttons').style.display = 'none';
        document.getElementById('btn-correct').style.display = 'none';
        document.getElementById('btn-incorrect').style.display = 'none';
        document.getElementById('btn-jump').classList.add('hidden');
        
    } else if (q.type === 'anagram') {
        typeBadge.textContent = '🔀 Anagrama';
        typeBadge.classList.add('anagram');
        
        const anagramDiv = document.getElementById('modal-anagram');
        anagramDiv.classList.remove('hidden');
        const letters = q.answer.split('').sort(() => Math.random() - 0.5);
        this.currentShuffledLetters = letters;
        anagramDiv.innerHTML = letters.map(l => `<div class="anagram-letter">${l}</div>`).join('');
        
        document.getElementById('answer-buttons').style.display = 'flex';
        document.getElementById('btn-correct').style.display = 'inline-flex';
        document.getElementById('btn-incorrect').style.display = 'inline-flex';
        const jumpBtn = document.getElementById('btn-jump');
        if (jumpBtn) jumpBtn.classList.toggle('hidden', !this.jumpEnabled);
        
    } else if (q.type === 'whoami') {
        typeBadge.textContent = '🕵️ ¿Quién soy?';
        typeBadge.classList.add('whoami');
        
        const pistasDiv = document.getElementById('modal-pistas');
        pistasDiv.classList.remove('hidden');
        pistasDiv.innerHTML = (q.pistas || []).map((pista, i) => `
            <button class="pista-btn" data-pista-index="${i}" ${this.pistasReveladasSet.has(i) ? 'disabled' : ''}>
                ${this.pistasReveladasSet.has(i) ? pista : `🔒 Pista ${i + 1}`}
            </button>
        `).join('');
        
        pistasDiv.querySelectorAll('.pista-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.pistaIndex);
                this.revelarPista(idx);
            });
        });
        
        this.updateValorPistaDisplay();
        
        document.getElementById('answer-buttons').style.display = 'flex';
        document.getElementById('btn-correct').style.display = 'inline-flex';
        document.getElementById('btn-incorrect').style.display = 'inline-flex';
        const jumpBtn = document.getElementById('btn-jump');
        if (jumpBtn) jumpBtn.classList.toggle('hidden', !this.jumpEnabled);
        
    } else if (q.type === 'truefalse') {
        typeBadge.textContent = '✅ Verdadero/Falso';
        typeBadge.classList.add('truefalse');
        
        const tfDiv = document.getElementById('modal-truefalse');
        tfDiv.classList.remove('hidden');
        tfDiv.innerHTML = `
            <button class="tf-btn true-btn" data-value="Verdadero">✅ Verdadero</button>
            <button class="tf-btn false-btn" data-value="Falso">❌ Falso</button>
        `;
        
        tfDiv.querySelectorAll('.tf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const selected = btn.dataset.value;
                const isCorrect = selected === q.answer;
                this.handleTrueFalseAnswer(isCorrect, selected);
            });
        });
        
        document.getElementById('answer-buttons').style.display = 'none';
        document.getElementById('btn-correct').style.display = 'none';
        document.getElementById('btn-incorrect').style.display = 'none';
        document.getElementById('btn-jump').classList.add('hidden');
        
    } else {
        typeBadge.classList.add('hidden');
        document.getElementById('answer-buttons').style.display = 'flex';
        document.getElementById('btn-correct').style.display = 'inline-flex';
        document.getElementById('btn-incorrect').style.display = 'inline-flex';
        const jumpBtn = document.getElementById('btn-jump');
        if (jumpBtn) jumpBtn.classList.toggle('hidden', !this.jumpEnabled);
    }
    
    this.updateButtonTexts();
    this.updateTurnIndicatorModal();
    
    const closeBtn = document.querySelector('#question-modal .close');
    if (closeBtn) closeBtn.style.display = 'flex';
    
    document.getElementById('question-modal').classList.add('active');
    
    const answerDiv = document.getElementById('modal-answer');
    answerDiv.classList.remove('hidden');
    answerDiv.className = 'answer-reveal';
    document.getElementById('correct-answer-text').textContent = '🔑 Respuesta correcta: ' + q.answer;
    
    if (this.timerEnabled) {
        this.startTimer(q.type);
    }
    
    const broadcastData = {
        type: 'question-selected',
        category: q.category,
        points: q.points,
        question: q.question || 'Ordena las letras para formar la palabra correcta',
        qType: q.type || 'text',
        currentPlayer: this.currentPlayer,
        correctAnswer: q.answer,
        pistas: q.pistas || [],
        pistasReveladas: this.pistasReveladasSet.size,
        valorPregunta: this.valorPregunta
    };
    
    if (q.type === 'options' && this.currentShuffledOptions) {
        broadcastData.options = this.currentShuffledOptions;
        broadcastData.correctAnswer = q.answer;
    }
    
    if (q.type === 'anagram' && this.currentShuffledLetters) {
        broadcastData.anagramLetters = this.currentShuffledLetters;
    }
    
    console.log('Broadcast:', broadcastData);
    this.broadcast(broadcastData);
}

    shuffleString(str) {
        const arr = str.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join('');
    }

    updateButtonTexts() {
        if (!this.currentQuestion) return;
        document.getElementById('btn-correct-text').textContent = `Correcto +${this.currentQuestion.points}`;
        document.getElementById('btn-incorrect-text').textContent = this.hardMode ? `Incorrecto -${Math.floor(this.currentQuestion.points / 2)}` : 'Incorrecto';
    }

    updateTurnIndicatorModal() {
        const ind = document.getElementById('modal-turn-indicator');
        if (ind && this.players[this.currentPlayer]) {
            const p = this.players[this.currentPlayer];
            ind.textContent = `🏆 Turno: ${p.emoji ? p.emoji + ' ' : ''}${p.name}`;
            ind.classList.remove('jump-animation'); void ind.offsetWidth; ind.classList.add('jump-animation');
        }
    }

    showQuestionForPlayers(data) {
    console.log('Jugador recibió pregunta:', data.qType);
    
    document.getElementById('modal-category').textContent = `${data.category} — ${data.points} pts`;
    document.getElementById('modal-question').textContent = data.question || 'Ordena las letras para formar la palabra correcta';
    document.getElementById('modal-answer').classList.add('hidden');
    document.getElementById('player-answer-section').classList.add('hidden');
    document.getElementById('modal-options').classList.add('hidden');
    document.getElementById('modal-anagram').classList.add('hidden');
    document.getElementById('modal-pistas').classList.add('hidden');
    document.getElementById('modal-truefalse').classList.add('hidden');
    document.getElementById('modal-valor-pregunta').classList.add('hidden');
    
    const questionType = data.qType || data.type || 'text';
    
    const typeBadge = document.getElementById('modal-question-type');
    typeBadge.classList.remove('hidden', 'anagram', 'options', 'whoami', 'truefalse');
    
    if (questionType === 'options') {
        typeBadge.textContent = '🔤 Opción múltiple';
        typeBadge.classList.add('options');
        
        const optionsDiv = document.getElementById('modal-options');
        optionsDiv.classList.remove('hidden');
        const options = data.options || [];
        optionsDiv.innerHTML = options.map((opt, i) => 
            `<div class="option-btn">${String.fromCharCode(65 + i)}) ${opt}</div>`
        ).join('');
        
    } else if (questionType === 'anagram') {
        typeBadge.textContent = '🔀 Anagrama';
        typeBadge.classList.add('anagram');
        
        if (data.anagramLetters && data.anagramLetters.length > 0) {
            const anagramDiv = document.getElementById('modal-anagram');
            anagramDiv.classList.remove('hidden');
            anagramDiv.innerHTML = data.anagramLetters.map(l => 
                `<div class="anagram-letter">${l}</div>`
            ).join('');
        }
    } else if (questionType === 'whoami') {
        typeBadge.textContent = '🕵️ ¿Quién soy?';
        typeBadge.classList.add('whoami');
        
        const pistasDiv = document.getElementById('modal-pistas');
        pistasDiv.classList.remove('hidden');
        
        const pistasReveladas = data.pistasReveladas || 0;
        const pistas = data.pistas || [];
        
        pistasDiv.innerHTML = pistas.map((pista, i) => `
            <button class="pista-btn" data-pista-index="${i}" ${i < pistasReveladas ? 'disabled' : ''}>
                ${i < pistasReveladas ? pista : `🔒 Pista ${i + 1}`}
            </button>
        `).join('');
        
        if (!this.isHost && this.textualMode) {
            const myIndex = this.players.findIndex(p => p.name === this.playerName);
            if (myIndex === this.currentPlayer) {
                pistasDiv.querySelectorAll('.pista-btn:not([disabled])').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const idx = parseInt(btn.dataset.pistaIndex);
                        if (this.connections.length > 0) {
                            this.connections[0].send({ 
                                type: 'revelar-pista', 
                                pistaIndex: idx 
                            });
                        }
                    });
                });
            }
        }
        
        const valor = data.valorPregunta || 1;
        const puntos = Math.round(data.points * valor);
        const pistasReveladasCount = data.pistasReveladas || 0;
        const totalPistas = data.pistas?.length || 3;
        
        let valorEl = document.getElementById('modal-valor-pregunta');
        if (valorEl) {
            const porcentaje = valor * 100;
            valorEl.textContent = `💎 Valor actual: ${porcentaje}% (${pistasReveladasCount}/${totalPistas} pistas) = ${puntos}pts`;
            valorEl.style.display = 'block';
        }
        
        document.getElementById('answer-buttons').style.display = 'none';
        document.getElementById('btn-correct').style.display = 'none';
        document.getElementById('btn-incorrect').style.display = 'none';
        document.getElementById('btn-jump').classList.add('hidden');
        
    } else if (questionType === 'truefalse') {
        typeBadge.textContent = '✅ Verdadero/Falso';
        typeBadge.classList.add('truefalse');
        
        const tfDiv = document.getElementById('modal-truefalse');
        tfDiv.classList.remove('hidden');
        tfDiv.innerHTML = `
            <button class="tf-btn true-btn" data-value="Verdadero">✅ Verdadero</button>
            <button class="tf-btn false-btn" data-value="Falso">❌ Falso</button>
        `;
        
        // [CORREGIDO] Siempre mostrar botones para el jugador que tiene el turno
        if (!this.isHost) {
            const myIndex = this.players.findIndex(p => p.name === this.playerName);
            if (myIndex === this.currentPlayer) {
                // El jugador puede seleccionar
                tfDiv.querySelectorAll('.tf-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const selected = btn.dataset.value;
                        const isCorrect = selected === data.correctAnswer;
                        if (this.connections.length > 0) {
                            this.connections[0].send({ 
                                type: 'player-answer', 
                                answer: selected,
                                isCorrect: isCorrect 
                            });
                        }
                        // Deshabilitar todos los botones
                        tfDiv.querySelectorAll('.tf-btn').forEach(b => b.disabled = true);
                        // Mostrar estado
                        this.showToast(isCorrect ? '✅ ¡Correcto!' : '❌ Incorrecto');
                    });
                });
                // Habilitar botones visualmente
                tfDiv.querySelectorAll('.tf-btn').forEach(btn => {
                    btn.style.cursor = 'pointer';
                    btn.style.opacity = '1';
                });
            } else {
                // No es el turno del jugador, deshabilitar botones
                tfDiv.querySelectorAll('.tf-btn').forEach(btn => {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'default';
                });
            }
        }
        
        document.getElementById('answer-buttons').style.display = 'none';
        document.getElementById('btn-correct').style.display = 'none';
        document.getElementById('btn-incorrect').style.display = 'none';
        document.getElementById('btn-jump').classList.add('hidden');
        
    } else {
        typeBadge.classList.add('hidden');
        document.getElementById('answer-buttons').style.display = 'none';
        document.getElementById('btn-correct').style.display = 'none';
        document.getElementById('btn-incorrect').style.display = 'none';
        document.getElementById('btn-jump').classList.add('hidden');
    }
    
    if (this.isHost && data.correctAnswer) {
        const answerDiv = document.getElementById('modal-answer');
        answerDiv.classList.remove('hidden');
        answerDiv.className = 'answer-reveal';
        document.getElementById('correct-answer-text').textContent = '🔑 Respuesta correcta: ' + data.correctAnswer;
        document.getElementById('answer-buttons').style.display = 'flex';
        document.getElementById('btn-correct').style.display = 'inline-flex';
        document.getElementById('btn-incorrect').style.display = 'inline-flex';
    } else {
        document.getElementById('answer-buttons').style.display = 'none';
        document.getElementById('btn-correct').style.display = 'none';
        document.getElementById('btn-incorrect').style.display = 'none';
    }
    
    document.getElementById('btn-jump').classList.add('hidden');
    
    const closeBtn = document.querySelector('#question-modal .close');
    if (closeBtn) closeBtn.style.display = 'none';
    
    document.getElementById('question-modal').classList.add('active');
    
    document.getElementById('player-answer-modal').classList.remove('active');
    
    if (this.textualMode && !this.isHost) {
        const myIndex = this.players.findIndex(p => p.name === this.playerName);
        if (myIndex === this.currentPlayer) {
            if (this.timerEnabled) {
                const playerTimerEl = document.getElementById('player-modal-timer');
                if (playerTimerEl) {
                    const seconds = this.timerSeconds > 0 ? this.timerSeconds : 25;
                    playerTimerEl.textContent = `⏱️ ${seconds}s`;
                    playerTimerEl.style.display = 'block';
                }
            }
            
            // Para Verdadero/Falso no mostrar el modal de respuesta adicional
            if (questionType !== 'truefalse') {
                setTimeout(() => {
                    this.showPlayerAnswerModal({
                        category: data.category,
                        points: data.points,
                        question: data.question,
                        type: questionType,
                        options: data.options,
                        anagramLetters: data.anagramLetters,
                        correctAnswer: data.correctAnswer,
                        pistas: data.pistas,
                        pistasReveladas: data.pistasReveladas || 0,
                        valorPregunta: data.valorPregunta || 1
                    });
                }, 200);
            }
        }
    }
}

    // [NUEVO] Manejar asignación de pregunta para jugadores
// [NUEVO] Manejar asignación de pregunta para jugadores
handleQuestionAssigned(data) {
    // Limpiar selecciones anteriores
    this.clearPlayerSelections();
    
    // Guardar la pregunta seleccionada
    this.selectedQuestionId = data.questionId;
    
    // Buscar y resaltar la celda en el tablero del jugador
    const board = document.getElementById('game-board');
    if (!board) return;
    
    const cells = board.querySelectorAll('.game-cell.clickable');
    let foundCell = null;
    
    cells.forEach(cell => {
        const cellCategory = cell.dataset.category;
        const cellPoints = parseInt(cell.dataset.points);
        const cellId = parseInt(cell.dataset.questionId);
        if (cellId === data.questionId) {
            foundCell = cell;
        }
    });
    
    if (foundCell) {
        // [CORREGIDO] Hacer la selección MUCHO más visible para el jugador
        foundCell.classList.add('player-selected');
        foundCell.style.border = '4px solid #f59e0b';
        foundCell.style.boxShadow = '0 0 30px rgba(245, 158, 11, 0.8), inset 0 0 20px rgba(245, 158, 11, 0.3)';
        foundCell.style.transform = 'scale(1.1)';
        foundCell.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        foundCell.style.color = 'white';
        foundCell.style.fontWeight = 'bold';
        foundCell.style.zIndex = '10';
        foundCell.style.position = 'relative';
        foundCell.style.animation = 'selectedPulse 0.8s ease-in-out infinite';
        
        // Agregar indicador visual
        const indicator = document.createElement('div');
        indicator.className = 'selection-indicator';
        indicator.textContent = '👆';
        indicator.style.position = 'absolute';
        indicator.style.top = '-14px';
        indicator.style.right = '-14px';
        indicator.style.fontSize = '1.4rem';
        indicator.style.background = 'white';
        indicator.style.borderRadius = '50%';
        indicator.style.padding = '2px 4px';
        indicator.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        indicator.style.zIndex = '20';
        const oldInd = foundCell.querySelector('.selection-indicator');
        if (oldInd) oldInd.remove();
        foundCell.appendChild(indicator);
    }
    
    // Mostrar toast con la selección
    this.showToast('🎯 ' + data.playerName + ' seleccionó: ' + data.category + ' - ' + data.points + 'pts');
}

    showPlayerAnswerModal(data) {
    document.getElementById('player-modal-category').textContent = `${data.category} — ${data.points} pts`;
    document.getElementById('player-modal-question').textContent = data.question || 'Ordena las letras';
    document.getElementById('player-answer-input').value = '';
    document.getElementById('player-answer-input').disabled = false;
    document.getElementById('btn-send-answer').disabled = false;
    document.getElementById('player-answer-status').classList.add('hidden');
    document.getElementById('player-modal-options').classList.add('hidden');
    document.getElementById('player-modal-anagram').classList.add('hidden');
    document.getElementById('player-modal-pistas').classList.add('hidden');
    document.getElementById('player-modal-valor').classList.add('hidden');
    
    if (this.timerEnabled) {
        let playerTimerEl = document.getElementById('player-modal-timer');
        if (!playerTimerEl) {
            const playerModalContent = document.querySelector('#player-answer-modal .modal-content');
            if (playerModalContent) {
                const div = document.createElement('div');
                div.id = 'player-modal-timer';
                div.className = 'timer-display';
                const questionEl = document.getElementById('player-modal-question');
                if (questionEl) {
                    questionEl.parentNode.insertBefore(div, questionEl.nextSibling);
                }
                playerTimerEl = document.getElementById('player-modal-timer');
            }
        }
        if (playerTimerEl) {
            const seconds = this.timerSeconds > 0 ? this.timerSeconds : 0;
            playerTimerEl.textContent = `⏱️ ${seconds}s`;
            playerTimerEl.style.display = 'block';
            if (seconds <= 5 && seconds > 0) {
                playerTimerEl.style.color = '#ef4444';
                playerTimerEl.style.animation = 'pulse 0.5s infinite';
            } else {
                playerTimerEl.style.color = '';
                playerTimerEl.style.animation = '';
            }
        }
    } else {
        const playerTimerEl = document.getElementById('player-modal-timer');
        if (playerTimerEl) playerTimerEl.style.display = 'none';
    }
    
    if (data.type === 'options' && data.options) {
        const optDiv = document.getElementById('player-modal-options');
        optDiv.classList.remove('hidden');
        optDiv.innerHTML = data.options.map((opt, i) => 
            `<button class="option-btn player-option-btn" data-option="${this.escapeHtml(opt)}">${String.fromCharCode(65 + i)}) ${opt}</button>`
        ).join('');
        
        document.getElementById('player-answer-input').style.display = 'none';
        document.getElementById('btn-send-answer').style.display = 'none';
        
        optDiv.querySelectorAll('.player-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const chosen = btn.dataset.option;
                document.getElementById('player-answer-input').value = chosen;
                const isCorrect = data.correctAnswer && chosen.trim().toLowerCase() === data.correctAnswer.trim().toLowerCase();
                this.sendPlayerAnswerWithOption(chosen, isCorrect);
            });
        });
    } else if (data.type === 'whoami') {
        // Mostrar pistas para "Quién soy" en el modal del jugador
        document.getElementById('player-answer-input').style.display = '';
        document.getElementById('btn-send-answer').style.display = '';
        
        const pistasDiv = document.getElementById('player-modal-pistas');
        if (pistasDiv) {
            pistasDiv.classList.remove('hidden');
            const pistasReveladas = data.pistasReveladas || 0;
            const pistas = data.pistas || [];
            
            pistasDiv.innerHTML = pistas.map((pista, i) => `
                <button class="pista-btn" data-pista-index="${i}" ${i < pistasReveladas ? 'disabled' : ''}>
                    ${i < pistasReveladas ? pista : `🔒 Pista ${i + 1}`}
                </button>
            `).join('');
            
            // El jugador puede revelar pistas
            pistasDiv.querySelectorAll('.pista-btn:not([disabled])').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.dataset.pistaIndex);
                    if (this.connections.length > 0) {
                        this.connections[0].send({ 
                            type: 'revelar-pista', 
                            pistaIndex: idx 
                        });
                    }
                });
            });
        }
        
        // Mostrar valor de la pregunta
        const valor = data.valorPregunta || 1;
        const puntos = Math.round(data.points * valor);
        let valorEl = document.getElementById('player-modal-valor');
        if (valorEl) {
            const porcentaje = valor * 100;
            valorEl.textContent = `💎 Valor: ${porcentaje}% de ${data.points}pts = ${puntos}pts`;
            valorEl.style.display = 'block';
        }
        
    } else if (data.type === 'truefalse') {
        // Verdadero/Falso ya se maneja en showQuestionForPlayers
        document.getElementById('player-answer-input').style.display = 'none';
        document.getElementById('btn-send-answer').style.display = 'none';
    } else {
        document.getElementById('player-answer-input').style.display = '';
        document.getElementById('btn-send-answer').style.display = '';
    }
    
    if (data.type === 'anagram' && data.anagramLetters) {
        const anagramDiv = document.getElementById('player-modal-anagram');
        anagramDiv.classList.remove('hidden');
        anagramDiv.innerHTML = data.anagramLetters.map(l => 
            `<div class="anagram-letter">${l}</div>`
        ).join('');
    }
    
    document.getElementById('player-answer-modal').classList.add('active');
    if (data.type !== 'options' && data.type !== 'truefalse') {
        document.getElementById('player-answer-input').focus();
    }
}

    closeModal() {
    if (!this.isHost) return;
    if (this.answerRevealed || !this.currentQuestion) {
        // [NUEVO] Detener temporizador al cerrar modal
        this.stopTimer();
        
        document.getElementById('question-modal').classList.remove('active');
        document.getElementById('player-answer-modal').classList.remove('active');
        this.answerRevealed = false;
        this.currentQuestion = null;
        this.questionJumped = false;
        this.broadcast({ type: 'close-modal' });
        if (this.gameStarted && this.questions.every(q => q.used)) this.endGame();
    }
}

    jumpQuestion() {
    if (!this.isHost || !this.jumpEnabled || !this.currentQuestion || this.answerRevealed) return;
    
    this.stopTimer();
    
    this.playSound('jump');
    
    if (this.hardMode && !this.questionJumped) {
        const penalty = Math.floor(this.currentQuestion.points / 2);
        this.players[this.currentPlayer].score -= penalty;
        if (this.players[this.currentPlayer].score < 0) this.players[this.currentPlayer].score = 0;
    }
    
    let nextPlayer = this.currentPlayer;
    do {
        nextPlayer = (nextPlayer + 1) % this.players.length;
    } while (this.players[nextPlayer]?.isHost && this.players.length > 1);
    
    this.currentPlayer = nextPlayer;
    this.questionJumped = true;
    
    this.updateTurnIndicatorModal();
    this.updateButtonTexts();
    this.renderBoard();
    this.updateManualPointsPanel();
    
    // [CORREGIDO] Mostrar respuesta correcta al host
    if (this.currentQuestion) {
        const answerDiv = document.getElementById('modal-answer');
        answerDiv.classList.remove('hidden');
        answerDiv.className = 'answer-reveal';
        document.getElementById('correct-answer-text').textContent = '🔑 Respuesta correcta: ' + this.currentQuestion.answer;
    }
    
    this.broadcast({
        type: 'jump-notification',
        playerName: this.players[this.currentPlayer].name,
        playerEmoji: this.players[this.currentPlayer].emoji,
        currentPlayer: this.currentPlayer,
        players: this.players,
        questionType: this.currentQuestion.type,
        questionOptions: this.currentShuffledOptions,
        questionAnagram: this.currentShuffledLetters,
        correctAnswer: this.currentQuestion.answer
    });
    
    if (this.timerEnabled) {
        setTimeout(() => {
            this.startTimer(this.currentQuestion?.type);
        }, 500);
    }
    
    if (this.textualMode) {
        this.broadcast({
            type: 'player-turn',
            currentPlayer: this.currentPlayer,
            playerName: this.players[this.currentPlayer].name,
            questionType: this.currentQuestion.type,
            questionOptions: this.currentShuffledOptions,
            questionAnagram: this.currentShuffledLetters,
            correctAnswer: this.currentQuestion.answer,
            question: this.currentQuestion.question,
            category: this.currentQuestion.category,
            points: this.currentQuestion.points
        });
    }
}

    showJumpNotification(data) {
    if (data.players) this.players = data.players;
    if (data.currentPlayer !== undefined) this.currentPlayer = data.currentPlayer;
    this.renderBoard();
    
    const ind = document.getElementById('modal-turn-indicator');
    if (ind) {
        ind.textContent = `⏭ Saltó a: ${data.playerEmoji ? data.playerEmoji + ' ' : ''}${data.playerName}`;
        ind.classList.remove('jump-animation');
        void ind.offsetWidth;
        ind.classList.add('jump-animation');
    }
    
    // [NUEVO] Mostrar respuesta correcta al host si está disponible
    if (this.isHost && data.correctAnswer) {
        const answerDiv = document.getElementById('modal-answer');
        answerDiv.classList.remove('hidden');
        answerDiv.className = 'answer-reveal';
        document.getElementById('correct-answer-text').textContent = '🔑 Respuesta correcta: ' + data.correctAnswer;
    }
    
    document.getElementById('player-answer-modal').classList.remove('active');
    
    if (this.textualMode && !this.isHost) {
        const myIndex = this.players.findIndex(p => p.name === this.playerName);
        if (myIndex === this.currentPlayer && data.questionType) {
            setTimeout(() => {
                this.showPlayerAnswerModal({
                    category: data.category || this.currentQuestion?.category || '',
                    points: data.points || this.currentQuestion?.points || 0,
                    question: data.question || this.currentQuestion?.question || '',
                    type: data.questionType,
                    options: data.questionOptions,
                    anagramLetters: data.questionAnagram,
                    correctAnswer: data.correctAnswer
                });
            }, 500);
        }
    }
}

    handleAnswer(correct) {
    if (!this.isHost || !this.currentQuestion || this.answerRevealed) return;
    
    this.stopTimer();
    this.answerRevealed = true;
    this.playSound(correct ? 'correct' : 'incorrect');
    
    let puntosOtorgados = this.currentQuestion.points;
    if (this.currentQuestion.type === 'whoami') {
        puntosOtorgados = Math.round(this.currentQuestion.points * this.valorPregunta);
    }
    
    let puntosFinales = 0;
    if (correct) {
        puntosFinales = puntosOtorgados;
        this.players[this.currentPlayer].score += puntosOtorgados;
    } else if (this.hardMode) {
        const penalty = Math.floor(puntosOtorgados / 2);
        puntosFinales = -penalty;
        this.players[this.currentPlayer].score -= penalty;
        if (this.players[this.currentPlayer].score < 0) this.players[this.currentPlayer].score = 0;
    }
    
    // Mostrar animación de puntos
    const player = this.players[this.currentPlayer];
    this.showPointsAnimation(player.name, player.emoji || '', puntosFinales, correct);
    
    const answerDiv = document.getElementById('modal-answer');
    answerDiv.classList.remove('hidden', 'correct-anim', 'incorrect-anim');
    answerDiv.classList.add(correct ? 'correct-anim' : 'incorrect-anim');
    document.getElementById('correct-answer-text').textContent = this.currentQuestion.answer;
    document.getElementById('answer-buttons').style.display = 'none';
    
    const closeBtn = document.querySelector('#question-modal .close');
    if (closeBtn) closeBtn.style.display = 'flex';
    
    this.currentQuestion.used = true;
    
    this.broadcast({
        type: 'answer-result',
        correct,
        answer: this.currentQuestion.answer,
        playerName: this.players[this.currentPlayer].name,
        playerEmoji: this.players[this.currentPlayer].emoji,
        pointsAwarded: correct ? puntosOtorgados : (this.hardMode ? -Math.floor(puntosOtorgados / 2) : 0),
        players: this.players,
        playerAnswer: this.playerAnswer || null
    });
    
    this.playerAnswer = null;
    
    do {
        this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    } while (this.players[this.currentPlayer]?.isHost && this.players.length > 1);
    
    this.broadcast({
        type: 'game-update',
        questionId: this.currentQuestion.id,
        players: this.players,
        currentPlayer: this.currentPlayer
    });
    
    document.getElementById('player-answer-modal').classList.remove('active');
    
    if (this.textualMode) {
        this.broadcast({
            type: 'player-turn',
            currentPlayer: this.currentPlayer,
            playerName: this.players[this.currentPlayer].name
        });
    }
    
    this.renderBoard();
    this.updateManualPointsPanel();
    this.saveState();
    
    if (this.questions.every(q => q.used)) {
        setTimeout(() => this.endGame(), 1500);
    }
}

    showAnswerForPlayers(data) {
    const answerDiv = document.getElementById('modal-answer');
    answerDiv.classList.remove('hidden', 'correct-anim', 'incorrect-anim');
    answerDiv.classList.add(data.correct ? 'correct-anim' : 'incorrect-anim');
    document.getElementById('correct-answer-text').textContent = data.answer;
    document.getElementById('answer-buttons').style.display = 'none';
    document.getElementById('btn-jump').classList.add('hidden');
    
    // Mostrar opción seleccionada
    if (data.selectedOption) {
        document.getElementById('player-answer-section').classList.remove('hidden');
        document.getElementById('player-answer-text').textContent = '"' + data.selectedOption + '"';
    } else {
        document.getElementById('player-answer-section').classList.add('hidden');
    }
    
    const closeBtn = document.querySelector('#question-modal .close');
    if (closeBtn) closeBtn.style.display = 'none';
    
    if (data.players) this.players = data.players;
    document.getElementById('player-answer-modal').classList.remove('active');
}

    adjustManualPoints(multiplier) {
        if (!this.isHost) return;
        const select = document.getElementById('manual-player-select'); const input = document.getElementById('manual-points-input');
        if (!select || !input) return;
        const playerIndex = parseInt(select.value); const amount = parseInt(input.value) * multiplier;
        if (isNaN(playerIndex) || isNaN(amount) || amount === 0) return alert('Selecciona un jugador y una cantidad');
        this.players[playerIndex].score += amount;
        if (this.players[playerIndex].score < 0) this.players[playerIndex].score = 0;
        this.renderBoard(); this.updateManualPointsPanel();
        this.broadcast({ type: 'game-update', players: this.players }); this.saveState(); this.playSound('click');
        this.showToast(`${this.players[playerIndex].emoji || ''} ${this.players[playerIndex].name}: ${amount > 0 ? '+' + amount : amount} pts`);
    }

    endGame() {
        if (!this.isHost) return;
        this.gameStarted = false;
        document.getElementById('question-modal').classList.remove('active');
        document.getElementById('player-answer-modal').classList.remove('active');
        this.broadcast({ type: 'game-end', players: this.players });
        this.stopGameMusic(); this.playSound('win'); this.showResults(); this.createConfetti(); this.clearState();
    }

    showResults() {
        const gamePlayers = this.players.filter(p => !p.isHost);
        const sorted = [...gamePlayers].sort((a, b) => b.score - a.score);
        this.sortedPlayers = sorted;
        const podium = document.getElementById('podium'); if (!podium) return; podium.innerHTML = '';
        if (sorted.length === 0) { podium.innerHTML = '<p class="hint">No hay jugadores</p>'; }
        else {
            const top = sorted.slice(0, Math.min(3, sorted.length));
            const order = [];
            if (top.length >= 2) order.push({ p: top[1], pos: 2 });
            if (top.length >= 1) order.push({ p: top[0], pos: 1 });
            if (top.length >= 3) order.push({ p: top[2], pos: 3 });
            order.forEach(({ p, pos }) => {
                const card = document.createElement('div'); card.className = `result-card ${pos === 1 ? 'first' : pos === 2 ? 'second' : 'third'}`;
                const emoji = pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉';
                card.innerHTML = `<div class="pos">${emoji} #${pos}</div><div class="name">${p.emoji ? p.emoji + ' ' : ''}${p.name}</div><div class="pts">${p.score} pts</div>`; podium.appendChild(card);
            });
        }
        document.getElementById('full-results').classList.add('hidden'); this.showScreen('results-screen');
    }

    toggleFullResults() {
        const el = document.getElementById('full-results'); if (!el) return;
        if (el.classList.contains('hidden')) {
            el.innerHTML = '<h3>Clasificación Completa</h3>';
            if (this.sortedPlayers.length === 0) el.innerHTML += '<p class="hint">No hay jugadores</p>';
            else this.sortedPlayers.forEach((p, i) => { const row = document.createElement('div'); row.className = 'result-row'; row.innerHTML = `<span class="rank">#${i + 1}</span><span class="name-col">${p.emoji ? p.emoji + ' ' : ''}${p.name}</span><span class="pts-col">${p.score} pts</span>`; el.appendChild(row); });
            el.classList.remove('hidden');
        } else el.classList.add('hidden');
    }

    createConfetti() {
        const container = document.getElementById('confetti'); if (!container) return; container.innerHTML = '';
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
        for (let i = 0; i < 80; i++) { const piece = document.createElement('div'); piece.className = 'confetti-piece'; piece.style.left = Math.random() * 100 + '%'; piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]; piece.style.animationDelay = Math.random() * 2 + 's'; piece.style.animationDuration = (2 + Math.random() * 3) + 's'; piece.style.width = (6 + Math.random() * 8) + 'px'; piece.style.height = (6 + Math.random() * 8) + 'px'; container.appendChild(piece); }
        setTimeout(() => { container.innerHTML = ''; }, 5000);
    }

    disconnect() {
    if (this.peer) { this.peer.destroy(); this.peer = null; }
    this.clearState();
    sessionStorage.removeItem('jeopardy-player-code');
    sessionStorage.removeItem('jeopardy-player-name');
    sessionStorage.removeItem('jeopardy-player-emoji');
    this.stopGameMusic();
    
    // [NUEVO] Limpiar intervalos de partículas ABY
    if (this._abyIntervals) {
        this._abyIntervals.forEach(interval => clearInterval(interval));
        this._abyIntervals = [];
    }
    
    this.categories = [];
    this.questions = [];
    this.players = [];
    this.connections = [];
    this.joinedNames = new Set();
    this.currentPlayer = 0;
    this.gameStarted = false;
    this.currentQuestion = null;
    this.answerRevealed = false;
    this.isHost = false;
    this.roomCode = '';
    this.roomFromQR = null;
    this.jumpEnabled = false;
    this.hardMode = false;
    this.textualMode = false;
    this.questionJumped = false;
    this.playerAnswer = null;
    this.isAby = false;
    
    document.getElementById('question-modal').classList.remove('active');
    document.getElementById('player-answer-modal').classList.remove('active');
    document.getElementById('answer-buttons').style.display = 'flex';
    document.getElementById('join-form').classList.add('hidden');
    document.getElementById('load-trivia-form').classList.add('hidden');
    document.querySelector('.home-actions').style.display = 'flex';
    document.querySelector('.trivia-actions').style.display = 'flex';
    const btn = document.getElementById('join-room-submit');
    if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
    const codeInput = document.getElementById('room-code');
    if (codeInput) { codeInput.disabled = false; codeInput.value = ''; }
    const triviaInput = document.getElementById('trivia-code-input');
    if (triviaInput) triviaInput.value = '';
    const confetti = document.getElementById('confetti');
    if (confetti) confetti.innerHTML = '';
    const closeBtn = document.querySelector('#question-modal .close');
    if (closeBtn) closeBtn.style.display = 'flex';
    if (window.location.search) window.history.replaceState({}, '', window.location.pathname);
    this.showScreen('home-screen');
}

    handleOptionChoice(isCorrect, selectedOption) {
    if (!this.isHost || !this.currentQuestion || this.answerRevealed) return;
    
    // [NUEVO] Detener temporizador
    this.stopTimer();
    
    this.answerRevealed = true;
    this.playSound(isCorrect ? 'correct' : 'incorrect');
    
    if (isCorrect) {
        this.players[this.currentPlayer].score += this.currentQuestion.points;
    } else if (this.hardMode) {
        const penalty = Math.floor(this.currentQuestion.points / 2);
        this.players[this.currentPlayer].score -= penalty;
        if (this.players[this.currentPlayer].score < 0) this.players[this.currentPlayer].score = 0;
    }
    
    const answerDiv = document.getElementById('modal-answer');
    answerDiv.classList.remove('hidden', 'correct-anim', 'incorrect-anim');
    answerDiv.classList.add(isCorrect ? 'correct-anim' : 'incorrect-anim');
    document.getElementById('correct-answer-text').textContent = this.currentQuestion.answer;
    
    document.querySelectorAll('.host-option-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'default';
        if (btn.dataset.option.trim().toLowerCase() === this.currentQuestion.answer.trim().toLowerCase()) {
            btn.style.background = '#d1fae5';
            btn.style.borderColor = '#10b981';
        }
        if (btn.dataset.option === selectedOption && !isCorrect) {
            btn.style.background = '#fee2e2';
            btn.style.borderColor = '#ef4444';
        }
    });
    
    this.currentQuestion.used = true;
    
    this.broadcast({
        type: 'answer-result',
        correct: isCorrect,
        answer: this.currentQuestion.answer,
        playerName: this.players[this.currentPlayer].name,
        playerEmoji: this.players[this.currentPlayer].emoji,
        pointsAwarded: isCorrect ? this.currentQuestion.points : (this.hardMode ? -Math.floor(this.currentQuestion.points / 2) : 0),
        players: this.players,
        selectedOption: selectedOption
    });
    
    do {
        this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    } while (this.players[this.currentPlayer]?.isHost && this.players.length > 1);
    
    this.broadcast({
        type: 'game-update',
        questionId: this.currentQuestion.id,
        players: this.players,
        currentPlayer: this.currentPlayer
    });
    
    if (this.textualMode) {
        this.broadcast({
            type: 'player-turn',
            currentPlayer: this.currentPlayer,
            playerName: this.players[this.currentPlayer].name
        });
    }
    
    this.renderBoard();
    this.updateManualPointsPanel();
    this.saveState();
    
    if (this.questions.every(q => q.used)) {
        setTimeout(() => this.endGame(), 1500);
    }
}

escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

saveAllQuestionsFromDOM() {
    document.querySelectorAll('.q-type').forEach(select => {
        const id = parseInt(select.dataset.id);
        const q = this.questions.find(q => q.id === id);
        if (q) q.type = select.value;
    });
    
    document.querySelectorAll('.q-input').forEach(input => {
        const id = parseInt(input.dataset.id);
        const q = this.questions.find(q => q.id === id);
        if (q) q.question = input.value.trim();
    });
    
    document.querySelectorAll('.a-input').forEach(input => {
        const id = parseInt(input.dataset.id);
        const q = this.questions.find(q => q.id === id);
        if (q) q.answer = input.value.trim();
    });
    
    document.querySelectorAll('.options-container').forEach(container => {
        const qId = parseInt(container.dataset.id);
        const q = this.questions.find(q => q.id === qId);
        if (!q) return;
        
        const optInputs = container.querySelectorAll('.opt-input');
        if (optInputs.length > 0) {
            q.options = [];
            optInputs.forEach(input => {
                q.options.push(input.value.trim());
            });
            const filled = q.options.filter(o => o);
            if (filled.length > 0 && q.type === 'options') {
                q.answer = filled[0];
            }
        }
    });
    
    document.querySelectorAll('.whoami-container').forEach(container => {
        const qId = parseInt(container.dataset.id);
        const q = this.questions.find(q => q.id === qId);
        if (!q) return;
        
        const pistaInputs = container.querySelectorAll('.pista-input');
        if (pistaInputs.length > 0) {
            q.pistas = [];
            pistaInputs.forEach(input => {
                q.pistas.push(input.value.trim());
            });
        }
    });
    
    console.log('Preguntas guardadas desde DOM:', this.questions);
}

sendPlayerAnswerWithOption(chosen, isCorrect) {
    if (this.isHost || !this.textualMode) return;
    
    if (this.connections.length > 0) {
        this.connections[0].send({ 
            type: 'player-answer', 
            answer: chosen,
            isCorrect: isCorrect 
        });
    }
    
    document.getElementById('player-answer-status').classList.remove('hidden');
    document.getElementById('player-answer-status').textContent = '✅ Respuesta enviada. Esperando veredicto del host...';
    document.getElementById('btn-send-answer').disabled = true;
    document.getElementById('player-answer-input').disabled = true;
    
    document.querySelectorAll('.player-option-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'default';
    });
    
    this.playSound('send');
}

// ==================== FUNCIONES DE TEMPORIZADOR ====================

startTimer(questionType) {
    if (!this.timerEnabled || !this.isHost || this.answerRevealed) return;
    
    this.stopTimer();
    
    let seconds = this.timerTextSeconds; // default
    if (questionType === 'options') seconds = this.timerOptionsSeconds;
    else if (questionType === 'anagram') seconds = this.timerAnagramSeconds;
    else seconds = this.timerTextSeconds;
    
    this.timerSeconds = seconds;
    this.timerRunning = true;
    this.timerTimeout = false;
    this.jumpCount = 0;
    this.playersJumped = new Set();
    this.playersJumped.add(this.players[this.currentPlayer]?.name);
    
    this.updateTimerDisplay(seconds);
    
    this.timerInterval = setInterval(() => {
        this.timerSeconds--;
        this.updateTimerDisplay(this.timerSeconds);
        
        if (this.timerSeconds <= 0) {
            this.stopTimer();
            this.handleTimerTimeout();
        }
    }, 1000);
}

stopTimer() {
    if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
    }
    this.timerRunning = false;
    this.hideTimerDisplay();
}

updateTimerDisplay(seconds) {
    // Mostrar en el modal del host
    let timerEl = document.getElementById('modal-timer');
    if (!timerEl) {
        const modalContent = document.querySelector('#question-modal .modal-content');
        if (modalContent) {
            const div = document.createElement('div');
            div.id = 'modal-timer';
            div.className = 'timer-display';
            const turnIndicator = document.getElementById('modal-turn-indicator');
            if (turnIndicator) {
                turnIndicator.parentNode.insertBefore(div, turnIndicator);
            } else {
                const answerBtns = document.getElementById('answer-buttons');
                if (answerBtns) {
                    answerBtns.parentNode.insertBefore(div, answerBtns);
                }
            }
            timerEl = document.getElementById('modal-timer');
        }
    }
    if (timerEl) {
        timerEl.textContent = `⏱️ ${seconds}s`;
        timerEl.style.display = 'block';
        if (seconds <= 5) {
            timerEl.style.color = '#ef4444';
            timerEl.style.animation = 'pulse 0.5s infinite';
        } else {
            timerEl.style.color = '';
            timerEl.style.animation = '';
        }
    }
    
    // [CORREGIDO] Mostrar en el modal del jugador SIEMPRE
    let playerTimerEl = document.getElementById('player-modal-timer');
    if (!playerTimerEl) {
        const playerModalContent = document.querySelector('#player-answer-modal .modal-content');
        if (playerModalContent) {
            const div = document.createElement('div');
            div.id = 'player-modal-timer';
            div.className = 'timer-display';
            const questionEl = document.getElementById('player-modal-question');
            if (questionEl) {
                questionEl.parentNode.insertBefore(div, questionEl.nextSibling);
            }
            playerTimerEl = document.getElementById('player-modal-timer');
        }
    }
    if (playerTimerEl) {
        playerTimerEl.textContent = `⏱️ ${seconds}s`;
        playerTimerEl.style.display = 'block';
        if (seconds <= 5) {
            playerTimerEl.style.color = '#ef4444';
            playerTimerEl.style.animation = 'pulse 0.5s infinite';
        } else {
            playerTimerEl.style.color = '';
            playerTimerEl.style.animation = '';
        }
    }
    
    // [CORREGIDO] Broadcast del tiempo para TODOS los jugadores
    if (this.isHost) {
        this.broadcast({
            type: 'timer-update',
            seconds: seconds,
            isWarning: seconds <= 5
        });
    }
}

hideTimerDisplay() {
    const timerEl = document.getElementById('modal-timer');
    if (timerEl) timerEl.style.display = 'none';
    const playerTimerEl = document.getElementById('player-modal-timer');
    if (playerTimerEl) playerTimerEl.style.display = 'none';
}

handleTimerTimeout() {
    if (!this.isHost || !this.currentQuestion || this.answerRevealed) return;
    
    this.timerTimeout = true;
    this.playSound('incorrect');
    
    const currentPlayer = this.players[this.currentPlayer];
    const playerName = currentPlayer?.name || '';
    
    // [NUEVO] Restar puntos si está en modo difícil
    if (this.hardMode) {
        const penalty = Math.floor(this.currentQuestion.points / 2);
        currentPlayer.score -= penalty;
        if (currentPlayer.score < 0) currentPlayer.score = 0;
    }
    
    const activePlayers = this.players.filter(p => !p.isHost);
    const allJumped = activePlayers.every(p => this.playersJumped.has(p.name));
    
    if (allJumped) {
        this.answerRevealed = true;
        this.currentQuestion.used = true;
        
        this.showNoOneAnswered();
        
        this.broadcast({
            type: 'timer-timeout-all',
            playerName: playerName,
            players: this.players,
            questionId: this.currentQuestion.id,
            currentPlayer: this.currentPlayer
        });
        
        document.getElementById('player-answer-modal').classList.remove('active');
        this.advanceToNextPlayer();
        this.renderBoard();
        this.updateManualPointsPanel();
        this.saveState();
        
        if (this.questions.every(q => q.used)) {
            setTimeout(() => this.endGame(), 1500);
        }
        return;
    }
    
    let nextPlayer = this.currentPlayer;
    let attempts = 0;
    const totalPlayers = this.players.length;
    
    do {
        nextPlayer = (nextPlayer + 1) % totalPlayers;
        attempts++;
    } while ((this.players[nextPlayer]?.isHost || this.playersJumped.has(this.players[nextPlayer]?.name)) && attempts < totalPlayers);
    
    if (attempts >= totalPlayers || this.players[nextPlayer]?.isHost) {
        this.answerRevealed = true;
        this.currentQuestion.used = true;
        this.showNoOneAnswered();
        
        this.broadcast({
            type: 'timer-timeout-all',
            playerName: playerName,
            players: this.players,
            questionId: this.currentQuestion.id,
            currentPlayer: this.currentPlayer
        });
        
        document.getElementById('player-answer-modal').classList.remove('active');
        this.advanceToNextPlayer();
        this.renderBoard();
        this.updateManualPointsPanel();
        this.saveState();
        
        if (this.questions.every(q => q.used)) {
            setTimeout(() => this.endGame(), 1500);
        }
        return;
    }
    
    this.jumpCount++;
    this.playersJumped.add(this.players[nextPlayer]?.name);
    this.currentPlayer = nextPlayer;
    this.questionJumped = true;
    
    this.broadcast({
        type: 'timer-jump',
        playerName: this.players[this.currentPlayer]?.name || '',
        playerEmoji: this.players[this.currentPlayer]?.emoji || '',
        currentPlayer: this.currentPlayer,
        players: this.players,
        questionType: this.currentQuestion?.type,
        questionOptions: this.currentShuffledOptions,
        questionAnagram: this.currentShuffledLetters,
        correctAnswer: this.currentQuestion?.answer,
        question: this.currentQuestion?.question,
        category: this.currentQuestion?.category,
        points: this.currentQuestion?.points
    });
    
    this.updateTurnIndicatorModal();
    this.renderBoard();
    this.updateManualPointsPanel();
    
    if (this.timerEnabled && !this.answerRevealed) {
        setTimeout(() => {
            this.startTimer(this.currentQuestion?.type);
        }, 500);
    }
    
    if (this.textualMode) {
        this.broadcast({
            type: 'player-turn',
            currentPlayer: this.currentPlayer,
            playerName: this.players[this.currentPlayer]?.name,
            questionType: this.currentQuestion?.type,
            questionOptions: this.currentShuffledOptions,
            questionAnagram: this.currentShuffledLetters,
            correctAnswer: this.currentQuestion?.answer,
            question: this.currentQuestion?.question,
            category: this.currentQuestion?.category,
            points: this.currentQuestion?.points
        });
    }
    
    this.saveState();
}

showNoOneAnswered() {
    const answerDiv = document.getElementById('modal-answer');
    answerDiv.classList.remove('hidden', 'correct-anim', 'incorrect-anim');
    answerDiv.classList.add('incorrect-anim');
    document.getElementById('correct-answer-text').textContent = '⏰ ¡Nadie respondió a tiempo! La respuesta era: ' + this.currentQuestion.answer;
    document.getElementById('answer-buttons').style.display = 'none';
    
    const closeBtn = document.querySelector('#question-modal .close');
    if (closeBtn) closeBtn.style.display = 'flex';
}

advanceToNextPlayer() {
    let nextPlayer = this.currentPlayer;
    let attempts = 0;
    do {
        nextPlayer = (nextPlayer + 1) % this.players.length;
        attempts++;
    } while (this.players[nextPlayer]?.isHost && attempts < this.players.length);
    
    if (attempts < this.players.length) {
        this.currentPlayer = nextPlayer;
    }
    
    this.broadcast({
        type: 'game-update',
        questionId: this.currentQuestion?.id,
        players: this.players,
        currentPlayer: this.currentPlayer
    });
    
    if (this.textualMode) {
        this.broadcast({
            type: 'player-turn',
            currentPlayer: this.currentPlayer,
            playerName: this.players[this.currentPlayer]?.name
        });
    }
}

handleTimerJump(data) {
    if (data.players) this.players = data.players;
    if (data.currentPlayer !== undefined) this.currentPlayer = data.currentPlayer;
    this.renderBoard();
    
    const ind = document.getElementById('modal-turn-indicator');
    if (ind) {
        ind.textContent = `⏰ Se acabó el tiempo! Turno: ${data.playerEmoji ? data.playerEmoji + ' ' : ''}${data.playerName}`;
        ind.classList.remove('jump-animation');
        void ind.offsetWidth;
        ind.classList.add('jump-animation');
    }
    
    // Mostrar respuesta correcta al host si está disponible
    if (this.isHost && data.correctAnswer) {
        const answerDiv = document.getElementById('modal-answer');
        answerDiv.classList.remove('hidden');
        answerDiv.className = 'answer-reveal incorrect-anim';
        document.getElementById('correct-answer-text').textContent = '⏰ Tiempo agotado. Respuesta correcta: ' + data.correctAnswer;
    }
    
    document.getElementById('player-answer-modal').classList.remove('active');
    
    if (!this.isHost) {
        const myIndex = this.players.findIndex(p => p.name === this.playerName);
        if (myIndex === this.currentPlayer && data.questionType) {
            // [NUEVO] Mostrar el timer reiniciado para el jugador
            if (this.timerEnabled) {
                const playerTimerEl = document.getElementById('player-modal-timer');
                if (playerTimerEl) {
                    playerTimerEl.textContent = `⏱️ ${this.timerSeconds}s`;
                    playerTimerEl.style.display = 'block';
                }
            }
            
            setTimeout(() => {
                this.showPlayerAnswerModal({
                    category: data.category || '',
                    points: data.points || 0,
                    question: data.question || '',
                    type: data.questionType,
                    options: data.questionOptions,
                    anagramLetters: data.questionAnagram,
                    correctAnswer: data.correctAnswer
                });
            }, 500);
        } else {
            // [NUEVO] Si no es el turno del jugador, ocultar el timer
            const playerTimerEl = document.getElementById('player-modal-timer');
            if (playerTimerEl) {
                playerTimerEl.style.display = 'none';
            }
        }
    }
}

handleTimerTimeoutAll(data) {
    if (data.players) this.players = data.players;
    if (data.currentPlayer !== undefined) this.currentPlayer = data.currentPlayer;
    this.renderBoard();
    
    // Ocultar timer para todos los jugadores
    if (!this.isHost) {
        const playerTimerEl = document.getElementById('player-modal-timer');
        if (playerTimerEl) {
            playerTimerEl.style.display = 'none';
        }
        
        const answerDiv = document.getElementById('modal-answer');
        answerDiv.classList.remove('hidden');
        answerDiv.className = 'answer-reveal incorrect-anim';
        document.getElementById('correct-answer-text').textContent = '⏰ ¡Nadie respondió a tiempo!';
        document.getElementById('answer-buttons').style.display = 'none';
    }
    
    document.getElementById('player-answer-modal').classList.remove('active');
}

// [NUEVO] Mostrar/ocultar configuración de tiempos
toggleTimerSettings(show) {
    const settings = document.getElementById('timer-settings');
    if (settings) {
        if (show) {
            settings.classList.remove('hidden');
        } else {
            settings.classList.add('hidden');
        }
    }
}

updatePlayerTimer(seconds, isWarning) {
    const playerTimerEl = document.getElementById('player-modal-timer');
    if (playerTimerEl) {
        if (seconds !== undefined && seconds !== null) {
            playerTimerEl.textContent = `⏱️ ${seconds}s`;
            playerTimerEl.style.display = 'block';
            if (isWarning) {
                playerTimerEl.style.color = '#ef4444';
                playerTimerEl.style.animation = 'pulse 0.5s infinite';
            } else {
                playerTimerEl.style.color = '';
                playerTimerEl.style.animation = '';
            }
        } else {
            playerTimerEl.style.display = 'none';
        }
    }
}

// [NUEVO] Limpiar selecciones de jugadores
clearPlayerSelections() {
    // [CORREGIDO] Limpiar TODAS las selecciones visuales
    document.querySelectorAll('.game-cell.player-selected').forEach(el => {
        el.classList.remove('player-selected');
        el.style.border = '';
        el.style.boxShadow = '';
        el.style.transform = '';
        el.style.background = '';
        el.style.color = '';
        el.style.fontWeight = '';
        el.style.zIndex = '';
        el.style.position = '';
        // Remover indicador
        const indicator = el.querySelector('.selection-indicator');
        if (indicator) indicator.remove();
    });
    
    // Limpiar referencia global
    this.selectedQuestionId = null;
}

// [NUEVO] Revelar pista para "Quién soy"
revelarPista(idx) {
    if (!this.isHost || !this.currentQuestion || this.answerRevealed) return;
    if (this.pistasReveladasSet.has(idx)) return;
    if (this.currentQuestion.type !== 'whoami') return;
    
    this.pistasReveladasSet.add(idx);
    this.pistasReveladas = this.pistasReveladasSet.size;
    
    if (this.pistasReveladas === 1) this.valorPregunta = 1;
    else if (this.pistasReveladas === 2) this.valorPregunta = 0.75;
    else if (this.pistasReveladas === 3) this.valorPregunta = 0.5;
    
    const pistasDiv = document.getElementById('modal-pistas');
    if (pistasDiv) {
        const btns = pistasDiv.querySelectorAll('.pista-btn');
        btns.forEach((btn, i) => {
            if (i === idx) {
                btn.textContent = this.currentQuestion.pistas[i];
                btn.disabled = true;
                btn.style.background = '#d1fae5';
                btn.style.borderColor = '#10b981';
                btn.style.cursor = 'default';
            }
        });
    }
    
    this.updateValorPistaDisplay();
    this.playSound('click');
    
    this.broadcast({
        type: 'pista-revelada',
        pistaIndex: idx,
        pistasReveladas: this.pistasReveladasSet.size,
        pistaTexto: this.currentQuestion.pistas[idx],
        valorPregunta: this.valorPregunta,
        puntosBase: this.currentQuestion.points
    });
}

// [NUEVO] Actualizar display del valor de la pregunta
updateValorPistaDisplay() {
    let valorEl = document.getElementById('modal-valor-pregunta');
    if (!valorEl) {
        const modalContent = document.querySelector('#question-modal .modal-content');
        if (modalContent) {
            const div = document.createElement('div');
            div.id = 'modal-valor-pregunta';
            div.className = 'valor-pregunta-display';
            const pistasDiv = document.getElementById('modal-pistas');
            if (pistasDiv) {
                pistasDiv.parentNode.insertBefore(div, pistasDiv.nextSibling);
            }
            valorEl = document.getElementById('modal-valor-pregunta');
        }
    }
    if (valorEl) {
        const porcentaje = this.valorPregunta * 100;
        const puntos = Math.round(this.currentQuestion.points * this.valorPregunta);
        valorEl.textContent = `💎 Valor: ${porcentaje}% de ${this.currentQuestion.points}pts = ${puntos}pts`;
        valorEl.style.display = 'block';
    }
}

// [NUEVO] Manejar respuesta de Verdadero/Falso
handleRevelarPista(conn, data) {
        if (!this.isHost || !this.currentQuestion || this.answerRevealed) return;
        if (this.currentQuestion.type !== 'whoami') return;
        
        const playerName = conn.metadata?.name;
        const playerIndex = this.players.findIndex(p => p.name === playerName);
        if (playerIndex !== this.currentPlayer) return;
        
        const idx = data.pistaIndex;
        if (this.pistasReveladasSet.has(idx)) return;
        
        this.revelarPista(idx);
    }

    handlePistaRevelada(data) {
        const pistasDiv = document.getElementById('modal-pistas');
        if (pistasDiv) {
            const btns = pistasDiv.querySelectorAll('.pista-btn');
            btns.forEach((btn, i) => {
                if (i === data.pistaIndex) {
                    btn.textContent = data.pistaTexto;
                    btn.disabled = true;
                    btn.style.background = '#d1fae5';
                    btn.style.borderColor = '#10b981';
                    btn.style.cursor = 'default';
                }
            });
        }
        
        const playerPistasDiv = document.getElementById('player-modal-pistas');
        if (playerPistasDiv) {
            const btns = playerPistasDiv.querySelectorAll('.pista-btn');
            btns.forEach((btn, i) => {
                if (i === data.pistaIndex) {
                    btn.textContent = data.pistaTexto;
                    btn.disabled = true;
                    btn.style.background = '#d1fae5';
                    btn.style.borderColor = '#10b981';
                    btn.style.cursor = 'default';
                }
            });
        }
        
        const valor = data.valorPregunta || 1;
        const puntos = Math.round((data.puntosBase || 0) * valor);
        
        let valorEl = document.getElementById('player-modal-valor');
        if (valorEl) {
            const porcentaje = valor * 100;
            valorEl.textContent = `💎 Valor: ${porcentaje}% de ${data.puntosBase || 0}pts = ${puntos}pts`;
            valorEl.style.display = 'block';
        }
        
        let hostValorEl = document.getElementById('modal-valor-pregunta');
        if (hostValorEl) {
            const porcentaje = valor * 100;
            hostValorEl.textContent = `💎 Valor: ${porcentaje}% de ${data.puntosBase || 0}pts = ${puntos}pts`;
            hostValorEl.style.display = 'block';
        }
        
        this.showToast(`🔓 Pista revelada! Valor: ${valor * 100}%`);
    }

    editTrivia() {
    if (!this.isHost) return;
    this.editMode = 'questions';
    this.showQuestionsScreen();
    this.showToast('✏️ Editando trivia - puedes modificar categorías, preguntas y respuestas');
}

showPointsAnimation(playerName, playerEmoji, points, isCorrect) {
    // Crear el elemento de animación
    const anim = document.createElement('div');
    anim.className = 'points-animation';
    anim.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${isCorrect ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)'};
        color: white;
        padding: 20px 40px;
        border-radius: 16px;
        font-size: 2rem;
        font-weight: 700;
        text-align: center;
        z-index: 2000;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: pointsAppear 0.5s ease forwards;
        pointer-events: none;
    `;
    
    const sign = points > 0 ? '+' : '';
    const emoji = isCorrect ? '🎉' : '😢';
    
    anim.innerHTML = `
        <div style="font-size: 1.2rem; margin-bottom: 4px;">${playerEmoji || ''} ${playerName}</div>
        <div style="font-size: 2.5rem; ${isCorrect ? '' : 'color: #ffcccc;'}">
            ${sign}${points} pts ${emoji}
        </div>
    `;
    
    document.body.appendChild(anim);
    
    // [NUEVO] Broadcast de la animación para todos los jugadores
    if (this.isHost) {
        this.broadcast({
            type: 'points-animation',
            playerName: playerName,
            playerEmoji: playerEmoji || '',
            points: points,
            isCorrect: isCorrect
        });
    }
    
    // Encontrar el elemento del jugador en la barra
    const playersBar = document.getElementById('players-bar');
    if (playersBar) {
        const playerElements = playersBar.querySelectorAll('.player-score');
        let targetElement = null;
        playerElements.forEach(el => {
            if (el.textContent.includes(playerName)) {
                targetElement = el;
            }
        });
        
        if (targetElement) {
            const targetRect = targetElement.getBoundingClientRect();
            const animRect = anim.getBoundingClientRect();
            
            const deltaX = targetRect.left + targetRect.width/2 - animRect.left - animRect.width/2;
            const deltaY = targetRect.top + targetRect.height/2 - animRect.top - animRect.height/2;
            
            setTimeout(() => {
                anim.style.transition = 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)';
                anim.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.2)`;
                anim.style.opacity = '0.5';
                
                targetElement.style.transition = 'all 0.3s ease';
                targetElement.style.transform = 'scale(1.2)';
                targetElement.style.boxShadow = `0 0 30px ${isCorrect ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'}`;
                
                setTimeout(() => {
                    targetElement.style.transform = '';
                    targetElement.style.boxShadow = '';
                }, 800);
            }, 600);
        }
    }
    
    setTimeout(() => {
        anim.style.transition = 'opacity 0.5s ease';
        anim.style.opacity = '0';
        setTimeout(() => {
            if (anim.parentNode) anim.remove();
        }, 500);
    }, 2500);
}

// [NUEVO] Manejar animación de puntos para jugadores
handlePointsAnimation(data) {
    const anim = document.createElement('div');
    anim.className = 'points-animation';
    anim.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: ${data.isCorrect ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)'};
        color: white;
        padding: 20px 40px;
        border-radius: 16px;
        font-size: 2rem;
        font-weight: 700;
        text-align: center;
        z-index: 2000;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: pointsAppear 0.5s ease forwards;
        pointer-events: none;
    `;
    
    const sign = data.points > 0 ? '+' : '';
    const emoji = data.isCorrect ? '🎉' : '😢';
    
    anim.innerHTML = `
        <div style="font-size: 1.2rem; margin-bottom: 4px;">${data.playerEmoji || ''} ${data.playerName}</div>
        <div style="font-size: 2.5rem; ${data.isCorrect ? '' : 'color: #ffcccc;'}">
            ${sign}${data.points} pts ${emoji}
        </div>
    `;
    
    document.body.appendChild(anim);
    
    // Encontrar el elemento del jugador
    const playersBar = document.getElementById('players-bar');
    if (playersBar) {
        const playerElements = playersBar.querySelectorAll('.player-score');
        let targetElement = null;
        playerElements.forEach(el => {
            if (el.textContent.includes(data.playerName)) {
                targetElement = el;
            }
        });
        
        if (targetElement) {
            const targetRect = targetElement.getBoundingClientRect();
            const animRect = anim.getBoundingClientRect();
            
            const deltaX = targetRect.left + targetRect.width/2 - animRect.left - animRect.width/2;
            const deltaY = targetRect.top + targetRect.height/2 - animRect.top - animRect.height/2;
            
            setTimeout(() => {
                anim.style.transition = 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)';
                anim.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.2)`;
                anim.style.opacity = '0.5';
                
                targetElement.style.transition = 'all 0.3s ease';
                targetElement.style.transform = 'scale(1.2)';
                targetElement.style.boxShadow = `0 0 30px ${data.isCorrect ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'}`;
                
                setTimeout(() => {
                    targetElement.style.transform = '';
                    targetElement.style.boxShadow = '';
                }, 800);
            }, 600);
        }
    }
    
    setTimeout(() => {
        anim.style.transition = 'opacity 0.5s ease';
        anim.style.opacity = '0';
        setTimeout(() => {
            if (anim.parentNode) anim.remove();
        }, 500);
    }, 2500);
}

rebuildQuestions() {
    const newQuestions = [];
    let id = 0;
    this.categories.forEach(cat => {
        for (let i = 0; i < this.questionsPerCategory; i++) {
            const points = (i + 1) * 100;
            const existing = this.questions.find(q => q.category === cat && q.points === points);
            if (existing) {
                existing.id = id;
                newQuestions.push(existing);
            } else {
                newQuestions.push({
                    id,
                    category: cat,
                    points: points,
                    question: '',
                    answer: '',
                    used: false,
                    type: 'text',
                    options: ['', ''],
                    pistas: ['', '', '']
                });
            }
            id++;
        }
    });
    this.questions = newQuestions;
}
}

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromQR = urlParams.get('room');
    window.game = new JeopardyGame(roomFromQR);
    
    // Mostrar versión
    updateVersionDisplay();
    
    // Log de versión en consola
    console.log(`📦 Jeopardy Trivia v${APP_VERSION}`);
    console.log('📝 Historial de cambios:');
    Object.entries(VERSION_HISTORY).forEach(([v, desc]) => {
        console.log(`  v${v}: ${desc}`);
    });
});
