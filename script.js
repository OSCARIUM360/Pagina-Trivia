class JeopardyGame {
    constructor() {
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
        this.sortedPlayers = [];

        this.init();
    }

    init() {
        this.bindEvents();
        this.showScreen('home-screen');
        this.setupMusic();
        document.addEventListener('click', () => this.tryPlayMusic(), { once: true });
    }

    // ==================== SONIDOS Y MÚSICA ====================

    setupMusic() {
        this.bgMusic = document.getElementById('bg-music');
        this.bgMusic.volume = 0.15;
    }

    tryPlayMusic() {
        if (!this.musicPlaying) {
            this.bgMusic.play().catch(() => {});
        }
    }

    toggleMusic() {
        if (this.musicPlaying) {
            this.bgMusic.pause();
            document.getElementById('toggle-music').innerHTML = '<i class="fas fa-music"></i>';
        } else {
            this.bgMusic.play().catch(() => {});
            document.getElementById('toggle-music').innerHTML = '<i class="fas fa-volume-up"></i>';
        }
        this.musicPlaying = !this.musicPlaying;
    }

    playSound(type) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (type === 'select') this._playTone(ctx, 660, 0.08, 'sine');
            else if (type === 'correct') {
                this._playTone(ctx, 523, 0.12, 'sine');
                setTimeout(() => { try { this._playTone(ctx, 659, 0.12, 'sine'); } catch(e) {} }, 100);
                setTimeout(() => { try { this._playTone(ctx, 784, 0.2, 'sine'); } catch(e) {} }, 200);
            } else if (type === 'incorrect') {
                this._playTone(ctx, 200, 0.3, 'sawtooth');
            } else if (type === 'win') {
                [523, 659, 784, 1047].forEach((f, i) => {
                    setTimeout(() => { try { this._playTone(ctx, f, 0.2, 'sine'); } catch(e) {} }, i * 150);
                });
            }
        } catch(e) {}
    }

    _playTone(ctx, freq, dur, type) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = type;
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + dur);
    }

    // ==================== EVENTOS ====================

    bindEvents() {
        document.getElementById('create-room-btn').addEventListener('click', () => this.createRoom());
        document.getElementById('join-room-btn').addEventListener('click', () => {
            document.getElementById('join-form').classList.remove('hidden');
        });
        document.getElementById('join-room-submit').addEventListener('click', () => this.joinRoom());
        document.getElementById('cancel-join').addEventListener('click', () => {
            document.getElementById('join-form').classList.add('hidden');
        });
        document.getElementById('back-to-home').addEventListener('click', () => this.disconnect());
        document.getElementById('create-board').addEventListener('click', () => this.createBoard());
        document.getElementById('back-to-setup').addEventListener('click', () => this.showScreen('setup-screen'));
        document.getElementById('submit-categories').addEventListener('click', () => this.submitCategories());
        document.getElementById('back-to-categories').addEventListener('click', () => this.showCategoriesScreen());
        document.getElementById('submit-questions').addEventListener('click', () => this.submitQuestions());
        document.getElementById('back-to-questions').addEventListener('click', () => this.showScreen('questions-screen'));
        document.getElementById('start-game-lobby').addEventListener('click', () => this.startGame());
        document.getElementById('end-game').addEventListener('click', () => this.endGame());
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        document.getElementById('btn-correct').addEventListener('click', () => this.handleAnswer(true));
        document.getElementById('btn-incorrect').addEventListener('click', () => this.handleAnswer(false));
        document.getElementById('show-full-results').addEventListener('click', () => this.toggleFullResults());
        document.getElementById('new-game').addEventListener('click', () => this.disconnect());
        document.getElementById('toggle-music').addEventListener('click', () => this.toggleMusic());
    }

    // ==================== NAVEGACIÓN ====================

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(id);
        if (screen) screen.classList.add('active');
        this.updateUIForRole();
    }

    updateUIForRole() {
        document.getElementById('host-controls').style.display = this.isHost ? 'flex' : 'none';
        document.getElementById('lobby-host-actions').style.display = this.isHost ? 'flex' : 'none';
    }

    // ==================== SALA / CONEXIÓN ====================

    createRoom() {
        this.isHost = true;
        this.roomCode = String(Math.floor(100000 + Math.random() * 900000));
        this.players = [{ name: 'Host', score: 0, id: 'host', isHost: true }];
        this.joinedNames = new Set(['Host']);
        this.initPeer(this.roomCode + '-host');
        this.showScreen('setup-screen');
    }

    joinRoom() {
        const code = document.getElementById('room-code').value.trim();
        const name = document.getElementById('join-player-name').value.trim();
        if (!code || code.length !== 6 || !/^\d+$/.test(code)) return alert('Ingresa un código válido de 6 dígitos');
        if (!name) return alert('Ingresa tu nombre');

        const btn = document.getElementById('join-room-submit');
        btn.disabled = true;
        btn.textContent = 'Conectando...';

        this.roomCode = code;
        this.isHost = false;
        this.playerName = name;
        this.initPeer(code + '-' + Date.now());
    }

    initPeer(id) {
        if (this.peer) this.peer.destroy();
        this.peer = new Peer(id, { debug: 0 });

        this.peer.on('open', () => {
            if (!this.isHost) {
                const conn = this.peer.connect(this.roomCode + '-host', {
                    reliable: true,
                    metadata: { name: this.playerName }
                });
                this.handleConnection(conn);
            }
        });

        this.peer.on('connection', (conn) => this.handleConnection(conn));

        this.peer.on('error', () => {
            if (!this.isHost) {
                alert('No se pudo conectar. Verifica el código.');
                document.getElementById('join-room-submit').disabled = false;
                document.getElementById('join-room-submit').textContent = 'Entrar';
            }
        });
    }

    handleConnection(conn) {
        if (this.connections.find(c => c.peer === conn.peer)) {
            conn.close();
            return;
        }
        this.connections.push(conn);

        conn.on('open', () => {
            if (this.isHost) {
                conn.send({
                    type: 'welcome',
                    players: this.players,
                    gameStarted: this.gameStarted,
                    categories: this.categories,
                    questions: this.questions,
                    totalCategories: this.totalCategories,
                    questionsPerCategory: this.questionsPerCategory,
                    currentPlayer: this.currentPlayer
                });
            } else {
                conn.send({ type: 'join-request', name: this.playerName });
            }
        });

        conn.on('data', (data) => this.handleData(conn, data));

        conn.on('close', () => {
            this.connections = this.connections.filter(c => c !== conn);
            if (this.isHost && conn.metadata?.name) {
                this.players = this.players.filter(p => p.name !== conn.metadata.name);
                this.joinedNames.delete(conn.metadata.name);
                this.broadcastPlayers();
                this.updateLobby();
            }
        });
    }

    handleData(conn, data) {
        if (!this.isHost) {
            switch (data.type) {
                case 'welcome':
                    this.players = data.players || [];
                    this.updateLobby();
                    if (data.gameStarted) {
                        this.loadGameState(data);
                        this.renderBoard();
                        this.showScreen('game-screen');
                    } else {
                        this.showLobby();
                    }
                    break;
                case 'players-update':
                    this.players = data.players;
                    this.updateLobby();
                    break;
                case 'game-start':
                    this.loadGameState(data);
                    this.renderBoard();
                    this.showScreen('game-screen');
                    break;
                case 'game-update':
                    this.applyGameUpdate(data);
                    break;
                case 'question-selected':
                    this.showQuestionForPlayers(data);
                    break;
                case 'answer-result':
                    this.showAnswerForPlayers(data);
                    break;
                case 'game-end':
                    this.players = data.players;
                    this.gameStarted = false;
                    document.getElementById('question-modal').classList.remove('active');
                    this.showResults();
                    this.playSound('win');
                    break;
            }
        } else {
            if (data.type === 'join-request') {
                this.handleJoinRequest(conn, data);
            }
        }
    }

    handleJoinRequest(conn, data) {
        const name = data.name?.trim();
        if (!name) return conn.send({ type: 'error', message: 'Nombre inválido' });
        if (this.joinedNames.has(name)) return conn.send({ type: 'error', message: 'Nombre ya en uso' });
        if (this.gameStarted) return conn.send({ type: 'error', message: 'Juego en curso' });

        const player = { name, score: 0, id: conn.peer, isHost: false };
        this.players.push(player);
        this.joinedNames.add(name);
        conn.metadata = { name };
        conn.send({ type: 'join-accepted', players: this.players });
        this.broadcastPlayers();
        this.updateLobby();
    }

    broadcast(data) {
        this.connections.forEach(c => { if (c.open) { try { c.send(data); } catch(e) {} } });
    }

    broadcastPlayers() {
        this.broadcast({ type: 'players-update', players: this.players });
    }

    loadGameState(data) {
        this.categories = data.categories;
        this.questions = data.questions;
        this.players = data.players;
        this.totalCategories = data.totalCategories;
        this.questionsPerCategory = data.questionsPerCategory;
        this.currentPlayer = data.currentPlayer;
        this.gameStarted = true;
    }

    applyGameUpdate(data) {
        if (data.questionId !== undefined) {
            const q = this.questions.find(q => q.id === data.questionId);
            if (q) q.used = true;
        }
        if (data.players) this.players = data.players;
        if (data.currentPlayer !== undefined) this.currentPlayer = data.currentPlayer;
        this.renderBoard();
    }

    // ==================== CONFIGURACIÓN (HOST) ====================

    createBoard() {
        if (!this.isHost) return;
        this.totalCategories = parseInt(document.getElementById('categories').value);
        this.questionsPerCategory = parseInt(document.getElementById('questions').value);
        if (this.totalCategories < 2 || this.totalCategories > 8 || this.questionsPerCategory < 1 || this.questionsPerCategory > 10) {
            return alert('2-8 categorías, 1-10 preguntas');
        }
        this.showCategoriesScreen();
    }

    showCategoriesScreen() {
        if (!this.isHost) return;
        const container = document.getElementById('category-inputs');
        container.innerHTML = '';
        for (let i = 0; i < this.totalCategories; i++) {
            const div = document.createElement('div');
            div.className = 'category-input';
            div.innerHTML = `<label>Categoría ${i + 1}</label><input type="text" class="category-name" placeholder="Ej: Ciencia">`;
            container.appendChild(div);
        }
        this.showScreen('categories-screen');
    }

    submitCategories() {
        if (!this.isHost) return;
        const inputs = document.querySelectorAll('.category-name');
        this.categories = [];
        let valid = true;
        inputs.forEach((input, i) => {
            const name = input.value.trim();
            if (!name) { alert(`Nombre para Categoría ${i + 1}`); valid = false; }
            this.categories.push(name);
        });
        if (valid) this.showQuestionsScreen();
    }

    showQuestionsScreen() {
        if (!this.isHost) return;
        const container = document.getElementById('questions-container');
        container.innerHTML = '';
        this.questions = [];
        let id = 0;
        this.categories.forEach(cat => {
            for (let i = 0; i < this.questionsPerCategory; i++) {
                const q = { id, category: cat, points: (i + 1) * 100, question: '', answer: '', used: false };
                this.questions.push(q);
                const div = document.createElement('div');
                div.className = 'question-row';
                div.innerHTML = `
                    <h3>${cat} — ${q.points} pts</h3>
                    <div class="question-inputs">
                        <textarea class="q-input" placeholder="Escribe la pregunta" data-id="${id}"></textarea>
                        <textarea class="a-input" placeholder="Escribe la respuesta correcta" data-id="${id}"></textarea>
                    </div>`;
                container.appendChild(div);
                id++;
            }
        });
        this.showScreen('questions-screen');
    }

    submitQuestions() {
        if (!this.isHost) return;
        const qInputs = document.querySelectorAll('.q-input');
        const aInputs = document.querySelectorAll('.a-input');
        let valid = true;

        qInputs.forEach(input => {
            const id = parseInt(input.dataset.id);
            this.questions[id].question = input.value.trim();
            if (!this.questions[id].question) {
                alert(`Falta pregunta: ${this.questions[id].category} ${this.questions[id].points}pts`);
                valid = false;
            }
        });
        aInputs.forEach(input => {
            const id = parseInt(input.dataset.id);
            this.questions[id].answer = input.value.trim();
            if (!this.questions[id].answer) {
                alert(`Falta respuesta: ${this.questions[id].category} ${this.questions[id].points}pts`);
                valid = false;
            }
        });

        if (valid) this.showLobby();
    }

    // ==================== LOBBY ====================

    showLobby() {
        document.getElementById('room-code-display').textContent = this.roomCode;
        this.generateQR();
        this.updateLobby();
        this.showScreen('lobby-screen');

        if (!this.isHost) {
            document.getElementById('lobby-status').textContent = '⏳ Esperando al host...';
        } else {
            document.getElementById('lobby-status').textContent = '';
        }
    }

    generateQR() {
        const container = document.getElementById('qrcode');
        container.innerHTML = '';
        const url = `https://oscarium360.github.io/Pagina-Trivia/?room=${this.roomCode}`;
        new QRCode(container, {
            text: url,
            width: 150,
            height: 150,
            colorDark: '#1e293b',
            colorLight: '#ffffff'
        });
    }

    updateLobby() {
        const container = document.getElementById('lobby-players-list');
        if (!container) return;
        container.innerHTML = '';
        this.players.forEach(p => {
            const tag = document.createElement('div');
            tag.className = 'player-tag' + (p.isHost ? ' host' : '');
            tag.innerHTML = (p.isHost ? '<span class="crown">👑</span> ' : '') + p.name;
            container.appendChild(tag);
        });
    }

    // ==================== JUEGO ====================

    startGame() {
        if (!this.isHost) return;
        if (this.players.length < 2) return alert('Mínimo 2 jugadores');

        this.gameStarted = true;
        this.currentPlayer = this.players.findIndex(p => !p.isHost);
        if (this.currentPlayer < 0) this.currentPlayer = 0;

        this.broadcast({
            type: 'game-start',
            categories: this.categories,
            questions: this.questions.map(q => ({ ...q, answer: '' })),
            players: this.players,
            totalCategories: this.totalCategories,
            questionsPerCategory: this.questionsPerCategory,
            currentPlayer: this.currentPlayer
        });

        this.renderBoard();
        this.showScreen('game-screen');
    }

    renderBoard() {
        const board = document.getElementById('game-board');
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

                if (!q?.used && this.isHost) {
                    cell.addEventListener('click', () => this.selectQuestion(q));
                }
                board.appendChild(cell);
            });
        }

        this.renderPlayers();
        this.updateTurnIndicator();
    }

    renderPlayers() {
        const bar = document.getElementById('players-bar');
        bar.innerHTML = '';
        this.players.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = `player-score ${i === this.currentPlayer ? 'active' : ''}`;
            div.innerHTML = `<strong>${p.name}</strong><br>${p.score} pts`;
            if (this.isHost) {
                div.style.cursor = 'pointer';
                div.addEventListener('click', () => {
                    if (!document.getElementById('question-modal').classList.contains('active')) {
                        this.currentPlayer = i;
                        this.renderBoard();
                        this.broadcast({ type: 'game-update', currentPlayer: this.currentPlayer });
                    }
                });
            }
            bar.appendChild(div);
        });
    }

    updateTurnIndicator() {
        const indicator = document.getElementById('turn-indicator');
        if (indicator && this.players[this.currentPlayer]) {
            indicator.textContent = `🎯 Turno de: ${this.players[this.currentPlayer].name}`;
        }
    }

    selectQuestion(q) {
        if (!this.isHost || q.used || !this.gameStarted) return;
        this.playSound('select');
        this.currentQuestion = q;
        this.answerRevealed = false;

        document.getElementById('modal-category').textContent = `${q.category} — ${q.points} pts`;
        document.getElementById('modal-question').textContent = q.question;
        document.getElementById('modal-answer').classList.add('hidden');
        document.getElementById('answer-buttons').style.display = 'flex';
        document.getElementById('question-modal').classList.add('active');

        this.broadcast({
            type: 'question-selected',
            category: q.category,
            points: q.points,
            question: q.question
        });
    }

    showQuestionForPlayers(data) {
        document.getElementById('modal-category').textContent = `${data.category} — ${data.points} pts`;
        document.getElementById('modal-question').textContent = data.question;
        document.getElementById('modal-answer').classList.add('hidden');
        document.getElementById('answer-buttons').style.display = 'none';
        document.getElementById('question-modal').classList.add('active');
    }

    closeModal() {
        if (!this.isHost) return;
        if (this.answerRevealed || !this.currentQuestion) {
            document.getElementById('question-modal').classList.remove('active');
            this.answerRevealed = false;
            this.currentQuestion = null;
            if (this.gameStarted && this.questions.every(q => q.used)) {
                this.endGame();
            }
        }
    }

    handleAnswer(correct) {
        if (!this.isHost || !this.currentQuestion || this.answerRevealed) return;

        this.answerRevealed = true;
        this.playSound(correct ? 'correct' : 'incorrect');

        if (correct) {
            this.players[this.currentPlayer].score += this.currentQuestion.points;
        }

        const answerDiv = document.getElementById('modal-answer');
        answerDiv.classList.remove('hidden', 'correct-anim', 'incorrect-anim');
        answerDiv.classList.add(correct ? 'correct-anim' : 'incorrect-anim');
        document.getElementById('correct-answer-text').textContent = this.currentQuestion.answer;
        document.getElementById('answer-buttons').style.display = 'none';

        this.broadcast({
            type: 'answer-result',
            correct,
            answer: this.currentQuestion.answer,
            playerName: this.players[this.currentPlayer].name,
            pointsAwarded: correct ? this.currentQuestion.points : 0,
            players: this.players
        });

        this.currentQuestion.used = true;

        do {
            this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
        } while (this.players[this.currentPlayer]?.isHost && this.players.length > 1);

        this.broadcast({
            type: 'game-update',
            questionId: this.currentQuestion.id,
            players: this.players,
            currentPlayer: this.currentPlayer
        });

        this.renderBoard();

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
        if (data.players) this.players = data.players;
    }

    // ==================== FIN DEL JUEGO ====================

    endGame() {
        if (!this.isHost && !this.gameStarted) return;
        this.gameStarted = false;
        document.getElementById('question-modal').classList.remove('active');

        this.broadcast({ type: 'game-end', players: this.players });
        this.playSound('win');
        this.showResults();
        this.createConfetti();
    }

    showResults() {
        const sorted = [...this.players].sort((a, b) => b.score - a.score);
        this.sortedPlayers = sorted;

        const podium = document.getElementById('podium');
        podium.innerHTML = '';

        const top = sorted.slice(0, 3);
        const order = [];
        if (top.length >= 2) order.push({ p: top[1], pos: 2 });
        if (top.length >= 1) order.push({ p: top[0], pos: 1 });
        if (top.length >= 3) order.push({ p: top[2], pos: 3 });

        order.forEach(({ p, pos }) => {
            const card = document.createElement('div');
            card.className = `result-card ${pos === 1 ? 'first' : pos === 2 ? 'second' : 'third'}`;
            const emoji = pos === 1 ? '🥇' : pos === 2 ? '🥈' : '🥉';
            card.innerHTML = `
                <div class="pos">${emoji} #${pos}</div>
                <div class="name">${p.name}</div>
                <div class="pts">${p.score} pts</div>`;
            podium.appendChild(card);
        });

        document.getElementById('full-results').classList.add('hidden');
        this.showScreen('results-screen');
    }

    toggleFullResults() {
        const el = document.getElementById('full-results');
        if (el.classList.contains('hidden')) {
            el.innerHTML = '<h3>Clasificación Completa</h3>';
            this.sortedPlayers.forEach((p, i) => {
                const row = document.createElement('div');
                row.className = 'result-row';
                row.innerHTML = `
                    <span class="rank">#${i + 1}</span>
                    <span class="name-col">${p.name}</span>
                    <span class="pts-col">${p.score} pts</span>`;
                el.appendChild(row);
            });
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }

    createConfetti() {
        const container = document.getElementById('confetti');
        if (!container) return;
        container.innerHTML = '';
        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
        for (let i = 0; i < 80; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 2 + 's';
            piece.style.animationDuration = (2 + Math.random() * 3) + 's';
            piece.style.width = (6 + Math.random() * 8) + 'px';
            piece.style.height = (6 + Math.random() * 8) + 'px';
            container.appendChild(piece);
        }
        setTimeout(() => { container.innerHTML = ''; }, 5000);
    }

    // ==================== LIMPIEZA ====================

    disconnect() {
        if (this.peer) { this.peer.destroy(); this.peer = null; }
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

        document.getElementById('question-modal').classList.remove('active');
        document.getElementById('answer-buttons').style.display = 'flex';
        document.getElementById('join-form').classList.add('hidden');
        const btn = document.getElementById('join-room-submit');
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        document.getElementById('confetti').innerHTML = '';

        this.showScreen('home-screen');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new JeopardyGame();
});
