# 블로그데스크

혼자 쓰는 네이버 블로그 운영 데스크. 계정별로 주제·말투·증거를 가두고, 2026형 초안을 만든 뒤 스마트에디터에 붙여 넣습니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000

1. 계정에서 블로그를 추가합니다. 업종 하나, 증거 노트, 키워드, 하루 1~3편.
2. 설정에 OpenAI, Anthropic, 또는 Gemini(Google AI Studio) API 키를 넣습니다. 없으면 뼈대 초안만 나옵니다.
3. 캘린더에서 날짜를 눌러 주제를 넣거나, 7일 자동 배정.
4. 에디터에서 생성 → 검수 → HTML 복사 → 네이버 글쓰기에 붙여 넣기.

데이터는 `data/db.json`에만 저장됩니다.

자동 로그인·캡차 우회·이웃/댓글 자동화는 넣지 않습니다.

## 배포

주소: https://blogdesk-ljh.web.app

```bash
gcloud run deploy blogdesk --source . --project blogdesk-ljh --region asia-northeast3 --allow-unauthenticated --set-env-vars FIREBASE_PROJECT_ID=blogdesk-ljh
npm run deploy
```

