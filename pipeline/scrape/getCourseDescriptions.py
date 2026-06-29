import json
import asyncio
import ssl
import certifi
import aiohttp

SEARCH_URL = 'https://cab.brown.edu/api/?page=fose&route=search&is_ind_study=N&is_canc=N'
DETAILS_URL = 'https://cab.brown.edu/api/?page=fose&route=details'
CONCURRENCY = 50

HEADERS = {
    'accept': 'application/json, text/javascript, */*; q=0.01',
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'x-requested-with': 'XMLHttpRequest',
    'origin': 'https://cab.brown.edu',
    'referer': 'https://cab.brown.edu/',
}

sem = asyncio.Semaphore(CONCURRENCY)

async def fetch_json(session, url, payload):
    async with sem:
        async with session.post(url, json=payload) as resp:
            if resp.status == 200:
                return await resp.json()
            return None

async def main():
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    conn = aiohttp.TCPConnector(ssl=ssl_ctx)
    async with aiohttp.ClientSession(connector=conn, headers=HEADERS) as session:
        # 1. Get all courses across all semesters
        semesters = ['00', '10', '20', '15']  # Summer, Fall, Spring, Winter
        all_courses = []
        for year in range(2016, 2027):
            for sem_code in semesters:
                srcdb = f'{year}{sem_code}'
                if srcdb == '202115':
                    continue
                search_payload = {
                    'other': {'srcdb': srcdb},
                    'criteria': [
                        {'field': 'is_ind_study', 'value': 'N'},
                        {'field': 'is_canc', 'value': 'N'}
                    ]
                }
                data = await fetch_json(session, SEARCH_URL, search_payload)
                if data:
                    courses = data.get('results', [])
                    for c in courses:
                        c['srcdb'] = srcdb
                    all_courses.extend(courses)
                    print(f"{srcdb}: {len(courses)} courses")

        total = len(all_courses)
        print(f"\nTotal: {total} courses. Fetching descriptions...")

        # 2. Fetch details for each course
        done = 0
        async def get_desc(c):
            nonlocal done
            payload = {
                'group': f'code:{c["code"]}',
                'key': f'crn:{c["crn"]}',
                'srcdb': c['srcdb']
            }
            detail = await fetch_json(session, DETAILS_URL, payload)
            done += 1
            if done % 500 == 0:
                print(f"  {done}/{total}")
            if detail:
                return {
                    'code': c['code'],
                    'title': c['title'],
                    'crn': c['crn'],
                    'srcdb': c['srcdb'],
                    'description': detail.get('description', ''),
                }
            return {'code': c['code'], 'title': c['title'], 'crn': c['crn'], 'srcdb': c['srcdb'], 'description': ''}

        results = await asyncio.gather(*(get_desc(c) for c in all_courses))

    with open('course_descriptions.json', 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved {len(results)} descriptions to course_descriptions.json")

if __name__ == '__main__':
    asyncio.run(main())
