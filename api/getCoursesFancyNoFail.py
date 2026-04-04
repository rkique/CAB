import json
import asyncio
import ssl
import certifi
import aiohttp

async def fetch_data(session, url, payload):
    async with session.post(url, json=payload) as response:
        raw_text = await response.text()
        parsed_json = None
        if response.status == 200:
            try:
                parsed_json = await response.json()
            except Exception:
                parsed_json = None
        return {
            "status": response.status,
            "raw_text": raw_text,
            "json": parsed_json,
        }

async def parse_courses(session, srcdb, failed_courses):
    url = 'https://cab.brown.edu/api/?page=fose&route=search&is_ind_study=N&is_canc=N'
    payload = {
        'other': {'srcdb': srcdb},
        'criteria': [{'field': 'is_ind_study', 'value': 'N'}, {'field': 'is_canc', 'value': 'N'}]
    }
    response_data = await fetch_data(session, url, payload)
    if response_data["json"]:
        courses = response_data["json"].get("results", [])
        if courses:
            print(f"Successfully fetched {len(courses)} courses for {srcdb}")
        return {
            "srcdb": srcdb,
            "results": courses,
        }
    else:
        failed_courses.append(srcdb)
        print(f"Search response for {srcdb} status={response_data['status']} body={response_data['raw_text'][:300]}")
        return {
            "srcdb": srcdb,
            "results": [],
        }

async def get_course_details(session, course, index, total, failed_details):
    url = 'https://cab.brown.edu/api/?page=fose&route=details'
    headers = {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'content-type': 'application/json',
        # Include other headers as required
    }
    payload = {
        'group': f'code:{course["code"]}',
        'key': f'crn:{course["crn"]}',
        'srcdb': str(course['srcdb'])
    }
    course_detail = await fetch_data(session, url, payload)
    if course_detail["json"]:
        print(f"Fetched details for {course['code']} ({index + 1} of {total})")
        return course_detail["json"]
    else:
        failed_details.append(course)
        print(f"Detail response for {course['code']} status={course_detail['status']} body={course_detail['raw_text'][:300]}")
        return None

async def get_courses_since_summer_2016(session, failed_courses):
    semesters = ['00', '10', '20', '15']  # Summer, Fall, Spring, Winter
    all_courses = []
    course_overviews = []
    for year in range(2016, 2027):
        for semester in semesters:
            srcdb = str(year) + semester
            if srcdb != '202115':
                overview = await parse_courses(session, srcdb, failed_courses)
                course_overviews.append(overview)
                all_courses.extend(overview["results"])
    return all_courses, course_overviews

async def main():
    failed_courses = []
    failed_details = []
    ssl_ctx = ssl.create_default_context(cafile=certifi.where())
    conn = aiohttp.TCPConnector(ssl=ssl_ctx)
    headers = {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
        'origin': 'https://cab.brown.edu',
        'referer': 'https://cab.brown.edu/',
    }
    async with aiohttp.ClientSession(connector=conn, headers=headers) as session:
        courses, course_overviews = await get_courses_since_summer_2016(session, failed_courses)
        total_courses = len(courses)
        with open('courses_overview.json', 'w') as file:
            json.dump(course_overviews, file, indent=4)
        print(f"Starting to fetch details for {total_courses} courses...")
        course_details = await asyncio.gather(*(
            get_course_details(session, course, index, total_courses, failed_details) for index, course in enumerate(courses)
        ))

        # Retry fetching failed courses and course details
        if failed_courses:
            print(f"Retrying failed course fetches for srcdb: {failed_courses}")
            retry_overviews = await asyncio.gather(*(parse_courses(session, srcdb, []) for srcdb in failed_courses))
            course_overviews.extend(retry_overviews)
            for overview in retry_overviews:
                courses.extend(overview["results"])

        if failed_details:
            print(f"Retrying failed course details for {len(failed_details)} courses...")
            retry_details = await asyncio.gather(*(
                get_course_details(session, course, index, len(failed_details), []) for index, course in enumerate(failed_details)
            ))
            course_details.extend(retry_details)

    with open('courses.json', 'w') as file:
        json.dump(course_details, file, indent=4)

if __name__ == "__main__":
    asyncio.run(main())
