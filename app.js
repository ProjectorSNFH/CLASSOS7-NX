const express = require('express');
const cors = require('cors');
const path = require('path');
const students = require('./student'); // 학생 명단 파일

const app = express();
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));

// --- 서버 상태 및 세션 저장소 ---
let activeSessions = {};   // { "학번": { name: "이름", sessionName: "세션ID" } }
let isServiceActive = true; 
const MASTER_PW = "1234";

// 1. 서버 상태 체크 (프론트엔드 실시간 감시용)
app.get('/test', (req, res) => {
    res.json({ 
        connection: isServiceActive ? 1 : 0, 
        activeSessions: Object.values(activeSessions).map(s => s.name) 
    });
});

// 2. 로그인 처리
app.post('/login', (req, res) => {
    if (!isServiceActive) return res.status(503).json({ success: false, message: "시스템 점검 중입니다." });

    const { id, password } = req.body;
    const user = students.find(s => s.id === id && s.password === password);

    if (user) {
        if (activeSessions[user.id]) delete activeSessions[user.id]; // 중복 로그인 제거

        const sessionName = `${user.name}-${Math.floor(Math.random() * 10000)}`;
        activeSessions[user.id] = { name: user.name, sessionName: sessionName };

        res.json({ 
            success: true, 
            user: { name: user.name, role: user.role, sessionName: sessionName } 
        });
    } else {
        res.status(401).json({ success: false, message: "아이디 또는 비밀번호가 틀립니다." });
    }
});

// 3. 관리자 페이지 제공 (Koyeb 서버 주소/auth로 접속)
app.get('/auth', (req, res) => {
    res.sendFile(path.join(__dirname, 'MasterControl.html'));
});

// 4. 마스터 컨트롤 API
// ... 상단 생략 (express, cors 등 기존 유지) ...

app.post('/admin/master-control', (req, res) => {
    const { password, command } = req.body;

    // 1. 비밀번호 틀림
    if (password !== MASTER_PW) {
        return res.send("ACCESS DENIED: INVALID MASTER PASSWORD");
    }

    // 2. 로그인 성공 (비번은 맞는데 명령어가 없는 경우)
    if (!command || command === "") {
        return res.send("MASTER CONTROL READY...");
    }

    // 3. 명령어 처리
    const args = command.split(' ');
    const cmd = args[0];
    const sub = args[1];

    if (cmd === "serv") {
        if (sub === "on") {
            if (isServiceActive) return res.send("Already Running");
            isServiceActive = true;
            return res.send("SERVER STARTED SUCCESSFULLY.");
        }
        if (sub === "off") {
            if (!isServiceActive) return res.send("Already Stopped");
            isServiceActive = false;
            activeSessions = {}; 
            return res.send("SERVER STOPPED. ALL SESSIONS TERMINATED.");
        }
        if (sub === "eolo") {
            activeSessions = {};
            return res.send("LOGOUT ALL SESSION");
        }
    }

    if (command === "login status") {
        const list = Object.entries(activeSessions).map(([id, s]) => `${s.sessionName} - ${id}`).join('\n');
        return res.send(list || "NO ACTIVE SESSIONS.");
    }

    if (cmd === "logout" && sub) {
        let found = false;
        for (let id in activeSessions) {
            if (activeSessions[id].sessionName === sub) {
                delete activeSessions[id];
                found = true; break;
            }
        }
        return res.send(found ? `SESSION [${sub}] TERMINATED.` : "SESSION NOT FOUND.");
    }

    return res.send("UNKNOWN COMMAND.");
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server is running on port ${PORT}`));