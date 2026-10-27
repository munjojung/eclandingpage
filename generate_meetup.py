import csv
import random
from datetime import datetime

# 1. 가상 데이터 생성 설정
names_kr = ["민준", "서윤", "도윤", "서연", "예준", "지우", "주원", "서현", "하준", "지유", 
            "시우", "하은", "지호", "민서", "준우", "지안", "현우", "서아", "건우", "하윤"]
names_en = ["Alice", "Bob", "Charlie", "David", "Emma", "Frank", "Grace", "Hannah", "Ian", "Jack", 
            "Kevin", "Lily", "Mason", "Nora", "Oliver", "Penny", "Quinn", "Ryan", "Sophia", "Tom"]

roles = ["한국인 참가자 (Korean Learner)", "외국인 참가자 (Foreigner)"]
levels = ["초급 (Beginner)", "중급 (Intermediate)", "고급 (Advanced)"]
times = ["오프라인 낮 (11:00 ~ 13:00)", "온라인 저녁 (20:00 ~ 21:30)"]
locations = ["유성구 (궁동/봉명/도안 등)", "둔산동/월평동", "대전역/중앙로"]
referrers = ["", "김철수", "지인 소개", "인스타그램", ""]

def generate_mock_data(num=100):
    data = []
    for i in range(1, num + 1):
        is_foreign = random.random() > 0.6 # 약 40% 외국인 비율
        name = f"{random.choice(names_en)} {random.choice(names_kr)}" if is_foreign else random.choice(names_kr) + f" ({i})"
        phone = f"010-{random.randint(1000,9999)}-{random.randint(1000,9999)}" if not is_foreign else f"Kakao_{name.split()[0].lower()}{i}"
        role = roles[1] if is_foreign else roles[0]
        level = random.choice(levels)
        pref_time = random.choice(times)
        loc = random.choice(locations) if "오프라인" in pref_time else "온라인 (Online)"
        ref = random.choice(referrers)
        
        data.append({
            "id": i,
            "name": name,
            "phone": phone,
            "role": role,
            "level": level,
            "preferred_time": pref_time,
            "location": loc,
            "referrer": ref,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
    return data

# 2. CSV 파일 저장
mock_applicants = generate_mock_data(100)
csv_filename = "esl_mock_applicants_100.csv"

with open(csv_filename, mode="w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["id", "name", "phone", "role", "level", "preferred_time", "location", "referrer", "created_at"])
    writer.writeheader()
    writer.writerows(mock_applicants)

print(f"✅ 가상 신청자 100명 CSV 파일 생성 완료: {csv_filename}")

# 3. 그루핑 로직 (시간대 -> 지역별 분류 후 최대 4명 + 퍼실리테이터 1명 = 총 5명 그룹화)
facilitators = ["Alex (Facilitator)", "Maria (Facilitator)", "John (Facilitator)", "Yuna (Facilitator)", "David (Facilitator)", "Minji (Facilitator)"]

# 조건별(희망시간대 + 지역)로 버킷 분류
buckets = {}
for app in mock_applicants:
    key = (app["preferred_time"], app["location"])
    if key not in buckets:
        buckets[key] = []
    buckets[key].append(app)

groups = []
group_id = 1

for key, applicants in buckets.items():
    pref_time, location = key
    random.shuffle(applicants)
    
    # 퍼실리테이터 1명 포함하여 최대 5명 구성 (참가자 4명 + 퍼실리테이터 1명)
    chunk_size = 4 
    for i in range(0, len(applicants), chunk_size):
        chunk = applicants[i:i + chunk_size]
        assigned_facilitator = facilitators[(group_id - 1) % len(facilitators)]
        
        groups.append({
            "group_id": group_id,
            "time": pref_time,
            "location": location,
            "facilitator": assigned_facilitator,
            "members": chunk
        })
        group_id += 1

# 4. HTML 공지 페이지 생성
html_content = f"""<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>대전 영어 커뮤니티(DIC) 밋업 매칭 결과 공지</title>
    <style>
        * {{ box-sizing: border-box; font-family: 'Pretendard', -apple-system, sans-serif; }}
        body {{ background-color: #f8fafc; margin: 0; padding: 30px; color: #1e293b; }}
        .container {{ max-width: 1100px; margin: 0 auto; background: white; padding: 40px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }}
        h1 {{ text-align: center; color: #ff5e62; margin-bottom: 5px; font-size: 28px; }}
        .subtitle {{ text-align: center; color: #64748b; margin-bottom: 35px; font-size: 15px; }}
        .stats-box {{ display: flex; justify-content: space-around; background: #fff1f2; padding: 15px; border-radius: 10px; margin-bottom: 30px; font-weight: bold; color: #e11d48; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }}
        .card {{ background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); transition: transform 0.2s; }}
        .card:hover {{ transform: translateY(-3px); box-shadow: 0 6px 15px rgba(0,0,0,0.08); }}
        .card-header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 12px; }}
        .group-title {{ font-size: 16px; font-weight: bold; color: #0f172a; }}
        .badge {{ background: #e0f2fe; color: #0284c7; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }}
        .meta-info {{ font-size: 12px; color: #64748b; margin-bottom: 12px; line-height: 1.5; }}
        .member-list {{ list-style: none; padding: 0; margin: 0; }}
        .member-item {{ padding: 6px 10px; background: #f8fafc; margin-bottom: 6px; border-radius: 6px; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }}
        .facilitator-item {{ background: #ecfdf5; color: #065f46; font-weight: bold; border: 1px dashed #34d399; }}
        .footer {{ text-align: center; margin-top: 40px; font-size: 13px; color: #94a3b8; }}
    </style>
</head>
<body>

<div class="container">
    <h1>English Community Meetup Matching</h1>
    <div class="subtitle">대전 영어 언어교환 프로그램 제1차 밋업 그룹 매칭 결과 공지</div>

    <div class="stats-box">
        <div>총 신청 인원: 100명</div>
        <div>생성된 밋업 그룹: {len(groups)}개 팀</div>
        <div>그룹당 정원: 최대 5명 (퍼실리테이터 포함)</div>
    </div>

    <div class="grid">
"""

for g in groups:
    members_html = f"""
        <li class="member-item facilitator-item">
            <span>⭐ 리더: {g["facilitator"]}</span>
            <span>(Host)</span>
        </li>
    """
    for m in g["members"]:
        members_html += f"""
        <li class="member-item">
            <span><b>{m["name"]}</b> <small>({m["level"][:2]})</small></span>
            <span style="color: #64748b; font-size: 11px;">{m["role"][:4]}</span>
        </li>
        """

    html_content += f"""
        <div class="card">
            <div class="card-header">
                <span class="group-title">Group #{g["group_id"]}</span>
                <span class="badge">{g["time"].split()[0]}</span>
            </div>
            <div class="meta-info">
                📍 <b>장소:</b> {g["location"]}<br>
                ⏰ <b>시간:</b> {g["time"]}
            </div>
            <ul class="member-list">
                {members_html}
            </ul>
        </div>
    """

html_content += f"""
    </div>
    <div class="footer">
        Generated at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")} | Daejeon International Community (DIC)
    </div>
</div>

</body>
</html>
"""

html_filename = "meetup_notice.html"
with open(html_filename, mode="w", encoding="utf-8") as f:
    f.write(html_content)

print(f"✅ HTML 공지 페이지 생성 완료: {html_filename}")