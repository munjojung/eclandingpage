import requests
import json

# 테스트할 백엔드 주소 (로컬 또는 배포된 Vercel URL)
#BASE_URL = "http://localhost:3000" # 배포 환경인 경우 
BASE_URL = "https://eclandingpage-kappa.vercel.app"

def test_upsert_logic():
    print("🚀 밋업 일정 중복 방지(Upsert) 자동 테스트 시작...")

    payload = {
        "name": "테스트유저",
        "phone": "010-9999-8888",
        "target_date": "2026-10-30",
        "time_slot": "오프라인 낮 (11:00 ~ 13:00)"
    }

    # 1차 신청 (최초 등록)
    res1 = requests.post(f"{BASE_URL}/api/schedule", json=payload)
    print(f"1차 등록 결과: {res1.status_code}, {res1.json()}")
    assert res1.status_code == 200, "1차 등록 실패"

    # 2차 신청 (동일 번호, 동일 날짜, 다른 시간대로 수정하여 중복 신청)
    payload["time_slot"] = "온라인 저녁 (20:00 ~ 21:30) [수정됨]"
    res2 = requests.post(f"{BASE_URL}/api/schedule", json=payload)
    print(f"2차 중복 신청(수정) 결과: {res2.status_code}, {res2.json()}")
    assert res2.status_code == 200, "2차 등록 실패"

    print("✅ 테스트 완료! 관리자 페이지에서 해당 번호(010-9999-8888)의 데이터가 1건만 존재하며 '온라인 저녁 [수정됨]'으로 갱신되었는지 확인하세요.")

if __name__ == "__main__":
    test_upsert_logic()