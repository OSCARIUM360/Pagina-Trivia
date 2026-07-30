document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromQR = urlParams.get('room');
    window.game = new JeopardyGame(roomFromQR);
});

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
        this.questionJumped = false;
        this.originalPlayer = 0;
        this.playerAnswer = null;
        this.availableEmojis = this.getEmojiList();

        this.setupMusic();
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
            animals: ['🐶','🐺','🦁','🐭','🐰','🐼','🐻','🦉','🐧','🦄','🐸','🐒','🦑','🪼','🐦‍🔥','🦩','🐦‍⬛','🦀','🦈','🐳'],
            food: ['🍕','🍔','🥚','🍿','🌮','🥩','🥠','🧀','🥗','🍩','🍰','🍭','🍫','🍼','🍾','🍵','🍺','🥞','🍷','🧋'],
            nature: ['🍒','🥭','🍓','🍋','🥝','🥥','🍇','🍉','🍍','🍌','🌷','🌹','🪻','🌳','🍃','🌵','🌻','🍁','🌲','🍀']
        };
    }

    getAllEmojis() {
        const lists = this.availableEmojis;
        return [...lists.animals, ...lists.food, ...lists.nature];
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
            nature: document.getElementById('emoji-nature')
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
        if (this.bgMusic) { this.bgMusic.pause(); this.bgMusic.currentTime = 0; }
        if (this.gameMusic) this.gameMusic.play().catch(() => {});
        this.musicPlaying = true;
        this.updateMusicButton();
    }

    stopGameMusic() {
        if (this.gameMusic) { this.gameMusic.pause(); this.gameMusic.currentTime = 0; }
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
            categories: this.categories, questions: this.questions, players: this.players,
            currentPlayer: this.currentPlayer, totalCategories: this.totalCategories,
            questionsPerCategory: this.questionsPerCategory, gameStarted: this.gameStarted,
            isHost: this.isHost, roomCode: this.roomCode, currentScreen: this.getCurrentScreen(),
            jumpEnabled: this.jumpEnabled, hardMode: this.hardMode, textualMode: this.textualMode
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
            this.joinedNames = new Set(this.players.map(p => p.name));
            this.initPeer(this.roomCode + '-host');
            if (state.currentScreen) {
                this.showScreen(state.currentScreen);
                if (state.currentScreen === 'lobby-screen') { this.updateLobby(); this.updateOptionsUI(); }
                else if (state.currentScreen === 'game-screen') { this.renderBoard(); this.startGameMusic(); }
                else if (state.currentScreen === 'categories-screen') this.showCategoriesScreen();
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
        this.onClick('create-board', () => { this.createBoard(); this.playSound('click'); });
        this.onClick('back-to-setup', () => { this.showScreen('setup-screen'); this.saveState(); this.playSound('click'); });
        this.onClick('submit-categories', () => { this.submitCategories(); this.playSound('click'); });
        this.onClick('back-to-categories', () => { this.showCategoriesScreen(); this.saveState(); this.playSound('click'); });
        this.onClick('submit-questions', () => { this.submitQuestions(); this.playSound('click'); });
        this.onClick('back-to-questions', () => { this.showScreen('questions-screen'); this.saveState(); this.playSound('click'); });
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
        
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.addEventListener('click', () => { this.closeModal(); this.playSound('click'); });
        
        const jumpCheck = document.getElementById('option-jump');
        const hardCheck = document.getElementById('option-hard');
        const textualCheck = document.getElementById('option-textual');
        if (jumpCheck) jumpCheck.addEventListener('change', () => { this.jumpEnabled = jumpCheck.checked; this.saveState(); this.playSound('toggle'); });
        if (hardCheck) hardCheck.addEventListener('change', () => { this.hardMode = hardCheck.checked; this.saveState(); this.playSound('toggle'); });
        if (textualCheck) textualCheck.addEventListener('change', () => { this.textualMode = textualCheck.checked; this.saveState(); this.playSound('toggle'); });
        
        const roomInput = document.getElementById('room-code');
        const nameInput = document.getElementById('join-player-name');
        if (roomInput && nameInput) {
            roomInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') nameInput.focus(); });
            nameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.joinRoom(); });
        }
        
        // Enviar respuesta con Enter en modo textual
        const answerInput = document.getElementById('player-answer-input');
        if (answerInput) {
            answerInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.sendPlayerAnswer(); });
        }
        
        window.addEventListener('beforeunload', () => { if (this.isHost && this.roomCode) this.saveState(); });
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
        if (jumpCheck) jumpCheck.checked = this.jumpEnabled;
        if (hardCheck) hardCheck.checked = this.hardMode;
        if (textualCheck) textualCheck.checked = this.textualMode;
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
        this.clearState(); this.isHost = true; this.roomCode = this.generateRoomCode();
        this.players = [{ name: 'Host', score: 0, id: 'host', isHost: true, emoji: '👑' }];
        this.joinedNames = new Set(['Host']);
        this.initPeer(this.roomCode + '-host'); this.showScreen('setup-screen'); this.saveState();
    }

    joinRoom() {
        const code = document.getElementById('room-code').value.trim().toUpperCase();
        const name = document.getElementById('join-player-name').value.trim();
        if (!name) return alert('Ingresa tu nombre');
        if (!code || code.length !== 6) return alert('El código debe tener 6 caracteres');
        const btn = document.getElementById('join-room-submit');
        btn.disabled = true; btn.textContent = 'Conectando...';
        this.roomCode = code; this.isHost = false; this.playerName = name;
        sessionStorage.setItem('jeopardy-player-code', code);
        sessionStorage.setItem('jeopardy-player-name', name);
        sessionStorage.setItem('jeopardy-player-emoji', this.playerEmoji);
        this.initPeer(code + '-player-' + Date.now());
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
                    this.jumpEnabled = data.jumpEnabled || false; this.hardMode = data.hardMode || false; this.textualMode = data.textualMode || false;
                    this.updateLobby();
                    if (data.gameStarted) { this.loadGameState(data); this.renderBoard(); this.showScreen('game-screen'); this.startGameMusic(); }
                    else this.showLobby();
                    const btn = document.getElementById('join-room-submit'); if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
                    if (window.location.search) window.history.replaceState({}, '', window.location.pathname);
                    this.playSound('join'); break;
                case 'players-update': this.players = data.players; this.updateLobby(); break;
                case 'game-start': this.loadGameState(data); this.renderBoard(); this.showScreen('game-screen'); this.startGameMusic(); break;
                case 'game-update': this.applyGameUpdate(data); break;
                case 'question-selected': this.showQuestionForPlayers(data); break;
                case 'question-assigned': this.handleQuestionAssigned(data); break;
                case 'answer-result': this.showAnswerForPlayers(data); break;
                case 'jump-notification': this.showJumpNotification(data); break;
                case 'close-modal': document.getElementById('question-modal').classList.remove('active'); document.getElementById('player-answer-modal').classList.remove('active'); break;
                case 'game-end': this.players = data.players; this.gameStarted = false; document.getElementById('question-modal').classList.remove('active'); document.getElementById('player-answer-modal').classList.remove('active'); this.stopGameMusic(); this.showResults(); this.playSound('win'); break;
                case 'kicked': this.disconnect(); break;
                case 'player-turn': this.handlePlayerTurn(data); break;
            }
        } else {
            if (data.type === 'join-request') this.handleJoinRequest(conn, data);
            else if (data.type === 'leave-request') this.handleLeaveRequest(conn, data);
            else if (data.type === 'player-select-question') this.handlePlayerSelectQuestion(conn, data);
            else if (data.type === 'player-answer') this.handlePlayerAnswer(conn, data);
        }
    }

    handleJoinRequest(conn, data) {
        const name = data.name?.trim(); const emoji = data.emoji || '';
        if (!name) return;
        if (this.joinedNames.has(name)) { conn.send({ type: 'error', message: 'Nombre ya en uso' }); return; }
        if (this.gameStarted) { conn.send({ type: 'error', message: 'Juego en curso' }); return; }
        this.players.push({ name, score: 0, id: conn.peer, isHost: false, emoji });
        this.joinedNames.add(name); conn.metadata = { name, emoji };
        conn.send({ type: 'join-accepted', players: this.players });
        this.broadcastPlayers(); this.updateLobby(); this.saveState(); this.playSound('join');
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
        
        // Marcar la pregunta en el tablero del host
        const q = this.questions.find(q => q.id === data.questionId && !q.used);
        if (q) {
            this.broadcast({ type: 'question-assigned', questionId: q.id, category: q.category, points: q.points });
            // Destacar la celda en el tablero del host
            this.highlightCell(q);
        }
    }
    
    highlightCell(q) {
        const cells = document.querySelectorAll('.game-cell.clickable');
        cells.forEach(cell => {
            const points = parseInt(cell.textContent);
            const row = Math.floor([...cell.parentElement.children].indexOf(cell) / (this.totalCategories + 1));
            // Buscar la celda correcta
            if (points === q.points) {
                const categoryIndex = this.categories.indexOf(q.category);
                // Verificar que esta celda corresponde a la categoría correcta
                const board = document.getElementById('game-board');
                const allCells = board.querySelectorAll('.game-cell.clickable');
                allCells.forEach(c => {
                    c.classList.remove('player-selected');
                });
                cell.classList.add('player-selected');
            }
        });
        this.showToast('🎯 Jugador seleccionó: ' + q.category + ' - ' + q.points + 'pts');
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
        document.getElementById('player-answer-status').textContent = '✅ Respuesta enviada. Esperando veredicto...';
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
        this.categories = data.categories || []; this.questions = data.questions || [];
        this.players = data.players || []; this.totalCategories = data.totalCategories || 0;
        this.questionsPerCategory = data.questionsPerCategory || 0; this.currentPlayer = data.currentPlayer || 0;
        this.gameStarted = true; this.jumpEnabled = data.jumpEnabled || false;
        this.hardMode = data.hardMode || false; this.textualMode = data.textualMode || false;
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
        const container = document.getElementById('category-inputs'); container.innerHTML = '';
        for (let i = 0; i < this.totalCategories; i++) {
            const div = document.createElement('div'); div.className = 'category-input';
            div.innerHTML = `<label>Categoría ${i + 1}</label><input type="text" class="category-name" placeholder="Ej: Ciencia" value="${this.categories[i] || ''}">`;
            container.appendChild(div);
        }
        this.showScreen('categories-screen');
    }

    submitCategories() {
        if (!this.isHost) return;
        const inputs = document.querySelectorAll('.category-name'); this.categories = []; let valid = true;
        inputs.forEach((input, i) => { const name = input.value.trim(); if (!name) { alert(`Nombre para Categoría ${i + 1}`); valid = false; } this.categories.push(name); });
        if (valid) { this.showQuestionsScreen(); this.saveState(); }
    }

    showQuestionsScreen() {
    if (!this.isHost) return;
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    const existingQuestions = [...this.questions];
    this.questions = [];
    let id = 0;
    
    this.categories.forEach(cat => {
        for (let i = 0; i < this.questionsPerCategory; i++) {
            const existing = existingQuestions.find(q => q.category === cat && q.points === (i + 1) * 100);
            const q = existing || { 
                id, 
                category: cat, 
                points: (i + 1) * 100, 
                question: '', 
                answer: '', 
                used: false, 
                type: 'text', 
                options: ['', '', '', ''] 
            };
            q.id = id;
            // Asegurar que options existe
            if (!q.options || !Array.isArray(q.options)) {
                q.options = ['', '', '', ''];
            }
            this.questions.push(q);
            
            const div = document.createElement('div');
            div.className = 'question-row';
            div.setAttribute('data-qid', id);
            
            // Determinar clases según tipo
            const isAnagram = q.type === 'anagram';
            const isOptions = q.type === 'options';
            
            div.innerHTML = `
                <h3>${cat} — ${q.points} pts</h3>
                <div class="question-type-selector">
                    <select class="q-type" data-id="${id}">
                        <option value="text" ${q.type === 'text' ? 'selected' : ''}>📝 Texto</option>
                        <option value="options" ${q.type === 'options' ? 'selected' : ''}>🔤 Opción múltiple</option>
                        <option value="anagram" ${q.type === 'anagram' ? 'selected' : ''}>🔀 Anagrama</option>
                    </select>
                </div>
                <div class="question-inputs">
                    <textarea class="q-input" placeholder="Escribe la pregunta aquí" data-id="${id}" style="${isAnagram ? 'display:none;' : ''}">${q.question || ''}</textarea>
                    <textarea class="a-input" placeholder="${isAnagram ? 'Palabra para anagrama' : 'Escribe la respuesta correcta'}" data-id="${id}" style="${isOptions ? 'display:none;' : ''}">${q.answer || ''}</textarea>
                </div>
                <div class="options-container" data-id="${id}" style="${isOptions ? '' : 'display:none;'}">
                    <p class="hint">Opciones (máx 4). La primera es la correcta.</p>
                    <div class="options-list" data-id="${id}">
                        ${(q.options || ['', '', '', '']).slice(0, 4).map((opt, oi) => `
                            <div class="options-input-row">
                                <span style="font-weight:600;width:20px;">${String.fromCharCode(65 + oi)})</span>
                                <input type="text" class="opt-input" placeholder="Opción ${oi + 1}" value="${opt || ''}" data-qid="${id}" data-oidx="${oi}">
                                ${oi > 0 ? `<button class="remove-option" data-qid="${id}" data-oidx="${oi}">×</button>` : ''}
                            </div>
                        `).join('')}
                    </div>
                    ${(q.options || []).length < 4 ? `<button class="btn btn-sm btn-text add-option" data-id="${id}">+ Agregar opción</button>` : ''}
                </div>`;
            container.appendChild(div);
            
            // Eventos después de agregar al DOM
            setTimeout(() => {
                const typeSelect = div.querySelector('.q-type');
                const optionsContainer = div.querySelector('.options-container');
                const qInput = div.querySelector('.q-input');
                const aInput = div.querySelector('.a-input');
                
                if (typeSelect) {
                   typeSelect.addEventListener('change', () => {
                        const qObj = this.questions.find(q => q.id === id);
                        if (qObj) qObj.type = typeSelect.value;
                        
                        const isAnagramNow = typeSelect.value === 'anagram';
                        const isOptionsNow = typeSelect.value === 'options';
                        
                        // Mostrar/ocultar pregunta
                        if (qInput) qInput.style.display = isAnagramNow ? 'none' : '';
                        
                        // Mostrar/ocultar respuesta (ocultar en opción múltiple)
                        if (aInput) {
                            aInput.style.display = isOptionsNow ? 'none' : '';
                            aInput.placeholder = isAnagramNow ? 'Palabra para anagrama' : 'Escribe la respuesta correcta';
                        }
                        
                        // Mostrar/ocultar opciones
                        if (optionsContainer) {
                            optionsContainer.style.display = isOptionsNow ? '' : 'none';
                        }
                        
                        // Inicializar opciones si es opción múltiple
                        if (isOptionsNow && qObj && (!qObj.options || qObj.options.length === 0)) {
                            qObj.options = ['', '', '', ''];
                            this.refreshOptionsList(div, id);
                        }
                        
                        this.playSound('click');
                    });
                }
                
                // Evento para agregar opción
                const addBtn = div.querySelector('.add-option');
                if (addBtn) {
                    addBtn.addEventListener('click', () => {
                        const qObj = this.questions.find(q => q.id === id);
                        if (qObj && qObj.options && qObj.options.length < 4) {
                            qObj.options.push('');
                            this.refreshOptionsList(div, id);
                            this.playSound('click');
                        }
                    });
                }
                
                // Eventos para eliminar opción y editar
                div.querySelectorAll('.remove-option').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const qId = parseInt(btn.dataset.qid);
                        const oIdx = parseInt(btn.dataset.oidx);
                        const qObj = this.questions.find(q => q.id === qId);
                        if (qObj && qObj.options && qObj.options.length > 2) {
                            qObj.options.splice(oIdx, 1);
                            this.refreshOptionsList(div, qId);
                            this.playSound('click');
                        }
                    });
                });
                
                div.querySelectorAll('.opt-input').forEach(input => {
                    input.addEventListener('input', () => {
                        const qId = parseInt(input.dataset.qid);
                        const oIdx = parseInt(input.dataset.oidx);
                        const qObj = this.questions.find(q => q.id === qId);
                        if (qObj && qObj.options) {
                            qObj.options[oIdx] = input.value;
                        }
                    });
                });
                
            }, 0);
            id++;
        }
    });
    this.showScreen('questions-screen');
}

    refreshOptionsList(div, qId) {
        const q = this.questions.find(q => q.id === qId);
        if (!q) return;
        const list = div.querySelector('.options-list');
        if (!list) return;
        list.innerHTML = (q.options || []).map((opt, oi) => 
            `<div class="options-input-row"><input type="text" class="opt-input" placeholder="Opción ${oi + 1}" value="${opt}" data-qid="${qId}" data-oidx="${oi}"></div>`
        ).join('');
    }

    submitQuestions() {
    if (!this.isHost) return;
    
    // Guardar tipo de pregunta
    document.querySelectorAll('.q-type').forEach(select => {
        const id = parseInt(select.dataset.id);
        const q = this.questions.find(q => q.id === id);
        if (q) q.type = select.value;
    });
    
    // Guardar preguntas
    document.querySelectorAll('.q-input').forEach(input => {
        const id = parseInt(input.dataset.id);
        const q = this.questions.find(q => q.id === id);
        if (q) q.question = input.value.trim();
    });
    
    // Guardar respuestas
    document.querySelectorAll('.a-input').forEach(input => {
        const id = parseInt(input.dataset.id);
        const q = this.questions.find(q => q.id === id);
        if (q) q.answer = input.value.trim();
    });
    
    // Guardar opciones y establecer respuesta para opción múltiple
    document.querySelectorAll('.options-container').forEach(container => {
        const qId = parseInt(container.dataset.id);
        const q = this.questions.find(q => q.id === qId);
        if (!q) return;
        
        // Recoger opciones de los inputs
        const optInputs = container.querySelectorAll('.opt-input');
        if (optInputs.length > 0 && q.type === 'options') {
            q.options = [];
            optInputs.forEach(input => {
                const val = input.value.trim();
                if (val) q.options.push(val);
            });
            // La respuesta correcta es la primera opción
            if (q.options.length > 0) {
                q.answer = q.options[0];
            }
        }
    });
    
    // También guardar opciones sueltas por si acaso
    document.querySelectorAll('.opt-input').forEach(input => {
        const qId = parseInt(input.dataset.qid);
        const oIdx = parseInt(input.dataset.oidx);
        const q = this.questions.find(q => q.id === qId);
        if (q && q.options && q.type === 'options') {
            q.options[oIdx] = input.value.trim();
            // Asegurar que answer sea la primera opción
            if (oIdx === 0 && input.value.trim()) {
                q.answer = input.value.trim();
            }
        }
    });
    
    // Validar
    let valid = true;
    for (const q of this.questions) {
        console.log('Validando pregunta:', q.id, 'tipo:', q.type, 'pregunta:', q.question, 'respuesta:', q.answer, 'opciones:', q.options);
        
        if (q.type === 'anagram') {
            if (!q.answer || !q.answer.trim()) {
                alert(`Falta la palabra para el anagrama: ${q.category} ${q.points}pts`);
                valid = false;
                break;
            }
            if (!q.question || !q.question.trim()) {
                q.question = 'Ordena las letras para formar la palabra correcta';
            }
        } else if (q.type === 'options') {
            if (!q.question || !q.question.trim()) {
                alert(`Falta la pregunta: ${q.category} ${q.points}pts`);
                valid = false;
                break;
            }
            
            // Asegurar que options existe
            if (!q.options || !Array.isArray(q.options)) {
                q.options = [];
            }
            
            // Filtrar opciones vacías
            q.options = q.options.filter(o => o && o.trim());
            
            if (q.options.length < 2) {
                alert(`Opción múltiple necesita al menos 2 opciones: ${q.category} ${q.points}pts\nOpciones encontradas: ${q.options.length}`);
                valid = false;
                break;
            }
            
            // La respuesta correcta es la primera opción
            q.answer = q.options[0].trim();
            console.log('Opción múltiple - respuesta establecida:', q.answer);
            
        } else {
            // Texto normal
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
        console.log('Validación exitosa, preguntas:', this.questions);
        this.showLobby();
        this.saveState();
    }
}

    exportTrivia() {
    if (!this.isHost) return;
    
    // Actualizar preguntas desde los inputs
    const qInputs = document.querySelectorAll('.q-input');
    const aInputs = document.querySelectorAll('.a-input');
    
    qInputs.forEach(input => {
        const id = parseInt(input.dataset.id);
        const q = this.questions.find(q => q.id === id);
        if (q) q.question = input.value.trim();
    });
    
    aInputs.forEach(input => {
        const id = parseInt(input.dataset.id);
        const q = this.questions.find(q => q.id === id);
        if (q) q.answer = input.value.trim();
    });
    
    // Guardar opciones
    document.querySelectorAll('.opt-input').forEach(input => {
        const qId = parseInt(input.dataset.qid);
        const oIdx = parseInt(input.dataset.oidx);
        const q = this.questions.find(q => q.id === qId);
        if (q && q.options) q.options[oIdx] = input.value.trim();
    });
    
    if (this.questions.length === 0) return alert('Primero crea las preguntas');
    
    // Validar que todas tengan datos
    for (const q of this.questions) {
        if (q.type === 'anagram') {
            if (!q.answer || !q.answer.trim()) return alert(`Falta la palabra del anagrama: ${q.category} ${q.points}pts`);
        } else if (q.type === 'options') {
            if (!q.question || !q.question.trim()) return alert(`Falta la pregunta: ${q.category} ${q.points}pts`);
            const filledOpts = (q.options || []).filter(o => o && o.trim());
            if (filledOpts.length < 2) return alert(`Faltan opciones: ${q.category} ${q.points}pts`);
        } else {
            if (!q.question || !q.question.trim()) return alert(`Falta la pregunta: ${q.category} ${q.points}pts`);
            if (!q.answer || !q.answer.trim()) return alert(`Falta la respuesta: ${q.category} ${q.points}pts`);
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
            opts: q.options || []
        }))
    };
    
    const jsonStr = JSON.stringify(data);
    const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
    const code = 'JPTV' + base64;
    
    this.copyToClipboard(code);
    this.showToast('✅ ¡Código copiado!');
}

    importTrivia() {
        const codeInput = document.getElementById('trivia-code-input'); const code = codeInput.value.trim();
        if (!code) return alert('Pega el código'); if (!code.startsWith('JPTV')) return alert('Código inválido');
        try {
            const jsonStr = decodeURIComponent(escape(atob(code.substring(4)))); const data = JSON.parse(jsonStr);
            const categories = data.c || data.categories; const qpc = data.qpc || data.questionsPerCategory;
            const questions = data.q.map(q => ({ category: q.cat || q.category, points: q.pts || q.points, question: q.q || q.question, answer: q.a || q.answer, type: q.t || 'text', options: q.opts || q.options || [] }));
            this.clearState(); this.isHost = true; this.categories = categories; this.totalCategories = categories.length; this.questionsPerCategory = qpc;
            this.questions = questions.map((q, i) => ({ id: i, ...q, used: false }));
            this.roomCode = this.generateRoomCode(); this.players = [{ name: 'Host', score: 0, id: 'host', isHost: true, emoji: '👑' }];
            this.joinedNames = new Set(['Host']); this.gameStarted = false;
            document.getElementById('load-trivia-form').classList.add('hidden'); codeInput.value = '';
            this.initPeer(this.roomCode + '-host'); this.showLobby(); this.saveState();
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
        const container = document.getElementById('lobby-players-list'); if (!container) return; container.innerHTML = '';
        this.players.forEach((p, i) => {
            const tag = document.createElement('div'); tag.className = 'player-tag' + (p.isHost ? ' host' : '');
            tag.innerHTML = (p.emoji ? p.emoji + ' ' : '') + p.name;
            if (this.isHost && !p.isHost) {
                const kickBtn = document.createElement('button'); kickBtn.className = 'kick-btn'; kickBtn.innerHTML = '×';
                kickBtn.title = 'Expulsar'; kickBtn.addEventListener('click', (e) => { e.stopPropagation(); this.kickPlayer(i); });
                tag.appendChild(kickBtn);
            }
            container.appendChild(tag);
        });
    }

    startGame() {
        if (!this.isHost) return;
        if (this.players.filter(p => !p.isHost).length < 1) return alert('Mínimo 1 jugador');
        this.gameStarted = true;
        this.currentPlayer = this.players.findIndex(p => !p.isHost);
        if (this.currentPlayer < 0) this.currentPlayer = 0;
        
        // Enviar preguntas sin respuestas a jugadores
        const safeQuestions = this.questions.map(q => ({ ...q, answer: '' }));
        
        this.broadcast({ type: 'game-start', categories: this.categories, questions: safeQuestions, players: this.players, totalCategories: this.totalCategories, questionsPerCategory: this.questionsPerCategory, currentPlayer: this.currentPlayer, jumpEnabled: this.jumpEnabled, hardMode: this.hardMode, textualMode: this.textualMode });
        
        this.renderBoard(); this.showScreen('game-screen'); this.startGameMusic(); this.saveState();
        
        // En modo textual, notificar al jugador actual
        if (this.textualMode) {
            this.broadcast({ type: 'player-turn', currentPlayer: this.currentPlayer, playerName: this.players[this.currentPlayer].name });
        }
    }

    renderBoard() {
        const board = document.getElementById('game-board'); if (!board) return; board.innerHTML = '';
        board.style.gridTemplateColumns = `repeat(${this.totalCategories + 1}, 1fr)`;
        const ph = document.createElement('div'); ph.className = 'game-cell category'; ph.textContent = 'Pts'; board.appendChild(ph);
        this.categories.forEach(cat => { const h = document.createElement('div'); h.className = 'game-cell category'; h.textContent = cat; board.appendChild(h); });
        
        for (let i = 0; i < this.questionsPerCategory; i++) {
            const pc = document.createElement('div'); pc.className = 'game-cell category'; pc.textContent = (i + 1) * 100; board.appendChild(pc);
            this.categories.forEach(cat => {
                const q = this.questions.find(q => q.category === cat && q.points === (i + 1) * 100);
                const cell = document.createElement('div');
                cell.className = `game-cell ${q?.used ? 'used' : 'clickable'}`;
                cell.textContent = q?.used ? '✓' : (i + 1) * 100;
                cell.dataset.questionId = q?.id;
                cell.dataset.category = cat;
                cell.dataset.points = (i + 1) * 100;
                
                if (!q?.used) {
                    if (this.isHost) {
                        cell.addEventListener('click', () => this.selectQuestion(q));
                    } else if (this.textualMode) {
                        // En modo textual, los jugadores pueden seleccionar preguntas
                        cell.addEventListener('click', () => {
                            if (this.isHost) return;
                            const myIndex = this.players.findIndex(p => p.name === this.playerName);
                            if (myIndex === this.currentPlayer && this.connections.length > 0) {
                                this.connections[0].send({ type: 'player-select-question', questionId: q.id });
                                cell.classList.add('player-selected');
                                this.showToast('📤 Solicitando: ' + q.category + ' - ' + q.points + 'pts');
                            }
                        });
                    }
                }
                board.appendChild(cell);
            });
        }
        
        this.renderPlayers(); this.updateTurnIndicator();
    }

    renderPlayers() {
        const bar = document.getElementById('players-bar'); if (!bar) return; bar.innerHTML = '';
        const gamePlayers = this.players.filter(p => !p.isHost);
        gamePlayers.forEach((p) => {
            const originalIndex = this.players.indexOf(p);
            const div = document.createElement('div');
            div.className = `player-score ${originalIndex === this.currentPlayer ? 'active' : ''}`;
            div.innerHTML = `<strong>${p.emoji ? p.emoji + ' ' : ''}${p.name}</strong><br>${p.score} pts`;
            if (this.isHost) {
                div.style.cursor = 'pointer';
                div.addEventListener('click', () => {
                    if (!document.getElementById('question-modal').classList.contains('active')) {
                        this.currentPlayer = originalIndex; this.renderBoard();
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
    
    // Limpiar modal
    document.getElementById('modal-category').textContent = `${q.category} — ${q.points} pts`;
    document.getElementById('modal-question').textContent = q.question || 'Ordena las letras para formar la palabra correcta';
    document.getElementById('modal-answer').classList.add('hidden');
    document.getElementById('player-answer-section').classList.add('hidden');
    document.getElementById('modal-options').classList.add('hidden');
    document.getElementById('modal-anagram').classList.add('hidden');
    
    // Tipo de pregunta
    const typeBadge = document.getElementById('modal-question-type');
    typeBadge.classList.remove('hidden', 'anagram', 'options');
    
    if (q.type === 'options') {
        typeBadge.textContent = '🔤 Opción múltiple';
        typeBadge.classList.add('options');
        
        // Mostrar opciones como botones clickeables para el host
        const optionsDiv = document.getElementById('modal-options');
        optionsDiv.classList.remove('hidden');
        const validOptions = (q.options || []).filter(opt => opt && opt.trim());
        const shuffled = [...validOptions].sort(() => Math.random() - 0.5);
        optionsDiv.innerHTML = shuffled.map((opt, i) => 
            `<button class="option-btn host-option-btn" data-option="${this.escapeHtml(opt)}">${String.fromCharCode(65 + i)}) ${opt}</button>`
        ).join('');
        
        // Eventos para que el host pueda elegir opción
        optionsDiv.querySelectorAll('.host-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const selectedOption = btn.dataset.option;
                const isCorrect = selectedOption.trim().toLowerCase() === q.answer.trim().toLowerCase();
                console.log('Host eligió:', selectedOption, 'Correcta:', q.answer, 'Acierto:', isCorrect);
                this.handleOptionChoice(isCorrect, selectedOption);
            });
        });
        
        // Ocultar botones de correcto/incorrecto
        document.getElementById('answer-buttons').style.display = 'none';
        document.getElementById('btn-correct').style.display = 'none';
        document.getElementById('btn-incorrect').style.display = 'none';
        document.getElementById('btn-jump').classList.add('hidden');
        
    } else if (q.type === 'anagram') {
        typeBadge.textContent = '🔀 Anagrama';
        typeBadge.classList.add('anagram');
        
        // Mostrar anagrama
        const anagramDiv = document.getElementById('modal-anagram');
        anagramDiv.classList.remove('hidden');
        const letters = q.answer.split('').sort(() => Math.random() - 0.5);
        anagramDiv.innerHTML = letters.map(l => `<div class="anagram-letter">${l}</div>`).join('');
        
        // Mostrar botones normales
        document.getElementById('answer-buttons').style.display = 'flex';
        document.getElementById('btn-correct').style.display = 'inline-flex';
        document.getElementById('btn-incorrect').style.display = 'inline-flex';
        const jumpBtn = document.getElementById('btn-jump');
        if (jumpBtn) jumpBtn.classList.toggle('hidden', !this.jumpEnabled);
        
    } else {
        // Texto normal
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
    
    // Broadcast a jugadores
    const broadcastData = {
        type: 'question-selected',
        category: q.category,
        points: q.points,
        question: q.question || 'Ordena las letras para formar la palabra correcta',
        qType: q.type || 'text',
        options: q.options || [],
        currentPlayer: this.currentPlayer
    };
    
    if (q.type === 'anagram' && q.answer) {
        broadcastData.anagramLetters = q.answer.split('').sort(() => Math.random() - 0.5);
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
    
    const questionType = data.qType || data.type || 'text';
    
    const typeBadge = document.getElementById('modal-question-type');
    typeBadge.classList.remove('hidden', 'anagram', 'options');
    
    if (questionType === 'options') {
        typeBadge.textContent = '🔤 Opción múltiple';
        typeBadge.classList.add('options');
        
        const optionsDiv = document.getElementById('modal-options');
        optionsDiv.classList.remove('hidden');
        const validOptions = (data.options || []).filter(opt => opt && opt.trim());
        const shuffled = [...validOptions].sort(() => Math.random() - 0.5);
        // Solo mostrar, no clickeables para jugadores
        optionsDiv.innerHTML = shuffled.map((opt, i) => 
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
    } else {
        typeBadge.classList.add('hidden');
    }
    
    document.getElementById('answer-buttons').style.display = 'none';
    document.getElementById('btn-jump').classList.add('hidden');
    
    const closeBtn = document.querySelector('#question-modal .close');
    if (closeBtn) closeBtn.style.display = 'none';
    
    document.getElementById('question-modal').classList.add('active');
    
    // Modo textual
    if (this.textualMode && !this.isHost) {
        const myIndex = this.players.findIndex(p => p.name === this.playerName);
        if (myIndex === this.currentPlayer) {
            this.showPlayerAnswerModal({
                category: data.category,
                points: data.points,
                question: data.question,
                type: questionType,
                options: data.options,
                anagramLetters: data.anagramLetters
            });
        }
    }
}

    handleQuestionAssigned(data) {
        // El host notifica qué pregunta fue seleccionada por el jugador
        const q = this.questions.find(q => q.id === data.questionId);
        if (q && this.isHost) {
            // Destacar en el tablero
            const cells = document.querySelectorAll('.game-cell.clickable');
            cells.forEach(c => c.classList.remove('player-selected'));
        }
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
    
    // Si es opción múltiple, mostrar opciones clickeables
    if (data.type === 'options' && data.options) {
        const optDiv = document.getElementById('player-modal-options');
        optDiv.classList.remove('hidden');
        const validOptions = data.options.filter(opt => opt && opt.trim());
        const shuffled = [...validOptions].sort(() => Math.random() - 0.5);
        optDiv.innerHTML = shuffled.map((opt, i) => 
            `<button class="option-btn player-option-btn" data-option="${this.escapeHtml(opt)}">${String.fromCharCode(65 + i)}) ${opt}</button>`
        ).join('');
        
        // Ocultar input de texto
        document.getElementById('player-answer-input').style.display = 'none';
        document.getElementById('btn-send-answer').style.display = 'none';
        
        // Eventos para elegir opción
        optDiv.querySelectorAll('.player-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const chosen = btn.dataset.option;
                document.getElementById('player-answer-input').value = chosen;
                // Auto-enviar
                this.sendPlayerAnswer();
            });
        });
    } else {
        document.getElementById('player-answer-input').style.display = '';
        document.getElementById('btn-send-answer').style.display = '';
    }
    
    // Anagrama
    if (data.type === 'anagram' && data.anagramLetters) {
        const anagramDiv = document.getElementById('player-modal-anagram');
        anagramDiv.classList.remove('hidden');
        anagramDiv.innerHTML = data.anagramLetters.map(l => 
            `<div class="anagram-letter">${l}</div>`
        ).join('');
    }
    
    document.getElementById('player-answer-modal').classList.add('active');
    if (data.type !== 'options') {
        document.getElementById('player-answer-input').focus();
    }
}

    closeModal() {
        if (!this.isHost) return;
        if (this.answerRevealed || !this.currentQuestion) {
            document.getElementById('question-modal').classList.remove('active');
            document.getElementById('player-answer-modal').classList.remove('active');
            this.answerRevealed = false; this.currentQuestion = null; this.questionJumped = false;
            this.broadcast({ type: 'close-modal' });
            if (this.gameStarted && this.questions.every(q => q.used)) this.endGame();
        }
    }

    jumpQuestion() {
        if (!this.isHost || !this.jumpEnabled || !this.currentQuestion || this.answerRevealed) return;
        this.playSound('jump');
        if (this.hardMode && !this.questionJumped) {
            const penalty = Math.floor(this.currentQuestion.points / 2);
            this.players[this.currentPlayer].score -= penalty;
            if (this.players[this.currentPlayer].score < 0) this.players[this.currentPlayer].score = 0;
        }
        let nextPlayer = this.currentPlayer;
        do { nextPlayer = (nextPlayer + 1) % this.players.length; } while (this.players[nextPlayer]?.isHost && this.players.length > 1);
        this.currentPlayer = nextPlayer; this.questionJumped = true;
        this.updateTurnIndicatorModal(); this.updateButtonTexts(); this.renderBoard(); this.updateManualPointsPanel();
        this.broadcast({ type: 'jump-notification', playerName: this.players[this.currentPlayer].name, playerEmoji: this.players[this.currentPlayer].emoji, currentPlayer: this.currentPlayer, players: this.players });
        if (this.textualMode) this.broadcast({ type: 'player-turn', currentPlayer: this.currentPlayer, playerName: this.players[this.currentPlayer].name });
    }

    showJumpNotification(data) {
        if (data.players) this.players = data.players;
        if (data.currentPlayer !== undefined) this.currentPlayer = data.currentPlayer;
        this.renderBoard();
        const ind = document.getElementById('modal-turn-indicator');
        if (ind) { ind.textContent = `⏭ Saltó a: ${data.playerEmoji ? data.playerEmoji + ' ' : ''}${data.playerName}`; ind.classList.remove('jump-animation'); void ind.offsetWidth; ind.classList.add('jump-animation'); }
    }

    handleAnswer(correct) {
        if (!this.isHost || !this.currentQuestion || this.answerRevealed) return;
        this.answerRevealed = true;
        this.playSound(correct ? 'correct' : 'incorrect');
        
        if (correct) this.players[this.currentPlayer].score += this.currentQuestion.points;
        else if (this.hardMode) {
            const penalty = Math.floor(this.currentQuestion.points / 2);
            this.players[this.currentPlayer].score -= penalty;
            if (this.players[this.currentPlayer].score < 0) this.players[this.currentPlayer].score = 0;
        }
        
        const answerDiv = document.getElementById('modal-answer');
        answerDiv.classList.remove('hidden', 'correct-anim', 'incorrect-anim');
        answerDiv.classList.add(correct ? 'correct-anim' : 'incorrect-anim');
        document.getElementById('correct-answer-text').textContent = this.currentQuestion.answer;
        document.getElementById('answer-buttons').style.display = 'none';
        
        const closeBtn = document.querySelector('#question-modal .close');
        if (closeBtn) closeBtn.style.display = 'flex';
        
        this.currentQuestion.used = true;
        
        this.broadcast({ type: 'answer-result', correct, answer: this.currentQuestion.answer, playerName: this.players[this.currentPlayer].name, playerEmoji: this.players[this.currentPlayer].emoji, pointsAwarded: correct ? this.currentQuestion.points : 0, players: this.players, playerAnswer: this.playerAnswer || null });
        this.playerAnswer = null;
        
        do { this.currentPlayer = (this.currentPlayer + 1) % this.players.length; } while (this.players[this.currentPlayer]?.isHost && this.players.length > 1);
        
        this.broadcast({ type: 'game-update', questionId: this.currentQuestion.id, players: this.players, currentPlayer: this.currentPlayer });
        if (this.textualMode) this.broadcast({ type: 'player-turn', currentPlayer: this.currentPlayer, playerName: this.players[this.currentPlayer].name });
        
        this.renderBoard(); this.updateManualPointsPanel(); this.saveState();
        if (this.questions.every(q => q.used)) setTimeout(() => this.endGame(), 1500);
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
        this.clearState(); sessionStorage.removeItem('jeopardy-player-code'); sessionStorage.removeItem('jeopardy-player-name'); sessionStorage.removeItem('jeopardy-player-emoji');
        this.stopGameMusic();
        this.categories = []; this.questions = []; this.players = []; this.connections = []; this.joinedNames = new Set();
        this.currentPlayer = 0; this.gameStarted = false; this.currentQuestion = null; this.answerRevealed = false;
        this.isHost = false; this.roomCode = ''; this.roomFromQR = null; this.jumpEnabled = false; this.hardMode = false;
        this.textualMode = false; this.questionJumped = false; this.playerAnswer = null;
        document.getElementById('question-modal').classList.remove('active');
        document.getElementById('player-answer-modal').classList.remove('active');
        document.getElementById('answer-buttons').style.display = 'flex';
        document.getElementById('join-form').classList.add('hidden'); document.getElementById('load-trivia-form').classList.add('hidden');
        document.querySelector('.home-actions').style.display = 'flex'; document.querySelector('.trivia-actions').style.display = 'flex';
        const btn = document.getElementById('join-room-submit'); if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        const codeInput = document.getElementById('room-code'); if (codeInput) { codeInput.disabled = false; codeInput.value = ''; }
        const triviaInput = document.getElementById('trivia-code-input'); if (triviaInput) triviaInput.value = '';
        const confetti = document.getElementById('confetti'); if (confetti) confetti.innerHTML = '';
        const closeBtn = document.querySelector('#question-modal .close'); if (closeBtn) closeBtn.style.display = 'flex';
        if (window.location.search) window.history.replaceState({}, '', window.location.pathname);
        this.showScreen('home-screen');
    }

    handleOptionChoice(isCorrect, selectedOption) {
    if (!this.isHost || !this.currentQuestion || this.answerRevealed) return;
    
    this.answerRevealed = true;
    this.playSound(isCorrect ? 'correct' : 'incorrect');
    
    // Sumar o restar puntos
    if (isCorrect) {
        this.players[this.currentPlayer].score += this.currentQuestion.points;
    } else if (this.hardMode) {
        const penalty = Math.floor(this.currentQuestion.points / 2);
        this.players[this.currentPlayer].score -= penalty;
        if (this.players[this.currentPlayer].score < 0) this.players[this.currentPlayer].score = 0;
    }
    
    // Mostrar resultado
    const answerDiv = document.getElementById('modal-answer');
    answerDiv.classList.remove('hidden', 'correct-anim', 'incorrect-anim');
    answerDiv.classList.add(isCorrect ? 'correct-anim' : 'incorrect-anim');
    document.getElementById('correct-answer-text').textContent = this.currentQuestion.answer;
    
    // Deshabilitar botones de opciones
    document.querySelectorAll('.host-option-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.6';
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
    
    // Broadcast
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
    
    // Siguiente turno
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
}
