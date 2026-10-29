import requests

# 💡 본인의 Vercel 배포 도메인 주소와 설정한 관리자 비밀번호로 수정하세요
BASE_URL = "https://eclandingpage-kappa.vercel.app" 
ADMIN_PASSWORD = "!wjdanswhqazwsxedc"

def run_automated_tests():
    print("🚀 ESL 프로젝트 보안 및 API 자동 검증 테스트를 시작합니다...\n")

    # 1. 테스트: 인증 토큰 없이 관리자 API 접근 (401 또는 503 예상)
    print("1️⃣ [테스트] 인증 헤더 없는 관리자 API 접근 차단 검증")
    try:
        res = requests.get(f"{BASE_URL}/api/admin")
        print(f"   - 상태 코드: {res.status_code} (기대값: 401 또는 503)")
        print(f"   - 응답 내용: {res.json()}")
        assert res.status_code in [401, 503], "보안 취약점 발견: 인증 없는 접근이 차단되지 않았습니다!"
        print("   ✅ [성공] 인증 없는 접근이 안전하게 차단되었습니다.\n")
    except Exception as e:
        print(f"   ❌ [오류] {e}\n")

    # 2. 테스트: 잘못된 비밀번호로 관리자 API 접근 (401 예상)
    print("2️⃣ [테스트] 잘못된 관리자 비밀번호 접근 차단 검증")
    try:
        res = requests.get(
            f"{BASE_URL}/api/admin", 
            headers={"Authorization": "Bearer wrong_password_12345"}
        )
        print(f"   - 상태 코드: {res.status_code} (기대값: 401)")
        print(f"   - 응답 내용: {res.json()}")
        assert res.status_code == 401, "보안 취약점 발견: 틀린 비밀번호가 허용되었습니다!"
        print("   ✅ [성공] 잘못된 비밀번호가 성공적으로 차단되었습니다.\n")
    except Exception as e:
        print(f"   ❌ [오류] {e}\n")

    # 3. 테스트: 올바른 관리자 비밀번호로 API 조회 (200 예상)
    print("3️⃣ [테스트] 올바른 관리자 비밀번호로 데이터 조회 검증")
    try:
        res = requests.get(
            f"{BASE_URL}/api/admin", 
            headers={"Authorization": f"Bearer {ADMIN_PASSWORD}"}
        )
        print(f"   - 상태 코드: {res.status_code} (기대값: 200)")
        if res.status_code == 200:
            data_len = len(res.json().get('data', []))
            print(f"   - 응답 성공! (불러온 문의 데이터 건수: {data_len}건)")
            print("   ✅ [성공] 관리자 인증 및 데이터 조회가 정상 작동합니다.\n")
        else:
            print(f"   ❌ [실패] 관리자 인증 실패: {res.text}\n")
    except Exception as e:
        print(f"   ❌ [오류] {e}\n")

    # 4. 테스트: 등록되지 않은 번호로 회원 인증 우회 시도 (/api/check) (403 예상)
    print("4️⃣ [테스트] 미등록 전화번호로 인증 우회 차단 검증")
    try:
        res = requests.post(
            f"{BASE_URL}/api/check", 
            json={"phone": "010-9999-9999"}
        )
        print(f"   - 상태 코드: {res.status_code} (기대값: 403)")
        print(f"   - 응답 내용: {res.json()}")
        assert res.status_code == 403, "보안 취약점 발견: 미등록 번호가 인증을 통과했습니다!"
        print("   ✅ [성공] 미등록 번호 및 우회 시도가 안전하게 차단되었습니다.\n")
    except Exception as e:
        print(f"   ❌ [오류] {e}\n")

    print("🎉 모든 보안 및 API 자동 테스트가 완료되었습니다!")

if __name__ == "__main__":
    if ADMIN_PASSWORD == "여기에_Vercel에_설정한_실제_ADMIN_PASSWORD_입력":
        print("⚠️ 주의: 스크립트 상단의 ADMIN_PASSWORD 변수에 실제 설정하신 비밀번호를 입력한 후 실행해 주세요.")
    else:
        run_automated_tests()