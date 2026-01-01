const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const students = require('./student');
const path = require('path'); 

const app = express();

// --- 서버 메모리 세션 저장소 ---
// 구조: { "std01": { sessionName: "홍길동-12345", loginTime: "..." } }
let activeSessions = {}; 

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// 1. 로그인 로직 (중복 로그인 방지 포함)
app.post('/login', (req, res) => {
    const { id, password } = req.body;
    const user = students.find(s => s.id === id && s.password === password);

    if (user) {
        // [중복 로그인 체크] 이미 해당 ID로 로그인된 세션이 있다면 삭제
        if (activeSessions[user.id]) {
            console.log(`[중복로그인] 기존 세션(${activeSessions[user.id].sessionName})을 제거합니다.`);
            delete activeSessions[user.id];
        }

        // 새로운 세션 생성 (세션명: 이름-랜덤번호)
        const sessionName = `${user.name}-${Math.floor(Math.random() * 10000)}`;
        activeSessions[user.id] = {
            sessionName: sessionName,
            name: user.name,
            number: user.number,
            role: user.role,
            loginTime: new Date().toLocaleString()
        };

        const userData = {
            number: user.number,
            name: user.name,
            role: user.role,
            sessionName: sessionName // 세션명도 같이 보냄
        };

        res.cookie('user_info', JSON.stringify(userData), {
            maxAge: 7 * 24 * 60 * 60 * 1000,
            httpOnly: false,
            secure: true,
            sameSite: 'none'
        });

        return res.json({ success: true, user: userData });
    } else {
        return res.status(401).json({ success: false, message: "ID/PW 불일치" });
    }
});

app.get('/auth', (req, res) => {
    // __dirname은 현재 app.js가 있는 폴더 위치입니다.
    res.sendFile(path.join(__dirname, 'MasterControl.html'));
});

// 2. 관리자 마스터 컨트롤 (DOS 스타일 API)
app.post('/admin/master-control', (req, res) => {
    const { password, command } = req.body;

    // 1차 비번 확인
    if (password !== "1234") {
        return res.send("ACCESS DENIED: INVALID MASTER PASSWORD\n");
    }

    if (!command) {
        return res.send("MASTER CONTROL READY...\nENTER COMMAND\n");
    }

    const args = command.split(' ');
    const cmd = args[0];

    // 명령어 처리
    if (cmd === "login" && args[1] === "status") {
        let output = "Master Control v0.1\n----------------------------------\n";
        const sessionList = Object.entries(activeSessions);
        
        if (sessionList.length === 0) {
            output += "NO ACTIVE SESSIONS FOUND.\n";
        } else {
            sessionList.forEach(([id, info]) => {
                output += `${info.sessionName} - ${id}\n`;
            });
        }
        return res.send(output);
    } 
    
    else if (cmd === "logout") {
        const targetSession = args[1];
        let found = false;

        for (let id in activeSessions) {
            if (activeSessions[id].sessionName === targetSession) {
                delete activeSessions[id];
                found = true;
                break;
            }
        }

        if (found) {
            return res.send(`SESSION [${targetSession}] TERMINATED SUCCESSFULLY.\n`);
        } else {
            return res.send(`ERROR: SESSION [${targetSession}] NOT FOUND.\n`);
        }
    }

    return res.send("UNKNOWN COMMAND. AVAILABLE: login status, logout [sessionName]\n");
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on ${PORT}`));