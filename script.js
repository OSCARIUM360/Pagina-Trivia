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
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.showScreen('home-screen');
    }

    playSound(type) {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.value = 0.2;
            osc.type = 'sine';
            
            if (type === 'select') {
                osc.frequency.value = 600;
                osc.start();
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
                osc.stop(ctx.currentTime + 0.1);
            } else if (type === 'correct') {
                osc.frequency.value = 523;
                osc.start();
                osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
                osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
                osc.stop(ctx.currentTime + 0.3);
            } else if (type === 'incorrect') {
                osc.frequency.value = 300;
                osc.start();
                osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
                osc.stop(ctx.currentTime + 0.3);
            }
        } catch (e) {}
    }

    bindEvents() {
        document.getElementById('create-room-btn').addEventListener('click', () => this.createRoom());
        document.getElementById('join-room-btn').addEventListener('click', () => {
            document.getElementById('join-form').classList.remove('hidden');
        });
        document.getElementById('join-room-submit').addEventListener('click', () => this.joinRoom());
        document.getElementById('cancel-join').addEventListener('click', () => {
            document.getElementById('join-form').classList.add('hidden');
        });
        document.getElementById('back-to-home').addEventListener('click', () => this.goTo('home-screen'));
        document.getElementById('create-board').addEventListener('click', () => this.createBoard());
        document.getElementById('back-to-setup').addEventListener('click', () => this.goTo('setup-screen'));
        document.getElementById('submit-categories').addEventListener('click', () => this.submitCategories());
        document.getElementById('back-to-categories').addEventListener('click', () => this.showCategoriesScreen());
        document.getElementById('submit-questions').addEventListener('click', () => this.submitQuestions());
        document.getElementById('back-to-questions').addEventListener('click', () => this.goTo('questions-screen'));
        document.getElementById('start-game-lobby').addEventListener('click', () => this.startGame());
        document.getElementById('end-game').addEventListener('click', () => this.endGame());
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        document.getElementById('btn-correct').addEventListener('click', () => this.handleAnswer(true));
        document.getElementById('btn-incorrect').addEventListener('click', () => this.handleAnswer(false));
        document.getElementById('show-full-results').addEventListener('click', () => this.toggleFullResults());
        document.getElementById('new-game').addEventListener('click', () => this.newGame());
    }

    showScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    }

    goTo(id) {
        this.showScreen(id);
    }

    createRoom() {
        this.isHost = true;
        this.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.initPeer(this.roomCode + '-host');
        this.showScreen('setup-screen');
    }

    joinRoom() {
        const code = document.getElementById('room-code').value.trim().toUpperCase();
        const name = document.getElementById('join-player-name').value.trim();
        if (!code || !name) return alert('Completa todos los campos');
        
        this.roomCode = code;
        this.isHost = false;
        this.players.push({ name, score: 0, id: 'local' });
        this.initPeer(code + '-' + Date.now());
    }

    initPeer(id) {
        this.peer = new Peer(id, { debug: 0 });
        
        this.peer.on('open', () => {
            console.log('Conectado:', id);
            if (!this.isHost) {
                const conn = this.peer.connect(this.roomCode + '-host', { reliable: true });
                this.handleConnection(conn);
            }
        });

        this.peer.on('connection', (conn) => {
            console.log('Nueva conexión:', conn.peer);
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('Error:', err);
        });
    }

    handleConnection(conn) {
        this.connections.push(conn);
        
        conn.on('open', () => {
            console.log('Conexión establecida');
            if (this.isHost) {
                conn.send({ type: 'welcome' });
                this.broadcastPlayers();
            }
            if (!this.isHost) {
                this.showLobby();
            }
        });

        conn.on('data', (data) => {
            if (data.type === 'welcome') {
                this.showLobby();
            } else if (data.type === 'players') {
                const local = this.players.find(p => p.id === 'local');
                this.players = data.players;
                if (local && !this.players.find(p => p.id === 'local')) {
                    this.players.push(local);
                }
                this.updateLobby();
            } else if (data.type === 'player-joined') {
                this.players.push(data.player);
                this.updateLobby();
            } else if (data.type === 'game-start') {
                this.categories = data.categories;
                this.questions = data.questions;
                this.players = data.players;
                this.totalCategories = data.totalCategories;
                this.questionsPerCategory = data.questionsPerCategory;
                this.startRemoteGame();
            } else if (data.type === 'update') {
                this.updateGameState(data);
            }
        });

        conn.on('close', () => {
            this.connections = this.connections.filter(c => c !== conn);
        });
    }

    broadcast(data) {
        this.connections.forEach(c => {
            if (c.open) c.send(data);
        });
    }

    broadcastPlayers() {
        this.broadcast({ type: 'players', players: this.players });
    }

    createBoard() {
        this.totalCategories = parseInt(document.getElementById('categories').value);
        this.questionsPerCategory = parseInt(document.getElementById('questions').value);
        
        if (this.totalCategories < 2 || this.totalCategories > 8 || 
            this.questionsPerCategory < 2 || this.questionsPerCategory > 10) {
            return alert('Elige entre 2-8 categorías y 2-10 preguntas');
        }
        
        this.showCategoriesScreen();
    }

    showCategoriesScreen() {
        const container = document.getElementById('category-inputs');
        container.innerHTML = '';
        
        for (let i = 0; i < this.totalCategories; i++) {
            const div = document.createElement('div');
            div.className = 'category-input';
            div.innerHTML = `
                <label>Categoría ${i + 1}</label>
                <input type="text" class="category-name" placeholder="Nombre">
            `;
            container.appendChild(div);
        }
        
        this.showScreen('categories-screen');
    }

    submitCategories() {
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
        
        if (valid) this.showQuestionsScreen();
    }

    showQuestionsScreen() {
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
                        <textarea class="q-input" placeholder="Pregunta" data-id="${id}"></textarea>
                        <textarea class="a-input" placeholder="Respuesta" data-id="${id}"></textarea>
                    </div>
                `;
                container.appendChild(div);
                id++;
            }
        });
        
        this.showScreen('questions-screen');
    }

    submitQuestions() {
        const qInputs = document.querySelectorAll('.q-input');
        const aInputs = document.querySelectorAll('.a-input');
        let valid = true;
        
        qInputs.forEach(input => {
            const id = parseInt(input.dataset.id);
            this.questions[id].question = input.value.trim();
            if (!this.questions[id].question) {
                alert(`Falta pregunta de ${this.questions[id].category} ${this.questions[id].points}pts`);
                valid = false;
            }
        });
        
        aInputs.forEach(input => {
            const id = parseInt(input.dataset.id);
            this.questions[id].answer = input.value.trim();
            if (!this.questions[id].answer) {
                alert(`Falta respuesta de ${this.questions[id].category} ${this.questions[id].points}pts`);
                valid = false;
            }
        });
        
        if (valid) this.showLobby();
    }

    showLobby() {
        document.getElementById('room-code-display').textContent = this.roomCode;
        
        if (this.isHost && !this.players.find(p => p.id === 'local')) {
            this.players.unshift({ name: 'Host', score: 0, id: 'local' });
        }
        
        this.updateLobby();
        this.showScreen('lobby-screen');

        if (!this.isHost && this.connections.length > 0) {
            const local = this.players.find(p => p.id === 'local');
            if (local) {
                this.connections[0].send({ type: 'player-joined', player: local });
            }
        }
    }

    updateLobby() {
        const container = document.getElementById('lobby-players-list');
        container.innerHTML = '';
        this.players.forEach(p => {
            const tag = document.createElement('div');
            tag.className = 'player-tag';
            tag.textContent = p.name;
            container.appendChild(tag);
        });
    }

    startGame() {
        if (this.players.length < 2) return alert('Mínimo 2 jugadores');
        
        if (this.isHost) {
            this.broadcast({
                type: 'game-start',
                categories: this.categories,
                questions: this.questions,
                players: this.players,
                totalCategories: this.totalCategories,
                questionsPerCategory: this.questionsPerCategory
            });
        }
        
        this.gameStarted = true;
        this.currentPlayer = 0;
        this.renderBoard();
        this.showScreen('game-screen');
    }

    startRemoteGame() {
        this.gameStarted = true;
        this.currentPlayer = 0;
        this.renderBoard();
        this.showScreen('game-screen');
    }

    renderBoard() {
        const board = document.getElementById('game-board');
        board.innerHTML = '';
        board.style.gridTemplateColumns = `repeat(${this.totalCategories + 1}, 1fr)`;
        
        // Header
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
        
        // Questions
        for (let i = 0; i < this.questionsPerCategory; i++) {
            const pc = document.createElement('div');
            pc.className = 'game-cell category';
            pc.textContent = (i + 1) * 100;
            board.appendChild(pc);
            
            this.categories.forEach(cat => {
                const q = this.questions.find(q => q.category === cat && q.points === (i + 1) * 100);
                const cell = document.createElement('div');
                cell.className = `game-cell ${q.used ? 'used' : ''}`;
                cell.textContent = q.used ? '✓' : (i + 1) * 100;
                if (!q.used) cell.addEventListener('click', () => this.selectQuestion(q));
                board.appendChild(cell);
            });
        }
        
        this.renderPlayers();
    }

    renderPlayers() {
        const bar = document.getElementById('players-bar');
        bar.innerHTML = '';
        
        this.players.forEach((p, i) => {
            const div = document.createElement('div');
            div.className = `player-score ${i === this.currentPlayer ? 'active' : ''}`;
            div.innerHTML = `<strong>${p.name}</strong><br>${p.score} pts`;
            div.addEventListener('click', () => {
                if (!document.getElementById('question-modal').classList.contains('active')) {
                    this.currentPlayer = i;
                    this.renderPlayers();
                }
            });
            bar.appendChild(div);
        });
    }

    selectQuestion(q) {
        if (q.used || !this.gameStarted) return;
        this.playSound('select');
        
        this.currentQuestion = q;
        this.answerRevealed = false;
        
        document.getElementById('modal-category').textContent = `${q.category} — ${q.points} pts`;
        document.getElementById('modal-question').textContent = q.question;
        document.getElementById('modal-answer').classList.add('hidden');
        document.getElementById('answer-buttons').style.display = 'flex';
        document.getElementById('question-modal').classList.add('active');
    }

    closeModal() {
        if (this.answerRevealed || !this.currentQuestion) {
            document.getElementById('question-modal').classList.remove('active');
            this.answerRevealed = false;
            this.currentQuestion = null;
            if (this.gameStarted && this.questions.every(q => q.used)) this.endGame();
        }
    }

    handleAnswer(correct) {
        if (!this.currentQuestion || this.answerRevealed) return;
        this.answerRevealed = true;
        
        this.playSound(correct ? 'correct' : 'incorrect');
        
        if (correct) this.players[this.currentPlayer].score += this.currentQuestion.points;
        
        document.getElementById('correct-answer-text').textContent = this.currentQuestion.answer;
        document.getElementById('modal-answer').classList.remove('hidden');
        document.getElementById('answer-buttons').style.display = 'none';
        
        this.currentQuestion.used = true;
        
        if (this.isHost) {
            this.broadcast({
                type: 'update',
                questionId: this.currentQuestion.id,
                players: this.players,
                currentPlayer: this.currentPlayer
            });
        }
        
        this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
        this.renderBoard();
    }

    updateGameState(data) {
        if (data.questionId !== undefined) {
            const q = this.questions.find(q => q.id === data.questionId);
            if (q) q.used = true;
        }
        if (data.players) this.players = data.players;
        if (data.currentPlayer !== undefined) this.currentPlayer = data.currentPlayer;
        this.renderBoard();
    }

    endGame() {
        this.gameStarted = false;
        document.getElementById('question-modal').classList.remove('active');
        this.showResults();
    }

    showResults() {
        const sorted = [...this.players].sort((a, b) => b.score - a.score);
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
            card.innerHTML = `<div class="pos">#${pos}</div><div class="name">${p.name}</div><div class="pts">${p.score} pts</div>`;
            podium.appendChild(card);
        });
        
        this.sortedPlayers = sorted;
        document.getElementById('full-results').classList.add('hidden');
        this.showScreen('results-screen');
    }

    toggleFullResults() {
        const el = document.getElementById('full-results');
        if (el.classList.contains('hidden')) {
            el.innerHTML = '';
            this.sortedPlayers.forEach((p, i) => {
                const row = document.createElement('div');
                row.className = 'result-row';
                row.innerHTML = `<span>#${i + 1} ${p.name}</span><span>${p.score} pts</span>`;
                el.appendChild(row);
            });
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }

    newGame() {
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.categories = [];
        this.questions = [];
        this.players = [];
        this.connections = [];
        this.currentPlayer = 0;
        this.gameStarted = false;
        this.currentQuestion = null;
        this.answerRevealed = false;
        document.getElementById('question-modal').classList.remove('active');
        document.getElementById('answer-buttons').style.display = 'flex';
        this.showScreen('home-screen');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new JeopardyGame();
});
