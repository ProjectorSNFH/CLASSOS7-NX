const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const students = require('./student');
const path = require('path');

const app = express();
let activeSessions = {};   // 현재 로그인된 유저 관리
let isServiceActive = true; // 서버 가동 상태 (기본 ON)
const MASTER_PW = "1234";  // 마스터 비밀번호

// --- 서버 메모리 세션 저장소 ---
// 구조: { "std01": { sessionName: "홍길동-12345", loginTime: "..." } }

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// 1. 로그인 로직 (중복 로그인 방지 포함)
app.post('/login', (req, res) => {
  const { id, password } = req.body;
  const user = students.find(s => s.id === id && s.password === password);

  if (user) {
    if (!isServiceActive) {
      return res.status(503).json({ success: false, message: "현재 서버가 정지 상태입니다." });
    }
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
    
    // 1. 단순 로그인 확인 (커맨드 없이 비번만 왔을 때)
    if (password === MASTER_PW && !command) {
        return res.send("MASTER CONTROL READY...");
    }
    if (password !== MASTER_PW) {
        return res.send("ACCESS DENIED: INVALID MASTER PASSWORD");
    }

    const args = command.split(' ');
    const cmd = args[0];  // serv
    const sub = args[1];  // on, off, eolo, login, status...

    // 명령어 분기
    if (cmd === "serv") {
        switch(sub) {
            case "on":
                if (isServiceActive) return res.send("Already Running");
                isServiceActive = true;
                return res.send("SERVER STARTED SUCCESSFULLY.");
            
            case "off":
                if (!isServiceActive) return res.send("Already Stopped");
                isServiceActive = false;
                activeSessions = {}; // 모든 세션 즉시 파기
                return res.send("SERVER STOPPED. ALL SESSIONS TERMINATED.");
            
            case "eolo":
                activeSessions = {};
                return res.send("LOGOUT ALL SESSION");
                
            default:
                return res.send("UNKNOWN SUB-COMMAND.");
        }
    }

    // 기존 세션 관리 명령어
    if (command === "login status") {
        const list = Object.entries(activeSessions).map(([id, s]) => `${s.sessionName} - ${id}`).join('\n');
        return res.send(list || "NO ACTIVE SESSIONS.");
    }

    if (cmd === "logout" && args[1]) {
        const target = args[1];
        let found = false;
        for (let id in activeSessions) {
            if (activeSessions[id].sessionName === target) {
                delete activeSessions[id];
                found = true; break;
            }
        }
        return res.send(found ? `SESSION [${target}] TERMINATED.` : "SESSION NOT FOUND.");
    }

    return res.send("COMMAND NOT RECOGNIZED.");
});

// app.js의 /test 라우트 수정
app.get('/test', (req, res) => {
  // 현재 접속 중인 모든 세션의 ID(또는 이름) 목록을 추출
  const sessionNames = Object.values(activeSessions).map(s => s.name);

  res.json({
    connection: 1,
    activeSessions: sessionNames // 현재 로그인된 명단을 배열로 보냄
  });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on ${PORT}`));