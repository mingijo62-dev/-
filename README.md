# 안전교육 QR 출석관리

전사원 안전교육 참석을 QR코드로 관리하는 웹 시스템 (Next.js + PostgreSQL, Vercel 배포용).

- **매주 월요일 자동 교체되는 공용 출석 QR** → 직원이 본인 휴대폰으로 스캔 후 사번·이름 입력해 자가 출석
- 대리 출석 차단(1휴대폰 1인), 중복 출석 차단, 휴대폰 미소지자 수기 출석
- 교육 자료 파일 첨부 (출석 완료 화면에서 직원 다운로드)
- 한솔제지 CI 적용, 공식 로고 업로드
- 실시간 현황판: 참석/미참석/참석률, 교대·주전/부서/근무조/직책/차수별 현황
- 엑셀 다운로드, 교육 차수 관리, 관리자/담당자 권한, 감사 로그

상세 기획·DB·화면·기능명세·구현순서·배포 절차: **[docs/기획서.md](docs/기획서.md)**

## 빠른 배포 (Vercel)
1. 이 저장소를 Vercel에 Import
2. Storage → Neon Postgres 연결 (`DATABASE_URL` 자동 설정)
3. 환경변수 `AUTH_SECRET`(32자 이상 임의값), `SETUP_KEY` 추가 후 Redeploy
4. `/setup` 접속 → 최초 관리자 생성

## 로컬 실행
```bash
cp .env.example .env.local   # 값 수정
npm install
npm run dev
```
