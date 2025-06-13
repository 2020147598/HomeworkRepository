// index.js :contentReference[oaicite:3]{index=3}
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const sqlite3 = require('sqlite3').verbose();
const app     = express();
const PORT    = 3000;

const dbPath       = path.join(__dirname, 'product.db');
const commentsFile = path.join(__dirname, 'comment.json');

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// JSON 바디 파싱
app.use(express.json());

// SQLite 연결
const db = new sqlite3.Database(
  dbPath,
  sqlite3.OPEN_READWRITE,
  (err) => {
    if (err) {
      console.error('DB 연결 오류:', err.message);
    } else {
      console.log('SQLite DB 연결 성공 (read/write)');
    }
  }
);

// 전체 영화 목록
app.get('/api/movies', (req, res) => {
  db.all('SELECT * FROM movies', (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB 조회 실패' });
    res.json(rows);
  });
});

// 특정 영화 상세 정보
app.get('/api/movies/:id', (req, res) => {
  const movieId = Number(req.params.id);
  db.get('SELECT * FROM movies WHERE movie_id = ?', [movieId], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB 조회 실패' });
    if (!row) return res.status(404).json({ error: '영화 없음' });
    res.json(row);
  });
});

// ▶️ 리뷰 조회 API
app.get('/api/movies/:id/comments', (req, res) => {
  const movieId = Number(req.params.id);
  db.all(
    'SELECT review_id, review_content FROM reviews WHERE movie_id = ? ORDER BY review_id',
    [movieId],
    (err, rows) => {
      if (err) {
        console.error('댓글 조회 오류:', err);
        return res.status(500).json({ error: 'DB 댓글 조회 실패' });
      }
      res.json(rows);
    }
  );
});

// ▶️ 리뷰 작성 API
app.post('/api/movies/:id/comments', express.json(), (req, res) => {
  const movieId = Number(req.params.id);
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: '댓글 내용(text) 필요' });
  }

  // 1) DB에 저장
  db.run(
    'INSERT INTO reviews (movie_id, review_content) VALUES (?, ?)',
    [movieId, text],
    function(err) {
      if (err) {
        console.error('DB 댓글 저장 오류:', err);
        return res.status(500).json({ error: 'DB 댓글 저장 실패' });
      }

      // 2) comment.json 에도 추가
      const newComment = {
        review_id: this.lastID,
        movie_id: movieId,
        review_content: text,
        createdAt: new Date().toISOString()
      };
      fs.readFile(commentsFile, 'utf8', (readErr, data) => {
        let arr = [];
        if (!readErr) {
          try { arr = JSON.parse(data); }
          catch(e) { console.error('comment.json 파싱 오류:', e); }
        }
        arr.push(newComment);
        fs.writeFile(commentsFile, JSON.stringify(arr, null, 2), 'utf8', writeErr => {
          if (writeErr) console.error('comment.json 업데이트 오류:', writeErr);
        });
      });

      // 3) 클라이언트에 저장된 새 댓글 정보 응답
      res.status(201).json(newComment);
    }
  );
});

// ▶️ 상세 페이지 라우트 (SPA 방식)
app.get('/movies/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'detail.html'));
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
