#!/usr/bin/env python3
"""
English Community admin-session smoke test.
Uses only Python's standard library. It tests a DEPLOYED site and does not
perform successful data-changing operations.
"""
import getpass
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
import http.cookiejar
from dataclasses import dataclass

TIMEOUT = 20

@dataclass
class Result:
    name: str
    passed: bool
    detail: str

results = []

def record(name, passed, detail=""):
    results.append(Result(name, passed, detail))
    icon = "PASS" if passed else "FAIL"
    print(f"[{icon}] {name}" + (f" — {detail}" if detail else ""))

def normalize_origin(value):
    p = urllib.parse.urlparse(value.strip())
    if p.scheme not in ("http", "https") or not p.netloc:
        raise ValueError("URL은 https://example.com 형식이어야 합니다.")
    return f"{p.scheme}://{p.netloc}"

def request(opener, url, method="GET", headers=None, body=None):
    data = None
    h = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with opener.open(req, timeout=TIMEOUT) as resp:
            return resp.status, dict(resp.headers.items()), resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers.items()), e.read().decode("utf-8", "replace")
    except Exception as e:
        return None, {}, f"{type(e).__name__}: {e}"

def json_obj(body):
    try:
        return json.loads(body)
    except Exception:
        return {}

def main():
    print("=" * 68)
    print(" English Community — 관리자 세션 인증 자동 점검")
    print("=" * 68)
    print("배포된 사이트를 점검합니다. 정상적인 데이터 수정/삭제는 실행하지 않습니다.\n")

    try:
        base = input("배포 사이트 주소 (예: https://your-site.vercel.app): ").strip().rstrip("/")
        origin = normalize_origin(base)
        base = origin
        password = getpass.getpass("현재 관리자 비밀번호 (화면에 표시되지 않음): ")
        if not password:
            print("비밀번호가 입력되지 않았습니다.")
            return 2
    except (ValueError, KeyboardInterrupt) as e:
        print(f"\n입력 오류: {e}")
        return 2

    cookiejar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookiejar))
    headers = {"Origin": origin, "Accept": "application/json"}

    print("\n[1/7] 로그인 전 접근 차단 확인")
    status, _, body = request(opener, base + "/api/admin", headers=headers)
    record("로그인 전 /api/admin 은 401", status == 401, f"HTTP {status}" if status else body)

    status, _, body = request(
        opener, base + "/api/generate-worksheet", "POST", headers,
        {"topic": "Security test", "weekInfo": "test"}
    )
    record("로그인 전 학습지 생성 API는 401", status == 401,
           f"HTTP {status}" if status else body)

    print("\n[2/7] 잘못된 비밀번호 거부 확인")
    status, _, body = request(
        opener, base + "/api/auth/login", "POST", headers,
        {"password": "WRONG-" + "x" * 32}
    )
    record("잘못된 비밀번호는 401", status == 401, f"HTTP {status}" if status else body)

    print("\n[3/7] 정상 로그인 및 쿠키 확인")
    status, response_headers, body = request(
        opener, base + "/api/auth/login", "POST", headers, {"password": password}
    )
    payload = json_obj(body)
    record("정상 로그인은 200", status == 200, f"HTTP {status}" if status else body)
    set_cookie = response_headers.get("Set-Cookie", "")
    cookie_ok = (
        "esl_admin_session=" in set_cookie
        and "httponly" in set_cookie.lower()
        and "samesite=strict" in set_cookie.lower()
    )
    record("세션 쿠키에 HttpOnly 및 SameSite=Strict 적용", cookie_ok,
           "쿠키 속성 확인" if cookie_ok else "Set-Cookie 속성을 확인하세요")
    token_not_returned = "token" not in payload and "session" not in payload
    record("로그인 JSON에 세션 토큰을 반환하지 않음", status == 200 and token_not_returned,
           "응답 필드 확인" if token_not_returned else "응답에 token/session 필드가 있습니다")

    if status != 200:
        print("\n정상 로그인에 실패했습니다. APP_ORIGIN, ADMIN_PASSWORD, DATABASE_URL 및 세션 테이블을 확인하세요.")
        return summarize()

    print("\n[4/7] 세션 상태 확인")
    status, _, body = request(opener, base + "/api/auth/me", headers=headers)
    payload = json_obj(body)
    record("/api/auth/me 는 인증 상태 true 반환", status == 200 and payload.get("authenticated") is True,
           f"HTTP {status}; {body[:180]}")

    print("\n[5/7] 인증된 관리자 API 접근 확인")
    status, _, body = request(opener, base + "/api/admin", headers=headers)
    record("로그인 후 /api/admin 접근 가능", status == 200,
           f"HTTP {status}" if status else body)

    print("\n[6/7] 잘못된 Origin의 변경 요청 차단 확인")
    bad_headers = {"Origin": "https://invalid-origin-for-security-test.example",
                   "Accept": "application/json"}
    status, _, body = request(
        opener, base + "/api/admin", "POST", bad_headers,
        {"items": []}
    )
    # Empty items is intentionally non-mutating; Origin validation should reject first.
    record("잘못된 Origin의 POST는 403", status == 403,
           f"HTTP {status}; 데이터 변경은 수행하지 않도록 빈 목록을 사용했습니다")

    print("\n[7/7] 로그아웃 후 세션 폐기 확인")
    status, _, body = request(opener, base + "/api/auth/logout", "POST", headers, {})
    record("로그아웃은 200", status == 200, f"HTTP {status}" if status else body)
    status_me, _, body_me = request(opener, base + "/api/auth/me", headers=headers)
    record("로그아웃 후 /api/auth/me 는 401", status_me == 401,
           f"HTTP {status_me}" if status_me else body_me)
    status_admin, _, body_admin = request(opener, base + "/api/admin", headers=headers)
    record("로그아웃 후 /api/admin 은 401", status_admin == 401,
           f"HTTP {status_admin}" if status_admin else body_admin)

    password = None
    return summarize()

def summarize():
    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed
    print("\n" + "=" * 68)
    print(f"결과: {passed} PASS / {failed} FAIL / {len(results)} 전체")
    if failed:
        print("FAIL 항목과 Vercel Function Logs를 확인하세요.")
        print("자주 있는 원인: 세션 테이블 미생성, APP_ORIGIN 불일치, 환경 변수 누락.")
    else:
        print("모든 자동 점검 항목을 통과했습니다.")
    print("=" * 68)
    input("\nEnter 키를 누르면 종료합니다...")
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(main())
