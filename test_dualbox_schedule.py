import requests

BASE_URL = "https://eclandingpage-kappa.vercel.app" # 또는 "http://localhost:3000"

def test_multiple_timeslot():
    print("🚀 하루에 2개 시간대 복수 신청 테스트 시작...")

    # 오프라인 낮 + 온라인 저녁 시간대를 동시에 선택한 경우 (쉼표로 구분되어 전송됨)
    payload = {
        "name": "복수신청유저",
        "phone": "010-8888-7777",
        "target_date": "2026-10-30",
        "time_slot": "Offline Day (11:00 ~ 13:00), Online Night (20:00 ~ 21:30)"
    }

    res = requests.post(f"{BASE_URL}/api/schedule", json=payload)
    print(f"복수 시간대 등록 결과: {res.status_code}, {res.json()}")
    assert res.status_code == 200, "복수 시간대 등록 실패"
    print("✅ 테스트 완료! 관리자 페이지에서 해당 유저의 희망 시간대에 두 시간대가 모두 잘 저장되었는지 확인하세요.")

if __name__ == "__main__":
    test_multiple_timeslot()