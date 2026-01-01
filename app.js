const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const students = require('./student'); // 데이터 불러오기


const app = express();

// 미들웨어 설정
app.use(express.json()); // JSON 요청 본문 파싱
app.use(cookieParser()); // 쿠키 파싱
app.use(cors({
  origin: true, // 프론트엔드 주소 입력
  credentials: true // 쿠키 전송 허용
}));

// 로그인 API
app.post('/login', (req, res) => {
  const { id, password } = req.body;

  // 1. 학생 명단에서 아이디와 비밀번호 조회
  const user = students.find(s => s.id === id && s.password === password);

  if (user) {
    // 2. 로그인 성공: 쿠키에 정보 담기
    // 보안을 위해 실제 서비스에서는 JWT를 쓰지만, 요청하신 대로 쿠키에 직접 정보를 담습니다.
    const userData = {
      number: user.number,
      name: user.name,
      role: user.role
    };

    // 쿠키 설정 (7일간 유지)
    res.cookie('user_info', JSON.stringify(userData), {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: false, // 프론트엔드 스크립트에서 접근하려면 false
      secure: true,    // HTTPS 환경(Koyeb) 필수
      sameSite: 'none' // 크로스 도메인 설정
    });

    return res.json({ success: true, message: "로그인 성공!", user: userData });
  } else {
    // 3. 로그인 실패: 쿠키를 주지 않음
    return res.status(401).json({ success: false, message: "아이디 또는 비밀번호가 틀립니다." });
  }
});

// app.js 에 추가
app.get('/test', (req, res) => {
  res.json({ connection: 1 });
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
});