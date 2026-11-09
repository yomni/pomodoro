# Pomodoro Timer

사용자 정의 루틴을 지원하는 웹 기반 인터벌 타이머입니다. 프레임워크와 외부 의존성이 없는 Vanilla JavaScript 정적 사이트이며 GitHub Pages로 호스팅됩니다.

## 실행과 검증

빌드 단계와 자동화 테스트는 없습니다. 변경 사항은 로컬 서버를 띄워 브라우저에서 직접 확인합니다.

```sh
python3 -m http.server 8000
```

## 구조

| 파일 | 역할 |
|---|---|
| `index.html` | 마크업 |
| `style.css` | 스타일 |
| `app.js` | 전체 애플리케이션 로직 |

`app.js`는 다음 클래스로 구성됩니다.

- `AudioNotifier`: Web Audio API로 전환 알림음 재생
- `BrowserNotificationService`: Notification API 권한 관리와 시스템 알림
- `StorageService`: `localStorage` 영속화, 기본 루틴과 프리셋 정의
- `TimerEngine`: 타이머 상태(`IDLE`, `RUNNING`, `PAUSED`) 관리, 콜백으로 상태 전달
- `AppController`: DOM 이벤트와 서비스 연결

## 규칙

- `localStorage` 접근은 `StorageService`를 거치고, 키는 `StorageService.KEYS`에 `pomodoro_` 접두사로 정의합니다.
- 남은 시간은 `TimerEngine`의 `endTime`(절대 시각) 기준으로 계산합니다. 백그라운드 탭에서 타이머가 지연되어도 시간이 어긋나지 않아야 합니다.
- UI 문구는 한국어로 작성합니다.

## 배포

`main`에 푸시되면 [deploy-pages.yml](.github/workflows/deploy-pages.yml)이 저장소 루트 전체를 GitHub Pages에 배포합니다. 루트에 추가한 파일은 모두 공개되므로 비밀값이나 내부 문서를 두지 않습니다.
